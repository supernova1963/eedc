"""A6 — die drei Arbeitszahlen je Funktion nennen ihre Zähler und Nenner (N-365).

Der Komponenten-Hub zeigt *JAZ Heizen*, *JAZ Warmwasser* und *JAZ Kühlen* mit
Formeln wie „Heizwärme ÷ Strom Heizen". Die beiden Zahlen dazu standen bis zum
13.09.2026 **weder auf der Fläche noch in der Antwort** — der Status-Strip führt
nur die Gesamtwerte. Es ist die Kachel-Familie des Melders, dessen unmögliche
Arbeitszahl von 0,7 den Fund ausgelöst hat.

⛔ **Warum die Zahlen aus dem Layer kommen und nicht aus den Anzeigefeldern.**
Nicht wegen eines Abzugs — ``arbeitszahl_je_funktion`` zieht **bewusst nichts** ab
(SOLL-§9-E7: der Nenner ist der getrennt *gemessene* Funktionsstrom, eine
Verteilung darf ihn weder stellen noch kürzen). Sondern weil der Layer
entscheidet, **ob** es überhaupt eine Zahl geben darf, und Zähler/Nenner nur dann
setzt: bei **abgeleiteter Wärme**, bei einer Abgrenzungs-Störung oder ohne
Wärmemengenzähler stehen die Rohsummen weiterhin in derselben Antwort — eine
Herleitung daraus zeigte eine Rechnung, die es nicht geben darf. Die dritte Probe
unten ist genau dafür da.

⚠ **Der Abzug war meine Hypothese und ist an dieser Datei gescheitert** (13.09.):
Eine erste Fassung erwartete einen um den Kühlstrom gekürzten Heiz-Nenner und
wurde rot. Der Docstring von ``arbeitszahl_je_funktion`` sagt es wörtlich — und
hat den Satz seit WK-06 (12.09.) mit seinem tragenden Grund. Der Abzug gilt für
die **Gesamt**-Arbeitszahl, nicht je Funktion.

Schwesterdateien: ``test_a6_eingesetzte_werte.py`` (die T-Konto-Felder desselben
Pakets) und ``test_bs8_funktions_gruppen.py`` (dieselben Funktions-Kennzahlen in
den Cockpit-Sichten).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.investitionen.dashboards import get_waermepumpe_dashboard
from backend.models import Anlage, Investition
from backend.models.investition import InvestitionMonatsdaten

_PARAMETER = {
    "wp_art": "luft_wasser",
    "effizienz_modus": "gesamt_jaz",
    "getrennte_strommessung": True,
}


async def _anlage(db, name: str) -> Anlage:
    a = Anlage(anlagenname=name, leistung_kwp=10.0,
               installationsdatum=date(2023, 1, 1))
    db.add(a)
    await db.flush()
    return a


async def _wp(db, anlage, monate: list[tuple[int, int, dict]], *, parameter=None):
    inv = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="WP",
        anschaffungsdatum=date(2023, 1, 1), anschaffungskosten_gesamt=15000.0,
        parameter=dict(parameter or _PARAMETER),
    )
    db.add(inv)
    await db.flush()
    for jahr, monat, daten in monate:
        db.add(InvestitionMonatsdaten(investition_id=inv.id, jahr=jahr,
                                      monat=monat, verbrauch_daten=daten))
    return inv


async def _z(db, anlage_id: int) -> dict:
    geraete = await get_waermepumpe_dashboard(anlage_id, strompreis_cent=None, db=db)
    assert len(geraete) == 1
    return geraete[0].zusammenfassung or {}


@pytest.mark.asyncio
async def test_heizen_und_warmwasser_tragen_zaehler_und_nenner(db):
    a = await _anlage(db, "A6-Funktion")
    await _wp(db, a, [(2025, 11, {
        "stromverbrauch_kwh": 300.0,
        "strom_heizen_kwh": 250.0,
        "strom_warmwasser_kwh": 50.0,
        "heizenergie_kwh": 1000.0,
        "warmwasser_kwh": 150.0,
    })])
    await db.commit()

    z = await _z(db, a.id)
    assert z["jaz_heizen"] == pytest.approx(4.0)          # 1000 ÷ 250
    assert z["jaz_heizen_zaehler_kwh"] == pytest.approx(1000.0)
    assert z["jaz_heizen_nenner_kwh"] == pytest.approx(250.0)
    assert z["jaz_warmwasser"] == pytest.approx(3.0)      # 150 ÷ 50
    assert z["jaz_warmwasser_zaehler_kwh"] == pytest.approx(150.0)
    assert z["jaz_warmwasser_nenner_kwh"] == pytest.approx(50.0)


@pytest.mark.asyncio
async def test_ohne_arbeitszahl_bleiben_beide_zahlen_leer(db):
    """Zweite Regelhälfte, eigene Probe.

    Ohne Wärmemengenzähler für das Warmwasser gibt es keine Arbeitszahl — dann
    darf auch keine halbe Rechnung danebenstehen; der **Grund** trägt die
    Auskunft. Die erste Probe wäre auch dann grün, wenn hier zwei Zahlen ohne
    Quotient erschienen.
    """
    a = await _anlage(db, "A6-Sperre")
    await _wp(db, a, [(2025, 11, {
        "stromverbrauch_kwh": 300.0,
        "strom_heizen_kwh": 250.0,
        "strom_warmwasser_kwh": 50.0,
        "heizenergie_kwh": 1000.0,
    })])
    await db.commit()

    z = await _z(db, a.id)
    assert z["jaz_warmwasser"] is None
    assert z["jaz_warmwasser_grund"]
    assert z["jaz_warmwasser_zaehler_kwh"] is None
    assert z["jaz_warmwasser_nenner_kwh"] is None
    # Gegenprobe in derselben Antwort: Heizen trägt seine Zahlen weiterhin.
    assert z["jaz_heizen_nenner_kwh"] == pytest.approx(250.0)


@pytest.mark.asyncio
async def test_abgeleitete_waerme_sperrt_die_herleitung_obwohl_beide_zahlen_dastehen(db):
    """⭐ Der eigentliche Gegenstand.

    Ist die Heizwärme aus *Strom × gepflegter JAZ* **abgeleitet**, sperrt der
    Layer die Arbeitszahl: der Quotient gäbe exakt die gepflegte Zahl zurück —
    eine Zahl, die nichts misst und trotzdem wie eine Messung aussieht
    (Konzept §3.5). Die beiden Rohsummen stehen in **derselben Antwort**
    weiterhin da. Wer die Herleitung im Client daraus nachbaute, zeigte genau
    die Rechnung, die es nicht geben darf — und daneben ein „—" mit Grund.

    Das ist die Klasse, gegen die es die Layer-Felder gibt; ein Abzug ist es
    ausdrücklich **nicht** (s. Modul-Docstring).
    """
    a = await _anlage(db, "A6-abgeleitet")
    inv = await _wp(db, a, [])
    db.add(InvestitionMonatsdaten(
        investition_id=inv.id, jahr=2025, monat=11,
        verbrauch_daten={
            "stromverbrauch_kwh": 300.0,
            "strom_heizen_kwh": 250.0,
            "strom_warmwasser_kwh": 50.0,
            "heizenergie_kwh": 1000.0,
            "warmwasser_kwh": 150.0,
        },
        source_provenance={
            "verbrauch_daten.heizenergie_kwh": {"abgeleitet": "jaz_vorschlag"},
        },
    ))
    await db.commit()

    z = await _z(db, a.id)
    # Die Rohsummen liegen an — der Client HÄTTE also zwei Zahlen zum Teilen.
    assert z["gesamt_strom_heizen_kwh"] == pytest.approx(250.0)
    assert z["gesamt_heizung_getrennt_kwh"] == pytest.approx(1000.0)
    # Der Layer sperrt trotzdem, und mit ihm die Herleitung.
    assert z["jaz_heizen"] is None
    assert z["jaz_heizen_grund"]
    assert z["jaz_heizen_zaehler_kwh"] is None
    assert z["jaz_heizen_nenner_kwh"] is None


@pytest.mark.asyncio
async def test_je_funktion_wird_NICHT_um_funktionsfremden_strom_gekuerzt(db):
    """Die Gegenrichtung, als stehende Zusage (SOLL-§9-E7, WK-06).

    Der Nenner je Funktion ist der getrennt **gemessene** Strom — ein aus dem
    Betriebsmodus abgeleiteter Kühlanteil kürzt ihn nicht. Diese Probe hält den
    Entscheid fest, an dem meine Abzugs-Hypothese gescheitert ist: Zöge hier
    jemand doch ab, stünde im Nenner *Messung − Verteilung*.
    """
    a = await _anlage(db, "A6-kein-Abzug")
    await _wp(db, a, [(2025, 7, {
        "stromverbrauch_kwh": 400.0,
        "strom_heizen_kwh": 300.0,
        "strom_warmwasser_kwh": 100.0,
        "heizenergie_kwh": 600.0,
        "warmwasser_kwh": 300.0,
        "betriebsart_strom_kuehlen_kwh": 100.0,
        "betriebsart_nutzenergie_kuehlen_kwh": 300.0,
    })])
    await db.commit()

    z = await _z(db, a.id)
    assert z["jaz_heizen_nenner_kwh"] == pytest.approx(z["gesamt_strom_heizen_kwh"])
    assert z["jaz_heizen_nenner_kwh"] == pytest.approx(300.0)
    # Und die genannte Rechnung führt auf die genannte Zahl.
    assert z["jaz_heizen"] == pytest.approx(
        round(z["jaz_heizen_zaehler_kwh"] / z["jaz_heizen_nenner_kwh"], 2)
    )


@pytest.mark.asyncio
async def test_kuehlen_traegt_kaeltemenge_und_kuehlstrom(db):
    a = await _anlage(db, "A6-Kuehlen")
    await _wp(db, a, [(2025, 7, {
        "stromverbrauch_kwh": 300.0,
        "betriebsart_strom_kuehlen_kwh": 100.0,
        "betriebsart_nutzenergie_kuehlen_kwh": 350.0,
    })], parameter={"wp_art": "luft_luft", "effizienz_modus": "gesamt_jaz"})
    await db.commit()

    z = await _z(db, a.id)
    assert z["jaz_kuehlen"] == pytest.approx(3.5)
    assert z["jaz_kuehlen_zaehler_kwh"] == pytest.approx(350.0)
    assert z["jaz_kuehlen_nenner_kwh"] == pytest.approx(100.0)


@pytest.mark.asyncio
async def test_kuehlen_ohne_kaeltezaehler_bleibt_ohne_zahlen(db):
    a = await _anlage(db, "A6-Kuehlen-leer")
    await _wp(db, a, [(2025, 7, {
        "stromverbrauch_kwh": 300.0,
        "betriebsart_strom_kuehlen_kwh": 100.0,
    })], parameter={"wp_art": "luft_luft", "effizienz_modus": "gesamt_jaz"})
    await db.commit()

    z = await _z(db, a.id)
    assert z["jaz_kuehlen"] is None
    assert z["jaz_kuehlen_grund"]
    assert z["jaz_kuehlen_zaehler_kwh"] is None
    assert z["jaz_kuehlen_nenner_kwh"] is None
