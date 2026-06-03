"""Akzeptanztest: aggregate_day rettet kraftstoffpreis_euro (#319).

Befund (v3.34/v3.35-Aggregator-Refactor, Phase-A, PLAN §8.1):
`TagesZusammenfassung.kraftstoffpreis_euro` wird extern-additiv von
`kraftstoff_preis_service.fill_tagesdaten` befüllt (EU Weekly Oil Bulletin,
`is None`-Filter) — kein Aggregator-Setter. Beim Delete-and-Recreate eines
Tages (`aggregate_day`) wurde die Row neu erzeugt und der Wert fiel heraus,
bis der nächste Kraftstoffpreis-Lauf ihn erneut füllte. Dieselbe latente
Verlust-Klasse wie die Prognose-Felder (#190), die Phase A mit
`_PROGNOSE_FELDER_RETTEN` strukturell abgesichert hat.

Fix (#319, Option 1): eigene Rettungs-Schwester-Liste
`_EXTERN_BEFUELLT_FELDER_RETTEN` — bewusst NICHT `_PROGNOSE_FELDER_RETTEN`,
weil Konformitäts-Test K1 jene Liste exklusiv an die Wetter-Endpoint-
Schreibfelder koppelt.
"""

from __future__ import annotations

from backend.models.tages_energie_profil import TagesZusammenfassung
from backend.services.energie_profil.aggregator import (
    _EXTERN_BEFUELLT_FELDER_RETTEN,
    _PROGNOSE_FELDER_RETTEN,
)


def test_kraftstoffpreis_in_rettungsliste():
    """kraftstoffpreis_euro muss in der extern-befüllt-Rettungsliste stehen —
    sein Fehlen war der #319-Verlust beim Delete-and-Recreate."""
    assert "kraftstoffpreis_euro" in _EXTERN_BEFUELLT_FELDER_RETTEN


def test_kraftstoffpreis_nicht_in_prognoseliste():
    """Strukturelle Trennung: kraftstoffpreis_euro gehört NICHT in
    `_PROGNOSE_FELDER_RETTEN` — die Liste ist via K1 exklusiv an den
    Wetter-Endpoint (`_TZ_SCHREIBFELDER_PROGNOSE`) gekoppelt und würde
    sonst out-of-sync brechen."""
    assert "kraftstoffpreis_euro" not in _PROGNOSE_FELDER_RETTEN


def test_extern_befuellt_felder_sind_echte_spalten():
    """Jedes Rettungs-Feld muss eine echte TagesZusammenfassung-Spalte sein —
    fängt Tippfehler und spätere Spalten-Umbenennungen ab (sonst läuft der
    getattr-Loop im Aggregator still ins Leere)."""
    spalten = set(TagesZusammenfassung.__table__.columns.keys())
    unbekannt = [f for f in _EXTERN_BEFUELLT_FELDER_RETTEN if f not in spalten]
    assert not unbekannt, f"Keine TagesZusammenfassung-Spalten: {unbekannt}"
