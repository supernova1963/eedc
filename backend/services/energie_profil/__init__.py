"""
Energie-Profil-Subsystem.

Aggregation eines Tages aus Snapshot-Boundaries + Tagesverlauf-Daten zur
TagesZusammenfassung + 24 TagesEnergieProfil-Zeilen. Zerlegt aus
`services/energie_profil_service.py` im Rahmen Etappe 3c P3 — der primäre
Aggregator (`aggregate_day`) lebt jetzt hier, alle weiteren Pfade
(`backfill_*`, `rollup_month`, `aggregate_yesterday_all`,
`aggregate_today_all`) bleiben vorerst im Modul-File und werden bei Bedarf
in späteren Päckchen extrahiert (siehe KONZEPT-DATENPIPELINE.md
Päckchen 3, Refactoring-Tail).
"""

from backend.services.energie_profil.aggregator import aggregate_day

__all__ = ["aggregate_day"]
