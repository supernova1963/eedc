"""
Backfill-Pfade (Etappe 3d P3 Refactoring-Tail).

Drei Funktionen extrahiert aus `services/energie_profil_service.py`:

- `backfill_range(anlage, von, bis, db)` ruft `aggregate_day` für einen
  Datumsbereich (Live-Sensoren via `live_power_service`).
- `backfill_from_statistics(anlage, von, bis, db)` baut Energieprofile
  additiv aus HA Long-Term Statistics auf — Schreib-Pfad auf
  `TagesZusammenfassung` + `TagesEnergieProfil`, im P3-Architektur-Commit
  unter Source `external:ha_statistics` an Provenance angeschlossen.
- `resolve_and_backfill_from_statistics(anlage, db, von, bis)` orchestriert
  den additiven Vollbackfill (resolve Live-Sensoren, ermittele Range).

`_get_wetter_ist` liegt in `backend.services.energie_profil._helpers` und
wird lazy importiert.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal, Optional

from sqlalchemy import and_ as sa_and
from sqlalchemy import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.anlage import Anlage
from backend.models.tages_energie_profil import TagesZusammenfassung
from backend.services.energie_profil.aggregator import aggregate_day
from backend.services.energie_profil.source import Source

logger = logging.getLogger(__name__)

# Leeres Status-Dict für die frühen Abbruch-Pfade (kein Sensor, keine HA-Daten).
# Der Caller (`resolve_and_backfill_from_statistics`) liest `stats["geschrieben"]`
# etc. — vor v3.34.2 gaben diese Pfade ein nacktes `0` (int) zurück, was beim
# Indexzugriff im Caller eine TypeError-Falle war (latent, weil der Caller die
# meisten dieser Bedingungen vorher selbst abfängt). Jetzt einheitlich Dict.
_LEERER_BACKFILL_STATUS = {
    "geschrieben": 0,
    "uebersprungen_keine_daten": 0,
    "uebersprungen_existiert": 0,
}


async def backfill_range(
    anlage: Anlage,
    von: date,
    bis: date,
    db: AsyncSession,
) -> int:
    """
    Nachberechnung für einen Datumsbereich (z.B. beim Monatsabschluss).

    Nur möglich wenn HA-History noch verfügbar ist (~10 Tage).

    Args:
        anlage: Die Anlage
        von/bis: Datumsbereich (inklusiv)
        db: DB-Session

    Returns:
        Anzahl erfolgreich aggregierter Tage
    """
    count = 0
    current = von
    while current <= bis:
        try:
            result = await aggregate_day(
                anlage, current, db, source=Source.MONATSABSCHLUSS_BACKFILL,
            )
            if result:
                count += 1
            # Per-Tag-Commit: gibt den SQLite-Writer-Lock kurz frei, damit
            # parallele Schreiber (Monatsabschluss-Wizard, Activity-Log,
            # MQTT-Snapshot-Jobs) nicht in busy_timeout laufen (#291).
            # Aggregation ist idempotent (Delete+Insert pro Tag), commit
            # ändert nichts an der semantischen Korrektheit.
            await db.commit()
        except Exception as e:
            logger.warning(f"Backfill {current}: {type(e).__name__}: {e}")
            await db.rollback()
        current += timedelta(days=1)

    if count > 0:
        logger.info(f"Backfill Anlage {anlage.id}: {count} Tage von {von} bis {bis}")

    return count


async def backfill_from_statistics(
    anlage: "Anlage",
    von: date,
    bis: date,
    db: AsyncSession,
) -> dict:
    """
    Additiver Energieprofil-Aufbau aus HA Long-Term Statistics.

    **v3.34.2 Phase B — dünne Schleife über `aggregate_day`.** Diese Funktion
    beschafft nur noch die historischen Stunden-Leistungen gebündelt aus HA-LTS
    (`get_hourly_sensor_data` einmal pro Range — `get_tagesverlauf` reicht nur
    ~10 Tage zurück) und reicht sie pro fehlendem Tag als
    `prefetched_tagesverlauf` an `aggregate_day(source=VOLLBACKFILL_FROM_LTS)`
    durch. Die komplette Aggregations-Logik (kategorisierte Stunden-kWh,
    Boundary-kWh, Peaks, Strompreise, Börsenpreis-Felder, Counter, Prognose-
    Rettung, Provenance, Invariante) lebt nur noch in `aggregate_day` — kein
    paralleler Top-Level-Schreibpfad mehr (Audit §6.1, Plan v3.34 E1/E2). Die
    frühere Backfill-eigene Boundary-/Komponenten-/Peak-/Rettungslisten-Logik
    ist damit entfallen.

    **Stille Datenverbesserung (Plan §1.3 Stufe 2):** für neu nachgefüllte Tage
    werden jetzt auch Peaks (HA-LTS-Min/Max), Strompreis-/Börsenpreis-Felder
    gesetzt und die Boundary-kWh kommt aus dem HA-LTS-Pfad (statt
    Snapshot-Variante). Bestehende Tage bleiben unverändert — der Backfill ist
    weiterhin **additiv** (#190): Tage mit vorhandener TZ werden gar nicht erst
    aggregiert.

    Ein Overwrite-Modus existiert bewusst nicht (#190): „löschen + neu
    berechnen" ist datenfeindlich, weil HA-LTS für viele Anlagen kürzer
    zurückreicht als das gepflegte Profil. Wer einen einzelnen Tag reparieren
    will, nutzt /reaggregate-tag mit Vorschau (chirurgisch, idempotent).

    Args:
        anlage: Die Anlage
        von/bis: Datumsbereich (inklusiv)
        db: DB-Session

    Returns:
        dict mit:
          - geschrieben (int): erfolgreich geschriebene Tage
          - uebersprungen_keine_daten (int): Tage ohne HA-Statistics-Werte
            (#190 Bug B: vorher stiller Skip — User dachte „79,4 % wurden
            verloren", tatsächlich hatte HA für diese Tage keine Daten)
          - uebersprungen_existiert (int): Tage mit bereits vorhandenem Profil
    """
    from backend.models.investition import Investition
    from backend.utils.investition_filter import aktiv_im_zeitraum
    from backend.services.live_sensor_config import (
        baue_investitions_serien,
        extract_live_config,
    )
    from backend.services.ha_statistics_service import get_ha_statistics_service

    # Investitionen laden — alle die im Backfill-Zeitraum aktiv waren
    # (`aktiv_im_zeitraum`), für den Serien-Aufbau über die Range. Die Per-Tag-
    # Verfeinerung (genau die am jeweiligen Tag aktiven Investitionen) macht
    # die `ist_aktiv_an(current)`-Filterung in der Schleife unten plus der
    # `aktiv_am_tag`-Inv-Load in `aggregate_day` (Audit §6.4).
    inv_result = await db.execute(
        sa_select(Investition).where(
            Investition.anlage_id == anlage.id,
            aktiv_im_zeitraum(von, bis),
        )
    )
    investitionen: dict[str, Investition] = {
        str(inv.id): inv for inv in inv_result.scalars().all()
    }

    basis_live, inv_live_map, basis_invert, inv_invert_map = extract_live_config(anlage)

    if not basis_live and not inv_live_map:
        logger.info(f"Anlage {anlage.id}: Keine Live-Sensoren konfiguriert, Backfill übersprungen")
        return dict(_LEERER_BACKFILL_STATUS)

    # ── Serien + Entity-Mapping über die geteilte Quelle (Issue #318, M1) ──────
    # Identische Selektion (inkl. Pool-Dedup #227) wie der Live-Pfad
    # (`live_tagesverlauf_service`), damit Scheduler- und Backfill-Aggregation
    # desselben Tages deckungsgleiche TEP.komponenten/Peaks liefern. Backfill
    # nutzt nur die Kern-Felder; Chart-Metadaten sind Live-spezifisch.
    serien_core, serie_entities = baue_investitions_serien(inv_live_map, investitionen)
    serien: list[dict] = [
        {"key": s.key, "inv_id": s.inv_id, "kategorie": s.kategorie,
         "seite": s.seite, "bidirektional": s.bidirektional}
        for s in serien_core
    ]

    # PV Gesamt als Fallback
    has_individual_pv = any(s["kategorie"] == "pv" for s in serien)
    if not has_individual_pv and basis_live.get("pv_gesamt_w"):
        serien.append({"key": "pv_gesamt", "kategorie": "pv", "seite": "quelle", "bidirektional": False})
        serie_entities["pv_gesamt"] = [basis_live["pv_gesamt_w"]]

    # Netz-Konfiguration
    netz_kombi_eid = basis_live.get("netz_kombi_w")
    netz_einspeisung_eid = basis_live.get("einspeisung_w")
    netz_bezug_eid = basis_live.get("netzbezug_w")
    if netz_kombi_eid and not netz_einspeisung_eid and not netz_bezug_eid:
        serien.append({"key": "netz", "kategorie": "netz", "seite": "quelle", "bidirektional": True})
    elif netz_einspeisung_eid or netz_bezug_eid:
        netz_kombi_eid = None
        serien.append({"key": "netz", "kategorie": "netz", "seite": "quelle", "bidirektional": True})

    # ── Alle Entity-IDs sammeln ──────────────────────────────────────────────
    all_entity_ids: set[str] = set(eid for eids in serie_entities.values() for eid in eids)
    if netz_kombi_eid:
        all_entity_ids.add(netz_kombi_eid)
    if netz_bezug_eid:
        all_entity_ids.add(netz_bezug_eid)
    if netz_einspeisung_eid:
        all_entity_ids.add(netz_einspeisung_eid)

    # SoC wird NICHT mehr hier vorgeholt — `aggregate_day` holt die Speicher-
    # SoC-History selbst über `_get_soc_history` (Pfad 1: HA-LTS-Hourly-Mean,
    # dieselbe Quelle, die der Bulk-Read nutzt → für historische Tage verfügbar,
    # Vollzyklen bleiben erhalten). v3.34.2 Phase B.

    if not all_entity_ids:
        return dict(_LEERER_BACKFILL_STATUS)

    # ── HA Statistics abfragen (Executor wegen Sync-SQLAlchemy) ─────────────
    ha_service = get_ha_statistics_service()
    if not ha_service.is_available:
        logger.warning(f"Anlage {anlage.id}: HA Statistics nicht verfügbar, Backfill übersprungen")
        return dict(_LEERER_BACKFILL_STATUS)

    hourly_data = await asyncio.to_thread(
        ha_service.get_hourly_sensor_data, list(all_entity_ids), von, bis
    )

    if not hourly_data:
        logger.info(f"Anlage {anlage.id}: Keine Statistics-Daten für {von}–{bis}")
        return dict(_LEERER_BACKFILL_STATUS)

    # ── Vorzeichen-Invertierung anwenden (wie apply_invert_to_history) ───────
    invert_eids: set[str] = set()
    for key, should_invert in basis_invert.items():
        if should_invert and key in basis_live:
            invert_eids.add(basis_live[key])
    for inv_id, invert_flags in inv_invert_map.items():
        live = inv_live_map.get(inv_id, {})
        for key, should_invert in invert_flags.items():
            if should_invert and key in live:
                invert_eids.add(live[key])
    for eid in invert_eids:
        if eid in hourly_data:
            for datum_iso in hourly_data[eid]:
                hourly_data[eid][datum_iso] = {
                    h: -v for h, v in hourly_data[eid][datum_iso].items()
                }

    # (Die Kategorie-Schlüssel-Sets + die W-basierte Peak-/pv_kw-Berechnung
    # leben nicht mehr hier — `aggregate_day` leitet sie aus den durchgereichten
    # `serien` ab. v3.34.2 Phase B.)

    # ── Bestehende Tage ermitteln (immer additiv, #190) ──────────────────────
    ex_result = await db.execute(
        sa_select(TagesZusammenfassung.datum).where(
            sa_and(
                TagesZusammenfassung.anlage_id == anlage.id,
                TagesZusammenfassung.datum >= von,
                TagesZusammenfassung.datum <= bis,
            )
        )
    )
    existing_dates: set[date] = {row[0] for row in ex_result}

    # ── Pro-Tag-Schleife: pro fehlendem Tag ein aggregate_day-Aufruf ─────────
    # Diese Funktion baut nur noch die vorgeholten Tagesverlauf-Daten (raw-kW
    # pro Serie aus dem HA-LTS-Bulk-Read, Butterfly-Konvention) und reicht sie
    # als `prefetched_tagesverlauf` durch. Alles Weitere — kategorisierte
    # Stunden-kWh, Boundary-kWh, Peaks (HA-LTS-Min/Max), Strompreise,
    # Börsenpreis-Felder, Counter, SoC/Vollzyklen, Prognose-Rettung, Provenance,
    # Konsistenz-Invariante — erledigt `aggregate_day` mit
    # `source=VOLLBACKFILL_FROM_LTS`. Genau EIN Top-Level-Schreibpfad
    # (Audit §6.1, Plan v3.34 E1).
    count = 0
    skipped_no_data = 0
    skipped_existing = 0
    current = von
    while current <= bis:
        if current in existing_dates:
            skipped_existing += 1
            current += timedelta(days=1)
            continue

        datum_iso = current.isoformat()

        # Serien filtern: nur Investitionen, die an diesem Tag aktiv waren.
        # In-Memory-Pendant zum `aktiv_am_tag`-Inv-Load in `aggregate_day`
        # (Audit §6.4) — punkte + Serien-Metadaten bleiben so tag-konsistent.
        tages_serien = [
            s for s in serien
            if s.get("inv_id") is None  # Basis-Serien (PV Gesamt, Netz)
            or investitionen.get(s["inv_id"], None) is None  # Safety
            or investitionen[s["inv_id"]].ist_aktiv_an(current)
        ]

        # punkte (get_tagesverlauf-Form) aus dem HA-LTS-Bulk-Read aufbauen:
        # je Stunde MIT Daten ein werte-Dict {serie_key: kW}. Stunden ohne
        # jegliche Werte werden ausgelassen (wie der frühere `if not werte:
        # continue`-Skip) — damit bleibt `stunden_verfuegbar` identisch zur
        # Stunden-mit-Daten-Zählung.
        punkte: list[dict] = []
        for h in range(24):
            werte: dict[str, float] = {}

            for serie in tages_serien:
                skey = serie["key"]
                if serie["kategorie"] == "netz":
                    continue  # Netz separat
                entity_ids = serie_entities.get(skey, [])
                serie_sum_kw = 0.0
                has_data = False
                for entity_id in entity_ids:
                    val = hourly_data.get(entity_id, {}).get(datum_iso, {}).get(h)
                    if val is not None:
                        serie_sum_kw += val
                        has_data = True
                if has_data:
                    if serie["bidirektional"]:
                        raw_val = -serie_sum_kw
                    elif serie["seite"] == "senke":
                        raw_val = -abs(serie_sum_kw)
                    else:
                        raw_val = abs(serie_sum_kw)
                    werte[skey] = round(raw_val, 3)

            # Netz (Kombi-Sensor oder getrennt Bezug/Einspeisung)
            bezug_kw = 0.0
            einsp_kw = 0.0
            if netz_kombi_eid:
                val = hourly_data.get(netz_kombi_eid, {}).get(datum_iso, {}).get(h)
                if val is not None:
                    if val >= 0:
                        bezug_kw = val
                    else:
                        einsp_kw = abs(val)
            else:
                if netz_bezug_eid:
                    val = hourly_data.get(netz_bezug_eid, {}).get(datum_iso, {}).get(h)
                    if val is not None:
                        bezug_kw = max(0.0, val)
                if netz_einspeisung_eid:
                    val = hourly_data.get(netz_einspeisung_eid, {}).get(datum_iso, {}).get(h)
                    if val is not None:
                        einsp_kw = max(0.0, val)
            netto_kw = bezug_kw - einsp_kw
            if bezug_kw > 0 or einsp_kw > 0 or abs(netto_kw) > 0.001:
                werte["netz"] = round(netto_kw, 3)

            if werte:
                punkte.append({"zeit": f"{h:02d}:00", "werte": werte})

        if not punkte:
            # #190 Bug B: kein stiller Skip — der Tag hatte schlicht keine
            # HA-Statistics-Werte (Skip-Transparenz im Status-Dict).
            skipped_no_data += 1
            current += timedelta(days=1)
            continue

        prefetched = {"serien": tages_serien, "punkte": punkte}
        try:
            zusammenfassung = await aggregate_day(
                anlage, current, db,
                source=Source.VOLLBACKFILL_FROM_LTS,
                prefetched_tagesverlauf=prefetched,
            )
            if zusammenfassung is not None:
                count += 1
            else:
                # aggregate_day lieferte trotz Stunden-Daten None — als
                # „keine verwertbaren Daten" zählen (defensiv, praktisch selten).
                skipped_no_data += 1
            # Per-Tag-Commit: gibt den SQLite-Writer-Lock kurz frei, damit
            # parallele Schreiber (Monatsabschluss-Wizard, Activity-Log,
            # MQTT-Snapshot-Jobs) nicht in busy_timeout laufen (#291).
            # Backfill ist additiv + idempotent, commit ändert die
            # semantische Korrektheit nicht.
            await db.commit()
        except Exception as e:
            logger.warning(
                f"Backfill (Statistics) Anlage {anlage.id}, {current}: "
                f"aggregate_day fehlgeschlagen: {type(e).__name__}: {e}"
            )
            await db.rollback()
        current += timedelta(days=1)

    if skipped_no_data > 0:
        logger.info(
            f"Backfill Anlage {anlage.id}: {count} geschrieben, "
            f"{skipped_no_data} ohne HA-Daten übersprungen, "
            f"{skipped_existing} bereits vorhanden"
        )

    return {
        "geschrieben": count,
        "uebersprungen_keine_daten": skipped_no_data,
        "uebersprungen_existiert": skipped_existing,
    }


BackfillStatus = Literal[
    "ok",
    "ha_unavailable",
    "no_sensors",
    "no_valid_sensors",
    "earliest_unknown",
    "empty_range",
]


@dataclass
class BackfillResult:
    """Ergebnis von resolve_and_backfill_from_statistics()."""
    status: BackfillStatus
    von: Optional[date] = None
    bis: Optional[date] = None
    verarbeitet: int = 0
    geschrieben: int = 0
    # #190 Bug B: Skip-Transparenz statt stillem 79,4%-Cap
    uebersprungen_keine_daten: int = 0
    uebersprungen_existiert: int = 0
    missing_eids: list[str] = None
    detail: str = ""

    def __post_init__(self):
        if self.missing_eids is None:
            self.missing_eids = []


async def resolve_and_backfill_from_statistics(
    anlage: Anlage,
    db: AsyncSession,
    *,
    von: Optional[date] = None,
    bis: Optional[date] = None,
) -> BackfillResult:
    """
    Orchestriert den additiven Vollbackfill aus HA Long-Term Statistics:

    - resolved Live-Sensoren der Anlage
    - filtert ungültige Sensor-IDs
    - ermittelt frühestes Datum aus HA Statistics (falls `von` None)
    - default `bis` = gestern
    - ruft backfill_from_statistics() mit dem ermittelten Zeitraum auf

    Wird vom manuellen Wizard-Endpoint und vom Auto-Vollbackfill im
    Monatsabschluss-Background-Task geteilt — gleiche Logik, unterschiedliche
    Fehlerbehandlung im Caller (HTTPException vs. Log). Bestehende Tage
    bleiben **immer** unverändert (#190).
    """
    from backend.services.ha_statistics_service import get_ha_statistics_service
    from backend.services.live_sensor_config import extract_live_config

    ha_service = get_ha_statistics_service()
    if not ha_service.is_available:
        return BackfillResult(status="ha_unavailable", detail="HA Statistics Datenbank nicht verfügbar")

    basis_live, inv_live_map, _, _ = extract_live_config(anlage)
    all_eids = list(set(
        list(basis_live.values()) +
        [eid for live in inv_live_map.values() for eid in live.values() if eid]
    ))
    if not all_eids:
        return BackfillResult(status="no_sensors", detail="Keine Live-Sensoren konfiguriert")

    valid_eids, missing_eids = await asyncio.to_thread(ha_service.filter_valid_sensor_ids, all_eids)
    if not valid_eids:
        return BackfillResult(
            status="no_valid_sensors",
            missing_eids=missing_eids,
            detail=(
                f"Keiner der konfigurierten Live-Sensoren wurde in der HA-Datenbank gefunden: "
                f"{all_eids}. Bitte Sensor-Zuordnung im Wizard prüfen und veraltete Sensoren entfernen."
            ),
        )

    if bis is None:
        bis = date.today() - timedelta(days=1)

    if von is None:
        try:
            verfuegbar = await asyncio.to_thread(ha_service.get_verfuegbare_monate, valid_eids)
            von = verfuegbar.erstes_datum
        except Exception as e:
            return BackfillResult(
                status="earliest_unknown",
                missing_eids=missing_eids,
                detail=f"Konnte frühestes Datum nicht ermitteln: {e}",
            )

    if von > bis:
        return BackfillResult(
            status="empty_range",
            von=von,
            bis=bis,
            missing_eids=missing_eids,
            detail=f"von ({von}) > bis ({bis})",
        )

    verarbeitet = (bis - von).days + 1
    stats = await backfill_from_statistics(anlage, von, bis, db)

    return BackfillResult(
        status="ok",
        von=von,
        bis=bis,
        verarbeitet=verarbeitet,
        geschrieben=stats["geschrieben"],
        uebersprungen_keine_daten=stats["uebersprungen_keine_daten"],
        uebersprungen_existiert=stats["uebersprungen_existiert"],
        missing_eids=missing_eids,
    )
