"""
Investitionen API Routes

CRUD Endpoints für Investitionen (E-Auto, Wärmepumpe, Speicher, etc.).

Seit 18.09.2026 (Vorlage 5 des Refactorings grosser Dateien, reiner Umzug) liegen die Schemas in
``schemas.py`` und das ROI-Dashboard samt Gruppierung und Kennwert-Aufloesern in ``roi.py``; dieses Modul
behaelt die CRUD-Routen, haengt den ROI-Router nach ihnen ein und exportiert die bisherigen Namen weiter.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
from backend.core.exceptions import not_found
from backend.core.field_definitions import innengeraet_id_von_feld
from backend.api.deps import get_db
from backend.models.investition import (
    Investition,
    InvestitionTyp,
    ERLAUBTE_PARENT_TYPEN,
    PARENT_PFLICHT_TYPEN,
    TYP_LABELS as _TYP_LABEL,
)
from backend.utils.investition_filter import aktiv_jetzt, sort_investitionen_nach_typ
from backend.models.anlage import Anlage
from backend.core.investition_parameter import lade_innengeraete
from backend.api.routes.investitionen.schemas import (  # noqa: F401 — Re-Export (dashboards.py, aussichten/finanz_zerlegung.py, finanzbericht.py, Tests)
    InvestitionBase,
    InvestitionCreate,
    InvestitionUpdate,
    InvestitionResponse,
)
from backend.api.routes.investitionen.roi import (  # noqa: F401 — Re-Export (dashboards.py, aussichten/finanz_zerlegung.py, finanzbericht.py, Tests)
    _gruppiere_investitionen,
    ROIKomponente,
    ROIBerechnung,
    AmortisationsVerlaufJahr,
    ROIDashboardResponse,
    get_roi_dashboard,
)
from backend.api.routes.investitionen.roi import router as _roi_router

router = APIRouter()


# v3.25.0: Phantom-Endpoint /typen + InvestitionTypInfo + parameter_schema entfernt.
# Niemand hat das Schema im Frontend gelesen (useInvestitionTypen war exportiert, aber
# nirgends aufgerufen), und der Schema-Inhalt war historisch von Form/Wizard und
# Backend-Reads auseinandergedriftet — siehe docs/archive/INVENTUR-INVESTITIONS-PARAMETER.md.
# Single Source of Truth ist jetzt:
#   - Frontend: eedc/frontend/src/lib/investitionParameter.ts
#   - Backend:  eedc/backend/core/investition_parameter.py


class ParentOption(BaseModel):
    """Verfügbare Parent-Investition."""
    id: int
    bezeichnung: str
    typ: str
    required: bool = False

@router.get("/parent-options/{anlage_id}", response_model=dict[str, list[ParentOption]])
async def get_parent_options(
    anlage_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Gibt verfügbare Parent-Optionen für jeden Typ zurück.

    Gebaut aus `ERLAUBTE_PARENT_TYPEN`/`PARENT_PFLICHT_TYPEN`
    (`models/investition.py`) — derselben SoT, gegen die
    `_validate_parent_child` prüft. Bis 2026-07-31 zählte diese Funktion
    ausschließlich Wechselrichter auf und behauptete damit, ein Speicher könne
    keinem Balkonkraftwerk zugeordnet werden — im Widerspruch zur Validierung
    UND zum Formular (BKW mit Akku ist genau der Fall, für den es die
    Zuordnung gibt).

    Returns:
        dict: Typ -> Liste der möglichen Parents (leer, wo es keine gibt)

    Beispiel:
        {
            "pv-module": [{"id": 1, "bezeichnung": "Fronius GEN24", "typ": "wechselrichter", "required": true}],
            "speicher": [{"id": 1, "bezeichnung": "Fronius GEN24", "typ": "wechselrichter", "required": false},
                         {"id": 9, "bezeichnung": "Balkon Süd", "typ": "balkonkraftwerk", "required": false}]
        }
    """
    benoetigte_typen = {t for typen in ERLAUBTE_PARENT_TYPEN.values() for t in typen}
    kandidaten = (await db.execute(
        select(Investition)
        .where(Investition.anlage_id == anlage_id)
        .where(Investition.typ.in_(benoetigte_typen))
        .where(aktiv_jetzt())
        .order_by(Investition.bezeichnung)
    )).scalars().all()

    optionen: dict[str, list[ParentOption]] = {t.value: [] for t in InvestitionTyp}
    for typ, erlaubte in ERLAUBTE_PARENT_TYPEN.items():
        passend = [k for k in kandidaten if k.typ in erlaubte]
        # `required` ist keine Eigenschaft des Typs allein: Pflicht wird die
        # Zuordnung erst, wenn es überhaupt einen möglichen Parent gibt
        # (sonst bliebe ein Altbestands-Modul unspeicherbar) — dieselbe
        # Bedingung wie in `_validate_parent_child`.
        pflicht = typ in PARENT_PFLICHT_TYPEN and len(passend) > 0
        optionen[typ] = [
            ParentOption(id=k.id, bezeichnung=k.bezeichnung, typ=k.typ, required=pflicht)
            for k in passend
        ]
    return optionen

@router.get("/", response_model=list[InvestitionResponse])
async def list_investitionen(
    anlage_id: Optional[int] = Query(None, description="Filter nach Anlage"),
    typ: Optional[str] = Query(None, description="Filter nach Typ"),
    aktiv: Optional[bool] = Query(None, description="Filter nach Status"),
    db: AsyncSession = Depends(get_db)
):
    """
    Gibt Investitionen zurück, optional gefiltert.

    Args:
        anlage_id: Optional - nur Investitionen dieser Anlage
        typ: Optional - nur dieser Investitionstyp
        aktiv: Optional - nur aktive/inaktive

    Returns:
        list[InvestitionResponse]: Liste der Investitionen
    """
    query = select(Investition)

    if anlage_id:
        query = query.where(Investition.anlage_id == anlage_id)
    if typ:
        query = query.where(Investition.typ == typ)
    if aktiv is not None:
        query = query.where(Investition.aktiv == aktiv)

    # Kanonische Typ-Reihenfolge (Fundament P4 / F7) statt alphabetisch.
    query = query.order_by(Investition.bezeichnung)

    # N-266/E5: Kinder MITLADEN, damit `leistung_kwp_effektiv` an einem
    # Balkonkraftwerk mit Modul-Kindern deren Σ ausweist statt der eigenen,
    # inzwischen gesperrten Pflege (`get_bkw_kwp`). `selectinload` statt eines
    # Lazy-Zugriffs: Letzterer läuft in async SQLAlchemy auf `MissingGreenlet`,
    # und ohne geladene Beziehung schweigt der Helper bewusst.
    query = query.options(selectinload(Investition.children))

    result = await db.execute(query)
    return sort_investitionen_nach_typ(result.scalars().all())

@router.get("/{investition_id}", response_model=InvestitionResponse)
async def get_investition(investition_id: int, db: AsyncSession = Depends(get_db)):
    """
    Gibt eine einzelne Investition zurück.

    Args:
        investition_id: ID der Investition

    Returns:
        InvestitionResponse: Die Investition

    Raises:
        404: Nicht gefunden
    """
    result = await db.execute(
        select(Investition)
        .where(Investition.id == investition_id)
        # N-266/E5 — wie in `list_investitionen`: ohne geladene Kinder weist
        # `leistung_kwp_effektiv` an einem abtretenden BKW die eigene, gesperrte
        # Pflege aus statt der Σ seiner Module.
        .options(selectinload(Investition.children))
    )
    inv = result.scalar_one_or_none()

    if not inv:
        raise not_found("Investition")

    return inv

@router.post("/", response_model=InvestitionResponse, status_code=status.HTTP_201_CREATED)
async def create_investition(data: InvestitionCreate, db: AsyncSession = Depends(get_db, scope="function")):
    """
    Erstellt eine neue Investition.

    Args:
        data: Investitions-Daten

    Returns:
        InvestitionResponse: Die erstellte Investition

    Raises:
        404: Anlage nicht gefunden
        400: Ungültiger Typ oder fehlende Parent-Zuordnung
    """
    # Anlage prüfen
    anlage_result = await db.execute(select(Anlage).where(Anlage.id == data.anlage_id))
    if not anlage_result.scalar_one_or_none():
        raise not_found("Anlage")

    # Typ validieren
    valid_types = [t.value for t in InvestitionTyp]
    if data.typ not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Typ. Erlaubt: {valid_types}"
        )

    # Parent-Child Validierung (v0.9)
    await _validate_parent_child(db, data.anlage_id, data.typ, data.parent_investition_id)

    inv = Investition(**data.model_dump())
    db.add(inv)
    await db.flush()
    await db.refresh(inv)
    return inv

async def _validate_parent_child(
    db: AsyncSession,
    anlage_id: int,
    typ: str,
    parent_id: Optional[int],
    exclude_id: Optional[int] = None
):
    """
    Validiert Parent-Child Beziehungen für Investitionen.

    Die erlaubten Kombinationen stehen NICHT hier, sondern in der SoT
    `models/investition.py::ERLAUBTE_PARENT_TYPEN` / `PARENT_PFLICHT_TYPEN` —
    dieselbe Quelle, aus der `get_parent_options` seine Liste baut und die das
    Client-Pendant spiegelt. Bis 2026-07-31 gab es drei uneinige Kopien.

    Regeln:
    - PV-Module MÜSSEN einem Wechselrichter zugeordnet sein (sofern einer existiert)
    - Speicher KÖNNEN optional einem Wechselrichter (Hybrid-WR) oder einem
      Balkonkraftwerk (BKW mit Akku) zugeordnet sein
    - Andere Typen haben keinen Parent
    """
    erlaubt = ERLAUBTE_PARENT_TYPEN.get(typ, ())

    # Typen ohne Parent-Beziehung: jede Zuordnung ist ein Fehler.
    if not erlaubt:
        if parent_id:
            raise HTTPException(
                status_code=400,
                detail=f"Investitionen vom Typ '{typ}' können keinem Parent zugeordnet werden"
            )
        return

    if not parent_id:
        if typ not in PARENT_PFLICHT_TYPEN:
            return
        # Pflicht — aber nur, wenn es überhaupt einen möglichen Parent gibt.
        # Ohne einen bleibt die Investition parentlos (Migration/Altbestand).
        moegliche = (await db.execute(
            select(Investition)
            .where(Investition.anlage_id == anlage_id)
            .where(Investition.typ.in_(erlaubt))
        )).scalars().all()
        if moegliche:
            raise HTTPException(
                status_code=400,
                detail=f"{_TYP_LABEL.get(typ, typ)} müssen zugeordnet werden. "
                       f"Verfügbar: {[m.bezeichnung for m in moegliche]}"
            )
        return

    parent = (await db.execute(
        select(Investition).where(Investition.id == parent_id)
    )).scalar_one_or_none()
    if not parent:
        raise not_found("Parent-Investition")
    if parent.typ not in erlaubt:
        erlaubt_labels = " oder ".join(_TYP_LABEL.get(t, t) for t in erlaubt)
        raise HTTPException(
            status_code=400,
            detail=f"{_TYP_LABEL.get(typ, typ)} können nur {erlaubt_labels} "
                   f"zugeordnet werden, nicht '{parent.typ}'"
        )
    if parent.anlage_id != anlage_id:
        raise HTTPException(
            status_code=400,
            detail="Parent-Investition gehört zu einer anderen Anlage"
        )

@router.put("/{investition_id}", response_model=InvestitionResponse)
async def update_investition(
    investition_id: int,
    data: InvestitionUpdate,
    db: AsyncSession = Depends(get_db, scope="function")
):
    """
    Aktualisiert eine Investition.

    Args:
        investition_id: ID der Investition
        data: Zu aktualisierende Felder

    Returns:
        InvestitionResponse: Die aktualisierte Investition

    Raises:
        404: Nicht gefunden
        400: Ungültige Parent-Zuordnung
    """
    result = await db.execute(select(Investition).where(Investition.id == investition_id))
    inv = result.scalar_one_or_none()

    if not inv:
        raise not_found("Investition")

    update_data = data.model_dump(exclude_unset=True)

    # Parent-Child Validierung wenn parent_investition_id geändert wird
    if 'parent_investition_id' in update_data:
        await _validate_parent_child(
            db,
            inv.anlage_id,
            inv.typ,
            update_data['parent_investition_id'],
            exclude_id=investition_id
        )

    # #263 — Innengeräte-Zuordnungen aufräumen, BEVOR der neue Parameter steht.
    # Sonst bliebe die Zuordnung eines gelöschten Innengeräts im
    # `sensor_mapping` liegen: auf der Datenquellen-Fläche unsichtbar (das Feld
    # wird nicht mehr erzeugt) und damit nicht mehr entfernbar — dieselbe
    # Falle, vor der `get_alle_felder_fuer_investition` warnt. Schlimmer noch:
    # ihr Wert liefe weiter in die Auswertung.
    if inv.typ == "waermepumpe" and "parameter" in update_data:
        await _raeume_innengeraete_zuordnungen(
            db, inv, neu_parameter=update_data.get("parameter"),
        )

    for field, value in update_data.items():
        setattr(inv, field, value)

    await db.flush()
    await db.refresh(inv)
    return inv

async def _raeume_innengeraete_zuordnungen(
    db: AsyncSession, inv: Investition, neu_parameter,
) -> None:
    """Entfernt die Sensor-Zuordnungen entfallener Innengeräte (#263).

    **Warum überhaupt aufräumen und nicht nur beim Lesen filtern.** Beides:
    Die Auswertung geht ohnehin nur über die Geräte der Liste — aber eine
    Zuordnung, die niemand mehr sieht und niemand mehr löschen kann, ist ein
    Rest, der beim nächsten Anlegen eines Innengeräts wieder auftauchen würde,
    wenn jemand die ID doch einmal wiederverwendet. Deshalb wird sie hier
    entfernt, wo die alte und die neue Liste beide bekannt sind.

    ⚠ **Nur entfallene IDs.** Wer nur eine Bezeichnung ändert, verliert nichts.
    """
    alt_ids = {g["id"] for g in lade_innengeraete(inv.parameter)}
    neu_ids = {g["id"] for g in lade_innengeraete(neu_parameter)}
    entfallen = alt_ids - neu_ids
    if not entfallen:
        return

    anlage = (await db.execute(
        select(Anlage).where(Anlage.id == inv.anlage_id)
    )).scalar_one_or_none()
    if not anlage or not anlage.sensor_mapping:
        return

    eintrag = (anlage.sensor_mapping.get("investitionen") or {}).get(str(inv.id))
    if not isinstance(eintrag, dict):
        return

    def _betroffen(key: str) -> bool:
        gid = innengeraet_id_von_feld(key)
        return gid is not None and gid in entfallen

    geaendert = False
    for abschnitt in ("live", "live_invert", "felder"):
        werte = eintrag.get(abschnitt)
        if not isinstance(werte, dict):
            continue
        for key in [k for k in werte if _betroffen(k)]:
            del werte[key]
            geaendert = True

    # Die feld-zentrische `quellen`-Ablage (Datenquellen-V4) trägt dieselben
    # Zuordnungen unter `inv:<id>:<feld>` — sie gehört mit aufgeräumt, sonst
    # holt der Read-Through sie zurück.
    quellen = anlage.sensor_mapping.get("quellen")
    if isinstance(quellen, dict):
        praefix = f"inv:{inv.id}:"
        for key in [k for k in quellen if k.startswith(praefix)]:
            if _betroffen(key[len(praefix):]):
                del quellen[key]
                geaendert = True

    if geaendert:
        flag_modified(anlage, "sensor_mapping")

@router.delete("/{investition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_investition(investition_id: int, db: AsyncSession = Depends(get_db, scope="function")):
    """
    Löscht eine Investition.

    Args:
        investition_id: ID der Investition

    Raises:
        404: Nicht gefunden
    """
    result = await db.execute(select(Investition).where(Investition.id == investition_id))
    inv = result.scalar_one_or_none()

    if not inv:
        raise not_found("Investition")

    # sensor_mapping der Anlage aufräumen (verwaiste Einträge vermeiden)
    anlage_result = await db.execute(select(Anlage).where(Anlage.id == inv.anlage_id))
    anlage = anlage_result.scalar_one_or_none()
    if anlage and anlage.sensor_mapping:
        inv_mapping = anlage.sensor_mapping.get("investitionen", {})
        if str(investition_id) in inv_mapping:
            del inv_mapping[str(investition_id)]
            flag_modified(anlage, "sensor_mapping")

    await db.delete(inv)


# Der ROI-Endpunkt (`roi.py`) haengt NACH den CRUD-Routen — wie vor dem Umzug.
router.include_router(_roi_router)
