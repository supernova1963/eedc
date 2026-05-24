"""
v3.33.0 Migration: Historische LTS-Aggregator-Drift in `komponenten_kwh`
bereinigen (Issue #290).

Hintergrund
-----------
Zwischen v3.31.0 (2026-05-16) und v3.33.0 hat die LTS-Variante des
Aggregators (`services.snapshot.lts_aggregator.get_komponenten_tageskwh_lts`)
alle gemappten Sensoren einer Investition unter demselben Komponenten-
Schlüssel aufaddiert — ohne die Per-Typ-Filter, die der Snapshot-Pfad
konsequent anwendet. Folge: HA-Add-on-Anlagen mit Multi-Sensor-Mapping
(WP-Thermisch, Speicher-Arbitrage, Wallbox-/E-Auto-Split, Sonstiges
bidirektional) hatten Faktor 2–10× überhöhte Werte in
`TagesZusammenfassung.komponenten_kwh`.

Strategie
---------
Reaggregate jeden Tag zwischen `BUG_EINGEFUEHRT` und `gestern` für alle
Anlagen mit `sensor_mapping`. Aggregator nutzt seit v3.33.0 den
korrigierten Helper — der Schreibpfad liefert nun die richtigen Werte.

Voraussetzungen
---------------
- Helper-basierte Aggregatoren sind aktiv (Schritt 1–3 des Fix-Plans).
- HA-LTS oder Snapshot-Pfad verfügbar (Anlagen ohne werden übersprungen).

Performance
-----------
~250 Tage × N Anlagen; pro Tag ~1–2 s. Per-Tag-Commit (siehe #291)
hält DB-Locks kurz, sodass paralleler Scheduler-Verkehr nicht blockiert
wird.

Idempotenz
----------
Pro Anlage wird in die `migrations`-Tabelle der Eintrag
`v3_33_0_lts_komponenten_kwh_bereinigung` geschrieben; `_apply_once`
verhindert eine zweite Ausführung.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.anlage import Anlage
from backend.models.tages_energie_profil import TagesZusammenfassung
from backend.services.energie_profil.aggregator import aggregate_day
from backend.services.energie_profil.source import Source

logger = logging.getLogger(__name__)


# Datum des fehlerhaften Releases (v3.31.0). Tage davor sind nicht
# betroffen (Snapshot-Pfad war Source-of-Truth).
BUG_EINGEFUEHRT = date(2026, 5, 16)


async def migrate_lts_komponenten_kwh_bug(session: AsyncSession) -> None:
    """Reaggregiert alle Tage seit `BUG_EINGEFUEHRT` für jede Anlage
    mit `sensor_mapping`.

    Performance-Optimierung: statt blind `backfill_range` über das volle
    Fenster zu rufen, listen wir nur die `TagesZusammenfassung`-Daten im
    Zeitraum auf und aggregieren genau die Tage, die tatsächlich existieren.
    Spart bei langem Update-Aufschub Minuten an leeren `aggregate_day`-Calls.

    Bis-Datum ist `gestern` — der laufende Tag wird vom Aggregator selbst
    gemieden (#290 Bug B). Anlagen ohne `sensor_mapping` werden übersprungen.
    """
    bis = date.today() - timedelta(days=1)
    if bis < BUG_EINGEFUEHRT:
        logger.info(
            "LTS-komponenten_kwh-Migration: BUG_EINGEFUEHRT liegt in der "
            "Zukunft — nichts zu tun."
        )
        return

    result = await session.execute(
        select(Anlage.id, Anlage.anlagenname, Anlage.sensor_mapping)
    )
    anlagen_rows = result.all()

    if not anlagen_rows:
        logger.info("LTS-komponenten_kwh-Migration: keine Anlagen gefunden.")
        return

    # User-sichtbarer Hinweis VOR Beginn — bei vielen Tagen kann das ein
    # paar Minuten dauern, der Anwender soll wissen, dass etwas läuft.
    try:
        from backend.services.activity_service import log_activity
        await log_activity(
            kategorie="migration",
            aktion="LTS-Komponenten-Drift-Bereinigung gestartet (v3.33.0)",
            details=(
                f"Historische TagesZusammenfassung.komponenten_kwh-Werte ab "
                f"{BUG_EINGEFUEHRT.isoformat()} werden neu aggregiert "
                "(Issue #290). Während des Laufs können Cockpit/Monatsbericht "
                "kurzzeitig inkonsistente Werte zeigen."
            ),
        )
    except Exception as e:
        logger.debug(f"Activity-Log-Eintrag (Start) fehlgeschlagen: {e}")

    total_aggregiert = 0
    behandelt = 0
    fehler = 0
    for anlage_id, name, sensor_mapping in anlagen_rows:
        if not sensor_mapping:
            continue
        # Nur tatsächlich existierende TZ-Tage im Zeitraum reaggregieren.
        tage_result = await session.execute(
            select(TagesZusammenfassung.datum).where(
                and_(
                    TagesZusammenfassung.anlage_id == anlage_id,
                    TagesZusammenfassung.datum >= BUG_EINGEFUEHRT,
                    TagesZusammenfassung.datum <= bis,
                )
            ).order_by(TagesZusammenfassung.datum.asc())
        )
        tage = [r[0] for r in tage_result.all()]
        if not tage:
            continue
        behandelt += 1
        anlage_obj = await session.get(Anlage, anlage_id)
        if anlage_obj is None:
            continue

        anzahl_anlage = 0
        for tag in tage:
            try:
                ergebnis = await aggregate_day(
                    anlage_obj, tag, session, source=Source.MONATSABSCHLUSS_BACKFILL,
                )
                # Per-Tag-Commit: gibt Writer-Lock frei (analog #291).
                await session.commit()
                if ergebnis is not None:
                    anzahl_anlage += 1
            except Exception as e:
                logger.warning(
                    f"LTS-komponenten_kwh-Migration Anlage {anlage_id} {tag}: "
                    f"{type(e).__name__}: {e}"
                )
                await session.rollback()
                fehler += 1

        total_aggregiert += anzahl_anlage
        logger.info(
            f"LTS-komponenten_kwh-Migration: Anlage {anlage_id} ({name}) — "
            f"{anzahl_anlage}/{len(tage)} Tage neu aggregiert "
            f"({BUG_EINGEFUEHRT} bis {bis})"
        )

    if behandelt == 0:
        logger.info(
            "LTS-komponenten_kwh-Migration: keine Anlage hatte TZ-Daten im "
            f"Zeitraum ab {BUG_EINGEFUEHRT} — nichts zu reaggregieren."
        )
        return

    # Abschluss-Hinweis im Activity-Log.
    try:
        from backend.services.activity_service import log_activity
        await log_activity(
            kategorie="migration",
            aktion="LTS-Komponenten-Drift bereinigt (v3.33.0)",
            details=(
                f"{behandelt} Anlage(n), {total_aggregiert} Tage seit "
                f"{BUG_EINGEFUEHRT.isoformat()} neu aggregiert "
                f"({fehler} Fehler). Issue #290. Historische "
                "Wärmepumpe-/Speicher-/Wallbox-/E-Auto-/Sonstiges-Werte "
                "mit Multi-Sensor-Mapping können sich geändert haben."
            ),
            erfolg=fehler == 0,
        )
    except Exception as e:
        logger.warning(f"Activity-Log-Eintrag (Ende) fehlgeschlagen: {type(e).__name__}: {e}")

    logger.info(
        f"LTS-komponenten_kwh-Migration: insgesamt {total_aggregiert} Tage "
        f"über {behandelt} Anlage(n) reaggregiert ({fehler} Fehler)."
    )
