"""Die Tagesreset-Regel steht genau EINMAL — als reine Funktion (10.09.2026).

**Warum es diese Datei gibt.** Bis zum 10.09.2026 stand die Regel *zweimal* im
Baum, und beide Stellen behaupteten im eigenen Docstring, der eine Ort zu sein:

* ``reader.delta`` — „Der eine Ort für die Fenster-Regel"
* ``snapshot/aggregator._tageswert_aus_raendern`` — „Der eine Ort für die
  Tagesfenster-Regel"

Sie waren inhaltlich gleich und **formal schon auseinander**: hier die Konstante
``TAGESRESET_TOLERANZ_KWH``, dort das Literal ``-0.01``. Genau die F-56-Form,
vor der beide Docstrings warnen — und an diesem Feld ist die Regel schon einmal
gedriftet (**N-341**: Weg 2 fehlte im Monatspfad zwei Tage länger als im
Tagespfad, gemessen 5,6 statt 140,0 kWh).

Den dritten Aufrufer bringt der Wärme/Klima-Verlauf (Konzept §8, Bauschnitt 4):
Ein Bereichs-Leser über einen ganzen Monat kann nicht je Tag drei Abfragen
stellen — er lädt **eine** Standreihe und wendet die Regel lokal an.

⚠ **Diese Datei prüft die Regel selbst.** Dass die drei Aufrufer sie auch
wirklich benutzen, halten ihre eigenen Proben fest
(``test_n341_reset_zaehler_wird_abgelehnt.py``,
``test_soll_waerme_klima_achse3_aufloesung.py::test_iii1*``) — und der
Quelltext-Wächter unten, damit eine vierte Fassung nicht unbemerkt entsteht.
"""

from pathlib import Path

from backend.services.snapshot.reader import (
    TAGESRESET_TOLERANZ_KWH,
    tageswert_aus_reihe,
)


class TestWeg1RanddifferenzNegativ:
    """Der Rücksprung liegt zwischen den Rändern und ist an ihnen ablesbar."""

    def test_faellt_der_stand_ueber_das_fenster_gibt_es_keine_aussage(self):
        assert tageswert_aus_reihe(140.0, 5.6, []) is None

    def test_gleichstand_ist_kein_ruecksprung(self):
        """Ein Zähler, der still steht, steht still — 0 kWh ist hier eine
        Messung, keine Behauptung."""
        assert tageswert_aus_reihe(42.0, 42.0, []) == 0.0

    def test_messrauschen_unterhalb_der_toleranz_bleibt_eine_menge(self):
        """Die Toleranz deckt Rauschen ab: knapp darunter ⇒ 0, nicht ``None``."""
        knapp = TAGESRESET_TOLERANZ_KWH / 2
        assert tageswert_aus_reihe(42.0, 42.0 - knapp, []) == 0.0

    def test_knapp_ueber_der_toleranz_ist_ein_ruecksprung(self):
        zuviel = TAGESRESET_TOLERANZ_KWH * 2
        assert tageswert_aus_reihe(42.0, 42.0 - zuviel, []) is None


class TestWeg2MonotonieDerFolge:
    """Der teure Fall: beide Ränder **vor** dem Reset abgetastet."""

    def test_positive_randdifferenz_mit_sturz_dazwischen_gibt_keine_aussage(self):
        """``d`` ist positiv, plausibel — und still falsch.

        Der Zähler lief auf 4,5, wurde auf 0 gesetzt und stand am Fensterende
        wieder bei 4,8. Weg 1 sieht davon nichts: 4,8 − 4,5 = 0,3.
        """
        assert tageswert_aus_reihe(4.5, 4.8, [4.5, 0.0, 2.1, 4.8]) is None

    def test_monotone_reihe_liefert_die_randdifferenz(self):
        assert tageswert_aus_reihe(10.0, 14.5, [11.0, 12.5, 13.0]) == 4.5

    def test_ohne_zwischenstaende_gilt_nur_weg_1(self):
        """Dieselbe Grenze, die ``zaehler_faellt_im_fenster`` mit ihrem frühen
        ``False`` zieht: ohne Reihe ist ein Tagesreset-Zähler von einem
        ruhenden Gerät nicht zu unterscheiden. Das ist die ehrliche Auskunft,
        keine Nachlässigkeit."""
        assert tageswert_aus_reihe(0.0, 0.0, []) == 0.0

    def test_ein_einziger_fallender_schritt_genuegt(self):
        """Keine Extremwert-Prüfung: Start ist das Minimum, Ende das Maximum,
        und trotzdem ist die Reihe gebrochen. Genau daran war die Fassung vor
        dem 28.08.2026 blind."""
        assert tageswert_aus_reihe(0.021, 10.019, [5.0, 0.5, 8.0]) is None


class TestKeineHochrechnung:
    """⛔ Entscheid Gernot, 28.08.2026 — nicht neu aufrollen."""

    def test_ein_erkannter_ruecksprung_endet_in_none_nicht_in_einer_summe(self):
        """Die Reihe ließe sich summieren (4,5 + 4,8 = 9,3). Das war gebaut und
        ist bewusst wieder entfernt worden: eine hochgerechnete Menge sieht aus
        wie eine Messung."""
        assert tageswert_aus_reihe(4.5, 4.8, [4.5, 0.0, 2.1, 4.8]) is None

    def test_negative_menge_gibt_es_nicht(self):
        """Innerhalb der Toleranz wird auf 0 geklemmt, nie ins Negative."""
        wert = tageswert_aus_reihe(42.0, 42.0 - TAGESRESET_TOLERANZ_KWH / 2, [])
        assert wert is not None and wert >= 0.0


class TestDieRegelStehtNurHier:
    """Ein Wächter gegen die vierte Fassung — Quelltext, kein Verhalten."""

    def test_die_reset_schwelle_steht_nirgends_als_literal(self):
        """Die **Schwelle** hat einen Namen — wer sie hinschreibt, koppelt ab.

        ⭐ **Dieser Wächter hat beim ersten Lauf drei Stellen gefunden, die ich
        nicht auf der Liste hatte** (``snapshot/aggregator`` Stunden-Variante,
        ``snapshot/reaggregator`` zweimal). Sie tragen die Schwelle seither als
        Konstante.

        ⛔ **Und er sagt bewusst NICHT, dass dort die Regel gedoppelt wäre.** Die
        Stunden-Variante beantwortet eine **andere Frage** und darf sie anders
        beantworten: Für den Slot über Mitternacht ist ``s1`` (die Energie seit
        dem Reset) die richtige Zahl, während über den **ganzen Tag** dieselbe
        Rechnung nichts retten kann. *Gleiche Formel, verschiedene Fenster,
        verschiedene Wahrheit* — die Begründung steht im Docstring von
        ``_tageswert_aus_raendern`` und ist eine belegte Entscheidung, kein
        Rückstand. Geteilt wird deshalb nur die Zahl, nicht der Umgang mit ihr.

        ⛔ **Er liest den SYNTAXBAUM, nicht den Rohtext — und das ist selbst ein
        Befund aus dem Bau.** Die erste Fassung suchte die Zeichenkette und
        meldete daraufhin die **Erklärkommentare**, die den alten Zustand
        beschreiben: genau der Fall, den ``check:buttons`` am 09.09.2026
        vorgeführt hat (*„ein Kommentar, der vor dem Verstoß warnt, zählte sich
        als einer"*). Über ``ast`` ist ein Kommentar kein Knoten, und eine
        Regel, die man nicht mehr erklären darf, ohne sie zu verletzen, ist
        keine.
        """
        import ast

        wurzel = Path(__file__).resolve().parents[1]
        schwelle = 0.01
        treffer: list[str] = []
        for datei in wurzel.rglob("*.py"):
            if "venv" in datei.parts or "tests" in datei.parts:
                continue
            baum = ast.parse(datei.read_text(encoding="utf-8"))
            for knoten in ast.walk(baum):
                # `-0.01` erscheint im Baum als USub über einer Konstanten.
                if (
                    isinstance(knoten, ast.UnaryOp)
                    and isinstance(knoten.op, ast.USub)
                    and isinstance(knoten.operand, ast.Constant)
                    and knoten.operand.value == schwelle
                ):
                    treffer.append(
                        f"{datei.relative_to(wurzel)}:{knoten.lineno}"
                    )
        assert treffer == [], (
            "Die Reset-Schwelle steht wieder als Literal im Produktivcode — "
            f"{treffer}. Sie heißt `TAGESRESET_TOLERANZ_KWH`; die Regel selbst "
            "steht in `reader.tageswert_aus_reihe`."
        )
