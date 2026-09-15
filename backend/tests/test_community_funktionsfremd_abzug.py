"""Der Abzug reist als eigene Zahl zum Community-Server (WK-06b, Fund N-454).

**Warum es diesen Test gibt.** Seit Option A (SOLL Wärme/Klima §4.1, „Ergänzung
zu E7") gilt lokal: *abgezogen wird nur, was im Nenner steht.* Der
Community-Server bildet seinen JAZ-Nenner aber selbst — er zog bis zum
13.09.2026 die **Menge** ``wp_strom_kuehlen_kwh`` ab, weil ihr Vertrag im
zweiten Repo beides in einem Feld sagte („eine Teilmenge" *und* „sie wird
abgezogen"). Für eine Anlage mit getrennter Strommessung und **abgeleitetem**
Modus-Split lief das auseinander: 3,79 im eigenen Cockpit, **4,24** im
Vergleich — und die höhere Zahl ging in **fremde** Vergleichswerte.

Die Auflösung ist ein zweites Feld: ``wp_strom_funktionsfremd_abzug_kwh``, die
**Entscheidung** neben der **Menge**. Dieselbe Bauform wie
``wp_jaz_belastbar`` (N-367) und aus demselben Grund — die Frage hängt am
**Gerät**, und Geräte hat der Server nie gesehen.

⛔ **Diese Datei prüft die Sender-Hälfte.** Die Server-Hälfte (Fallback auf die
Menge, vier Rechenstellen) liegt im Schwester-Repo unter
``eedc-community/backend/tests/test_funktionsfremd_abzug_wk06b.py``.

**Schwesterdateien hier:** ``test_community_jaz_belastbar_p12.py`` (dieselbe
Bauform für P12), ``test_n445_kuehlstrom_im_f5_heizstrom.py`` (die Layer-Regel,
aus der der Wert stammt).
"""
from __future__ import annotations

from datetime import date

import pytest

from backend.models import Anlage, Investition, Monatsdaten
from backend.models.investition import InvestitionMonatsdaten
from backend.services.community_service import prepare_community_data

# Die Zahlen sind die der Fixture `MONAT_F5_F3` (N-445) und des Handbuch-
# Beispiels: 750 + 200 kWh gemessener Strom, 3000 + 600 kWh Wärme, 100 kWh
# Kühlanteil. Add-on nach Option A: 3600/950 = 3,79. Server vor WK-06b:
# 3600/850 = 4,24.
F5_STROM_HEIZEN = 750.0
F5_STROM_WARMWASSER = 200.0
WAERME_HEIZEN = 3000.0
WAERME_WARMWASSER = 600.0
KUEHLANTEIL = 100.0


async def _anlage(db, *, verbrauch_daten: dict, getrennt: bool) -> int:
    """Eine Anlage mit genau einer Wärmepumpe und einem Monat (7/2026)."""
    anlage = Anlage(anlagenname="WK-06b", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    # Zählerzeile: ohne sie kennt der Payload den Monat nicht.
    db.add(Monatsdaten(anlage_id=anlage.id, jahr=2026, monat=7,
                       einspeisung_kwh=400.0, netzbezug_kwh=100.0))
    pv = Investition(anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
                     leistung_kwp=10.0, anschaffungsdatum=date(2024, 1, 1))
    db.add(pv)
    await db.flush()
    db.add(InvestitionMonatsdaten(investition_id=pv.id, jahr=2026, monat=7,
                                  verbrauch_daten={"pv_erzeugung_kwh": 1100.0}))

    wp = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Luft-Wasser",
        anschaffungsdatum=date(2024, 1, 1),
        parameter={"wp_art": "luft_wasser", "getrennte_strommessung": getrennt},
    )
    db.add(wp)
    await db.flush()
    db.add(InvestitionMonatsdaten(investition_id=wp.id, jahr=2026, monat=7,
                                  verbrauch_daten=verbrauch_daten))
    await db.commit()
    return anlage.id


def _juli(data) -> dict:
    return next(m for m in data["monatswerte"] if (m["jahr"], m["monat"]) == (2026, 7))


@pytest.mark.asyncio
async def test_f5_mit_abgeleitetem_split_sendet_menge_und_abzug_null(db):
    """**Der Anlass.** F5 + Betriebsmodus-Sensor: Menge 100, Abzug **0**.

    Der abgeleitete Kühlanteil ist ein Ausschnitt genau der zwei Zähler, die den
    Nenner bilden — er kürzt sie nicht. Die **Menge** reist trotzdem mit: Sie ist
    die beste verfügbare Auskunft über den Kühlbetrieb dieses Monats, und der
    Server wertet Mengen getrennt von Kennzahlen aus (E1).
    """
    anlage_id = await _anlage(db, getrennt=True, verbrauch_daten={
        "strom_heizen_kwh": F5_STROM_HEIZEN,
        "strom_warmwasser_kwh": F5_STROM_WARMWASSER,
        "heizenergie_kwh": WAERME_HEIZEN,
        "warmwasser_kwh": WAERME_WARMWASSER,
        # Der ABGELEITETE Split (Σ = 950 = die zwei Zähler)
        "modus_strom_heizen_kwh": 700.0,
        "modus_strom_warmwasser_kwh": 150.0,
        "modus_strom_kuehlen_kwh": KUEHLANTEIL,
        "modus_abdeckung_h": 700.0,
    })
    juli = _juli(await prepare_community_data(db, anlage_id))

    assert juli["wp_stromverbrauch_kwh"] == pytest.approx(950.0, abs=0.1)
    assert juli["wp_strom_kuehlen_kwh"] == pytest.approx(100.0, abs=0.1), (
        "Die MENGE bleibt unverändert — K1, und ihr Vertrag im zweiten Repo "
        "hängt daran."
    )
    assert juli["wp_strom_funktionsfremd_abzug_kwh"] == pytest.approx(0.0, abs=0.01), (
        "Option A: ein abgeleiteter Anteil kürzt einen gemessenen F5-Nenner "
        "nicht. Mit 100 rechnete der Server 3600/850 = 4,24 statt 3,79."
    )
    # ⛔ `0.0`, nicht `None` — der Unterschied trägt die ganze Regel: `None`
    # heißt beim Server „älterer Client, nimm die Menge".
    assert juli["wp_strom_funktionsfremd_abzug_kwh"] is not None


@pytest.mark.asyncio
async def test_ohne_getrennte_strommessung_traegt_der_abzug_lueften_und_entfeuchten(db):
    """**Die zweite geschlossene Lücke (offen seit E4).** Der Abzug ist mehr als Kühlen.

    Ohne getrennte Strommessung steckt jede Betriebsart im Gesamtzähler — also
    wird ganz abgezogen, und zwar **Kühlen + Lüften + Entfeuchten**. Der Server
    kannte bis WK-06b nur den Kühlstrom; wer Lüften getrennt misst, sah dort
    eine andere Zahl als im eigenen Cockpit.

    ⚠ Diese Probe ist zugleich der Beleg, dass das Feld **nicht**
    `…kuehlen_abzug…` heißen darf: Es trägt hier 30 kWh, die kein Kühlen sind.
    """
    anlage_id = await _anlage(db, getrennt=False, verbrauch_daten={
        "stromverbrauch_kwh": 1000.0,
        "heizenergie_kwh": WAERME_HEIZEN,
        "warmwasser_kwh": WAERME_WARMWASSER,
        # GEMESSENE Betriebsart-Zähler (der gemessene Zweig)
        "betriebsart_strom_heizen_kwh": 800.0,
        "betriebsart_strom_kuehlen_kwh": 100.0,
        "betriebsart_strom_lueften_kwh": 20.0,
        "betriebsart_strom_entfeuchten_kwh": 10.0,
    })
    juli = _juli(await prepare_community_data(db, anlage_id))

    assert juli["wp_strom_kuehlen_kwh"] == pytest.approx(100.0, abs=0.1)
    assert juli["wp_strom_funktionsfremd_abzug_kwh"] == pytest.approx(130.0, abs=0.1), (
        "Kühlen 100 + Lüften 20 + Entfeuchten 10 — alle drei liegen im "
        "Gesamtzähler und haben keine bewertete Nutzenergie."
    )


@pytest.mark.asyncio
async def test_f5_mit_gemessenem_kuehlzaehler_zieht_die_volle_menge_ab(db):
    """**Die Gegenprobe (W-16b).** Gemessen schlägt abgeleitet — dann wird abgezogen.

    Bei getrennter Strommessung **mit** Betriebsart-Zähler ist der Kühlstrom zum
    Topf **addiert** (`get_wp_strom_kwh`, W-16); er steht also im Nenner und muss
    heraus. Ohne diese Probe wäre der Bau auch dann grün, wenn das Feld
    **immer** 0 lieferte — und niemand bekäme je wieder einen Abzug.
    """
    anlage_id = await _anlage(db, getrennt=True, verbrauch_daten={
        "strom_heizen_kwh": F5_STROM_HEIZEN,
        "strom_warmwasser_kwh": F5_STROM_WARMWASSER,
        "heizenergie_kwh": WAERME_HEIZEN,
        "warmwasser_kwh": WAERME_WARMWASSER,
        # GEMESSENER Kühlzähler neben den zwei F5-Zählern
        "betriebsart_strom_kuehlen_kwh": KUEHLANTEIL,
    })
    juli = _juli(await prepare_community_data(db, anlage_id))

    assert juli["wp_strom_kuehlen_kwh"] == pytest.approx(100.0, abs=0.1)
    assert juli["wp_strom_funktionsfremd_abzug_kwh"] == pytest.approx(100.0, abs=0.1), (
        "Gemessen ⇒ der Anteil ist im Nenner enthalten ⇒ ganz abziehen."
    )
    # Und der Nenner, den der Server daraus bildet, ist derselbe wie lokal:
    assert juli["wp_stromverbrauch_kwh"] - juli[
        "wp_strom_funktionsfremd_abzug_kwh"
    ] == pytest.approx(950.0, abs=0.1)
