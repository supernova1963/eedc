"""
PDF Export Operations

Generiert vollstaendige PDF-Jahres-/Anlagenberichte fuer PV-Anlagen
ueber die WeasyPrint-Pipeline (`services/pdf/`).

Phase 5 (#303): Der reportlab-Notausgang (alte Inline-Aggregation + PDFService)
ist entfernt — die Daten-Aggregation lebt vollstaendig in
`services/pdf/builders/jahresbericht.py`.
"""

import io
import logging
import zipfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import bad_request, not_found
from backend.api.deps import get_db
from backend.models.anlage import Anlage

logger = logging.getLogger(__name__)
router = APIRouter()


def _safe_dateiname(anlagenname: str) -> str:
    """Anlagenname → Dateiname-tauglich (Leerzeichen, Slashes, Umlaute)."""
    safe = anlagenname.replace(" ", "_").replace("/", "-")
    for umlaut, ersatz in [("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"),
                           ("Ä", "Ae"), ("Ö", "Oe"), ("Ü", "Ue")]:
        safe = safe.replace(umlaut, ersatz)
    return safe


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
    safe_name = _safe_dateiname(anlage.anlagenname)
    if jahr is None:
        filename = f"eedc_anlagenbericht_{safe_name}.pdf"
    else:
        filename = f"eedc_jahresbericht_{safe_name}_{jahr}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =============================================================================
# ZIP-Mehrfachauswahl (#121-Rest): mehrere Berichte als ein ZIP
# =============================================================================

BERICHT_LABELS = {
    "jahresbericht": "Jahresbericht",
    "infothek": "Infothek-Dossier",
    "anlagendokumentation": "Anlagendokumentation",
    "finanzbericht": "Finanzbericht",
}


async def _render_bericht(
    db: AsyncSession,
    bericht: str,
    anlage_id: int,
    jahr: Optional[int],
    safe_name: str,
) -> tuple[str, bytes]:
    """Rendert EINEN Bericht und liefert (dateiname, pdf_bytes).

    Dateinamen-Konventionen identisch zu den Einzel-Download-Endpoints.
    """
    from backend.services.pdf import render_document

    if bericht == "jahresbericht":
        from backend.services.pdf.builders.jahresbericht import build_jahresbericht_context
        ctx = await build_jahresbericht_context(db, anlage_id, jahr)
        pdf = render_document("jahresbericht.html", ctx)
        filename = (
            f"eedc_jahresbericht_{safe_name}_{jahr}.pdf" if jahr
            else f"eedc_anlagenbericht_{safe_name}.pdf"
        )
    elif bericht == "infothek":
        from backend.services.pdf.builders.infothek import build_infothek_context
        ctx = await build_infothek_context(db, anlage_id, None)
        pdf = render_document("infothek.html", ctx)
        filename = f"infothek_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"
    elif bericht == "anlagendokumentation":
        from backend.services.pdf.builders.anlagendokumentation import (
            build_anlagendokumentation_context,
        )
        ctx = await build_anlagendokumentation_context(db, anlage_id)
        pdf = render_document("anlagendokumentation.html", ctx)
        filename = f"anlagendokumentation_{safe_name}.pdf"
    else:  # finanzbericht (Keys vorab validiert)
        from backend.services.pdf.builders.finanzbericht import build_finanzbericht_context
        ctx = await build_finanzbericht_context(db, anlage_id)
        pdf = render_document("finanzbericht.html", ctx)
        filename = f"finanzbericht_{safe_name}.pdf"
    return filename, pdf


@router.get("/pdf-zip/{anlage_id}")
async def export_pdf_zip(
    anlage_id: int,
    berichte: list[str] = Query(..., description="Berichte (jahresbericht, infothek, anlagendokumentation, finanzbericht)"),
    jahr: Optional[int] = Query(None, description="Jahr fuer den Jahresbericht (leer = Gesamtzeitraum)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Rendert die gewaehlten Berichte serverseitig und liefert sie als EIN ZIP.

    Schlaegt EIN Bericht fehl, gibt es KEIN halbes ZIP — die Fehlermeldung
    benennt den Bericht (`Berichtsname: KlassenName: Detail`).
    """
    unbekannt = [b for b in berichte if b not in BERICHT_LABELS]
    if unbekannt:
        raise bad_request(f"Unbekannte Berichte: {', '.join(unbekannt)}")
    # Reihenfolge stabil, Duplikate raus
    auswahl = list(dict.fromkeys(berichte))

    result = await db.execute(select(Anlage).where(Anlage.id == anlage_id))
    anlage = result.scalar_one_or_none()
    if not anlage:
        raise not_found("Anlage")
    safe_name = _safe_dateiname(anlage.anlagenname)

    eintraege: list[tuple[str, bytes]] = []
    for bericht in auswahl:
        try:
            eintraege.append(
                await _render_bericht(db, bericht, anlage_id, jahr, safe_name)
            )
        except HTTPException:
            raise
        except ValueError as exc:
            # Vorhersehbarer Leere-Daten-Zustand (z. B. Infothek ohne aktive
            # Einträge, Dirk-PN 2026-06-12) — kein Render-Fehler: klare 400
            # statt 500 mit Klassennamen. Die Karte wird im Frontend zwar
            # schon deaktiviert, direkte API-Aufrufe brauchen den Fallback.
            raise HTTPException(
                status_code=400,
                detail=f"{BERICHT_LABELS[bericht]}: {exc}",
            )
        except Exception as exc:
            logger.exception("ZIP-Export: %s fehlgeschlagen: %s", bericht, exc)
            raise HTTPException(
                status_code=500,
                detail=f"{BERICHT_LABELS[bericht]}: {exc.__class__.__name__}: {exc}",
            )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, pdf_bytes in eintraege:
            zf.writestr(filename, pdf_bytes)
    buf.seek(0)

    zip_name = f"eedc_dokumente_{safe_name}_{datetime.now().strftime('%Y%m%d')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )
