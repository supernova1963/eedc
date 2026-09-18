"""F-73 — der Nachlauf des Monatsabschlusses lief seit v4.0.0 für niemanden.

MQTT-Publish, Energieprofil-Rollup (samt Modus-Split), Community-Auto-Share und
der Aktivitätseintrag hängen an ``wizard.py::_post_save_hintergrund``. Das startete
nur ``POST /monatsabschluss/{id}/{jahr}/{monat}`` — und deren einziger Client,
der 7-Schritt-Wizard, wurde mit dem IA-V4-Flip (`243944e5`, 25.07.2026) gelöscht.
Das v4-Formular speichert über ``POST /monatsdaten/`` und ``PUT /monatsdaten/{id}``.

Gemessen an Gernots Instanz (17.09.2026): Aktivitätsprotokoll endet mit
„Monatsabschluss Juni 2026 gespeichert" (03.07.); Juli und August gespeichert,
aber der Community-Server kennt die Anlage nur bis Juli — bei aktivem
automatischem Teilen. Community-weit: 19 von 138 Anlagen mit August-Wert.

Die Proben prüfen, dass beide CRUD-Routen den **selben** Nachlauf planen wie
der Wizard — dieselbe Funktion, dieselben Argumente — und dass ein direkter
Aufruf ohne Request (``background_tasks=None``) weiter still bleibt.

Schwesterdateien: test_monatsabschluss_geprueft_gegen.py (dieselben zwei Routen,
direkt aufgerufen), test_community_payload_f47_f48.py (was der Auto-Share sendet).
"""
from __future__ import annotations

import pytest
from fastapi import BackgroundTasks

from backend.api.routes.monatsabschluss.wizard import _post_save_hintergrund
from backend.api.routes.monatsdaten import (
    MonatsdatenCreate,
    MonatsdatenUpdate,
    create_monatsdaten,
    update_monatsdaten,
)
from backend.models import Anlage


async def _anlage(db, *, auto_share: bool) -> Anlage:
    anlage = Anlage(
        anlagenname="F-73", leistung_kwp=10.0,
        community_auto_share=auto_share,
        community_hash="f73" * 21 + "x" if auto_share else None,
    )
    db.add(anlage)
    await db.commit()
    await db.refresh(anlage)
    return anlage


def _einziger_task(bt: BackgroundTasks):
    assert len(bt.tasks) == 1, [t.func for t in bt.tasks]
    return bt.tasks[0]


@pytest.mark.asyncio
async def test_create_plant_denselben_nachlauf_wie_der_wizard(db):
    anlage = await _anlage(db, auto_share=True)
    bt = BackgroundTasks()

    md = await create_monatsdaten(
        MonatsdatenCreate(anlage_id=anlage.id, jahr=2026, monat=8,
                          einspeisung_kwh=1151.6, netzbezug_kwh=10.8),
        background_tasks=bt, db=db,
    )

    task = _einziger_task(bt)
    assert task.func is _post_save_hintergrund
    assert task.kwargs["anlage_id"] == anlage.id
    assert (task.kwargs["jahr"], task.kwargs["monat"]) == (2026, 8)
    assert task.kwargs["community_auto_share"] is True
    assert task.kwargs["community_hash"] == anlage.community_hash
    assert task.kwargs["monatsdaten_dict"] == {
        "jahr": 2026, "monat": 8, "einspeisung_kwh": 1151.6, "netzbezug_kwh": 10.8,
    }
    assert md.id is not None


@pytest.mark.asyncio
async def test_update_plant_den_nachlauf_mit_den_gespeicherten_werten(db):
    """Der PUT ist der Weg des v4-Formulars für einen bereits angelegten Monat."""
    anlage = await _anlage(db, auto_share=False)
    md = await create_monatsdaten(
        MonatsdatenCreate(anlage_id=anlage.id, jahr=2026, monat=8,
                          einspeisung_kwh=100.0, netzbezug_kwh=50.0),
        background_tasks=None, db=db,
    )
    bt = BackgroundTasks()

    await update_monatsdaten(md.id, MonatsdatenUpdate(netzbezug_kwh=55.0), background_tasks=bt, db=db)

    task = _einziger_task(bt)
    assert task.func is _post_save_hintergrund
    # Die gespeicherten Werte, nicht das Teil-Update: MQTT bekommt den ganzen Monat.
    assert task.kwargs["monatsdaten_dict"]["netzbezug_kwh"] == 55.0
    assert task.kwargs["monatsdaten_dict"]["einspeisung_kwh"] == 100.0
    # Ohne automatisches Teilen wird kein Hash und kein Share übergeben — wie im Wizard.
    assert task.kwargs["community_auto_share"] is False
    assert task.kwargs["community_hash"] is None


@pytest.mark.asyncio
async def test_direkter_aufruf_ohne_request_bleibt_still(db):
    """Interne Aufrufer und Tests reichen keine BackgroundTasks — kein Nachlauf, kein Fehler."""
    anlage = await _anlage(db, auto_share=True)
    md = await create_monatsdaten(
        MonatsdatenCreate(anlage_id=anlage.id, jahr=2026, monat=7,
                          einspeisung_kwh=1.0, netzbezug_kwh=1.0),
        db=db,
    )
    assert md.jahr == 2026
