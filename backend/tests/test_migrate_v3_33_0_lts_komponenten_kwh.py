"""
Tests für die v3.33.0-Migration zur historischen Bereinigung der
LTS-Aggregator-Drift in `TagesZusammenfassung.komponenten_kwh` (Issue #290).

Die Migration ruft `backfill_range` pro Anlage über das betroffene
Fenster (16.5. bis gestern). Wir mocken `backfill_range`, prüfen aber,
dass es für die richtigen Anlagen mit dem richtigen Fenster aufgerufen
wird.
"""

from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from backend.services.migrations import migrate_v3_33_0_lts_komponenten_kwh as M


@pytest.mark.asyncio
async def test_migration_uebersprungen_wenn_bug_zukunft(monkeypatch):
    """Wenn `gestern < BUG_EINGEFUEHRT` (z.B. Backdated-Test) — kein Aufruf."""
    session = AsyncMock()
    morgen = date.today() + timedelta(days=2)
    monkeypatch.setattr(M, "BUG_EINGEFUEHRT", morgen)

    with patch("backend.services.migrations.migrate_v3_33_0_lts_komponenten_kwh.aggregate_day",
               new=AsyncMock(return_value=None)) as ag:
        await M.migrate_lts_komponenten_kwh_bug(session)

    ag.assert_not_called()


@pytest.mark.asyncio
async def test_migration_skipped_anlagen_ohne_sensor_mapping():
    """Anlagen ohne sensor_mapping werden übersprungen."""
    from unittest.mock import MagicMock

    session = AsyncMock()
    anlagen_result = MagicMock()
    anlagen_result.all.return_value = [
        (1, "Anlage1", None),
    ]
    session.execute = AsyncMock(return_value=anlagen_result)

    with patch("backend.services.migrations.migrate_v3_33_0_lts_komponenten_kwh.aggregate_day",
               new=AsyncMock(return_value=None)) as ag:
        with patch("backend.services.activity_service.log_activity",
                   new=AsyncMock()):
            await M.migrate_lts_komponenten_kwh_bug(session)

    ag.assert_not_called()


@pytest.mark.asyncio
async def test_migration_ruft_aggregate_day_pro_existierendem_tz_tag():
    """Anlage mit sensor_mapping + 3 TZ-Tagen → 3 aggregate_day-Aufrufe."""
    from unittest.mock import MagicMock

    session = AsyncMock()

    anlagen_result = MagicMock()
    anlagen_result.all.return_value = [(7, "Test", {"basis": {}})]
    tage_result = MagicMock()
    tage_result.all.return_value = [
        (M.BUG_EINGEFUEHRT,),
        (M.BUG_EINGEFUEHRT + timedelta(days=1),),
        (M.BUG_EINGEFUEHRT + timedelta(days=2),),
    ]

    call_count = {"n": 0}

    async def fake_execute(*args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return anlagen_result
        return tage_result

    session.execute = fake_execute
    fake_anlage = MagicMock(id=7, sensor_mapping={"basis": {}})
    session.get = AsyncMock(return_value=fake_anlage)
    session.rollback = AsyncMock()
    session.commit = AsyncMock()

    ag_mock = AsyncMock(return_value=object())
    with patch("backend.services.migrations.migrate_v3_33_0_lts_komponenten_kwh.aggregate_day",
               new=ag_mock):
        with patch("backend.services.activity_service.log_activity",
                   new=AsyncMock()):
            await M.migrate_lts_komponenten_kwh_bug(session)

    # Genau 3 aggregate_day-Aufrufe, alle für anlage_obj=fake_anlage
    assert ag_mock.await_count == 3
    # datenquelle=monatsabschluss bei allen Aufrufen
    for call in ag_mock.await_args_list:
        kwargs = call.kwargs
        assert kwargs.get("datenquelle") == "monatsabschluss"
    # Per-Tag-Commit
    assert session.commit.await_count == 3


@pytest.mark.asyncio
async def test_migration_skipped_anlage_ohne_tz_im_zeitraum():
    """Anlage mit sensor_mapping, aber 0 TZ-Tage im Bug-Zeitraum → kein aggregate_day."""
    from unittest.mock import MagicMock

    session = AsyncMock()

    anlagen_result = MagicMock()
    anlagen_result.all.return_value = [(8, "Frisch", {"basis": {}})]
    tage_result = MagicMock()
    tage_result.all.return_value = []  # keine Tage

    call_count = {"n": 0}

    async def fake_execute(*args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return anlagen_result
        return tage_result

    session.execute = fake_execute
    session.get = AsyncMock()

    ag_mock = AsyncMock(return_value=None)
    with patch("backend.services.migrations.migrate_v3_33_0_lts_komponenten_kwh.aggregate_day",
               new=ag_mock):
        with patch("backend.services.activity_service.log_activity",
                   new=AsyncMock()):
            await M.migrate_lts_komponenten_kwh_bug(session)

    ag_mock.assert_not_called()
    session.get.assert_not_called()
