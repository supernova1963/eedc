"""Eine gescheiterte Recorder-Adresse fällt nicht mehr STILL auf die Datei zurück.

Schwesterdatei: ``test_ha_recorder_datei_pruefung.py`` (Stufe 2 der Kaskade).

**Der Fall** (LTS-Fund B, Blockmove-Diagnose 16.09.2026): Ein Anwender trägt
unter Einstellungen eine externe Recorder-Datenbank ein. Ist sie nicht
erreichbar, fiel eedc auf die Datei ``home-assistant_v2.db`` zurück — richtig
so —, aber der Status sagte danach nur „SQLite". Wer seine Adresse für wirksam
hielt, hatte keinen Grund, sie zu prüfen; die Zahlen kamen aus einer Datei, die
nach einem Recorder-Wechsel alt sein kann.

Jetzt nennt ``backend_type`` den Rückfall samt Fehlerklasse. Die Rangfolge
selbst ist unverändert.
"""

from __future__ import annotations

import sqlite3

import pytest

from backend.services import ha_statistics_service as mod


def _recorder_datei(pfad):
    con = sqlite3.connect(pfad)
    con.execute("CREATE TABLE statistics_meta (id INTEGER PRIMARY KEY, statistic_id TEXT)")
    con.commit(); con.close()


@pytest.fixture
def _service(monkeypatch, tmp_path):
    def _bauen(url: str | None):
        pfad = tmp_path / "home-assistant_v2.db"
        _recorder_datei(pfad)
        monkeypatch.setattr(mod, "HA_DB_PATH", pfad)
        monkeypatch.setattr(mod, "HA_DB_PATH_LOCAL", tmp_path / "gibt-es-nicht.db")
        monkeypatch.setattr(mod.settings, "ha_recorder_db_url", url)
        svc = mod.HAStatisticsService()
        svc._init_engine()
        return svc
    return _bauen


def test_gescheiterte_adresse_steht_im_status(_service):
    """⭐ Der Fund: Adresse unerreichbar ⇒ Rückfall auf die Datei, und der Status sagt es."""
    svc = _service("mysql://nix:nix@127.0.0.1:1/nix")
    assert svc._engine is not None and svc._is_mysql is False, "Rückfall auf die Datei bleibt"
    typ = svc.backend_type
    assert typ.startswith("SQLite"), typ
    assert "Rückfall" in typ and "nicht erreichbar" in typ, typ


def test_ohne_adresse_kein_rueckfall_hinweis(_service):
    """Gegenprobe: ohne eingetragene Adresse ist die Datei der gewollte Weg — kein Hinweis."""
    svc = _service(None)
    assert svc.backend_type == "SQLite", svc.backend_type
