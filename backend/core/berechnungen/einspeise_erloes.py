"""Einspeise-Erlös unter §51 EEG.

Single Source of Truth für die Erlös-Berechnung aus Einspeisung × Vergütung.

Hintergrund: Seit Solarpaket I (Mai 2024, Wirkung ab Februar 2025) entfällt
für Neuanlagen die Einspeisevergütung in Stunden mit negativem Börsenpreis
(§51 EEG). Anwender mit dynamischem Strompreis-Sensor (oder mit dem
aWATTar-Börsenpreis-Fallback aus dem Strompreis-Mitschrift-Feature) sammeln
die betroffenen kWh als `einspeisung_neg_preis_kwh` im Tages-Aggregat
`TagesZusammenfassung` — heute bereits aktiv, aber bisher nirgendwo aus der
Erlös-Berechnung abgezogen (rcmcronny Discussion #120).

Dieser Layer-Helper macht die reine Berechnung ohne DB-Zugriff; der zugehörige
Monats-Aggregat-Lookup über `TagesZusammenfassung` lebt in
`services/einspeise_erloes_service.py` (DB-frei bleibt der Layer).

Verhalten:
- `einspeise_erloes_euro` toleriert `None` für die §51-Spalte (Anwender ohne
  Tages-Aggregate / ohne Börsenpreis-Sensor) — dann zählt die volle
  Einspeisung wie vor diesem Feature.
- Bei `neg_preis_kwh > einspeisung_kwh` greift `max(0, …)` — diese
  Inkonsistenz kann nur durch Drift zwischen Monatsdaten und Tages-Aggregat
  entstehen und darf nicht zu negativen Erlösen führen.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class EinspeiseErloes:
    """Ergebnis der §51-bereinigten Erlös-Berechnung."""

    erloes_euro: float
    """Tatsächlicher Erlös in € (nach §51-Abzug)."""

    nicht_vergueteter_erloes_euro: float
    """Erlös, der durch §51 entfallen ist (= entgangener Erlös)."""

    nicht_verguetete_kwh: float
    """Eingespeiste kWh, die nicht vergütet wurden (= §51-Volumen)."""


def einspeise_erloes_euro(
    einspeisung_kwh: float,
    neg_preis_kwh: Optional[float],
    verguetung_ct_kwh: float,
) -> EinspeiseErloes:
    """§51-bereinigter Erlös aus Einspeisung × Vergütung.

    Args:
        einspeisung_kwh: Σ ins Netz eingespeist in der Periode.
        neg_preis_kwh: davon bei negativem Börsenpreis eingespeist (§51 EEG).
            `None` = unbekannt (Anwender ohne Strompreis-Sensor) → kein Abzug.
        verguetung_ct_kwh: Einspeisevergütung in ct/kWh.

    Returns:
        EinspeiseErloes mit erloes_euro, nicht_vergueteter_erloes_euro,
        nicht_verguetete_kwh — die zwei letzteren sind 0.0 wenn neg_preis_kwh
        None oder 0 ist.

    Invariante: `erloes_euro + nicht_vergueteter_erloes_euro` entspricht der
    alten ungekürzten Berechnung `einspeisung_kwh × verguetung_ct_kwh / 100`.
    """
    if einspeisung_kwh <= 0:
        return EinspeiseErloes(0.0, 0.0, 0.0)

    abzug_kwh = max(0.0, min(neg_preis_kwh or 0.0, einspeisung_kwh))
    verguetete_kwh = einspeisung_kwh - abzug_kwh

    erloes = verguetete_kwh * verguetung_ct_kwh / 100.0
    entgangener_erloes = abzug_kwh * verguetung_ct_kwh / 100.0

    return EinspeiseErloes(
        erloes_euro=erloes,
        nicht_vergueteter_erloes_euro=entgangener_erloes,
        nicht_verguetete_kwh=abzug_kwh,
    )
