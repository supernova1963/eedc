"""ZIP-Mehrfachauswahl im Dokumente-Dialog (#121-Rest).

`GET /api/import/pdf-zip/{anlage_id}?berichte=...` rendert die gewählten
Berichte serverseitig und streamt EIN ZIP. Schlägt EIN Bericht fehl, gibt es
kein halbes ZIP — die Fehlermeldung benennt den Bericht
(`Berichtsname: KlassenName: Detail`).
"""

from __future__ import annotations

import io
import zipfile
from datetime import date

import pytest
from fastapi import HTTPException

from backend.api.routes.import_export.pdf_operations import export_pdf_zip
from backend.models import Anlage, Investition, Monatsdaten


async def _seed(db) -> int:
    anlage = Anlage(anlagenname="ZIP-Test Anlage", leistung_kwp=10.0,
                    standort_plz="10115", latitude=48.0, longitude=11.0)
    db.add(anlage)
    await db.flush()
    for m in range(1, 4):
        db.add(Monatsdaten(anlage_id=anlage.id, jahr=2025, monat=m,
                           einspeisung_kwh=400.0, netzbezug_kwh=300.0))
    db.add(Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
        anschaffungsdatum=date(2024, 1, 1), leistung_kwp=10.0,
        anschaffungskosten_gesamt=15000.0,
    ))
    await db.commit()
    return anlage.id


async def _zip_bytes(response) -> bytes:
    content = b""
    async for chunk in response.body_iterator:
        content += chunk if isinstance(chunk, bytes) else chunk.encode()
    return content


async def test_zwei_berichte_ergeben_gueltiges_zip_mit_zwei_pdfs(db):
    anlage_id = await _seed(db)
    response = await export_pdf_zip(
        anlage_id=anlage_id,
        berichte=["jahresbericht", "finanzbericht"],
        jahr=None,
        db=db,
    )
    assert response.media_type == "application/zip"
    content = await _zip_bytes(response)

    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        namen = zf.namelist()
        assert len(namen) == 2
        # Dateinamen wie die Einzel-Downloads (Gesamtzeitraum → anlagenbericht)
        assert "eedc_anlagenbericht_ZIP-Test_Anlage.pdf" in namen
        assert "finanzbericht_ZIP-Test_Anlage.pdf" in namen
        for name in namen:
            assert zf.read(name).startswith(b"%PDF"), f"{name} ist kein PDF"


async def test_jahresbericht_mit_jahr_im_dateinamen(db):
    anlage_id = await _seed(db)
    response = await export_pdf_zip(
        anlage_id=anlage_id, berichte=["jahresbericht"], jahr=2025, db=db,
    )
    content = await _zip_bytes(response)
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        assert zf.namelist() == ["eedc_jahresbericht_ZIP-Test_Anlage_2025.pdf"]


async def test_fehlschlag_benennt_bericht_und_liefert_kein_zip(db):
    """Infothek ohne Einträge wirft ValueError — die Fehlermeldung muss den
    Bericht benennen, kein halbes ZIP zurückkommen."""
    anlage_id = await _seed(db)
    with pytest.raises(HTTPException) as ei:
        await export_pdf_zip(
            anlage_id=anlage_id,
            berichte=["jahresbericht", "infothek"],
            jahr=None,
            db=db,
        )
    assert ei.value.status_code == 500
    assert ei.value.detail.startswith("Infothek-Dossier: ValueError:")


async def test_unbekannter_bericht_400(db):
    anlage_id = await _seed(db)
    with pytest.raises(HTTPException) as ei:
        await export_pdf_zip(
            anlage_id=anlage_id, berichte=["jahresbericht", "quartalsbericht"],
            jahr=None, db=db,
        )
    assert ei.value.status_code == 400
    assert "quartalsbericht" in ei.value.detail


async def test_unbekannte_anlage_404(db):
    with pytest.raises(HTTPException) as ei:
        await export_pdf_zip(anlage_id=99999, berichte=["finanzbericht"], jahr=None, db=db)
    assert ei.value.status_code == 404
