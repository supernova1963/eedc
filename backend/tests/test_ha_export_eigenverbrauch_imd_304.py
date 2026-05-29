"""Regressionstest #304: HA-Export-Eigenverbrauchsquote bei IMD-basierten Setups.

Bug: HA-Export sourcte PV korrekt aus InvestitionMonatsdaten, las aber
Eigen-/Direkt-/Gesamtverbrauch aus den *berechneten Legacy-Feldern* in
`Monatsdaten` (`eigenverbrauch_kwh` etc.). Diese bleiben bei modernen
IMD-basierten Setups leer (nur CSV/JSON-Import füllt sie) → Eigenverbrauch
kollabierte gegen die korrekt aus IMD aggregierte PV-Summe → Quote 2,2 %
statt ~40 %.

Fix: zentraler SoT-Helper `berechne_verbrauchs_kennzahlen` rechnet Eigen-/
Direkt-/Gesamtverbrauch aus PV(IMD) + Speicher(IMD) + Zählerwerten.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.ha_export import calculate_anlage_sensors
from backend.core.berechnungen import berechne_verbrauchs_kennzahlen
from backend.models import Anlage, Investition, InvestitionMonatsdaten, Monatsdaten, Strompreis


# ── Helper-Unit-Tests (kanonische Formel) ───────────────────────────────────

def test_helper_mit_speicher():
    k = berechne_verbrauchs_kennzahlen(
        pv_erzeugung_kwh=1000, einspeisung_kwh=300, netzbezug_kwh=200,
        speicher_ladung_kwh=150, speicher_entladung_kwh=120,
    )
    # direkt = 1000 - 300 - 150 = 550; eigen = 550 + 120 = 670; gesamt = 870
    assert k.direktverbrauch_kwh == pytest.approx(550)
    assert k.eigenverbrauch_kwh == pytest.approx(670)
    assert k.gesamtverbrauch_kwh == pytest.approx(870)
    assert k.eigenverbrauchsquote_prozent == pytest.approx(67.0)
    assert k.autarkie_prozent == pytest.approx(670 / 870 * 100)


def test_helper_ohne_speicher():
    k = berechne_verbrauchs_kennzahlen(
        pv_erzeugung_kwh=12000, einspeisung_kwh=7200, netzbezug_kwh=360,
    )
    assert k.eigenverbrauch_kwh == pytest.approx(4800)
    assert k.eigenverbrauchsquote_prozent == pytest.approx(40.0)


def test_helper_pv_null_keine_division():
    k = berechne_verbrauchs_kennzahlen(
        pv_erzeugung_kwh=0, einspeisung_kwh=0, netzbezug_kwh=500,
    )
    assert k.eigenverbrauch_kwh == 0
    assert k.eigenverbrauchsquote_prozent == 0
    assert k.gesamtverbrauch_kwh == pytest.approx(500)


def test_helper_ev_quote_gedeckelt():
    # Mess-Toleranz: eigenverbrauch > pv darf nicht > 100 % liefern
    k = berechne_verbrauchs_kennzahlen(
        pv_erzeugung_kwh=100, einspeisung_kwh=0, netzbezug_kwh=0,
        speicher_entladung_kwh=50,
    )
    assert k.eigenverbrauchsquote_prozent == 100


# ── Integration: HA-Export bei IMD-Setup mit leeren Legacy-Feldern ──────────

async def test_ha_export_eigenverbrauch_aus_imd_nicht_legacy(db):
    """PV aus IMD (12×1000), Legacy-Monatsdaten-Eigenverbrauch leer (None).
    Vor dem Fix: EV-Quote ~0 %. Nach dem Fix: ~40 %."""
    anlage = Anlage(anlagenname="IMD-Test", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()

    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2024, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=30.0, einspeiseverguetung_cent_kwh=8.2,
    ))

    # Zählerwerte: einspeisung 600/Monat (Σ 7200), netzbezug 30/Monat.
    # eigenverbrauch_kwh BEWUSST None (Legacy-Feld leer = Bug-Bedingung).
    for monat in range(1, 13):
        db.add(Monatsdaten(
            anlage_id=anlage.id, jahr=2025, monat=monat,
            einspeisung_kwh=600.0, netzbezug_kwh=30.0,
            eigenverbrauch_kwh=None, direktverbrauch_kwh=None,
            gesamtverbrauch_kwh=None,
        ))

    pv = Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach Süd",
        anschaffungsdatum=date(2024, 1, 1), leistung_kwp=10.0,
    )
    db.add(pv)
    await db.flush()
    for monat in range(1, 13):
        db.add(InvestitionMonatsdaten(
            investition_id=pv.id, jahr=2025, monat=monat,
            verbrauch_daten={"pv_erzeugung_kwh": 1000.0},
        ))
    await db.flush()

    sensors = await calculate_anlage_sensors(db, anlage)

    def _val(key):
        s = next((s for s in sensors if s.definition.key == key), None)
        assert s is not None, f"Sensor {key} fehlt"
        return s.value

    # PV = 12000; eigenverbrauch = 12000 - 7200 = 4800; ev_quote = 40 %
    assert _val("pv_erzeugung_gesamt_kwh") == pytest.approx(12000, abs=1)
    assert _val("eigenverbrauch_gesamt_kwh") == pytest.approx(4800, abs=1)
    ev_quote = _val("eigenverbrauch_quote_prozent")
    assert ev_quote == pytest.approx(40.0, abs=0.5), (
        f"EV-Quote {ev_quote}% — vor #304-Fix kollabierte sie gegen ~0 %, "
        f"weil die leeren Legacy-Monatsdaten-Felder summiert wurden."
    )
