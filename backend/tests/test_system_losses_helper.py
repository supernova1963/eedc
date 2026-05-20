"""SoT-Helper `resolve_system_losses` — PVGIS-Systemverluste zentral auflösen.

Hintergrund (Memory `project_pvgis_systemverluste_drift`): die Zeile
`pvgis.system_losses / 100 if pvgis and pvgis.system_losses else 0.14`
stand an sechs Read-Sites parallel, die `0.14`-Konstante war zusätzlich 5×
definiert. Drift-Risiko: ein anlagenspezifischer Setup-Wert hätte bei einer
abweichenden Kopie nur in manchen Sichten gewirkt.

`resolve_system_losses` ist jetzt die einzige Quelle — diese Tests nageln
das Verhalten fest (Prozent→Fraktion, Fallback, 0/None-Behandlung).
"""

from __future__ import annotations

from types import SimpleNamespace

from backend.services.pv_orientation import (
    DEFAULT_SYSTEM_LOSSES,
    resolve_system_losses,
)


def _pvgis(system_losses):
    """Minimal-Stub einer PVGISPrognose-Zeile."""
    return SimpleNamespace(system_losses=system_losses)


def test_default_wenn_kein_pvgis_eintrag():
    """Kein aktiver PVGIS-Eintrag → PVGIS-Standard 14 %."""
    assert resolve_system_losses(None) == DEFAULT_SYSTEM_LOSSES
    assert DEFAULT_SYSTEM_LOSSES == 0.14


def test_anlagenspezifischer_wert_prozent_zu_fraktion():
    """Setup-Wert ist in Prozent gepflegt → Helper liefert die Fraktion."""
    assert resolve_system_losses(_pvgis(18.0)) == 0.18
    assert resolve_system_losses(_pvgis(14.0)) == 0.14
    assert abs(resolve_system_losses(_pvgis(8.5)) - 0.085) < 1e-9


def test_leerer_wert_faellt_auf_default():
    """system_losses = 0 oder None (leeres Feld) → Default, nicht 0."""
    assert resolve_system_losses(_pvgis(0)) == DEFAULT_SYSTEM_LOSSES
    assert resolve_system_losses(_pvgis(None)) == DEFAULT_SYSTEM_LOSSES


def test_ergebnis_immer_fraktion_unter_eins():
    """Ergebnis passt direkt in `ertrag * (1 - system_losses)` — also < 1."""
    for prozent in (5.0, 14.0, 25.0):
        frac = resolve_system_losses(_pvgis(prozent))
        assert 0.0 < frac < 1.0
