"""Regressionstest: EcoFlow-History-Blöcke bleiben strikt unter einer Woche.

Bug-Historie (Dirk-PN 2026-05-22): Beide EcoFlow-Provider zerlegten den
Importzeitraum in Blöcke von exakt 7 Tagen. Die EcoFlow-API verlangt aber
ein Fenster von STRIKT weniger als einer Woche und lehnte ein 7-Tage-Fenster
(z. B. 2026-02-22 00:00:00 → 2026-03-01 00:00:00 = 168 h) ab mit
"API-Fehler: time must be less than one week". Folge: kein einziger Block
ging durch, der Import meldete "Keine Monatsdaten gefunden".
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from backend.services.cloud_import.ecoflow_powerocean import (
    MAX_BLOCK_DAYS,
    EcoFlowPowerOceanProvider,
)
from backend.services.cloud_import.ecoflow_powerstream import (
    EcoFlowPowerStreamProvider,
)


def test_max_block_days_unter_einer_woche():
    """Die Blockgröße muss kleiner als 7 Tage sein, nicht gleich."""
    assert MAX_BLOCK_DAYS < 7


@pytest.mark.parametrize(
    "provider_cls", [EcoFlowPowerOceanProvider, EcoFlowPowerStreamProvider]
)
@pytest.mark.parametrize("year,month", [(2026, 2), (2026, 1), (2025, 12)])
async def test_history_bloecke_strikt_unter_einer_woche(provider_cls, year, month):
    """Jeder abgefragte Block ist < 1 Woche und der Monat ist lückenlos gedeckt.

    (2026, 2) ist Dirks gemeldeter Fall: der letzte Block lief früher von
    2026-02-22 bis 2026-03-01 — genau 7 Tage — und wurde abgelehnt.
    """
    provider = provider_cls()
    erfasste_bloecke: list[tuple[datetime, datetime]] = []

    async def spy_block(host, access_key, secret_key, serial_number, begin, end):
        erfasste_bloecke.append((begin, end))
        return []

    # Instanz-Attribut überschreibt die Methode — Aufruf ohne Netzwerk.
    provider._fetch_history_block = spy_block

    await provider._fetch_single_month(
        "https://example.test", "AK", "SK", "SN", year, month
    )

    assert erfasste_bloecke, "kein Block abgefragt"

    eine_woche = timedelta(days=7)
    for begin, end in erfasste_bloecke:
        assert end - begin < eine_woche, (
            f"Block {begin} – {end} ist {end - begin} lang — "
            f"die EcoFlow-API verlangt strikt < 1 Woche"
        )

    # Lückenlose, überlappungsfreie Deckung des ganzen Monats.
    monat_start = datetime(year, month, 1)
    monat_ende = (
        datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
    )
    assert erfasste_bloecke[0][0] == monat_start
    assert erfasste_bloecke[-1][1] == monat_ende
    for (_, prev_end), (next_begin, _) in zip(
        erfasste_bloecke, erfasste_bloecke[1:]
    ):
        assert prev_end == next_begin, "Lücke oder Überlappung zwischen Blöcken"
