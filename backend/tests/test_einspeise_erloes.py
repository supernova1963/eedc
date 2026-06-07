"""§51 EEG-Abzug bei negativen Börsenpreisen — Berechnungs-Layer + DB-Service.

Hintergrund: Solarpaket I hat für Neuanlagen den Vergütungsausfall in
Negativpreis-Stunden eingeführt (rcmcronny Discussion #120, ~6 Wochen alt).
Daten-Fundament steht in `TagesZusammenfassung.einspeisung_neg_preis_kwh`,
wird hier in Erlös-Helper + DB-Aggregat angeschlossen.

Tests decken ab:
- Pure Berechnung `einspeise_erloes_euro` (Standard-Fälle + Edge-Cases)
- DB-Aggregat `get_neg_preis_einspeisung_monat` / `_jahr` (None-Pfad, Σ,
  Anlagen-Isolation, Monatsgrenzen)
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen import einspeise_erloes_euro
from backend.models import Anlage
from backend.models.tages_energie_profil import TagesZusammenfassung
from backend.services.einspeise_erloes_service import (
    get_neg_preis_einspeisung_jahr,
    get_neg_preis_einspeisung_monat,
)


# --- Pure-Berechnung: einspeise_erloes_euro ---------------------------------

def test_kein_negativpreis_voller_erloes():
    """`neg_preis_kwh=None` → unverändert, alte Berechnung greift."""
    result = einspeise_erloes_euro(
        einspeisung_kwh=1000.0, neg_preis_kwh=None, verguetung_ct_kwh=8.2
    )
    assert result.erloes_euro == 82.0
    assert result.nicht_vergueteter_erloes_euro == 0.0
    assert result.nicht_verguetete_kwh == 0.0


def test_null_negativpreis_voller_erloes():
    """`neg_preis_kwh=0` → identisch zu None-Pfad."""
    result = einspeise_erloes_euro(
        einspeisung_kwh=1000.0, neg_preis_kwh=0.0, verguetung_ct_kwh=8.2
    )
    assert result.erloes_euro == 82.0
    assert result.nicht_verguetete_kwh == 0.0


def test_teil_negativpreis_anteilig_abgezogen():
    """Σ Erlös + entgangener Erlös == alte ungekürzte Rechnung (Invariante)."""
    einspeisung, neg, vc = 1000.0, 120.0, 8.2
    result = einspeise_erloes_euro(einspeisung, neg, vc)
    assert result.erloes_euro == pytest.approx((1000 - 120) * 8.2 / 100)
    assert result.nicht_vergueteter_erloes_euro == pytest.approx(120 * 8.2 / 100)
    assert result.nicht_verguetete_kwh == 120.0
    # Erhaltungs-Invariante: voller Erlös rekonstruierbar.
    voll = einspeisung * vc / 100
    assert result.erloes_euro + result.nicht_vergueteter_erloes_euro == pytest.approx(voll)


def test_neg_groesser_als_einspeisung_wird_geklemmt():
    """Drift zwischen Monatsdaten und Tages-Aggregat darf nicht negativ machen."""
    result = einspeise_erloes_euro(
        einspeisung_kwh=100.0, neg_preis_kwh=150.0, verguetung_ct_kwh=8.0
    )
    assert result.erloes_euro == 0.0
    assert result.nicht_verguetete_kwh == 100.0
    assert result.nicht_vergueteter_erloes_euro == 8.0


def test_nullte_einspeisung_liefert_nulle():
    """Keine Einspeisung → keine Erlöse, kein §51-Abzug."""
    result = einspeise_erloes_euro(0.0, 50.0, 8.2)
    assert result.erloes_euro == 0.0
    assert result.nicht_verguetete_kwh == 0.0


def test_negative_einspeisung_robust():
    """Defensive: negative Einspeisung (Datenfehler) → 0, nicht ValueError."""
    result = einspeise_erloes_euro(-10.0, 5.0, 8.2)
    assert result.erloes_euro == 0.0
    assert result.nicht_verguetete_kwh == 0.0


# --- DB-Service: get_neg_preis_einspeisung_monat ----------------------------

async def _seed_anlage(db, *, unterliegt_eeg_51: bool = True) -> int:
    # Default True in diesen Service-Tests: sie prüfen die Summier-/Isolations-
    # Logik. Der §51-Gate (Flag False → None) hat einen eigenen Test unten.
    anlage = Anlage(
        anlagenname="Test", leistung_kwp=10.0, standort_land="DE",
        unterliegt_eeg_51=unterliegt_eeg_51,
    )
    db.add(anlage)
    await db.flush()
    return anlage.id


async def test_monat_ohne_eeg51_flag_liefert_none_trotz_aggregaten(db):
    """§51-Gate: Anlage ohne Flag (Default) → None, auch wenn Tages-Aggregate da sind."""
    anlage_id = await _seed_anlage(db, unterliegt_eeg_51=False)
    db.add(TagesZusammenfassung(
        anlage_id=anlage_id, datum=date(2026, 3, 15),
        einspeisung_neg_preis_kwh=10.0,
    ))
    await db.flush()
    assert await get_neg_preis_einspeisung_monat(db, anlage_id, 2026, 3) is None
    assert await get_neg_preis_einspeisung_jahr(db, anlage_id, 2026) is None


async def test_monat_ohne_tages_aggregate_liefert_none(db):
    """Anwender ohne Strompreis-Sensor → None, Read-Sites nutzen alte Berechnung."""
    anlage_id = await _seed_anlage(db)
    result = await get_neg_preis_einspeisung_monat(db, anlage_id, 2026, 3)
    assert result is None


async def test_monat_mit_tagen_aber_alle_null_liefert_null_komma_null(db):
    """Tages-Aggregate vorhanden, aber kein Negativpreis im Monat → 0.0, nicht None."""
    anlage_id = await _seed_anlage(db)
    db.add(TagesZusammenfassung(
        anlage_id=anlage_id, datum=date(2026, 3, 1),
        einspeisung_neg_preis_kwh=0.0,
    ))
    db.add(TagesZusammenfassung(
        anlage_id=anlage_id, datum=date(2026, 3, 2),
        einspeisung_neg_preis_kwh=0.0,
    ))
    await db.flush()
    result = await get_neg_preis_einspeisung_monat(db, anlage_id, 2026, 3)
    assert result == 0.0


async def test_monat_summiert_alle_tage(db):
    """Σ über alle Tage des Monats."""
    anlage_id = await _seed_anlage(db)
    db.add(TagesZusammenfassung(
        anlage_id=anlage_id, datum=date(2026, 3, 1),
        einspeisung_neg_preis_kwh=5.0,
    ))
    db.add(TagesZusammenfassung(
        anlage_id=anlage_id, datum=date(2026, 3, 15),
        einspeisung_neg_preis_kwh=10.0,
    ))
    db.add(TagesZusammenfassung(
        anlage_id=anlage_id, datum=date(2026, 3, 31),
        einspeisung_neg_preis_kwh=3.0,
    ))
    await db.flush()
    result = await get_neg_preis_einspeisung_monat(db, anlage_id, 2026, 3)
    assert result == 18.0


async def test_monat_isoliert_andere_monate_und_anlagen(db):
    """Σ nimmt nur den Ziel-Monat der Ziel-Anlage."""
    anlage_id = await _seed_anlage(db)
    andere_anlage = Anlage(anlagenname="Andere", leistung_kwp=5.0, standort_land="DE")
    db.add(andere_anlage)
    await db.flush()

    # Treffer (Anlage A, März)
    db.add(TagesZusammenfassung(
        anlage_id=anlage_id, datum=date(2026, 3, 15),
        einspeisung_neg_preis_kwh=10.0,
    ))
    # Falscher Monat (Anlage A, Februar)
    db.add(TagesZusammenfassung(
        anlage_id=anlage_id, datum=date(2026, 2, 28),
        einspeisung_neg_preis_kwh=99.0,
    ))
    # Falsche Anlage (B, März)
    db.add(TagesZusammenfassung(
        anlage_id=andere_anlage.id, datum=date(2026, 3, 15),
        einspeisung_neg_preis_kwh=77.0,
    ))
    await db.flush()
    result = await get_neg_preis_einspeisung_monat(db, anlage_id, 2026, 3)
    assert result == 10.0


async def test_jahr_summiert_ueber_alle_monate(db):
    """Jahres-Aggregat zieht über alle Tages-Zeilen."""
    anlage_id = await _seed_anlage(db)
    for monat, wert in [(2, 4.0), (3, 10.0), (12, 6.0)]:
        db.add(TagesZusammenfassung(
            anlage_id=anlage_id, datum=date(2026, monat, 15),
            einspeisung_neg_preis_kwh=wert,
        ))
    await db.flush()
    result = await get_neg_preis_einspeisung_jahr(db, anlage_id, 2026)
    assert result == 20.0


async def test_jahr_ohne_tages_aggregate_liefert_none(db):
    anlage_id = await _seed_anlage(db)
    result = await get_neg_preis_einspeisung_jahr(db, anlage_id, 2026)
    assert result is None
