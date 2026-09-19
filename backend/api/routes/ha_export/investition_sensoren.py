"""HA-Export — die Investitions-Sensoren: `calculate_investition_sensors` je Komponente (Speicher, E-Auto, Wärmepumpe,
Wallbox, Balkonkraftwerk, Sonstiges) aus den Monats-Fakten und dem Layer-SoT.
"""
# Reiner Umzug aus `api/routes/ha_export.py` (18.09.2026, Vorlage 8 des Refactorings grosser Dateien):
# Code 1:1 uebernommen, kein Verhaltenswechsel. Die Fassade `__init__.py` haengt den Router ein und exportiert
# die Namen weiter, die Aufrufer und Tests bisher aus dem Modul importierten.

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from backend.core.berechnungen import heizwaerme_ist_abgeleitet
from backend.core.berechnungen.waermepumpe_kennzahl import (
    abgrenzungs_grund,
    arbeitszahl,
    ersparnis_vorbehalt,
    heizwaerme_kwh,
    waerme_gesamt_kwh,
)
from backend.services.wp_wirtschaftlichkeit import berechne_wp_ersparnis
from datetime import date
from backend.api.routes.strompreise import (
    lade_tarife_fuer_anlage,
    monats_strompreis_lookup,
    resolve_strompreis_for_komponente,
)
from backend.core.betriebsmodus import BETRIEBSMODUS_LABEL
from backend.core.berechnungen.betriebsart_gemessen import (
    ModusStromZeile,
    funktionsfremd_abzug_kwh,
    modus_strom_zeile,
)
from backend.core.field_definitions import (
    get_emob_pv_netz_kwh,
    get_wp_strom_kwh,
    get_wp_warmwasser_kwh,
    nenner_ist_feine_summe,
)
from backend.services.eauto_wirtschaftlichkeit import berechne_eauto_ersparnis_periode
from backend.models.monatsdaten import Monatsdaten
from backend.services.energie_profil.modus_split_monat import lade_modus_split_ohne_abschluss
from backend.models.investition import Investition, InvestitionMonatsdaten
from backend.models.strompreis import Strompreis
from backend.services.ha_sensors_export import (
    SensorValue,
    INVESTITION_SENSOREN,
    E_AUTO_SENSOREN,
    WAERMEPUMPE_SENSOREN,
)
from backend.core.investition_parameter import (
    PARAM_E_AUTO,
    PARAM_E_AUTO_DEFAULTS,
    abgrenzung_stoerung,
)
from backend.api.routes.ha_export.emob import _EmobPoolCtx, _emob_month_share


async def calculate_investition_sensors(
    db: AsyncSession,
    investition: Investition,
    strompreis: Optional[Strompreis],
    emob_ctx: Optional[_EmobPoolCtx] = None,
    modus_map: Optional[dict[int, str]] = None,
) -> list[SensorValue]:
    """Berechnet Sensor-Werte für eine Investition basierend auf Typ.

    `emob_ctx` (Phase 2a): liegt die Heimladung kanonisch auf der Wallbox
    (evcc), ziehen die E-Auto-Sensoren PV-Anteil + Ersparnis km-anteilig aus dem
    Wallbox-Pool statt aus der leeren E-Auto-IMD. Ohne Kontext (Default) bleibt
    das Verhalten unverändert (eigene IMD-Werte)."""
    sensor_values = []

    # InvestitionMonatsdaten laden
    imd_result = await db.execute(
        select(InvestitionMonatsdaten)
        .where(InvestitionMonatsdaten.investition_id == investition.id)
    )
    # #308: SoT-Filter auf die Laufzeit (Anschaffung→Stilllegung), symmetrisch
    # zur Schwesterfunktion `calculate_anlage_sensors` (#236). Ohne ihn flossen
    # IMD-Monate vor Anschaffung / nach Stilllegung in die per-Investition-
    # HA-Sensoren (km, Verbrauch, PV-Anteil, Ersparnis) ein.
    monatsdaten = [
        md for md in imd_result.scalars().all()
        if investition.ist_aktiv_im_monat(md.jahr, md.monat)
    ]

    def _emob_daten(md: InvestitionMonatsdaten) -> dict:
        """F-16: die Zeile mit abgeleitetem PV-Anteil aus dem Pool-Kontext.

        Bewusst **nicht** hier selbst abgeleitet: der Torwächter entscheidet
        über E-Auto und Wallbox eines Monats zusammen, diese Funktion sieht aber
        nur ein Gerät (s. ``_EmobPoolCtx.daten_by_key``). Ohne Kontext bleibt es
        beim Rohwert — dasselbe Verhalten wie vor F-16.
        """
        if emob_ctx is None:
            return md.verbrauch_daten or {}
        return emob_ctx.daten_by_key.get(
            (investition.id, md.jahr, md.monat), md.verbrauch_daten or {}
        )

    params = investition.parameter or {}
    netzbezug_preis = strompreis.netzbezug_arbeitspreis_cent_kwh if strompreis else 30.0

    # ROI-Basisdaten
    if investition.anschaffungskosten_gesamt:
        for sensor in INVESTITION_SENSOREN:
            if sensor.key == "investition_gesamt_euro":
                sensor_values.append(SensorValue(
                    definition=sensor,
                    value=investition.anschaffungskosten_gesamt,
                    berechnung=None
                ))

    # E-Auto / Wallbox Sensoren
    if investition.typ in ("e-auto", "wallbox"):
        gesamt_km = 0.0
        gesamt_verbrauch = 0.0
        gesamt_pv_ladung = 0.0
        gesamt_netz_ladung = 0.0

        for md in monatsdaten:
            d = _emob_daten(md)
            km_m = d.get("km_gefahren", 0) or 0
            gesamt_km += km_m
            gesamt_verbrauch += d.get("verbrauch_kwh", 0) or 0
            # Phase 2a: evcc-Setup → PV/Netz km-anteilig aus dem Wallbox-Pool.
            share = _emob_month_share(emob_ctx, investition.typ, km_m, md.jahr, md.monat)
            if share is not None:
                gesamt_pv_ladung += share.pv_kwh
                gesamt_netz_ladung += share.netz_kwh
            else:
                # #262: PV/Netz via SoT-Helper — bei Imports ohne expliziten
                # `ladung_netz_kwh`-Key wird aus `Total − PV` abgeleitet.
                pv, netz = get_emob_pv_netz_kwh(d)
                gesamt_pv_ladung += pv
                gesamt_netz_ladung += netz

        gesamt_ladung = gesamt_pv_ladung + gesamt_netz_ladung

        for sensor in E_AUTO_SENSOREN:
            value = None
            berechnung = None

            if sensor.key == "e_auto_km_gesamt":
                if gesamt_km > 0:
                    value = gesamt_km
                    berechnung = f"Summe aus {len(monatsdaten)} Monaten"
            elif sensor.key == "e_auto_verbrauch_kwh_100km":
                if gesamt_km > 0 and gesamt_verbrauch > 0:
                    value = gesamt_verbrauch / gesamt_km * 100
                    berechnung = f"{gesamt_verbrauch:.0f} / {gesamt_km:.0f} × 100"
            elif sensor.key == "e_auto_pv_anteil_prozent":
                if gesamt_ladung > 0:
                    value = gesamt_pv_ladung / gesamt_ladung * 100
                    berechnung = f"{gesamt_pv_ladung:.0f} / {gesamt_ladung:.0f} × 100"
            elif sensor.key == "e_auto_ersparnis_vs_benzin_euro":
                if gesamt_km > 0:
                    # Monatliche Kraftstoffpreise laden (Fallback: statischer Parameter)
                    fallback_benzinpreis = params.get(PARAM_E_AUTO["BENZINPREIS_EURO"], PARAM_E_AUTO_DEFAULTS["benzinpreis_euro"])
                    vergleich_l = params.get(
                        PARAM_E_AUTO["VERGLEICH_VERBRAUCH_L_100KM"],
                        PARAM_E_AUTO_DEFAULTS["vergleich_verbrauch_l_100km"],
                    )
                    anlage_md_result = await db.execute(
                        select(Monatsdaten).where(Monatsdaten.anlage_id == investition.anlage_id)
                    )
                    anlage_md_dict = {
                        (m.jahr, m.monat): m for m in anlage_md_result.scalars().all()
                    }
                    # N-181/F-18: sechste Kopie der Formel aufgelöst — die
                    # Rechnung kommt aus dem Layer-SoT, diese Schleife sammelt
                    # nur die Eingänge. Die Preisachse war hier die letzte, die
                    # noch den **heutigen** Tarif nahm (`netzbezug_preis`), und
                    # zwar den ALLGEMEINEN statt des Wallbox-Tarifs.
                    km_pro_monat_sensor: list[tuple[int, int, float]] = []
                    netz_pro_monat_sensor: list[tuple[int, int, float]] = []
                    netz_total_sensor = 0.0
                    fahrverbrauch_sensor = 0.0
                    monate_sensor: list[tuple[int, int]] = []
                    for md in monatsdaten:
                        d = _emob_daten(md)
                        km = d.get("km_gefahren", 0) or 0
                        # #262: SoT-Helper liefert (pv, netz) mit Fallback.
                        _, netz = get_emob_pv_netz_kwh(d)
                        # Phase 2a: evcc → Netz km-anteilig aus dem Wallbox-Pool.
                        share = _emob_month_share(emob_ctx, investition.typ, km, md.jahr, md.monat)
                        if share is not None:
                            netz = share.netz_kwh
                        monate_sensor.append((md.jahr, md.monat))
                        netz_total_sensor += netz
                        if netz > 0:
                            netz_pro_monat_sensor.append((md.jahr, md.monat, netz))
                        if km > 0:
                            km_pro_monat_sensor.append((md.jahr, md.monat, km))
                            fahrverbrauch_sensor += d.get("verbrauch_kwh", 0) or 0

                    preis_lookup_sensor = await monats_strompreis_lookup(
                        db, investition.anlage_id, "wallbox", monate_sensor,
                        fallback_bezug=netzbezug_preis,
                    )
                    erg = berechne_eauto_ersparnis_periode(
                        km_pro_monat=km_pro_monat_sensor,
                        ladung_netz_kwh_gesamt=netz_total_sensor,
                        # Wie beim Anlagen-Sensor: externe Ladekosten waren hier
                        # noch nie enthalten — beim Umhängen nicht stillschweigend
                        # dazunehmen.
                        ladung_extern_euro_gesamt=0.0,
                        wallbox_strompreis_cent=netzbezug_preis,
                        eauto_parameter=params,
                        monats_benzinpreis_lookup={
                            k: m.kraftstoffpreis_euro for k, m in anlage_md_dict.items()
                        },
                        fahrverbrauch_kwh_gesamt=fahrverbrauch_sensor or None,
                        monats_strompreis_lookup=preis_lookup_sensor,
                        netz_pro_monat=netz_pro_monat_sensor or None,
                    )
                    benzin_kosten = erg.benzin_kosten_euro
                    strom_kosten = erg.strom_kosten_euro
                    fossile_kosten = erg.fossile_kosten_euro

                    value = erg.ersparnis_euro
                    berechnung = (
                        f"{benzin_kosten:.2f} (Benzin) - {strom_kosten:.2f} (Strom"
                        f" @ {erg.verwendeter_strompreis_cent:.2f} ct/kWh)"
                        + (f" - {fossile_kosten:.2f} (Kraftstoff)" if fossile_kosten else "")
                    )

            if value is not None:
                sensor_values.append(SensorValue(
                    definition=sensor,
                    value=value,
                    berechnung=berechnung
                ))

    # Wärmepumpe Sensoren
    elif investition.typ == "waermepumpe":
        # DI-4: WP-Strom mit dem WP-Spezialtarif bewerten (Fallback allgemein),
        # deckungsgleich mit aktueller_monat.py und der Anlage-Aggregation oben.
        gesamt_strom = 0.0
        # N-391: die Wärme des Geräts nach der kanonischen Vorrangregel D1 —
        # **je Zeile aufgelöst**, nicht am Ende aus zwei Summen gebildet.
        # ⛔ Hier standen bis zum 14.09.2026 `gesamt_heizung` und
        # `gesamt_warmwasser`, deren einziger Zweck ihre Summe am Ende war. Eine
        # Zeile mit gemeinsamem Wärmemengenzähler trug zu beiden nichts bei —
        # die Wärme-, Arbeitszahl- und Ersparnis-Sensoren dieser Wärmepumpe
        # meldeten 0 bzw. nichts, während Hub und Cockpit die Zahl zeigten.
        gesamt_waerme_kanonisch = 0.0

        # #263 K-2 (Konzept §3.5): abgeleitete Wärme trägt keine JAZ — sonst
        # exportierte eedc die gepflegte JAZ als gemessenen Sensorwert nach HA,
        # wo sie in Automationen und Langzeitstatistik weiterlebt.
        waerme_abgeleitet = False
        # #263 K-2 (S4): Teilmengen nach Betriebsmodus — nie Summanden.
        gesamt_modus_heizen = 0.0
        gesamt_modus_kuehlen = 0.0
        gesamt_modus_warmwasser = 0.0
        #: ⭐ **SOLL-§9-E7/Option A: was vom Nenner abgezogen werden DARF.**
        #: ⛔ **Nicht die Summe der funktionsfremden Mengen** — hier stand bis
        #: zum 12.09.2026 `gesamt_modus_funktionsfremd`, das jede solche Menge
        #: aufaddierte. Bei getrennter Strommessung mit nur **abgeleiteter**
        #: Aufteilung ist der Abzug 0: Die Verteilung darf
        #: `strom_heizen + strom_warmwasser` nicht um eine Menge kürzen, die nie
        #: dazukam (W-16 addiert nur den **gemessenen** Anteil). Die Mengen
        #: selbst tragen unverändert die Betriebsart-Sensoren weiter unten (K1)
        #: — sie stehen in `gesamt_modus_kuehlen` und seinen Nachbarn.
        gesamt_modus_funktionsfremd_abzug = 0.0
        gesamt_modus_abdeckung_h = 0.0
        #: F-56 — trägt irgendeine Zeile GEMESSENE Betriebsart-Zähler? Dann
        #: dürfen die beiden Sensoren erscheinen, auch ohne Modus-Abdeckung:
        #: die Abdeckung ist die Zeitbasis des *abgeleiteten* Wegs und bleibt
        #: bei gemessenen Zählern zu Recht 0.
        gesamt_modus_gemessen = False
        #: F-52: Was der Abschluss schon festgeschrieben hat — und der gepflegte
        #: Gesamtwert je Monat. Beides braucht der Nachtrag unten, um
        #: „gespeichert schlägt gerechnet" und die Teilmengen-Invariante
        #: anwenden zu können. Entsteht in DIESEM Durchlauf, damit keine dritte
        #: Quelle für dieselben Werte aufgemacht wird.
        gespeichert_je_monat: dict[tuple[int, int], dict[str, tuple[bool, float]]] = {}
        # B5/X-1: der Kühlstrom je Monat — für E-B in der Ersparnis unten.
        kuehl_je_monat: dict[tuple[int, int], float] = {}
        # B5/X-1: der Kühlstrom je Monat — für E-B in der Ersparnis unten.
        kuehl_je_monat: dict[tuple[int, int], float] = {}
        #: ⛔ **N-462 (13.09.2026): je Monatszeile, nicht einmal vor der
        #: Schleife.** SOLL-§9-E7/Option A fragt „steckt der funktionsfremde
        #: Anteil im Nenner?" — das entscheidet die **Stufe** dieser Zeile (K3),
        #: nicht das Kennzeichen des Geräts. Der Nachtrag-Block weiter unten
        #: sieht seine Zeile nicht mehr und liest die Stufe deshalb hier mit.
        _nenner_fein_je_monat: dict[tuple[int, int], bool] = {}
        for md in monatsdaten:
            d = md.verbrauch_daten or {}
            # F-56: **gemessen schlägt abgeleitet**, über den Layer-SoT —
            # nicht daneben nachgebaut. Genau dieser Nachbau (`d.get(
            # MODUS_STROM_FELD[…])` plus eine Abdeckungs-Prüfung ohne den
            # Gemessen-Zweig) ließ die beiden Sensoren stumm, während Cockpit
            # und Komponenten-Hub die Aufteilung schon zeigten.
            _zeile = modus_strom_zeile(d)
            kuehl_je_monat[(md.jahr, md.monat)] = _zeile.kuehlen_kwh
            gesamt_modus_heizen += _zeile.heizen_kwh
            gesamt_modus_kuehlen += _zeile.kuehlen_kwh
            gesamt_modus_warmwasser += _zeile.warmwasser_kwh
            # SOLL-§9-E7/Option A — die Regel wird gerufen, nicht nachgebaut.
            _nenner_fein_je_monat[(md.jahr, md.monat)] = nenner_ist_feine_summe(
                d, investition.parameter,
            )
            gesamt_modus_funktionsfremd_abzug += funktionsfremd_abzug_kwh(
                _zeile, hat_split=_nenner_fein_je_monat[(md.jahr, md.monat)],
            )
            gesamt_modus_abdeckung_h += _zeile.abdeckung_h
            gesamt_modus_gemessen = gesamt_modus_gemessen or _zeile.gemessen
            gesamt_strom += get_wp_strom_kwh(d, investition.parameter)
            gespeichert_je_monat[(md.jahr, md.monat)] = {
                str(investition.id): (
                    # ⚠ `hat_aufteilung`, nicht nur die Abdeckung: eine
                    # gemessene Zeile braucht den gerechneten Split nicht und
                    # darf ihn nicht zusätzlich bekommen (Doppelzählung).
                    # `monats_fakten/` wendet dieselbe Weiche an.
                    _zeile.hat_aufteilung,
                    get_wp_strom_kwh(d, investition.parameter),
                )
            }
            gesamt_waerme_kanonisch += waerme_gesamt_kwh(
                d.get("waerme_kwh"),
                heizwaerme_kwh(d),   # N-398
                # N-379: die eine Lesetuer — sonst traegt der HA-Sensor eine
                # Waermemenge, die es am Geraet nicht gibt.
                get_wp_warmwasser_kwh(d, investition.parameter),
            )
            waerme_abgeleitet = waerme_abgeleitet or heizwaerme_ist_abgeleitet(
                md.source_provenance
            )

        # F-52: Monate ohne Abschluss tragen ihren Split aus der Tagesebene
        # nach. **Ohne diesen Block blieben genau diese zwei Sensoren stumm**,
        # während Komponenten-Hub und Cockpit die Aufteilung schon zeigen —
        # zwei Zahlen für dieselbe Größe, die Klasse hinter #331 und F-15.
        # ⚠ Die Regeln stehen NICHT hier, sondern im gemeinsamen Lader; dieser
        # Pfad faltet je Investition und geht deshalb nicht über die
        # Monats-Fakten (bekannte P10-Restschuld von `ha_export.py`).
        nachgetragen = await lade_modus_split_ohne_abschluss(
            db, investition.anlage_id,
            inv_by_id={investition.id: investition},
            gespeichert=gespeichert_je_monat,
        )
        for _schluessel, _je_inv in nachgetragen.items():
            for _split in _je_inv.values():
                kuehl_je_monat[_schluessel] = (
                    kuehl_je_monat.get(_schluessel, 0.0) + _split.kuehlen_kwh
                )
                gesamt_modus_heizen += _split.heizen_kwh
                gesamt_modus_kuehlen += _split.kuehlen_kwh
                gesamt_modus_warmwasser += _split.warmwasser_kwh
                # ⚠ Hier zählt `kuehlen_kwh` und nicht die volle Definition —
                # `AngewandterSplit` hat sie nicht, und das ist richtig so: Der
                # **abgeleitete** Modus-Split kennt nur Heizen, Kühlen und
                # Warmwasser (er leitet aus dem Betriebsmodus ab, und
                # Lüften/Entfeuchten liefern dort keine eigene Menge).
                # ⭐ **SOLL-§9-E7/Option A, und hier ist der Zweig immer der
                # abgeleitete** — `lade_modus_split_ohne_abschluss` trägt genau
                # die Monate ohne gemessene Betriebsart-Zeile nach. Die Regel
                # wird gerufen, nicht nachgebaut (F-56); `ModusStromZeile` ist
                # bloß die Übergabeform.
                gesamt_modus_funktionsfremd_abzug += funktionsfremd_abzug_kwh(
                    ModusStromZeile(
                        heizen_kwh=_split.heizen_kwh,
                        kuehlen_kwh=_split.kuehlen_kwh,
                        warmwasser_kwh=_split.warmwasser_kwh,
                        gemessen=False,
                        abdeckung_h=_split.abdeckung_h,
                    ),
                    # N-462: die Stufe DIESES Monats. Trägt er gar keine
                    # Zeile, gibt es auch keinen Gesamtzähler, auf den er
                    # zurückfallen könnte — dann bleibt es bei der Lage des
                    # Kennzeichens, und die ist hier „feine Summe".
                    hat_split=_nenner_fein_je_monat.get(
                        _schluessel,
                        bool((investition.parameter or {})
                             .get("getrennte_strommessung")),
                    ),
                )
                gesamt_modus_abdeckung_h += _split.abdeckung_h

        # N-391: dieselbe Auflösung wie im Hub und in den Monats-Fakten. Ohne sie
        # meldeten die Sensoren *Wärme erzeugt*, *Arbeitszahl* und *Ersparnis*
        # einer Wärmepumpe mit gemeinsamem Wärmemengenzähler 0 bzw. nichts.
        gesamt_waerme = gesamt_waerme_kanonisch

        # Issue #238: Counter-Summen (Starts/Betriebsstunden) dieser WP aus
        # TagesZusammenfassung.komponenten_starts über die Laufzeit. Nur gesetzt,
        # wenn der jeweilige Zähler überhaupt Werte geliefert hat.
        from backend.models.tages_energie_profil import TagesZusammenfassung
        inv_id_str = str(investition.id)
        tz_res = await db.execute(
            select(TagesZusammenfassung.datum, TagesZusammenfassung.komponenten_starts)
            .where(TagesZusammenfassung.anlage_id == investition.anlage_id)
            .where(TagesZusammenfassung.komponenten_starts.is_not(None))
        )
        wp_starts_total = 0
        wp_stunden_total = 0.0
        hat_starts = hat_stunden = False
        for datum_, komp in tz_res.all():
            if not investition.ist_aktiv_im_monat(datum_.year, datum_.month):
                continue
            c = ((komp or {}).get("wp_starts_anzahl") or {}).get(inv_id_str)
            if isinstance(c, (int, float)) and c > 0:
                wp_starts_total += int(c)
                hat_starts = True
            h = ((komp or {}).get("wp_betriebsstunden") or {}).get(inv_id_str)
            if isinstance(h, (int, float)) and h > 0:
                wp_stunden_total += float(h)
                hat_stunden = True

        for sensor in WAERMEPUMPE_SENSOREN:
            value = None
            berechnung = None
            zusatz_attribute: dict = {}

            if sensor.key == "wp_cop_durchschnitt":
                # ADR-002/P12 (02.09.2026): Die Arbeitszahl entsteht im Layer,
                # nie hier. **Bis dahin stand an dieser Stelle
                # `gesamt_waerme / gesamt_strom`** — eine eigene Division, die
                # von allen R2-Sperren nur die abgeleitete Wärme kannte.
                #
                # ⛔ **Zwei Größen fehlten, und beide bewegen die Zahl:**
                # der funktionsfremde Strom (**W-14/E4** — Kühlen, Lüften,
                # Entfeuchten standen im Nenner, obwohl ihre Nutzenergie in
                # keinem Wärmemengenzähler landet) und die Anwender-Angabe
                # „Fremdanteil auf dem Zähler" (**W-7**, Heizstab/bivalent).
                # Der Hub rechnete beides seit dem 26.08. heraus; dieser Sensor
                # nicht — **dieselbe Anlage, zwei Aussagen**, und diese hier
                # verlässt eedc in fremde Dashboards und Automationen.
                #
                # ⚠ `bauarten_gemischt` und `geraete_ohne_waerme` gehören hier
                # **nicht** hinein und ihr Fehlen ist keine Lücke: Der Block
                # faltet **eine** Investition. Ein Gerät hat nur eine Bauart,
                # und meldet es keine Wärme, ist `gesamt_waerme` bereits 0.
                _az = arbeitszahl(
                    gesamt_waerme, gesamt_strom,
                    waerme_abgeleitet_kwh=1.0 if waerme_abgeleitet else 0.0,
                    # SOLL-§9-E7/Option A: der **Abzug**, nicht die Menge.
                    strom_funktionsfremd_kwh=gesamt_modus_funktionsfremd_abzug,
                    abgrenzung_verletzt=abgrenzungs_grund(
                        abgrenzung_stoerung=abgrenzung_stoerung(investition),
                    ),
                )
                if _az.wert is not None:
                    value = _az.wert
                    berechnung = (
                        f"{_az.zaehler_kwh:.0f} / {_az.nenner_kwh:.0f}"
                        if _az.zaehler_kwh is not None and _az.nenner_kwh is not None
                        else None
                    )
                elif _az.grund and (gesamt_strom > 0 or gesamt_waerme > 0):
                    # B5/X-3 (SOLL §3.3 S3, ADR-002/P12): eine GESPERRTE
                    # Kennzahl ist ein Sensor ohne Wert, der seinen Grund
                    # nennt — nicht ein Sensor, der fehlt. Fehlte er, bliebe
                    # in Home Assistant der letzte publizierte Wert stehen
                    # (retain, kein expire_after) und liefe stündlich in die
                    # Langzeitstatistik weiter. Nur wo die Eingänge da sind:
                    # ein Gerät ohne jede Messung (F1) bekommt weiterhin keinen
                    # Sensor — sonst entstünden Entitäten für nie erfasste
                    # Größen (#400, Knallfrosch-Klasse).
                    zusatz_attribute = {"grund": _az.grund}
            elif sensor.key == "wp_ersparnis_euro":
                # B5/X-1 (05.09.2026): dieselbe Rechnung wie Hub und Cockpit —
                # der Layer `berechne_wp_ersparnis`, je Monat mit dem Tarif
                # seines Stichtags (ADR-002/P8) und ohne den Kühlstrom im
                # Vergleich (Entscheid E-B, 18.08.).
                #
                # ⛔ **Bis hierher stand eine eigene Formel:** `alte Kosten −
                # Σ Strom × heutiger WP-Tarif`. Gemessen an denselben Sprossen
                # wie der Hub: F8 (Kühlstrom 300 kWh) 10 € statt 100 €; zwei
                # Tarife (Juli 30 ct, ab September 40 ct) 66,67 € statt
                # 166,67 € — der Juli wurde mit dem Septemberpreis bewertet.
                # Dritte Kopie der Ersparnis-Formel (SOLL §3.3 S1); die
                # Zusatzkosten der Altheizung, die hier schon standen, trägt
                # seit X-4 der Layer selbst.
                #
                # N-88/F2b bleibt: ohne ersetzte Heizung ist kein Monat
                # `bewertbar`, und der Sensor bleibt leer statt eine Ersparnis
                # zu behaupten.
                anlage_md_result = await db.execute(
                    select(Monatsdaten).where(Monatsdaten.anlage_id == investition.anlage_id)
                )
                anlage_md_dict = {
                    (m.jahr, m.monat): m for m in anlage_md_result.scalars().all()
                }
                alte_kosten = 0.0
                wp_kosten = 0.0
                kuehl_kosten = 0.0
                bewertbar = False
                for md in monatsdaten:
                    d = md.verbrauch_daten or {}
                    m_waerme = waerme_gesamt_kwh(   # N-391 (D1), N-379, N-398
                        d.get("waerme_kwh"),
                        heizwaerme_kwh(d),
                        get_wp_warmwasser_kwh(d, investition.parameter),
                    )
                    m_strom = get_wp_strom_kwh(d, investition.parameter)
                    if m_waerme <= 0 and m_strom <= 0:
                        continue
                    m_tarife = await lade_tarife_fuer_anlage(
                        db, investition.anlage_id, target_date=date(md.jahr, md.monat, 1)
                    )
                    m_preis = resolve_strompreis_for_komponente(
                        m_tarife, "waermepumpe", fallback=netzbezug_preis
                    )
                    amd = anlage_md_dict.get((md.jahr, md.monat))
                    m_erg = berechne_wp_ersparnis(
                        wp_waerme_kwh=m_waerme,
                        wp_strom_kwh=m_strom,
                        wp_strompreis_cent=m_preis,
                        wp_parameter=investition.parameter,
                        monats_gaspreis_cent=(
                            amd.gaspreis_cent_kwh if amd else None
                        ),
                        strom_kuehlen_kwh=kuehl_je_monat.get((md.jahr, md.monat), 0.0),
                    )
                    alte_kosten += m_erg.alte_heizung_kosten_euro
                    wp_kosten += m_erg.wp_kosten_euro
                    kuehl_kosten += m_erg.kuehl_kosten_euro
                    bewertbar = bewertbar or m_erg.bewertbar
                if bewertbar:
                    value = alte_kosten - (wp_kosten - kuehl_kosten)
                    berechnung = (
                        f"{alte_kosten:.2f} (alt) - {wp_kosten - kuehl_kosten:.2f} (WP)"
                    )
                    if kuehl_kosten > 0:
                        berechnung += (
                            f" · Kühlstrom {kuehl_kosten:.2f} € nicht im Vergleich"
                        )
                    # B5/X-2: der Vorbehalt aus dem Layer — dieselben Worte
                    # wie Hub (B3) und Cockpit (B4). Nur gesetzt, wenn es
                    # einen gibt; MQTT trägt ihn als Attribut, REST als
                    # `hinweis`.
                    _vorbehalt = ersparnis_vorbehalt(
                        waerme_abgeleitet=waerme_abgeleitet,
                        abgrenzung=abgrenzung_stoerung(investition),
                    )
                    if _vorbehalt:
                        zusatz_attribute = {"vorbehalt": _vorbehalt}
            elif sensor.key == "wp_strom_heizen_modus_kwh":  # noqa: E501
                # Ohne erfassten Modus bleibt der Sensor leer — er behauptete
                # sonst „0 kWh geheizt" für ein Gerät, das eedc nicht beobachtet
                # hat. In HA-Langzeitstatistik lebt so eine 0 weiter.
                if gesamt_modus_abdeckung_h > 0 or gesamt_modus_gemessen:
                    value = gesamt_modus_heizen
                    berechnung = f"{gesamt_modus_heizen:.1f} von {gesamt_strom:.1f} kWh gesamt"
            elif sensor.key == "wp_strom_kuehlen_modus_kwh":
                if gesamt_modus_abdeckung_h > 0 or gesamt_modus_gemessen:
                    value = gesamt_modus_kuehlen
                    berechnung = f"{gesamt_modus_kuehlen:.1f} von {gesamt_strom:.1f} kWh gesamt"
            elif sensor.key == "wp_strom_warmwasser_modus_kwh":
                # N-336 — dieselbe Leer-Regel wie bei den zwei Nachbarn: ohne
                # erfassten Modus fehlt der Sensor, statt 0 zu behaupten.
                if gesamt_modus_abdeckung_h > 0 or gesamt_modus_gemessen:
                    value = gesamt_modus_warmwasser
                    berechnung = (
                        f"{gesamt_modus_warmwasser:.1f} von {gesamt_strom:.1f} kWh gesamt"
                    )
            elif sensor.key == "wp_betriebsmodus":
                # #398: der EINZIGE Sensor dieser Liste, der KEINE Monatsgröße
                # ist, sondern ein Zustand. Er kommt deshalb auch nicht aus den
                # Monatsdaten, sondern aus `betriebsmodus_live` — und fehlt
                # ganz, wenn es keine Zuordnung gibt (kein „—", keine leere
                # Entität, die in HA für immer weiterlebt).
                _modus = (modus_map or {}).get(investition.id)
                if _modus:
                    value = BETRIEBSMODUS_LABEL[_modus]
                    berechnung = f"Kanon-Wert „{_modus}\" der zugeordneten climate-Quelle"
            elif sensor.key == "wp_kompressor_starts":
                if hat_starts:
                    value = wp_starts_total
                    berechnung = "Σ erfasste Kompressor-Starts"
            elif sensor.key == "wp_betriebsstunden":
                if hat_stunden:
                    value = wp_stunden_total
                    berechnung = "Σ erfasste Betriebsstunden"

            if value is not None or zusatz_attribute.get("grund"):
                sensor_values.append(SensorValue(
                    definition=sensor,
                    value=value,
                    berechnung=berechnung,
                    zusatz_attribute=zusatz_attribute,
                ))

    return sensor_values
