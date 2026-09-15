"""Heizgradtage — die Formel, die das Wetter zum Nenner macht (SOLL §4.1).

**SOLL Wärme/Klima §4.1 „SOLL — Wetternormierung" (SOLL-§9-E8, 12.09.2026).**
``HDD_Tag = max(0; 15 °C − Tagesmittel)``, Heizgrenze 15 °C nach
Gradtag-Konvention, **eine** Definitionsstelle im Layer.

⭐ **Die tragende Probe ist B8 — die Konvexität.** Sie ist der gemessene Grund
für Entscheid **K-2** („nur aus Tagesmitteln"): ``max(0; 15 − T)`` ist konvex,
also unterschätzt jeder Weg über einen Mittelwert die Summe. An einem Monat mit
20 Tagen à 10 °C und 11 Tagen à 20 °C sind es **100 Kd** täglich gerechnet und
**45,0 Kd** aus dem Monatsmittel — ein Fehler von 55 %, in derselben Richtung
wie die −26,6 % der Demo-Anlage im Mai 2026.

Schwesterdateien: ``test_mitteltemperatur.py`` (der Eingabe-Builder samt K-2 an
der DB), ``test_wp_hub_wetternormierung.py`` (die Route),
``test_berechnungs_layer_konformitaet.py::test_heizgrenze_nur_im_layer`` (dass
es bei der einen Definition bleibt).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen.heizgradtage import (
    GRUND_KEINE_TEMPERATURREIHE,
    HEIZGRENZE_C,
    heizgradtage_grund,
    heizgradtage_je_monat,
    heizgradtage_tag,
    normiert,
)


# ═══ B1–B3 — der Tageswert ══════════════════════════════════════════════════

def test_b1_warmer_tag_hat_keinen_heizbedarf():
    """20 °C liegt über der Heizgrenze — 0,0 Kd, nicht −5,0 und nicht 5,0."""
    assert heizgradtage_tag(20.0) == pytest.approx(0.0)


def test_b2_kalter_tag_zaehlt_den_abstand_zur_heizgrenze():
    """5 °C ⇒ 15 − 5 = 10,0 Kd. Die Zahl hängt an HEIZGRENZE_C, nicht an 20 °C
    Innenraum-Soll (der Glossar-Satz behauptete das bis zum 12.09.2026)."""
    assert heizgradtage_tag(5.0) == pytest.approx(10.0)
    assert HEIZGRENZE_C == pytest.approx(15.0)


def test_b3_die_heizgrenze_selbst_zaehlt_nicht_mit():
    """Genau 15,0 °C ⇒ 0,0 Kd — die Grenze ist der Nullpunkt, nicht der erste
    Heizgradtag."""
    assert heizgradtage_tag(15.0) == pytest.approx(0.0)


# ═══ B4–B6 — die Normierung ═════════════════════════════════════════════════

def test_b4_menge_je_heizgradtag():
    """30 Tage à 5 °C ⇒ 300 Kd; 900 kWh darüber ⇒ 3,0 kWh/Kd (nicht 0,333)."""
    je_tag = {date(2025, 11, tag): 5.0 for tag in range(1, 31)}
    monat = heizgradtage_je_monat(je_tag)[(2025, 11)]
    assert monat.kd == pytest.approx(300.0)
    assert normiert(900.0, monat.kd) == pytest.approx(3.0)


def test_b5_kein_nenner_ist_keine_unendlichkeit():
    """Σ Kd = 0 (Sommerfenster) ⇒ **None**, nie ∞ und nie 0. Ein Balken „0" hier
    hieße „braucht keinen Strom je Kältegrad" — die Aussage gibt es nicht."""
    assert normiert(900.0, 0.0) is None
    assert normiert(900.0, -3.0) is None
    assert normiert(900.0, None) is None


def test_b6_fehlende_menge_wird_nicht_zu_null():
    """Kein Zähler ⇒ None, nicht 0,0 kWh/Kd (0-Werte-Fallstrick, CLAUDE.md)."""
    assert normiert(None, 300.0) is None


# ═══ B7 — Vollständigkeit reist mit (ADR-002/P4) ════════════════════════════

def test_b7_ein_teilmonat_sagt_dass_er_einer_ist():
    """18 von 30 Tagen ⇒ die Zahlen stehen daneben, `vollstaendig` ist False.

    Ohne dieses Paar wäre ein Monat mit zwei erfassten Tagen von einem
    vollständigen nicht zu unterscheiden — und eine Saison-Summe daraus
    behauptete eine Abdeckung, die sie nicht hat.
    """
    je_tag = {date(2025, 9, tag): 7.0 for tag in range(1, 19)}
    monat = heizgradtage_je_monat(je_tag)[(2025, 9)]
    assert monat.tage_mit_temperatur == 18
    assert monat.tage_im_monat == 30
    assert monat.vollstaendig is False
    assert monat.kd == pytest.approx(18 * 8.0)

    voll = heizgradtage_je_monat(
        {date(2025, 9, tag): 7.0 for tag in range(1, 31)}
    )[(2025, 9)]
    assert voll.vollstaendig is True


def test_b7b_monat_ohne_temperaturtag_fehlt_statt_null_zu_sein():
    """„Keine Messung" und „kein Heizbedarf" sind zwei Aussagen — im Januar
    wäre die zweite falsch."""
    je_monat = heizgradtage_je_monat({date(2025, 1, 5): 2.0})
    assert (2025, 1) in je_monat
    assert (2025, 2) not in je_monat


# ═══ B8 — die Konvexität, der gemessene Grund für K-2 ═══════════════════════

def test_b8_taeglich_gerechnet_nicht_aus_dem_monatsmittel():
    """⭐ **Der Befund, der Vorrangstufe 3 ausschließt.**

    20 Tage à 10 °C (je 5 Kd) + 11 Tage à 20 °C (je 0 Kd) = **100 Kd**.
    Derselbe Monat über sein Mittel (13,55 °C) gerechnet ergäbe
    ``max(0; 15 − 13,55) × 31 = 45,0 Kd`` — **55 % zu wenig**, weil
    ``max(0; 15 − T)`` konvex ist und die warmen Tage die kalten „wegmitteln".
    """
    je_tag: dict[date, float] = {}
    for tag in range(1, 21):
        je_tag[date(2025, 10, tag)] = 10.0
    for tag in range(21, 32):
        je_tag[date(2025, 10, tag)] = 20.0

    monat = heizgradtage_je_monat(je_tag)[(2025, 10)]
    assert monat.kd == pytest.approx(100.0), "täglich gerechnet"
    assert monat.tage_mit_temperatur == 31
    assert monat.vollstaendig is True

    mittel = sum(je_tag.values()) / len(je_tag)
    aus_dem_mittel = max(0.0, HEIZGRENZE_C - mittel) * len(je_tag)
    assert aus_dem_mittel == pytest.approx(45.0, abs=0.05), "die falsche Zahl"
    assert monat.kd > aus_dem_mittel * 2, "der Fehler ist keine Rundung"


# ═══ Der Grund, wenn nichts da ist (S3) ═════════════════════════════════════

def test_grund_nennt_die_fehlende_temperaturreihe():
    assert heizgradtage_grund({}) == GRUND_KEINE_TEMPERATURREIHE


def test_grund_nennt_den_beginn_der_messreihe():
    """⭐ Der Demo-Fall: die Wärmepumpe hat Daten seit 2023, die Temperatur erst
    seit 09/2025. Ohne den Satz liest der Anwender „eedc hat meine Daten
    verloren" — es fehlt die Außentemperatur, nicht die Wärmepumpe."""
    je_monat = heizgradtage_je_monat({date(2025, 9, 13): 7.0})
    grund = heizgradtage_grund(je_monat, erster_monat_mit_bedarf=(2023, 12))
    assert grund is not None and "09/2025" in grund


def test_kein_grund_wenn_die_reihe_weit_genug_zurueckreicht():
    je_monat = heizgradtage_je_monat({date(2023, 12, 1): 3.0})
    assert heizgradtage_grund(
        je_monat, erster_monat_mit_bedarf=(2023, 12),
    ) is None
