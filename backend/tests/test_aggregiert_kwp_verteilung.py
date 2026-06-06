"""`/monatsdaten/aggregiert` löst das PV-Aggregat über kWp-Verteilung auf.

Multi-String-Anlage mit nur EINEM Gesamtwert (manuelles Aggregat in
`Monatsdaten.pv_erzeugung_kwh`, keine Pro-Modul-Werte) → der Stats-Pfad nutzt
jetzt den Read-time-Helper und liefert die Gesamt-PV, statt 0/leer.
Σ == Gesamt (Symmetrie). [[project_kwp_verteilung_aggregator]].
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.monatsdaten import list_monatsdaten_aggregiert
from backend.models import Anlage, Investition, InvestitionMonatsdaten, Monatsdaten


async def _anlage_mit_zwei_strings(db, *, aggregat=None, pro_modul=None) -> int:
    """2 PV-Strings (6 + 4 kWp). `aggregat` → Monatsdaten-Gesamtwert,
    `pro_modul` → {bezeichnung: kWh} gemessene Werte je String."""
    anlage = Anlage(anlagenname="Zwei-Strings", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Monatsdaten(anlage_id=anlage.id, jahr=2026, monat=5,
                       einspeisung_kwh=300.0, netzbezug_kwh=200.0,
                       pv_erzeugung_kwh=aggregat))
    sued = Investition(anlage_id=anlage.id, typ="pv-module", bezeichnung="Süd",
                       anschaffungsdatum=date(2024, 1, 1), leistung_kwp=6.0)
    ost = Investition(anlage_id=anlage.id, typ="pv-module", bezeichnung="Ost",
                      anschaffungsdatum=date(2024, 1, 1), leistung_kwp=4.0)
    db.add_all([sued, ost])
    await db.flush()
    pro_modul = pro_modul or {}
    for inv, name in ((sued, "Süd"), (ost, "Ost")):
        if name in pro_modul:
            db.add(InvestitionMonatsdaten(
                investition_id=inv.id, jahr=2026, monat=5,
                verbrauch_daten={"pv_erzeugung_kwh": pro_modul[name]},
            ))
    await db.commit()
    return anlage.id


async def test_aggregat_wird_anteilig_verteilt(db):
    """Nur Gesamtwert (1000 kWh), keine Pro-Modul-Werte → Gesamt-PV = 1000,
    Σ == Aggregat."""
    anlage_id = await _anlage_mit_zwei_strings(db, aggregat=1000.0)
    rows = await list_monatsdaten_aggregiert(anlage_id=anlage_id, jahr=2026, db=db)
    mai = next(r for r in rows if r.monat == 5)
    assert mai.pv_erzeugung_kwh == pytest.approx(1000.0)


async def test_gemessene_pro_modul_werte_haben_vorrang(db):
    """Alle Strings gemessen → Summe der Messwerte, Aggregat (falsch) ignoriert."""
    anlage_id = await _anlage_mit_zwei_strings(
        db, aggregat=9999.0, pro_modul={"Süd": 700.0, "Ost": 300.0})
    rows = await list_monatsdaten_aggregiert(anlage_id=anlage_id, jahr=2026, db=db)
    mai = next(r for r in rows if r.monat == 5)
    assert mai.pv_erzeugung_kwh == pytest.approx(1000.0)


async def test_ohne_quelle_bleibt_none(db):
    """Weder Aggregat noch Pro-Modul-Werte → PV bleibt None (nicht 0)."""
    anlage_id = await _anlage_mit_zwei_strings(db, aggregat=None)
    rows = await list_monatsdaten_aggregiert(anlage_id=anlage_id, jahr=2026, db=db)
    mai = next(r for r in rows if r.monat == 5)
    assert mai.pv_erzeugung_kwh is None


async def test_teilgemessen_faellt_auf_aggregat(db):
    """Ein String gemessen, einer nicht, Aggregat vorhanden → Aggregat
    verteilt (Σ == Aggregat), nicht nur der eine Messwert."""
    anlage_id = await _anlage_mit_zwei_strings(
        db, aggregat=1000.0, pro_modul={"Süd": 700.0})
    rows = await list_monatsdaten_aggregiert(anlage_id=anlage_id, jahr=2026, db=db)
    mai = next(r for r in rows if r.monat == 5)
    assert mai.pv_erzeugung_kwh == pytest.approx(1000.0)
