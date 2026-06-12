"""#328: Asynchroner Cloud-Import-Job (fetch-async + fetch-status).

Lange Cloud-Abrufe (z. B. Anker SOLIX: viele Monate × 3 Datenbereiche ×
Drosselung) liefen als synchroner Request in Browser/Ingress-Timeouts
("Failed to fetch"), obwohl das Backend weiterlief. Der Abruf läuft jetzt als
Hintergrund-Job, dessen Status gepollt wird. Diese Tests sichern den
Job-Lebenszyklus (done / error / leer / 404 / unbekannter Provider).

Die Route-Funktionen werden direkt aufgerufen (wie test_cloud_credentials_
maskierung). Der per asyncio.create_task gestartete Job wird über die im
Job-Store gehaltene Task-Referenz abgewartet.
"""

import pytest
from fastapi import HTTPException

from backend.api.routes import cloud_import
from backend.api.routes.cloud_import import (
    FetchPreviewRequest,
    _import_jobs,
    fetch_async,
    fetch_status,
)
from backend.services.cloud_import.base import CloudProviderInfo
from backend.services.import_parsers.base import ParsedMonthData


class _FakeProvider:
    def __init__(self, months=None, exc=None):
        self._months = months or []
        self._exc = exc

    def info(self) -> CloudProviderInfo:
        return CloudProviderInfo(
            id="fake", name="Fake", hersteller="X",
            beschreibung="", anleitung="",
        )

    async def fetch_monthly_data(self, creds, sy, sm, ey, em):
        if self._exc:
            raise self._exc
        return self._months


def _req() -> FetchPreviewRequest:
    return FetchPreviewRequest(
        provider_id="fake", credentials={},
        start_year=2025, start_month=1, end_year=2025, end_month=2,
    )


async def _run_to_completion(job_id: str) -> None:
    """Auf den Hintergrund-Task warten (Referenz liegt im Job-Store)."""
    task = _import_jobs[job_id].task
    if task is not None:
        await task


@pytest.mark.asyncio
async def test_async_job_done(monkeypatch):
    months = [
        ParsedMonthData(jahr=2025, monat=1, pv_erzeugung_kwh=10.0, netzbezug_kwh=4.0),
    ]
    monkeypatch.setattr(
        cloud_import, "get_provider", lambda pid: _FakeProvider(months=months)
    )
    start = await fetch_async(_req())
    assert start.job_id

    # solange noch nicht abgewartet: running
    running = await fetch_status(start.job_id)
    assert running.status in ("running", "done")  # je nach Scheduling

    await _run_to_completion(start.job_id)
    done = await fetch_status(start.job_id)
    assert done.status == "done"
    assert done.result is not None
    assert done.result.anzahl_monate == 1
    assert done.result.monate[0].pv_erzeugung_kwh == 10.0
    assert done.result.monate[0].netzbezug_kwh == 4.0


@pytest.mark.asyncio
async def test_async_job_error_bei_exception(monkeypatch):
    monkeypatch.setattr(
        cloud_import, "get_provider",
        lambda pid: _FakeProvider(exc=RuntimeError("API kaputt")),
    )
    start = await fetch_async(_req())
    await _run_to_completion(start.job_id)
    status = await fetch_status(start.job_id)
    assert status.status == "error"
    assert "API kaputt" in (status.error or "")
    assert status.result is None


@pytest.mark.asyncio
async def test_async_job_leere_daten_ist_error(monkeypatch):
    monkeypatch.setattr(
        cloud_import, "get_provider", lambda pid: _FakeProvider(months=[])
    )
    start = await fetch_async(_req())
    await _run_to_completion(start.job_id)
    status = await fetch_status(start.job_id)
    assert status.status == "error"
    assert "Keine Monatsdaten" in (status.error or "")


@pytest.mark.asyncio
async def test_fetch_status_unbekannte_job_id_404():
    with pytest.raises(HTTPException) as exc:
        await fetch_status("gibt-es-nicht")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_fetch_async_unbekannter_provider_400(monkeypatch):
    def _raise(pid):
        raise ValueError("unbekannt")

    monkeypatch.setattr(cloud_import, "get_provider", _raise)
    with pytest.raises(HTTPException) as exc:
        await fetch_async(_req())
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_fetch_async_ungueltiger_zeitraum_400(monkeypatch):
    monkeypatch.setattr(
        cloud_import, "get_provider", lambda pid: _FakeProvider()
    )
    bad = FetchPreviewRequest(
        provider_id="fake", credentials={},
        start_year=2026, start_month=6, end_year=2025, end_month=1,  # Start > Ende
    )
    with pytest.raises(HTTPException) as exc:
        await fetch_async(bad)
    assert exc.value.status_code == 400
