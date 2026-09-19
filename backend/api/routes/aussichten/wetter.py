"""Aussichten — Wettervorhersage.

GET /api/aussichten/wetter/{anlage_id} — Tageswerte der Vorhersage
"""
# Reiner Umzug aus `api/routes/aussichten.py` (18.09.2026, Vorlage 7 des Refactorings grosser Dateien):
# Code 1:1 uebernommen, kein Verhaltenswechsel. Die Fassade `__init__.py` haengt den Router ein und exportiert
# die Namen weiter, die Aufrufer und Tests bisher aus dem Modul importierten.

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.core.exceptions import bad_request, not_found
from backend.api.deps import get_db
from backend.models.anlage import Anlage
from backend.services.wetter.open_meteo import fetch_open_meteo_forecast
from backend.services.wetter.utils import wetter_symbol_aus_tag
from backend.services.wetter.models import WETTER_MODELLE
from backend.api.routes.aussichten.schemas import WetterVorhersageResponse, WetterVorhersageTag

router = APIRouter()


@router.get("/wetter/{anlage_id}", response_model=WetterVorhersageResponse)
async def get_wetter_vorhersage(
    anlage_id: int,
    tage: int = Query(default=7, ge=1, le=16, description="Anzahl Tage (1-16)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Reine Wettervorhersage ohne PV-Berechnung.

    Liefert Wetter-Icons, Temperaturen und Sonnenstunden für die nächsten Tage.
    """
    # Anlage laden
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()

    if not anlage:
        raise not_found("Anlage")

    if not anlage.latitude or not anlage.longitude:
        raise bad_request("Anlage hat keine Koordinaten")

    # Wettervorhersage (Wettermodell der Anlage berücksichtigen)
    wetter_modell = anlage.wetter_modell or "auto"
    model_name, _ = WETTER_MODELLE.get(wetter_modell, (None, 16))
    wetter = await fetch_open_meteo_forecast(
        latitude=anlage.latitude,
        longitude=anlage.longitude,
        days=tage,
        skip_jitter=True,
        model=model_name,
    )

    if not wetter:
        raise HTTPException(status_code=503, detail="Wettervorhersage nicht verfügbar")

    tage_liste = [
        WetterVorhersageTag(
            datum=tag["datum"],
            temperatur_max_c=tag["temperatur_max_c"],
            temperatur_min_c=tag["temperatur_min_c"],
            niederschlag_mm=tag["niederschlag_mm"],
            sonnenstunden=tag["sonnenstunden"],
            bewoelkung_prozent=tag["bewoelkung_prozent"],
            wetter_symbol=wetter_symbol_aus_tag(
                tag["wetter_code"],
                tag.get("bewoelkung_prozent"),
                tag.get("niederschlag_mm"),
            ),
        )
        for tag in wetter["tage"]
    ]

    return WetterVorhersageResponse(
        anlage_id=anlage_id,
        standort={
            "latitude": anlage.latitude,
            "longitude": anlage.longitude,
        },
        tage=tage_liste,
        abgerufen_am=wetter["abgerufen_am"],
    )
