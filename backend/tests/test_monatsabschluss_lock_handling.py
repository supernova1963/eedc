"""Regression #291: SQLite-Lock-Erkennung im Monatsabschluss-Wizard.

Hintergrund kingcap1 (2026-05-23): bei parallelem Cloud-Import/Vollbackfill
liefen Schreibtransaktionen im Backfill-Aggregator > 10s offen, der Wizard
bekam beim Provenance-Log-INSERT `database is locked` und gab dem Tester
einen SQL-Dump als 500. Der Fix in `wizard.py:_wizard_save_fehler` muss
solche Lock-Fehler als 503 + Retry-Hinweis übersetzen, andere DB-Fehler
weiter als 500 durchlassen.

Der separate Strukturfix — per-Tag-Commit in `energie_profil/backfill.py` —
ist in `test_backfill_per_tag_commit.py` abgedeckt.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from backend.api.routes.monatsabschluss.wizard import (
    _ist_lock_fehler,
    _wizard_save_fehler,
)


def _make_lock_error(sql: str = "INSERT INTO data_provenance_log ...") -> OperationalError:
    """SQLAlchemy-Wrapped OperationalError simulieren — Form wie bei kingcap1."""
    return OperationalError(sql, {}, Exception("database is locked"))


def test_ist_lock_fehler_erkennt_sqlalchemy_wrapped() -> None:
    assert _ist_lock_fehler(_make_lock_error())


def test_ist_lock_fehler_erkennt_direkten_string() -> None:
    assert _ist_lock_fehler(Exception("database is locked"))


def test_ist_lock_fehler_ignoriert_andere_db_fehler() -> None:
    assert not _ist_lock_fehler(Exception("UNIQUE constraint failed"))
    assert not _ist_lock_fehler(Exception("no such column: foo"))


def test_wizard_save_fehler_lock_gibt_503_mit_retry_hinweis() -> None:
    exc = _wizard_save_fehler(_make_lock_error(), "Fehler beim Speichern")
    assert isinstance(exc, HTTPException)
    assert exc.status_code == 503
    assert "erneut speichern" in exc.detail.lower()
    # SQL-Detail darf NICHT im User-Text auftauchen
    assert "INSERT" not in exc.detail
    assert "data_provenance_log" not in exc.detail


def test_wizard_save_fehler_anderer_db_fehler_bleibt_500() -> None:
    exc = _wizard_save_fehler(
        Exception("UNIQUE constraint failed: monatsdaten.id"),
        "Fehler beim Speichern der Monatsdaten",
    )
    assert isinstance(exc, HTTPException)
    assert exc.status_code == 500
    assert "Fehler beim Speichern der Monatsdaten" in exc.detail
