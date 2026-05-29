"""Konformitäts-Test K1 (v3.34.0 Phase A, auf zwei Listen reduziert v3.34.2 Phase B).

Koppelt die real existierenden Prognose-Felder-Listen über die Subsystem-Grenze
hinweg ohne sie zu verschmelzen — bei Drift in einer Stelle bricht der Test.

Hintergrund (Audit §4.1, Plan v3.34 §3 Phase A/B K1):

- ``_PROGNOSE_FELDER_RETTEN`` im Aggregator listet die Felder, die der
  Delete-and-Recreate-Pfad vor dem Recreate retten muss (asynchron vom
  Wetter-Endpoint geschrieben).
- ``_TZ_SCHREIBFELDER_PROGNOSE`` in ``live_wetter`` ist die dokumentierte
  Liste der Felder, die ``_speichere_prognose`` befüllt.

**v3.34.2 Phase B:** die dritte Liste ``_PROGNOSE_FELDER_RETTEN_BACKFILL``
ist mit der Backfill-Konsolidierung **strukturell entfallen** — der Backfill
schreibt nicht mehr eigenständig in TZ, sondern läuft als dünne Schleife durch
``aggregate_day`` (Plan E1). Damit existiert nur noch EINE Subsystem-Grenze
(Aggregator vs Wetter-Endpoint), und K1 schrumpft plan­gemäß auf zwei Listen.

Bewusst KEINE geteilte Konstante über Module hinweg (Plan §7 Punkt 3) — eine
Sammel-Konstante würde Subsysteme mit unabhängigen Lebenszyklen verkleben.
Der Test schaut nur auf die zwei Listen und prüft Mengen-Gleichheit.

Vorfallsbezug: v3.31.7 (#190) hatte ``_PROGNOSE_FELDER_RETTEN`` um zwei
Stundenprofil-Felder erweitert, ohne die (inzwischen entfallene) Backfill-Liste
mitzunehmen — genau diese Drift verhindert der Test an der verbleibenden Grenze.
"""

from __future__ import annotations

import pytest


def test_k1_prognose_felder_listen_synchron():
    """Die zwei real existierenden Prognose-Felder-Listen müssen als Menge
    gleich sein.

    Wenn dieser Test bricht, ist eine der Listen out-of-sync. Mögliche Ursachen:

    1. Neues Prognose-Feld in ``live_wetter._speichere_prognose`` hinzugefügt,
       ohne ``_PROGNOSE_FELDER_RETTEN`` (Aggregator) anzupassen. Folge: das
       neue Feld wird beim nächsten Aggregator-Recreate aus TZ gelöscht.
    2. Feld in der Rettungs-Liste vergessen. Folge wie 1.
    3. Feld in ``_speichere_prognose`` entfernt, Rettungs-Liste nicht
       bereinigt. Folge: tote Symbol-Referenz.

    Empfohlene Reaktion: die fehlenden Felder in der jeweils anderen Liste
    ergänzen, niemals die Listen via Import zu einer gemeinsamen Konstante
    verschmelzen (Plan §7 Punkt 3 — Anti-Scope für Subsystem-Verklebung).
    """
    from backend.services.energie_profil.aggregator import _PROGNOSE_FELDER_RETTEN
    from backend.api.routes.live_wetter import _TZ_SCHREIBFELDER_PROGNOSE

    aggregator = set(_PROGNOSE_FELDER_RETTEN)
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


def test_k1_prognose_felder_existieren_auf_modell():
    """Jede der zwei Listen darf nur Feld-Namen enthalten, die wirklich als
    Spalte auf ``TagesZusammenfassung`` existieren — sonst läuft der
    ``getattr(...)``-Loop ins Leere und der Schutz greift still nicht."""
    from backend.models.tages_energie_profil import TagesZusammenfassung
    from backend.services.energie_profil.aggregator import _PROGNOSE_FELDER_RETTEN
    from backend.api.routes.live_wetter import _TZ_SCHREIBFELDER_PROGNOSE

    tz_spalten = {col.name for col in TagesZusammenfassung.__table__.columns}

    for liste_name, liste in (
        ("_PROGNOSE_FELDER_RETTEN", _PROGNOSE_FELDER_RETTEN),
        ("_TZ_SCHREIBFELDER_PROGNOSE", _TZ_SCHREIBFELDER_PROGNOSE),
    ):
        fehlend = set(liste) - tz_spalten
        assert not fehlend, (
            f"K1: {liste_name} enthält Felder, die nicht auf "
            f"`TagesZusammenfassung` existieren: {sorted(fehlend)}"
        )
