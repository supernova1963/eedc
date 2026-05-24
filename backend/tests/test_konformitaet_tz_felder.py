"""Konformitäts-Test K2 (v3.34.0 Phase A).

Erzwingt, dass jede ``TagesZusammenfassung``-Spalte eines der drei Schicksale
hat:

(a) wird von ``aggregate_day`` gesetzt (``_AGGREGATOR_SETTER_FELDER``),
(b) steht auf der Prognose-Rettungs-Liste (extern via Wetter-Endpoint befüllt),
(c) wird automatisch vom ORM / Identifier-Schicht gesetzt
    (``_AUTO_BEFUELLT_FELDER``, ``_IDENTIFIER_FELDER``),
(d) steht auf der expliziten "bleibt NULL"-Allowlist (mit Begründung).

Wenn eine neue Spalte ohne Klassifikation hinzukommt, bricht der Test und
zwingt den Autor zu einer expliziten Entscheidung — kein stilles Vergessen
durch den Aggregator-Recreate-Pfad (Pattern wie #190 v3.31.7, wo
``pv_prognose_stundenprofil`` jede Nacht verloren ging).

Plan v3.34 §3 Phase A K2 (Audit §11 Punkt 1).
"""

from __future__ import annotations

import pytest


# Felder, die ``aggregate_day`` heute (v3.34.0) auf den frisch erzeugten
# ``TagesZusammenfassung``-Row setzt. Quelle: ``aggregator.py:557`` Konstruktor.
#
# Bei Änderungen am Aggregator-Konstruktor MUSS diese Liste gepflegt werden —
# sie ist Hand-gepflegte Wahrheit über den Setter-Pfad, nicht reflektiert.
# Reflektive Code-Inspection (AST) wäre auch denkbar, aber fragiler — explizite
# Liste = explizite Entscheidung bei jedem Touch des Aggregator-Konstruktors.
_AGGREGATOR_SETTER_FELDER: frozenset[str] = frozenset({
    "ueberschuss_kwh",
    "defizit_kwh",
    "peak_pv_kw",
    "peak_netzbezug_kw",
    "peak_einspeisung_kw",
    "batterie_vollzyklen",
    "temperatur_min_c",
    "temperatur_max_c",
    "strahlung_summe_wh_m2",
    "performance_ratio",
    "stunden_verfuegbar",
    "datenquelle",
    "boersenpreis_avg_cent",
    "boersenpreis_min_cent",
    "negative_preis_stunden",
    "einspeisung_neg_preis_kwh",
    "komponenten_kwh",
    "komponenten_starts",
})


# Identifier-Spalten: nicht-Daten, sondern Identität der Row.
_IDENTIFIER_FELDER: frozenset[str] = frozenset({
    "id",         # auto-increment PK
    "anlage_id",  # FK auf Anlage
    "datum",      # part of natural key
})


# Auto-befüllte Spalten via SQLAlchemy-Default / Trigger.
_AUTO_BEFUELLT_FELDER: frozenset[str] = frozenset({
    "created_at",         # default datetime.now
    "updated_at",         # default + onupdate datetime.now
    "source_provenance",  # via seed_tz_provenance() → seed_provenance()
})


# "Bleibt NULL"-Allowlist: Spalten, die der Aggregator bewusst NICHT setzt.
# Jeder Eintrag braucht eine Begründung und einen Hinweis auf den passenden
# Setter-Pfad (sonst ist die Allowlist ein blinder Fleck).
#
# **Befund-Charakter (v3.34.0 Phase A):** Spalten in dieser Liste sind
# zur Risiko-Stelle bei jedem Aggregator-Delete-and-Recreate — sie werden
# mit der TZ-Row mitgelöscht und müssen dann von ihrem externen Schreiber
# wiederhergestellt werden. Das ist heute strukturell so akzeptiert; bei
# einem strukturellen Refactor (z.B. UPDATE-statt-DELETE+INSERT, Audit §10.4)
# fällt diese Risiko-Klasse weg.
_ALLOWLIST_BLEIBT_NULL: dict[str, str] = {
    # Wird per `kraftstoff_preis_service.fill_tagesdaten` aus EU Oil Bulletin
    # befüllt (Werkbank-Operation KRAFTSTOFFPREIS_BACKFILL + Scheduler),
    # `is None`-Filter — additiv. Aggregator-Delete-and-Recreate verwirft den
    # Wert, der nächste Kraftstoffpreis-Backfill-Lauf füllt ihn wieder.
    # Latentes Risiko, das v3.34.0 Phase A bewusst NICHT fixt (kein
    # Anwenderbericht, Symptom selten). Folge-Diskussion: ob das Feld in
    # ein `_BEFUELLEN_NACH_RECREATE` analog zu `_PROGNOSE_FELDER_RETTEN`
    # gehört, oder ob `_speichere_prognose`-Pattern auf alle externen TZ-
    # Schreiber verallgemeinert wird (Audit §10.4 Tabellen-Auslagerung).
    "kraftstoffpreis_euro":
        "extern via kraftstoff_preis_service.fill_tagesdaten — additiv, "
        "kein Aggregator-Setter. Risiko: Wert verschwindet beim "
        "Delete-and-Recreate bis zum nächsten Kraftstoffpreis-Lauf. "
        "Phase-A-Befund, Folge-Diskussion offen.",
}


def test_k2_alle_tz_felder_klassifiziert():
    """Jede TZ-Spalte muss in genau einer der vier Kategorien stehen."""
    from backend.models.tages_energie_profil import TagesZusammenfassung
    from backend.services.energie_profil.aggregator import _PROGNOSE_FELDER_RETTEN

    tz_spalten = {col.name for col in TagesZusammenfassung.__table__.columns}

    klassifiziert = (
        _AGGREGATOR_SETTER_FELDER
        | set(_PROGNOSE_FELDER_RETTEN)
        | _IDENTIFIER_FELDER
        | _AUTO_BEFUELLT_FELDER
        | set(_ALLOWLIST_BLEIBT_NULL.keys())
    )

    nicht_klassifiziert = tz_spalten - klassifiziert
    assert not nicht_klassifiziert, (
        "K2-Drift: TagesZusammenfassung hat neue Spalte(n) ohne Klassifikation: "
        f"{sorted(nicht_klassifiziert)}.\n\n"
        "Bei jeder neuen Spalte explizit entscheiden:\n"
        "  (a) Aggregator setzt sie → in `_AGGREGATOR_SETTER_FELDER` aufnehmen "
        "und im Aggregator-Konstruktor setzen.\n"
        "  (b) Wetter-Endpoint befüllt sie → in `_PROGNOSE_FELDER_RETTEN` (Aggregator) "
        "+ `_PROGNOSE_FELDER_RETTEN_BACKFILL` (Backfill) + "
        "`_TZ_SCHREIBFELDER_PROGNOSE` (live_wetter) aufnehmen — siehe K1.\n"
        "  (c) ORM/Auto-Feld → in `_AUTO_BEFUELLT_FELDER` mit Begründung.\n"
        "  (d) Bleibt bewusst NULL → in `_ALLOWLIST_BLEIBT_NULL` mit Begründung "
        "+ Risiko-Hinweis (Delete-and-Recreate-Verlust)."
    )

    abgelaufen = klassifiziert - tz_spalten
    assert not abgelaufen, (
        "K2-Drift: Klassifikationsliste(n) enthalten Spaltennamen, die nicht "
        f"mehr auf TagesZusammenfassung existieren: {sorted(abgelaufen)}.\n"
        "Spalte umbenannt oder gelöscht? Klassifikation entsprechend bereinigen."
    )


def test_k2_klassifikationen_disjunkt():
    """Jede Spalte darf nur in einer Kategorie stehen — sonst wird die "
    "Klassifikation mehrdeutig und der Schutz verliert seine Aussage."""
    from backend.services.energie_profil.aggregator import _PROGNOSE_FELDER_RETTEN

    prognose = frozenset(_PROGNOSE_FELDER_RETTEN)
    allowlist = frozenset(_ALLOWLIST_BLEIBT_NULL.keys())

    paare = [
        ("_AGGREGATOR_SETTER_FELDER", "_PROGNOSE_FELDER_RETTEN",
         _AGGREGATOR_SETTER_FELDER & prognose),
        ("_AGGREGATOR_SETTER_FELDER", "_IDENTIFIER_FELDER",
         _AGGREGATOR_SETTER_FELDER & _IDENTIFIER_FELDER),
        ("_AGGREGATOR_SETTER_FELDER", "_AUTO_BEFUELLT_FELDER",
         _AGGREGATOR_SETTER_FELDER & _AUTO_BEFUELLT_FELDER),
        ("_AGGREGATOR_SETTER_FELDER", "_ALLOWLIST_BLEIBT_NULL",
         _AGGREGATOR_SETTER_FELDER & allowlist),
        ("_PROGNOSE_FELDER_RETTEN", "_IDENTIFIER_FELDER",
         prognose & _IDENTIFIER_FELDER),
        ("_PROGNOSE_FELDER_RETTEN", "_AUTO_BEFUELLT_FELDER",
         prognose & _AUTO_BEFUELLT_FELDER),
        ("_PROGNOSE_FELDER_RETTEN", "_ALLOWLIST_BLEIBT_NULL",
         prognose & allowlist),
        ("_IDENTIFIER_FELDER", "_AUTO_BEFUELLT_FELDER",
         _IDENTIFIER_FELDER & _AUTO_BEFUELLT_FELDER),
        ("_IDENTIFIER_FELDER", "_ALLOWLIST_BLEIBT_NULL",
         _IDENTIFIER_FELDER & allowlist),
        ("_AUTO_BEFUELLT_FELDER", "_ALLOWLIST_BLEIBT_NULL",
         _AUTO_BEFUELLT_FELDER & allowlist),
    ]
    for name_a, name_b, intersection in paare:
        assert not intersection, (
            f"K2: {name_a} und {name_b} überlappen in {sorted(intersection)} — "
            "Klassifikation mehrdeutig."
        )


def test_k2_aggregator_setter_existieren_auf_modell():
    """``_AGGREGATOR_SETTER_FELDER`` darf keine Phantom-Spalten enthalten."""
    from backend.models.tages_energie_profil import TagesZusammenfassung

    tz_spalten = {col.name for col in TagesZusammenfassung.__table__.columns}
    fehlend = _AGGREGATOR_SETTER_FELDER - tz_spalten
    assert not fehlend, (
        f"K2: `_AGGREGATOR_SETTER_FELDER` enthält Felder, die nicht auf "
        f"`TagesZusammenfassung` existieren: {sorted(fehlend)}"
    )
