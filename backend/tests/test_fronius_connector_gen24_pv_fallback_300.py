"""Regressionstest #300: Fronius Gen24 PV-Erzeugung fehlt, weil
`GetPowerFlowRealtimeData → Site.E_Total` auf neuerer Firmware `null` liefert.

Fix: Fallback über `GetInverterRealtimeData → TOTAL_ENERGY` (Summe je
Wechselrichter), wenn E_Total leer ist. Der Endpoint war im Code angelegt
(`INVERTER_DATA_URL`), aber nicht verdrahtet.
"""

from __future__ import annotations

import pytest

from backend.services.connectors import fronius_solar_api as f


def _pf(e_total):
    """GetPowerFlowRealtimeData-Antwort mit gegebenem Site.E_Total."""
    return {
        "Head": {"Status": {"Code": 0}},
        "Body": {"Data": {"Site": {"E_Total": e_total, "P_PV": 1234.0}}},
    }


def _inv(values: dict):
    """GetInverterRealtimeData (Scope=System)-Antwort mit TOTAL_ENERGY.Values."""
    return {
        "Head": {"Status": {"Code": 0}},
        "Body": {"Data": {"TOTAL_ENERGY": {"Unit": "Wh", "Values": values}}},
    }


_EMPTY_METER = {"Head": {"Status": {"Code": 0}}, "Body": {"Data": {}}}


def _make_fetch(e_total, inverter_values):
    async def fake_fetch_json(session, base_url, path, params=None):
        if path == f.POWERFLOW_URL:
            return _pf(e_total)
        if path == f.INVERTER_DATA_URL:
            return _inv(inverter_values) if inverter_values is not None else None
        if path == f.METER_URL:
            return _EMPTY_METER
        return None
    return fake_fetch_json


async def test_fallback_greift_wenn_e_total_null(monkeypatch):
    """Gen24: E_Total=null → PV-Gesamt aus Summe TOTAL_ENERGY über Inverter."""
    monkeypatch.setattr(
        f, "_fetch_json", _make_fetch(None, {"1": 5_000_000.0, "2": 3_000_000.0})
    )
    snap = await f.FroniusSolarApiConnector()._read_snapshot(None, "http://x")
    assert snap.pv_erzeugung_kwh == 8000.0  # (5e6 + 3e6) Wh → 8000 kWh


async def test_e_total_hat_vorrang_wenn_vorhanden(monkeypatch):
    """Ältere FW: E_Total vorhanden → kein Fallback, Inverter-Wert ignoriert."""
    monkeypatch.setattr(
        f, "_fetch_json", _make_fetch(9_000_000.0, {"1": 1_000_000.0})
    )
    snap = await f.FroniusSolarApiConnector()._read_snapshot(None, "http://x")
    assert snap.pv_erzeugung_kwh == 9000.0


async def test_pv_none_wenn_beide_quellen_leer(monkeypatch):
    """Weder E_Total noch Inverter-Daten → PV bleibt None (kein 0-Artefakt)."""
    monkeypatch.setattr(f, "_fetch_json", _make_fetch(None, None))
    snap = await f.FroniusSolarApiConnector()._read_snapshot(None, "http://x")
    assert snap.pv_erzeugung_kwh is None


async def test_helper_summiert_total_energy(monkeypatch):
    monkeypatch.setattr(
        f, "_fetch_json", _make_fetch(None, {"1": 2_500_000.0, "2": 1_500_000.0})
    )
    total_wh = await f._fetch_pv_total_wh_from_inverters(None, "http://x")
    assert total_wh == pytest.approx(4_000_000.0)


async def test_helper_ignoriert_none_und_unparsebare_werte(monkeypatch):
    monkeypatch.setattr(
        f, "_fetch_json", _make_fetch(None, {"1": 1_000_000.0, "2": None, "3": "x"})
    )
    total_wh = await f._fetch_pv_total_wh_from_inverters(None, "http://x")
    assert total_wh == pytest.approx(1_000_000.0)
