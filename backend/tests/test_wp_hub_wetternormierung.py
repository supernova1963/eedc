"""Die Wetternormierung an der Route — Komponenten-Hub → Wärme/Klima → Vergleich.

**SOLL Wärme/Klima §4.1 „SOLL — Wetternormierung" (SOLL-§9-E8) · §3.3/S1+S3 ·
ADR-002/P4.** Die Heizgradtage sind eine Eigenschaft der **Anlage**, nicht des
Geräts; der Zähler (Heizstrom bzw. Heizwärme) ist eine Eigenschaft des Geräts.
Diese Datei misst die Naht dazwischen — an der **Route**, mit Einzelwerten, nicht
an einem nachgebildeten Ausdruck.

Schwesterdateien: ``test_heizgradtage.py`` (die Formel),
``test_mitteltemperatur.py`` (der DB-Eingang samt K-2).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen.heizgradtage import GRUND_KEINE_TEMPERATURREIHE
from backend.models import Anlage, Investition  # noqa: F401
from backend.models.investition import InvestitionMonatsdaten
from backend.models.sensor_snapshot import SensorSnapshot  # noqa: F401
from backend.models.tages_energie_profil import TagesEnergieProfil

_WP_PARAMETER = {
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


async def _wp(db, anlage, bezeichnung: str, monate: list[tuple[int, int, dict]]):
    inv = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung=bezeichnung,
        anschaffungsdatum=date(2023, 1, 1), anschaffungskosten_gesamt=15000.0,
        parameter=dict(_WP_PARAMETER),
    )
    db.add(inv)
    await db.flush()
    for jahr, monat, daten in monate:
        db.add(InvestitionMonatsdaten(
            investition_id=inv.id, jahr=jahr, monat=monat,
            verbrauch_daten=daten,
        ))
    return inv


async def _temperatur(db, anlage_id: int, jahr: int, monat: int,
                      tage: int, grad: float):
    """``tage`` Kalendertage des Monats mit je einer Stundenzeile."""
    for tag in range(1, tage + 1):
        db.add(TagesEnergieProfil(
            anlage_id=anlage_id, datum=date(jahr, monat, tag), stunde=12,
            temperatur_c=grad,
        ))


async def _hub(db, anlage_id: int) -> list[dict]:
    from backend.api.routes.investitionen.dashboards import (
        get_waermepumpe_dashboard,
    )
    geraete = await get_waermepumpe_dashboard(
        anlage_id, strompreis_cent=None, db=db,
    )
    return [(g.zusammenfassung or {}) for g in geraete]


_MONAT_MIT_F5 = {
    "stromverbrauch_kwh": 300.0,
    "strom_heizen_kwh": 268.6,
    "strom_warmwasser_kwh": 31.4,
    "heizenergie_kwh": 1200.0,
    "warmwasser_kwh": 90.0,
}


# ═══ B14 — die Reihe liegt an, mit Definition ═══════════════════════════════

@pytest.mark.asyncio
async def test_b14_heizgradtage_und_heizgrenze_liegen_an_der_route_an(db):
    """30 Tage à 5 °C im November ⇒ 300,0 Kd, dazu die Heizgrenze selbst.

    Die Heizgrenze reist mit, damit der Herkunftssatz im Client sie nicht ein
    zweites Mal führen muss (eine Zahl, eine Quelle).
    """
    a = await _anlage(db, "B14")
    await _wp(db, a, "Daikin", [(2025, 11, dict(_MONAT_MIT_F5))])
    await _temperatur(db, a.id, 2025, 11, 30, 5.0)
    await db.commit()

    (z,) = await _hub(db, a.id)
    assert z["heizgrenze_c"] == pytest.approx(15.0)
    liste = z["heizgradtage_je_monat"]
    assert len(liste) == 1
    assert liste[0] == {
        "jahr": 2025, "monat": 11, "kd": 300.0,
        "tage_mit_temperatur": 30, "tage_im_monat": 30,
    }
    assert z["heizgradtage_grund"] is None, "die Reihe deckt die Historie"


@pytest.mark.asyncio
async def test_b14b_der_zaehler_der_normierung_liegt_daneben(db):
    """Der Client braucht **beides** aus derselben Antwort: 268,6 kWh Heizstrom
    (R2-bereinigt, aus `jaz_je_monat`) über 300,0 Kd ⇒ 0,895 kWh/Kd.

    ⚠ Gemessen wird hier die **Herkunft**, nicht der Quotient: dass
    `heizen_nenner_kwh` den Heizstrom trägt und **nicht** die 300,0 kWh
    Gesamtstrom (in denen die 31,4 kWh Warmwasser stecken).
    """
    a = await _anlage(db, "B14b")
    await _wp(db, a, "Daikin", [(2025, 11, dict(_MONAT_MIT_F5))])
    await _temperatur(db, a.id, 2025, 11, 30, 5.0)
    await db.commit()

    (z,) = await _hub(db, a.id)
    (zeile,) = z["jaz_je_monat"]
    assert zeile["heizen_nenner_kwh"] == pytest.approx(268.6)
    assert zeile["heizen_zaehler_kwh"] == pytest.approx(1200.0)
    assert zeile["strom_kwh"] == pytest.approx(300.0), "der Gesamtstrom daneben"
    kd = z["heizgradtage_je_monat"][0]["kd"]
    assert zeile["heizen_nenner_kwh"] / kd == pytest.approx(0.895, abs=0.001)


# ═══ B15 — keine Reihe ⇒ der Grund, nicht ein Strich (S3) ══════════════════

@pytest.mark.asyncio
async def test_b15_ohne_temperaturspur_steht_der_grund_da(db):
    """Eine Anlage ohne jede Temperaturmessung: leere Liste **und** ein Satz.

    Das ist die S3-Regel („eine Sicht, die weniger zeigt, sagt warum") — ein
    „—" ohne Grund ist die häufigste Beschwerde dieser Fläche.
    """
    a = await _anlage(db, "B15")
    await _wp(db, a, "Daikin", [(2025, 11, dict(_MONAT_MIT_F5))])
    await db.commit()

    (z,) = await _hub(db, a.id)
    assert z["heizgradtage_je_monat"] == []
    assert z["heizgradtage_grund"] == GRUND_KEINE_TEMPERATURREIHE


@pytest.mark.asyncio
async def test_b15b_juengere_messreihe_nennt_ihren_beginn(db):
    """⭐ **Der Demo-Fall, und der wichtigste Satz der ganzen Fläche.**

    Winter 24/25 ist **vollständig gepflegt** (Heizstrom im Strom-Modus
    sichtbar), trotzdem gibt es dort keinen normierten Balken — weil die
    Temperaturreihe erst 09/2025 beginnt. Ohne den Satz liest der Anwender
    „eedc hat meine Daten von 2024 verloren".
    """
    a = await _anlage(db, "B15b")
    await _wp(db, a, "Daikin", [
        (2024, 11, dict(_MONAT_MIT_F5)),
        (2025, 11, dict(_MONAT_MIT_F5)),
    ])
    await _temperatur(db, a.id, 2025, 9, 18, 7.0)
    await _temperatur(db, a.id, 2025, 11, 30, 5.0)
    await db.commit()

    (z,) = await _hub(db, a.id)
    grund = z["heizgradtage_grund"]
    assert grund is not None and "09/2025" in grund
    assert [(h["jahr"], h["monat"]) for h in z["heizgradtage_je_monat"]] == [
        (2025, 9), (2025, 11),
    ]
    assert z["heizgradtage_je_monat"][0]["tage_mit_temperatur"] == 18
    assert z["heizgradtage_je_monat"][0]["tage_im_monat"] == 30


# ═══ B16 — Anlagengröße, nicht Gerätegröße ═════════════════════════════════

@pytest.mark.asyncio
async def test_b16_zwei_geraete_teilen_dieselbe_temperaturreihe(db):
    """Zwei Wärmepumpen an einem Standort sehen **dasselbe** Wetter.

    ⚠ Die Probe vergleicht die **Listen**, nicht ihre Länge: Würde die Reihe je
    Gerät geladen und dabei auf dessen Monate gefiltert, wären beide Listen
    verschieden lang **und** verschieden befüllt — die zweite Wärmepumpe hat
    nur einen der beiden Monate.
    """
    a = await _anlage(db, "B16")
    await _wp(db, a, "Erdgeschoss", [
        (2025, 10, dict(_MONAT_MIT_F5)),
        (2025, 11, dict(_MONAT_MIT_F5)),
    ])
    await _wp(db, a, "Dachgeschoss", [(2025, 11, dict(_MONAT_MIT_F5))])
    await _temperatur(db, a.id, 2025, 10, 31, 8.0)
    await _temperatur(db, a.id, 2025, 11, 30, 5.0)
    await db.commit()

    zusammenfassungen = await _hub(db, a.id)
    assert len(zusammenfassungen) == 2
    erste, zweite = (z["heizgradtage_je_monat"] for z in zusammenfassungen)
    assert erste == zweite
    assert [(h["monat"], h["kd"]) for h in erste] == [(10, 217.0), (11, 300.0)]
