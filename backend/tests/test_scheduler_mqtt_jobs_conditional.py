"""
Akzeptanztest: MQTT-Snapshot-Jobs nur bei aktivem MQTT-Inbound (#322).

detLAN sah „MQTT Live/Energy Snapshot executed successfully" alle 5 Min in den
System-Logs, obwohl er kein MQTT konfiguriert hatte. Ursache: die Jobs wurden
bedingungslos beim Scheduler-Start registriert und liefen leer. Jetzt werden sie
erst über add_mqtt_snapshot_jobs() registriert, das main.py nach erfolgreichem
MQTT-Inbound-Start aufruft.
"""

from __future__ import annotations

import pytest

from backend.services.scheduler import EEDCScheduler, SCHEDULER_AVAILABLE

MQTT_JOB_IDS = [
    "mqtt_energy_snapshot",
    "mqtt_energy_cleanup",
    "mqtt_live_snapshot",
    "mqtt_live_cleanup",
]


@pytest.mark.skipif(not SCHEDULER_AVAILABLE, reason="APScheduler nicht installiert")
async def test_mqtt_jobs_fehlen_ohne_inbound():
    """Nach Scheduler-Start sind ohne MQTT-Inbound keine MQTT-Jobs registriert."""
    sched = EEDCScheduler()
    assert sched.start()
    try:
        for jid in MQTT_JOB_IDS:
            assert sched._scheduler.get_job(jid) is None, f"{jid} unerwartet registriert"
        # Kerngeschäft läuft trotzdem (Stichprobe)
        assert sched._scheduler.get_job("monthly_snapshot") is not None
    finally:
        sched.stop()


@pytest.mark.skipif(not SCHEDULER_AVAILABLE, reason="APScheduler nicht installiert")
async def test_mqtt_jobs_nach_aktivierung_vorhanden():
    """add_mqtt_snapshot_jobs() registriert alle vier MQTT-Jobs (idempotent)."""
    sched = EEDCScheduler()
    assert sched.start()
    try:
        assert sched.add_mqtt_snapshot_jobs() is True
        for jid in MQTT_JOB_IDS:
            assert sched._scheduler.get_job(jid) is not None, f"{jid} fehlt"
        # Zweiter Aufruf (Reconnect) registriert nicht doppelt / wirft nicht
        assert sched.add_mqtt_snapshot_jobs() is True
        for jid in MQTT_JOB_IDS:
            assert sched._scheduler.get_job(jid) is not None
    finally:
        sched.stop()


@pytest.mark.skipif(not SCHEDULER_AVAILABLE, reason="APScheduler nicht installiert")
async def test_add_mqtt_jobs_ohne_running_scheduler_false():
    """Ohne laufenden Scheduler liefert add_mqtt_snapshot_jobs() False statt Crash."""
    sched = EEDCScheduler()
    assert sched.add_mqtt_snapshot_jobs() is False
