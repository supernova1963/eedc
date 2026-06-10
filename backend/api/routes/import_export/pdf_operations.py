"""
PDF Export Operations

Generiert vollstaendige PDF-Jahres-/Anlagenberichte fuer PV-Anlagen
ueber die WeasyPrint-Pipeline (`services/pdf/`).

Phase 5 (#303): Der reportlab-Notausgang (alte Inline-Aggregation + PDFService)
ist entfernt — die Daten-Aggregation lebt vollstaendig in
`services/pdf/builders/jahresbericht.py`.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import not_found
from backend.api.deps import get_db
from backend.models.anlage import Anlage

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/pdf/{anlage_id}")
async def export_pdf(
    anlage_id: int,
    jahr: Optional[int] = Query(None, description="Jahr fuer den Bericht (leer = Gesamtzeitraum)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Generiert einen vollstaendigen PDF-Bericht fuer eine Anlage.

    Parameter:
    - jahr: Optional. Wenn nicht angegeben, wird der Gesamtzeitraum seit Installation verwendet
      (Anlagenbericht statt Jahresbericht).

    Enthaelt:
    - Anlagen-Stammdaten + Stromtarif
    - Investitionen & Komponenten (inkl. Speicher)
    - Jahres-KPIs (Energie, Finanzen ueber `berechne_finanz_aggregat`, CO2)
    - Diagramme (PV-Erzeugung, Energie-Fluss, Autarkie) als SVG
    - Monatsuebersicht
    - PV-String Vergleich (SOLL vs. IST)
    """
    from backend.services.pdf import render_document
    from backend.services.pdf.builders.jahresbericht import build_jahresbericht_context

    try:
        ctx = await build_jahresbericht_context(db, anlage_id, jahr)
    except LookupError:
        raise not_found("Anlage")
    except Exception as exc:
        logger.exception("Jahresbericht-Aggregation fehlgeschlagen: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"PDF-Daten-Fehler: {exc.__class__.__name__}: {exc}",
        )

    try:
        pdf_bytes = render_document("jahresbericht.html", ctx)
    except Exception as exc:
        logger.exception("WeasyPrint-Render fehlgeschlagen: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"PDF-Render-Fehler: {exc.__class__.__name__}: {exc}",
        )

    # Anlage nur für Dateinamen nachladen
    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one()
    safe_name = anlage.anlagenname.replace(" ", "_").replace("/", "-")
    for umlaut, ersatz in [("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"),
                           ("Ä", "Ae"), ("Ö", "Oe"), ("Ü", "Ue")]:
        safe_name = safe_name.replace(umlaut, ersatz)
    if jahr is None:
        filename = f"eedc_anlagenbericht_{safe_name}.pdf"
    else:
        filename = f"eedc_jahresbericht_{safe_name}_{jahr}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
