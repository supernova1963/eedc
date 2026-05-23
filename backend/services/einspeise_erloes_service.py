"""DB-Aggregate für die §51-bereinigte Erlös-Berechnung.

Brückenmodul zwischen `TagesZusammenfassung.einspeisung_neg_preis_kwh`
(Tages-Aggregat) und den Erlös-Read-Sites (Monatsdaten-basiert, in
aussichten.py, cockpit/uebersicht.py, ha_export.py, aktueller_monat.py,
cockpit/komponenten.py, investitionen/dashboards.py).

Liefert die §51-Aggregate pro Anlage × Monat bzw. × Jahr. Der reine
Berechnungs-Schritt (Erlös-Reduzierung × Vergütung) lebt im
Berechnungs-Layer: `core.berechnungen.einspeise_erloes_euro`.

Konvention:
- Rückgabe `None` wenn keine `TagesZusammenfassung`-Zeilen mit
  `einspeisung_neg_preis_kwh IS NOT NULL` existieren — das signalisiert
  Read-Sites: „Anwender hat keine Strompreis-Mitschrift / keinen
  Börsenpreis-Sensor"; alte Berechnung greift unverändert.
- Rückgabe `0.0` wenn Tages-Aggregate vorhanden sind, aber im Zeitraum keine
  Negativpreis-Einspeisung stattfand — eine echte 0, kein Daten-Fehlen.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.tages_energie_profil import TagesZusammenfassung


async def get_neg_preis_einspeisung_monat(
    db: AsyncSession,
    anlage_id: int,
    jahr: int,
    monat: int,
) -> Optional[float]:
    """Σ `einspeisung_neg_preis_kwh` über die Tage eines Monats.

    Returns:
        Summe in kWh wenn mindestens ein Tag im Monat einen nicht-NULL-Wert
        hat; sonst `None` (Anwender ohne Tages-Aggregate / Strompreis-Sensor).
    """
    stmt = (
        select(
            func.sum(TagesZusammenfassung.einspeisung_neg_preis_kwh),
            func.count(TagesZusammenfassung.einspeisung_neg_preis_kwh),
        )
        .where(TagesZusammenfassung.anlage_id == anlage_id)
        .where(extract("year", TagesZusammenfassung.datum) == jahr)
        .where(extract("month", TagesZusammenfassung.datum) == monat)
    )
    result = await db.execute(stmt)
    summe, anzahl = result.one()
    if not anzahl:
        return None
    return float(summe or 0.0)


async def get_neg_preis_einspeisung_jahr(
    db: AsyncSession,
    anlage_id: int,
    jahr: int,
) -> Optional[float]:
    """Σ `einspeisung_neg_preis_kwh` über alle Tage eines Jahres.

    Returns:
        Wie `get_neg_preis_einspeisung_monat`, aber Jahres-Aggregat. `None`
        wenn das Jahr keine Tages-Aggregate mit Strompreis-Mitschrift hat.
    """
    stmt = (
        select(
            func.sum(TagesZusammenfassung.einspeisung_neg_preis_kwh),
            func.count(TagesZusammenfassung.einspeisung_neg_preis_kwh),
        )
        .where(TagesZusammenfassung.anlage_id == anlage_id)
        .where(extract("year", TagesZusammenfassung.datum) == jahr)
    )
    result = await db.execute(stmt)
    summe, anzahl = result.one()
    if not anzahl:
        return None
    return float(summe or 0.0)
