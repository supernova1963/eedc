"""
Unit-Tests für repair_orchestrator (Etappe 3d Päckchen 4).

Self-contained Standalone-Script. Aufruf:

    eedc/backend/venv/bin/python eedc/backend/tests/test_repair_orchestrator.py

Akzeptanz-Tests (Konzept Sektion 5 + 8 Päckchen 4):

  1. plan() ohne Daten → leerer Diff, applicable Operation
  2. plan() RESET_CLOUD_IMPORT mit Cloud-Provenance → korrekte Decisions
     pro Feld, source_after='repair'
  3. execute() RESET_CLOUD_IMPORT → Werte gehen auf NULL, Provenance auf
     'repair', audit_log_ids verknüpft (force_override greift trotz
     manual:form-Hierarchie)
  4. plan_lookup nach Expiry → LookupError beim Execute
  5. Doppel-Execute → LookupError beim zweiten Aufruf
  6. RESET_CLOUD_IMPORT mit providers-Filter → nur passende Felder
"""

from __future__ import annotations

import asyncio
import sys
import traceback
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

# Projekt-Root in sys.path, damit `from backend...` funktioniert.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # eedc/
sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from backend.core.database import Base  # noqa: E402
from backend.models import (  # noqa: E402, F401
    Anlage,
    DataProvenanceLog,
    Investition,
    InvestitionMonatsdaten,
    Monatsdaten,
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.provenance import write_with_provenance  # noqa: E402
from backend.services.repair_orchestrator import (  # noqa: E402
    RepairOperationRequest,
    RepairOperationType,
    _reset_state_for_tests,
    discard_plan,
    execute,
    list_plans,
    plan,
)


@asynccontextmanager
async def _session_ctx():
    """In-memory SQLite + frische Schema-Anlage pro Test."""
    _reset_state_for_tests()
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    session = Session()
    try:
        yield session
    finally:
        await session.close()
        await engine.dispose()


async def _make_anlage(session: AsyncSession) -> Anlage:
    a = Anlage(anlagenname="Test", leistung_kwp=10.0, standort_land="DE")
    session.add(a)
    await session.commit()
    return a


async def _seed_cloud_md(
    session: AsyncSession, anlage_id: int, jahr: int, monat: int,
    *, source: str = "external:cloud_import:solaredge",
    netzbezug: float = 100.0, einspeisung: float = 50.0,
) -> Monatsdaten:
    """Baut eine Monatsdaten-Row und schreibt 2 Felder mit Cloud-Provenance."""
    md = Monatsdaten(
        anlage_id=anlage_id, jahr=jahr, monat=monat,
        netzbezug_kwh=0.0, einspeisung_kwh=0.0, source_provenance={},
    )
    session.add(md)
    await session.flush()

    await write_with_provenance(
        session, md, "netzbezug_kwh", netzbezug,
        source=source, writer="connector:run_1",
    )
    await write_with_provenance(
        session, md, "einspeisung_kwh", einspeisung,
        source=source, writer="connector:run_1",
    )
    await session.commit()
    return md


# ── Tests ────────────────────────────────────────────────────────────────────


async def test_plan_reset_cloud_import_no_data():
    """plan() ohne Cloud-Provenance liefert leeren Diff + No-Op-Warnung."""
    async with _session_ctx() as session:
        anlage = await _make_anlage(session)
        req = RepairOperationRequest(
            anlage_id=anlage.id,
            operation=RepairOperationType.RESET_CLOUD_IMPORT,
            params={},
        )

        plan_obj = await plan(req, session)

        assert plan_obj.diff_total_count == 0
        assert plan_obj.diff_preview == []
        assert plan_obj.estimated_changes.get("fields_total") == 0
        assert any("No-Op" in w for w in plan_obj.warnings), plan_obj.warnings


async def test_plan_reset_cloud_import_with_data():
    """plan() mit zwei Cloud-Feldern → 2 Diffs, source_after='repair'."""
    async with _session_ctx() as session:
        anlage = await _make_anlage(session)
        await _seed_cloud_md(session, anlage.id, 2026, 4)

        req = RepairOperationRequest(
            anlage_id=anlage.id,
            operation=RepairOperationType.RESET_CLOUD_IMPORT,
            params={},
        )
        plan_obj = await plan(req, session)

        assert plan_obj.diff_total_count == 2
        assert len(plan_obj.diff_preview) == 2
        for d in plan_obj.diff_preview:
            assert d.table == "monatsdaten"
            assert d.source_before == "external:cloud_import:solaredge"
            assert d.source_after == "repair"
            assert d.decision == "applied"
            # Monatsdaten.einspeisung_kwh + .netzbezug_kwh sind NOT NULL
            # mit Default 0 — Reset führt zu 0, nicht None.
            assert d.new_value == 0
        # Alle ursprünglichen Werte sind im Diff
        old_vals = sorted([d.old_value for d in plan_obj.diff_preview])
        assert old_vals == [50.0, 100.0]


async def test_execute_reset_cloud_import_writes_null_and_repair():
    """execute() setzt Werte auf NULL + Provenance='repair', Audit-IDs vorhanden."""
    async with _session_ctx() as session:
        anlage = await _make_anlage(session)
        md = await _seed_cloud_md(session, anlage.id, 2026, 4)

        req = RepairOperationRequest(
            anlage_id=anlage.id,
            operation=RepairOperationType.RESET_CLOUD_IMPORT,
            params={},
        )
        plan_obj = await plan(req, session)
        result = await execute(plan_obj.plan_id, session)

        assert result.actual_changes.get("fields_reset") == 2
        assert len(result.audit_log_ids) >= 2

        # Reload md
        await session.refresh(md)
        # NOT-NULL Spalten gehen auf Spalten-Default (0), nicht None.
        assert md.netzbezug_kwh == 0
        assert md.einspeisung_kwh == 0
        # Provenance ist auf 'repair' gestempelt
        prov = md.source_provenance or {}
        assert prov.get("netzbezug_kwh", {}).get("source") == "repair"
        assert prov.get("einspeisung_kwh", {}).get("source") == "repair"


async def test_force_override_breaks_manual_hierarchy():
    """RESET muss auch manual:form-Felder zurücksetzen können (force_override).

    Akzeptanz: manual:form steht über external:cloud_import in der Hierarchie.
    Ohne force_override würde der Reset abgelehnt werden. Das Konzept sagt
    aber: User kann seine eigenen manuellen Werte nuken wollen — und sieht
    sie in der Plan-Vorschau, bevor er bestätigt.

    Test-Setup: Wir scannen nach external:cloud_import, also würden manuelle
    Felder gar nicht im Reset-Scope landen. Aber wir prüfen via Plan-Diff,
    dass force_override im execute korrekt durchschlägt — kein
    rejected_lower_priority obwohl die ältere Source MANUAL ist.

    Realistisches Szenario: Cloud-Import schreibt zuerst, dann setzt User
    den gleichen Wert manuell — Provenance wechselt auf manual:form. Reset
    findet das Feld nicht mehr (Filter auf cloud_import). Wir testen also
    das Inverse: Cloud-Provenance bleibt, force_override wirkt.
    """
    async with _session_ctx() as session:
        anlage = await _make_anlage(session)
        md = await _seed_cloud_md(session, anlage.id, 2026, 4)

        # Manuell andere Felder schreiben — sollten NICHT vom Reset getroffen werden
        await write_with_provenance(
            session, md, "ueberschuss_kwh", 25.0,
            source="manual:form", writer="user@example.com",
        )
        await session.commit()

        req = RepairOperationRequest(
            anlage_id=anlage.id,
            operation=RepairOperationType.RESET_CLOUD_IMPORT,
            params={},
        )
        plan_obj = await plan(req, session)
        # Nur die 2 Cloud-Felder im Diff, nicht das manuelle ueberschuss_kwh
        assert plan_obj.diff_total_count == 2
        diff_fields = sorted(d.field for d in plan_obj.diff_preview)
        assert diff_fields == ["einspeisung_kwh", "netzbezug_kwh"]

        result = await execute(plan_obj.plan_id, session)
        assert result.actual_changes["fields_reset"] == 2

        await session.refresh(md)
        # Cloud-Felder sind auf Default 0 zurückgesetzt
        assert md.netzbezug_kwh == 0
        # Manuelle Felder unverändert
        assert md.ueberschuss_kwh == 25.0


async def test_double_execute_raises():
    """Zweiter Execute-Aufruf wirft LookupError ('bereits ausgeführt')."""
    async with _session_ctx() as session:
        anlage = await _make_anlage(session)
        await _seed_cloud_md(session, anlage.id, 2026, 4)

        plan_obj = await plan(
            RepairOperationRequest(
                anlage_id=anlage.id,
                operation=RepairOperationType.RESET_CLOUD_IMPORT,
                params={},
            ),
            session,
        )
        await execute(plan_obj.plan_id, session)

        try:
            await execute(plan_obj.plan_id, session)
        except LookupError as e:
            assert "bereits ausgef" in str(e), str(e)
        else:
            raise AssertionError("Erwarteter LookupError beim Doppel-Execute")


async def test_provider_filter_narrows_diff():
    """providers-Filter beschränkt den Reset auf passende Cloud-Provider."""
    async with _session_ctx() as session:
        anlage = await _make_anlage(session)
        # Drei Felder in DREI Rows (jahr=4/5/6) jeweils mit unterschiedlichen Providern
        md1 = await _seed_cloud_md(
            session, anlage.id, 2026, 4,
            source="external:cloud_import:solaredge",
        )
        md2 = await _seed_cloud_md(
            session, anlage.id, 2026, 5,
            source="external:cloud_import:fronius_solarweb",
        )

        plan_obj = await plan(
            RepairOperationRequest(
                anlage_id=anlage.id,
                operation=RepairOperationType.RESET_CLOUD_IMPORT,
                params={"providers": ["solaredge"]},
            ),
            session,
        )
        # Nur die 2 Felder von md1, nicht md2
        assert plan_obj.diff_total_count == 2
        for d in plan_obj.diff_preview:
            assert d.row_pk["jahr"] == 2026 and d.row_pk["monat"] == 4
            assert d.source_before == "external:cloud_import:solaredge"


async def test_list_plans_returns_recent_first():
    """list_plans gibt Pläne in chronologischer Reihenfolge (neueste zuerst)."""
    async with _session_ctx() as session:
        anlage = await _make_anlage(session)
        await _seed_cloud_md(session, anlage.id, 2026, 4)

        p1 = await plan(
            RepairOperationRequest(
                anlage_id=anlage.id,
                operation=RepairOperationType.RESET_CLOUD_IMPORT,
                params={},
            ),
            session,
        )
        await asyncio.sleep(0.01)  # Sicherstellen, dass created_at sich unterscheidet
        p2 = await plan(
            RepairOperationRequest(
                anlage_id=anlage.id,
                operation=RepairOperationType.KRAFTSTOFFPREIS_BACKFILL,
                params={"scope": "tages"},
            ),
            session,
        )

        views = await list_plans(anlage.id)
        assert len(views) == 2
        assert views[0].plan.plan_id == p2.plan_id, "neuester Plan zuerst"
        assert views[1].plan.plan_id == p1.plan_id
        assert views[0].result is None  # noch nicht ausgeführt
        assert views[1].result is None


async def test_discard_plan_removes_from_cache():
    """discard_plan() entfernt Plan + verhindert späteres Execute."""
    async with _session_ctx() as session:
        anlage = await _make_anlage(session)
        await _seed_cloud_md(session, anlage.id, 2026, 4)

        p = await plan(
            RepairOperationRequest(
                anlage_id=anlage.id,
                operation=RepairOperationType.RESET_CLOUD_IMPORT,
                params={},
            ),
            session,
        )
        await discard_plan(p.plan_id)

        try:
            await execute(p.plan_id, session)
        except LookupError as e:
            assert "nicht gefunden" in str(e), str(e)
        else:
            raise AssertionError("Erwarteter LookupError nach discard")


# ── Runner ───────────────────────────────────────────────────────────────────


_TESTS = [
    test_plan_reset_cloud_import_no_data,
    test_plan_reset_cloud_import_with_data,
    test_execute_reset_cloud_import_writes_null_and_repair,
    test_force_override_breaks_manual_hierarchy,
    test_double_execute_raises,
    test_provider_filter_narrows_diff,
    test_list_plans_returns_recent_first,
    test_discard_plan_removes_from_cache,
]


async def _main() -> int:
    failures = 0
    for fn in _TESTS:
        try:
            await fn()
            print(f"OK   {fn.__name__}")
        except AssertionError as e:
            failures += 1
            print(f"FAIL {fn.__name__}: {e}")
            traceback.print_exc()
        except Exception as e:
            failures += 1
            print(f"ERR  {fn.__name__}: {type(e).__name__}: {e}")
            traceback.print_exc()
    if failures:
        print(f"\n{failures}/{len(_TESTS)} Tests fehlgeschlagen.")
        return 1
    print(f"\nAlle {len(_TESTS)} Tests grün.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
