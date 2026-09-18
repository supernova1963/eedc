"""Jeder Aufruf Richtung Community-Server nennt Produkt und Version (17.09.2026).

Anlass: Installationen im Zugriffslog des Community-Servers zählen, getrennt
nach Add-on und Standalone. Vorher trugen alle Aufrufe den Bibliotheks-Default
``python-httpx/…`` — beide Distributionen ununterscheidbar.

Drei Proben: die Kopfzeile selbst (beide Varianten), die Kopfzeile auf dem
Draht (Mock-Transport, kein Netz), und der Wächter: keine der drei
Aufruf-Dateien baut noch einen ``httpx.AsyncClient`` am Helfer vorbei — ein
Header, der an siebzehn von achtzehn Stellen steht, ist keiner.

Schwesterdateien: test_community_nachsenden.py (einer der Aufrufer),
test_community_payload_f47_f48.py (was im Submit steht).
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

import httpx
import pytest

from backend.core.config import APP_VERSION
from backend.services.community_client import (
    PRODUKT_ADDON,
    PRODUKT_STANDALONE,
    community_client,
    community_user_agent,
)

BACKEND = Path(__file__).resolve().parent.parent
AUFRUFER = [
    BACKEND / "api" / "routes" / "community.py",
    BACKEND / "api" / "routes" / "monatsabschluss" / "wizard.py",
    BACKEND / "services" / "community_nachsenden.py",
]


def test_kopfzeile_nennt_variante_und_version():
    assert community_user_agent(addon=True) == f"{PRODUKT_ADDON}/{APP_VERSION}"
    assert community_user_agent(addon=False) == f"{PRODUKT_STANDALONE}/{APP_VERSION}"
    assert community_user_agent(addon=True, version="9.9.9") == "eedc-homeassistant/9.9.9"
    # Ohne Angabe entscheidet die Umgebung — und das Ergebnis ist eine der beiden Formen.
    assert re.fullmatch(r"(eedc-homeassistant|eedc)/\d+\.\d+\.\d+", community_user_agent())


@pytest.mark.asyncio
async def test_kopfzeile_steht_auf_dem_draht():
    gesehen: list[str] = []

    def antwort(request: httpx.Request) -> httpx.Response:
        gesehen.append(request.headers["user-agent"])
        return httpx.Response(200, json={"ok": True})

    async with community_client(timeout=5.0, transport=httpx.MockTransport(antwort)) as client:
        await client.get("https://community.test/api/health")
        await client.post("https://community.test/api/submit", json={})

    assert gesehen == [community_user_agent(), community_user_agent()]
    assert not gesehen[0].startswith("python-httpx")


def test_eigene_header_werden_ergaenzt_nicht_ersetzt():
    client = community_client(timeout=1.0, headers={"X-Probe": "ja"})
    assert client.headers["x-probe"] == "ja"
    assert client.headers["user-agent"] == community_user_agent()


def _async_client_aufrufe(pfad: Path) -> int:
    """Zählt echte Aufrufe `httpx.AsyncClient(...)` im Code — Docstrings und
    Kommentare, die die Bauform nur erwähnen, zählen nicht (AST statt Regex)."""
    baum = ast.parse(pfad.read_text(encoding="utf-8"))
    return sum(
        1
        for knoten in ast.walk(baum)
        if isinstance(knoten, ast.Call)
        and isinstance(knoten.func, ast.Attribute)
        and knoten.func.attr == "AsyncClient"
        and isinstance(knoten.func.value, ast.Name)
        and knoten.func.value.id == "httpx"
    )


def test_keine_aufrufstelle_baut_am_helfer_vorbei():
    """Wächter: ein `httpx.AsyncClient(...)` darf in den drei Aufruf-Dateien nicht mehr stehen."""
    treffer = {pfad.name: _async_client_aufrufe(pfad) for pfad in AUFRUFER}
    assert all(n == 0 for n in treffer.values()), treffer
    # Positivkontrolle: der Helfer selbst ist die einzige Stelle — der Zähler
    # sieht also etwas, wenn es etwas zu sehen gibt.
    assert _async_client_aufrufe(BACKEND / "services" / "community_client.py") == 1
