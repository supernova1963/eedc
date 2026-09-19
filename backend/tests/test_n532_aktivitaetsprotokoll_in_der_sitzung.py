"""N-532: das Aktivitätsprotokoll schreibt in der Sitzung des Aufrufers, nicht daneben.

`activity_service.log_activity` öffnete bis zum 19.09.2026 IMMER eine eigene
Sitzung. SQLite kennt einen Schreiber: hielt die Sitzung des Aufrufers nach einem
`flush()` den Schreib-Lock, wartete die zweite Verbindung den vollen
`busy_timeout` (30 s) ab, scheiterte mit „database is locked" — und die
Protokollzeile war weg. Gemessen Ende-zu-Ende auf einer r28-Kopie:
`POST /api/portal-import/apply/{id}` 30,11 s, `PUT /api/monatsdaten/{id}` und
`POST /api/monatsdaten/` je 30,09 s (die beiden seit F-73 in v4.0.47), jeweils
ohne Zeile im `activity_log`.

Die Regel ist deshalb eine für die Kategorie, nicht für die vier Stellen: **wer
eine Sitzung hält, gibt sie mit** — jede Aufrufstelle in einer Funktion mit
`db`-/`session`-Parameter und jede in einem `async with get_session() as x`-Block
trägt `db=`. Ohne Sitzung (Jobs nach abgeschlossenem Block, Gateway) bleibt die
eigene Sitzung richtig. Ein Prüfer zählt sich nicht selbst: die Erfassung muss
Aufrufstellen sehen, sonst wäre ein leerer Scan still grün.

Die Proben unten messen die Klasse an einer Datei-Datenbank mit kurzem
`busy_timeout`: mit übergebener Sitzung sofort und in derselben Transaktion,
mit eigener Sitzung hinter einem gehaltenen Lock verloren.
"""

from __future__ import annotations

import ast
import time
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core.database import Base
from backend.models.activity_log import ActivityLog
from backend.services import activity_service
from backend.services.activity_service import log_activity

_BACKEND = Path(__file__).resolve().parents[1]


# ── Wächter ──────────────────────────────────────────────────────────────────


def _aufrufstellen():
    """(Pfad, Funktion, Zeile, Sitzungsname, hat_db) je `log_activity`-Aufruf,
    der in einer Funktion mit Sitzung oder in einem `get_session`-Block liegt."""
    for pfad in sorted(_BACKEND.rglob("*.py")):
        if "tests" in pfad.parts or "venv" in pfad.parts or pfad.name == "activity_service.py":
            continue
        baum = ast.parse(pfad.read_text(encoding="utf-8-sig"))
        for fn in ast.walk(baum):
            if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            params = {a.arg for a in fn.args.args + fn.args.kwonlyargs}
            sitzung = "db" if "db" in params else ("session" if "session" in params else None)
            for node in ast.walk(fn):
                if not (
                    isinstance(node, ast.Call)
                    and getattr(node.func, "id", getattr(node.func, "attr", "")) == "log_activity"
                ):
                    continue
                name = sitzung
                for w in ast.walk(fn):
                    if isinstance(w, ast.AsyncWith) and w.lineno <= node.lineno <= w.end_lineno:
                        for it in w.items:
                            quelle = ast.unparse(it.context_expr)
                            if ("get_session" in quelle or "async_session_maker" in quelle) and it.optional_vars is not None:
                                name = ast.unparse(it.optional_vars)
                if name is None:
                    continue
                hat_db = any(kw.arg == "db" for kw in node.keywords)
                yield pfad.relative_to(_BACKEND).as_posix(), fn.name, node.lineno, name, hat_db


def test_jede_aufrufstelle_mit_sitzung_gibt_sie_mit():
    stellen = list(_aufrufstellen())
    assert len(stellen) >= 20, (
        f"Die Erfassung sieht nur {len(stellen)} Aufrufstellen mit Sitzung — am 19.09.2026 "
        "waren es 25. Erst den Prüfer richten, dann die Regel prüfen."
    )
    fehlend = [f"  {p}::{fn} (Z. {z}) — `db={name}` fehlt" for p, fn, z, name, hat in stellen if not hat]
    assert not fehlend, (
        f"{len(fehlend)} Aufrufstelle(n) protokollieren neben der eigenen Sitzung (N-532) — "
        "die zweite Verbindung wartet hinter dem Schreib-Lock 30 s und verliert die Zeile:\n"
        + "\n".join(fehlend)
    )


# ── Proben an einer Datei-Datenbank ──────────────────────────────────────────


@pytest.fixture
async def datei_db(tmp_path):
    """Datei-Datenbank mit kurzem Lock-Timeout: zwei Verbindungen, ein Schreiber."""
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path}/n532.db",
        connect_args={"timeout": 0.5},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()


@pytest.fixture
def eigene_sitzung_auf_datei(datei_db, monkeypatch):
    """`log_activity` ohne `db` öffnet seine eigene Sitzung auf derselben Datei."""

    @asynccontextmanager
    async def _get_session():
        async with datei_db() as session:
            yield session
            await session.commit()

    monkeypatch.setattr(activity_service, "get_session", _get_session)


async def _anzahl(factory, aktion: str) -> int:
    async with factory() as s:
        return (
            await s.execute(select(func.count()).select_from(ActivityLog).where(ActivityLog.aktion == aktion))
        ).scalar_one()


async def test_mit_sitzung_sofort_und_in_derselben_transaktion(datei_db, eigene_sitzung_auf_datei):
    async with datei_db() as db:
        db.add(ActivityLog(kategorie="probe", aktion="request", erfolg=True))
        await db.flush()  # hält den Schreib-Lock
        t0 = time.monotonic()
        await log_activity("probe", "mit-sitzung", db=db)
        dauer = time.monotonic() - t0
        assert dauer < 0.3, f"mit übergebener Sitzung darf nichts warten, gemessen {dauer:.2f} s"
        assert await _anzahl(datei_db, "mit-sitzung") == 0, "vor dem Commit des Aufrufers noch nicht sichtbar"
        await db.commit()
    assert await _anzahl(datei_db, "mit-sitzung") == 1


async def test_gegenprobe_eigene_sitzung_hinter_dem_lock_verliert_die_zeile(datei_db, eigene_sitzung_auf_datei):
    """Die Klasse, die N-532 behebt — hier mit 0,5 s statt 30 s Lock-Timeout."""
    async with datei_db() as db:
        db.add(ActivityLog(kategorie="probe", aktion="request", erfolg=True))
        await db.flush()
        t0 = time.monotonic()
        await log_activity("probe", "ohne-sitzung-hinter-lock")  # eigene Sitzung, blockiert
        dauer = time.monotonic() - t0
        await db.commit()
    assert dauer >= 0.4, f"die eigene Sitzung hätte am Lock warten müssen, gemessen {dauer:.2f} s"
    assert await _anzahl(datei_db, "ohne-sitzung-hinter-lock") == 0, "die Zeile ging verloren — das ist der Defekt"


async def test_ohne_sitzung_und_ohne_lock_schreibt_die_eigene_sitzung(datei_db, eigene_sitzung_auf_datei):
    """Der unveränderte Weg der Jobs: keine offene Transaktion, eigene Sitzung schreibt."""
    await log_activity("probe", "ohne-sitzung-frei", details="Job nach abgeschlossenem Block")
    assert await _anzahl(datei_db, "ohne-sitzung-frei") == 1
