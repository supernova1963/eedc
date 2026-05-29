"""
Source-Marker für ``aggregate_day`` (v3.34.0 Phase A).

Vorher: der ``datenquelle``-String wurde im Aggregator dreifach genutzt —
als Spaltenwert (`TagesZusammenfassung.datenquelle`), als Writer-Suffix
(`f"energieprofil:{datenquelle}"`) und als Verzweigungs-Trigger für die
Preserve-Logik (`datenquelle == "manuell"`). Diese semantische
Doppelnutzung war als Magic-String anfällig: ein Tippfehler in einem der
Aufrufer hätte die Schutzlogik still ausgeschaltet (Audit §8.12).

Das Enum hält die drei legitimen Trigger-Quellen typsicher zusammen und
projiziert auf die heutigen Magic-Strings; die DB-Spalte ``datenquelle``
bleibt unverändert (VARCHAR(30)), keine Migration nötig.

Phase B (v3.34.2) löst die ``backfill_from_statistics``-Eigenständigkeit
auf: der Vollbackfill läuft jetzt als dünne Schleife durch ``aggregate_day``
mit ``source=VOLLBACKFILL_FROM_LTS``. Der frühere Direkt-Konstruktor
(``datenquelle="ha_statistiken"``, Writer ``ha_statistics_backfill``)
entfällt. ``to_db_string()`` liefert byte-identisch ``"ha_statistiken"``
weiter (UI/DB-Spalte unverändert); der Provenance-Writer migriert auf das
einheitliche ``"energieprofil:ha_statistiken"`` (Weg 2, STAND-NACH-PHASE-A
§7 Frage 5: niemand liest den alten Writer-String).
"""

from __future__ import annotations

from enum import Enum


class Source(Enum):
    """Trigger-Quelle eines ``aggregate_day``-Aufrufs.

    Wird als Pflicht-Parameter an ``aggregate_day`` übergeben. Die drei
    heutigen Aufrufer (Audit §1 Trigger #1–#6) sind erfasst:

    - ``SCHEDULER`` — Scheduler-Job aggregiert Vortag (00:15) oder
      heutigen Tag (alle 15 min). Aufrufer: ``scheduler_jobs.py``.
    - ``MONATSABSCHLUSS_BACKFILL`` — Monatsabschluss-Wizard backfillt
      pro Tag des Monats. Aufrufer: ``backfill.py`` (Wrapper
      ``backfill_range``), Migration ``migrate_v3_33_0_lts_komponenten_kwh.py``.
    - ``MANUAL_REPAIR`` — Reparatur-Werkbank "Tag(e) neu aggregieren"
      durch den User. Aufrufer: ``repair_orchestrator.py``. Triggert die
      Preserve-Logik (s. ``is_manual_repair``).
    - ``VOLLBACKFILL_FROM_LTS`` — additiver Vollbackfill aus HA Long-Term
      Statistics (v3.34.2 Phase B). Aufrufer: ``backfill.py``
      (``backfill_from_statistics``), das die historischen Stunden-Daten
      gebündelt vorholt und pro fehlendem Tag durch ``aggregate_day``
      schleift. Kein Preserve-Trigger (additiv, Tage mit bestehender TZ
      werden gar nicht erst aggregiert).
    """

    SCHEDULER = "scheduler"
    MONATSABSCHLUSS_BACKFILL = "monatsabschluss"
    MANUAL_REPAIR = "manuell"
    VOLLBACKFILL_FROM_LTS = "ha_statistiken"

    def to_db_string(self) -> str:
        """``TagesZusammenfassung.datenquelle``-Spaltenwert.

        UI-Konstanz: die in v3.33.0 eingeführten Werte ``scheduler`` /
        ``monatsabschluss`` / ``manuell`` bleiben byte-identisch.
        """
        return self.value

    def to_writer(self) -> str:
        """Provenance-Writer-String für ``seed_tz_provenance`` /
        ``seed_tep_provenance`` (``"energieprofil:scheduler"`` etc.).

        Ersetzt das frühere ``f"energieprofil:{datenquelle}"`` im
        Aggregator — Output-Form bleibt identisch.
        """
        return f"energieprofil:{self.value}"

    def is_manual_repair(self) -> bool:
        """True für den Reparatur-Werkbank-Pfad.

        Steuert die Preserve-Logik in ``aggregate_day`` (Audit §4.2):
        wenn die Stunden-Aggregation 0 Stunden liefert UND der User
        manuell reaggregiert hat, bleiben bestehende ``komponenten_kwh``
        / ``komponenten_starts`` erhalten statt mit None überschrieben
        zu werden. Asymmetrie zum Scheduler ist beabsichtigt — siehe
        Inline-Kommentar in ``aggregator.py``.
        """
        return self is Source.MANUAL_REPAIR
