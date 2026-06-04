"""
Akzeptanztest: Daten-Checker erkennt gleiche Sensor-Entity bei Wallbox + E-Auto.

#314-Untersuchung: Ist dieselbe HA-Entity sowohl einer Wallbox- als auch einer
E-Auto-Investition zugeordnet, zählt die Aggregation die Ladung doppelt (der
Live-Pfad dedupliziert sie). Der Check macht das deterministisch aus dem
sensor_mapping sichtbar — Brücke vor Phase 2a (kanonische Quelle).
"""

from __future__ import annotations

from sqlalchemy import select as _select
from sqlalchemy.orm import selectinload

from backend.models import Anlage
from backend.models.investition import Investition
from backend.services.daten_checker import (
    CheckKategorie,
    CheckSeverity,
    DatenChecker,
)


async def _seed(db, sensor_mapping: dict) -> int:
    anlage = Anlage(anlagenname="Test", leistung_kwp=10.0, standort_land="DE",
                    sensor_mapping=sensor_mapping)
    db.add(anlage)
    await db.flush()
    wb = Investition(anlage_id=anlage.id, typ="wallbox", bezeichnung="Wallbox")
    ea = Investition(anlage_id=anlage.id, typ="e-auto", bezeichnung="E-Auto")
    db.add_all([wb, ea])
    await db.flush()
    return anlage.id, str(wb.id), str(ea.id)


async def _run(db, anlage_id: int):
    anlage = (await db.execute(
        _select(Anlage).where(Anlage.id == anlage_id)
        .options(selectinload(Anlage.investitionen))
    )).scalar_one()
    return DatenChecker(db)._check_emob_sensor_doppelmapping(anlage)


def _warnungen(ergebnisse):
    return [e for e in ergebnisse
            if e.kategorie == CheckKategorie.EMOB_POOL_PFLEGE.value
            and e.schwere == CheckSeverity.WARNING.value]


async def test_geteilte_live_entity_meldet_warnung(db):
    """Gleiche leistung_w-Entity bei WB + EA → WARNING."""
    # Mapping erst leer, dann mit gemeinsamer Entity füllen (IDs erst nach flush)
    aid, wb_id, ea_id = await _seed(db, {})
    anlage = (await db.execute(_select(Anlage).where(Anlage.id == aid))).scalar_one()
    anlage.sensor_mapping = {"investitionen": {
        wb_id: {"live": {"leistung_w": "sensor.charge_power"}},
        ea_id: {"live": {"leistung_w": "sensor.charge_power"}},
    }}
    await db.commit()

    warn = _warnungen(await _run(db, aid))
    assert len(warn) == 1
    assert "sensor.charge_power" in warn[0].details


async def test_geteilter_kwh_zaehler_meldet_warnung(db):
    """Gleicher ladung_kwh-Zähler (felder.sensor_id) bei WB + EA → WARNING."""
    aid, wb_id, ea_id = await _seed(db, {})
    anlage = (await db.execute(_select(Anlage).where(Anlage.id == aid))).scalar_one()
    anlage.sensor_mapping = {"investitionen": {
        wb_id: {"felder": {"ladung_kwh": {"strategie": "sensor", "sensor_id": "sensor.evcc"}}},
        ea_id: {"felder": {"ladung_kwh": {"strategie": "sensor", "sensor_id": "sensor.evcc"}}},
    }}
    await db.commit()

    warn = _warnungen(await _run(db, aid))
    assert len(warn) == 1
    assert "sensor.evcc" in warn[0].details


async def test_unterschiedliche_sensoren_keine_warnung(db):
    """Getrennte Entities → keine Warnung (legitime separate Messung)."""
    aid, wb_id, ea_id = await _seed(db, {})
    anlage = (await db.execute(_select(Anlage).where(Anlage.id == aid))).scalar_one()
    anlage.sensor_mapping = {"investitionen": {
        wb_id: {"live": {"leistung_w": "sensor.wb_power"}},
        ea_id: {"live": {"leistung_w": "sensor.ea_power"}},
    }}
    await db.commit()

    assert _warnungen(await _run(db, aid)) == []


async def test_kein_mapping_keine_warnung(db):
    """Ohne sensor_mapping → keine Warnung (kein Crash)."""
    aid, _wb, _ea = await _seed(db, {})
    await db.commit()
    assert _warnungen(await _run(db, aid)) == []
