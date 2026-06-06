"""Migration `_migrate_pv_erzeugung_aggregat_clear` — kWp-Verteilung-Etappe.

Stellt die Invariante her: `monatsdaten.pv_erzeugung_kwh` ist ein rein
manuelles Aggregat. Auto-Summen mit Pro-Modul-Werten im Monat werden geleert;
echte Aggregate ohne Pro-Modul-Werte bleiben. Idempotent.
[[project_kwp_verteilung_aggregator]].
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # eedc/
sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import create_engine, text  # noqa: E402

from backend.core.database import _migrate_pv_erzeugung_aggregat_clear  # noqa: E402


def _seed_db():
    """In-Memory SQLite mit monatsdaten/investitionen/investition_monatsdaten."""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE monatsdaten ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, anlage_id INTEGER, "
            "jahr INTEGER, monat INTEGER, pv_erzeugung_kwh FLOAT)"
        ))
        conn.execute(text(
            "CREATE TABLE investitionen ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, anlage_id INTEGER, typ VARCHAR(50))"
        ))
        conn.execute(text(
            "CREATE TABLE investition_monatsdaten ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, investition_id INTEGER, "
            "jahr INTEGER, monat INTEGER, verbrauch_daten TEXT)"
        ))
        # Anlage 1: Monat 05 hat Aggregat UND Pro-Modul-Werte → wird geleert.
        # Anlage 1: Monat 06 hat Aggregat, KEINE Pro-Modul-Werte → bleibt.
        # Anlage 2: Monat 05 Aggregat, Pro-Modul-IMD aber ohne pv_erzeugung_kwh → bleibt.
        conn.execute(text(
            "INSERT INTO monatsdaten (id, anlage_id, jahr, monat, pv_erzeugung_kwh) "
            "VALUES (1, 1, 2026, 5, 1000.0), (2, 1, 2026, 6, 800.0), "
            "(3, 2, 2026, 5, 500.0)"
        ))
        conn.execute(text(
            "INSERT INTO investitionen (id, anlage_id, typ) "
            "VALUES (10, 1, 'pv-module'), (20, 2, 'pv-module')"
        ))
        conn.execute(
            text("INSERT INTO investition_monatsdaten "
                 "(investition_id, jahr, monat, verbrauch_daten) VALUES (:i,:j,:m,:v)"),
            [
                {"i": 10, "j": 2026, "m": 5, "v": json.dumps({"pv_erzeugung_kwh": 600.0})},
                {"i": 20, "j": 2026, "m": 5, "v": json.dumps({"ladung_kwh": 5.0})},  # kein PV-Key
            ],
        )
    return engine


def _pv(engine, md_id):
    with engine.begin() as conn:
        return conn.execute(
            text("SELECT pv_erzeugung_kwh FROM monatsdaten WHERE id = :id"), {"id": md_id}
        ).scalar_one()


def test_leert_aggregat_mit_pro_modul_werten():
    engine = _seed_db()
    with engine.begin() as conn:
        _migrate_pv_erzeugung_aggregat_clear(conn)
    assert _pv(engine, 1) is None  # Auto-Summe geleert


def test_behaelt_echtes_aggregat_ohne_pro_modul():
    engine = _seed_db()
    with engine.begin() as conn:
        _migrate_pv_erzeugung_aggregat_clear(conn)
    assert _pv(engine, 2) == 800.0  # kein Pro-Modul → bleibt


def test_behaelt_aggregat_wenn_imd_keinen_pv_key_hat():
    engine = _seed_db()
    with engine.begin() as conn:
        _migrate_pv_erzeugung_aggregat_clear(conn)
    assert _pv(engine, 3) == 500.0  # IMD ohne pv_erzeugung_kwh zählt nicht


def test_idempotent():
    engine = _seed_db()
    with engine.begin() as conn:
        _migrate_pv_erzeugung_aggregat_clear(conn)
        _migrate_pv_erzeugung_aggregat_clear(conn)
    assert _pv(engine, 1) is None
    assert _pv(engine, 2) == 800.0
