"""N-531: der HA-Export würfelt auf den On-Demand-Wegen keinen Open-Meteo-Jitter.

`services/solar_forecast_service.get_solar_prognose` schläft vor jedem Open-Meteo-Abruf
``random.uniform(1, JITTER_MAX_SECONDS)`` Sekunden (Lastverteilung), wenn der Aufrufer
nicht ``skip_jitter=True`` übergibt. Der Prognose-Kanon fächert je Orientierungsgruppe
parallel auf, der Aufrufer wartet auf das Maximum — gemessen 26 s bei kaltem Cache
(cProfile: 27,4 s in ``epoll.poll``, vier Verbindungsfehler nach 12/16/26/26 s, offline).
Jede Sicht mit Bedienoberfläche überspringt den Jitter; der HA-Export war der einzige
Aufrufer des Kanons ohne den Schalter — und Home Assistants REST-Integration bricht nach
10 s ab.

Die Proben messen die Würfe (``random.uniform`` im Dienst wird aufgezeichnet), nicht die
Uhr: kein Wurf auf dem REST-Weg, dem Rechner mit Schalter und der Export-Prognose mit
Schalter; ein Wurf ohne Schalter (Gegenprobe — der Prüfer kann rot). Dazu ein Wächter für
die Verdrahtung: jeder On-Demand-Aufruf im Paket ``ha_export`` trägt ``skip_jitter=True``,
der Scheduler-Job bewusst nicht.
"""

from __future__ import annotations

import ast
from datetime import date
from pathlib import Path

import pytest

from backend.models import Anlage, Investition, Monatsdaten

_BACKEND = Path(__file__).resolve().parents[1]


async def _anlage(db) -> Anlage:
    anlage = Anlage(anlagenname="Jitter-Test", leistung_kwp=10.0, latitude=48.8, longitude=9.2,
                    standort_land="DE", prognose_quelle="eedc")
    db.add(anlage)
    await db.flush()
    db.add(Monatsdaten(anlage_id=anlage.id, jahr=2025, monat=1, netzbezug_kwh=100.0, einspeisung_kwh=200.0))
    db.add(Investition(anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach", leistung_kwp=10.0,
                       anschaffungsdatum=date(2024, 1, 1)))
    await db.flush()
    return anlage


@pytest.fixture
def wuerfe(monkeypatch):
    """Zeichnet jeden Jitter-Wurf des Dienstes auf; die Wartezeit selbst wird 0.

    Der Netzzugriff dahinter scheitert im Testlauf (conftest-Netzsperre) und landet im
    Negativ-Cache des Dienstes — der wird vor jeder Probe geleert, sonst überspringt die
    zweite Probe den Abruf samt Jitter und die Gegenprobe wäre still grün.
    """
    import httpx

    import backend.api.routes.ha_export.anlage_sensorwerte as sensorwerte
    import backend.services.solar_forecast_service as sfs
    from backend.services.wetter.cache import _cache, _error_cache

    protokoll: list[float] = []

    def _uniform(a, b):
        protokoll.append(float(b))
        return 0.0

    class _KeinNetz:
        """Ersetzt den httpx-Client: der Abruf scheitert sofort, ohne DNS — die Probe misst
        den Wurf davor, nicht das Netz (conftest würde den Versuch sonst als stillen
        Netz-Esser nennen, N-236)."""

        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            raise httpx.ConnectError("kein Netz im Test")

    async def _kein_preis(db, anlage):
        return None

    monkeypatch.setattr(sfs.random, "uniform", _uniform)
    monkeypatch.setattr(sfs.httpx, "AsyncClient", _KeinNetz)
    monkeypatch.setattr(sensorwerte, "berechne_preis_export", _kein_preis)   # aWATTar-Abruf ist nicht Gegenstand
    _cache.clear()
    _error_cache.clear()
    yield protokoll
    _cache.clear()
    _error_cache.clear()


async def test_export_prognose_mit_schalter_wuerfelt_nicht(db, wuerfe):
    from backend.services.ha_export_prognose import berechne_prognose_export

    anlage = await _anlage(db)
    await berechne_prognose_export(db, anlage, skip_jitter=True)
    assert wuerfe == [], f"Jitter-Würfe trotz skip_jitter=True: {wuerfe}"


async def test_gegenprobe_ohne_schalter_wuerfelt(db, wuerfe):
    """Der Prüfer kann rot: ohne Schalter würfelt der Dienst — so lief der Export bis N-531."""
    from backend.services.ha_export_prognose import berechne_prognose_export

    anlage = await _anlage(db)
    await berechne_prognose_export(db, anlage)
    assert len(wuerfe) >= 1, "ohne skip_jitter muss der Dienst würfeln — sonst misst die Probe nichts"


async def test_rechner_reicht_den_schalter_durch(db, wuerfe):
    from backend.api.routes.ha_export import calculate_anlage_sensors

    anlage = await _anlage(db)
    await calculate_anlage_sensors(db, anlage, skip_jitter=True)
    assert wuerfe == []


async def test_rest_sicht_wuerfelt_nicht(db, wuerfe):
    """Der Weg, den Home Assistant per REST mit 10 s Timeout abfragt."""
    from backend.api.routes.ha_export import get_anlage_sensors

    anlage = await _anlage(db)
    antwort = await get_anlage_sensors(anlage.id, db)
    assert antwort.anlage_id == anlage.id
    assert wuerfe == [], f"die REST-Sicht würfelt noch: {wuerfe}"


# ── Wächter: die Verdrahtung ──────────────────────────────────────────────────

def _aufrufe(pfad: Path, name: str) -> list[ast.Call]:
    baum = ast.parse(pfad.read_text(encoding="utf-8"))
    return [
        n for n in ast.walk(baum)
        if isinstance(n, ast.Call) and getattr(n.func, "id", None) == name
    ]


def _skip_jitter(call: ast.Call):
    for kw in call.keywords:
        if kw.arg == "skip_jitter":
            return kw.value.value if isinstance(kw.value, ast.Constant) else kw.value
    return None


def test_jeder_on_demand_aufruf_im_paket_traegt_den_schalter():
    """REST-Sichten und Publish-Knopf: jeder Aufruf der Rechner bzw. des Publish-Pfads
    im Paket `api/routes/ha_export` übergibt `skip_jitter=True`."""
    gesehen = 0
    fehlend: list[str] = []
    for datei in ("sensoren.py", "mqtt.py"):
        pfad = _BACKEND / "api" / "routes" / "ha_export" / datei
        for name in ("calculate_anlage_sensors", "publish_anlage_sensors"):
            for call in _aufrufe(pfad, name):
                gesehen += 1
                if _skip_jitter(call) is not True:
                    fehlend.append(f"{datei}::{name} (Z. {call.lineno})")
    assert gesehen >= 4, f"die Erfassung sieht nur {gesehen} Aufrufe — 18.09.2026 waren es 4"
    assert not fehlend, "On-Demand-Aufrufe ohne skip_jitter=True:\n  " + "\n  ".join(fehlend)


def test_der_scheduler_job_behaelt_den_jitter():
    """Gegenrichtung: der Cron-Job läuft bei allen Installationen zur selben Minute — der
    Jitter ist dort die Lastverteilung bei Open-Meteo und bleibt (kein `skip_jitter=True`)."""
    calls = _aufrufe(_BACKEND / "services" / "scheduler.py", "publish_anlage_sensors")
    assert calls, "der Scheduler ruft publish_anlage_sensors nicht mehr — Erfassung prüfen"
    assert all(_skip_jitter(c) is not True for c in calls), "der Job darf den Jitter nicht überspringen"
