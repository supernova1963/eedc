"""
SoT-Helper für Investitions-Werte mit Spalten/Parameter-Fallback.

Hintergrund #229 (JanKgh, SolarEdge-Multi-String-Setup):
Manche Investitions-Felder existieren sowohl als eigene Tabellen-Spalte
(z.B. `Investition.leistung_kwp`) als auch potenziell als Schlüssel im
`parameter`-JSON. Die Spalte ist Source of Truth — wenn die Verteilungs-
Helper aber nur `parameter[key]` lesen, finden sie bei Spalten-gepflegten
Anlagen 0 vor und fallen auf Gleichverteilung zurück (1/N je Modul statt
anteilig nach Modulleistung).

Regel: Spalte hat Vorrang. Parameter-JSON nur als Fallback für Felder
ohne dedizierte Spalte oder für Legacy-Datensätze.

Folgt Memory `feedback_aggregations_drift.md`: bei Drift an mehreren
Read-Sites zentraler Helper statt Einzel-Patch.
"""

from __future__ import annotations

from typing import Any


_COLUMN_FOR_PARAM: dict[str, str] = {
    # parameter-key → Investition-Spalten-Attribut
    "leistung_kwp": "leistung_kwp",
    # weitere wenn Spalten hinzukommen (kapazitaet_kwh ist aktuell nur im
    # parameter-JSON, daher hier nicht gemappt)
}


def get_inv_value(inv: Any, key: str, default: float = 0.0) -> float:
    """Liest einen numerischen Investitions-Wert mit Spalten/Parameter-Fallback.

    Reihenfolge:
      1. Tabellen-Spalte (falls für `key` gemappt)
      2. parameter-JSON
      3. default
    """
    column_attr = _COLUMN_FOR_PARAM.get(key)
    if column_attr is not None:
        val = getattr(inv, column_attr, None)
        if val is not None:
            return val
    return (inv.parameter or {}).get(key, default) or default
