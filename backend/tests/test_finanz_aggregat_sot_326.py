"""Finanz-Aggregat SoT-Helper — durchgängige Netto-Ertrag-Symmetrie (#326).

rilmor-mhrs (#326): Cockpit, Auswertungen→Finanzen und der Anlagenbericht-PDF
zeigten bei Flex-Tarifen unterschiedliche Netto-Erträge, weil jede Read-Site
ihre eigene EV-Ersparnis-Formel rollte — teils `Σ(EV) × Ø-Preis`, teils
`Σ(eigenverbrauch_m × flexpreis_m)`. Dieser Test sichert den gemeinsamen
SoT-Helper `berechne_finanz_aggregat` und die **Symmetrie** der drei
finanziellen Read-Sites (Cockpit, Jahresbericht-PDF, HA-Export) gegen
denselben erwarteten Netto-Ertrag.

Lehre [[feedback_aggregator_symmetrie]]: Ein Fixture mit Flex-Tarif + Speicher
+ V2H + Sonstige, der **alle** Pfade gegen denselben Wert prüft — nicht nur
einen einzelnen Pfad gegen eine Konstante.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen import (
    FinanzMonatsZeile,
    berechne_finanz_aggregat,
)


# ── Helper-Unit-Tests ───────────────────────────────────────────────────────

def test_helper_flex_speicher_v2h_sonstige():
    """Per-Monat: Σ(EV_m × flexpreis_m) + §51-Einspeise + Sonstige.

    Mai:  pv 1000, einsp 600, netz 50, lad 100, entl 80, v2h 20, flex 20 ct
          direkt = max(0, 1000-600-100)=300; EV = 300+80+20 = 400
    Dez:  pv 100, einsp 20, netz 500, lad 10, entl 8, v2h 2, flex 40 ct
          direkt = max(0, 100-20-10)=70; EV = 70+8+2 = 80
    ev_ersparnis = 400·0,20 + 80·0,40 = 80 + 32 = 112 €
    einspeise    = 600·0,08 + 20·0,08 = 49,60 € (kein §51-Abzug)
    sonstige     = 100 €
    netto        = 49,60 + 112 + 100 = 261,60 €
    """
    zeilen = [
        FinanzMonatsZeile(
            einspeisung_kwh=600, netzbezug_kwh=50, pv_erzeugung_kwh=1000,
            speicher_ladung_kwh=100, speicher_entladung_kwh=80, v2h_entladung_kwh=20,
            netzbezug_preis_cent=20, einspeiseverguetung_cent=8.0,
        ),
        FinanzMonatsZeile(
            einspeisung_kwh=20, netzbezug_kwh=500, pv_erzeugung_kwh=100,
            speicher_ladung_kwh=10, speicher_entladung_kwh=8, v2h_entladung_kwh=2,
            netzbezug_preis_cent=40, einspeiseverguetung_cent=8.0,
        ),
    ]
    r = berechne_finanz_aggregat(zeilen, sonstige_netto_euro=100.0)
    assert r.eigenverbrauch_kwh == pytest.approx(480.0)
    assert r.ev_ersparnis_euro == pytest.approx(112.0, abs=0.01)
    assert r.einspeise_erloes_euro == pytest.approx(49.6, abs=0.01)
    assert r.sonstige_netto_euro == pytest.approx(100.0)
    assert r.netto_ertrag_euro == pytest.approx(261.6, abs=0.01)
    # Gegenprobe: NICHT der netzbezug-gewichtete Ø-Wert (~183 € EV).
    assert abs(r.ev_ersparnis_euro - 183.3) > 50


def test_helper_neg_preis_51():
    """§51-Abzug: neg_preis_kwh kürzt den Einspeise-Erlös, hat_neg_preis True."""
    zeilen = [
        FinanzMonatsZeile(
            einspeisung_kwh=100, einspeiseverguetung_cent=10.0, neg_preis_kwh=40,
        ),
    ]
    r = berechne_finanz_aggregat(zeilen)
    # 60 kWh vergütet × 10 ct = 6 €; 40 kWh entgangen × 10 ct = 4 €
    assert r.einspeise_erloes_euro == pytest.approx(6.0)
    assert r.nicht_vergueteter_erloes_euro == pytest.approx(4.0)
    assert r.nicht_verguetete_kwh == pytest.approx(40.0)
    assert r.hat_neg_preis_daten is True


def test_helper_neg_preis_none_kein_flag():
    """Ohne Tages-Aggregat (neg_preis_kwh=None) bleibt hat_neg_preis_daten False."""
    r = berechne_finanz_aggregat([
        FinanzMonatsZeile(einspeisung_kwh=100, einspeiseverguetung_cent=10.0),
    ])
    assert r.hat_neg_preis_daten is False
    assert r.einspeise_erloes_euro == pytest.approx(10.0)


# ── Integration: Symmetrie über die drei Read-Sites ─────────────────────────

async def _anlage_flex_voll(db):
    """PV + Speicher + V2H + Sonstige, zwei Monate gegenläufiger Flexpreis.

    Identische Energie-/Preis-Charakteristik wie der Helper-Unit-Test oben,
    damit alle drei Read-Sites denselben Netto-Ertrag (261,60 €) liefern müssen.
    """
    from backend.models import Anlage, Investition, Monatsdaten, Strompreis
    from backend.models.investition import InvestitionMonatsdaten

    anlage = Anlage(anlagenname="FinanzSym326", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()

    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2024, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=30.0, einspeiseverguetung_cent_kwh=8.0,
    ))

    # Monatsdaten mit Flex-Ø-Preis (überschreibt den fixen Tarif).
    db.add(Monatsdaten(anlage_id=anlage.id, jahr=2026, monat=5,
                       pv_erzeugung_kwh=1000.0, einspeisung_kwh=600.0,
                       netzbezug_kwh=50.0, netzbezug_durchschnittspreis_cent=20.0))
    db.add(Monatsdaten(anlage_id=anlage.id, jahr=2026, monat=12,
                       pv_erzeugung_kwh=100.0, einspeisung_kwh=20.0,
                       netzbezug_kwh=500.0, netzbezug_durchschnittspreis_cent=40.0))

    pv = Investition(anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
                     leistung_kwp=10.0, anschaffungsdatum=date(2024, 1, 1),
                     anschaffungskosten_gesamt=10000.0)
    speicher = Investition(anlage_id=anlage.id, typ="speicher", bezeichnung="Akku",
                           anschaffungsdatum=date(2024, 1, 1),
                           parameter={"kapazitaet_kwh": 10.0})
    eauto = Investition(anlage_id=anlage.id, typ="e-auto", bezeichnung="Auto",
                        anschaffungsdatum=date(2024, 1, 1))
    db.add_all([pv, speicher, eauto])
    await db.flush()

    # PV-IMD (mit Sonstige-Ertrag 100 € im Mai → THG-Quote).
    db.add(InvestitionMonatsdaten(investition_id=pv.id, jahr=2026, monat=5,
        verbrauch_daten={"pv_erzeugung_kwh": 1000.0,
                         "sonstige_positionen": [
                             {"bezeichnung": "THG-Quote", "betrag": 100.0, "typ": "ertrag"}]}))
    db.add(InvestitionMonatsdaten(investition_id=pv.id, jahr=2026, monat=12,
        verbrauch_daten={"pv_erzeugung_kwh": 100.0}))
    # Speicher-IMD.
    db.add(InvestitionMonatsdaten(investition_id=speicher.id, jahr=2026, monat=5,
        verbrauch_daten={"ladung_kwh": 100.0, "entladung_kwh": 80.0}))
    db.add(InvestitionMonatsdaten(investition_id=speicher.id, jahr=2026, monat=12,
        verbrauch_daten={"ladung_kwh": 10.0, "entladung_kwh": 8.0}))
    # E-Auto-IMD (nur V2H, kein km/Ladung → keine emob-Ersparnis im Netto).
    db.add(InvestitionMonatsdaten(investition_id=eauto.id, jahr=2026, monat=5,
        verbrauch_daten={"v2h_entladung_kwh": 20.0}))
    db.add(InvestitionMonatsdaten(investition_id=eauto.id, jahr=2026, monat=12,
        verbrauch_daten={"v2h_entladung_kwh": 2.0}))
    await db.commit()
    return anlage


async def test_netto_ertrag_symmetrie_cockpit_pdf_haexport(db):
    """Cockpit == Jahresbericht-PDF == HA-Export == 261,60 € Netto-Ertrag.

    Das ist der eigentliche #326-Befund: durchgängig identische Finanz-
    Aggregation über alle Read-Sites (Flex-Tarif + Speicher + V2H + Sonstige).
    """
    from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht
    from backend.api.routes.ha_export import calculate_anlage_sensors
    from backend.services.pdf.builders.jahresbericht import build_jahresbericht_context
    from sqlalchemy import select
    from backend.models import Anlage

    anlage = await _anlage_flex_voll(db)
    erwartet = 261.6

    # Cockpit
    cockpit = await get_cockpit_uebersicht(anlage_id=anlage.id, jahr=None, db=db)
    assert cockpit.netto_ertrag_euro == pytest.approx(erwartet, abs=0.05), (
        f"Cockpit netto {cockpit.netto_ertrag_euro} ≠ {erwartet}")
    assert cockpit.ev_ersparnis_euro == pytest.approx(112.0, abs=0.05)

    # Jahresbericht-PDF (Gesamtzeitraum)
    ctx = await build_jahresbericht_context(db, anlage.id, jahr=None)
    assert ctx["kpis"]["netto_ertrag_euro"] == pytest.approx(erwartet, abs=0.05), (
        f"Jahresbericht netto {ctx['kpis']['netto_ertrag_euro']} ≠ {erwartet}")

    # HA-Export
    anlage_obj = (await db.execute(
        select(Anlage).where(Anlage.id == anlage.id))).scalar_one()
    sensors = await calculate_anlage_sensors(db, anlage_obj)
    netto = next(s for s in sensors if s.definition.key == "netto_ertrag_euro").value
    assert netto == pytest.approx(erwartet, abs=0.05), (
        f"HA-Export netto {netto} ≠ {erwartet}")
