"""Die Eigenverbrauchs-Ersparnis ist auf JEDER Ebene EV-gewichtet (F4b, 18.09.2026).

Schwesterdateien: ``test_ev_ersparnis_slot_gewichtet.py`` (die Tagesebene, F4),
``test_aufgeloester_monatspreis_kaskade.py`` (die Kaskade des Bezugspreises),
``test_preis_aggregat_symmetrie.py`` (beide Messwege).

**Der Befund** (Flex-Prüfung §12, Befund a): F4 vom 17.09. setzte
``ev_preis_cent`` nur auf der Tagesebene. Cockpit → Monat, Jahr, Netto-Ertrag,
PDF und HA-Export liefen über ``finanz_aggregat`` und bewerteten die vermiedene
Menge weiter mit dem **bezugsgewichteten** Ø — nach der eigenen Probe des Baus
systematisch zu hoch. Jetzt trägt ``MonatsPreis.ev_cent`` den EV-gewichteten Ø
derselben Messung, und ``baue_finanz_zeile`` reicht ihn an alle Aufrufer durch.

Dazu **P-1**: Der abgerechnete Bezugs-Ø ist für die Ersparnis nur der Rückfall —
auch ein Monat mit gepflegtem Ø rechnet seine Ersparnis mit der Messung.
"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import pytest

from backend.core.berechnungen import berechne_finanz_aggregat
from backend.models import Anlage, Strompreis
from backend.models.tages_energie_profil import TagesEnergieProfil
from backend.services.finanz_zeilen import FinanzZeileEingabe, baue_finanz_zeile
from backend.services.strompreis_aggregator import aufgeloester_monatspreis

JAHR, MONAT = 2025, 7
STAMM_CENT = 30.0


async def _anlage(db) -> tuple[int, Strompreis]:
    anlage = Anlage(anlagenname="EV-Monat", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    tarif = Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2024, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=STAMM_CENT, einspeiseverguetung_cent_kwh=8.0,
    )
    db.add(tarif)
    await db.flush()
    await db.refresh(tarif, ["zeitfenster"])
    return anlage.id, tarif


async def _messmonat(db, aid):
    """Mittags 10 ct mit vermiedenem Bezug (PV 3 − Einspeisung 1), abends 50 ct mit Bezug 2."""
    for stunde in (11, 12, 13):
        db.add(TagesEnergieProfil(anlage_id=aid, datum=date(JAHR, MONAT, 8), stunde=stunde,
                                  strompreis_cent=10.0, netzbezug_kw=0.0, pv_kw=3.0, einspeisung_kw=1.0))
    for stunde in (19, 20, 21):
        db.add(TagesEnergieProfil(anlage_id=aid, datum=date(JAHR, MONAT, 8), stunde=stunde,
                                  strompreis_cent=50.0, netzbezug_kw=2.0, pv_kw=0.0, einspeisung_kw=0.0))
    await db.flush()


def _eingabe(monatsdaten=None) -> FinanzZeileEingabe:
    # 9 kWh PV, 3 kWh eingespeist ⇒ 6 kWh Eigenverbrauch; 6 kWh Bezug.
    return FinanzZeileEingabe(
        jahr=JAHR, monat=MONAT, pv_erzeugung_kwh=9.0, einspeisung_kwh=3.0,
        netzbezug_kwh=6.0, monatsdaten=monatsdaten,
    )


@pytest.mark.asyncio
async def test_monat_bewertet_die_ersparnis_mit_dem_ev_gewichteten_preis(db):
    """⭐ Der Befund: Bezug 50 ct, Ersparnis 10 ct — nicht mehr 50."""
    aid, tarif = await _anlage(db)
    await _messmonat(db, aid)

    preis = await aufgeloester_monatspreis(db, aid, JAHR, MONAT, None, tarif)
    assert preis.cent == 50.0 and preis.herkunft == "gemessen"
    assert preis.ev_cent == 10.0

    zeile = await baue_finanz_zeile(db, aid, _eingabe(), tarif_cache={})
    assert zeile.ev_preis_cent == 10.0
    agg = berechne_finanz_aggregat([zeile])
    assert agg.eigenverbrauch_kwh == pytest.approx(6.0)
    assert agg.ev_ersparnis_euro == pytest.approx(6.0 * 10.0 / 100)
    # Die Gegenprobe im selben Test: bezugsgewichtet wären es 3,00 €.
    assert agg.ev_ersparnis_euro != pytest.approx(6.0 * 50.0 / 100)


@pytest.mark.asyncio
async def test_gepflegter_bezugs_oe_ist_fuer_die_ersparnis_nur_rueckfall(db):
    """P-1: der abgerechnete Ø stellt den Bezugspreis — die Ersparnis bleibt bei der Messung."""
    aid, tarif = await _anlage(db)
    await _messmonat(db, aid)
    md = SimpleNamespace(netzbezug_durchschnittspreis_cent=40.0)

    preis = await aufgeloester_monatspreis(db, aid, JAHR, MONAT, md, tarif)
    assert preis.cent == 40.0 and preis.herkunft == "gepflegt"
    assert preis.ev_cent == 10.0

    zeile = await baue_finanz_zeile(db, aid, _eingabe(md), tarif_cache={})
    assert zeile.netzbezug_preis_cent == 40.0
    assert zeile.ev_preis_cent == 10.0


@pytest.mark.asyncio
async def test_ohne_messung_bleibt_es_beim_bezugspreis(db):
    """§10 Prüfstein 2: bei Festpreis ohne Stundenpreise bewegt sich keine Zahl."""
    aid, tarif = await _anlage(db)

    preis = await aufgeloester_monatspreis(db, aid, JAHR, MONAT, None, tarif)
    assert preis.cent == STAMM_CENT and preis.ev_cent is None

    zeile = await baue_finanz_zeile(db, aid, _eingabe(), tarif_cache={})
    assert zeile.ev_preis_cent is None
    agg = berechne_finanz_aggregat([zeile])
    assert agg.ev_ersparnis_euro == pytest.approx(6.0 * STAMM_CENT / 100)


@pytest.mark.asyncio
async def test_aufrufer_wert_schlaegt_die_monatsmessung(db):
    """Die Tagesebene kennt ihren Slot-Preis selbst — er hat Vorrang vor dem Monats-Ø."""
    aid, tarif = await _anlage(db)
    await _messmonat(db, aid)
    eingabe = _eingabe()
    eingabe.ev_preis_cent = 12.5
    zeile = await baue_finanz_zeile(db, aid, eingabe, tarif_cache={})
    assert zeile.ev_preis_cent == 12.5
