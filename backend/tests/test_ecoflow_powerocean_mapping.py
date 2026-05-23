"""Verifizierung des INDEX_NAME_MAPPING für EcoFlow PowerOcean (#287-Folge).

Hintergrund: Dirk hat 2026-05-23 die echten `indexName`-Werte aus seinem
PowerOcean-Account (sn HJ31ZD1AZH710329) per Diagnose-Log geliefert:

    ['From Battery', 'From Grid', 'From Solar', 'Self-sufficiency',
     'To Battery', 'To Grid', 'To Home', 'pv_to_heatpump',
     'pv_to_powerglow', 'pv_to_powerplus', 'pv_to_powerplus_pct']

Damit ist die Energiefluss-Matrix-Konvention bestätigt — analog zur
Victron-VRM-Struktur (`Pc`/`Pg`/`Pb` etc.). Dieser Test sichert das
Mapping gegen Regression: künftige Refactorings dürfen die Dirk-Namen
nicht stillschweigend wegbrechen.
"""

from __future__ import annotations

from backend.services.cloud_import.ecoflow_powerocean import (
    INDEX_NAME_MAPPING,
    EcoFlowPowerOceanProvider,
)


# --- Mapping-Konstanten gegen Dirks Live-Log ---------------------------------

def test_dirk_log_namen_sind_im_mapping():
    """Alle kWh-relevanten Namen aus Dirks Log müssen mappen."""
    # Reihenfolge nach Dirk-Log 2026-05-23, ohne die drei nicht-kWh-Felder
    # (`Self-sufficiency`, `pv_to_powerplus_pct`) und ohne die drei
    # Sub-Flüsse `pv_to_*` (vermutlich in `From Solar` enthalten).
    erwartete_paare = {
        "From Solar": "pv_erzeugung_kwh",
        "To Grid": "einspeisung_kwh",
        "From Grid": "netzbezug_kwh",
        "To Battery": "batterie_ladung_kwh",
        "From Battery": "batterie_entladung_kwh",
        "To Home": "eigenverbrauch_kwh",
    }
    for name, feld in erwartete_paare.items():
        assert INDEX_NAME_MAPPING.get(name) == feld, (
            f"Dirk-Log-Name {name!r} → erwartet {feld!r}, "
            f"ist {INDEX_NAME_MAPPING.get(name)!r}"
        )


def test_prozent_und_subfluss_felder_NICHT_im_mapping():
    """Prozent-Werte und PV-Subflüsse dürfen nicht ins kWh-Mapping rutschen.

    Wenn die je gemappt würden, würden die Subfluss-Werte (`pv_to_heatpump`
    etc.) in PV-Felder doppelt einlaufen — `From Solar` deckt den PV-Output
    bereits gesamt ab.
    """
    nicht_zu_mappen = [
        "Self-sufficiency",
        "pv_to_powerplus_pct",
        "pv_to_heatpump",
        "pv_to_powerglow",
        "pv_to_powerplus",
    ]
    for name in nicht_zu_mappen:
        assert name not in INDEX_NAME_MAPPING, (
            f"{name!r} ist im Mapping — entweder ist es ein Prozentwert "
            "(gehört nicht in kWh-Felder) oder ein Subfluss (Doppelzählungs-"
            "Risiko mit `From Solar`)."
        )


def test_legacy_namen_bleiben_als_fallback():
    """Die alten technischen Namen bleiben für ältere Firmware-Stände erhalten."""
    legacy_paare = {
        "Solar Generation": "pv_erzeugung_kwh",
        "Grid Feed-in": "einspeisung_kwh",
        "Grid Consumption": "netzbezug_kwh",
        "Battery Charge": "batterie_ladung_kwh",
        "Battery Discharge": "batterie_entladung_kwh",
        "Home Consumption": "eigenverbrauch_kwh",
    }
    for name, feld in legacy_paare.items():
        assert INDEX_NAME_MAPPING.get(name) == feld


# --- End-to-End mit Dirk-Log -----------------------------------------------

async def test_fetch_monthly_data_mit_dirk_log_baut_komplette_parsed_month_data():
    """`fetch_monthly_data` mit Dirks Original-indexNames liefert vollständige Werte."""
    provider = EcoFlowPowerOceanProvider()

    # `fetch_monthly_data` ruft `_fetch_history_block` mehrfach pro Monat
    # (6-Tage-Blöcke laut v3.31.8-Fix), summiert die Werte zum Monat. Wir
    # geben die kompletten Monatssummen einmal im ersten Block zurück und
    # lassen die restlichen Blöcke leer — testet das Mapping ohne die
    # Block-Verteilungs-Logik anzusprechen.
    block_calls = {"n": 0}

    async def fake_block(host, access_key, secret_key, serial_number, begin, end):
        block_calls["n"] += 1
        if block_calls["n"] > 1:
            return []
        return [
            ("From Solar", 350.0),
            ("To Grid", 120.0),
            ("From Grid", 80.0),
            ("To Battery", 60.0),
            ("From Battery", 55.0),
            ("To Home", 230.0),
            # Subflüsse + Prozentwerte aus Dirks Log — werden ignoriert.
            ("pv_to_heatpump", 15.0),
            ("pv_to_powerglow", 5.0),
            ("pv_to_powerplus", 25.0),
            ("pv_to_powerplus_pct", 7.0),
            ("Self-sufficiency", 74.0),
        ]

    provider._fetch_history_block = fake_block

    result = await provider.fetch_monthly_data(
        {
            "access_key": "AK", "secret_key": "SK",
            "serial_number": "HJ31ZD1AZH710329", "region": "eu",
        },
        start_year=2026, start_month=2,
        end_year=2026, end_month=2,
    )

    assert len(result) == 1
    md = result[0]
    assert md.jahr == 2026
    assert md.monat == 2
    # Energiefluss-Matrix: jeder Wert landet im richtigen Feld, kein Wert
    # geht durch die Subflüsse doppelt rein.
    assert md.pv_erzeugung_kwh == 350.0
    assert md.einspeisung_kwh == 120.0
    assert md.netzbezug_kwh == 80.0
    assert md.batterie_ladung_kwh == 60.0
    assert md.batterie_entladung_kwh == 55.0
    assert md.eigenverbrauch_kwh == 230.0
