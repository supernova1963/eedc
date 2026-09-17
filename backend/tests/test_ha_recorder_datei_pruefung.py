"""Eine unlesbare Recorder-Datei blockiert den WebSocket-Weg nicht (Blockmove).

Schwesterdateien: ``test_ha_statistics_websocket_transport.py`` (die Rangfolge
der Transporte), ``test_ha_lts_mean_reader.py`` (was über sie gelesen wird).

**Der Fall** (Forum simon42 T89667 #326/#332): Ein Anwender stellt seinen
HA-Recorder auf PostgreSQL/Timescale um. In ``/config`` bleibt die **alte**
``home-assistant_v2.db`` liegen. eedc sucht die Statistik in drei Stufen —
konfigurierte URL, Recorder-Datei, WebSocket-API — und blieb auf Stufe 2 hängen:
Die Datei **existierte**, also war ``_engine`` gesetzt, und damit gab ``_ws``
von da an ``None`` zurück. Der Weg, der bei ihm funktioniert hätte, wurde nie
versucht; im Log stand ein ``OperationalError``, in der Oberfläche standen leere
Langzeit-Kennzahlen.

⭐ Die Abhilfe ist die **Symmetrie zum URL-Zweig**, der seinen Verbindungstest
samt Rückfall seit #45 hat — keine neue Automatik. Geprüft wird eine
**Recorder-Tabelle**, nicht nur die Verbindung: Eine Datei, die sich öffnen
lässt, ist noch keine brauchbare Statistik-Quelle.

⚠ **Die Grenze steht in der Probe unten:** Das fängt „nicht lesbar", nicht
„alt, aber lesbar".
"""

from __future__ import annotations

import sqlite3

import pytest

from backend.services import ha_statistics_service as mod


@pytest.fixture
def _service(monkeypatch, tmp_path):
    """Ein frischer Service, dessen Recorder-Datei auf ``tmp_path`` zeigt."""
    def _bauen(dateiname: str = "home-assistant_v2.db"):
        pfad = tmp_path / dateiname
        monkeypatch.setattr(mod, "HA_DB_PATH", pfad)
        monkeypatch.setattr(mod, "HA_DB_PATH_LOCAL", tmp_path / "gibt-es-nicht.db")
        svc = mod.HAStatisticsService()
        svc._ws_client = object()  # Platzhalter: ein vorhandener WS-Transport
        return svc, pfad
    return _bauen


def test_datei_ohne_recorder_tabellen_wird_verworfen(_service):
    """⭐ Blockmoves Fall: Die Datei öffnet, trägt aber keine Statistik.

    Ohne diese Prüfung bliebe ``_engine`` gesetzt — und der WebSocket-Weg
    unerreichbar.
    """
    svc, pfad = _service()
    sqlite3.connect(pfad).execute("CREATE TABLE irgendwas (id INTEGER)")

    svc._init_engine()

    assert svc._engine is None, (
        "Eine Datei ohne `statistics_meta` ist keine Recorder-Datenbank — "
        "sie darf den WebSocket-Weg nicht blockieren."
    )


def test_der_websocket_weg_wird_danach_wieder_angeboten(_service):
    """Die eigentliche Folge: `_ws` gibt den Transport wieder heraus.

    ⚠ Ohne diese Probe prüfte die erste nur ein internes Feld. Der Anwender
    merkt nicht, ob `_engine` None ist — er merkt, ob seine Kennzahlen
    ankommen, und die kommen über diesen Weg.
    """
    svc, pfad = _service()
    sqlite3.connect(pfad).execute("CREATE TABLE irgendwas (id INTEGER)")

    assert svc._ws is not None


def test_eine_echte_recorder_datei_wird_weiter_genutzt(_service):
    """Die Gegenrichtung: Wer eine gültige Datei hat, behält den SQL-Weg.

    Sonst „löste" die Prüfung den Fall, indem sie den schnelleren Transport
    für alle abschaltet.
    """
    svc, pfad = _service()
    con = sqlite3.connect(pfad)
    con.execute("CREATE TABLE statistics_meta (id INTEGER, statistic_id TEXT)")
    con.commit()

    svc._init_engine()

    assert svc._engine is not None
    assert svc._ws is None  # SQL hat Vorrang, solange es trägt


def test_eine_alte_aber_lesbare_datei_bleibt_unentdeckt(_service):
    """⚠ Die dokumentierte **Grenze**, als Probe festgehalten.

    Diese Prüfung erkennt „nicht lesbar", nicht „veraltet". Wessen alte Datei
    sauber öffnet, bekommt weiterhin veraltete Zahlen — dagegen hilft kein
    Test, sondern der Hinweis, sie nach einem Recorder-Wechsel zu entfernen.

    Ein Frische-Urteil („älter als X Tage") wäre eine Automatik mit eigenem
    Fehlerrisiko: Steht Home Assistant eine Nacht still, gälte seine intakte
    Datenbank plötzlich als veraltet. Diese Probe hält fest, dass wir uns
    **bewusst** dagegen entschieden haben — sie ist keine offene Lücke,
    sondern eine benannte Grenze.
    """
    svc, pfad = _service()
    con = sqlite3.connect(pfad)
    con.execute("CREATE TABLE statistics_meta (id INTEGER, statistic_id TEXT)")
    con.execute("INSERT INTO statistics_meta VALUES (1, 'sensor.uralt')")
    con.commit()

    svc._init_engine()

    assert svc._engine is not None
