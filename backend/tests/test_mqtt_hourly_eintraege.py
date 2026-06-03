"""Unit-Tests für die MQTT-/Standalone-Normalisierung (#317).

Vor #317 hängten die beiden Snapshot-Hourly-Konsumenten ihre MQTT-Einträge mit
`fallback_gruppe=None` an — ein E-Auto, das via MQTT BEIDE Gesamt-Zähler
publiziert (`ladung_kwh` UND `verbrauch_kwh`, evcc-Bridge), wurde in der
Stunden-Bilanz doppelt gezählt (gleiche #298-Klasse, MQTT-Pfad). Der geteilte
Helfer `mqtt_hourly_eintraege` routet inv-Keys jetzt durch dieselbe
Whitelist + Either-Or + parent-Skip-Normalisierung wie der HA-Pfad.
"""

from __future__ import annotations

from types import SimpleNamespace

from backend.services.snapshot.komponenten_beitraege import (
    investition_beitraege,
    mqtt_hourly_eintraege,
    resolve_either_or_eintraege,
)


def _inv(inv_id, typ, parameter=None, parent_investition_id=None):
    return SimpleNamespace(
        id=inv_id,
        typ=typ,
        parameter=parameter or {},
        parent_investition_id=parent_investition_id,
    )


def _gruppe(e):
    return e[2]  # (sensor_key, kategorie, fallback_gruppe)


# ─── ist_verfuegbar-Parametrisierung (Kern des #317-Fix) ────────────────────

def test_ist_verfuegbar_ersetzt_sensor_mapping_check():
    """investition_beitraege akzeptiert ein quellen-agnostisches Prädikat —
    ohne sensor_mapping-Dict, nur 'Feld vorhanden'."""
    inv = _inv(1, "e-auto")
    vorhanden = {"ladung_kwh", "verbrauch_kwh"}
    b = investition_beitraege(inv, {}, ist_verfuegbar=lambda f: f in vorhanden)
    assert [x.feld for x in b] == ["ladung_kwh", "verbrauch_kwh"]
    assert b[0].fallback_gruppe == b[1].fallback_gruppe is not None


# ─── mqtt_hourly_eintraege ──────────────────────────────────────────────────

def test_eauto_doppelmapping_bekommt_either_or_gruppe():
    """#317-Kern: E-Auto mit ladung_kwh UND verbrauch_kwh per MQTT → beide
    Einträge teilen eine fallback_gruppe (vorher None → keine Dedup)."""
    inv = _inv(1, "e-auto")
    sks = ["inv:1:ladung_kwh", "inv:1:verbrauch_kwh"]
    eintraege = mqtt_hourly_eintraege(sks, {"1": inv}, {})
    assert len(eintraege) == 2
    gruppen = {e[2] for e in eintraege}
    assert len(gruppen) == 1 and None not in gruppen


def test_eauto_doppelmapping_resolve_nimmt_nur_einen():
    """End-to-end: nach resolve_either_or_eintraege bleibt genau ein Eintrag —
    kein Doppelzählen mehr (mit Tagesdaten für beide)."""
    inv = _inv(1, "e-auto")
    sks = ["inv:1:ladung_kwh", "inv:1:verbrauch_kwh"]
    eintraege = mqtt_hourly_eintraege(sks, {"1": inv}, {})
    resolved = resolve_either_or_eintraege(
        eintraege, gruppe_fn=_gruppe, hat_tagesdaten_fn=lambda e: True
    )
    assert len(resolved) == 1
    assert resolved[0][0] == "inv:1:ladung_kwh"  # primär gewinnt


def test_eauto_parent_skip_auch_per_mqtt():
    """E-Auto mit parent-Wallbox wird auch im MQTT-Pfad übersprungen (vorher
    roh gezählt → Doppelzählung mit Wallbox-Ladung)."""
    inv = _inv(1, "e-auto", parent_investition_id=2)
    eintraege = mqtt_hourly_eintraege(["inv:1:ladung_kwh"], {"1": inv}, {})
    assert eintraege == []


def test_wallbox_nur_ladung_kwh_per_mqtt():
    """Whitelist greift auch per MQTT: ladung_pv_kwh fällt raus."""
    inv = _inv(2, "wallbox")
    sks = ["inv:2:ladung_kwh", "inv:2:ladung_pv_kwh"]
    eintraege = mqtt_hourly_eintraege(sks, {"2": inv}, {})
    assert [e[0] for e in eintraege] == ["inv:2:ladung_kwh"]
    assert eintraege[0][2] is None  # kein Either-Or für Wallbox


def test_basis_keys_ohne_gruppe():
    """Basis-Einspeisung/Netzbezug: korrekte Kategorie, keine Either-Or-Gruppe."""
    eintraege = mqtt_hourly_eintraege(
        ["basis:einspeisung", "basis:netzbezug"], {}, {}
    )
    by_key = {e[0]: e for e in eintraege}
    assert by_key["basis:einspeisung"][1] == "einspeisung"
    assert by_key["basis:netzbezug"][1] == "netzbezug"
    assert all(e[2] is None for e in eintraege)


def test_unbekannte_investition_uebersprungen():
    """inv-Key ohne passende Investition → kein Crash, kein Eintrag."""
    eintraege = mqtt_hourly_eintraege(["inv:999:ladung_kwh"], {}, {})
    assert eintraege == []


def test_mehrere_invs_unabhaengig():
    """Verschiedene Investitionen behalten getrennte Either-Or-Gruppen."""
    ea1 = _inv(1, "e-auto")
    ea2 = _inv(3, "e-auto")
    sks = [
        "inv:1:ladung_kwh", "inv:1:verbrauch_kwh",
        "inv:3:ladung_kwh", "inv:3:verbrauch_kwh",
    ]
    eintraege = mqtt_hourly_eintraege(sks, {"1": ea1, "3": ea2}, {})
    gruppen = {e[2] for e in eintraege}
    assert len(gruppen) == 2  # eine Gruppe pro E-Auto
