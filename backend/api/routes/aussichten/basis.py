"""Aussichten — Konstanten und der gemeinsame Anlagen-Lader (`_lade_anlage_mit_pv`: Anlage, PV-Module,
Balkonkraftwerke, Anlagenleistung).
"""
# Reiner Umzug aus `api/routes/aussichten.py` (18.09.2026, Vorlage 7 des Refactorings grosser Dateien):
# Code 1:1 uebernommen, kein Verhaltenswechsel. Die Fassade `__init__.py` haengt den Router ein und exportiert
# die Namen weiter, die Aufrufer und Tests bisher aus dem Modul importierten.

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.core.exceptions import not_found
from backend.models.anlage import Anlage
from backend.models.investition import Investition
from backend.utils.investition_filter import aktiv_jetzt
from backend.core.berechnungen.erzeuger_traeger import erzeuger_traeger
from backend.core.investition_kennwerte import get_erzeuger_kwp


# =============================================================================
# Konstanten
# =============================================================================

# DEFAULT_SYSTEM_LOSSES: zentral in services/pv_orientation.py
TEMP_COEFFICIENT = 0.004  # Leistungsabnahme pro °C über 25°C

MONATSNAMEN = [
    "", "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
]

# =============================================================================
# Shared Helpers
# =============================================================================


async def _lade_anlage_mit_pv(
    db: AsyncSession,
    anlage_id: int,
    *,
    require_coords: bool = True,
) -> tuple["Anlage", list["Investition"], list["Investition"], float]:
    """Lädt Anlage + aktive PV-Module + BKW und berechnet Gesamtleistung.

    Returns:
        (anlage, pv_module, balkonkraftwerke, anlagenleistung_kwp)

    Raises:
        HTTPException 404/400 bei fehlenden Daten.
    """
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()

    if not anlage:
        raise not_found("Anlage")

    if require_coords and (not anlage.latitude or not anlage.longitude):
        raise HTTPException(
            status_code=400,
            detail="Anlage hat keine Koordinaten. Bitte Standort in Einstellungen konfigurieren."
        )

    # PV-Module + BKW in einer Query
    result = await db.execute(
        select(Investition).where(
            Investition.anlage_id == anlage_id,
            Investition.typ.in_(["pv-module", "balkonkraftwerk"]),
            aktiv_jetzt()
        )
    )
    alle_pv = result.scalars().all()
    pv_module = [i for i in alle_pv if i.typ == "pv-module"]
    balkonkraftwerke = [i for i in alle_pv if i.typ == "balkonkraftwerk"]

    # N36/P3: kWp über den SoT-Dispatcher (Spalte → `parameter.kwp`), nicht über
    # die Spalte allein. Ein Modul mit kWp nur im `parameter`-JSON zählte sonst
    # als 0 — die Aussichten rechneten mit einer Teilsumme, und der
    # `or anlage.leistung_kwp`-Fallback darunter greift nur bei Summe 0, nicht
    # bei gemischter Pflege.
    # A24-2: `get_erzeuger_kwp` statt `get_pv_kwp` — Letzterer kennt den
    # BKW-Zweig `leistung_wp × anzahl` nicht, ein so gepflegtes
    # Balkonkraftwerk fiel hier still auf 0 (Befund §4.1, Variante 7).
    # N-266: `erzeuger_traeger` lässt ein Balkonkraftwerk mit Modul-Kindern
    # heraus — es hat seine kWp abgetreten, und die Aussichten multiplizieren
    # diese Summe mit dem SOLL-Ertrag. Doppelt gezählt wäre die ganze
    # Jahresprognose doppelt.
    anlagenleistung_kwp = sum(
        get_erzeuger_kwp(i) for i in erzeuger_traeger([*pv_module, *balkonkraftwerke])
    )
    if anlagenleistung_kwp <= 0:
        anlagenleistung_kwp = anlage.leistung_kwp or 0

    return anlage, pv_module, balkonkraftwerke, anlagenleistung_kwp
