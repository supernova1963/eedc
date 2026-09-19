"""
Aussichten API Routes

Prognosen und Vorhersagen für PV-Erträge:
- Kurzfristig (7-16 Tage): Basierend auf Wettervorhersagen
- Langfristig (Monate): Basierend auf PVGIS TMY und Trends
- Trend-Analyse: Historische Entwicklung

Seit 18.09.2026 ein Paket (Vorlage 7 des Refactorings grosser Dateien, reiner Umzug): ``schemas`` · ``basis`` ·
``prognose`` (kurzfristig, langfristig) · ``trend`` · ``wetter`` · ``finanzen`` — in dieser Reihenfolge eingehaengt, damit
/api/openapi.json die Routen wie bisher ordnet. Seit Vorlage 7b (18.09.2026) ist ``finanzen`` ein Orchestrator; seine zehn
Phasen liegen ohne eigene Router in ``finanz_eingaenge`` · ``finanz_rueckblick`` · ``finanz_prognose`` · ``finanz_zerlegung``.
Diese Fassade exportiert die bisherigen Namen weiter (main.py, Tests).
"""

from fastapi import APIRouter

from backend.api.routes.aussichten.schemas import (  # noqa: F401 — Re-Export
    TagesPrognoseSchema,
    KurzfristPrognoseResponse,
    MonatsPrognoseSchema,
    TrendAnalyseSchema,
    LangfristPrognoseResponse,
    JahresVergleichSchema,
    SaisonaleMusterSchema,
    DegradationSchema,
    TrendAnalyseResponse,
    WetterVorhersageTag,
    WetterVorhersageResponse,
    FinanzPrognoseMonatSchema,
    KomponentenBeitragSchema,
    ErtragJeInvestitionSchema,
    FinanzPrognoseResponse,
)
from backend.api.routes.aussichten.basis import (  # noqa: F401 — Re-Export
    TEMP_COEFFICIENT,
    MONATSNAMEN,
    _lade_anlage_mit_pv,
)
from backend.api.routes.aussichten.prognose import (  # noqa: F401 — Re-Export
    router as _prognose_router,
    get_kurzfrist_prognose,
    get_langfrist_prognose,
)
from backend.api.routes.aussichten.trend import (  # noqa: F401 — Re-Export
    router as _trend_router,
    get_trend_analyse,
)
from backend.api.routes.aussichten.wetter import (  # noqa: F401 — Re-Export
    router as _wetter_router,
    get_wetter_vorhersage,
)
from backend.api.routes.aussichten.finanzen import (  # noqa: F401 — Re-Export
    router as _finanzen_router,
    get_finanz_prognose,
)

router = APIRouter()
router.include_router(_prognose_router)
router.include_router(_trend_router)
router.include_router(_wetter_router)
router.include_router(_finanzen_router)

__all__ = [
    "router",
    "TagesPrognoseSchema",
    "KurzfristPrognoseResponse",
    "MonatsPrognoseSchema",
    "TrendAnalyseSchema",
    "LangfristPrognoseResponse",
    "JahresVergleichSchema",
    "SaisonaleMusterSchema",
    "DegradationSchema",
    "TrendAnalyseResponse",
    "WetterVorhersageTag",
    "WetterVorhersageResponse",
    "FinanzPrognoseMonatSchema",
    "KomponentenBeitragSchema",
    "ErtragJeInvestitionSchema",
    "FinanzPrognoseResponse",
    "TEMP_COEFFICIENT",
    "MONATSNAMEN",
    "_lade_anlage_mit_pv",
    "get_kurzfrist_prognose",
    "get_langfrist_prognose",
    "get_trend_analyse",
    "get_wetter_vorhersage",
    "get_finanz_prognose",
]
