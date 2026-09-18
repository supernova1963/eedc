"""Der EINE HTTP-Client für alle Aufrufe Richtung Community-Server.

**Anlass (Gernot, 17.09.2026): Installationen über das Zugriffslog des
Community-Servers zählen — getrennt nach Add-on und Standalone.** Bis dahin
meldeten sich alle Aufrufe mit dem Standard-User-Agent der Bibliothek
(``python-httpx/0.28.1``, gemessen an 105 Submits im Log 30.08.–17.09.); die
beiden Distributionen laufen denselben Code und waren im Log nicht zu
unterscheiden. Das GitHub-Traffic-Fenster (14 Tage, Adress-Tage statt
Installationen) und die HA-Analytics (nur Opt-in, kein Standalone) taugen
dafür nicht.

**Was mitgeht — und was nicht.** Der User-Agent nennt **Produktvariante und
Version**: ``eedc-homeassistant/4.0.47`` oder ``eedc/4.0.47``. Nichts, was eine
Installation wiedererkennbar macht — keine Kennung, kein Hash (der geht nur in
den Anfragen mit, in denen er ohnehin steht), kein Hostname. Es ist die
Angabe, die jeder Browser bei jedem Aufruf macht, und sie geht nur in
Anfragen mit, die es vorher schon gab: **kein neuer Kontakt nach außen**,
keine neue Einwilligungsstufe (eedc greift nicht aktiv nach außen).

**Woran eedc die Variante erkennt:** am ``SUPERVISOR_TOKEN``, das der
Home-Assistant-Supervisor jedem Add-on mit ``hassio_api``/``homeassistant_api``
in die Umgebung legt (``core/config.py::HA_INTEGRATION_AVAILABLE`` — dieselbe
Stelle, an der eedc die HA-Anbindung erkennt). Standalone kennt es nicht.

**Warum ein Helfer und nicht achtzehn Header:** Die Aufrufe standen an
**achtzehn** Stellen in drei Dateien (sechzehn in ``api/routes/community.py``,
je eine in ``monatsabschluss/wizard.py`` und ``services/community_nachsenden.py``),
jede mit eigenem ``httpx.AsyncClient(timeout=…)``. Ein Header, der an siebzehn
Stellen gesetzt ist, fehlt an der achtzehnten — ``test_community_user_agent.py``
hält fest, dass keine Stelle mehr am Helfer vorbei baut.

Gezählt wird auf dem Server im Zugriffslog des Proxys
(``scripts/community-zugriffe.py``); der Community-Server selbst braucht dafür
nichts und wertet den Header nicht aus.
"""

from __future__ import annotations

from typing import Any

import httpx

from backend.core.config import APP_VERSION, HA_INTEGRATION_AVAILABLE

#: Produktnamen im User-Agent — identisch mit den Repository-Namen.
PRODUKT_ADDON = "eedc-homeassistant"
PRODUKT_STANDALONE = "eedc"


def community_user_agent(*, addon: bool | None = None, version: str = APP_VERSION) -> str:
    """``eedc-homeassistant/<Version>`` im Add-on, ``eedc/<Version>`` standalone.

    ``addon`` ist nur für Proben da; produktiv entscheidet ``HA_INTEGRATION_AVAILABLE``.
    """
    ist_addon = HA_INTEGRATION_AVAILABLE if addon is None else addon
    return f"{PRODUKT_ADDON if ist_addon else PRODUKT_STANDALONE}/{version}"


def community_client(timeout: float, **kwargs: Any) -> httpx.AsyncClient:
    """Ein ``httpx.AsyncClient`` mit dem eedc-User-Agent — sonst wie bisher.

    ``kwargs`` reicht z. B. ein ``transport`` für Proben durch; die Kopfzeile
    bleibt dabei immer gesetzt (ein mitgegebener ``headers``-Eintrag wird
    ergänzt, nicht ersetzt).
    """
    headers = dict(kwargs.pop("headers", None) or {})
    headers["User-Agent"] = community_user_agent()
    return httpx.AsyncClient(timeout=timeout, headers=headers, **kwargs)
