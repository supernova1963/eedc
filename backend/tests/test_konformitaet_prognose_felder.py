"""Konformitäts-Test K1 (v3.34.0 Phase A).

Koppelt drei real existierende Prognose-Felder-Listen über Subsystem-Grenzen
hinweg ohne sie zu verschmelzen — bei Drift in einer Stelle bricht der Test.

Hintergrund (Audit §4.1, Plan v3.34 §3 Phase A K1):

- ``_PROGNOSE_FELDER_RETTEN`` im Aggregator listet die Felder, die der
  Delete-and-Recreate-Pfad vor dem Recreate retten muss (asynchron vom
  Wetter-Endpoint geschrieben).
- ``_PROGNOSE_FELDER_RETTEN_BACKFILL`` im Backfill ist die heute eigenständige
  Kopie (entfällt strukturell mit Phase B, wenn Backfill nicht mehr direkt
  schreibt).
- ``_TZ_SCHREIBFELDER_PROGNOSE`` in ``live_wetter`` ist die dokumentierte
  Liste der Felder, die ``_speichere_prognose`` befüllt.

Bewusst KEINE geteilte Konstante über Module hinweg (Plan §7 Punkt 3) — eine
Sammel-Konstante würde Subsysteme mit unabhängigen Lebenszyklen verkleben.
Der Test schaut nur auf die drei Listen und prüft Mengen-Gleichheit.

Vorfallsbezug: v3.31.7 (#190) hat ``_PROGNOSE_FELDER_RETTEN`` um zwei
Stundenprofil-Felder erweitert, ohne die Backfill-Liste mitzunehmen. Bei naiver
Umsetzung wäre dieser Test sofort rot gewesen — v3.34.0 hat die Backfill-Liste
mit angeglichen, dieser Test verhindert das Wiederauseinanderlaufen.
"""

from __future__ import annotations

import pytest


def test_k1_prognose_felder_listen_synchron():
    """Die drei real existierenden Prognose-Felder-Listen müssen als Menge
    gleich sein.

    Wenn dieser Test bricht, ist eine der Listen out-of-sync. Mögliche Ursachen:

    1. Neues Prognose-Feld in ``live_wetter._speichere_prognose`` hinzugefügt,
       ohne ``_PROGNOSE_FELDER_RETTEN`` (Aggregator) und
       ``_PROGNOSE_FELDER_RETTEN_BACKFILL`` (Backfill) anzupassen. Folge: das
       neue Feld wird beim nächsten Aggregator-Recreate aus TZ gelöscht.
    2. Feld in einer der Rettungs-Listen vergessen. Folge wie 1.
    3. Feld in ``_speichere_prognose`` entfernt, Rettungs-Listen nicht
       bereinigt. Folge: tote Symbol-Referenz.

    Empfohlene Reaktion: die fehlenden Felder in der jeweils anderen Liste
    ergänzen, niemals die Listen via Import zu einer gemeinsamen Konstante
    verschmelzen (Plan §7 Punkt 3 — Anti-Scope für Subsystem-Verklebung).
    """
    from backend.services.energie_profil.aggregator import _PROGNOSE_FELDER_RETTEN
    from backend.services.energie_profil.backfill import (
        _PROGNOSE_FELDER_RETTEN_BACKFILL,
    )
    from backend.api.routes.live_wetter import _TZ_SCHREIBFELDER_PROGNOSE

    aggregator = set(_PROGNOSE_FELDER_RETTEN)
    backfill = set(_PROGNOSE_FELDER_RETTEN_BACKFILL)
    wetter = set(_TZ_SCHREIBFELDER_PROGNOSE)

    if aggregator != wetter:
        nur_aggregator = aggregator - wetter
        nur_wetter = wetter - aggregator
        pytest.fail(
            "K1-Drift: Aggregator-Rettungs-Liste vs Wetter-Endpoint-Schreibfelder.\n"
            f"  Nur in `_PROGNOSE_FELDER_RETTEN` (aggregator.py): {sorted(nur_aggregator)}\n"
            f"  Nur in `_TZ_SCHREIBFELDER_PROGNOSE` (live_wetter.py): {sorted(nur_wetter)}\n"
            "Diese Listen müssen über die Aggregator-vs-Wetter-Endpoint-Subsystemgrenze "
            "synchron bleiben — bei jedem neuen Prognose-Feld beide pflegen."
        )

    if aggregator != backfill:
        nur_aggregator = aggregator - backfill
        nur_backfill = backfill - aggregator
        pytest.fail(
            "K1-Drift: Aggregator-Rettungs-Liste vs Backfill-Rettungs-Liste.\n"
            f"  Nur in `_PROGNOSE_FELDER_RETTEN` (aggregator.py): {sorted(nur_aggregator)}\n"
            f"  Nur in `_PROGNOSE_FELDER_RETTEN_BACKFILL` (backfill.py): {sorted(nur_backfill)}\n"
            "Mit v3.34.1 (Phase B) entfällt die Backfill-Liste — bis dahin synchron halten."
        )


def test_k1_prognose_felder_existieren_auf_modell():
    """Jede der drei Listen darf nur Feld-Namen enthalten, die wirklich als
    Spalte auf ``TagesZusammenfassung`` existieren — sonst läuft der
    ``getattr(...)``-Loop ins Leere und der Schutz greift still nicht."""
    from backend.models.tages_energie_profil import TagesZusammenfassung
    from backend.services.energie_profil.aggregator import _PROGNOSE_FELDER_RETTEN
    from backend.services.energie_profil.backfill import (
        _PROGNOSE_FELDER_RETTEN_BACKFILL,
    )
    from backend.api.routes.live_wetter import _TZ_SCHREIBFELDER_PROGNOSE

    tz_spalten = {col.name for col in TagesZusammenfassung.__table__.columns}

    for liste_name, liste in (
        ("_PROGNOSE_FELDER_RETTEN", _PROGNOSE_FELDER_RETTEN),
        ("_PROGNOSE_FELDER_RETTEN_BACKFILL", _PROGNOSE_FELDER_RETTEN_BACKFILL),
        ("_TZ_SCHREIBFELDER_PROGNOSE", _TZ_SCHREIBFELDER_PROGNOSE),
    ):
        fehlend = set(liste) - tz_spalten
        assert not fehlend, (
            f"K1: {liste_name} enthält Felder, die nicht auf "
            f"`TagesZusammenfassung` existieren: {sorted(fehlend)}"
        )
