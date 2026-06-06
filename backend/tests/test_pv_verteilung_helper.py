"""Unit-Tests für den kWp-Verteilungs-Read-time-Helper (core/berechnungen).

Deckt die Präzedenz (gemessen → verteilt → fehlt), die Σ-Symmetrie-Invariante
(Σ Pro-Modul == Gesamterzeugung) und die Daten-Checker-Monatsklassifikation ab.
[[project_kwp_verteilung_aggregator]], [[feedback_aggregator_symmetrie]].
"""

from __future__ import annotations

import pytest

from backend.core.berechnungen import (
    PvModul,
    PV_QUELLE_GEMESSEN,
    PV_QUELLE_VERTEILT,
    PV_QUELLE_FEHLT,
    PV_STATUS_OK,
    PV_STATUS_VERTEILT,
    PV_STATUS_TEIL_LUECKE,
    PV_STATUS_FEHLT,
    gesamt_pv_kwh,
    klassifiziere_pv_monat,
    resolve_pv_je_modul,
    verteile_basis_kwh_nach_kwp,
)


# ── verteile_basis_kwh_nach_kwp ──────────────────────────────────────────────

def test_verteilung_nach_kwp_anteilig():
    out = verteile_basis_kwh_nach_kwp(1000.0, [(1, 6.0), (2, 4.0)])
    assert out[1] == pytest.approx(600.0)
    assert out[2] == pytest.approx(400.0)


def test_verteilung_summe_exakt_erhalten():
    # Krumme Verhältnisse: Σ muss exakt == basis_kwh bleiben (keine Rundung).
    out = verteile_basis_kwh_nach_kwp(1000.0, [(1, 3.33), (2, 4.17), (3, 2.5)])
    assert sum(out.values()) == pytest.approx(1000.0)


def test_verteilung_ohne_kwp_gleichmaessig():
    out = verteile_basis_kwh_nach_kwp(900.0, [(1, 0.0), (2, 0.0), (3, 0.0)])
    assert out[1] == pytest.approx(300.0)
    assert out[2] == pytest.approx(300.0)
    assert out[3] == pytest.approx(300.0)


def test_verteilung_leere_liste():
    assert verteile_basis_kwh_nach_kwp(500.0, []) == {}


# ── resolve_pv_je_modul: Präzedenz ───────────────────────────────────────────

def test_resolve_gemessen_wenn_alle_module_werte_haben():
    module = [PvModul(1, 6.0, 700.0), PvModul(2, 4.0, 300.0)]
    out = resolve_pv_je_modul(aggregat_kwh=999.0, module=module)
    # Alle gemessen → User glauben, Aggregat ignorieren.
    assert out[1].quelle == PV_QUELLE_GEMESSEN
    assert out[1].pv_erzeugung_kwh == pytest.approx(700.0)
    assert out[2].pv_erzeugung_kwh == pytest.approx(300.0)
    assert sum(w.pv_erzeugung_kwh for w in out.values()) == pytest.approx(1000.0)


def test_resolve_verteilt_wenn_modulwerte_fehlen_aber_aggregat_da():
    module = [PvModul(1, 6.0, None), PvModul(2, 4.0, None)]
    out = resolve_pv_je_modul(aggregat_kwh=1000.0, module=module)
    assert all(w.quelle == PV_QUELLE_VERTEILT for w in out.values())
    assert out[1].pv_erzeugung_kwh == pytest.approx(600.0)
    assert out[2].pv_erzeugung_kwh == pytest.approx(400.0)
    # Σ-Symmetrie == Aggregat
    assert sum(w.pv_erzeugung_kwh for w in out.values()) == pytest.approx(1000.0)


def test_resolve_teilgemessen_faellt_auf_aggregat_verteilung():
    # Ein Modul gemessen, eines nicht → NICHT „gemessen" → Aggregat verteilen.
    module = [PvModul(1, 6.0, 700.0), PvModul(2, 4.0, None)]
    out = resolve_pv_je_modul(aggregat_kwh=1000.0, module=module)
    assert all(w.quelle == PV_QUELLE_VERTEILT for w in out.values())
    assert sum(w.pv_erzeugung_kwh for w in out.values()) == pytest.approx(1000.0)


def test_resolve_fehlt_ohne_aggregat_und_ohne_werte():
    module = [PvModul(1, 6.0, None), PvModul(2, 4.0, None)]
    out = resolve_pv_je_modul(aggregat_kwh=None, module=module)
    assert all(w.quelle == PV_QUELLE_FEHLT for w in out.values())
    assert sum(w.pv_erzeugung_kwh for w in out.values()) == pytest.approx(0.0)


def test_resolve_aggregat_null_ist_verteilt_nicht_fehlt():
    # 0 ist Daten (is not None, CLAUDE.md „0-Werte prüfen") — dunkler Wintermonat.
    module = [PvModul(1, 6.0, None), PvModul(2, 4.0, None)]
    out = resolve_pv_je_modul(aggregat_kwh=0.0, module=module)
    assert all(w.quelle == PV_QUELLE_VERTEILT for w in out.values())
    assert sum(w.pv_erzeugung_kwh for w in out.values()) == pytest.approx(0.0)


def test_gesamt_pv_kwh_deckungsgleich_mit_resolve():
    module = [PvModul(1, 6.0, None), PvModul(2, 4.0, None)]
    assert gesamt_pv_kwh(aggregat_kwh=1234.5, module=module) == pytest.approx(1234.5)


# ── klassifiziere_pv_monat ───────────────────────────────────────────────────

def test_klassifikation_alle_gemessen_ok():
    assert klassifiziere_pv_monat(n_aktive_module=2, n_gemessen=2, aggregat_kwh=None) == PV_STATUS_OK


def test_klassifikation_aggregat_deckt_ab_info():
    assert klassifiziere_pv_monat(n_aktive_module=2, n_gemessen=0, aggregat_kwh=900.0) == PV_STATUS_VERTEILT
    # auch wenn ein Modul gemessen ist und Aggregat existiert
    assert klassifiziere_pv_monat(n_aktive_module=2, n_gemessen=1, aggregat_kwh=900.0) == PV_STATUS_VERTEILT


def test_klassifikation_teil_luecke_warning():
    assert klassifiziere_pv_monat(n_aktive_module=2, n_gemessen=1, aggregat_kwh=None) == PV_STATUS_TEIL_LUECKE


def test_klassifikation_total_absenz_error():
    assert klassifiziere_pv_monat(n_aktive_module=2, n_gemessen=0, aggregat_kwh=None) == PV_STATUS_FEHLT


def test_klassifikation_keine_module_fehlt():
    assert klassifiziere_pv_monat(n_aktive_module=0, n_gemessen=0, aggregat_kwh=500.0) == PV_STATUS_FEHLT
