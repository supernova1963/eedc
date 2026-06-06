"""Regressionstest #304 Teil 2: Aussichten-Eigenverbrauch aus IMD statt Legacy.

Bug: Die Finanz-Prognose (`get_finanz_prognose`) las den historischen
Eigenverbrauch pro Monat aus dem Legacy-Feld `Monatsdaten.eigenverbrauch_kwh`
(drei Stellen: gesamt_ev, EV-Quoten-Historie, bisherige EV-Ersparnis). Dieses
Feld bleibt bei IMD-basierten Setups leer (moderne Quellen schreiben PV in
`InvestitionMonatsdaten`) → die EV-Quoten-Historie war leer → die Prognose fiel
auf den 30-%-Default zurück, obwohl die reale Quote viel höher liegt. Dieselbe
Legacy-Read-Klasse wie #304 Teil 1 (HA-Export).

Fix: Eigenverbrauch pro Monat über den SoT-Helper `berechne_verbrauchs_kennzahlen`
(PV+Speicher aus IMD + Zählerwerte) — deckungsgleich mit Cockpit/HA-Export.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.aussichten import get_finanz_prognose
from backend.core.berechnungen import berechne_verbrauchs_kennzahlen
from backend.models import Anlage, Investition, InvestitionMonatsdaten, Monatsdaten


async def _seed(db, *, mit_speicher: bool) -> int:
    """PV 1000/Monat, Einspeisung 400, Netzbezug 300, Legacy-EV BEWUSST None.
    Reale Direkt-EV-Quote = (1000−400)/1000 = 60 %."""
    anlage = Anlage(anlagenname="IMD", leistung_kwp=10.0, latitude=48.0)
    db.add(anlage)
    await db.flush()
    for monat in range(1, 13):
        db.add(Monatsdaten(
            anlage_id=anlage.id, jahr=2025, monat=monat,
            einspeisung_kwh=400.0, netzbezug_kwh=300.0,
            eigenverbrauch_kwh=None,  # Bug-Bedingung: Legacy-Feld leer
        ))
    pv = Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
        anschaffungsdatum=date(2024, 1, 1), leistung_kwp=10.0,
        anschaffungskosten_gesamt=15000.0,
    )
    db.add(pv)
    await db.flush()
    for monat in range(1, 13):
        db.add(InvestitionMonatsdaten(
            investition_id=pv.id, jahr=2025, monat=monat,
            verbrauch_daten={"pv_erzeugung_kwh": 1000.0},
        ))
    if mit_speicher:
        sp = Investition(
            anlage_id=anlage.id, typ="speicher", bezeichnung="Akku",
            anschaffungsdatum=date(2024, 1, 1), anschaffungskosten_gesamt=8000.0,
        )
        db.add(sp)
        await db.flush()
        for monat in range(1, 13):
            db.add(InvestitionMonatsdaten(
                investition_id=sp.id, jahr=2025, monat=monat,
                verbrauch_daten={"ladung_kwh": 200.0, "entladung_kwh": 180.0},
            ))
    await db.flush()
    return anlage.id


async def test_ev_quote_aus_imd_nicht_legacy_default(db):
    """Ohne Speicher: reale Quote 60 % muss durchschlagen, nicht der 30-%-Default,
    der vor dem Fix bei leerem Legacy-Feld griff."""
    anlage_id = await _seed(db, mit_speicher=False)
    result = await get_finanz_prognose(anlage_id=anlage_id, monate=12, db=db)
    # (1000-400)/1000 = 60 %. Vor dem Fix: ~30 % (Default-Kollaps).
    assert result.eigenverbrauchsquote_prozent == pytest.approx(60.0, abs=3.0), (
        f"EV-Quote {result.eigenverbrauchsquote_prozent}% — vor #304-Teil-2-Fix "
        f"kollabierte sie auf den 30-%-Default, weil das Legacy-Feld leer war."
    )


async def test_ev_quote_mit_speicher_hoeher(db):
    """Mit Speicher steigt der Eigenverbrauch (Direktverbrauch + Entladung) —
    die Quote muss über dem reinen Direktverbrauch (60 %) liegen und dem
    kanonischen Helper entsprechen."""
    anlage_id = await _seed(db, mit_speicher=True)
    result = await get_finanz_prognose(anlage_id=anlage_id, monate=12, db=db)
    # Helper pro Monat: direkt = max(0, 1000-400-200)=400; eigen = 400+180 = 580 → 58 %
    erwartet = berechne_verbrauchs_kennzahlen(
        pv_erzeugung_kwh=1000, einspeisung_kwh=400, netzbezug_kwh=300,
        speicher_ladung_kwh=200, speicher_entladung_kwh=180,
    )
    assert result.eigenverbrauchsquote_prozent == pytest.approx(
        erwartet.eigenverbrauchsquote_prozent, abs=3.0
    )
