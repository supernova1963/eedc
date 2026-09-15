"""Bauschnitt 7 — die Datenquellen-Fläche sagt, dass „Leistung gesamt" die
Aufteilung verdrängt (Konzept Wärme/Klima §4 Tag ③, §5 Position 1).

**Die Lage:** An einer Wärmepumpe entstehen die getrennten Verlaufs-Reihen
(Heizen/Warmwasser) nur, solange **keine** Gesamtleistung zugeordnet ist —
`live_sensor_config.baue_investitions_serien` und drei weitere Stellen prüfen
`live.get("leistung_w")`. Wer beides zuordnet, sieht die Aufteilung nie und
erfährt nirgends warum. dietmar1968 ist genau dieser Fall (Konzept §6).

⭐ **Das Kriterium ist die HA-`live`-Map — zwei andere sind an der Messung
gescheitert** (Gegenprüfung, zwei Runden):

* ``_liefert`` (Wert muss ankommen) ist **zu eng**: Eine zugeordnete, aber tote
  Entity verdrängt weiter, der Anwender bekäme keinen Hinweis.
* ``belegt`` (Quelle ≠ keine) ist **zu weit**: Die B8-Materialisierung stempelt
  `mqtt_inbound_standard` auf jedes Feld ohne HA-Sensor — jede migrierte Anlage
  bekäme einen Hinweis, ohne dass jemand etwas zugeordnet hätte.

Schwesterdatei: `test_datenquellen_validierung.py` (die vier älteren Prüfungen).
"""

from __future__ import annotations

from backend.services.datenquellen_validierung import finde_gesamtleistung_verdraengt

GESAMT = "leistung_w"
HEIZEN = "leistung_heizen_w"
WARMWASSER = "leistung_warmwasser_w"


def _feld(inv_id: str, feld: str, in_ha_live: bool = True, typ: str = "waermepumpe"):
    return {
        "id": f"inv_live_{inv_id}_{feld}", "feld": feld, "typ": typ,
        "inv_id": inv_id, "in_ha_live": in_ha_live,
    }


def test_hinweis_haengt_am_verdraengten_feld_nicht_am_aggregat():
    """Der Anwender fragt an der Zeile, die nichts zeigt — dort steht die Antwort."""
    out = finde_gesamtleistung_verdraengt([_feld("7", GESAMT), _feld("7", HEIZEN)])

    assert list(out) == ["inv_live_7_leistung_heizen_w"]
    p = out["inv_live_7_leistung_heizen_w"]
    assert p["wirksame_felder"] == ["inv_live_7_leistung_w"]
    assert p["schwere"] == "info"
    # ⛔ Nicht `redundant`: dessen Inline-Knopf leert das Feld der Zeile — er
    # würde die Aufteilung löschen statt der Gesamtleistung.
    assert p["art"] == "gesamtleistung_verdraengt"


def test_beide_feinen_felder_bekommen_ihre_zeile():
    out = finde_gesamtleistung_verdraengt(
        [_feld("7", GESAMT), _feld("7", HEIZEN), _feld("7", WARMWASSER)],
    )
    assert set(out) == {"inv_live_7_leistung_heizen_w", "inv_live_7_leistung_warmwasser_w"}


def test_zwei_waermepumpen_nur_das_betroffene_geraet_meldet():
    """Gerät 7 hat beides, Gerät 8 nur die Aufteilung — bei ihm wird nichts verdrängt."""
    out = finde_gesamtleistung_verdraengt(
        [_feld("7", GESAMT), _feld("7", HEIZEN), _feld("8", HEIZEN)],
    )
    assert list(out) == ["inv_live_7_leistung_heizen_w"]


def test_gestempeltes_gesamtfeld_ohne_ha_zuordnung_meldet_nichts():
    """⭐ Der Fall, an dem das Kriterium `belegt` gescheitert wäre.

    Die B8-Materialisierung stempelt `mqtt_inbound_standard` auf **jedes** Feld
    ohne HA-Sensor. Ein solcher Stempel erreicht die HA-`live`-Map nie
    (`datenquellen_mapping_sync._setze_live` schreibt nur bei HA) und verdrängt
    deshalb nichts — gemessen an einer frischen Anlage: 36 von 36 Feldern
    gestempelt, inklusive dieser beiden.
    """
    out = finde_gesamtleistung_verdraengt(
        [_feld("7", GESAMT, in_ha_live=False), _feld("7", HEIZEN)],
    )
    assert out == {}


def test_tote_ha_entity_verdraengt_und_meldet_trotzdem():
    """Die Gegenrichtung: Das Kriterium ist der EINTRAG in der HA-Map, nicht ein
    ankommender Wert. Eine zugeordnete, aber tote Entity lässt die Aufteilung
    ausfallen — dann ist der Hinweis erst recht fällig."""
    out = finde_gesamtleistung_verdraengt([_feld("7", GESAMT), _feld("7", HEIZEN)])
    assert "inv_live_7_leistung_heizen_w" in out


def test_innengeraet_leistung_verdraengt_nicht():
    """`leistung_w-3` ist die Aufschlüsselung eines Innengeräts, nicht das
    Gerätefeld — nur dieses verdrängt (`live.get("leistung_w")`). Wer hier
    `basis_feld_key` benutzt, meldet an jeder Multisplit-Anlage falsch."""
    out = finde_gesamtleistung_verdraengt(
        [_feld("7", "leistung_w-3"), _feld("7", HEIZEN)],
    )
    assert out == {}


def test_ohne_gesamtleistung_keine_meldung():
    """Der Rückweg: Zuordnung entfernt ⇒ der Hinweis verschwindet."""
    assert finde_gesamtleistung_verdraengt([_feld("7", HEIZEN)]) == {}


def test_andere_typen_bleiben_unberuehrt():
    out = finde_gesamtleistung_verdraengt(
        [_feld("7", GESAMT, typ="wechselrichter"), _feld("7", HEIZEN, typ="wechselrichter")],
    )
    assert out == {}


def test_der_text_nennt_die_ursache_und_raet_nichts():
    """⛔ Zwei Formulierungen sind an der Messung gescheitert und dürfen nicht
    zurückkommen: „wirkungslos" (falsch — Symbol und MQTT-Snapshots lesen die
    Felder weiter) und der Rat, die Zuordnung zu entfernen (er kostet auf einer
    frischen HA-Anlage den Wärmepumpen-Anteil der Verbrauchsprognose)."""
    text = finde_gesamtleistung_verdraengt(
        [_feld("7", GESAMT), _feld("7", HEIZEN)],
    )["inv_live_7_leistung_heizen_w"]["text"]

    assert "Leistung gesamt" in text and "im Verlauf nicht aus" in text
    for verboten in ("irkungslos", "auf keine", "entferne", "Entferne"):
        assert verboten not in text, f"Der Text darf {verboten!r} nicht enthalten"
