"""Regressionstest #260 (NongJoWo): Cockpit-Übersicht E-Mobilität rechnet die
Benzin-Ersparnis mit dem per-Monat gepflegten EU-OB-Kraftstoffpreis aus
`Monatsdaten`, nicht mit dem statischen Investitions-Parameter (1,80-Default).

Vorgeschichte: Mehrere Drift-Quellen wurden v3.31.3–v3.31.8 gefixt. Übrig
blieb, dass `get_cockpit_uebersicht` den Skalar-Helper `berechne_eauto_ersparnis`
mit dem festen Param-Preis aufrief, während E-Auto-Dashboard + Monatsberichte
den per-Monat-Preis nutzen → zwei Sichten, zwei Zahlen. Fix: Übersicht ruft
jetzt `berechne_eauto_ersparnis_periode` mit km pro Monat + Monatspreis-Lookup.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht
from backend.models import Anlage, Investition, InvestitionMonatsdaten, Monatsdaten

# E-Auto: 1000 km im April, 7 L/100km Vergleich, Param-Benzinpreis 1,80 €.
# Monatspreis (EU-OB) für April: 1,50 €.
#   benzin (Monatspreis) = 1000/100 × 7 × 1,50 = 105 €
#   benzin (Param-Bug)   = 1000/100 × 7 × 1,80 = 126 €
# Heim-Netzladung 0 → strom_kosten 0 → ersparnis == benzin_kosten.
_PARAM = {
    "ist_dienstlich": False,
    "benzinpreis_euro": 1.80,
    "vergleich_verbrauch_l_100km": 7.0,
}


async def _seed(db, *, kraftstoffpreis: float | None) -> int:
    anlage = Anlage(anlagenname="Test #260", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Monatsdaten(
        anlage_id=anlage.id, jahr=2026, monat=4,
        netzbezug_kwh=100.0, einspeisung_kwh=200.0,
        kraftstoffpreis_euro=kraftstoffpreis,
    ))
    inv = Investition(
        anlage_id=anlage.id, typ="e-auto", bezeichnung="E-Auto",
        anschaffungsdatum=date(2024, 1, 1), parameter=_PARAM,
    )
    db.add(inv)
    await db.flush()
    db.add(InvestitionMonatsdaten(
        investition_id=inv.id, jahr=2026, monat=4,
        verbrauch_daten={"km_gefahren": 1000, "ladung_kwh": 0.0,
                         "ladung_netz_kwh": 0.0, "ladung_pv_kwh": 0.0},
    ))
    await db.commit()
    return anlage.id


async def test_uebersicht_nutzt_monats_benzinpreis(db):
    """Monatspreis 1,50 € gepflegt → Ersparnis 105 € (nicht 126 € aus Param)."""
    anlage_id = await _seed(db, kraftstoffpreis=1.50)
    result = await get_cockpit_uebersicht(anlage_id=anlage_id, jahr=None, db=db)
    assert result.emob_ersparnis_euro == pytest.approx(105.0, abs=1.0), (
        f"Erwartet ~105 € (Monatspreis 1,50 €), war {result.emob_ersparnis_euro} € — "
        f"126 € hieße: statischer Param-Preis 1,80 € (der #260-Bug)."
    )


async def test_uebersicht_fallback_auf_param_ohne_monatspreis(db):
    """Kein Monatspreis (None) → Fallback auf Param-Benzinpreis 1,80 € = 126 €."""
    anlage_id = await _seed(db, kraftstoffpreis=None)
    result = await get_cockpit_uebersicht(anlage_id=anlage_id, jahr=None, db=db)
    assert result.emob_ersparnis_euro == pytest.approx(126.0, abs=1.0), (
        f"Ohne Monatspreis greift der Param-Default 1,80 € → ~126 €, "
        f"war {result.emob_ersparnis_euro} €."
    )
