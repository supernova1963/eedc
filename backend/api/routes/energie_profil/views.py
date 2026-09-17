"""
Energie-Profil API — Read-Endpoints.

GET /api/energie-profil/{anlage_id}/tage      — Tageszusammenfassungen
GET /api/energie-profil/{anlage_id}/stunden   — Stundenwerte für einen Tag
GET /api/energie-profil/{anlage_id}/wochenmuster — Ø-Tagesprofil je Wochentag
GET /api/energie-profil/{anlage_id}/monat     — Monatsauswertung (Heatmap + KPIs + Peaks)
GET /api/energie-profil/{anlage_id}/debug-rohdaten — Rohdaten TagesEnergieProfil (7 Tage)
GET /api/energie-profil/{anlage_id}/verfuegbare-monate — Jahr/Monat-Kombis mit Daten
GET /api/energie-profil/{anlage_id}/stats     — Datenbestand für Settings
GET /api/energie-profil/{anlage_id}/reaggregate-tag/preview — Diff-Vorschau Reaggregate
GET /api/energie-profil/{anlage_id}/kraftstoffpreis-status — Anzahl offener Zeilen
GET /api/energie-profil/{anlage_id}/tagesprognose — Kombinierte Tagesprognose
"""

import asyncio
import calendar
import re
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.berechnungen import (
    WAERMEPUMPE_KOMPONENTEN_PREFIXE,
    WALLBOX_KOMPONENTEN_PREFIXE,
    geraete_spalte_kw,
)
from backend.core.berechnungen.kennzahlen import (
    autarkie_prozent,
    eigenverbrauchsquote_prozent,
)
from backend.core.berechnungen.speicher_simulation import simuliere_speicher_tag
from backend.core.exceptions import bad_request, not_found
from backend.core.investition_kennwerte import aggregiere_speicher_basis
from backend.api.deps import get_db
from backend.models.anlage import Anlage
from backend.models.investition import Investition, InvestitionTyp
from backend.models.monatsdaten import Monatsdaten
from backend.models.tages_energie_profil import TagesEnergieProfil, TagesZusammenfassung
from backend.services.monats_fakten import lade_monats_fakten
from backend.services.einspeise_erloes_service import neg_preis_einspeisung_tageswert

from ._shared import (
    HeatmapZelle,
    KategorieSumme,
    KomponentenEintrag,
    MonatsAuswertungResponse,
    PeakStunde,
    ReaggregatePreviewBoundary,
    ReaggregatePreviewCounterTagesdelta,
    ReaggregatePreviewResponse,
    ReaggregatePreviewSlot,
    SerieInfo,
    StundenAntwort,
    StundenPrognose,
    StundenWertResponse,
    TagesPrognoseResponse,
    TagDetailResponse,
    TagStatusResponse,
    TagesZusammenfassungResponse,
    TagWerteResponse,
    VerteilungPeriodeResponse,
    VerteilungSegmentResponse,
    VerteilungVerlaufResponse,
    WaermeVerlaufStundeResponse,
    WaermeVerlaufStundenResponse,
    WaermeVerlaufTagResponse,
    TagesprofilStunde,
    WochenmusterPunkt,
    _key_to_serie_info,
    detail_kategorie,
    logger,
)

router = APIRouter()


#: Energie-Kategorien der Monatsauswertung: Schlüssel → (Label, Gruppe).
#:
#: **Spiegel von** ``frontend/src/lib/colors.ts::ENERGIE_KATEGORIE`` — dessen
#: Docstring nennt diese Datei seit jeher als „Backend-Producer", die Schlüssel
#: lagen hier aber als **funktionslokale Literale** in
#: :func:`get_monatsauswertung`, und **Labels gab es backendseitig gar nicht**.
#: Der Monatsbericht braucht sie (PDF/Markdown haben kein `lib/colors.ts`), und
#: eine dritte Liste im Builder wäre die Drift, die ``check:label-maps`` im
#: Frontend gerade verhindert. ⇒ Schlüssel und Label stehen hier zusammen,
#: die lokalen Sets leiten sich daraus ab.
#:
#: Der dritte Eintrag ist die **Farbe als Hex** — der Client führt an dieser
#: Stelle Tailwind-Klassen (``bg-amber-400``), ein PDF braucht den Ton selbst.
#: ⛔ **Keine neuen Töne:** jeder Wert stammt aus der Komponenten-Identität in
#: ``lib/colors.ts`` (``KOMPONENTEN_FARBEN`` bzw. ``SONSTIGES_ERZEUGER_FARBE``),
#: auf die die Client-Map verweist. Beim ersten Bau standen hier drei
#: **erfundene** Farben (Cyan fürs Balkonkraftwerk, Grau für sonstige Erzeuger,
#: Blau für die Wallbox) — Regel 0a („eine Datenrolle = eine Farbe") war damit
#: zwischen Bildschirm und PDF gebrochen, ohne dass ein Prüfer es sah.
#:
#: Der Abgleich mit der Client-Map hält ``npm run check:spiegel-backend`` fest —
#: **einschließlich der Farbe**, aufgelöst über die Konstante, auf die die
#: Client-Map zeigt.
ENERGIE_KATEGORIEN: dict[str, tuple[str, str, str]] = {
    "pv_module": ("PV-Module", "erzeuger", "#f59e0b"),
    "bkw": ("Balkonkraftwerk", "erzeuger", "#fbbf24"),
    "sonstige_erzeuger": ("Sonstige Erzeuger", "erzeuger", "#84cc16"),
    "waermepumpe": ("Wärmepumpe", "verbraucher", "#ef4444"),
    "wallbox_eauto": ("Wallbox / E-Auto", "verbraucher", "#06b6d4"),
    "haushalt": ("Haushalt", "verbraucher", "#64748b"),
    "sonstige_verbraucher": ("Sonstige Verbraucher", "verbraucher", "#6b7280"),
    # §9.2 (05.09.2026) — Abgabe an Dritte: Verwendungsseite, aber kein
    # Eigenverbrauch; dieselbe Farbe wie das Sonstiges-Gerät (Regel 0a).
    "sonstige_abgabe": ("Abgabe an Dritte", "verbraucher", "#6b7280"),
}


@router.get("/{anlage_id}/tage", response_model=list[TagesZusammenfassungResponse])
async def get_tages_zusammenfassungen(
    anlage_id: int,
    von: date = Query(..., description="Startdatum (inklusiv)"),
    bis: date = Query(..., description="Enddatum (inklusiv)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Gibt Tageszusammenfassungen für einen Zeitraum zurück.

    Enthält Per-Komponenten-kWh (z.B. pv_3, waermepumpe_5, wallbox_7)
    sowie Gesamtkennzahlen (Überschuss, Defizit, Peaks, Performance Ratio).
    """
    # Anlage prüfen
    result = await db.execute(
        select(Anlage).where(Anlage.id == anlage_id)
    )
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    # Maximal 366 Tage (ein Jahr)
    if (bis - von).days > 366:
        raise bad_request("Zeitraum darf maximal 366 Tage umfassen")

    # Tageszusammenfassungen laden
    result = await db.execute(
        select(TagesZusammenfassung)
        .where(and_(
            TagesZusammenfassung.anlage_id == anlage_id,
            TagesZusammenfassung.datum >= von,
            TagesZusammenfassung.datum <= bis,
        ))
        .order_by(TagesZusammenfassung.datum)
    )
    tage = result.scalars().all()

    return [
        TagesZusammenfassungResponse(
            datum=t.datum,
            ueberschuss_kwh=t.ueberschuss_kwh,
            defizit_kwh=t.defizit_kwh,
            peak_pv_kw=t.peak_pv_kw,
            peak_netzbezug_kw=t.peak_netzbezug_kw,
            peak_einspeisung_kw=t.peak_einspeisung_kw,
            batterie_vollzyklen=t.batterie_vollzyklen,
            temperatur_min_c=t.temperatur_min_c,
            temperatur_max_c=t.temperatur_max_c,
            strahlung_summe_wh_m2=t.strahlung_summe_wh_m2,
            gti_summe_wh_m2=t.gti_summe_wh_m2,
            performance_ratio=t.performance_ratio,
            stunden_verfuegbar=t.stunden_verfuegbar,
            datenquelle=t.datenquelle,
            komponenten_kwh=t.komponenten_kwh,
            komponenten_starts=t.komponenten_starts,
            boersenpreis_avg_cent=t.boersenpreis_avg_cent,
            boersenpreis_min_cent=t.boersenpreis_min_cent,
            negative_preis_stunden=t.negative_preis_stunden,
            # §51-Menge nur bei Anlagen mit gesetztem Schalter; die Stundenzahl
            # daneben bleibt ungegatet — sie ist reine Marktinfo, kein Abzug.
            einspeisung_neg_preis_kwh=neg_preis_einspeisung_tageswert(
                anlage, t.einspeisung_neg_preis_kwh
            ),
        )
        for t in tage
    ]


@router.get("/{anlage_id}/tage-werte", response_model=list[TagWerteResponse])
async def get_tage_werte(
    anlage_id: int,
    von: date = Query(..., description="Startdatum (inklusiv)"),
    bis: date = Query(..., description="Enddatum (inklusiv)"),
    db: AsyncSession = Depends(get_db),
):
    """Tages-Werte-Zeilen (Energie-Bilanz + Finanzen + tag-native Metriken)
    für die Werte/Tabelle-Embed-Sicht in Tagesgranularität (IA v4 E3).

    Eine Zeile pro Tag, additiv zur Monatsbilanz (Σ stündl. TEP-Rows über den
    SoT-Helper `bilanz_aus_stundenrows`). Finanzen über den `baue_finanz_zeile`-
    SoT (je-Monat-Tarif).
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    if (bis - von).days > 366:
        raise bad_request("Zeitraum darf maximal 366 Tage umfassen")

    # Lazy-Import: Service importiert das Routes-Schema (`_shared`) → Top-Level-
    # Import hier ergäbe einen Zyklus (routes-Package ↔ Service).
    from backend.services.energie_profil.tage_werte import baue_tage_werte

    return await baue_tage_werte(db, anlage, von, bis)


def _grund_gewinner(
    grund_je_feld: dict[str, str], keys: tuple[str, ...],
) -> Optional[tuple[str, str]]:
    """``(ausgabe_key, grund)`` des aussagekräftigsten Grundes — oder ``None``.

    Die gemeinsame Hälfte der beiden Formulierer darunter. Sie ein zweites Mal
    hinzuschreiben wäre die F-56-Klasse: zwei Stellen, dieselbe Rangfolge, und
    die Kurzform würde beim nächsten Zustand einen anderen Gewinner nennen als
    die Langform.
    """
    from backend.core.tageswert_grund import GRUND_RANG

    treffer = [(k, grund_je_feld[k]) for k in keys if k in grund_je_feld]
    if not treffer:
        return None
    return max(treffer, key=lambda kg: GRUND_RANG.get(kg[1], -1))


def _tageswert_grund_kurz_kombiniert(
    grund_je_feld: dict[str, str], keys: tuple[str, ...],
) -> Optional[str]:
    """Die **Kurzform** für eine Größe aus mehreren Feldern — für Sperr-Gründe."""
    from backend.core.tageswert_grund import tageswert_grund_kurz

    gewinner = _grund_gewinner(grund_je_feld, keys)
    return tageswert_grund_kurz(gewinner[1]) if gewinner else None


def _tageswert_grund_kombiniert(
    grund_je_feld: dict[str, str], keys: tuple[str, ...],
) -> Optional[str]:
    """Der Grund für eine Größe, die aus **mehreren** Feldern entsteht (W-18).

    Die Tages-Wärme ist ``Heizwärme + Warmwasser``. Fehlen beide, gibt es zwei
    Gründe — und es wäre irreführend, den erstbesten zu nennen: Wer den
    Wärmemengenzähler für die Heizung zugeordnet hat und den fürs Warmwasser
    nicht, soll nicht lesen „kein Zähler zugeordnet". Deshalb gewinnt der
    aussagekräftigere (``GRUND_RANG``) — dieselbe Rangfolge wie in der Erhebung.

    Fehlt für **keines** der Felder ein Grund, gibt es nichts zu sagen.
    """
    from backend.core.tageswert_grund import tageswert_grund_text

    gewinner = _grund_gewinner(grund_je_feld, keys)
    if gewinner is None:
        return None
    key, grund = gewinner
    return tageswert_grund_text(grund, key)


@router.get(
    "/{anlage_id}/waerme-verlauf",
    response_model=list[WaermeVerlaufTagResponse],
)
async def get_waerme_verlauf(
    anlage_id: int,
    von: date = Query(..., description="Startdatum (inklusiv)"),
    bis: date = Query(..., description="Enddatum (inklusiv)"),
    db: AsyncSession = Depends(get_db),
):
    """Die Tagesreihe des Wärme/Klima-Verlaufs für *Cockpit → Monat*.

    **Warum eine eigene Route neben ``/tage-werte``** (Konzept §8, Bauschnitt 4):
    Jene Route beliefert fünf Konsumenten — die Monats- und die Tagessicht, die
    Auswertungen-Tabelle mit bis zu 366 Tagen und den Monatsbericht — und ihr
    Schema ist an die Frontend-Registry gekoppelt. Ihr ``wp_strom`` ist die Σ
    der Stundenspalte ``waermepumpe_kw`` — ⚠ hier stand bis 11.09.2026
    „Leistungspfad", richtig ist: **Zählerpfad im Rückwärts-Raster**; der
    Unterschied zu ``komponenten_kwh`` ist das Fenster (N-434). Der Verlauf
    nimmt ``komponenten_kwh``, weil die Aufteilung darunter damit rechnet.
    Zwei Zahlen für dieselbe Größe in **einem** Bild wären genau W-17b, den
    dietmar1968 gemeldet hat.

    ⚠ **Der Zeitraum ist auf einen Monat begrenzt.** Die Wärme entsteht aus
    Zähler-Randständen; über ein Jahr wären das Reihen, die niemand für eine
    Linie braucht — die Jahressicht hat ihre eigene Quelle (Monatszeilen).
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    if (bis - von).days > 31:
        raise bad_request("Zeitraum darf maximal 31 Tage umfassen")

    from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

    inv_result = await db.execute(
        select(Investition).where(Investition.anlage_id == anlage_id)
    )
    investitionen_by_id = {str(inv.id): inv for inv in inv_result.scalars().all()}
    zeilen = await lade_waerme_verlauf(
        db, anlage, investitionen_by_id, von, bis,
    )
    return [
        WaermeVerlaufTagResponse(
            datum=z.datum,
            wp_strom_kwh=z.strom_kwh,
            wp_waerme_kwh=z.waerme_kwh,
            wp_kaelte_kwh=z.kaelte_kwh,
            temperatur_c=(
                round(z.temperatur_c, 1) if z.temperatur_c is not None else None
            ),
            # ⚠ **Alles-oder-nichts je Tag** — dieselbe Bauform wie in der
            # Tagesantwort: Wo es keine Aufteilung gibt, stehen `None` statt
            # sechs Nullen. Eine Null sähe aus wie „nichts gelaufen", während
            # die Kachel Strom zeigt.
            wp_modus_strom_heizen_kwh=(
                round(z.stapel.heizen_kwh, 2) if z.stapel.hat_split else None
            ),
            wp_modus_strom_warmwasser_kwh=(
                round(z.stapel.warmwasser_kwh, 2) if z.stapel.hat_split else None
            ),
            wp_modus_strom_kuehlen_kwh=(
                round(z.stapel.kuehlen_kwh, 2) if z.stapel.hat_split else None
            ),
            wp_modus_strom_lueften_kwh=(
                round(z.stapel.lueften_kwh, 2) if z.stapel.hat_split else None
            ),
            wp_modus_strom_entfeuchten_kwh=(
                round(z.stapel.entfeuchten_kwh, 2) if z.stapel.hat_split else None
            ),
            wp_modus_nicht_aufgeteilt_kwh=(
                round(z.stapel.nicht_aufgeteilt_kwh, 2) if z.stapel.hat_split else None
            ),
            wp_modus_strom_bezug_kwh=(
                round(z.stapel.bezug_kwh, 2) if z.stapel.hat_split else None
            ),
            wp_modus_abdeckung_h=(
                round(z.stapel.abdeckung_h, 1) if z.stapel.hat_split else None
            ),
            wp_modus_gemessen=z.stapel.hat_gemessen if z.stapel.hat_split else None,
        )
        for z in zeilen
    ]


@router.get(
    "/{anlage_id}/waerme-verlauf-stunden",
    response_model=WaermeVerlaufStundenResponse,
)
async def get_waerme_verlauf_stunden(
    anlage_id: int,
    datum: date = Query(..., description="Tag (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Der Wärme/Klima-Verlauf von *Cockpit → Tag* — 24 Stunden (Bauschnitt 5).

    **Warum eine eigene Route und nicht ``tag-detail``** (Entscheid Gernot
    11.09.2026): ``tag-detail`` wird im Client mit ``.catch(() => null)``
    geladen — ein Fehler im Stundenteil nähme den ganzen Wärmepumpen-Block des
    Tages mit. Und die Stundenform kostet beim ersten Aufruf je Zähler 25
    Stände; die Kacheln sollen darauf nicht warten. Präzedenz: der Monat.

    ⭐ **Die Stunde verteilt den Tag** (``core/berechnungen/tages_stapel.py``):
    dieselbe Geräte-Auswahl wie ``tag-detail`` (``beitraege_des_tages``), dieselbe
    Tageszeile, dasselbe Fenster (N-434/N-435) — die Summe der 24 Stunden ist
    der Balken darunter. Temperatur liefert die Stundenantwort, nicht diese.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    from backend.core.berechnungen import waermepumpe_kwh_je_investition
    from backend.core.berechnungen.tages_stapel import (
        STUNDEN,
        StundenFormen,
        beitraege_des_tages,
        verteile_felder_auf_stunden,
        verteile_tages_stapel_auf_stunden,
    )
    from backend.core.berechnungen.waermepumpe_kennzahl import (
        geraete_mit_gesamtwaerme,
    )
    from backend.services.energie_profil import (
        lade_modus_split_tag,
        lade_modus_stunden_tag,
    )
    from backend.services.snapshot.aggregator import (
        TAGESDETAIL_AUSGABE,
        WAERME_AUSGABE_KEYS,
        get_betriebsart_strom_tageswerte,
        get_tagesdetail_kwh,
        get_wp_strom_stufe_je_investition,
    )
    from backend.services.snapshot.boundary_range import tageszeile_ist_rueckwaerts
    from backend.services.snapshot.keys import extract_quellen_energy, feld_hat_zaehler
    from backend.services.snapshot.komponenten_beitraege import investition_beitraege
    from backend.services.snapshot.reader import mqtt_zaehler_keys
    from backend.services.snapshot.stunden_leser import lade_stundenformen

    inv_result = await db.execute(select(Investition).where(Investition.anlage_id == anlage_id))
    investitionen_by_id = {str(inv.id): inv for inv in inv_result.scalars().all()}

    # ── Der Tag: dieselben Eingänge wie `tag-detail` ─────────────────────────
    tz_zeile = (await db.execute(
        select(
            TagesZusammenfassung.komponenten_kwh,
            TagesZusammenfassung.source_provenance,
        ).where(
            TagesZusammenfassung.anlage_id == anlage_id,
            TagesZusammenfassung.datum == datum,
        )
    )).one_or_none()
    tz_rueckwaerts = tageszeile_ist_rueckwaerts(tz_zeile[1] if tz_zeile else None)
    wp_kwh_je_inv = waermepumpe_kwh_je_investition((tz_zeile[0] if tz_zeile else None) or {})
    gemessen_je_inv = await get_betriebsart_strom_tageswerte(
        db, anlage, investitionen_by_id, datum, rueckwaerts=tz_rueckwaerts,
    )
    beitraege = beitraege_des_tages(
        gemessen_je_inv, wp_kwh_je_inv,
        await lade_modus_split_tag(db, anlage_id, datum),
        investitionen_by_id, datum,
        # N-462: dieselbe Stufe wie im Tag-Detail — sonst nennt derselbe Tag
        # zwei verschiedene Abzüge.
        stufe_je_inv=await get_wp_strom_stufe_je_investition(
            db, anlage, investitionen_by_id,
        ),
    )
    detail = await get_tagesdetail_kwh(
        db, anlage, investitionen_by_id, datum,
        tageszeile_rueckwaerts=tz_rueckwaerts,
    )

    # ── Die Form: je Zähler die 24 Slots aus derselben Standreihe ───────────
    mapping = (anlage.sensor_mapping or {}).get("investitionen", {}) or {}
    quellen_energy = extract_quellen_energy(anlage)
    mqtt_keys = await mqtt_zaehler_keys(db, anlage.id)

    def _zaehler(inv_id: str, feld: str):
        cfg = ((mapping.get(inv_id) or {}).get("felder") or {}).get(feld)
        key = f"inv:{inv_id}:{feld}"
        if not feld_hat_zaehler(cfg, key, quellen_energy, mqtt_keys):
            return None
        return key, (cfg.get("sensor_id") if isinstance(cfg, dict) else None)

    zaehler: dict[str, tuple[str, object]] = {}
    gesamt_felder: dict[str, list[str]] = {}
    for b in beitraege:
        if not b.gemessen:
            continue
        for feld in b.felder:
            z = _zaehler(b.inv_id, feld)
            if z:
                zaehler[z[0]] = z
        inv = investitionen_by_id.get(b.inv_id)
        felder_cfg = (mapping.get(b.inv_id) or {}).get("felder") or {}
        gesamt_felder[b.inv_id] = [
            beitrag.feld for beitrag in investition_beitraege(
                inv, mapping.get(b.inv_id) or {},
                ist_verfuegbar=lambda f, _c=felder_cfg, _i=b.inv_id: feld_hat_zaehler(
                    _c.get(f), f"inv:{_i}:{f}", quellen_energy, mqtt_keys,
                ),
            )
        ]
        for feld in gesamt_felder[b.inv_id]:
            z = _zaehler(b.inv_id, feld)
            if z:
                zaehler[z[0]] = z
    # ── Linien (Wärme, Kälte): nur die Felder, die den TAGESWERT trugen ──
    # N-437: Bis 11.09.2026 las diese Schleife die Form JEDES zugeordneten
    # Wärmezählers — auch eines Geräts, dessen Tageswert wegen Rücksprung oder
    # Tagesreset verworfen war —, und nur das exakte Gerätefeld (Kälte je
    # Innengerät bekam keine Form). `felder_je_inv` ist genau die Schlüsselmenge,
    # mit der der Tag aufgelöst hat.
    # ⭐ Seit WK-09 B2 stehen hier auch die **Funktions**-Zähler
    # (`strom_heizen_kwh`/`strom_warmwasser_kwh`, SOLL §3.3/S2a). Sie brauchen
    # dieselbe Stundenform aus derselben Standreihe wie die Linien — eine
    # zweite Leseschleife wäre die F-56-Klasse.
    verteilte_felder = {
        ausgabe: detail.felder_je_inv.get(ausgabe, {})
        for ausgabe in (
            *sorted(WAERME_AUSGABE_KEYS), "wp_waerme_kwh", "wp_kaelte_kwh",
            "wp_strom_heizen_kwh", "wp_strom_warmwasser_kwh",
        )
    }
    for je_inv in verteilte_felder.values():
        for inv_id, felder in je_inv.items():
            for feld in felder:
                z = _zaehler(inv_id, feld)
                if z:
                    zaehler[z[0]] = z
    formen_je_key = await lade_stundenformen(db, anlage, datum, list(zaehler.values()))

    def _summe_je_slot(keys: list[str]) -> list:
        reihen = [formen_je_key[k] for k in keys if k in formen_je_key]
        if not reihen:
            return [None] * STUNDEN
        return [
            (sum(r[h] for r in reihen if r[h] is not None)
             if any(r[h] is not None for r in reihen) else None)
            for h in range(STUNDEN)
        ]

    modus_stunden, _ = await lade_modus_stunden_tag(db, anlage_id, datum)
    formen = StundenFormen(
        felder_je_inv={
            b.inv_id: {
                feld: formen_je_key.get(f"inv:{b.inv_id}:{feld}", [None] * STUNDEN)
                for feld in b.felder
            }
            for b in beitraege if b.gemessen
        },
        gesamt_je_inv={
            inv_id: _summe_je_slot([f"inv:{inv_id}:{f}" for f in felder])
            for inv_id, felder in gesamt_felder.items()
        },
        modus_stunden_je_inv=modus_stunden,
    )
    verteilung = verteile_tages_stapel_auf_stunden(beitraege, formen)

    # ── Linien: je Gerät, je Feld verteilt, je Stunde aufgelöst (N-437) ────
    # Die Bauform des Stapels (`verteile_felder_auf_stunden`). Was keine Form
    # hat, wird NICHT still fallen gelassen, sondern je Größe genannt
    # (`*_ohne_stundenform_kwh`, Entscheid E6 (a), BS5 W1).
    # ⛔ Hier stand bis 11.09.2026: „Fehlt einem Schlüssel die Form, bekommt er
    # KEINE Linie" — die ganze Wärme eines Keys verschwand, und die Linie war
    # kleiner als die Kachel, ohne Hinweis (gemessen: Tag 7,0, Linie 2,0).
    # S4 bleibt gewahrt: Ohne jede verteilte Menge entsteht keine Linie aus
    # Nullen — dann steht nur der genannte Rest da.
    basis_je_ausgabe = {
        ausgabe: feld for (t, feld), ausgabe in TAGESDETAIL_AUSGABE.items()
        if t == "waermepumpe"
    }

    def _linie(ausgaben, *, nur_geraete=None) -> tuple[list, float]:
        """Eine Linie über die genannten Ausgabe-Keys.

        ``nur_geraete`` schränkt **je Ausgabe-Key** auf eine Geräte-Menge ein
        (fehlt der Key darin, zählen alle Geräte). Die Wärme braucht das, weil
        D1 je Gerät entscheidet, WELCHE Zähler es zeichnen — s. u.
        """
        summe = [0.0] * STUNDEN
        ohne_linie = 0.0
        for ausgabe in ausgaben:
            je_inv = verteilte_felder.get(ausgabe) or {}
            _erlaubt = (nur_geraete or {}).get(ausgabe)
            if _erlaubt is not None:
                je_inv = {i: f for i, f in je_inv.items() if i in _erlaubt}
            werte, rest = verteile_felder_auf_stunden(
                je_inv,
                {
                    inv_id: {
                        f: formen_je_key.get(f"inv:{inv_id}:{f}", [None] * STUNDEN)
                        for f in felder
                    }
                    for inv_id, felder in je_inv.items()
                },
                basis_je_ausgabe[ausgabe],
            )
            summe = [summe[h] + werte[h] for h in range(STUNDEN)]
            ohne_linie += rest
        return (summe if sum(summe) > 1e-9 else [None] * STUNDEN), ohne_linie

    # N-391/D1 — **Gesamtwert vor Summanden, auch in der Linie.** Der gemeinsame
    # Wärmemengenzähler steht bewusst NICHT in `WAERME_AUSGABE_KEYS`: die Menge
    # dort wird **summiert**, und ein Gerät mit Gesamtzähler UND Aufteilung
    # zeichnete seine Wärme dann zweimal. Gemessen wird deshalb dieselbe
    # Vorrangfrage wie im Monat — trug der Gesamtzähler den Tageswert, ist er
    # die Linie; sonst sind es die beiden Achsen.
    #
    # ⛔ **N-391b: die Frage wird je GERÄT gestellt, nicht für die Anlage.** Hier
    # stand bis zum 14.09.2026 ein Alles-oder-nichts: *trägt IRGENDEIN Gerät
    # `wp_waerme_kwh`, zeichne für ALLE nur den Gesamtschlüssel.* Bei zwei
    # verschieden zählenden Wärmepumpen fiel damit die ganze Wärme der zweiten
    # aus der Linie — sie stand weder im Balken noch im genannten Rest, weil das
    # Feld gar nicht erst gelesen wurde. Jetzt bekommt jedes Gerät den Zähler,
    # den D1 für es wählt: die Summe je Slot ist Σ je Gerät nach D1.
    _gesamt_geraete = geraete_mit_gesamtwaerme(
        detail.werte_je_inv.get("wp_waerme_kwh"),
    )
    _achsen_geraete = frozenset(
        inv_id
        for key in WAERME_AUSGABE_KEYS
        for inv_id in (verteilte_felder.get(key) or {})
    ) - _gesamt_geraete
    waerme_je_slot, waerme_ohne = _linie(
        (*sorted(WAERME_AUSGABE_KEYS), "wp_waerme_kwh"),
        nur_geraete={
            **{key: _achsen_geraete for key in WAERME_AUSGABE_KEYS},
            "wp_waerme_kwh": _gesamt_geraete,
        },
    )
    kaelte_je_slot, kaelte_ohne = _linie(("wp_kaelte_kwh",))

    # ── Der Funktions-Stapel (WK-09 B2, SOLL §3.3/S2a) ─────────────────────
    #
    # **Dieselbe Verteilung wie die Linien**, nur eine andere Familie: Heizen und
    # Warmwasser sind **Summanden** des Gesamtstroms, während der Betriebsart-
    # Stapel darüber **Teilmengen** führt (SOLL §3.2). Beide gleichzeitig zu
    # stapeln hieße, Teilmengen zu Summanden zu addieren — deshalb schaltet der
    # Verlauf um, statt zu überlagern (S2a), und deshalb tragen die Felder
    # eigene Namen.
    #
    # ⚠ `_linie` gibt `[None] * 24` zurück, wenn nichts verteilt wurde. Für einen
    # **Stapel** ist das kein brauchbarer Eingang (eine Stunde ohne Warmwasser
    # ist eine echte 0, keine fehlende Aussage) — die Segmente werden deshalb
    # unten gegen `funktions_stapel_verfuegbar` aufgelöst, wie der
    # Betriebsart-Stapel gegen `hat_split`.
    funk_heizen, funk_heizen_ohne = _linie(("wp_strom_heizen_kwh",))
    funk_ww, funk_ww_ohne = _linie(("wp_strom_warmwasser_kwh",))
    # „Nach Funktion" gibt es nur, wo Funktions-Zähler gepflegt sind — sonst hat
    # die Sicht nichts zu sagen (S2a). Maßgeblich ist der TAGESWERT, nicht die
    # Stundenform: ein Zähler ohne Form wird unten genannt, nicht verschwiegen.
    funktions_stapel_verfuegbar = any(
        (detail.werte.get(k) or 0.0) > 0.0
        for k in ("wp_strom_heizen_kwh", "wp_strom_warmwasser_kwh")
    )
    funktion_ohne = funk_heizen_ohne + funk_ww_ohne

    # Die Zählerspalte des Slots — ihre Summe ist die Kachel „Strom verbraucht".
    wp_kw = {
        r.stunde: r.waermepumpe_kw
        for r in (await db.execute(
            select(TagesEnergieProfil.stunde, TagesEnergieProfil.waermepumpe_kw).where(
                TagesEnergieProfil.anlage_id == anlage_id,
                TagesEnergieProfil.datum == datum,
            )
        )).all()
    }

    def _r(v: float, hat: bool, stellen: int = 3):
        return round(v, stellen) if hat else None

    def _funktions_segmente(h: int) -> dict:
        """Die drei Segmente der Funktions-Sicht eines Slots.

        ⭐ **Die Stapelhöhe ist der Gesamtstrom** (SOLL §3.3/S2a, K1): `uebrige`
        füllt auf, was die Funktions-Zähler nicht erklären — Standby, ein
        zweites Gerät ohne solche Zähler. Bezug ist **`wp_strom_kwh` dieses
        Slots**, also genau die Größe, deren Summe die Kachel „Strom
        verbraucht" ist; hier entsteht kein zweiter Gesamtstrom.

        ⚠ **`bezug_kwh` des Betriebsart-Stapels wäre hier falsch:** die Größe
        zählt nur Geräte, die eine **Betriebsart**-Aufteilung beigesteuert
        haben. Ein Gerät mit Funktions-Zählern, aber ohne Betriebsart-Zähler und
        ohne Modus-Signal (Sprosse **F5**) trägt dort 0 bei — der Rest wäre
        negativ, und genau diese Lage ist der Anlass von B2.
        """
        if not funktions_stapel_verfuegbar:
            return {}
        heizen = funk_heizen[h] or 0.0
        warmwasser = funk_ww[h] or 0.0
        gesamt = wp_kw.get(h)
        return {
            "wp_funktion_strom_heizen_kwh": round(heizen, 3),
            "wp_funktion_strom_warmwasser_kwh": round(warmwasser, 3),
            # Ohne Gesamtstrom in diesem Slot gibt es keinen Rest zu benennen —
            # `None` heißt „keine Aussage", nicht 0 (ADR-002/P4).
            "wp_funktion_uebrige_kwh": (
                round(max(0.0, gesamt - heizen - warmwasser), 3)
                if gesamt is not None else None
            ),
        }

    zeilen = []
    for h, s in enumerate(verteilung.stunden):
        hat = s.hat_split
        zeilen.append(WaermeVerlaufStundeResponse(
            stunde=h,
            wp_strom_kwh=(round(wp_kw[h], 3) if wp_kw.get(h) is not None else None),
            wp_waerme_kwh=(
                round(waerme_je_slot[h], 3) if waerme_je_slot[h] is not None else None
            ),
            wp_kaelte_kwh=(
                round(kaelte_je_slot[h], 3) if kaelte_je_slot[h] is not None else None
            ),
            wp_modus_strom_heizen_kwh=_r(s.heizen_kwh, hat),
            wp_modus_strom_warmwasser_kwh=_r(s.warmwasser_kwh, hat),
            wp_modus_strom_kuehlen_kwh=_r(s.kuehlen_kwh, hat),
            wp_modus_strom_lueften_kwh=_r(s.lueften_kwh, hat),
            wp_modus_strom_entfeuchten_kwh=_r(s.entfeuchten_kwh, hat),
            wp_modus_nicht_aufgeteilt_kwh=_r(s.nicht_aufgeteilt_kwh, hat),
            wp_modus_strom_bezug_kwh=_r(s.bezug_kwh, hat),
            wp_modus_abdeckung_h=_r(s.abdeckung_h, hat, 1),
            wp_modus_gemessen=s.hat_gemessen if hat else None,
            **_funktions_segmente(h),
        ))
    ohne = verteilung.ohne_stundenform_kwh
    return WaermeVerlaufStundenResponse(
        stunden=zeilen,
        ohne_stundenform_kwh=round(ohne, 2) if ohne > 0.005 else None,
        waerme_ohne_stundenform_kwh=round(waerme_ohne, 2) if waerme_ohne > 0.005 else None,
        kaelte_ohne_stundenform_kwh=round(kaelte_ohne, 2) if kaelte_ohne > 0.005 else None,
        funktions_stapel_verfuegbar=funktions_stapel_verfuegbar,
        funktion_ohne_stundenform_kwh=(
            round(funktion_ohne, 2) if funktion_ohne > 0.005 else None
        ),
    )


@router.get(
    "/{anlage_id}/waerme-verteilung",
    response_model=VerteilungVerlaufResponse,
)
async def get_waerme_verteilung(
    anlage_id: int,
    sicht: str = Query(
        ..., description="tag | monat | jahr — die Cockpit-Sicht",
    ),
    jahr: Optional[int] = Query(None, description="Jahr (Sicht monat/jahr)"),
    monat: Optional[int] = Query(None, description="Monat 1–12 (Sicht monat)"),
    datum: Optional[date] = Query(None, description="Tag (Sicht tag)"),
    db: AsyncSession = Depends(get_db),
):
    """Verteilung des Wärme/Klima-Stroms und ihr Verlauf (WK-16c).

    **Eine Route für alle drei Cockpit-Sichten** — die Auflösung der Perioden
    folgt aus ``sicht`` (Jahr → Monate, Monat → Tage, Tag → Stunden). Drei
    Routen wären dreimal dieselbe Regel; die Rechnung selbst steht ohnehin an
    **einer** Stelle (``services/waerme_verteilung.py``).

    ⚠ **Sie lädt NEBEN der Sicht**, wie der Wärme/Klima-Verlauf daneben: Bleibt
    sie aus, fehlt genau dieser Blockteil und sonst nichts.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    if sicht not in ("tag", "monat", "jahr"):
        raise bad_request("sicht muss tag, monat oder jahr sein")
    if sicht in ("monat", "jahr") and jahr is None:
        raise bad_request("jahr ist für diese Sicht erforderlich")
    if sicht == "monat" and not (monat and 1 <= monat <= 12):
        raise bad_request("monat (1–12) ist für die Monatssicht erforderlich")
    if sicht == "tag" and datum is None:
        raise bad_request("datum ist für die Tagessicht erforderlich")

    from backend.services.waerme_verteilung import lade_verteilung_verlauf

    v = await lade_verteilung_verlauf(
        db, anlage, sicht=sicht, jahr=jahr, monat=monat, datum=datum,
    )
    return VerteilungVerlaufResponse(
        sicht=v.sicht,
        stufe=v.stufe,
        segmente=[VerteilungSegmentResponse(**vars(s)) for s in v.segmente],
        perioden=[VerteilungPeriodeResponse(**vars(p)) for p in v.perioden],
        menge_kwh=v.menge_kwh,
        aufgeteilt_kwh=v.aufgeteilt_kwh,
        kosten_gesamt_euro=v.kosten_gesamt_euro,
        verlauf_kwh=v.verlauf_kwh,
        ohne_stundenform_kwh=v.ohne_stundenform_kwh,
    )


@router.get("/{anlage_id}/tag-detail", response_model=TagDetailResponse)
async def get_tag_detail(
    anlage_id: int,
    datum: date = Query(..., description="Tag (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Snapshot-teure Tages-Detailwerte für Cockpit/Tag (D1 „maximal erheben",
    SPEC-COCKPIT-TAG-JAHR Abschnitt F/I): WP-Strom-Split + WP-Wärme (Heizung/
    Warmwasser, nur mit Wärmemengenzähler), Speicher-Netzladung + effektiver
    Ladepreis, E-Mob PV-/Netz-Anteil der Ladung, PV-Tages-SOLL (OM × eedc-
    Lernfaktor) und Tagestarif (für Wirkungsverluste €/Tarif-Zeile). Alles
    tagesgenau aus Snapshots/TEP/Prognose. Bewusst EIN Aufruf pro gewähltem Tag
    (nicht über die 90-Tage-Werte-Spanne), da Snapshot-Boundary-Diffs teuer sind.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    inv_result = await db.execute(select(Investition).where(Investition.anlage_id == anlage_id))
    investitionen_by_id = {str(inv.id): inv for inv in inv_result.scalars().all()}

    from backend.services.snapshot.aggregator import get_tagesdetail_kwh
    from backend.services.speicher_wirtschaftlichkeit import berechne_effektiver_ladepreis
    from backend.services.finanz_zeilen import FinanzZeileEingabe, baue_finanz_zeile
    from backend.api.routes.live_wetter import _get_lernfaktor

    from backend.services.snapshot.boundary_range import tageszeile_ist_rueckwaerts

    # ⛔ **N-434/N-435: Die Tageszeile wird ZUERST gelesen**, weil ihre Herkunft
    # das Fenster aller Wärmepumpen-Zähler dieses Tages bestimmt. Im HA-Add-on
    # steht `komponenten_kwh` als Σ der 24 LTS-Slots [Vortag 23:00, 23:00);
    # Teilmengen (Betriebsart-Zähler) und Gegenstücke (Wärme der Arbeitszahl)
    # desselben Geräts müssen im selben Fenster stehen — sonst wird die
    # Differenz zweier Randstunden zu „nicht aufgeteilt" bzw. zu einer falschen
    # Arbeitszahl.
    tz_zeile = (await db.execute(
        select(
            TagesZusammenfassung.komponenten_kwh,
            TagesZusammenfassung.source_provenance,
        ).where(
            TagesZusammenfassung.anlage_id == anlage_id,
            TagesZusammenfassung.datum == datum,
        )
    )).one_or_none()
    tz_komp = tz_zeile[0] if tz_zeile else None
    tz_rueckwaerts = tageszeile_ist_rueckwaerts(tz_zeile[1] if tz_zeile else None)

    _tagesdetail = await get_tagesdetail_kwh(
        db, anlage, investitionen_by_id, datum,
        tageszeile_rueckwaerts=tz_rueckwaerts,
    )
    detail = _tagesdetail.werte
    # W-18: Warum ein Tageswert fehlt. Der Grund wird **hergeleitet**, nicht
    # geraten — bis zum 26.08.2026 hing der Client an jedes „—" denselben Satz
    # „Sensor zuordnen", auch bei zugeordnetem Zähler (dietmar1968, T89667 #210).
    _grund = _tagesdetail.grund_je_feld
    eff = await berechne_effektiver_ladepreis(db, anlage_id=anlage_id, von=datum, bis=datum)

    # PV Tages-SOLL = OM-Tagesprognose × eedc-Lernfaktor (wie Genauigkeits-Tracking).
    tz_prog = await db.execute(
        select(TagesZusammenfassung.pv_prognose_kwh).where(
            TagesZusammenfassung.anlage_id == anlage_id,
            TagesZusammenfassung.datum == datum,
        )
    )
    pv_prognose = tz_prog.scalar_one_or_none()
    lernfaktor = await _get_lernfaktor(anlage_id, db, quelle="openmeteo")
    soll_pv = round(pv_prognose * lernfaktor, 1) if (pv_prognose and lernfaktor) else pv_prognose

    # Tagestarif (Monatstarif je Tag) — Preise hängen nicht von Mengen ab.
    # Die Monatsdaten-Zeile muss mit: bei dynamischem Tarif trägt sie den
    # abgerechneten Monats-Ø, der den Stammdaten-Arbeitspreis schlägt. Ohne sie
    # nennt die Tarif-Zeile hier einen anderen Preis als Cockpit/Monat.
    md_tag = (await db.execute(
        select(Monatsdaten).where(
            Monatsdaten.anlage_id == anlage_id,
            Monatsdaten.jahr == datum.year,
            Monatsdaten.monat == datum.month,
        )
    )).scalar_one_or_none()
    tarif = await baue_finanz_zeile(
        db,
        anlage_id,
        FinanzZeileEingabe(jahr=datum.year, monat=datum.month, monatsdaten=md_tag),
        tarif_cache={},
    )

    # ── Der Preis DIESES Tages (SOLL Flex-Tarife P-2, 17.09.2026) ──
    #
    # Die Zeile darüber liefert den **Monats**preis; bis hierher war er auch der
    # Preis des Tages. Wo Slot-Preise mitgeschrieben sind, ist der Tages-Ø die
    # feinere und damit richtige Quelle — und dieselbe, mit der die Tages-
    # Tabelle (`services/energie_profil/tage_werte.py`) seit demselben Bau
    # rechnet. Ohne diesen Block nennten die beiden Tagessichten verschiedene
    # Preise für denselben Tag (die F-18-Klasse).
    from backend.api.routes.strompreise import lade_tarife_je_stichtag as _ltjs
    from backend.services.strompreis_aggregator import lade_slot_kosten_je_tag

    _stichtag = date(datum.year, datum.month, 1)
    _tarife_tag = await _ltjs(db, anlage_id, [_stichtag])
    _slot_kosten = await lade_slot_kosten_je_tag(
        db, anlage_id, von=datum, bis=datum,
        tarif_fuer=lambda _t: (_tarife_tag.get(_stichtag) or {}).get("allgemein"),
        abgerechnet_fuer=lambda _t: getattr(
            md_tag, "netzbezug_durchschnittspreis_cent", None
        ) if md_tag else None,
    )
    _slot_tag = _slot_kosten.get(datum)
    netzbezug_preis_tag = (
        _slot_tag.mittel_cent if _slot_tag is not None and _slot_tag.mittel_cent is not None
        else tarif.netzbezug_preis_cent
    )
    netzbezug_preis_herkunft_tag = _slot_tag.herkunft if _slot_tag is not None else None

    # #263/T2 — die Aufteilung Heizen/Kühlen des Tages, anlagenweite Σ.
    #
    # Die Rechnung ist ohnehin tagesweise (`falte_modus_split_tag`); die
    # Monatssicht summiert sie nur hinterher auf. Hier bleibt sie eine Ebene
    # früher stehen — derselbe Ladepfad, dieselbe Faltung.
    #
    from backend.core.berechnungen import waermepumpe_kwh_je_investition
    from backend.core.berechnungen.tages_stapel import (
        beitrag_abzug_kwh, beitraege_des_tages, falte_tages_stapel,
    )
    from backend.core.berechnungen.wp_tages_praezedenz import (
        QUELLE_TAGESRAND, loese_wp_tagesstrom_auf,
    )
    from backend.core.berechnungen.waermepumpe_kennzahl import (
        GRUND_FUNKTION_NICHT_DECKUNGSGLEICH, abgrenzungs_grund,
        ARBEITSZAHL_FUNKTIONEN, abgrenzung_je_funktion,
        als_arbeitszahl, arbeitszahl, arbeitszahl_je_funktion,
        arbeitszahl_kuehlen,
        deckung_aus_geraeten, heizwaerme_je_geraet, systemarbeitszahl,
        waerme_gesamt_je_geraet,
    )
    from backend.services.waermepumpe_kennzahlen_je_geraet import (
        kennzahlen_aus_mengen, mengen_aus_tageswerten,
    )
    from backend.services.waerme_klima_block import (
        achsen_der_anlage, funktions_eingaenge_der_anlage, geraete_zeilen,
        schranken_eingang, was_noch_moeglich,
    )
    from backend.core.investition_parameter import (
        abgrenzung_stoerung, ist_luft_luft_waermepumpe,
    )
    from backend.core.tageswert_grund import (
        GRUND_KEINE_ZAEHLERSTAENDE, GRUND_NICHT_ZUGEORDNET,
        GRUND_ZAEHLER_RUECKSPRUNG,
        tages_abdeckung_hinweis, tageswert_grund_kurz, tageswert_grund_text,
    )
    from backend.services.energie_profil import lade_modus_split_tag
    from backend.services.snapshot.aggregator import (
        WP_STROM_AUSGABE_ZU_FELD as _WP_STROM_AUSGABE_ZU_FELD,
        get_betriebsart_strom_tageswerte,
        get_wp_strom_stufe_je_investition,
    )

    # ── Zweig 1 laden: gemessene Betriebsart-Zähler (#263) ────────────────
    #
    # **Gemessen schlägt abgeleitet — ganz oder gar nicht je Gerät**
    # (SOLL §6.1/F4, Invariante K2; SoT `core/berechnungen/betriebsart_gemessen.py`).
    # Die Weiche wird **nicht** hier nachgebaut: die Feldnamen gehen
    # **unverändert** weiter, samt Innengerät-Suffix, und `modus_strom_zeile`
    # löst *Gerätefeld gewinnt, sonst Σ Innengeräte* selbst auf. Genau diese
    # Regel ein zweites Mal zu schreiben war F-56.
    # Der Bezug je Gerät kommt aus dem **Zählerpfad** (`komponenten_kwh`), nicht
    # aus der Stundensumme des Leistungspfads — die weicht ab, und genau daran
    # hängt W-17b (30 kWh Balken unter einer 284-kWh-Kachel). Die Tageszeile
    # und ihr Fenster sind oben schon gelesen (N-434/N-435).
    gemessen_je_inv = await get_betriebsart_strom_tageswerte(
        db, anlage, investitionen_by_id, datum, rueckwaerts=tz_rueckwaerts,
    )

    # ── R-4/N-482 · N-491: der Tages-Strom je Gerät, aufgelöst ────────────
    #
    # ⛔ **Hier stand bis zum 15.09.2026 nur** ``waermepumpe_kwh_je_investition
    # (tz_komp)`` — die aggregierte Tageszeile und sonst nichts. Sie fehlt für
    # ein Gerät in zwei Lagen, und beide standen auf Gernots Screenshot vom
    # 15.09.: ein an diesem Tag **stummer** Gesamtzähler (N-482) und ein Tag,
    # der erst um 11 Uhr beginnt bzw. noch läuft (N-491). Die Folge war jedes
    # Mal dieselbe: kein Nenner, keine Arbeitszahl, keine Verteilung — und der
    # Grund „kein Stromverbrauch erfasst" **neben** einer Strom-Kachel mit
    # Zahl. Die Präzedenz steht im Layer (n-gegen-1, Vorbild
    # ``pv_tages_praezedenz``); hier werden nur ihre Eingänge gesammelt.
    #
    # ⚠ **Die Registry-Feldnamen sind der Vertrag.** ``wp_strom_aufteilung``
    # liest eine IMD-Zeile; sie kann dieselbe Frage an Tageswerten nur
    # beantworten, wenn die Schlüssel dieselben sind — deshalb die Rückabbildung
    # der Ausgabe-Keys, und deshalb gehen die Betriebsart-Felder **unverändert**
    # (samt Innengerät-Suffix) mit hinein: ihre K2-Auflösung steht in
    # ``betriebsart_gemessen``, nicht hier.
    _wp_tageswerte_je_inv: dict[str, dict[str, float]] = {}
    for _ausgabe, _registry_feld in _WP_STROM_AUSGABE_ZU_FELD.items():
        for _inv_id, _kwh in (_tagesdetail.werte_je_inv.get(_ausgabe) or {}).items():
            _wp_tageswerte_je_inv.setdefault(_inv_id, {})[_registry_feld] = _kwh
    for _inv_id, _felder_tag in gemessen_je_inv.items():
        _wp_tageswerte_je_inv.setdefault(_inv_id, {}).update(_felder_tag)
    wp_strom_je_inv, wp_strom_herkunft = loese_wp_tagesstrom_auf(
        waermepumpe_kwh_je_investition(tz_komp or {}),
        _wp_tageswerte_je_inv,
        investitionen_by_id,
    )
    wp_kwh_je_inv: dict[str, float] = {}
    if gemessen_je_inv:
        wp_kwh_je_inv = dict(wp_strom_je_inv)

    # ⭐ **Die Zusammenführung beider Zweige steht seit dem 10.09.2026 im Layer**
    # (`core/berechnungen/tages_stapel.py`) und nicht mehr hier. Auslöser war der
    # Monats-Verlauf (Konzept Wärme/Klima §8, Bauschnitt 4): Er braucht denselben
    # Stapel für 28–31 Tage, und in einer Route ist er für ihn unerreichbar. Ihn
    # dort ein zweites Mal hinzuschreiben wäre F-56 gewesen — die Probe
    # `test_263_t3_gemessene_betriebsart_tag.py` sagt im Kopf, warum das teuer
    # ist: *„die beiden Zweige treffen sich in `get_tag_detail`, die
    # Vorrang-Regel ist nur im Paar prüfbar."*
    #
    # **Geladen wird weiter hier, gefaltet wird dort** — dieselbe Bauform wie
    # `_lade_tages_eingaenge` neben `falte_modus_split_tag`.
    # Bauschnitt 6: Die BEITRÄGE je Gerät werden gebraucht, nicht nur ihre
    # Faltung — die Tages-Kühlzahl fragt, WELCHE Geräte Kühlstrom in den Stapel
    # bringen (R2 beidseitig, s. u.). `falte_tages_stapel` ist genau
    # `_falte(beitraege_des_tages(…))`; beides aus denselben Eingängen ⇒ bitgleich.
    _splits_tag = await lade_modus_split_tag(db, anlage_id, datum)
    # N-462: SOLL-§9-E7/Option A fragt „steckt der funktionsfremde Anteil im
    # Nenner?" — und das entscheidet die K3-Stufe des Bezugs, nicht das
    # Kennzeichen. Gemessen: 3,00 statt 3,75 an derselben Anlage.
    _stufe_je_inv = await get_wp_strom_stufe_je_investition(
        db, anlage, investitionen_by_id,
    )
    beitraege_tag = beitraege_des_tages(
        gemessen_je_inv, wp_kwh_je_inv, _splits_tag, investitionen_by_id, datum,
        stufe_je_inv=_stufe_je_inv,
    )
    stapel = falte_tages_stapel(
        gemessen_je_inv,
        wp_kwh_je_inv,
        _splits_tag,
        investitionen_by_id,
        datum,
        stufe_je_inv=_stufe_je_inv,
    )
    heizen_tag = stapel.heizen_kwh
    kuehlen_tag = stapel.kuehlen_kwh
    warmwasser_tag = stapel.warmwasser_kwh
    lueften_tag = stapel.lueften_kwh
    entfeuchten_tag = stapel.entfeuchten_kwh
    rest_tag = stapel.nicht_aufgeteilt_kwh
    bezug_tag = stapel.bezug_kwh
    abdeckung_tag = stapel.abdeckung_h
    hat_split = stapel.hat_split
    hat_gemessen = stapel.hat_gemessen

    # ── Wärme gesamt + Arbeitszahl des Tages, beide aus dem Layer ──────────
    #
    # Der Tages-Strom ist die Σ der `waermepumpe_*`-Keys der Tageszusammen-
    # fassung — dieselbe Quelle, aus der der Modus-Split oben seinen Bezug
    # nimmt. Die Wärme ist im Tag **immer gemessen** (nur ein zugeordneter
    # Wärmemengenzähler kommt hier an), deshalb gibt es keinen abgeleiteten
    # Anteil und die Sperre greift nur über die beiden Mengen selbst.
    # ⭐ **N-391: das erste Argument ist seit dem 14.09.2026 belegt.** Hier stand
    # `None`, weil es den gemeinsamen Wärmemengenzähler als Feld nicht gab — der
    # Tag konnte die Vorrangregel D1 also gar nicht anwenden. Mit dem Feld
    # *Wärme gesamt* kommt sein Tageswert über den Aggregator an
    # (`TAGESDETAIL_AUSGABE`), und Tag, Monat und Jahr lesen dieselbe Regel.
    # ⛔ **N-391b: je GERÄT, dann summieren — nie auf `detail` (den Anlagen-
    # summen).** Das Feld liegt am Gerät; über den Summen verschlänge der
    # Gesamtzähler EINER Wärmepumpe die Aufteilung aller anderen (zwei WPs,
    # 30 + [20 + 5] ⇒ 30 statt 55, während der Monat für denselben Bestand 55
    # sagt). `werte_je_inv` trägt dieselben Zahlen je Gerät; `detail` ist ihre
    # Summe — die Auflösung gehört davor, nicht danach.
    # ⭐ **R-2/N-487: D1-Stufe 3 gilt auch am Tag.** Bis zum 15.09.2026 stand
    # hier `werte_je_inv["wp_heizung_kwh"]` roh — die **Achse** und sonst
    # nichts. Ein Gerät, das seine Heizwärme je Betriebsart misst, brachte im
    # Tag keine Wärme ein, und der Kasten nannte den Handgriff „Wärmemengen-
    # zähler zuordnen", den es längst getan hatte. Die Weiche ist dieselbe wie
    # im Monat und steht im Layer; hier wird sie **je Gerät** gerufen.
    _wp_heizung_je_inv = heizwaerme_je_geraet(
        _tagesdetail.werte_je_inv.get("wp_heizung_kwh"),
        _tagesdetail.werte_je_inv.get("wp_betriebsart_heizen_kwh"),
    )
    _wp_waerme_je_geraet = waerme_gesamt_je_geraet(
        _tagesdetail.werte_je_inv.get("wp_waerme_kwh"),
        _wp_heizung_je_inv,
        _tagesdetail.werte_je_inv.get("wp_warmwasser_kwh"),
    )
    # Die anlagenweite Heizwärme ist die Σ der **aufgelösten** Geräte (E1), nicht
    # die Σ der Achse — sonst nennt dieselbe Route zwei Zahlen.
    _wp_heizung_tag = sum(_wp_heizung_je_inv.values()) if _wp_heizung_je_inv else None
    # W-18 für eine **Alternativ-Gruppe**: Die Heizwärme hat seit R-2 zwei
    # mögliche Zähler, und ein Grund gilt der Gruppe, nicht dem Feld.
    #
    # ⛔ **Die Bedingung ist nicht kosmetisch.** `grund_je_feld` enthält genau
    # die Keys **ohne** Wert — daran hängt die Zusage „ein Grund steht nur da,
    # wo nichts geliefert hat". Nähme man den Betriebsart-Key unbedingt dazu,
    # trüge jede ganz normale Wärmepumpe (Achse gepflegt, Betriebsart-Zähler
    # nicht zugeordnet) plötzlich den Grund *„kein Wärmemengenzähler
    # zugeordnet"* neben ihrer gemessenen Null — gemessen an
    # `test_n348_…::test_gemessene_null_heisst_kein_betrieb_nicht_kein_zaehler`,
    # und genau die Verwechslung, die dietmar1968 einen Zuordnungsfehler suchen
    # ließ (T89667 #322).
    _D1_HEIZ_GRUND_KEYS = (
        ("wp_heizung_kwh", "wp_betriebsart_heizen_kwh")
        if "wp_heizung_kwh" in _grund else ("wp_heizung_kwh",)
    )
    _wp_waerme_tag = sum(_wp_waerme_je_geraet.values())
    wp_waerme_tag = round(_wp_waerme_tag, 2) if _wp_waerme_tag > 0 else None
    # ⛔ **Hier stand bis zum 15.09.2026 eine ZWEITE Abfrage derselben Spalte**
    # (`komponenten_kwh`) und eine zweite Faltung daneben — während `tz_komp`
    # dreißig Zeilen weiter oben schon gelesen war. `wp_strom_je_inv` kommt
    # jetzt aus der einen Auflösung (R-4), und damit lesen der Stapel, die
    # Verteilung und die Arbeitszahl **dieselbe** Menge.
    wp_strom_tag = sum(wp_strom_je_inv.values()) or None
    # ── D-Sicht 3: die Mengen je Gerät des TAGES ──────────────────────────
    #
    # ⚠ **Die zweite Mengen-Herkunft** (s. Modulkopf des Dienstes): Der Tag
    # faltet Snapshots, nicht IMD-Zeilen — die **Kennzahl** entsteht trotzdem in
    # derselben Funktion wie im Hub, im Monat und im Jahr.
    _wp_kaelte_je_inv = _tagesdetail.werte_je_inv.get("wp_kaelte_kwh") or {}
    _wp_ww_je_inv = _tagesdetail.werte_je_inv.get("wp_warmwasser_kwh") or {}
    _wp_gesamtwaerme_je_inv = _tagesdetail.werte_je_inv.get("wp_waerme_kwh") or {}
    _wp_strom_heizen_je_inv = _tagesdetail.werte_je_inv.get("wp_strom_heizen_kwh") or {}
    _wp_strom_ww_je_inv = _tagesdetail.werte_je_inv.get("wp_strom_warmwasser_kwh") or {}
    _wp_beitrag_je_inv = {b.inv_id: b for b in beitraege_tag}
    # ⚠ **Der Geräte-Kreis ist der der STROM-Beiträge — und das ist heute eine
    # benannte Grenze, keine Absicht** (WK-16j/§7). Ein Gerät mit Wärmemengen-
    # zähler und ohne Stromwert **an diesem Tag** (r28/Demo, 15.06.2026: Daikin
    # mit 4,0 kWh Wärme) kommt hier nicht vor: Es fehlt deshalb in der Tabelle
    # *Zahlen je Gerät* **und** im Zähler-Kreis der Deckung. Es aufzunehmen ist
    # gemessen **nicht** folgenlos — ``kennzahlen_aus_mengen`` kennt den
    # W-18-Grund des Tages nicht und schriebe an so eine Zeile *„kein
    # Stromverbrauch erfasst"*, also genau den Satz, den N-492 abgestellt hat
    # (der Zähler **ist** zugeordnet, nur dieser Tag trägt keine Stände).
    _wp_kennzahlen_je_geraet = []
    for _inv_id_str, _inv_strom in wp_strom_je_inv.items():
        _inv = investitionen_by_id.get(_inv_id_str)
        if _inv is None:
            continue
        _b = _wp_beitrag_je_inv.get(_inv_id_str)
        _wp_kennzahlen_je_geraet.append(kennzahlen_aus_mengen(
            mengen_aus_tageswerten(
                _inv,
                strom_kwh=float(_inv_strom or 0.0),
                waerme_kwh=float(_wp_waerme_je_geraet.get(_inv_id_str, 0.0)),
                heizung_kwh=float(_wp_heizung_je_inv.get(_inv_id_str, 0.0)),
                warmwasser_kwh=float(_wp_ww_je_inv.get(_inv_id_str, 0.0)),
                strom_heizen_kwh=float(_wp_strom_heizen_je_inv.get(_inv_id_str, 0.0)),
                strom_warmwasser_kwh=float(_wp_strom_ww_je_inv.get(_inv_id_str, 0.0)),
                kaelte_kwh=float(_wp_kaelte_je_inv.get(_inv_id_str, 0.0)),
                modus_strom_kuehlen_kwh=(_b.kuehlen_kwh if _b else 0.0),
                funktionsfremd_abzug_kwh=(beitrag_abzug_kwh(_b) if _b else 0.0),
                waerme_ist_gesamt=bool(_wp_gesamtwaerme_je_inv.get(_inv_id_str)),
            ),
        ))
    _wp_strom_ohne_waerme_tag, _wp_geraete_ohne_waerme_tag = schranken_eingang(
        _wp_kennzahlen_je_geraet,
    )
    # R2 (26.08.2026): Auch der Tag kannte bisher **keine** Abgrenzungs-Sperre.
    # Die Anwender-Angabe hängt am **Gerät**, nicht am Zeitraum — ein Heizstab
    # auf dem WP-Zähler ist am Dienstag derselbe wie im Monatsbericht. Genau
    # deshalb galt hier sonst der Fall, den ADR-001 beschreibt: dieselbe Frage,
    # zwei Antworten, je nachdem welche Sicht der Anwender öffnet.
    #
    # ⚠ Gefragt werden nur die Geräte, die **an diesem Tag** Strom beigetragen
    # haben. Ein stillgelegtes oder stillstehendes Gerät mit gemeldeter Störung
    # darf die Zahl eines Tages nicht sperren, an dem es gar nicht lief.
    # R2/Bauart (SOLL §5): Trägt der Tag Luft-Wasser **und** Luft-Luft?
    #
    # ⚠ **Hier wird gezählt statt `WpFakten` gefragt, und das ist kein zweiter
    # Rechenweg:** Die Monats-Fakten gibt es für einen einzelnen Tag nicht — der
    # Tag faltet Snapshots, nicht IMD-Zeilen. Die **Regel** steht trotzdem nur
    # einmal (`abgrenzungs_grund` + `GRUND_BAUARTEN_GEMISCHT`); hier entsteht
    # allein ihr Eingang, mit derselben Bedingung wie die Störung darunter:
    # **nur Geräte, die an diesem Tag Strom beigetragen haben.**
    _bauarten_tag = {
        ist_luft_luft_waermepumpe(investitionen_by_id.get(inv_id_str))
        for inv_id_str, kwh in wp_strom_je_inv.items()
        if kwh and investitionen_by_id.get(inv_id_str) is not None
    }
    # R2/§4.2 Fall 1 (ADR-002/P12, 02.09.2026): Trägt der Tag Strom von Geräten,
    # deren Wärme fehlt? **Bis dahin fehlte diese Lage hier — unbegründet.**
    # Cockpit → Monat sperrte, die Tagesansicht daneben zeigte eine Zahl: zwei
    # Sichten, zwei Antworten auf dieselbe Frage.
    #
    # ⭐ **Warum sie aus dem MONAT kommt und nicht vom Tag.** Die Tagesebene
    # kennt den Strom je Gerät (`komponenten_kwh`), die Wärme aber nur als
    # **Anlagensumme** — aus ihr ist nicht ableitbar, von wie vielen Geräten sie
    # stammt. Die Frage ist damit auf Tagesdaten strukturell unbeantwortbar. Sie
    # aus den Monats-Fakten zu holen ist **kein zweiter Rechenweg**, sondern
    # derselbe SoT, den Cockpit → Monat liest (ADR-002/P10) — anders als
    # `bauarten_gemischt` darunter, das aus **Stammdaten** kommt und deshalb
    # ohne Fetch auskommt.
    #
    # ⚠ **Die Rest-Unschärfe gehört dazu:** Meldet ein Gerät im Monat Wärme,
    # aber an genau diesem Tag nicht, bleibt der Tag ungesperrt. Genauer geht es
    # erst, wenn die Tagesebene die Wärme je Gerät führt; die Aussage ist dann
    # „im Monat dieses Tages", und der einzige Fehler, den sie machen kann, ist
    # der mildere von beiden.
    _wp_fakten_monat = await lade_monats_fakten(
        db, anlage_id, von=(datum.year, datum.month), bis=(datum.year, datum.month),
    )
    _geraete_ohne_waerme_monat = any(
        f.wp.waerme_deckt_nicht_alle_geraete for f in _wp_fakten_monat
    )
    # N-441: die Gegenrichtung, aus derselben Monats-Naeherung wie die Zeile
    # darueber und aus demselben Grund — die Tagesebene fuehrt die Waerme nur
    # als Anlagensumme.
    _geraete_verschieden_monat = any(
        f.wp.geraete_verschieden for f in _wp_fakten_monat
    )
    wp_abgrenzung_tag = abgrenzungs_grund(
        abgrenzung_stoerung=next(
            (
                stoerung
                for inv_id_str, kwh in wp_strom_je_inv.items()
                if kwh
                for stoerung in (
                    abgrenzung_stoerung(investitionen_by_id.get(inv_id_str)),
                )
                if stoerung
            ),
            None,
        ),
        bauarten_gemischt=len(_bauarten_tag) > 1,
        geraete_ohne_waerme=_geraete_ohne_waerme_monat,
        geraete_verschieden=_geraete_verschieden_monat,
    )
    # ── SOLL §3.2b: WELCHE Funktionen die Verletzung trifft — am TAG gezählt ─
    #
    # ⛔ **Hier stand bis zum 15.09.2026 die Monats-Näherung**, und sie war im
    # **laufenden** Monat leer: Ohne `Monatsdaten`-Zeile antwortet
    # `WpFakten.deckung_je_funktion` überall `None` ⇒ „die Frage stellt sich
    # nicht" ⇒ keine Sperre. Gemessen an der Prüfstand-Anlage der r28
    # (`tag-detail?datum=2026-09-10`): *Arbeitszahl Heizen* **3,346** und
    # *Warmwasser* **4,211**, beide **ohne Grund** — genau die zwei Zahlen, die
    # *Cockpit → Monat* derselben Anlage seit WK-16i mit R2 zurückhält, und die
    # derselbe Monat nach seinem Abschluss sperrt (Juli, August 2026). **Zwei
    # Sichten, zwei Antworten auf dieselbe Frage** (N-506).
    #
    # ⭐ **Der Tag fragt jetzt dieselbe Faltung wie der Monat** (**WK-16j/R-1**,
    # `waerme_klima_block.funktions_eingaenge_der_anlage`) — Σ über dieselben
    # Geräte-Mengen, aus denen die Tabelle *Zahlen je Gerät* entsteht, und über
    # denselben Layer-SoT `deckung_aus_geraeten` (Identitäten, nicht Anzahlen,
    # N-441). **Keine zweite Faltung** (F-56): derselbe Aufruf, eine Route
    # weiter. Deshalb steht der Block mit den Geräte-Kennzahlen jetzt **über**
    # diesem hier — eine Deckungs-Aussage kommt aus denselben Mengen, die die
    # Zahl bilden.
    #
    # ⚠ **Die Monats-Näherung bleibt für die beiden Block-Lagen darüber**
    # (`_geraete_ohne_waerme_monat`, `_geraete_verschieden_monat` in
    # `wp_abgrenzung_tag`): Sie beschreiben den **Block**, nicht eine Funktion,
    # und die eine davon zählt der Tag ohnehin selbst (`_wp_abgrenzung_sperrt_tag`).
    _wp_funktions_eingaenge_tag = funktions_eingaenge_der_anlage(
        _wp_kennzahlen_je_geraet,
    )
    _deckung_je_funktion_tag = {
        f: _wp_funktions_eingaenge_tag.deckung_je_funktion(f)
        for f in ARBEITSZAHL_FUNKTIONEN
    }

    # ── Und Zähler und Nenner kommen aus DERSELBEN Faltung wie die Deckung ──
    #
    # ⛔ **Sonst bewacht die Deckung eine andere Rechnung, als sie sieht.**
    # Gemessen an der Prüfstand-Lage **ohne** den Vaillant (Nibe + Brauchwasser-WP,
    # laufender Monat): Die Faltung setzt die Brauchwasser-WP nach der
    # Ein-Achsen-Regel (**R-4**) auf **beide** Seiten der Warmwasser-Achse ⇒ die
    # Deckung sagt zu Recht „deckt sich". Der Tages-Nenner
    # ``detail["wp_strom_warmwasser_kwh"]`` kennt sie aber nicht — ihr Strom steht
    # unter ``stromverbrauch_kwh``. Ergebnis wäre 12,5 ÷ 1,5 = **8,33** statt
    # 12,5 ÷ 3,5 = **3,57**: eine freigegebene Zahl mit halbem Nenner. *Cockpit →
    # Monat* rechnet im laufenden Monat seit WK-16i aus genau derselben Faltung
    # (dort 96,36 ÷ 29,08); der Tag zieht damit nach.
    #
    # ⭐ **Jede Seite aus der Quelle, die für sie vollständig ist.**
    #
    # * **Nenner — die Faltung.** Nur sie kennt die Ein-Achsen-Regel; ein Gerät
    #   ohne Gesamt-Strom kann keinen Funktions-Strom tragen, ihr Geräte-Kreis
    #   verliert auf dieser Seite also nichts.
    # * **Zähler — die Tagessumme.** Sie deckt **jedes** Gerät mit Wärme ab, auch
    #   eines ohne Tages-Stromwert (r27/Demo, 05.12.2025: 29,9 kWh Heizwärme ohne
    #   einen einzigen Stromstand). Die Faltung sähe es nicht, und eine Kachel
    #   darf nicht schrumpfen, weil ein Nachbargerät seinen Zähler hat.
    #
    # ⚠ **Die Faltung gewinnt nur, wo sie etwas trägt** — dieselbe Bauform wie
    # die S5-Weiche ``traegt_menge``: Eine 0 ist hier keine Messung, sondern ein
    # Gerät, das sie nicht sieht; der Tageswert trägt dann seinen vollen Wert
    # **und** seine ``None``-heit, an der der W-18-Grund hängt.
    # ⭐ **Gemessen bitgleich** auf r27 (alle fünf Tage) und auf den Demo-Tagen
    # der r28; sichtbar wird der Unterschied nur, wo R-4 greift.
    def _nenner_der_funktion(
        aus_faltung: float, aus_tageswerten: Optional[float],
    ) -> Optional[float]:
        return aus_faltung if aus_faltung > 0 else aus_tageswerten

    _wp_heizung_fn = _wp_heizung_tag
    _wp_warmwasser_fn = detail.get("wp_warmwasser_kwh")
    _wp_strom_heizen_fn = _nenner_der_funktion(
        _wp_funktions_eingaenge_tag.strom_heizen_kwh,
        detail.get("wp_strom_heizen_kwh"),
    )
    _wp_strom_warmwasser_fn = _nenner_der_funktion(
        _wp_funktions_eingaenge_tag.strom_warmwasser_kwh,
        detail.get("wp_strom_warmwasser_kwh"),
    )
    # ── Bauschnitt 6: R2 für KÜHLEN aus dem Tag selbst, beidseitig ─────────
    #
    # ⛔ **Hier reicht die Monats-Näherung darüber NICHT**, und das ist gemessen:
    # Die Kälte summiert `get_tagesdetail_kwh` über alle Geräte, den Kühlstrom
    # trägt nur, wer den Tages-Stapel besteht (Bezug da · Teilmengen-Invariante
    # · aktiv, `tages_stapel.beitraege_des_tages`). Fällt ein Gerät an diesem Tag
    # heraus, stand seine Kälte im Zähler und sein Strom nirgends — **6,0 statt
    # 3,0**, während der Monat sich deckt und deshalb nicht sperrt.
    #
    # ⭐ Anders als bei der Wärme **kennt** der Tag hier beide Seiten je Gerät
    # (Kälte je Gerät aus `werte_je_inv`, Kühlstrom je Beitrag). Die Regel ist
    # dieselbe wie im Monat (`deckung_aus_geraeten`) — und seit N-441 vergleicht
    # sie selbst die **Identitäten**. Der Zwei-Zeilen-Sonderweg, der hier bis
    # zum 12.09.2026 stand (Anzahlen an die Regel, Identität per `if` daneben),
    # ist damit entfallen: eine Regel statt anderthalb.
    _kuehl_geraete_tag = {b.inv_id for b in beitraege_tag if b.kuehlen_kwh > 0}
    _kaelte_geraete_tag = {
        inv_id for inv_id, kwh in
        _tagesdetail.werte_je_inv.get("wp_kaelte_kwh", {}).items()
        if kwh > 0
    }
    _deckung_kuehlen_tag = deckung_aus_geraeten(
        _kuehl_geraete_tag, _kaelte_geraete_tag,
    )
    # Nur „kuehlen" wird ersetzt: Die Faltung beantwortet diese Funktion
    # ausdrücklich **nicht** (sie liefert die Eingänge, deren Mengen sie auch
    # liefert), und der Tag kennt hier beide Seiten je Gerät — genauer geht es
    # nicht. Heizen und Warmwasser kommen seit WK-16j aus derselben Faltung.
    _deckung_je_funktion_tag = {
        **_deckung_je_funktion_tag, "kuehlen": _deckung_kuehlen_tag,
    }
    _wp_abgrenzung_je_funktion_tag = abgrenzung_je_funktion(
        abgrenzung_stoerung=next(
            (
                stoerung
                for inv_id_str, kwh in wp_strom_je_inv.items()
                if kwh
                for stoerung in (
                    abgrenzung_stoerung(investitionen_by_id.get(inv_id_str)),
                )
                if stoerung
            ),
            None,
        ),
        bauarten_gemischt=len(_bauarten_tag) > 1,
        geraete_ohne_waerme=_geraete_ohne_waerme_monat,
        deckung_je_funktion=_deckung_je_funktion_tag,
    )
    # ── E1b: die anlagenweite Tageszahl als Schranke statt als Strich ─────
    #
    # ⭐ Dieselbe Entscheidung wie in Monat und Jahr (14.09.2026): Der Grund
    # *„nicht alle Geräte melden Wärme"* sperrte hier eine Zahl, die er nur zu
    # **klein** macht — der Strom eines Geräts ohne Wärmemessung steht im
    # Nenner, seine Nutzenergie in keinem Zähler. Das ist eine untere Schranke
    # und als solche wahr (ADR-002/P4). Die Gegenrichtung — Wärme ohne den
    # zugehörigen Strom — sperrt weiter.
    # ⛔ **Die Gegenrichtung wird am TAG gezählt, nicht aus dem Monat genähert —
    # und das ist gemessen (r28, Demo-Anlage, 15.06.2026).** Dort trägt die
    # Daikin die Wärme des Tages, aber keinen Strom (kein Tages-Zähler), während
    # der Multisplit Strom trägt und keine Wärme. Die Monats-Näherung sieht die
    # Kreuzung nicht (im Monat decken sich die Geräte); mit ihr allein stand
    # **30,0** als Schranke im Block — Wärme des einen geteilt durch den Strom
    # des anderen. Eine untere Schranke ist das nicht: Der Zähler ist zu groß,
    # die Zahl kippt nach **oben**.
    #
    # ⭐ **Der Tag kann es seit N-391b exakt** — er führt die Wärme je Gerät
    # (`_wp_waerme_je_geraet`) und den Strom je Gerät (`wp_strom_je_inv`). Die
    # Rest-Unschärfe, die der Kommentar an `_geraete_ohne_waerme_monat` oben
    # benennt, gilt damit nur noch für die **andere** Richtung — und die wird
    # zur Schranke, wo sie zutrifft, statt zu sperren.
    _wp_strom_geraete_tag = {i for i, kwh in wp_strom_je_inv.items() if kwh}
    _wp_waerme_geraete_tag = {
        i for i, kwh in _wp_waerme_je_geraet.items() if kwh and kwh > 0
    }
    _wp_abgrenzung_sperrt_tag = abgrenzungs_grund(
        abgrenzung_stoerung=next(
            (
                stoerung
                for inv_id_str, kwh in wp_strom_je_inv.items()
                if kwh
                for stoerung in (
                    abgrenzung_stoerung(investitionen_by_id.get(inv_id_str)),
                )
                if stoerung
            ),
            None,
        ),
        geraete_verschieden=bool(_wp_waerme_geraete_tag - _wp_strom_geraete_tag),
    )
    # W-18, als Eingang für BEIDES: die Sperre der Arbeitszahl und die Zeile im
    # Kasten. ⚠ **Die Kurzform, nicht die Langform** — der Kasten trägt Sätze
    # neben einem Handgriff; der Absatz aus `_tageswert_grund_kombiniert` steht
    # weiterhin unter der Wärme-Kachel, wo er hingehört.
    _wp_waerme_grund_kurz_tag = _tageswert_grund_kurz_kombiniert(
        _grund, (*_D1_HEIZ_GRUND_KEYS, "wp_warmwasser_kwh"),
    )
    # ── R-5/N-492: „kein Stromverbrauch erfasst" neben einer Strom-Kachel ──
    #
    # Der Satz ist eine Aussage über das **Gerät**; er ist falsch, sobald ein
    # Stromzähler zugeordnet ist und nur an **diesem Tag** nichts hergibt. Genau
    # das stand auf dem Lab-Screenshot vom 15.09.2026: *„Strom verbraucht
    # 2 kWh"* und daneben *„Arbeitszahl — kein Stromverbrauch erfasst"*.
    #
    # ⛔ **``GRUND_NICHT_ZUGEORDNET`` bleibt draußen, und zwar aus einem
    # gemessenen Grund:** seine Kurzform lautet *„kein Wärmemengenzähler
    # zugeordnet"* (``TAGESWERT_GRUND_KURZ``) — unter einer **Strom**-Zeile eine
    # Falschaussage. Für diese Lage ist ``GRUND_KEIN_STROM`` mit seinem
    # Handgriff *„Stromzähler zuordnen oder den Monatswert pflegen"* der
    # richtige Satz, und er bleibt.
    _wp_strom_grund_kurz_tag = _tageswert_grund_kurz_kombiniert(
        {
            k: g for k, g in _grund.items()
            if g != GRUND_NICHT_ZUGEORDNET
        },
        ("wp_strom_gesamt_kwh", "wp_strom_heizen_kwh", "wp_strom_warmwasser_kwh"),
    )
    wp_jaz_tag = systemarbeitszahl(
        wp_waerme_tag, wp_strom_tag,
        # W-14 + E4: Strom in Funktionen ohne bewertete Nutzenergie. Am Tag
        # wiegt der Effekt am schwersten: ein Sommertag kann fast reiner
        # Kühlbetrieb sein.
        #
        # ⭐ **SOLL-§9-E7/Option A (12.09.2026): abgezogen wird nur, was im
        # Nenner steht.** Hier stand bis dahin `kuehlen_tag + lueften_tag +
        # entfeuchten_tag` — die Mengen. Ein Gerät mit getrennter
        # Strommessung, dessen Aufteilung nur **abgeleitet** ist, kürzte damit
        # einen Nenner um eine Menge, die er nie enthielt (der Split verteilt
        # `strom_heizen + strom_warmwasser`, er stellt nichts daneben). Der
        # Stapel entscheidet das **je Gerät**; die drei Summanden daneben
        # bleiben unverändert und tragen weiter die Balken (K1).
        kuehlstrom_kwh=stapel.funktionsfremd_abzug_kwh,
        strom_ohne_waerme_kwh=_wp_strom_ohne_waerme_tag,
        geraete_ohne_waerme=_wp_geraete_ohne_waerme_tag,
        abgrenzung_verletzt=_wp_abgrenzung_sperrt_tag,
        # W-18: Die Sperre „kein Wärmemengenzähler zugeordnet" ist im Tag
        # regelmäßig falsch — der Zähler kann zugeordnet und für DIESEN Tag
        # trotzdem leer sein (Snapshots entstehen erst ab der Zuordnung; der
        # Monatswert kommt aus der HA-Langzeitstatistik und steht deshalb da).
        # Der Erhebungspfad weiß es, der Layer kann es nicht wissen.
        waerme_fehlt_grund=_wp_waerme_grund_kurz_tag,
        # R-5: dieselbe Bauform auf der Stromseite — der Erhebungspfad weiß,
        # welcher der drei W-18-Zustände vorliegt, der Layer kann es nicht.
        strom_fehlt_grund=_wp_strom_grund_kurz_tag,
    )

    # ── Arbeitszahl JE FUNKTION — der dritte Aufrufer desselben SoT (N-348) ─
    #
    # ⛔ **Bis 2026-08-29 gab es diesen Block nicht, und der Tag hat die drei
    # Zeilen deshalb ERSATZLOS weggelassen** — nicht als „—", sondern gar nicht.
    # Der Monat ruft `arbeitszahl_je_funktion` unbedingt und liefert immer Wert
    # **oder** Grund; der Tag lieferte keines von beidem, und die geteilte
    # Blockfabrik rendert dann keine Zeile. Dieselbe Anlage, dieselbe Datenlage,
    # zwei Auskünfte — genau der S3-Verstoß aus SOLL §3.3.
    #
    # ⚠ **`hat_split` heißt hier etwas ANDERES als die gleichnamige lokale
    # Variable oben** — die trägt „der Modus-Split hat Daten". Gemeint ist das
    # Investitions-Kennzeichen `getrennte_strommessung`, dieselbe Quelle wie im
    # Monat (`imd_monatsaggregat.py:223`). Die Namensgleichheit ist genau die
    # Falle, an der ein Fix „im Vorbeigehen" eine falsche Zahl erzeugt hätte,
    # deshalb der ausgeschriebene Name.
    #
    # ⚠ Gefragt werden — wie bei der Abgrenzung darüber — **nur die Geräte, die
    # an diesem Tag Strom beigetragen haben.** Ein stillgelegtes Gerät mit
    # getrennter Messung darf einen Tag nicht freischalten, an dem es nicht lief.
    _wp_getrennte_strommessung_tag = any(
        bool(((investitionen_by_id.get(inv_id_str).parameter or {})
              .get("getrennte_strommessung")))
        for inv_id_str, kwh in wp_strom_je_inv.items()
        if kwh and investitionen_by_id.get(inv_id_str) is not None
    )
    # `waerme_abgeleitet_kwh` bleibt 0: Im Tag kommt nur eine **gemessene**
    # Wärme an (nur ein zugeordneter Wärmemengenzähler erreicht `detail`) — der
    # abgeleitete Zweig existiert hier nicht, siehe die Begründung an
    # `_wp_waerme_tag` oben. `abgrenzung_verletzt` ist dieselbe Sperre wie bei
    # der Gesamtzahl: ein Heizstab auf dem Zähler trifft beide Funktionen.
    wp_az_funktion_tag = arbeitszahl_je_funktion(
        # R-2: dieselbe aufgelöste Heizwärme wie oben — `detail` trägt nur die
        # Achse, und die ist bei einem Gerät mit Betriebsart-Wärme leer.
        heizung_kwh=_wp_heizung_fn,
        strom_heizen_kwh=_wp_strom_heizen_fn,
        warmwasser_kwh=_wp_warmwasser_fn,
        strom_warmwasser_kwh=_wp_strom_warmwasser_fn,
        hat_split=_wp_getrennte_strommessung_tag,
        # N-391: derselbe Eingang wie im Monat, nur aus dem Tagesdetail. Trägt
        # der Tag einen Wert des gemeinsamen Wärmemengenzählers, sagen die zwei
        # Zeilen „Wärme nicht je Funktion gemessen" statt „kein Zähler
        # zugeordnet" — der Zähler ist zugeordnet.
        waerme_ist_gesamt=bool(detail.get("wp_waerme_kwh")),
        abgrenzung_verletzt=wp_abgrenzung_tag,
        abgrenzung_je_funktion_grund=_wp_abgrenzung_je_funktion_tag,
        # W-18 je Funktion: dieselbe Sperre wie oben bei der Gesamt-Arbeitszahl,
        # aber **je Zähler**. Der Layer bekam den Parameter am 26.08.; dieser
        # Block entstand am 29.08. (N-348) und hat ihn nie durchgereicht — die
        # zwei Zeilen liefen deshalb weiter auf den Default „kein
        # Wärmemengenzähler zugeordnet", und der ist am Tag regelmäßig falsch:
        # Der Zähler kann zugeordnet und für DIESEN Tag trotzdem leer sein.
        # ⚠ Je EINE Feldliste, nicht die kombinierte von oben — sonst erbt die
        # eine Zeile den Grund der anderen.
        waerme_fehlt_grund_heizen=_tageswert_grund_kurz_kombiniert(
            _grund, _D1_HEIZ_GRUND_KEYS,
        ),
        waerme_fehlt_grund_warmwasser=_tageswert_grund_kurz_kombiniert(
            _grund, ("wp_warmwasser_kwh",),
        ),
        # Der Tag ist die EINZIGE der fünf Sichten, die „gemessene 0" von
        # „nichts gemessen" trennen kann: `detail` trägt den Wert nur, wenn das
        # Feld aggregiert wurde, und `_grund` sagt sonst, warum nicht. Monat und
        # Jahr summieren vorher (`sum()` ⇒ immer eine Zahl) und dürfen den
        # Wortlaut deshalb nicht führen.
        null_ist_gemessen=True,
        # **R-2 (WK-16h, N-499): dieselbe Frage wie im Monat und im Jahr.**
        # Gemessen an der Demo-Anlage der r28 am 15.06.2026: An diesem Tag trägt
        # allein die Split-Klimaanlage Strom bei — und der Kasten empfahl
        # *„Getrennte Strommessung einschalten und beide Zähler zuordnen"* für
        # eine Warmwasser-Achse, die es an dieser Ausstattung nicht gibt.
        achsen=achsen_der_anlage(_wp_kennzahlen_je_geraet),
        gesamt=als_arbeitszahl(wp_jaz_tag),
    )

    # ── Arbeitszahl KÜHLEN — derselbe Aufruf wie im Monat (Bauschnitt 6) ───
    #
    # Zähler: die Kälte des Tages (`wp_kaelte_kwh`, Gerätefeld oder Σ
    # Innengeräte, im Fenster der Tageszeile). Nenner: der Kühlstrom des
    # Stapels. Die Σ über ALLE Geräte ist hier richtig: Deckt sich der
    # Geräte-Kreis, sind es dieselben Geräte; deckt er sich nicht, sperrt R2.
    #
    # W-18 für die Kälte: nur „keine Stände" und „Rücksprung" gehen als
    # Kurzform hinein. ⛔ **Nicht „nicht zugeordnet"** — dessen Kurzform spricht
    # von einem *Wärme*mengenzähler; für die Kälte ist `GRUND_KEINE_KAELTEMENGE`
    # (der Default des Layers) der richtige Satz, und er trifft jeden kühlenden
    # Anwender ohne Kältemengenzähler.
    _kaelte_grund_roh = _grund.get("wp_kaelte_kwh")
    wp_az_kuehlen_tag = arbeitszahl_kuehlen(
        detail.get("wp_kaelte_kwh"),
        kuehlen_tag,
        abgrenzung_verletzt=(
            _wp_abgrenzung_je_funktion_tag["kuehlen"]
            or (
                GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
                if _deckung_kuehlen_tag is False else None
            )
        ),
        kaelte_fehlt_grund=(
            tageswert_grund_kurz(_kaelte_grund_roh)
            if _kaelte_grund_roh in (GRUND_KEINE_ZAEHLERSTAENDE, GRUND_ZAEHLER_RUECKSPRUNG)
            else None
        ),
        null_ist_gemessen=True,
    )

    # D-Sicht 3: EINMAL gebaut — die Tabelle im Block **und** der Kasten lesen
    # dieselben Zeilen (R-4). Zwei Aufrufe nebeneinander wären zwei Wahrheiten
    # über dieselbe Frage, und die Dedup-Regel des Kastens hinge dann an einer
    # zweiten Liste.
    _wp_block_geraete = geraete_zeilen(_wp_kennzahlen_je_geraet)

    # ── Aktive Geräte je Typ (Namen) für die „aggregiert aus …"-Hinweise ──
    #
    # Wortgleich zur Monatssicht (`aktueller_monat.py`), nur mit der feineren
    # Grenze: der Tag fragt `ist_aktiv_an`, nicht `ist_aktiv_im_monat`. Ein am
    # 20. angeschafftes Gerät gehört in den Hinweis des 21., nicht in den des 3.
    komponenten_geraete: dict[str, list[str]] = {}
    for _inv in investitionen_by_id.values():
        if _inv.ist_aktiv_an(datum):
            komponenten_geraete.setdefault(_inv.typ, []).append(_inv.bezeichnung)

    return TagDetailResponse(
        datum=datum,
        komponenten_geraete=komponenten_geraete,
        wp_modus_strom_heizen_kwh=round(heizen_tag, 2) if hat_split else None,
        wp_modus_strom_kuehlen_kwh=round(kuehlen_tag, 2) if hat_split else None,
        wp_modus_strom_warmwasser_kwh=round(warmwasser_tag, 2) if hat_split else None,
        wp_modus_strom_lueften_kwh=round(lueften_tag, 2) if hat_split else None,
        wp_modus_strom_entfeuchten_kwh=round(entfeuchten_tag, 2) if hat_split else None,
        wp_modus_nicht_aufgeteilt_kwh=round(rest_tag, 2) if hat_split else None,
        wp_modus_abdeckung_h=round(abdeckung_tag, 1) if hat_split else None,
        # W-17b: Der Balken sagt jetzt, worauf er sich bezieht. Ohne dieses
        # Feld stand er unter einer Kachel mit einer GROESSEREN Zahl, ohne dass
        # irgendwo die Differenz benannt war — dietmar1968 sah 30 kWh Balken
        # unter 284 kWh Kachel (T89667 #210).
        wp_modus_strom_bezug_kwh=round(bezug_tag, 2) if hat_split else None,
        # Wie in der Monatssicht: „gemessen" gilt für die Zeile, sobald ein
        # Gerät des Tages seine Aufteilung aus Zählern hat. Ein
        # Betriebsart-Zähler hat keine „Stunden mit Signal" — die Abdeckung
        # bleibt dann 0, ohne dass etwas fehlt (das Frontend zeigt deshalb
        # „Herkunft: gemessen" statt „Modus erfasst: 0 Stunden").
        wp_modus_gemessen=hat_gemessen if hat_split else None,
        # A6: Die Kacheln zeigen, **womit die Kennzahl gerechnet hat** — also
        # dieselben vier Zahlen, die oben in `arbeitszahl_je_funktion` gehen.
        wp_strom_heizen_kwh=_wp_strom_heizen_fn,
        wp_strom_warmwasser_kwh=_wp_strom_warmwasser_fn,
        # R-2: die **aufgelöste** Heizwärme (D1-Stufe 3), nicht die Achse.
        # R-4: die Marke steht an der **Basis**-Größe des Blocks, nicht an
        # jeder abgeleiteten — dieselbe Regel, mit der N-472 die Gründe im
        # laufenden Monat verteilt hat. Sonst stünde derselbe Satz fünfmal.
        wp_abdeckung_hinweis=tages_abdeckung_hinweis(
            _tagesdetail.abdeckung_von.strftime("%H:%M")
            if _tagesdetail.abdeckung_von else None,
            _tagesdetail.abdeckung_bis.strftime("%H:%M")
            if _tagesdetail.abdeckung_bis else None,
        ),
        wp_heizung_kwh=_wp_heizung_fn,
        wp_warmwasser_kwh=_wp_warmwasser_fn,
        wp_waerme_kwh=wp_waerme_tag,
        # W-18: Warum die Wärme fehlt. Sie entsteht aus ZWEI Feldern; der
        # aussagekräftigere Grund gewinnt (`GRUND_RANG`), damit nicht „kein
        # Zähler" gemeldet wird, während der zweite Zähler zugeordnet, aber
        # leer ist. Steht ein Wert, steht kein Grund — nie beides.
        wp_waerme_grund=(
            _tageswert_grund_kombiniert(
                _grund, (*_D1_HEIZ_GRUND_KEYS, "wp_warmwasser_kwh"),
            ) if wp_waerme_tag is None else None
        ),
        wp_jaz=wp_jaz_tag.wert,
        wp_jaz_grund=wp_jaz_tag.grund,
        wp_jaz_hinweis=wp_jaz_tag.hinweis,
        wp_jaz_zaehler_kwh=wp_jaz_tag.zaehler_kwh,
        wp_jaz_nenner_kwh=wp_jaz_tag.nenner_kwh,
        # N-348 — je Funktion, wie der Monat. Wert ODER Grund, nie beides leer.
        wp_jaz_heizen=wp_az_funktion_tag.heizen.wert,
        wp_jaz_heizen_grund=wp_az_funktion_tag.heizen.grund,
        wp_jaz_warmwasser=wp_az_funktion_tag.warmwasser.wert,
        wp_jaz_warmwasser_grund=wp_az_funktion_tag.warmwasser.grund,
        # Bauschnitt 6 (11.09.2026): Die Kältemenge hat jetzt einen Tagespfad —
        # bis dahin stand hier ein Grund „nur im Monat", weil der Zähler des
        # Quotienten den Tag nie erreichte (N-348).
        wp_jaz_kuehlen=wp_az_kuehlen_tag.wert,
        wp_jaz_kuehlen_grund=wp_az_kuehlen_tag.grund,
        wp_jaz_ist_schranke=wp_jaz_tag.ist_schranke,
        wp_jaz_schranke_hinweis=wp_jaz_tag.schranke_hinweis,
        wp_geraete=_wp_block_geraete,
        # D-Sicht 1: Der Tag kennt einen Grund mehr als Monat und Jahr — den
        # der **Wärme** (W-18: „für diesen Tag keine Zählerstände"). Er gehört
        # in denselben Kasten; welche Klasse er trägt, entscheidet die
        # Grund-Konstante, nicht diese Route.
        wp_moeglich=was_noch_moeglich([
            ("Arbeitszahl", wp_jaz_tag.grund),
            (
                "Wärme erzeugt",
                _wp_waerme_grund_kurz_tag if wp_waerme_tag is None else None,
            ),
            ("Arbeitszahl Heizen", wp_az_funktion_tag.heizen.grund),
            ("Arbeitszahl Warmwasser", wp_az_funktion_tag.warmwasser.grund),
            ("Arbeitszahl Kühlen", wp_az_kuehlen_tag.grund),
        # R-4: die Geräte-Ausstattungsgründe, dedupliziert gegen die Zeilen
        # darüber (WK-16h/N-502).
        ], _wp_block_geraete),
        # Bauschnitt 8: derselbe Wert, den die Kühlzahl eben als Zähler bekam.
        wp_kaelte_kwh=(
            round(detail["wp_kaelte_kwh"], 2)
            if (detail.get("wp_kaelte_kwh") or 0) > 0 else None
        ),
        speicher_ladung_netz_kwh=detail.get("speicher_ladung_netz_kwh"),
        speicher_effektiver_ladepreis_cent=(
            round(eff.effektiver_ladepreis_cent, 2)
            if eff.effektiver_ladepreis_cent is not None else None
        ),
        speicher_effektiver_ladepreis_quelle=eff.quelle,
        emob_ladung_pv_kwh=detail.get("emob_ladung_pv_kwh"),
        emob_ladung_netz_kwh=detail.get("emob_ladung_netz_kwh"),
        # W-18, dieselbe Klasse an der E-Mobilität: Der PV-Anteil trug denselben
        # fest verdrahteten „Sensor zuordnen"-Satz. Er wird ebenfalls über
        # denselben Weg erhoben und hat deshalb dieselben drei Zustände.
        emob_ladung_pv_grund=tageswert_grund_text(
            _grund.get("emob_ladung_pv_kwh"), "emob_ladung_pv_kwh",
        ),
        soll_pv_kwh=soll_pv,
        einspeise_preis_cent=tarif.einspeiseverguetung_cent,
        netzbezug_preis_cent=netzbezug_preis_tag,
        netzbezug_preis_herkunft=netzbezug_preis_herkunft_tag,
    )


@router.get("/{anlage_id}/tag-status", response_model=TagStatusResponse)
async def get_tag_status(
    anlage_id: int,
    datum: date = Query(..., description="Tag (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """Warum liegen für diesen Tag keine Werte vor — und was hilft? (F-2)

    Aufruf **nur** aus der leeren Tagessicht heraus, nicht bei jedem
    Tageswechsel: die letzte Prüfung ist ein HA-LTS-Read für den Tag, und nur
    er unterscheidet „Lücke, nachholbar" von „HA hat für den Tag selbst nichts".

    Bewusst getrennt vom Daten-Checker: der beschreibt die **Anlage** (letzte
    Tageszeile, 90-Tage-Lücken, ~2,5 s je Lauf) und beantwortet die Frage nach
    **diesem** Tag nicht.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    from backend.services.energie_profil.tag_status import baue_tag_status

    status = await baue_tag_status(db, anlage, datum)
    return TagStatusResponse(
        datum=datum,
        lage=status.lage,
        meldung=status.meldung,
        details=status.details,
        link=status.link,
        aktion_kind=status.aktion_kind,
        aktion_label=status.aktion_label,
    )


@router.get("/{anlage_id}/komponenten-serien", response_model=list[SerieInfo])
async def get_komponenten_serien(
    anlage_id: int,
    von: date = Query(..., description="Startdatum (inklusiv)"),
    bis: date = Query(..., description="Enddatum (inklusiv)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Löst alle im Zeitraum vorkommenden `komponenten_kwh`-Keys zu SerieInfo
    (Label/Kategorie/Seite) auf.

    Dient der Tagestabelle, die pro Komponente eine eigene Diagnose-Spalte
    mit echtem Investitions-Label statt Roh-Key anbietet.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    if not result.scalar_one_or_none():
        raise not_found("Anlage", anlage_id)

    if (bis - von).days > 366:
        raise bad_request("Zeitraum darf maximal 366 Tage umfassen")

    result = await db.execute(
        select(TagesZusammenfassung.komponenten_kwh)
        .where(and_(
            TagesZusammenfassung.anlage_id == anlage_id,
            TagesZusammenfassung.datum >= von,
            TagesZusammenfassung.datum <= bis,
        ))
    )
    alle_keys: set[str] = set()
    for (komponenten_kwh,) in result.all():
        if komponenten_kwh:
            alle_keys.update(komponenten_kwh.keys())

    # Investments für Label-Auflösung laden
    inv_result = await db.execute(
        select(Investition).where(Investition.anlage_id == anlage_id)
    )
    inv_map: dict[int, Investition] = {
        inv.id: inv for inv in inv_result.scalars().all()
    }

    serien: list[SerieInfo] = []
    for key in sorted(alle_keys):
        info = _key_to_serie_info(key, inv_map)
        if info:
            serien.append(SerieInfo(**info))
    return serien


@router.get("/{anlage_id}/stunden", response_model=StundenAntwort)
async def get_stundenwerte(
    anlage_id: int,
    datum: date = Query(..., description="Tag (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Gibt die 24 Stundenwerte eines Tages aus TagesEnergieProfil zurück.

    Enthält zusätzlich `serien` mit aufgelösten Labels für alle in `komponenten`
    vorkommenden Einträge — damit Sonstiges-Investments (Poolpumpe, Sauna …)
    namentlich im Frontend angezeigt werden können.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    if not result.scalar_one_or_none():
        raise not_found("Anlage", anlage_id)

    result = await db.execute(
        select(TagesEnergieProfil)
        .where(
            TagesEnergieProfil.anlage_id == anlage_id,
            TagesEnergieProfil.datum == datum,
        )
        .order_by(TagesEnergieProfil.stunde)
    )
    rows = result.scalars().all()

    # Investments für Label-Auflösung laden
    inv_result = await db.execute(
        select(Investition).where(Investition.anlage_id == anlage_id)
    )
    inv_map: dict[int, Investition] = {
        inv.id: inv for inv in inv_result.scalars().all()
    }

    # Alle vorkommenden Komponenten-Keys sammeln (über alle Stunden)
    alle_keys: set[str] = set()
    for r in rows:
        if r.komponenten:
            alle_keys.update(r.komponenten.keys())

    # Keys zu SerieInfo auflösen (nur einmal pro Key, geordnet)
    serien: list[SerieInfo] = []
    seen: set[str] = set()
    for key in sorted(alle_keys):
        if key in seen:
            continue
        info = _key_to_serie_info(key, inv_map)
        if info:
            serien.append(SerieInfo(**info))
            seen.add(key)

    # #263/T1 — die Geräte-Sammelspalten kennen BEIDE Pfade.
    #
    # `waermepumpe_kw`/`wallbox_kw` kommen aus dem Zähler-Snapshot und bleiben
    # leer, wenn nur ein Leistungssensor zugeordnet ist — während derselbe Wert
    # in `komponenten` steht, die gerätebenannte Spalte daneben ihn zeigt und
    # der Monats-Modus-Split aus ihm rechnet. Die Auflösung („Zähler schlägt
    # Leistung, kein Key heißt None") liegt im Layer, nicht hier.
    #
    # ⚠ **Bewusst nur die Geräte-Spalten.** `pv_kw` und `verbrauch_kw` sind
    # Bilanzgrößen — an ihnen hängen Performance-Ratio sowie Überschuss/Defizit
    # (`aggregator.py`). Ein Fallback dort änderte die Bilanz, nicht eine
    # Anzeige; das wäre ein eigener Vorgang mit eigener Messung.
    stunden = [
        StundenWertResponse(
            stunde=r.stunde,
            pv_kw=r.pv_kw,
            verbrauch_kw=r.verbrauch_kw,
            einspeisung_kw=r.einspeisung_kw,
            netzbezug_kw=r.netzbezug_kw,
            batterie_kw=r.batterie_kw,
            waermepumpe_kw=geraete_spalte_kw(
                r.waermepumpe_kw, r.komponenten, WAERMEPUMPE_KOMPONENTEN_PREFIXE,
            ),
            wallbox_kw=geraete_spalte_kw(
                r.wallbox_kw, r.komponenten, WALLBOX_KOMPONENTEN_PREFIXE,
            ),
            ueberschuss_kw=r.ueberschuss_kw,
            defizit_kw=r.defizit_kw,
            temperatur_c=r.temperatur_c,
            globalstrahlung_wm2=r.globalstrahlung_wm2,
            soc_prozent=r.soc_prozent,
            komponenten=r.komponenten,
            wp_starts_anzahl=r.wp_starts_anzahl,
            wp_betriebsstunden=r.wp_betriebsstunden,
        )
        for r in rows
    ]

    return StundenAntwort(stunden=stunden, serien=serien)


@router.get("/{anlage_id}/wochenmuster", response_model=list[WochenmusterPunkt])
async def get_wochenmuster(
    anlage_id: int,
    von: date = Query(..., description="Startdatum (inklusiv)"),
    bis: date = Query(..., description="Enddatum (inklusiv)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Gibt durchschnittliche Stundenprofile je Wochentag zurück.

    Aggregiert TagesEnergieProfil-Werte über den Zeitraum und berechnet
    pro Wochentag (0=Mo … 6=So) × Stunde den Mittelwert.
    Basis für den Wochenvergleich-Chart im Energieprofil-Tab.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    if not result.scalar_one_or_none():
        raise not_found("Anlage", anlage_id)

    if (bis - von).days > 366:
        raise bad_request("Zeitraum darf maximal 366 Tage umfassen")

    result = await db.execute(
        select(TagesEnergieProfil)
        .where(
            TagesEnergieProfil.anlage_id == anlage_id,
            TagesEnergieProfil.datum >= von,
            TagesEnergieProfil.datum <= bis,
        )
        .order_by(TagesEnergieProfil.datum, TagesEnergieProfil.stunde)
    )
    rows = result.scalars().all()

    # Aggregation in Python: {(wochentag, stunde) → {field: [values]}}
    # date.weekday(): 0=Mo, 1=Di, …, 6=So
    acc: dict[tuple[int, int], dict[str, list[float]]] = defaultdict(
        lambda: defaultdict(list)
    )
    tage_set: dict[tuple[int, int], set] = defaultdict(set)

    for r in rows:
        wt = r.datum.weekday()
        key = (wt, r.stunde)
        tage_set[key].add(r.datum)
        for field in ("pv_kw", "verbrauch_kw", "netzbezug_kw", "einspeisung_kw", "batterie_kw"):
            val = getattr(r, field)
            if val is not None:
                acc[key][field].append(val)

    punkte: list[WochenmusterPunkt] = []
    for (wt, stunde) in sorted(acc.keys()):
        felder = acc[(wt, stunde)]
        punkte.append(WochenmusterPunkt(
            wochentag=wt,
            stunde=stunde,
            pv_kw=round(sum(felder["pv_kw"]) / len(felder["pv_kw"]), 3) if felder.get("pv_kw") else None,
            verbrauch_kw=round(sum(felder["verbrauch_kw"]) / len(felder["verbrauch_kw"]), 3) if felder.get("verbrauch_kw") else None,
            netzbezug_kw=round(sum(felder["netzbezug_kw"]) / len(felder["netzbezug_kw"]), 3) if felder.get("netzbezug_kw") else None,
            einspeisung_kw=round(sum(felder["einspeisung_kw"]) / len(felder["einspeisung_kw"]), 3) if felder.get("einspeisung_kw") else None,
            batterie_kw=round(sum(felder["batterie_kw"]) / len(felder["batterie_kw"]), 3) if felder.get("batterie_kw") else None,
            anzahl_tage=len(tage_set[(wt, stunde)]),
        ))

    return punkte


@router.get("/{anlage_id}/monat", response_model=MonatsAuswertungResponse)
async def get_monatsauswertung(
    anlage_id: int,
    jahr: int = Query(..., ge=2000, le=2100),
    monat: int = Query(..., ge=1, le=12),
    top_n: int = Query(10, ge=1, le=50, description="Anzahl Peak-Stunden (Netzbezug/Einspeisung)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Monatsauswertung aus TagesEnergieProfil + TagesZusammenfassung.

    Liefert Heatmap-Matrix (Tag × Stunde), KPIs, Peak-Stunden,
    Batterie-Vollzyklen-Summe und Ø Performance Ratio für einen Kalendermonat.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    tage_im_monat = calendar.monthrange(jahr, monat)[1]
    von = date(jahr, monat, 1)
    bis = date(jahr, monat, tage_im_monat)

    # Stundenwerte des Monats laden
    result = await db.execute(
        select(TagesEnergieProfil)
        .where(
            TagesEnergieProfil.anlage_id == anlage_id,
            TagesEnergieProfil.datum >= von,
            TagesEnergieProfil.datum <= bis,
        )
        .order_by(TagesEnergieProfil.datum, TagesEnergieProfil.stunde)
    )
    stunden_rows = result.scalars().all()

    # Tageszusammenfassungen (für Batterie-Zyklen + PR)
    result = await db.execute(
        select(TagesZusammenfassung)
        .where(
            TagesZusammenfassung.anlage_id == anlage_id,
            TagesZusammenfassung.datum >= von,
            TagesZusammenfassung.datum <= bis,
        )
    )
    tag_rows = result.scalars().all()

    # ── Heatmap + Summen aggregieren ──
    heatmap: list[HeatmapZelle] = []
    pv_sum = 0.0
    verbrauch_sum = 0.0
    einspeisung_sum = 0.0
    netzbezug_sum = 0.0
    # Abdeckung je Achse + Paar-Abdeckung der beiden Differenzen (N-92) —
    # dieselbe Rechnung wie in `core/berechnungen/tagesbilanz.py`, weil dieser
    # Endpunkt laut Modul-Docstring dessen NULL-Semantik 1:1 trägt.
    pv_n = verbrauch_n = einspeisung_n = netzbezug_n = 0
    pv_ein_n = verb_netz_n = 0
    ueberschuss_sum = 0.0
    defizit_sum = 0.0
    batt_lade_sum = 0.0
    batt_entlade_sum = 0.0
    direkt_sum = 0.0

    tage_mit_daten: set[date] = set()
    pv_pro_tag: dict[date, float] = defaultdict(float)

    # Für typisches Tagesprofil: Ø pro Stunde
    profil_pv: dict[int, list[float]] = defaultdict(list)
    profil_verbrauch: dict[int, list[float]] = defaultdict(list)
    # Für Grundbedarf: Nachtstunden 0–5 Uhr
    nacht_verbrauch: list[float] = []

    # Datenqualität (Issue #135): Zähle Stunden mit NULL-Werten
    # als Signal an UI, dass kumulativer Zähler fehlt/lückenhaft ist.
    stunden_fehlend_pv = 0
    stunden_fehlend_verbrauch = 0

    # Peaks sammeln — alle Einträge, später sortieren
    netzbezug_kandidaten: list[PeakStunde] = []
    einspeisung_kandidaten: list[PeakStunde] = []
    peak_pv: Optional[PeakStunde] = None

    for r in stunden_rows:
        tage_mit_daten.add(r.datum)

        # NULL-Handling: Stunde ohne gemapptem Zähler → nicht als 0 zählen
        pv = r.pv_kw
        verbrauch = r.verbrauch_kw
        einspeisung = r.einspeisung_kw
        netzbezug = r.netzbezug_kw
        batt = r.batterie_kw

        if pv is None:
            stunden_fehlend_pv += 1
        if verbrauch is None:
            stunden_fehlend_verbrauch += 1

        # Summen: NULL überspringt stillschweigend (statt als 0 zu zählen)
        if pv is not None:
            pv_sum += pv
            pv_pro_tag[r.datum] += pv
            pv_n += 1
        if verbrauch is not None:
            verbrauch_sum += verbrauch
            verbrauch_n += 1
        if einspeisung is not None:
            einspeisung_sum += einspeisung
            einspeisung_n += 1
        if netzbezug is not None:
            netzbezug_sum += netzbezug
            netzbezug_n += 1
        if pv is not None and einspeisung is not None:
            pv_ein_n += 1
        if verbrauch is not None and netzbezug is not None:
            verb_netz_n += 1

        # Überschuss/Defizit + Direkt-Eigenverbrauch nur wenn beide Werte da
        ueberschuss: Optional[float] = None
        if pv is not None and verbrauch is not None:
            ueberschuss = pv - verbrauch
            if ueberschuss > 0:
                ueberschuss_sum += ueberschuss
            else:
                defizit_sum += -ueberschuss
            direkt_sum += min(pv, verbrauch)

        # Batterie getrennt nach Richtung (nur wenn Wert vorhanden)
        if batt is not None:
            if batt < 0:
                batt_lade_sum += -batt
            elif batt > 0:
                batt_entlade_sum += batt

        # Profilsammlung
        if pv is not None:
            profil_pv[r.stunde].append(pv)
        if verbrauch is not None:
            profil_verbrauch[r.stunde].append(verbrauch)
            if 0 <= r.stunde < 5:
                nacht_verbrauch.append(verbrauch)

        heatmap.append(HeatmapZelle(
            tag=r.datum.day,
            stunde=r.stunde,
            pv_kw=round(pv, 3) if pv is not None else None,
            verbrauch_kw=round(verbrauch, 3) if verbrauch is not None else None,
            netzbezug_kw=round(netzbezug, 3) if netzbezug is not None else None,
            einspeisung_kw=round(einspeisung, 3) if einspeisung is not None else None,
            ueberschuss_kw=round(ueberschuss, 3) if ueberschuss is not None else None,
        ))

        if r.netzbezug_kw is not None and r.netzbezug_kw > 0:
            netzbezug_kandidaten.append(PeakStunde(
                datum=r.datum, stunde=r.stunde, wert_kw=round(r.netzbezug_kw, 3),
            ))
        if r.einspeisung_kw is not None and r.einspeisung_kw > 0:
            einspeisung_kandidaten.append(PeakStunde(
                datum=r.datum, stunde=r.stunde, wert_kw=round(r.einspeisung_kw, 3),
            ))
        if r.pv_kw is not None and r.pv_kw > 0:
            if peak_pv is None or r.pv_kw > peak_pv.wert_kw:
                peak_pv = PeakStunde(
                    datum=r.datum, stunde=r.stunde, wert_kw=round(r.pv_kw, 3),
                )

    netzbezug_kandidaten.sort(key=lambda p: p.wert_kw, reverse=True)
    einspeisung_kandidaten.sort(key=lambda p: p.wert_kw, reverse=True)

    # ── KPIs ──
    # Beide Quoten über den Layer-SoT (ADR-001) statt inline: die Formeln standen
    # hier ausgeschrieben und stimmten, aber dieselbe Kennzahl inline zu rechnen
    # ist genau der Weg, auf dem N129 entstanden ist — an der dritten Stelle
    # (Tagesvorschau) wich der Zähler ab, und kein Test sah es.
    #
    # ⚑ **N-92 (2026-08-22): beide Quoten stehen auf einer DIFFERENZ**, und eine
    # Differenz erbt die Unvollständigkeit jedes Summanden
    # (`KONZEPT-UNVOLLSTAENDIGE-WERTE.md` §3 Regel 1). Die Summen darüber
    # überspringen NULL-Stunden korrekt — die Differenz erbte das nicht: fehlten
    # der Einspeisung Stunden und der PV keine, war der Eigenverbrauch um genau
    # die ungemessene Einspeisung zu hoch, und war der Netzbezug **gar nicht**
    # erfasst, meldete die Autarkie **100 %**. Der Zwilling im Tages-Layer trägt
    # die Begründung ausführlich; hier steht dieselbe Regel, damit die beiden
    # Sichten nicht auseinanderlaufen (die N-129-Klasse).
    eigenverbrauch_pv = pv_sum - einspeisung_sum
    ev_abdeckung_gleich = pv_n > 0 and pv_n == einspeisung_n == pv_ein_n
    autarkie_abdeckung_gleich = (
        netzbezug_n > 0 and verbrauch_n == netzbezug_n == verb_netz_n
    )
    autarkie = (
        round(autarkie_prozent(verbrauch_sum - netzbezug_sum, verbrauch_sum), 1)
        if verbrauch_sum > 0 and autarkie_abdeckung_gleich else None
    )
    eigenverbrauch = (
        round(eigenverbrauchsquote_prozent(eigenverbrauch_pv, pv_sum), 1)
        if pv_sum > 0 and ev_abdeckung_gleich else None
    )

    grundbedarf = (
        round(sum(nacht_verbrauch) / len(nacht_verbrauch), 3)
        if nacht_verbrauch else None
    )
    batt_wirkungsgrad = (
        round(batt_entlade_sum / batt_lade_sum, 3)
        if batt_lade_sum > 0.1 else None
    )

    # Tagesverteilung PV
    pv_tage = [v for v in pv_pro_tag.values() if v > 0]
    pv_best = round(max(pv_tage), 2) if pv_tage else None
    pv_schlecht = round(min(pv_tage), 2) if pv_tage else None
    pv_schnitt = round(sum(pv_tage) / len(pv_tage), 2) if pv_tage else None

    # Typisches Tagesprofil (Ø pro Stunde)
    tagesprofil: list[TagesprofilStunde] = []
    for s in range(24):
        pv_werte = profil_pv.get(s, [])
        vb_werte = profil_verbrauch.get(s, [])
        tagesprofil.append(TagesprofilStunde(
            stunde=s,
            pv_kw=round(sum(pv_werte) / len(pv_werte), 3) if pv_werte else None,
            verbrauch_kw=round(sum(vb_werte) / len(vb_werte), 3) if vb_werte else None,
        ))

    # ── Batterie-Vollzyklen + PR + Börsenpreis aus TagesZusammenfassung ──
    zyklen_werte = [t.batterie_vollzyklen for t in tag_rows if t.batterie_vollzyklen is not None]
    zyklen_summe = round(sum(zyklen_werte), 2) if zyklen_werte else None

    pr_werte = [t.performance_ratio for t in tag_rows if t.performance_ratio is not None]
    pr_avg = round(sum(pr_werte) / len(pr_werte), 3) if pr_werte else None
    # A6: der Nenner des Ø gehört mit ausgeliefert — er ist `len(pr_werte)` und
    # NICHT `tage_mit_daten` (das zählt Tage mit irgendwelchen Daten).
    pr_tage = len(pr_werte) if pr_werte else None

    # Börsenpreis / Negativpreis (§51 EEG)
    boersen_werte = [t.boersenpreis_avg_cent for t in tag_rows if t.boersenpreis_avg_cent is not None]
    boersenpreis_avg = round(sum(boersen_werte) / len(boersen_werte), 2) if boersen_werte else None
    neg_stunden_werte = [t.negative_preis_stunden for t in tag_rows if t.negative_preis_stunden is not None]
    neg_stunden_summe = sum(neg_stunden_werte) if neg_stunden_werte else None
    # §51-Menge nur bei Anlagen mit gesetztem Schalter (Gate im Erlös-Service);
    # `negative_preis_stunden` oben bleibt ungegatet — Marktinfo, kein Abzug.
    neg_einsp_werte = [
        w for w in (
            neg_preis_einspeisung_tageswert(anlage, t.einspeisung_neg_preis_kwh)
            for t in tag_rows
        ) if w is not None
    ]
    neg_einsp_summe = round(sum(neg_einsp_werte), 2) if neg_einsp_werte else None

    # ── Per-Komponente Aggregation aus komponenten_kwh ──
    # Investments für Label-Auflösung laden
    inv_result = await db.execute(
        select(Investition).where(Investition.anlage_id == anlage_id)
    )
    inv_map: dict[int, Investition] = {
        inv.id: inv for inv in inv_result.scalars().all()
    }

    komponenten_sum: dict[str, float] = defaultdict(float)
    for t in tag_rows:
        if not t.komponenten_kwh:
            continue
        for k, v in t.komponenten_kwh.items():
            if v is not None:
                komponenten_sum[k] += v

    # Einträge auflösen + Anteile berechnen. Detail-Kategorie-Mapping liegt im
    # Shared-Helper `detail_kategorie` (ADR-001 testbar, #316).
    komponenten_liste: list[KomponentenEintrag] = []
    kategorie_sum: dict[str, float] = defaultdict(float)

    for key, kwh in komponenten_sum.items():
        info = _key_to_serie_info(key, inv_map)
        if not info:
            continue
        inv = None
        m = re.match(r'^[a-z]+_(\d+)(?:_[a-z]+)?$', key)
        if m:
            inv = inv_map.get(int(m.group(1)))
        det_kat = detail_kategorie(info, inv)
        kategorie_sum[det_kat] += kwh
        komponenten_liste.append(KomponentenEintrag(
            key=key,
            label=info["label"],
            kategorie=det_kat,
            typ=info["typ"],
            seite=info["seite"],
            kwh=round(kwh, 2),
            anteil_prozent=None,  # später setzen
        ))

    # Anteile: Erzeuger → vom Gesamt-PV, Senken → vom Gesamt-Verbrauch
    for e in komponenten_liste:
        if e.seite == "quelle" and pv_sum > 0:
            e.anteil_prozent = round(abs(e.kwh) / pv_sum * 100, 1)
        elif e.seite == "senke" and verbrauch_sum > 0:
            e.anteil_prozent = round(abs(e.kwh) / verbrauch_sum * 100, 1)

    # Sortieren: Erzeuger zuerst (absteigend), dann Verbraucher (absteigend nach Betrag)
    komponenten_liste.sort(key=lambda e: (
        0 if e.seite == "quelle" else (1 if e.seite == "senke" else 2),
        -abs(e.kwh),
    ))

    kategorien_liste: list[KategorieSumme] = []
    ERZEUGER_KAT = {k for k, (_, g, _f) in ENERGIE_KATEGORIEN.items() if g == "erzeuger"}
    VERBRAUCHER_KAT = {k for k, (_, g, _f) in ENERGIE_KATEGORIEN.items() if g == "verbraucher"}
    # Bidirektionale Kategorien (speicher, netz) werden nicht als Erzeuger/Verbraucher-KPI ausgewiesen,
    # tauchen aber in der Geräteliste weiter unten auf.
    BIDI_KAT = {"speicher", "netz"}
    for kat, kwh in sorted(kategorie_sum.items(), key=lambda kv: -abs(kv[1])):
        if kat in BIDI_KAT:
            continue
        anteil = None
        if kat in ERZEUGER_KAT and pv_sum > 0:
            anteil = round(abs(kwh) / pv_sum * 100, 1)
        elif kat in VERBRAUCHER_KAT and verbrauch_sum > 0:
            anteil = round(abs(kwh) / verbrauch_sum * 100, 1)
        kategorien_liste.append(KategorieSumme(
            kategorie=kat,
            kwh=round(kwh, 2),
            anteil_prozent=anteil,
        ))

    return MonatsAuswertungResponse(
        jahr=jahr,
        monat=monat,
        tage_im_monat=tage_im_monat,
        tage_mit_daten=len(tage_mit_daten),
        pv_kwh=round(pv_sum, 2),
        verbrauch_kwh=round(verbrauch_sum, 2),
        einspeisung_kwh=round(einspeisung_sum, 2),
        netzbezug_kwh=round(netzbezug_sum, 2),
        ueberschuss_kwh=round(ueberschuss_sum, 2),
        defizit_kwh=round(defizit_sum, 2),
        autarkie_prozent=autarkie,
        eigenverbrauch_prozent=eigenverbrauch,
        performance_ratio_avg=pr_avg,
        performance_ratio_tage=pr_tage,
        batterie_vollzyklen_summe=zyklen_summe,
        grundbedarf_kw=grundbedarf,
        batterie_ladung_kwh=round(batt_lade_sum, 2) if batt_lade_sum > 0 else None,
        batterie_entladung_kwh=round(batt_entlade_sum, 2) if batt_entlade_sum > 0 else None,
        batterie_wirkungsgrad=batt_wirkungsgrad,
        direkt_eigenverbrauch_kwh=round(direkt_sum, 2) if direkt_sum > 0 else None,
        pv_tag_best_kwh=pv_best,
        pv_tag_schnitt_kwh=pv_schnitt,
        pv_tag_schlecht_kwh=pv_schlecht,
        typisches_tagesprofil=tagesprofil,
        kategorien=kategorien_liste,
        komponenten=komponenten_liste,
        peak_netzbezug=netzbezug_kandidaten[:top_n],
        peak_einspeisung=einspeisung_kandidaten[:top_n],
        peak_pv=peak_pv,
        heatmap=heatmap,
        boersenpreis_avg_cent=boersenpreis_avg,
        negative_preis_stunden=neg_stunden_summe,
        einspeisung_neg_preis_kwh=neg_einsp_summe,
        stunden_fehlend_pv=stunden_fehlend_pv,
        stunden_fehlend_verbrauch=stunden_fehlend_verbrauch,
    )


# ── Debug + Diagnose-Endpoints ───────────────────────────────────────────────

@router.get("/{anlage_id}/debug-rohdaten")
async def get_debug_rohdaten(
    anlage_id: int,
    tage: int = Query(7, ge=1, le=30, description="Anzahl Tage zurück"),
    db: AsyncSession = Depends(get_db),
):
    """
    Gibt TagesEnergieProfil-Rohdaten zurück (für Diagnose falsch gespeicherter Werte).

    Zeigt pv_kw, verbrauch_kw, netzbezug_kw, einspeisung_kw pro Stunde + Datum.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    if not result.scalar_one_or_none():
        raise not_found("Anlage")

    start = date.today() - timedelta(days=tage)

    rows_result = await db.execute(
        select(TagesEnergieProfil).where(
            TagesEnergieProfil.anlage_id == anlage_id,
            TagesEnergieProfil.datum >= start,
        ).order_by(TagesEnergieProfil.datum, TagesEnergieProfil.stunde)
    )
    rows = rows_result.scalars().all()

    alle_verbrauch = [r.verbrauch_kw for r in rows if r.verbrauch_kw is not None]
    median_verbrauch = None
    if alle_verbrauch:
        sv = sorted(alle_verbrauch)
        median_verbrauch = sv[len(sv) // 2]

    return {
        "anlage_id": anlage_id,
        "anzahl_zeilen": len(rows),
        "median_verbrauch_kw": median_verbrauch,
        "plausibel": median_verbrauch is None or median_verbrauch <= 100,
        "zeilen": [
            {
                "datum": r.datum.isoformat(),
                "stunde": r.stunde,
                "pv_kw": r.pv_kw,
                "verbrauch_kw": r.verbrauch_kw,
                "netzbezug_kw": r.netzbezug_kw,
                "einspeisung_kw": r.einspeisung_kw,
                "batterie_kw": r.batterie_kw,
                "waermepumpe_kw": r.waermepumpe_kw,
            }
            for r in rows
        ],
    }


@router.get("/{anlage_id}/verfuegbare-monate")
async def verfuegbare_monate(
    anlage_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Liefert alle Jahr/Monat-Kombinationen mit TagesZusammenfassung-Einträgen.

    Für Jahr-/Monats-Selektoren, die nur Werte mit Daten anbieten sollen.
    Sortierung: neueste zuerst.
    """
    from sqlalchemy import func

    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    jahr = func.extract("year", TagesZusammenfassung.datum)
    monat = func.extract("month", TagesZusammenfassung.datum)
    rows = (await db.execute(
        select(jahr.label("jahr"), monat.label("monat"), func.count().label("tage"))
        .where(TagesZusammenfassung.anlage_id == anlage_id)
        .group_by(jahr, monat)
        .order_by(jahr.desc(), monat.desc())
    )).all()

    return [
        {"jahr": int(r.jahr), "monat": int(r.monat), "tage": int(r.tage)}
        for r in rows
    ]


@router.get("/{anlage_id}/stats")
async def get_anlage_stats(
    anlage_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Anlage-spezifische Profildaten-Statistik für die Energieprofil-Seite.

    Zählt Stundenwerte, Tageszusammenfassungen und Monatsdaten nur für diese
    Anlage und liefert den Abdeckungs-Zeitraum aus TagesZusammenfassung.
    """
    from sqlalchemy import func
    from backend.models.monatsdaten import Monatsdaten

    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    stundenwerte = await db.scalar(
        select(func.count(TagesEnergieProfil.id)).where(TagesEnergieProfil.anlage_id == anlage_id)
    ) or 0
    tageszusammenfassungen = await db.scalar(
        select(func.count(TagesZusammenfassung.id)).where(TagesZusammenfassung.anlage_id == anlage_id)
    ) or 0
    monatswerte = await db.scalar(
        select(func.count(Monatsdaten.id)).where(Monatsdaten.anlage_id == anlage_id)
    ) or 0

    zeitraum = None
    if tageszusammenfassungen > 0:
        row = (await db.execute(
            select(
                func.min(TagesZusammenfassung.datum),
                func.max(TagesZusammenfassung.datum),
                func.count(func.distinct(TagesZusammenfassung.datum)),
            ).where(TagesZusammenfassung.anlage_id == anlage_id)
        )).one()
        von_datum, bis_datum, tage_mit_daten = row
        if von_datum:
            tage_gesamt = (bis_datum - von_datum).days + 1
            zeitraum = {
                "von": von_datum.isoformat(),
                "bis": bis_datum.isoformat(),
                "tage_mit_daten": tage_mit_daten,
                "tage_gesamt": tage_gesamt,
                "abdeckung_prozent": round(tage_mit_daten / tage_gesamt * 100, 1) if tage_gesamt > 0 else 0,
            }

    return {
        "stundenwerte": int(stundenwerte),
        "tageszusammenfassungen": int(tageszusammenfassungen),
        "monatswerte": int(monatswerte),
        "zeitraum": zeitraum,
        "wachstum_pro_monat": 750,  # 24h + 1 Tagessumme × 30 Tage
    }


@router.get("/{anlage_id}/reaggregate-tag/preview", response_model=ReaggregatePreviewResponse)
async def reaggregate_tag_preview(
    anlage_id: int,
    datum: date = Query(..., description="Tag, fuer den die Vorschau erzeugt werden soll"),
    db: AsyncSession = Depends(get_db),
):
    """
    Liefert eine alt/neu-Vergleichstabelle der Snapshot-Werte und Slot-Deltas,
    die ein Reload des Tages produzieren WÜRDE — ohne irgendetwas zu schreiben.

    Damit der Nutzer vor der Übernahme sieht, welche Werte aus HA kommen und
    wie sich die Tagesbilanz ändert. Erst nach manueller Bestätigung
    (`POST /reaggregate-tag`) werden die Werte tatsächlich übernommen.

    Range: Vortag 23:00 .. Folgetag 00:00 (25 Boundaries pro Counter, 24 Slots).
    Slot 0 = snap(Tag 00:00) − snap(Vortag 23:00). Damit ist die Slot-0-
    Boundary in der Tabelle sichtbar — der ehemalige Hauptverdächtige für
    persistente Counter-Spikes (Befund Rainer 1.5.2026).
    """
    from backend.services.sensor_snapshot_service import get_reaggregate_preview

    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    inv_result = await db.execute(
        select(Investition).where(Investition.anlage_id == anlage_id)
    )
    invs_by_id = {str(inv.id): inv for inv in inv_result.scalars().all()}

    try:
        preview = await get_reaggregate_preview(db, anlage, invs_by_id, datum)
    except Exception as e:
        logger.error(
            f"Reaggregate-Preview Anlage {anlage_id} {datum}: {type(e).__name__}: {e}"
        )
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

    return ReaggregatePreviewResponse(
        datum=datum.isoformat(),
        boundaries=[
            ReaggregatePreviewBoundary(
                sensor_key=b["sensor_key"],
                kategorie=b["kategorie"],
                zeitpunkt=b["zeitpunkt"].isoformat(),
                alt_kwh=b["alt_kwh"],
                neu_kwh=b["neu_kwh"],
            )
            for b in preview["boundaries"]
        ],
        slot_deltas=[
            ReaggregatePreviewSlot(
                stunde=s["stunde"],
                kategorie=s["kategorie"],
                alt_kwh=s["alt_kwh"],
                neu_kwh=s["neu_kwh"],
            )
            for s in preview["slot_deltas"]
        ],
        tagesumme_alt=preview["tagesumme_alt"],
        tagesumme_neu=preview["tagesumme_neu"],
        ha_verfuegbar=preview["ha_verfuegbar"],
        counter_tagesdelta=[
            ReaggregatePreviewCounterTagesdelta(
                feld=c["feld"],
                alt=c["alt"],
                neu=c["neu"],
            )
            for c in preview.get("counter_tagesdelta", [])
        ],
    )


@router.get("/{anlage_id}/kraftstoffpreis-status")
async def kraftstoffpreis_status(
    anlage_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Liefert die Anzahl offener Zeilen ohne Kraftstoffpreis für die UI-Sichtbarkeit.
    """
    from sqlalchemy import func
    from backend.models.monatsdaten import Monatsdaten

    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    tages_offen = await db.scalar(
        select(func.count(TagesZusammenfassung.id)).where(
            TagesZusammenfassung.anlage_id == anlage_id,
            TagesZusammenfassung.kraftstoffpreis_euro.is_(None),
        )
    )
    monats_offen = await db.scalar(
        select(func.count(Monatsdaten.id)).where(
            Monatsdaten.anlage_id == anlage_id,
            Monatsdaten.kraftstoffpreis_euro.is_(None),
        )
    )
    return {
        "tages_offen": int(tages_offen or 0),
        "monats_offen": int(monats_offen or 0),
        "land": anlage.standort_land or "DE",
    }


# ── Tagesprognose (Etappe 3b) ──────────────────────────────────────────────


async def _pv_stunden_aus_kanon(db, anlage, datum: date) -> Optional[list[float]]:
    """Korrigierte 24 kWh-Slots des Zieltages aus dem Prognose-Kanon.

    ``None`` = der Kanon hat für diesen Tag kein Stundenprofil (kein Abruf,
    kein Treffer, Schätzpfad ohne Hourly) → der Aufrufer nutzt seinen Fallback.

    Warum überhaupt: der frühere Eigenweg holte OpenMeteo mit **einem** Abruf
    für die Gesamt-kWp und der Orientierung der zufällig ersten Investition
    (kein ``ORDER BY``) und multiplizierte den flachen Legacy-Skalar darauf.
    Beides weicht vom Kanon ab (Multi-String-Fan-out + Kaskade pro Energie-Slot)
    — dieselbe Anlage bekam so je nach Pfad verschiedene Tagessummen.

    ``days`` kommt aus ``kanon_days`` (Horizont-Formel-SoT, geteilt mit
    ``/solar-prognose``): mindestens 4, für spätere Zieltage aus dem Datum
    abgeleitet — der Picker erlaubt +14 Tage, also ``days`` ≤ 15 (OpenMeteo-
    Maximum 16). Dass dabei derselbe OpenMeteo-Snapshot gezogen wird wie im
    Prognosen-Vergleich und im HA-/MQTT-Export, hängt seit E15/A29 nicht mehr
    an diesem Horizont: der Cache-Key trägt den Modell-Snapshot, nicht die
    Anfrage (``services/wetter/cache.snapshot_days``).
    """
    tage_bis_ziel = (datum - date.today()).days
    if tage_bis_ziel < 0:
        return None

    from backend.services.prognose_kanon import kanon_days, kanon_tagesprognose

    try:
        kanon = await kanon_tagesprognose(
            db, anlage,
            days=kanon_days(tage_bis_ziel + 1),
            # Interaktiver User-Request: der 1-30s-Random-Jitter gilt nur für
            # Hintergrund-Abrufe (R18-13).
            skip_jitter=True,
        )
    except Exception as e:
        logger.warning("Kanon-Tagesprognose fehlgeschlagen: %s", e)
        return None
    if not kanon:
        return None

    ziel_iso = datum.isoformat()
    for tag in kanon.tage:
        if tag is not None and tag.datum == ziel_iso and tag.profil is not None:
            # Export-Slots (2 NK) — exakt die Werte, die auch als MQTT-Attribut
            # `stundenprofil_kwh` rausgehen. Damit gilt die Kanon-Invariante
            # `Tageswert == Σ Export-Slots` auch für die Summenzeile hier.
            return list(tag.profil.stundenprofil_export_kwh)
    return None


@router.get("/{anlage_id}/tagesprognose", response_model=TagesPrognoseResponse)
async def get_tagesprognose(
    anlage_id: int,
    datum: Optional[date] = Query(
        default=None,
        description="Ziel-Datum (Default: morgen)"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Kombinierte Tagesprognose: Verbrauch + PV + Batterie-Simulation.

    Berechnet für einen Tag (Standard: morgen):
    - Verbrauchsprofil aus historischen Stundenmitteln (Wochenmuster-Basis)
    - PV-Stundenprofil aus Solar Forecast (OpenMeteo GTI oder Solcast)
    - Netto-Bilanz und optionale Batterie-SoC-Simulation

    **Ohne Verbrauchshistorie** (< 3 vollständige Tage Energieprofil, also jede
    frische Installation) liefert die Route trotzdem die PV-Hälfte — sie hängt
    nur an Wetterdienst und kWp. Die verbrauchsabhängigen Felder sind dann
    ``None`` (nicht 0, das sähe aus wie ein Messwert) und ``hinweise`` sagt es.
    Bis A28 (N122) stand hier ein HTTP 422 für den GANZEN Endpoint.
    """
    if datum is None:
        datum = date.today() + timedelta(days=1)

    # Anlage laden
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage", anlage_id)

    if not anlage.latitude or not anlage.longitude:
        raise HTTPException(status_code=400, detail="Anlage hat keine Koordinaten konfiguriert")

    # `hinweise` begleitet die Antwort: jede Abweichung von „das ist die volle
    # Prognose für DIESEN Tag" wird hier vermerkt und geht in die Response (P4).
    hinweise: list[str] = []

    # ── 1. Verbrauchsprognose ──
    from backend.services.verbrauch_prognose_service import get_verbrauch_prognose

    vp = await get_verbrauch_prognose(anlage_id, datum, db)
    verbrauch_stunden = vp["stunden_kw"] if vp else None
    if vp is None:
        # A28 (N122): hier stand ein HTTP 422 für den ganzen Endpoint — die
        # PV-Stundenwerte fielen mit, obwohl sie keine Historie brauchen. Jede
        # frische Installation sah in den ersten Tagen deshalb nur eine
        # Fehlermeldung statt der PV-Vorschau. Der fehlende Teil wird jetzt
        # benannt (P4), statt die ganze Antwort zu verweigern.
        hinweise.append(
            "Für die Verbrauchsprognose fehlt noch die Historie — dafür braucht "
            "eedc mindestens 3 vollständige Tage Energieprofil. Gezeigt wird "
            "deshalb nur die PV-Vorschau; Verbrauch, Netzbezug, Einspeisung, "
            "Eigenverbrauch, Autarkie und die Speicher-Vorschau bleiben leer, "
            "bis genug Tage aufgezeichnet sind."
        )

    # ── 2. PV-Stundenprofil ──
    pv_stunden = [0.0] * 24
    pv_quelle = "openmeteo"
    pv_profil_vorhanden = False

    # Versuche Solcast zuerst (wenn als Quelle gewählt)
    from backend.services.prognose_router import resolve_prognose_quelle
    pq = resolve_prognose_quelle(anlage)

    if pq.ist_solcast:
        try:
            from backend.services.solcast_service import get_solcast_forecast
            solcast = await get_solcast_forecast(anlage)
            # Seit #357 trägt Solcast ein eigenes Stundenprofil je Prognosetag
            # (HA-Integration: `detailedForecast` am Tages-Sensor; API: 168 h).
            # Wo es eins gibt, ist der Zieltag echt beantwortet — die Näherung
            # samt Kennzeichnung bleibt nur für Tage ohne eigenes Profil.
            tages_profil = solcast.profil_fuer(datum) if solcast else None
            if tages_profil is not None:
                pv_stunden = list(tages_profil.p50)
                pv_quelle = "solcast"
                pv_profil_vorhanden = True
            elif solcast and solcast.hourly_kw and len(solcast.hourly_kw) == 24:
                # `solcast.hourly_kw` ist das Stundenprofil von HEUTE. Für einen
                # anderen Zieltag ist es eine Näherung — bisher stand das nur als
                # Code-Kommentar, während die Antwort `pv_quelle = "solcast"`
                # meldete wie bei einem echten Profil dieses Tages (N79). Der Wert
                # bleibt (er ist die beste verfügbare Information), aber die
                # Antwort sagt jetzt, worauf man sieht.
                pv_stunden = list(solcast.hourly_kw)
                pv_quelle = "solcast"
                pv_profil_vorhanden = True
                if datum != date.today():
                    hinweise.append(
                        "Solcast liefert für diesen Tag nur die Tagesmenge, kein "
                        "eigenes Stundenprofil. Der Tagesverlauf ist deshalb das "
                        "heutige Profil als Näherung für den "
                        f"{datum.strftime('%d.%m.%Y')} — die Tagessumme kann "
                        "abweichen."
                    )
        except Exception as e:
            logger.warning("Solcast für Tagesprognose fehlgeschlagen: %s", e)
            hinweise.append(
                "Die Solcast-Prognose war nicht abrufbar; für den PV-Tagesverlauf "
                "liegt keine Solcast-Quelle vor."
            )

    # Fallback: OpenMeteo GTI — kanonischer Weg zuerst (Multi-String-Fan-out +
    # Korrektur pro Energie-Slot), damit Chart/Tabelle denselben Tag zeigen wie
    # Prognosen-Vergleich und HA-/MQTT-Export.
    kanon_stunden = (
        await _pv_stunden_aus_kanon(db, anlage, datum)
        if pv_quelle == "openmeteo" else None
    )
    if kanon_stunden is not None:
        pv_stunden = kanon_stunden
        pv_profil_vorhanden = True
    elif pv_quelle == "openmeteo":
        # Fallback (Kanon ohne Ergebnis: kein OpenMeteo, keine kWp, Zieltag
        # jenseits des Abrufs): eigener Abruf-Pfad, damit die Prognose nicht
        # ganz ausfällt. Seit `49954860` (P1/N51) fächert er wie der Kanon je
        # Orientierungsgruppe auf; was bleibt, ist der flache Legacy-Skalar
        # (`_get_lernfaktor`) statt der Kaskade pro Energie-Slot — deshalb
        # kann seine Tagessumme weiter leicht vom Kanon abweichen.
        try:
            from backend.services.solar_forecast_service import get_solar_prognose

            # Strings für Multi-Ausrichtung laden
            inv_result = await db.execute(
                select(Investition).where(
                    Investition.anlage_id == anlage_id,
                    Investition.typ.in_(["pv-module", "balkonkraftwerk"]),
                    Investition.aktiv.is_(True),
                )
            )
            invs = inv_result.scalars().all()
            # Nur aktive (nicht stillgelegte) Investitionen
            aktive_invs = [
                inv for inv in invs
                if not inv.stilllegungsdatum or inv.stilllegungsdatum >= datum
            ]

            if aktive_invs:
                # Einheitlich kWp + Neigung + Azimut aus Top-Level-Spalten ODER
                # parameter-JSON lesen — je nachdem, wo das Formular die Werte
                # gespeichert hat. Ohne den Helper fallen Prognose-Pfade stumm
                # auf Neigung=35°/Azimut=0° zurück, wenn die Werte nur in den
                # Top-Level-Spalten (Investition.neigung_grad, .ausrichtung)
                # liegen statt im parameter-JSON.
                from backend.services.pv_orientation import (
                    orientierungs_gruppen, resolve_system_losses,
                )
                from backend.services.prognose_auswahl import lade_aktive_prognose

                # P1 (N51): EIN Abruf je Orientierungsgruppe statt eines Abrufs
                # über die Gesamt-kWp mit der Orientierung der zufällig ersten
                # Investition (`aktive_invs[0]`, Query ohne `ORDER BY`). Eine
                # Ost/West-Anlage bekam so den Tagesgang EINER Himmelsrichtung
                # auf die volle Leistung gerechnet — bei ausgeglichener
                # Verteilung ein Fehler in der Summenzeile, der sich NICHT
                # herausmittelt. Der Kanon-Pfad darüber fächert längst auf; hier
                # lief der Fallback als einzige Sicht daneben.
                # Bei genau EINER Gruppe ist der eine Abruf die korrekte Form —
                # dann ist bewiesen, dass alle Module dieselbe Orientierung
                # haben (dieselbe Guard-Form wie prefetch_service/solar_prognose).
                gruppen = orientierungs_gruppen(aktive_invs)

                # system_losses aus aktuellem PVGIS-Eintrag (gleicher Pfad wie
                # solar_prognose.py und prefetch_service.py). Es gibt KEIN
                # system_losses-Attribut auf Anlage — der frühere Zugriff
                # `anlage.system_losses` warf einen AttributeError, der im
                # try/except geschluckt wurde und pv_stunden auf [0] * 24 ließ.
                pvgis = await lade_aktive_prognose(db, anlage_id)
                system_losses = resolve_system_losses(pvgis)

                # Tage bis zum Zieldatum berechnen
                tage_bis_ziel = (datum - date.today()).days
                forecast_days = max(tage_bis_ziel + 1, 2)

                ergebnisse = await asyncio.gather(*[
                    get_solar_prognose(
                        latitude=anlage.latitude,
                        longitude=anlage.longitude,
                        kwp=g.kwp,
                        neigung=g.neigung,
                        ausrichtung=g.ausrichtung,
                        days=forecast_days,
                        system_losses=system_losses,
                        # Interaktiver User-Request (Stunden-/Tagesprognose der
                        # Aussicht): der 1-30s-Random-Jitter gilt nur für
                        # Hintergrund-Abrufe (R18-13).
                        skip_jitter=True,
                    )
                    for g in gruppen
                ])

                ziel_str = datum.isoformat()
                summe = [0.0] * 24
                geliefert = 0
                for prognose in ergebnisse:
                    if not prognose:
                        continue
                    for tag in prognose.tageswerte:
                        if tag.datum == ziel_str and tag.stunden_kw:
                            for i, v in enumerate(tag.stunden_kw[:24]):
                                summe[i] += v or 0.0
                            geliefert += 1
                            break

                if geliefert:
                    pv_stunden = [round(v, 3) for v in summe]
                    pv_profil_vorhanden = True

                    # P4: eine Teilsumme sagt es selbst. Fällt eine
                    # Orientierungsgruppe aus, fehlt ihr kWp-Anteil im
                    # Tagesverlauf — der Wert bleibt (beste verfügbare
                    # Information), aber nicht ungekennzeichnet.
                    if geliefert < len(gruppen):
                        hinweise.append(
                            f"Nur {geliefert} von {len(gruppen)} Dachflächen "
                            "(Orientierungsgruppen) haben eine Prognose geliefert. "
                            "Der PV-Tagesverlauf ist deshalb eine Teilsumme und zu "
                            "niedrig — bitte später erneut laden."
                        )

                    # Lernfaktor anwenden (MOS-Kaskade)
                    from backend.api.routes.live_wetter import _get_lernfaktor
                    lernfaktor = await _get_lernfaktor(anlage_id, db)
                    if lernfaktor is not None:
                        pv_stunden = [round(v * lernfaktor, 3) for v in pv_stunden]

        except Exception as e:
            logger.warning("PV-Prognose für Tagesprognose fehlgeschlagen: %s", e)

    # P4 (N78): Bis hierher konnte die Antwort mit der Vorbelegung `[0.0] * 24`
    # herauskommen — als PV-Prognose „0 kWh", nicht als „keine Prognose". Die
    # Speicher-Simulation unten rechnet mit diesen Nullen weiter und meldet dann
    # „Speicher lädt nicht". Die Zahlen bleiben (kein geschätzter Ersatz), aber
    # die Antwort sagt jetzt, dass sie keine Prognose sind.
    if not pv_profil_vorhanden:
        hinweise.append(
            "Für diesen Tag liegt keine PV-Prognose vor — der Wetterabruf ist "
            "ausgefallen oder der Tag liegt außerhalb des Prognose-Horizonts. Die "
            "PV-Werte im Verlauf sind deshalb 0 und bedeuten NICHT, dass die "
            "Anlage nichts erzeugt; auch die Speicher-Vorschau darunter ist damit "
            "ohne Aussage."
        )

    # ── 3. Batterie-Info laden ──
    inv_result = await db.execute(
        select(Investition).where(
            Investition.anlage_id == anlage_id,
            Investition.typ == InvestitionTyp.SPEICHER.value,
            Investition.aktiv.is_(True),
        )
    )
    speicher_invs = [
        inv for inv in inv_result.scalars().all()
        if not inv.stilllegungsdatum or inv.stilllegungsdatum >= datum
    ]

    # A31-2/E-1: NETTO-Kapazität. Die Simulation unten fährt den Speicher von
    # 0 auf 100 % der übergebenen Zahl; mit der Brutto-Kapazität ist er
    # rechnerisch später voll als real. Stiller Brutto-Fallback (E17) — bei
    # ungepflegtem Netto-Feld bleibt alles wie bisher, deshalb hier bewusst
    # KEIN `hinweise`-Eintrag.
    # N-238: Kapazität UND Wirkungsgrad über den geteilten Helper — der
    # HA-Sensor `eedc_speicher_voll_um` liest dieselbe Regel, und zwei
    # gleichlautende Faltungen wären genau die Drift-Klasse dieses Projekts.
    speicher_kap, speicher_eta = aggregiere_speicher_basis(speicher_invs)
    speicher_kap = speicher_kap or 0.0

    # Start-SoC: Ø SoC um Mitternacht der letzten 7 Tage
    start_soc = 50.0  # Default
    if speicher_kap > 0:
        soc_result = await db.execute(
            select(TagesEnergieProfil.soc_prozent)
            .where(
                TagesEnergieProfil.anlage_id == anlage_id,
                TagesEnergieProfil.datum >= datum - timedelta(days=7),
                TagesEnergieProfil.datum < datum,
                TagesEnergieProfil.stunde == 0,
                TagesEnergieProfil.soc_prozent.isnot(None),
            )
            .order_by(TagesEnergieProfil.datum.desc())
        )
        soc_werte = [r for r in soc_result.scalars().all()]
        if soc_werte:
            start_soc = sum(soc_werte) / len(soc_werte)

    # ── 4. Stündliche Bilanz + Batterie-Simulation ──
    # SoC-State-Machine + Bilanz-Rest liegen im Berechnungs-Layer (ADR-001).
    # Diese deskriptive Ganztags-Vorschau simuliert ab Mitternacht (start_soc =
    # 7-Tage-Mittel, start_stunde=0) — bewusst anders parametrisiert als der
    # HA-Export (ab aktuellem SoC), daher kein Symmetrie-Paar.
    stunden: list[StundenPrognose] = []
    sum_pv = 0.0
    sum_verbrauch: Optional[float] = None
    sum_netzbezug: Optional[float] = None
    sum_einspeisung: Optional[float] = None
    eigenverbrauch: Optional[float] = None
    autarkie: Optional[float] = None
    speicher_voll_um: Optional[str] = None
    speicher_leer_um: Optional[str] = None

    if verbrauch_stunden is None:
        # A28: ohne Verbrauchsprofil ist jede Bilanzgröße unbestimmt — die
        # Simulation liefe zwar durch (sie liest fehlende Slots als 0), würde
        # dann aber „Netzbezug 0, Autarkie 100 %" behaupten. Also gar nicht
        # rechnen und die Felder leer lassen (P4); das PV-Profil bleibt.
        sum_pv = sum(pv_stunden[:24])
        stunden = [
            StundenPrognose(
                stunde=h,
                pv_kw=round(pv_stunden[h] if h < len(pv_stunden) else 0.0, 3),
            )
            for h in range(24)
        ]
    else:
        sim = simuliere_speicher_tag(
            pv_stunden=pv_stunden,
            verbrauch_stunden=verbrauch_stunden,
            speicher_kap_kwh=speicher_kap,
            start_soc_prozent=start_soc,
            start_stunde=0,
            wirkungsgrad_prozent=speicher_eta,
        )
        speicher_voll_um = sim.speicher_voll_um
        speicher_leer_um = sim.speicher_leer_um

        sum_verbrauch = 0.0
        sum_netzbezug = 0.0
        sum_einspeisung = 0.0

        for b in sim.stunden_bilanz:
            sum_pv += b.pv_kwh
            sum_verbrauch += b.verbrauch_kwh
            sum_netzbezug += b.netzbezug_kwh
            sum_einspeisung += b.einspeisung_kwh

            stunden.append(StundenPrognose(
                stunde=b.stunde,
                pv_kw=round(b.pv_kwh, 3),
                verbrauch_kw=round(b.verbrauch_kwh, 3),
                netto_kw=round(b.netto_kwh, 3),
                netzbezug_kw=round(b.netzbezug_kwh, 3),
                einspeisung_kw=round(b.einspeisung_kwh, 3),
                soc_prozent=b.soc_prozent,
            ))

        # `eigenverbrauch` ist der PV-Eigenverbrauch (was die Anlage selbst nutzt,
        # inklusive der Speicherladung) — dieselbe Größe wie in
        # `core/berechnungen/tagesbilanz.py`, deshalb gleich benannt.
        eigenverbrauch = sum_pv - sum_einspeisung
        # N129: die Autarkie hat einen ANDEREN Zähler — den netzunabhängig
        # gedeckten Verbrauch. Bis 2026-07-28 stand hier der PV-Eigenverbrauch,
        # und weil der bei ladendem Speicher den Tagesverbrauch übersteigen kann,
        # meldete die Vorschau Autarkiegrade bis 125 %. Der Layer-SoT
        # (`kennzahlen.autarkie_prozent`) verzichtet ausdrücklich auf einen Cap
        # mit der Begründung „strukturell ≤ 100 %, weil Eigenverbrauch Teilmenge
        # des Gesamtverbrauchs ist" — diese Zusicherung gilt nur für den
        # richtigen Zähler. Ein Cap wäre hier die falsche Antwort gewesen: er
        # hätte 125 % auf 100 % gedrückt und den Fehler unsichtbar gemacht,
        # statt ihn zu beheben (ADR-001: Formel im Layer, nicht inline).
        autarkie = (
            autarkie_prozent(sum_verbrauch - sum_netzbezug, sum_verbrauch)
            if sum_verbrauch > 0 else 0.0
        )

    return TagesPrognoseResponse(
        datum=datum.isoformat(),
        stunden=stunden,
        pv_summe_kwh=round(sum_pv, 2),
        verbrauch_summe_kwh=round(sum_verbrauch, 2) if sum_verbrauch is not None else None,
        netzbezug_summe_kwh=round(sum_netzbezug, 2) if sum_netzbezug is not None else None,
        einspeisung_summe_kwh=round(sum_einspeisung, 2) if sum_einspeisung is not None else None,
        eigenverbrauch_kwh=round(eigenverbrauch, 2) if eigenverbrauch is not None else None,
        autarkie_prozent=round(autarkie, 1) if autarkie is not None else None,
        speicher_kapazitaet_kwh=round(speicher_kap, 1) if speicher_kap > 0 else None,
        speicher_voll_um=speicher_voll_um,
        speicher_leer_um=speicher_leer_um,
        verbrauch_basis=vp["basis"] if vp else None,
        pv_quelle=pv_quelle,
        daten_tage=vp["daten_tage"] if vp else None,
        hinweise=hinweise,
    )
