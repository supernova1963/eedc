"""Regression #291: Backfill committet pro Tag, nicht erst am Ende.

Hintergrund kingcap1: `backfill_range` und `backfill_from_statistics`
liefen vorher in einer einzigen offenen Transaktion über alle Tage. Bei
Vollbackfills mit > 50 Tagen blockierte das den SQLite-Writer-Lock über
viele Minuten — paralleler Wizard-Save scheiterte mit `database is locked`.

Dieser Test stellt sicher, dass `backfill_range` jetzt nach jedem
erfolgreichen Tag committet. Wenn jemand das wieder rausnimmt (z. B. um
„Atomarität herzustellen"), schlägt der Test fehl und der nächste
Reviewer findet den Hintergrund im Test-Docstring.
"""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_backfill_range_committet_pro_tag() -> None:
    from backend.models.anlage import Anlage
    from backend.services.energie_profil.backfill import backfill_range

    # Fake-Anlage reicht — aggregate_day wird gemockt
    anlage = Anlage(id=99)

    # Mock-Session mit Commit-/Rollback-Spies
    db = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    # aggregate_day liefert für jeden Tag ein Truthy-Result
    fake_result = object()
    with patch(
        "backend.services.energie_profil.backfill.aggregate_day",
        new=AsyncMock(return_value=fake_result),
    ) as ag_day:
        count = await backfill_range(
            anlage,
            date(2024, 2, 1),
            date(2024, 2, 5),  # 5 Tage
            db,
        )

    assert count == 5
    assert ag_day.await_count == 5
    # Pro erfolgreichem Tag ein Commit — exakt 5
    assert db.commit.await_count == 5
    assert db.rollback.await_count == 0


@pytest.mark.asyncio
async def test_backfill_range_rollback_bei_aggregate_fehler() -> None:
    """Bei einem Tag-Fehler: rollback statt commit, andere Tage laufen weiter."""
    from backend.models.anlage import Anlage
    from backend.services.energie_profil.backfill import backfill_range

    anlage = Anlage(id=99)
    db = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    # Tag 2 schlägt fehl, sonst OK
    call_count = {"n": 0}

    async def flaky(*args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise RuntimeError("HA history fetch failed")
        return object()

    with patch(
        "backend.services.energie_profil.backfill.aggregate_day",
        new=flaky,
    ):
        count = await backfill_range(
            anlage,
            date(2024, 2, 1),
            date(2024, 2, 3),  # 3 Tage
            db,
        )

    # 2 erfolgreiche Tage (1 + 3), Tag 2 schlug fehl
    assert count == 2
    assert db.commit.await_count == 2
    assert db.rollback.await_count == 1
