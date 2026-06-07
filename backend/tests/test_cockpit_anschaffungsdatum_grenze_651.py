"""Cockpit-Übersicht: Anschaffungsdatum-Grenze für Energiebilanz + ROI.

Schwester zu test_aussichten_anschaffungsdatum_grenze_651.py: Das Cockpit
summierte Einspeisung/Netzbezug/Einspeise-Erlös/EV über ALLE Monatsdaten, ohne
das aktive PV-Fenster zu prüfen — asymmetrisch zum kumulierten Amortisations-Pfad
in aussichten und zu WP/E-Auto/BKW (die über ist_aktiv_im_monat filtern).

Entscheidung Gernot 2026-06-07: Das Anschaffungsdatum ist der EINZIGE
Manipulationshebel und muss konsequent überall ziehen — daher auch im Cockpit
([[feedback_anschaffungsdatum_grenze]], [[feedback_aggregator_symmetrie]]).
Monate vor PV-Inbetriebnahme fließen nun nicht mehr in Bilanz/Erträge ein.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht
from backend.models import Anlage, Investition, Monatsdaten
from backend.models.investition import InvestitionMonatsdaten


async def _seed(db, *, pv_anschaffung: date) -> int:
    """Monatsdaten 2024 + 2025 (Einspeisung 300, Netzbezug 100 je Monat).
    PV-IMD nur 2025. Die PV-Anschaffung steuert, welche Monate als PV-aktiv
    gelten und damit in Energiebilanz + Erträge einfließen."""
    anlage = Anlage(anlagenname="CGrenze", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    for jahr in (2024, 2025):
        for monat in range(1, 13):
            db.add(Monatsdaten(
                anlage_id=anlage.id, jahr=jahr, monat=monat,
                einspeisung_kwh=300.0, netzbezug_kwh=100.0,
            ))
    pv = Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
        anschaffungsdatum=pv_anschaffung, leistung_kwp=10.0,
        anschaffungskosten_gesamt=12000.0,
    )
    db.add(pv)
    await db.flush()
    for monat in range(1, 13):
        db.add(InvestitionMonatsdaten(
            investition_id=pv.id, jahr=2025, monat=monat,
            verbrauch_daten={"pv_erzeugung_kwh": 800.0},
        ))
    await db.commit()
    return anlage.id


async def test_vor_pv_monate_nicht_in_bilanz(db):
    """PV seit 2025 → nur die 12 Monate 2025 zählen in Einspeisung/Netzbezug,
    nicht die 24 Monate 2024+2025."""
    anlage_id = await _seed(db, pv_anschaffung=date(2025, 1, 1))
    res = await get_cockpit_uebersicht(anlage_id=anlage_id, jahr=None, db=db)
    # 12 × 300 = 3600 (nur 2025), vor dem Fix 24 × 300 = 7200.
    assert res.einspeisung_kwh == pytest.approx(3600.0), (
        f"einspeisung_kwh={res.einspeisung_kwh} — Vor-PV-Monate (2024) "
        f"dürfen nicht mitzählen."
    )
    assert res.netzbezug_kwh == pytest.approx(1200.0)
    assert res.einspeise_erloes_euro > 0


async def test_pv_grenze_symmetrie_2024_vs_2025(db):
    """Differenztest: 'PV seit 2024' enthält die 2024-Einspeisung zusätzlich —
    der Einspeise-Erlös unterscheidet sich um genau diese 12 Monate."""
    a2024 = await _seed(db, pv_anschaffung=date(2024, 1, 1))
    a2025 = await _seed(db, pv_anschaffung=date(2025, 1, 1))
    r2024 = await get_cockpit_uebersicht(anlage_id=a2024, jahr=None, db=db)
    r2025 = await get_cockpit_uebersicht(anlage_id=a2025, jahr=None, db=db)

    # 2024 sieht 24 Monate Einspeisung, 2025 nur 12.
    assert r2024.einspeisung_kwh == pytest.approx(7200.0)
    assert r2025.einspeisung_kwh == pytest.approx(3600.0)
    # Einspeise-Erlös skaliert mit den zusätzlich gezählten Monaten (> 0).
    assert r2024.einspeise_erloes_euro > r2025.einspeise_erloes_euro
