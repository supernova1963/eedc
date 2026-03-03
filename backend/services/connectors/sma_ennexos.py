"""
SMA ennexOS Connector.

Verbindet sich über die lokale REST-API mit SMA Tripower X (und anderen ennexOS-Geräten)
und liest kumulative Zählerstände (kWh) aus.

Nutzt die pysma-plus Bibliothek für Auth, Token-Refresh und Sensor-Mapping.
"""

import logging
import ssl
from datetime import datetime, timezone
from typing import Optional

import aiohttp

from .base import DeviceConnector, ConnectorInfo, MeterSnapshot, ConnectionTestResult
from .registry import register_connector

logger = logging.getLogger(__name__)

# Sensor-Mapping: ennexOS Channel-Key → EEDC-Feld
# Reihenfolge = Priorität (erster verfügbarer Sensor gewinnt)
SENSOR_MAPPING: dict[str, list[str]] = {
    "pv_erzeugung_kwh": ["Metering.TotWhOut.Pv", "Metering.TotWhOut"],
    "einspeisung_kwh": ["Metering.GridMs.TotWhOut"],
    "netzbezug_kwh": ["Metering.GridMs.TotWhIn"],
    "batterie_ladung_kwh": ["Metering.GridMs.TotWhIn.Bat"],
    "batterie_entladung_kwh": ["Metering.GridMs.TotWhOut.Bat"],
}


def _create_ssl_context() -> ssl.SSLContext:
    """Erstellt SSL-Context der Self-Signed Certs akzeptiert (lokales Netzwerk)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


@register_connector
class SMAennexOSConnector(DeviceConnector):
    """Connector für SMA ennexOS Geräte (Tripower X, etc.)."""

    def info(self) -> ConnectorInfo:
        return ConnectorInfo(
            id="sma_ennexos",
            name="SMA ennexOS (Tripower X)",
            hersteller="SMA",
            beschreibung=(
                "Direkte Verbindung zum SMA Wechselrichter über die lokale ennexOS REST-API. "
                "Liest kumulative Zählerstände (PV-Erzeugung, Einspeisung, Netzbezug, Batterie) "
                "direkt vom Gerät aus."
            ),
            anleitung=(
                "1. IP-Adresse des Wechselrichters im lokalen Netzwerk ermitteln\n"
                "   (z.B. über Router-Oberfläche oder SMA Sunny Portal)\n"
                "2. Benutzername: 'User' (Standard für ennexOS Installer/User)\n"
                "3. Passwort: Das bei der Inbetriebnahme vergebene Geräte-Passwort\n"
                "4. Verbindung testen → Geräteinfo und aktuelle Zählerstände werden angezeigt\n"
                "5. Connector einrichten → Zählerstände werden gespeichert"
            ),
        )

    async def test_connection(
        self, host: str, username: str, password: str
    ) -> ConnectionTestResult:
        """Testet Verbindung zum ennexOS-Gerät und gibt Geräteinfo + aktuelle Werte zurück."""
        try:
            import pysmaplus
        except ImportError:
            return ConnectionTestResult(
                erfolg=False,
                fehler="pysma-plus Bibliothek nicht installiert. Bitte 'pip install pysma-plus' ausführen.",
            )

        url = f"https://{host}"
        ssl_ctx = _create_ssl_context()
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)

        try:
            async with aiohttp.ClientSession(connector=connector) as session:
                # Gerät erkennen und verbinden (getDevice ist synchron)
                device = pysmaplus.getDevice(
                    session, url, password, groupuser=username, accessmethod="ennexos"
                )
                if device is None:
                    return ConnectionTestResult(
                        erfolg=False,
                        fehler=f"Kein ennexOS-Gerät unter {url} gefunden. "
                        "Bitte IP-Adresse und Zugangsdaten prüfen.",
                    )

                # Session starten (Auth)
                auth_ok = await device.new_session()
                if not auth_ok:
                    return ConnectionTestResult(
                        erfolg=False,
                        fehler="Authentifizierung fehlgeschlagen. "
                        "Bitte Benutzername und Passwort prüfen.",
                    )

                try:
                    # Geräteliste abrufen
                    device_list = await device.device_list()
                    geraet_name = None
                    geraet_typ = None
                    seriennummer = None
                    firmware = None

                    if device_list:
                        # Erstes Gerät als Hauptgerät
                        first_device = next(iter(device_list.values()))
                        geraet_name = first_device.name
                        geraet_typ = first_device.type
                        seriennummer = first_device.serial
                        firmware = first_device.sw_version

                    # Sensoren abrufen
                    sensors = await device.get_sensors()
                    verfuegbare = [s.key for s in sensors if s.key]

                    # Aktuelle Werte lesen
                    await device.read(sensors)
                    snapshot = self._build_snapshot(sensors)

                    return ConnectionTestResult(
                        erfolg=True,
                        geraet_name=geraet_name,
                        geraet_typ=geraet_typ,
                        seriennummer=seriennummer,
                        firmware=firmware,
                        verfuegbare_sensoren=verfuegbare,
                        aktuelle_werte=snapshot,
                    )

                finally:
                    await device.close_session()

        except aiohttp.ClientConnectorError:
            return ConnectionTestResult(
                erfolg=False,
                fehler=f"Verbindung zu {url} fehlgeschlagen. "
                "Ist der Wechselrichter eingeschaltet und im Netzwerk erreichbar?",
            )
        except Exception as e:
            logger.exception(f"ennexOS Verbindungstest fehlgeschlagen: {e}")
            return ConnectionTestResult(
                erfolg=False,
                fehler=f"Verbindungsfehler: {type(e).__name__}: {str(e)}",
            )

    async def read_meters(
        self, host: str, username: str, password: str
    ) -> MeterSnapshot:
        """Liest aktuelle kumulative Zählerstände vom ennexOS-Gerät."""
        import pysmaplus

        url = f"https://{host}"
        ssl_ctx = _create_ssl_context()
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)

        async with aiohttp.ClientSession(connector=connector) as session:
            device = pysmaplus.getDevice(
                session, url, password, groupuser=username, accessmethod="ennexos"
            )
            if device is None:
                raise ConnectionError(f"Kein ennexOS-Gerät unter {url} gefunden.")

            auth_ok = await device.new_session()
            if not auth_ok:
                raise PermissionError("Authentifizierung fehlgeschlagen.")

            try:
                sensors = await device.get_sensors()
                await device.read(sensors)
                return self._build_snapshot(sensors)
            finally:
                await device.close_session()

    def _build_snapshot(self, sensors) -> MeterSnapshot:
        """Baut MeterSnapshot aus pysma-plus Sensor-Werten."""
        # Sensor-Werte nach Key indexieren
        sensor_values: dict[str, Optional[float]] = {}
        for s in sensors:
            if s.key and s.value is not None:
                try:
                    sensor_values[s.key] = float(s.value)
                except (ValueError, TypeError):
                    pass

        # EEDC-Felder aus Sensor-Mapping befüllen
        result: dict[str, Optional[float]] = {}
        for eedc_feld, sensor_keys in SENSOR_MAPPING.items():
            for key in sensor_keys:
                if key in sensor_values:
                    result[eedc_feld] = round(sensor_values[key], 2)
                    break

        return MeterSnapshot(
            timestamp=datetime.now(timezone.utc).isoformat(),
            pv_erzeugung_kwh=result.get("pv_erzeugung_kwh"),
            einspeisung_kwh=result.get("einspeisung_kwh"),
            netzbezug_kwh=result.get("netzbezug_kwh"),
            batterie_ladung_kwh=result.get("batterie_ladung_kwh"),
            batterie_entladung_kwh=result.get("batterie_entladung_kwh"),
        )
