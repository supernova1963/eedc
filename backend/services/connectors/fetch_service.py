"""
Connector Fetch Service.

Gemeinsamer End-zu-End-Pfad für den Zählerstand-Abruf eines Connectors:
liest die kumulativen kWh-Zählerstände vom Gerät und speichert den Snapshot
in `anlage.connector_config["meter_snapshots"]` (+ `last_fetch`).

Wird vom manuellen Endpoint (`POST /connectors/fetch/{anlage_id}`) und vom
täglichen Scheduler-Job (`connector_daily_poll_job`, #300) aufgerufen —
ein Pfad als Source of Truth, damit beide exakt denselben Effekt haben.

Die Propagation in den Monatsbericht ist read-seitig: `/connectors/monatswerte`
und der Monatsabschluss berechnen die Monats-Differenz aus den gespeicherten
Snapshots. Ein Snapshot pro Tag genügt daher, damit sich die Vorschlagswerte
ohne manuelles „Aktuelle Daten anfordern" füllen.
"""

import base64
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm.attributes import flag_modified

from backend.models.anlage import Anlage
from backend.services.activity_service import log_activity
from backend.services.connectors import get_connector

logger = logging.getLogger(__name__)


class ConnectorNotConfigured(Exception):
    """Anlage hat keinen (gültigen) Connector konfiguriert."""


# Kumulative kWh-Felder eines MeterSnapshots (für Differenz-Berechnung).
SNAPSHOT_KWH_FELDER = [
    "pv_erzeugung_kwh",
    "einspeisung_kwh",
    "netzbezug_kwh",
    "batterie_ladung_kwh",
    "batterie_entladung_kwh",
    "wallbox_ladung_kwh",
]


def decode_password(encoded: str) -> str:
    """Base64-Decoding für das in der connector_config gespeicherte Passwort."""
    if not encoded:
        return ""
    try:
        return base64.b64decode(encoded.encode()).decode()
    except Exception:
        return encoded


def get_latest_snapshot(snapshots: dict) -> Optional[dict]:
    """Gibt den neuesten Snapshot zurück (nach ISO-Timestamp-Key sortiert)."""
    if not snapshots:
        return None
    latest_key = max(snapshots.keys())
    return snapshots[latest_key]


def calc_difference(prev: dict, current: dict) -> dict:
    """Berechnet die Differenz zwischen zwei kumulativen Snapshots (in kWh)."""
    diff: dict = {}
    for feld in SNAPSHOT_KWH_FELDER:
        curr_val = current.get(feld)
        prev_val = prev.get(feld)
        if curr_val is not None and prev_val is not None:
            diff[feld] = round(curr_val - prev_val, 2)
    return diff


async def fetch_and_store_snapshot(anlage: Anlage) -> dict:
    """Liest die Zählerstände vom konfigurierten Connector und speichert sie.

    Mutiert `anlage.connector_config` (Snapshot + `last_fetch`) inkl.
    `flag_modified` — der Commit liegt beim Aufrufer (Endpoint via
    `get_db`-Dependency, Scheduler-Job via `get_session`).

    Raises:
        ConnectorNotConfigured: keine Config oder unbekannter Connector-Typ.
        Exception: Lesefehler vom Gerät (bereits als Activity geloggt);
            der Aufrufer entscheidet über HTTP 502 bzw. Fehler-Zähler.

    Returns:
        {"snapshot": dict, "differenz": dict | None, "timestamp": iso-str}
    """
    config = anlage.connector_config
    if not config:
        raise ConnectorNotConfigured("Kein Connector konfiguriert")

    connector_id = config.get("connector_id")
    try:
        connector = get_connector(connector_id)
    except ValueError:
        raise ConnectorNotConfigured(f"Unbekannter Connector: {connector_id}")

    host = config.get("host")
    username = config.get("username", "User")
    password = decode_password(config.get("password", ""))

    try:
        snapshot = await connector.read_meters(host, username, password)
    except Exception as e:
        logger.exception(f"Fehler beim Auslesen: {e}")
        await log_activity(
            kategorie="connector_fetch",
            aktion="Zählerstand-Abruf fehlgeschlagen",
            erfolg=False,
            details=f"{type(e).__name__}: {str(e)}",
            anlage_id=anlage.id,
        )
        raise

    now = datetime.now(timezone.utc).isoformat()
    snapshots = config.get("meter_snapshots", {})

    prev_snapshot = get_latest_snapshot(snapshots)
    differenz = None
    if prev_snapshot:
        differenz = calc_difference(prev_snapshot, snapshot.to_dict())

    snapshots[now] = snapshot.to_dict()
    config["meter_snapshots"] = snapshots
    config["last_fetch"] = now

    anlage.connector_config = config
    flag_modified(anlage, "connector_config")

    await log_activity(
        kategorie="connector_fetch",
        aktion="Zählerstand abgelesen",
        erfolg=True,
        details_json=snapshot.to_dict(),
        anlage_id=anlage.id,
    )

    return {
        "snapshot": snapshot.to_dict(),
        "differenz": differenz,
        "timestamp": now,
    }
