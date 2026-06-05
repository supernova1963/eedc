"""Live-Wetter: `grund` bei !verfuegbar — keine schuld-umkehrende Meldung.

rapahl-PN 2026-06-05: Die Live-Wetteransicht zeigte „Keine Wetterdaten verfügbar
— Standort-Koordinaten in den Stammdaten hinterlegen", obwohl die Koordinaten
gesetzt waren (Prognosen liefen). Ursache war ein Backend-Abruf-/Cache-Fehler
(Negativ-Cache, vgl. `5a5158c2`), KEINE fehlende Konfiguration. Der Endpoint
liefert jetzt einen `grund`, damit das Frontend ehrlich unterscheidet
([[feedback_user_fehlermeldungen]]: Backend beobachtbar machen statt Schuld umkehren).
"""

from __future__ import annotations

import logging

import pytest

from backend.api.routes import live_wetter
from backend.api.routes.live_wetter import get_live_wetter
from backend.models import Anlage


async def test_grund_keine_koordinaten_wenn_stammdaten_luecke(db):
    """Ohne lat/lon: verfuegbar=False, grund='keine_koordinaten' (echte Lücke)."""
    anlage = Anlage(anlagenname="OhneKoord", leistung_kwp=10.0, latitude=None, longitude=None)
    db.add(anlage)
    await db.flush()

    res = await get_live_wetter(anlage_id=anlage.id, demo=False, db=db)
    assert res["verfuegbar"] is False
    assert res["grund"] == "keine_koordinaten"


async def test_grund_abruf_fehlgeschlagen_bei_negativ_cache(db, monkeypatch):
    """Koordinaten vorhanden, aber Abruf vorher fehlgeschlagen (Negativ-Cache):
    verfuegbar=False, grund='abruf_fehlgeschlagen' — NICHT 'keine_koordinaten'.
    So zeigt das Frontend „vorübergehend gestört" statt Konfigurations-Schuld."""
    anlage = Anlage(anlagenname="MitKoord", leistung_kwp=10.0, latitude=48.1, longitude=11.6)
    db.add(anlage)
    await db.flush()

    # Cache leer, aber Negativ-Cache-Treffer → Abruf-Fehler-Pfad ohne echten HTTP-Call.
    monkeypatch.setattr(live_wetter, "_cache_get", lambda *a, **k: None)
    monkeypatch.setattr(live_wetter, "_error_cache_check", lambda *a, **k: True)

    res = await get_live_wetter(anlage_id=anlage.id, demo=False, db=db)
    assert res["verfuegbar"] is False
    assert res["grund"] == "abruf_fehlgeschlagen"


async def test_stale_2er_tupel_im_cache_wird_verworfen_kein_crash(db, monkeypatch, caplog):
    """Versions-Skew: der persistente L2-Cache (api_cache) kann ein 2er-Tupel
    (data, None) aus einer Vorversion (≤ v3.36.0) enthalten. warmup_l1_from_l2
    lädt es nach dem Neustart in L1, und der Prefetch-Skip-Guard überschreibt es
    nicht — der reine Schreiber-Fix (v3.36.1) heilt einen schon persistierten
    Eintrag NICHT. Der Endpoint entpackte aber stur 3 Werte → `ValueError:
    expected 3, got 2` → Negativ-Cache → „Keine Wetterdaten verfügbar".

    Der Leser muss ein Tupel falscher Arität wie einen Cache-Miss behandeln
    (verwerfen + Neu-Abruf), statt am Unpack zu crashen."""
    anlage = Anlage(anlagenname="StaleCache", leistung_kwp=10.0, latitude=48.1, longitude=11.6)
    db.add(anlage)
    await db.flush()

    # Stale 2er-Tupel aus Vorversion im Cache; Negativ-Cache greift NACH dem
    # Arität-Guard, sodass der Test nicht von der gesamten Fetch-Kette abhängt.
    monkeypatch.setattr(live_wetter, "_cache_get", lambda *a, **k: ({"hourly": {}}, None))
    monkeypatch.setattr(live_wetter, "_error_cache_check", lambda *a, **k: True)

    with caplog.at_level(logging.INFO, logger="backend.api.routes.live_wetter"):
        res = await get_live_wetter(anlage_id=anlage.id, demo=False, db=db)

    # Kein Crash am 3er-Unpack: Guard hat das 2er-Tupel verworfen ...
    assert any("falscher Arität" in r.message for r in caplog.records)
    # ... und NICHT als ValueError im Except gelandet.
    assert not any("ValueError" in r.message for r in caplog.records)
    assert res["verfuegbar"] is False
    assert res["grund"] == "abruf_fehlgeschlagen"
