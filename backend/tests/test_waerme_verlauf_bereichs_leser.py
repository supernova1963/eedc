"""Der Monats-Verlauf liest einen BEREICH, nicht 31 Einzeltage (10.09.2026).

Schwesterdateien: ``test_tages_stapel_gemessen_verdraengt_abgeleitet.py`` (die
Faltung, die dieser Leser ruft), ``test_tageswert_aus_reihe_ist_die_eine_regel.py``
(die Tagesreset-Regel, die er teilt), ``test_soll_waerme_klima_achse3_aufloesung.py``
(dieselbe Regel am Tages-Einstieg).

**Der Gegenstand** (Konzept Wärme/Klima §8, Bauschnitt 4): Die gemessene Wärme
je Tag entsteht aus Zähler-Randständen. Der bestehende Tages-Einstieg braucht
dafür **drei** Datenbankabfragen je Feld und Tag — für einen Monat mit zwei
Wärmefeldern rund 186 Abfragen für **eine** Linie. Der Bereichs-Leser lädt eine
Standreihe je Feld und wertet lokal aus.

⚠ **Was diese Datei prüft, ist nicht die Query-Zahl, sondern die Gleichheit:**
Derselbe Tag muss über den Bereichs-Leser dasselbe ergeben wie über
``get_tagesdetail_kwh``. Eine schnellere Rechnung, die andere Zahlen liefert,
wäre die S1-Verletzung — dieselbe Größe, zwei Werte, je nachdem welche Sicht der
Anwender öffnet.
"""

from datetime import date, datetime, timedelta

import pytest

from backend.models.anlage import Anlage
from backend.models.investition import Investition
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import TagesZusammenfassung
from backend.services.snapshot.aggregator import (
    TAGESDETAIL_AUSGABE,
    get_tagesdetail_kwh,
)
from backend.services.snapshot.bereichs_leser import lade_tageswerte_je_feld

VON = date(2026, 8, 10)
BIS = date(2026, 8, 14)

WAERME_FELDER = {
    k: v for k, v in TAGESDETAIL_AUSGABE.items()
    if v in ("wp_heizung_kwh", "wp_warmwasser_kwh")
}


async def _anlage_mit_waermezaehler(db, staende_je_tag: dict[date, float]):
    """Anlage + Wärmepumpe mit Wärmemengenzähler.

    ``staende_je_tag`` ist der Zählerstand **um 00:00** des jeweiligen Tages —
    der Tageswert entsteht als Differenz zum Folgetag.
    """
    anlage = Anlage(anlagenname="Bereich", leistung_kwp=10.0,
                    installationsdatum=date(2025, 1, 1))
    db.add(anlage)
    await db.flush()
    inv = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Luft-Wasser",
        anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=15000.0,
        parameter={"wp_art": "luft_wasser"},
    )
    db.add(inv)
    await db.flush()

    key = f"inv:{inv.id}:heizenergie_kwh"
    for tag, stand in staende_je_tag.items():
        db.add(SensorSnapshot(
            anlage_id=anlage.id, sensor_key=key,
            zeitpunkt=datetime.combine(tag, datetime.min.time()),
            wert_kwh=stand, quelle="ha_statistics",
        ))
    anlage.sensor_mapping = {"investitionen": {str(inv.id): {"felder": {
        "heizenergie_kwh": {
            "strategie": "sensor", "sensor_id": "sensor.wp_heizenergie",
        },
    }}}}
    db.add(TagesZusammenfassung(
        anlage_id=anlage.id, datum=VON, komponenten_kwh={},
    ))
    await db.commit()
    return anlage, inv


@pytest.mark.asyncio
async def test_der_bereich_liefert_je_tag_dieselbe_menge_wie_der_tagespfad(db):
    """**Die tragende Probe.** Gleiche Zahl, anderer Weg."""
    staende = {
        VON: 100.0,
        VON + timedelta(days=1): 112.0,   # Tag 1: 12,0 kWh
        VON + timedelta(days=2): 119.5,   # Tag 2:  7,5 kWh
        VON + timedelta(days=3): 119.5,   # Tag 3:  0,0 kWh — stand still
        VON + timedelta(days=4): 130.0,   # Tag 4: 10,5 kWh
        BIS + timedelta(days=1): 141.0,   # Tag 5: 11,0 kWh
    }
    anlage, inv = await _anlage_mit_waermezaehler(db, staende)
    inv_map = {str(inv.id): inv}

    bereich = await lade_tageswerte_je_feld(
        db, anlage, inv_map, VON, BIS, WAERME_FELDER,
    )

    erwartet = [12.0, 7.5, 0.0, 10.5, 11.0]
    for i, soll in enumerate(erwartet):
        tag = VON + timedelta(days=i)
        einzeln = await get_tagesdetail_kwh(db, anlage, inv_map, tag)
        assert einzeln.werte.get("wp_heizung_kwh") == pytest.approx(soll), tag
        assert bereich[tag]["wp_heizung_kwh"] == pytest.approx(soll), tag


@pytest.mark.asyncio
async def test_ein_zurueckgesprungener_zaehler_faellt_aus_dem_bereich(db):
    """Die geteilte Regel wirkt auch hier — der Tag fehlt, statt 0 zu behaupten.

    ⚠ Und die **Nachbartage bleiben stehen**: Ein Rücksprung sperrt seinen Tag,
    nicht den Monat.
    """
    staende = {
        VON: 100.0,
        VON + timedelta(days=1): 112.0,   # Tag 1: 12,0 kWh
        VON + timedelta(days=2): 3.0,     # Tag 2: Zähler zurückgesprungen
        VON + timedelta(days=3): 9.0,     # Tag 3:  6,0 kWh
        VON + timedelta(days=4): 15.0,
        BIS + timedelta(days=1): 20.0,
    }
    anlage, inv = await _anlage_mit_waermezaehler(db, staende)

    bereich = await lade_tageswerte_je_feld(
        db, anlage, {str(inv.id): inv}, VON, BIS, WAERME_FELDER,
    )

    assert bereich[VON]["wp_heizung_kwh"] == pytest.approx(12.0)
    assert VON + timedelta(days=1) not in bereich, "der Rücksprungtag hat keine Aussage"
    assert bereich[VON + timedelta(days=2)]["wp_heizung_kwh"] == pytest.approx(6.0)


@pytest.mark.asyncio
async def test_ein_sturz_INNERHALB_des_tages_wird_auch_gefangen(db):
    """⭐ **Weg 2 der Reset-Erkennung — und diese Probe fehlte zuerst.**

    Ein Sprengsatz, der die Zwischenstände unterschlug, blieb still: Die Probe
    darüber prüft einen Rücksprung, der schon an den **Rändern** ablesbar ist
    (Weg 1). Der teure Fall ist der andere — beide Ränder **vor** dem Reset
    abgetastet: 100,0 → 104,0 ist positiv, plausibel und still falsch, während
    der Zähler dazwischen auf 0 gefallen ist.

    ⚠ Das ist genau der Fall, für den ``zaehler_faellt_im_fenster`` am
    28.08.2026 von einer Extremwert- auf eine echte Monotonie-Prüfung umgestellt
    wurde. Der Bereichs-Leser erbt das über ``tageswert_aus_reihe`` — aber
    geerbt ist nicht geprüft.
    """
    staende = {
        VON: 100.0,
        VON + timedelta(days=1): 104.0,   # Rand-Differenz +4,0 — plausibel
        VON + timedelta(days=2): 110.0,
    }
    anlage, inv = await _anlage_mit_waermezaehler(db, staende)
    # ... und mittendrin der Sturz, den nur die Reihe zeigt.
    key = f"inv:{inv.id}:heizenergie_kwh"
    t0 = datetime.combine(VON, datetime.min.time())
    for stunde, wert in ((6, 103.0), (12, 0.0), (18, 2.0)):
        db.add(SensorSnapshot(
            anlage_id=anlage.id, sensor_key=key,
            zeitpunkt=t0 + timedelta(hours=stunde),
            wert_kwh=wert, quelle="ha_statistics",
        ))
    await db.commit()

    bereich = await lade_tageswerte_je_feld(
        db, anlage, {str(inv.id): inv}, VON, VON + timedelta(days=1),
        WAERME_FELDER,
    )

    assert VON not in bereich, (
        "Der Zähler ist im Tagesfenster gefallen — die Randdifferenz ist "
        "trotzdem positiv. Genau dafür gibt es Weg 2."
    )
    assert bereich[VON + timedelta(days=1)]["wp_heizung_kwh"] == pytest.approx(6.0)


@pytest.mark.asyncio
async def test_ein_stand_ausserhalb_der_toleranz_ist_kein_rand(db):
    """Die Randauswahl hält dieselbe Toleranz wie ``get_snapshot``.

    Der einzige Stand des Folgetags liegt zwei Stunden neben der Tagesgrenze —
    er darf sie **nicht** besetzen, sonst entstünde eine Menge über ein
    Fenster, das so nie gemessen wurde.
    """
    anlage, inv = await _anlage_mit_waermezaehler(db, {VON: 100.0})
    key = f"inv:{inv.id}:heizenergie_kwh"
    db.add(SensorSnapshot(
        anlage_id=anlage.id, sensor_key=key,
        zeitpunkt=datetime.combine(VON + timedelta(days=1), datetime.min.time())
        + timedelta(hours=2),
        wert_kwh=112.0, quelle="ha_statistics",
    ))
    await db.commit()

    bereich = await lade_tageswerte_je_feld(
        db, anlage, {str(inv.id): inv}, VON, VON, WAERME_FELDER,
    )
    assert bereich == {}


@pytest.mark.asyncio
async def test_ohne_zugeordneten_zaehler_gibt_es_keine_reihe(db):
    """Kein Zähler, keine Zahl — und keine 0 (ADR-002/P4)."""
    anlage, inv = await _anlage_mit_waermezaehler(db, {VON: 100.0})
    anlage.sensor_mapping = {"investitionen": {str(inv.id): {"felder": {}}}}
    await db.commit()

    bereich = await lade_tageswerte_je_feld(
        db, anlage, {str(inv.id): inv}, VON, BIS, WAERME_FELDER,
    )
    assert bereich == {}


@pytest.mark.asyncio
async def test_die_feldmenge_kommt_aus_der_EINEN_tabelle(db):
    """⚑ Kein zweites Verzeichnis der Wärmefelder.

    ``core/berechnungen/waermepumpe_kennzahl.py`` schickt künftige Leser für die
    Tages-Kühlzahl ausdrücklich zu ``TAGESDETAIL_AUSGABE``. Stünde daneben eine
    eigene Liste, müsste **Bauschnitt 6** an zwei Stellen gebaut werden.
    """
    for schluessel, key in WAERME_FELDER.items():
        assert TAGESDETAIL_AUSGABE[schluessel] == key
