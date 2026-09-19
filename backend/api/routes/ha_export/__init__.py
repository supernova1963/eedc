"""
Home Assistant Sensor Export API.

Ermöglicht das Exportieren von EEDC-KPIs als HA-Sensoren.
Unterstützt zwei Methoden:
1. REST API - HA liest Werte über rest platform
2. MQTT Discovery - Native HA-Entitäten via MQTT Auto-Discovery

Seit 18.09.2026 ein Paket (Vorlage 8 des Refactorings grosser Dateien, reiner Umzug): ``schemas`` · ``emob`` ·
``anlage_sensoren`` · ``investition_sensoren`` (die zwei Rechenkerne) · ``konfig`` · ``sensoren`` · ``mqtt`` (die Router,
in dieser Reihenfolge eingehaengt, damit /api/openapi.json die Routen wie bisher ordnet). Diese Fassade exportiert die
bisherigen Namen weiter (main.py, `services/ha_mqtt_sync.py`, Tests).
"""

from fastapi import APIRouter

from backend.api.routes.ha_export.schemas import (  # noqa: F401 — Re-Export
    MQTTConfigRequest,
    _hinweis,
    SensorExportItem,
    AnlageExport,
    InvestitionExport,
    FullExportResponse,
    HAYamlSnippet,
    MQTTConfigResponse,
    AutoPublishRequest,
    AbwahlRequest,
)
from backend.api.routes.ha_export.emob import (  # noqa: F401 — Re-Export
    _load_emob_pool_ctx,
)
from backend.api.routes.ha_export.anlage_sensoren import (  # noqa: F401 — Re-Export
    grundlast_sensorwert,
    calculate_anlage_sensors,
)
from backend.api.routes.ha_export.investition_sensoren import (  # noqa: F401 — Re-Export
    calculate_investition_sensors,
)
from backend.api.routes.ha_export.konfig import (  # noqa: F401 — Re-Export
    router as _konfig_router,
    get_mqtt_config,
    set_auto_publish,
    get_sensor_abwahl,
    set_sensor_abwahl,
)
from backend.api.routes.ha_export.sensoren import (  # noqa: F401 — Re-Export
    router as _sensoren_router,
    get_all_sensors,
    get_anlage_sensors,
    get_ha_yaml_snippet,
    get_sensor_definitions,
)
from backend.api.routes.ha_export.mqtt import (  # noqa: F401 — Re-Export
    router as _mqtt_router,
    test_mqtt_connection,
    publish_sensors_mqtt,
    remove_sensors_mqtt,
)

router = APIRouter(prefix="/ha/export", tags=["HA Export"])
router.include_router(_konfig_router)
router.include_router(_sensoren_router)
router.include_router(_mqtt_router)

__all__ = [
    "router",
    "MQTTConfigRequest",
    "_hinweis",
    "SensorExportItem",
    "AnlageExport",
    "InvestitionExport",
    "FullExportResponse",
    "HAYamlSnippet",
    "MQTTConfigResponse",
    "AutoPublishRequest",
    "AbwahlRequest",
    "_load_emob_pool_ctx",
    "grundlast_sensorwert",
    "calculate_anlage_sensors",
    "calculate_investition_sensors",
    "get_mqtt_config",
    "set_auto_publish",
    "get_sensor_abwahl",
    "set_sensor_abwahl",
    "get_all_sensors",
    "get_anlage_sensors",
    "get_ha_yaml_snippet",
    "get_sensor_definitions",
    "test_mqtt_connection",
    "publish_sensors_mqtt",
    "remove_sensors_mqtt",
]
