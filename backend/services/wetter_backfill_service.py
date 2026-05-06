"""
Wetter-Backfill aus Open-Meteo Archive.

Füllt fehlende stündliche Wetter-Spalten (bewoelkung_prozent, niederschlag_mm,
wetter_code) in TagesEnergieProfil rückwirkend aus Open-Meteo Archive nach.

Strikt additiv: existierende Werte werden NICHT überschrieben — nur Zellen mit
NULL-Wert werden befüllt. Mehrfachaufruf ist idempotent.

Hintergrund: Stündliche Wetter-Felder wurden v3.26 zur Datenbasis ergänzt.
Bestehende Anlagen haben mehrjährige Energie-Historie ohne Wetter-Klassifikation;
dieser Service füllt sie aus den Open-Meteo Archive-Daten (ERA5-Reanalyse, gratis,
2 Jahre rückwirkend).

Quota: ein Range-Call pro Anlage deckt die ganze Historie ab. Bei 2 Jahren
~17500 Stundenwerte in einer JSON-Antwort — Open-Meteo Free-Tier (10000 Calls/Tag)
unkritisch.

Lag: Archive hängt 2-5 Tage hinter Echtzeit. Letzte Tage werden hier nicht
angefasst — sie laufen normal über den Live-Forecast-Pfad in
energie_profil_service.aggregate_day().
"""

from datetime import date, timedelta
import logging
from typing import Optional

import httpx
from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.anlage import Anlage
from backend.models.tages_energie_profil import TagesEnergieProfil

logger = logging.getLogger(__name__)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
ARCHIVE_LAG_TAGE = 5  # letzte N Tage aus Forecast-Pfad, nicht aus Archive
DEFAULT_MAX_TAGE = 730  # 2 Jahre


async def wetter_backfill_anlage(
    anlage: Anlage,
    db: AsyncSession,
    max_tage: int = DEFAULT_MAX_TAGE,
) -> dict:
    """
    Füllt fehlende stündliche Wetter-Felder einer Anlage aus Open-Meteo Archive.

    Args:
        anlage: Anlage mit lat/lon. Ohne Koordinaten wird übersprungen.
        db: Async-Session mit aktiver Transaction.
        max_tage: Maximale Rückwärts-Tiefe in Tagen.

    Returns:
        dict mit status, tage_geupdated, stunden_geupdated, von, bis, fehler.
    """
    if not anlage.latitude or not anlage.longitude:
        return {"status": "skipped", "grund": "keine Koordinaten"}

    cutoff_alt = date.today() - timedelta(days=max_tage)
    cutoff_neu = date.today() - timedelta(days=ARCHIVE_LAG_TAGE)

    # Tage mit fehlenden Wetter-Feldern in Range identifizieren
    result = await db.execute(
        select(TagesEnergieProfil.datum)
        .where(
            and_(
                TagesEnergieProfil.anlage_id == anlage.id,
                TagesEnergieProfil.datum >= cutoff_alt,
                TagesEnergieProfil.datum < cutoff_neu,
                TagesEnergieProfil.bewoelkung_prozent.is_(None),
            )
        )
        .distinct()
    )
    fehlende_tage = sorted({r[0] for r in result.all()})

    if not fehlende_tage:
        return {"status": "ok", "tage_geupdated": 0, "stunden_geupdated": 0}

    von = fehlende_tage[0]
    bis = fehlende_tage[-1]

    params = {
        "latitude": anlage.latitude,
        "longitude": anlage.longitude,
        "timezone": "Europe/Berlin",
        "start_date": von.isoformat(),
        "end_date": bis.isoformat(),
        "hourly": "cloud_cover,precipitation,weather_code",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(ARCHIVE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error(
            f"Wetter-Backfill Anlage {anlage.id} ({von}–{bis}): "
            f"Open-Meteo Archive fehlgeschlagen: {e}"
        )
        return {"status": "error", "fehler": str(e)}

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    cloud_cover = hourly.get("cloud_cover", [])
    precip = hourly.get("precipitation", [])
    wcode = hourly.get("weather_code", [])

    fehlende_set = set(fehlende_tage)
    stunden_geupdated = 0
    tage_geupdated: set[date] = set()

    for i, t in enumerate(times):
        # t-Format: "2024-04-15T13:00"
        try:
            datum_obj = date.fromisoformat(t[:10])
            stunde = int(t[11:13])
        except Exception:
            continue

        if datum_obj not in fehlende_set:
            continue

        cc = cloud_cover[i] if i < len(cloud_cover) else None
        pr = precip[i] if i < len(precip) else None
        wc = wcode[i] if i < len(wcode) else None

        update_values: dict = {}
        if cc is not None:
            update_values["bewoelkung_prozent"] = round(cc, 0)
        if pr is not None:
            update_values["niederschlag_mm"] = round(pr, 2)
        if wc is not None:
            update_values["wetter_code"] = int(wc)

        if not update_values:
            continue

        # additiv: nur Zellen ohne Bewölkung updaten (Marker-Spalte)
        await db.execute(
            update(TagesEnergieProfil)
            .where(
                and_(
                    TagesEnergieProfil.anlage_id == anlage.id,
                    TagesEnergieProfil.datum == datum_obj,
                    TagesEnergieProfil.stunde == stunde,
                    TagesEnergieProfil.bewoelkung_prozent.is_(None),
                )
            )
            .values(**update_values)
        )
        stunden_geupdated += 1
        tage_geupdated.add(datum_obj)

    await db.commit()

    logger.info(
        f"Wetter-Backfill Anlage {anlage.id}: "
        f"{stunden_geupdated} Stunden / {len(tage_geupdated)} Tage geupdated "
        f"({von}–{bis})"
    )

    return {
        "status": "ok",
        "tage_geupdated": len(tage_geupdated),
        "stunden_geupdated": stunden_geupdated,
        "von": von.isoformat(),
        "bis": bis.isoformat(),
    }
