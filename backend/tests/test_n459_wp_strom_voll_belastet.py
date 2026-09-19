"""**N-459 / SOLL Wärme/Klima S1b** — der Strom einer Wärmepumpe wird in jeder
Geld- und CO₂-Rechnung **voll** belastet.

Ihr PV-Anteil senkt weder ihre Stromkosten noch ihre Emission — er ist auf der
PV-Seite gutgeschrieben: als Eigenverbrauch (Geld) und als vermiedener Netzstrom
(CO₂). Ihn in der Wärmepumpen-Rechnung ein zweites Mal abzuziehen zählte
dieselbe Kilowattstunde doppelt (**ADR-002/P9**). Das Feld „PV-Anteil (%)" am
Gerät beantwortet eine **Mengenfrage** und speist genau zwei Stellen: den
Eigenverbrauchs-Fallback der Prognose (N-277) und die Zuordnung des
Eigenverbrauchs auf das Gerät (N-354). Es beantwortet **keine Preisfrage**.

**Was hier vorher stand — vier Bildungsvorschriften für eine Größe** (gemessen
13.09.2026 an HEAD `453409d8`):

| Stelle | PV-Abschlag bis 13.09. |
| --- | --- |
| `api/routes/aussichten/finanz_prognose.py` (Jahresformel/Prognose) | fest **50 %** |
| `core/berechnungen/alternativkosten.py` (Historie, HA-Export, ROI-Fortschritt) | fest **50 %** |
| `services/wp_wirtschaftlichkeit.py` (Monats-Layer: Hub, Cockpit, Sensor je WP) | **0 %** |
| `core/calculations.py::berechne_waermepumpe_einsparung` (ROI-Zeile, Geld **und** CO₂) | **Anteil des Geräts** |

Die Konstante `WP_PV_ANTEIL_DEFAULT` ist ersatzlos gelöscht, der Parameter
`pv_anteil_prozent` aus der ROI-Formel entfernt. Es gibt **keine neue Lesetür
und keinen neuen Wächter**: nach dem Bau existiert nur noch eine
Bildungsvorschrift, es kann nichts mehr driften.

⚠ **Diese Proben sind Regressionen, keine Wächter** — sie schützen die
namentlich aufgerufenen Stellen, nicht eine Stelle, die es heute noch nicht
gibt (ADR-002, Spalte „gesichert durch").
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.aktueller_monat import get_aktueller_monat
from backend.api.routes.aussichten import get_finanz_prognose
from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht
from backend.api.routes.ha_export import calculate_investition_sensors
from backend.api.routes.investitionen.crud import get_roi_dashboard
from backend.api.routes.investitionen.dashboards import get_waermepumpe_dashboard
from backend.core.berechnungen.alternativkosten import (
    berechne_wp_alternativkosten_ersparnis,
)
from backend.core.calculations import CO2_FAKTOR_STROM_KG_KWH, co2_wp_ersparnis_kg
from backend.models import Anlage, Investition, Monatsdaten, Strompreis
from backend.models.investition import InvestitionMonatsdaten

# ── Die Fixture von K1, in einer Zeile nachrechenbar ────────────────────────
#
#   Ein Monat (2025-01), eine Gas-Wärmepumpe, keine Zusatzkosten:
#     thermisch   = 2.400 (Heiz) + 600 (WW)      = 3.000 kWh
#     WP-Strom                                   = 1.000 kWh
#     Netzbezug 30 ct  ·  Gaspreis 12 ct  ·  η_gas 0,90
#
#     alte Kosten = 3.000 / 0,90 × 12 / 100      =   400,00 €
#     WP-Kosten   = 1.000 × 30 / 100             =   300,00 €   ← der Term
#     Ersparnis   = 400 − 300                    =   100,00 €
#
#   ⛔ Mit dem alten 50-%-Abschlag stünden in derselben Anlage nebeneinander
#      300,00 € (Monats-Layer) und 150,00 € (Jahresformel/Alternativkosten).
JAHR, MONAT = 2025, 1
WP_STROM_KWH = 1000.0
NETZBEZUG_CENT = 30.0
STROMKOSTEN_TERM = 300.00
ALTE_KOSTEN = 400.00
MONATS_ERSPARNIS = 100.00


async def _seed_k1(db, *, name: str = "S1b", pv_anteil: float | None = None) -> tuple[int, int]:
    """Anlage mit genau einer Gas-Wärmepumpe und genau einem erfassten Monat."""
    anlage = Anlage(anlagenname=name, leistung_kwp=10.0,
                    standort_plz="10115", latitude=48.0, longitude=11.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2020, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=NETZBEZUG_CENT,
        einspeiseverguetung_cent_kwh=8.0,
    ))
    # ⚠ **Die PV-Historie gehört zur Fixture, und zwar mit Grund.** Ohne sie
    # gibt es keine historische Eigenverbrauchsquote, und die Prognose fällt
    # auf das Komponentenmodell zurück — dort addiert der N-277-Fallback den
    # gepflegten PV-Anteil der Wärmepumpe **ausdrücklich** zum geschätzten
    # Eigenverbrauch. Das ist gewollt (eine Mengenaussage: „so viel PV nimmt
    # die WP ab") und hebt die EV-Ersparnis — es hat mit S1b nichts zu tun.
    # Gemessen: ohne PV-Historie stünde K2 bei 3.286,92 € gegen 3.880,89 €
    # Netto-Ertrag, allein aus diesem Fallback. Mit Historie rechnet die
    # Prognose wie die Demo-Anlage, und der Vergleich misst, was er soll.
    db.add(Monatsdaten(
        anlage_id=anlage.id, jahr=JAHR, monat=MONAT,
        netzbezug_kwh=100.0, einspeisung_kwh=400.0, gaspreis_cent_kwh=12.0,
    ))
    pv = Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="PV",
        anschaffungsdatum=date(2024, 1, 1),
        anschaffungskosten_gesamt=10000.0, leistung_kwp=10.0,
    )
    db.add(pv)
    await db.flush()
    db.add(InvestitionMonatsdaten(
        investition_id=pv.id, jahr=JAHR, monat=MONAT,
        verbrauch_daten={"pv_erzeugung_kwh": 1000.0},
    ))
    # ⚠ **`waermebedarf_kwh` und `jaz` gehören dazu, sonst misst K2/K5 nichts.**
    # Ohne gepflegten Wärmebedarf hält `_wp_nicht_bewertbar` die ganze ROI-Zeile
    # an (N-88/F2b: kein erfundener Default mehr) — `berechne_waermepumpe_
    # einsparung` wird dann gar nicht gerufen. Gemessen am 13.09.2026: mit der
    # ersten Fassung dieser Fixture blieben beide Proben **grün, obwohl der
    # Sprengsatz scharf war**. Eine Probe, die den Rechenweg nicht erreicht,
    # bewacht ihn auch nicht.
    parameter: dict = {
        "wp_art": "luft_wasser",
        "effizienz_modus": "gesamt_jaz",
        "waermebedarf_kwh": 3000.0,
        "jaz": 3.5,
        "alter_energietraeger": "gas",
        "alter_preis_cent_kwh": 12.0,
        "alternativ_zusatzkosten_jahr": 0.0,
    }
    if pv_anteil is not None:
        parameter["pv_anteil_prozent"] = pv_anteil
    wp = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="WP",
        anschaffungsdatum=date(2024, 1, 1),
        anschaffungskosten_gesamt=20000.0, betriebskosten_jahr=0.0,
        parameter=parameter,
    )
    db.add(wp)
    await db.flush()
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=MONAT,
        verbrauch_daten={
            "heizenergie_kwh": 2400.0,
            "warmwasser_kwh": 600.0,
            "stromverbrauch_kwh": WP_STROM_KWH,
        },
    ))
    await db.flush()
    return anlage.id, wp.id


def _sensor(sensors, key):
    return next((s for s in sensors if s.definition.key == key), None)


# ═══ K1 — eine Regel, fünf Sichten ══════════════════════════════════════════

@pytest.mark.asyncio
async def test_k1_alle_sichten_belasten_denselben_stromkosten_term(db):
    """Fünf Sichten, ein Stromkosten-Term: **300,00 €** für 1.000 kWh à 30 ct.

    Jede Zahl steht einzeln und absolut da — keine Sicht wird gegen eine
    andere geprüft (ADR-001/N-130: „ein Symmetrie-Test sichert Übereinstimmung,
    nicht Richtigkeit").
    """
    anlage_id, wp_id = await _seed_k1(db)
    wp = await db.get(Investition, wp_id)

    # (1) Komponenten-Hub — die einzige Sicht, die den Term als eigene Zahl
    #     ausliefert. Er lag hier schon immer bei 100 %; die anderen ziehen nach.
    hub = await get_waermepumpe_dashboard(anlage_id, strompreis_cent=None, db=db)
    assert len(hub) == 1
    assert hub[0].zusammenfassung["wp_kosten_euro"] == pytest.approx(STROMKOSTEN_TERM, abs=0.01)
    assert hub[0].zusammenfassung["ersparnis_euro"] == pytest.approx(MONATS_ERSPARNIS, abs=0.01)

    # (2) Cockpit → Monat 2025-01
    monat = await get_aktueller_monat(anlage_id, jahr=JAHR, monat=MONAT, db=db)
    assert monat.wp_ersparnis_euro == pytest.approx(MONATS_ERSPARNIS, abs=0.01)

    # (3) Cockpit → Jahr 2025
    jahr = await get_cockpit_uebersicht(anlage_id, jahr=JAHR, db=db)
    assert jahr.wp_ersparnis_euro == pytest.approx(MONATS_ERSPARNIS, abs=0.01)

    # (4) HA-Sensor je Wärmepumpe (`state_class: total`, LTS-relevant)
    sensoren = await calculate_investition_sensors(db, wp, None)
    s = _sensor(sensoren, "wp_ersparnis_euro")
    assert s is not None
    assert s.value == pytest.approx(MONATS_ERSPARNIS, abs=0.01)

    # (5) Die anlagenweiten Alternativkosten für denselben Monat.
    #     ⛔ Genau hier stand bis 13.09.2026 `strom * (1 − 0,5) * preis`, und
    #     dieselbe Wärmepumpe wies 250,00 € statt 100,00 € aus.
    alternativ = berechne_wp_alternativkosten_ersparnis(
        [wp],
        {(wp_id, JAHR, MONAT): {
            "heizenergie_kwh": 2400.0, "warmwasser_kwh": 600.0,
            "stromverbrauch_kwh": WP_STROM_KWH,
        }},
        {(JAHR, MONAT): 12.0},
        {(JAHR, MONAT): NETZBEZUG_CENT},
        NETZBEZUG_CENT,
    )
    assert alternativ == pytest.approx(MONATS_ERSPARNIS, abs=0.01)

    # Und der Term selbst, aus der einzigen Sicht, die ihn nennt.
    assert ALTE_KOSTEN - alternativ == pytest.approx(STROMKOSTEN_TERM, abs=0.01)


@pytest.mark.asyncio
async def test_k1_die_prognose_belastet_denselben_satz(db):
    """Die Jahresformel (Prognose) rechnet mit demselben vollen Satz.

    Hochrechnung aus dem einen erfassten Monat:
      thermisch/Jahr = 3.000 × 12 = 36.000 kWh
        ⇒ Gaskosten  = 36.000 / 0,90 × 12 / 100      = 4.800,00 €
      WP-Strom/Jahr  = 1.000 × Σ Saisonfaktoren (10,7) = 10.700 kWh
        ⇒ Stromkosten = 10.700 × 30 / 100             = 3.210,00 €
      Ersparnis                                       = 1.590,00 €

    ⛔ Bis 13.09.2026 wären es 4.800 − 1.605 = **3.195,00 €** gewesen — die
    Hälfte des Stroms blieb unbelastet, obwohl `jahres_ev_ersparnis` denselben
    Strom auf der PV-Seite bereits zum Netzpreis gutschreibt (ADR-002/P9).
    """
    anlage_id, _ = await _seed_k1(db)
    p = await get_finanz_prognose(anlage_id=anlage_id, monate=12, db=db)

    assert p.wp_stromverbrauch_kwh == pytest.approx(10700.0, abs=1.0)
    assert p.netzbezug_preis_cent_kwh == pytest.approx(NETZBEZUG_CENT, abs=0.01)
    assert p.wp_alternativ_ersparnis_euro == pytest.approx(1590.00, abs=0.01)


# ═══ K2 — der gepflegte Anteil bewegt keine Geldzahl ════════════════════════

@pytest.mark.asyncio
async def test_k2_gepflegter_anteil_bewegt_keine_geldzahl(db):
    """Zwei Anlagen, 10 % gegen 90 % PV-Anteil, sonst identisch.

    Jede **Geld**-Zahl ist gleich; nur die **Mengen**-Zahl `wp_pv_anteil_kwh`
    unterscheidet sich. Das ist die Trennlinie von S1b: das Formularfeld
    beantwortet eine Mengenfrage, keine Preisfrage.

    ⭐ Nachfolger von `test_n354_…::test_der_gepflegte_anteil_bewegt_die_
    alternativ_ersparnis_nicht`, erweitert um die **ROI-Zeile** und den **Hub**
    — genau die zwei Sichten, in denen der Anteil bis 13.09.2026 wirkte
    (ROI über `berechne_waermepumpe_einsparung`) bzw. nie wirkte (Hub).
    """
    a_wenig, wp_wenig = await _seed_k1(db, name="wenig", pv_anteil=10)
    a_viel, wp_viel = await _seed_k1(db, name="viel", pv_anteil=90)

    p_wenig = await get_finanz_prognose(anlage_id=a_wenig, monate=12, db=db)
    p_viel = await get_finanz_prognose(anlage_id=a_viel, monate=12, db=db)

    # Geld — gleich.
    assert p_wenig.wp_alternativ_ersparnis_euro == pytest.approx(1590.00, abs=0.01)
    assert p_viel.wp_alternativ_ersparnis_euro == pytest.approx(1590.00, abs=0.01)
    assert p_wenig.jahres_netto_ertrag_euro == pytest.approx(
        p_viel.jahres_netto_ertrag_euro, abs=0.01
    )

    hub_wenig = await get_waermepumpe_dashboard(a_wenig, strompreis_cent=None, db=db)
    hub_viel = await get_waermepumpe_dashboard(a_viel, strompreis_cent=None, db=db)
    assert hub_wenig[0].zusammenfassung["ersparnis_euro"] == pytest.approx(
        MONATS_ERSPARNIS, abs=0.01
    )
    assert hub_viel[0].zusammenfassung["ersparnis_euro"] == pytest.approx(
        MONATS_ERSPARNIS, abs=0.01
    )

    # Die ROI-Zeile — hier bewegte der Anteil bis 13.09.2026 eine Geldzahl.
    zeile_wenig = _roi_wp_zeile(await get_roi_dashboard(
        a_wenig, strompreis_cent=None, einspeiseverguetung_cent=None,
        benzinpreis_euro=None, jahr=None, db=db), wp_wenig)
    zeile_viel = _roi_wp_zeile(await get_roi_dashboard(
        a_viel, strompreis_cent=None, einspeiseverguetung_cent=None,
        benzinpreis_euro=None, jahr=None, db=db), wp_viel)
    # ⚠ Erst der Nachweis, dass die Zeile überhaupt gerechnet wurde — sonst
    # verglichen die beiden nächsten Zeilen zweimal „nicht bewertet".
    assert zeile_wenig.detail_berechnung.get("nicht_bewertet") is not True
    assert zeile_viel.detail_berechnung.get("nicht_bewertet") is not True
    # Absolut, nicht nur gleich: 3.000 kWh / JAZ 3,5 = 857,14 kWh × 30 ct
    # = 257,14 € Stromkosten gegen 3.000 / 0,90 × 12 ct = 400,00 € Gaskosten.
    assert zeile_wenig.detail_berechnung["wp_kosten_euro"] == pytest.approx(257.14, abs=0.01)
    assert zeile_viel.detail_berechnung["wp_kosten_euro"] == pytest.approx(257.14, abs=0.01)
    assert zeile_wenig.jahres_einsparung == pytest.approx(400.00 - 257.14, abs=0.01)
    assert zeile_viel.jahres_einsparung == pytest.approx(400.00 - 257.14, abs=0.01)
    assert zeile_wenig.co2_einsparung_kg == pytest.approx(
        zeile_viel.co2_einsparung_kg, abs=0.01
    )

    # Menge — verschieden. Der Anteil kommt an, nur eben dort, wo er hingehört.
    assert p_wenig.wp_pv_anteil_kwh < p_viel.wp_pv_anteil_kwh


# ═══ K3 — ADR-002/P9 explizit ausgerechnet ══════════════════════════════════

@pytest.mark.asyncio
async def test_k3_jahres_netto_ertrag_zaehlt_die_wp_kwh_genau_einmal(db):
    """`jahres_netto_ertrag` == Einspeise-Erlös + EV-Ersparnis + WP-Ersparnis.

    Ausgerechnet gegen eine **absolute** Erwartung, nicht gegen eine zweite
    Sicht. Der Punkt von P9 steckt im dritten Summanden: er trägt
    `gas_kosten − wp_strom × preis` mit dem **ganzen** Strom. Bliebe die Hälfte
    unbelastet, stünde dieselbe Kilowattstunde zweimal im Ertrag — einmal im
    Eigenverbrauch (der sie zum Netzpreis gutschreibt) und einmal als
    ersparte WP-Stromkosten.
    """
    anlage_id, _ = await _seed_k1(db)
    p = await get_finanz_prognose(anlage_id=anlage_id, monate=12, db=db)

    erwartet = (
        p.jahres_einspeise_erloes_euro
        + p.jahres_ev_ersparnis_euro
        + 1590.00                      # = 4.800 − 10.700 × 0,30, s. K1
    )
    assert p.jahres_netto_ertrag_euro == pytest.approx(erwartet, abs=0.01)

    # Die Gegenprobe zur Doppelzählung, in einer Zeile: der halbe Abschlag wäre
    # exakt 10.700 × 0,5 × 0,30 = 1.605,00 € zusätzlicher Ertrag für Strom, den
    # das Haus nie zweimal hatte.
    assert p.jahres_netto_ertrag_euro != pytest.approx(erwartet + 1605.00, abs=0.01)


# ═══ K4 — CO₂ hat eine Regel ════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_k4_roi_co2_rechnet_wie_der_gemessene_pfad(db):
    """Die CO₂-Zeile der ROI-Auswertung belastet denselben vollen Strom wie
    `co2_wp_ersparnis_kg` — die einzige erlaubte Konstruktions-Stelle
    (ADR-001/DI-1), die nie einen PV-Anteil kannte.

    Beide Seiten absolut ausgerechnet, mit den Werten der ROI-Planung
    (Wärmebedarf 3.000 kWh/Jahr, JAZ 3,5 ⇒ 857,14 kWh WP-Strom):

        CO₂_alt = 3.000 / 0,90 × f_gas
        CO₂_WP  = 857,14 × 0,38 kg           ← ohne Abschlag
    """
    from backend.core.calculations import CO2_FAKTOR_GAS_KG_KWH

    anlage = Anlage(anlagenname="co2", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2020, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=NETZBEZUG_CENT,
        einspeiseverguetung_cent_kwh=8.0,
    ))
    wp = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="WP",
        anschaffungsdatum=date(2024, 1, 1), anschaffungskosten_gesamt=20000.0,
        parameter={
            "wp_art": "luft_wasser",
            "effizienz_modus": "gesamt_jaz",
            "waermebedarf_kwh": 3000.0,
            "jaz": 3.5,
            "alter_energietraeger": "gas",
            "alter_preis_cent_kwh": 12.0,
            "alternativ_zusatzkosten_jahr": 0.0,
            "pv_anteil_prozent": 90,     # wirkt auf CO₂ nicht mehr
        },
    )
    db.add(wp)
    await db.flush()

    zeile = _roi_wp_zeile(await get_roi_dashboard(
        anlage.id, strompreis_cent=None, einspeiseverguetung_cent=None,
        benzinpreis_euro=None, jahr=None, db=db), wp.id)

    wp_strom = 3000.0 / 3.5
    erwartet = 3000.0 / 0.90 * CO2_FAKTOR_GAS_KG_KWH - wp_strom * CO2_FAKTOR_STROM_KG_KWH
    assert zeile.co2_einsparung_kg == pytest.approx(round(erwartet, 1), abs=0.1)

    # Derselbe Strom, dieselbe Regel im gemessenen Pfad — beide Seiten
    # ausgerechnet, keine Sicht gegen eine andere.
    assert co2_wp_ersparnis_kg(3000.0, wp_strom, "gas") == pytest.approx(erwartet, abs=0.1)

    # Und die Kosten-Seite derselben Zeile: 857,14 kWh × 30 ct = 257,14 €.
    assert zeile.detail_berechnung["wp_kosten_euro"] == pytest.approx(
        round(wp_strom * NETZBEZUG_CENT / 100, 2), abs=0.01
    )


# ═══ K5 — `pv_anteil_prozent: null` stürzt nicht ab ═════════════════════════

@pytest.mark.asyncio
async def test_k5_ausdruecklich_leeres_feld_stuerzt_die_roi_route_nicht_ab(db):
    """`parameter={"pv_anteil_prozent": None}` — die ROI-Route liefert eine Zahl.

    ⛔ Bis 13.09.2026 warf `core/calculations.py` hier
    `TypeError: unsupported operand type(s) for /: 'NoneType' and 'int'`, und
    zwar für die **ganze Sicht** *Auswertungen → ROI* (HTTP 500), nicht nur für
    die Zeile der Wärmepumpe: `params.get(KEY, DEFAULT)` liefert bei einem
    **vorhandenen** Schlüssel mit Wert `None` eben `None` und nicht den Default.

    ⚠ Über das Formular war der Zustand nicht herstellbar
    (`InvestitionForm.tsx` schreibt leere Felder gar nicht erst), über die API
    (`PUT /investitionen/{id}`) und über Importwege sehr wohl. Mit S1b liest
    die Formel den Parameter nicht mehr — der Absturz ist mit dem Leser
    verschwunden, nicht mit einer Sonderbehandlung.
    """
    anlage_id, wp_id = await _seed_k1(db, name="null-feld")
    wp = await db.get(Investition, wp_id)
    wp.parameter = {**(wp.parameter or {}), "pv_anteil_prozent": None}
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(wp, "parameter")
    await db.flush()

    roi = await get_roi_dashboard(
        anlage_id, strompreis_cent=None, einspeiseverguetung_cent=None,
        benzinpreis_euro=None, jahr=None, db=db,
    )
    zeile = _roi_wp_zeile(roi, wp_id)
    assert zeile is not None
    # ⚠ Nicht nur „irgendeine Zahl": die Zeile muss GERECHNET sein. Wäre sie
    # `nicht_bewertet`, liefe die Probe an der Absturzstelle vorbei — genau das
    # war die erste Fassung dieser Fixture (gemessen 13.09.2026).
    assert zeile.detail_berechnung.get("nicht_bewertet") is not True
    assert zeile.detail_berechnung["wp_kosten_euro"] == pytest.approx(257.14, abs=0.01)
    assert zeile.jahres_einsparung == pytest.approx(400.00 - 257.14, abs=0.01)

    # Und die Mengen-Leser fallen weiterhin sauber auf den Katalog-Default
    # zurück, statt mitzustürzen — `None` heißt dort „nicht gepflegt".
    p = await get_finanz_prognose(anlage_id=anlage_id, monate=12, db=db)
    assert p.wp_pv_anteil_kwh == pytest.approx(round(0.30 * p.wp_stromverbrauch_kwh, 0), abs=1.0)


def _roi_wp_zeile(roi, wp_id: int):
    return next((b for b in roi.berechnungen if b.investition_id == wp_id), None)
