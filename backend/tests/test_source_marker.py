"""Regressions-Test für den Source-Marker (v3.34.0 Phase A).

Stellt sicher, dass die Projektions-Methoden des Enums byte-identisch dieselben
Magic-Strings liefern, die der Aggregator bis v3.33.0 direkt verwendet hat.
Bei einer versehentlichen Umbenennung des Enum-Werts (z.B. ``"manuell"`` →
``"manual"``) bricht der Test, **bevor** der neue String in die DB-Spalte
``TagesZusammenfassung.datenquelle`` wandert und bestehende UI-Konsumenten
verwirrt.
"""

from __future__ import annotations

import pytest

from backend.services.energie_profil.source import Source


def test_to_db_string_byte_identisch():
    """``to_db_string()`` muss die heutigen ``datenquelle``-Spaltenwerte liefern.

    Die DB-Spalte ist VARCHAR(30) — Werte werden in das Daten-Checker-Frontend
    und in den `datenquelle`-Bericht des Werkbank-Plans gezeigt. Änderungen
    hier hätten User-sichtbare Wirkung.
    """
    assert Source.SCHEDULER.to_db_string() == "scheduler"
    assert Source.MONATSABSCHLUSS_BACKFILL.to_db_string() == "monatsabschluss"
    assert Source.MANUAL_REPAIR.to_db_string() == "manuell"
    # v3.34.2 Phase B: Vollbackfill projiziert byte-identisch auf den heutigen
    # `datenquelle="ha_statistiken"`-Spaltenwert (kein UI-/DB-Effekt, Plan E1).
    assert Source.VOLLBACKFILL_FROM_LTS.to_db_string() == "ha_statistiken"


def test_to_writer_byte_identisch():
    """``to_writer()`` muss den heutigen ``energieprofil:{datenquelle}``-Writer
    liefern. Der Writer-String landet im Per-Feld-Provenance-Layer
    (``data_provenance_log.writer``) und ist Teil des Audit-Trails."""
    assert Source.SCHEDULER.to_writer() == "energieprofil:scheduler"
    assert Source.MONATSABSCHLUSS_BACKFILL.to_writer() == "energieprofil:monatsabschluss"
    assert Source.MANUAL_REPAIR.to_writer() == "energieprofil:manuell"
    # v3.34.2 Phase B (Weg 2, STAND §7 Frage 5): der Vollbackfill-Writer
    # migriert vom früheren `ha_statistics_backfill` auf das einheitliche
    # `energieprofil:ha_statistiken` — niemand liest den alten Writer-String.
    assert Source.VOLLBACKFILL_FROM_LTS.to_writer() == "energieprofil:ha_statistiken"


def test_is_manual_repair():
    """``is_manual_repair()`` triggert die Preserve-Logik in ``aggregate_day``
    (Audit §4.2). Nur ``MANUAL_REPAIR`` darf True liefern."""
    assert Source.MANUAL_REPAIR.is_manual_repair() is True
    assert Source.SCHEDULER.is_manual_repair() is False
    assert Source.MONATSABSCHLUSS_BACKFILL.is_manual_repair() is False
    # Vollbackfill triggert KEINE Preserve-Logik: er ist additiv und läuft nur
    # auf Tagen ohne bestehende TZ — es gibt nichts zu bewahren (v3.34.2).
    assert Source.VOLLBACKFILL_FROM_LTS.is_manual_repair() is False


def test_enum_vollstaendig():
    """Alle bekannten ``aggregate_day``-Aufrufer müssen über das Enum
    darstellbar sein (v3.34.2 Phase B: ``VOLLBACKFILL_FROM_LTS`` ergänzt — der
    Vollbackfill läuft jetzt als dünne Schleife durch ``aggregate_day``). Wenn
    ein neuer Aufrufer dazukommt, hier ergänzen UND alle bestehenden Konsumenten
    (Aggregator, Daten-Checker-UI, Werkbank-Plan) prüfen."""
    erwartete_werte = {"scheduler", "monatsabschluss", "manuell", "ha_statistiken"}
    tatsaechliche_werte = {s.value for s in Source}
    assert tatsaechliche_werte == erwartete_werte, (
        "Source-Enum hat sich verändert. Wenn neue Aufrufer dazukommen, hier "
        "die Erwartung anpassen UND alle bestehenden Konsumenten "
        "(Aggregator, Daten-Checker-UI, Werkbank-Plan) prüfen."
    )


def test_aggregate_day_signatur_pflicht_keyword():
    """``aggregate_day`` muss ``source: Source`` als Pflicht-Keyword-Parameter
    haben — kein Default, keine Positions-Übergabe, kein ``datenquelle``-
    Magic-String-Übergangspfad mehr (E4 sauber, Plan §3 A.4)."""
    import inspect

    from backend.services.energie_profil import aggregator as _agg_mod

    sig = inspect.signature(_agg_mod.aggregate_day)
    assert "source" in sig.parameters, (
        "aggregate_day muss `source: Source`-Parameter haben (Phase A)."
    )
    source_param = sig.parameters["source"]
    assert source_param.kind == inspect.Parameter.KEYWORD_ONLY, (
        "`source` muss keyword-only sein, damit Positions-Verwechslung mit "
        "`db` oder `datum` ausgeschlossen ist."
    )
    assert source_param.default is inspect.Parameter.empty, (
        "`source` darf keinen Default haben — alle Aufrufer setzen ihn "
        "explizit (Plan §3 A.3 Risiken)."
    )
    assert "datenquelle" not in sig.parameters, (
        "Der `datenquelle`-Magic-String-Übergangsparameter darf nicht mehr "
        "existieren (Plan-Disziplin: kein Magic-String als Eingangs-Trigger)."
    )
