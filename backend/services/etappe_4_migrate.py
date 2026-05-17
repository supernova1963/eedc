"""
Etappe 4 (v3.31.0) Migration: Reset `vollbackfill_durchgefuehrt` für
Anlagen mit HA-Integration.

Hintergrund: Etappe 4 stellt die Aggregat-Tabellen TagesZusammenfassung
und TagesEnergieProfil auf HA-Statistics-LTS als Source-of-Truth um.
Bestehende Daten (aus dem alten Mix aus Snapshot-Boundary-Diff + Σ-Hourly-
Riemann) sollen einmalig durch saubere HA-LTS-Werte überschrieben werden.

Mechanismus: das bestehende `vollbackfill_durchgefuehrt`-Flag triggert in
`services.monatsabschluss_aggregator.run_post_monatsabschluss_aggregation`
einen Auto-Vollbackfill aus HA-LTS beim nächsten Monatsabschluss. Diese
Migration setzt das Flag für betroffene Anlagen auf False, damit der
nächste Monatsabschluss-Wizard-Save den Vollbackfill auslöst.

Bedingung pro Anlage:
  - Sensor-Mapping vorhanden (es gibt Counter zum Aggregieren)
  - TagesZusammenfassung-Daten existieren (sonst nichts zu reaggregieren)

Wenn HA-LTS nicht verfügbar (Standalone-Modus ohne HA), läuft die
Migration nicht — der Aggregator-Fallback bleibt unverändert.

Memory-Linie `project_etappe_4_ha_lts_sot.md` Abschnitt 4.1 Option C.
"""

from __future__ import annotations

import logging

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.anlage import Anlage
from backend.models.tages_energie_profil import TagesZusammenfassung
from backend.services.ha_statistics_service import get_ha_statistics_service

logger = logging.getLogger(__name__)


async def migrate_etappe_4_reset_vollbackfill(session: AsyncSession) -> None:
    """Setzt `vollbackfill_durchgefuehrt = False` für Anlagen, die durch
    Etappe-4-Umstellung profitieren.

    Idempotent über die `migrations`-Tabelle in `_run_data_migrations`.
    """
    ha_svc = get_ha_statistics_service()
    if not ha_svc.is_available:
        logger.info(
            "Etappe-4-Migration: HA-LTS nicht verfügbar — Standalone-Modus, "
            "kein Reset des vollbackfill_durchgefuehrt-Flags nötig."
        )
        return

    # Anlagen-Kandidaten: hat sensor_mapping UND hat TagesZusammenfassung-Daten
    result = await session.execute(
        select(Anlage.id, Anlage.anlagenname, Anlage.sensor_mapping)
    )
    rows = result.all()

    geheilt: list[int] = []
    for anlage_id, name, sensor_mapping in rows:
        if not sensor_mapping:
            # Anlage ohne sensor_mapping — Standalone- oder nicht eingerichtete
            # Anlage. Reset bringt nichts.
            continue
        # Hat sie überhaupt schon Aggregat-Daten?
        tz_count = await session.execute(
            select(TagesZusammenfassung.id)
            .where(TagesZusammenfassung.anlage_id == anlage_id)
            .limit(1)
        )
        if not tz_count.scalar_one_or_none():
            continue
        geheilt.append(anlage_id)

    if not geheilt:
        logger.info(
            "Etappe-4-Migration: keine Anlage mit sensor_mapping + Aggregat-Daten "
            "gefunden — nichts zu tun."
        )
        return

    await session.execute(
        update(Anlage)
        .where(Anlage.id.in_(geheilt))
        .values(vollbackfill_durchgefuehrt=False)
    )
    # Caller (`_run_data_migrations._apply_once`) committet.

    logger.info(
        f"Etappe-4-Migration: vollbackfill_durchgefuehrt für {len(geheilt)} "
        f"Anlage(n) zurückgesetzt — Auto-Vollbackfill aus HA-LTS läuft beim "
        f"nächsten Monatsabschluss. Anlagen: {geheilt}"
    )
