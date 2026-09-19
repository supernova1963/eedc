"""Die Kalender-Treppe der Break-Even-Kurve (N-525, Radiocarbonat T89667 #342).

Bis 2026-09-18 baute der Client die Kurve aus zwei Anlagen-Summen: der ganze
Kapitaleinsatz stand ab der frühesten Anschaffung, die heutige Jahres-Einsparung
lief linear dazu. Für eine Anlage, die über Jahre gewachsen ist, zählte das Geld,
das damals noch nicht ausgegeben war, und Einsparung von Komponenten, die es
damals noch nicht gab. Der Layer verteilt beides auf die Jahre, in denen es
passiert ist — reine Funktion, kein I/O (ADR-001).
"""

from __future__ import annotations

import math

from backend.core.berechnungen.kapitalrechnung import (
    AmortisationsVerlauf,
    ErsparnisZeile,
    KapitalEreignis,
    amortisations_verlauf,
)


def _bei(v: AmortisationsVerlauf, jahr: int):
    return next(p for p in v.jahre if p.jahr == jahr)


def test_eine_anschaffung_ergibt_die_alte_naeherung():
    """Eine Zeile ohne sonstige Positionen: Break-Even = Basis + ⌈K ÷ E⌉ — genau die
    Formel, die `gesamt_amortisation_jahr` bis dahin trug. Die Treppe hat hier eine
    einzige Stufe."""
    v = amortisations_verlauf(
        kapital=[KapitalEreignis(2023, 5200.0)],
        ersparnis=[ErsparnisZeile(2023, 500.0)],
    )
    assert v.break_even_jahr == 2023 + math.ceil(5200 / 500)  # 2034
    assert _bei(v, 2023).kapitaleinsatz_kumuliert_euro == 5200.0
    assert _bei(v, 2023).einsparung_kumuliert_euro == 0.0
    assert _bei(v, 2024).einsparung_kumuliert_euro == 500.0
    assert all(p.kapitaleinsatz_kumuliert_euro == 5200.0 for p in v.jahre)


def test_zwei_anschaffungen_stufen_und_verschieben_den_break_even():
    """Radiocarbonats Fall: PV 2023, Speicher 2025. Vorher: 8.000 € ab 2023 und
    1.000 €/Jahr ab 2023 ⇒ 2031. Mit der Treppe zählt der Speicher erst ab 2025 —
    Kosten UND Einsparung — und der Schnittpunkt liegt später."""
    v = amortisations_verlauf(
        kapital=[KapitalEreignis(2023, 5000.0), KapitalEreignis(2025, 3000.0)],
        ersparnis=[ErsparnisZeile(2023, 600.0), ErsparnisZeile(2025, 400.0)],
    )
    assert _bei(v, 2023).kapitaleinsatz_kumuliert_euro == 5000.0
    assert _bei(v, 2024).kapitaleinsatz_kumuliert_euro == 5000.0
    assert _bei(v, 2025).kapitaleinsatz_kumuliert_euro == 8000.0
    # Einsparung: 600 × (Y−2023) + 400 × max(0, Y−2025)
    assert _bei(v, 2025).einsparung_kumuliert_euro == 1200.0
    assert _bei(v, 2027).einsparung_kumuliert_euro == 600 * 4 + 400 * 2
    # Alte Näherung: 2023 + ⌈8000 ÷ 1000⌉ = 2031. Treppe: 600·(Y−2023) + 400·(Y−2025) ≥ 8000
    # ⇒ 1000·Y ≥ 8000 + 1.213.800 + 810.000 = 2.031.800 ⇒ Y ≥ 2031,8 ⇒ 2032.
    assert v.break_even_jahr == 2032
    assert v.break_even_jahr > 2023 + math.ceil(8000 / 1000)


def test_sonstige_positionen_stufen_im_jahr_ihrer_buchung():
    """Eine Reparatur 2026 hebt die Treppe erst 2026, eine Förderung 2024 senkt sie
    2024 — keine der beiden steht rückwirkend am Anschaffungsjahr."""
    v = amortisations_verlauf(
        kapital=[
            KapitalEreignis(2023, 10000.0),
            KapitalEreignis(2024, -1000.0),   # Förderung
            KapitalEreignis(2026, 2500.0),    # Reparatur
        ],
        ersparnis=[ErsparnisZeile(2023, 1500.0)],
    )
    assert _bei(v, 2023).kapitaleinsatz_kumuliert_euro == 10000.0
    assert _bei(v, 2024).kapitaleinsatz_kumuliert_euro == 9000.0
    assert _bei(v, 2025).kapitaleinsatz_kumuliert_euro == 9000.0
    assert _bei(v, 2026).kapitaleinsatz_kumuliert_euro == 11500.0
    # Die Summe der Stufen ist der Kapitaleinsatz aus `kapitaleinsatz_euro`.
    assert v.jahre[-1].kapitaleinsatz_kumuliert_euro == 10000 - 1000 + 2500


def test_spaete_anschaffung_kann_eine_amortisierte_anlage_wieder_unter_die_linie_druecken():
    """Amortisiert 2028, dann 2029 eine Wärmepumpe für 15.000 € mit 1.000 €/Jahr:
    das Break-Even-Jahr ist das erste, AB DEM die Anlage dauerhaft darüber bleibt —
    nicht das erste Kreuzen."""
    v = amortisations_verlauf(
        kapital=[KapitalEreignis(2023, 5000.0), KapitalEreignis(2029, 15000.0)],
        ersparnis=[ErsparnisZeile(2023, 1000.0), ErsparnisZeile(2029, 1000.0)],
    )
    assert _bei(v, 2028).einsparung_kumuliert_euro >= _bei(v, 2028).kapitaleinsatz_kumuliert_euro
    assert _bei(v, 2029).einsparung_kumuliert_euro < _bei(v, 2029).kapitaleinsatz_kumuliert_euro
    assert v.break_even_jahr is not None and v.break_even_jahr > 2029


def test_ohne_einsparung_kein_break_even_und_voller_horizont():
    v = amortisations_verlauf(
        kapital=[KapitalEreignis(2023, 5000.0)],
        ersparnis=[ErsparnisZeile(2023, 0.0)],
        horizont_jahre=30,
    )
    assert v.break_even_jahr is None
    assert v.jahre[-1].jahr == 2053
    assert len(v.jahre) == 31


def test_vollstaendig_gefoerdert_gibt_keine_zahl():
    """Kapitaleinsatz am Ende ≤ 0: nichts zu amortisieren — wie `berechne_roi`
    keine Dauer liefert, liefert der Verlauf kein Jahr (und keine erfundene Basis)."""
    v = amortisations_verlauf(
        kapital=[KapitalEreignis(2023, 3000.0), KapitalEreignis(2023, -3000.0)],
        ersparnis=[ErsparnisZeile(2023, 500.0)],
    )
    assert v.break_even_jahr is None


def test_index_modus_ohne_kalender():
    """Anlage ohne ein einziges Anschaffungsdatum: der Aufrufer gibt Index 0 —
    die Reihe läuft dann 0..n, und der Client beschriftet Indizes statt Jahre."""
    v = amortisations_verlauf(
        kapital=[KapitalEreignis(0, 4000.0)],
        ersparnis=[ErsparnisZeile(0, 1000.0)],
    )
    assert v.jahre[0].jahr == 0
    assert v.break_even_jahr == 4


def test_anzeige_endet_nach_anderthalbfacher_dauer_mindestens_zehn_jahre():
    kurz = amortisations_verlauf(
        kapital=[KapitalEreignis(2023, 2000.0)], ersparnis=[ErsparnisZeile(2023, 1000.0)],
    )
    assert kurz.break_even_jahr == 2025
    assert kurz.jahre[-1].jahr == 2033          # max(10, ⌈1,5·2⌉) = 10 Jahre ab Basis
    lang = amortisations_verlauf(
        kapital=[KapitalEreignis(2023, 20000.0)], ersparnis=[ErsparnisZeile(2023, 1000.0)],
    )
    assert lang.break_even_jahr == 2043
    assert lang.jahre[-1].jahr == 2053          # ⌈1,5·20⌉ = 30, gekappt am Horizont


def test_leer_bleibt_leer():
    v = amortisations_verlauf(kapital=[], ersparnis=[])
    assert v.jahre == () and v.break_even_jahr is None
