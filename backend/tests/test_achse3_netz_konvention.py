"""Unit-Tests für die Achse-3-Konsument-Robustheit (#316) in den
Energieprofil-Shared-Helfern.

`TagesZusammenfassung.komponenten_kwh` trägt zwei Netz-Konventionen:
- Alt: kombinierter `netz`-Key (Live-Σ).
- Neu (seit Phase B / v3.34.2): Split `netzbezug` / `einspeisung` (Boundary).

Vor dem Fix kannte `_VIRTUAL_SERIEN` nur `netz`; die Split-Keys fielen über
`_key_to_serie_info → None` still aus Geräteliste/Diagnose-Serien, und
`detail_kategorie` hätte sie über die Fallthrough-Logik fälschlich als
`sonstige_verbraucher` klassifiziert.
"""

from __future__ import annotations

from types import SimpleNamespace

from backend.api.routes.energie_profil._shared import (
    _key_to_serie_info,
    detail_kategorie,
)


def test_key_to_serie_info_loest_netz_split_auf():
    """netz / netzbezug / einspeisung lösen alle zu virtuellen Netz-Serien auf."""
    for key, label in (
        ("netz", "Stromnetz"),
        ("netzbezug", "Netzbezug"),
        ("einspeisung", "Einspeisung"),
    ):
        info = _key_to_serie_info(key, {})
        assert info is not None, f"{key} → None (still durchgefallen)"
        assert info["kategorie"] == "netz"
        assert info["label"] == label
        assert info["typ"] == "virtual"


def test_detail_kategorie_netz_beide_konventionen():
    """Beide Netz-Konventionen fallen auf dieselbe Detail-Kategorie `netz` —
    nicht fälschlich `sonstige_verbraucher`."""
    for key in ("netz", "netzbezug", "einspeisung"):
        info = _key_to_serie_info(key, {})
        assert detail_kategorie(info, None) == "netz", key


def test_detail_kategorie_haushalt_und_pv():
    """Extraktions-Regression: virtuelle Nicht-Netz-Serien bleiben korrekt."""
    assert detail_kategorie(_key_to_serie_info("haushalt", {}), None) == "haushalt"
    assert detail_kategorie(_key_to_serie_info("pv_gesamt", {}), None) == "pv_module"


def test_detail_kategorie_investitionstypen():
    """Extraktions-Regression über die Investitions-Typ-Zweige."""
    faelle = [
        ({"kategorie": "pv", "typ": "pv-module"}, None, "pv_module"),
        ({"kategorie": "pv", "typ": "balkonkraftwerk"}, None, "bkw"),
        ({"kategorie": "batterie", "typ": "speicher"}, None, "speicher"),
        ({"kategorie": "waermepumpe", "typ": "waermepumpe"}, None, "waermepumpe"),
        ({"kategorie": "wallbox", "typ": "wallbox"}, None, "wallbox_eauto"),
        ({"kategorie": "eauto", "typ": "e-auto"}, None, "wallbox_eauto"),
    ]
    for info, inv, erwartet in faelle:
        assert detail_kategorie(info, inv) == erwartet, info


def test_detail_kategorie_sonstiges_unterkategorien():
    """sonstiges-Investition: Unterkategorie steuert Erzeuger/Speicher/Verbraucher."""
    info = {"kategorie": "sonstige", "typ": "sonstiges"}
    erzeuger = SimpleNamespace(parameter={"kategorie": "erzeuger"})
    speicher = SimpleNamespace(parameter={"kategorie": "speicher"})
    verbraucher = SimpleNamespace(parameter={"kategorie": "verbraucher"})
    assert detail_kategorie(info, erzeuger) == "sonstige_erzeuger"
    assert detail_kategorie(info, speicher) == "speicher"
    assert detail_kategorie(info, verbraucher) == "sonstige_verbraucher"
