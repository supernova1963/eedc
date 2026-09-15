"""K2 — der gemessene Zweig verdrängt den abgeleiteten, je Gerät (10.09.2026).

⛔ **Warum es diese Datei gibt: ein Sprengsatz, der still geblieben ist.** Beim
Bau des Monats-Verlaufs (Konzept Wärme/Klima §8, Bauschnitt 4) wurde die
Zusammenführung beider Tages-Zweige aus ``get_tag_detail`` in den Layer gezogen
(``core/berechnungen/tages_stapel.py``). Zur Probe wurde die Verdrängung
abgeschaltet — **der ganze Testbaum blieb grün** (4635 Proben, gemessen).

Damit war belegt: Die Invariante **K2** (SOLL §6.1/F4 — *„Ein einziger
zugeordneter Zähler schaltet das Gerät ganz auf den gemessenen Weg und
**verdrängt** die abgeleitete Aufteilung"*) war an **keiner** Stelle
festgehalten, obwohl der Code sie seit #263 erfüllt und ``ModusStromZeile``
im Docstring wörtlich sagt, was ohne sie passiert: *„sonst stünde dieselbe
Menge zweimal in derselben Zeile."*

⚠ **Der grüne Lauf war der Befund, nicht der Beweis** — dieselbe Lehre wie am
10.09. bei der Jahres-Faltung (N-427).

**Warum die Probe auf der reinen Funktion sitzt und nicht auf der Route:** Die
Regel hat seit Bauschnitt 4 **zwei** Aufrufer — die Tages-Route und den
Bereichs-Leser des Monats-Verlaufs. Eine Probe an einer der beiden Sichten
ließe die andere ungeprüft.

Schwesterdateien: ``test_263_t3_gemessene_betriebsart_tag.py`` (derselbe Vorrang
am Tages-Einstieg), ``test_waerme_verlauf_bereichs_leser.py`` (der zweite
Aufrufer), ``test_tages_wirkungsgrad_und_finanz_rundung.py`` (dieselbe Sicht).
"""

from datetime import date

import pytest

from backend.core.berechnungen.modus_split import ModusSplit
from backend.core.berechnungen.tages_stapel import falte_tages_stapel
from backend.core.betriebsmodus import HEIZEN, KUEHLEN

DATUM = date(2026, 8, 15)


class _Investition:
    """Minimal-Attrappe — die Faltung fragt nur die Zeitfilterung."""

    def __init__(self, aktiv: bool = True):
        self._aktiv = aktiv

    def ist_aktiv_an(self, _datum) -> bool:
        return self._aktiv


@pytest.fixture
def geraet():
    return {"7": _Investition()}


def _gemessen(heizen: float, kuehlen: float) -> dict[str, dict[str, float]]:
    return {
        "7": {
            "betriebsart_strom_heizen_kwh": heizen,
            "betriebsart_strom_kuehlen_kwh": kuehlen,
        }
    }


def _abgeleitet(heizen: float, kuehlen: float, bezug: float) -> dict[str, ModusSplit]:
    return {
        "7": ModusSplit(
            kwh_je_modus={HEIZEN: heizen, KUEHLEN: kuehlen},
            abdeckung_h=24.0,
            bezug_kwh=bezug,
        )
    }


class TestK2VerdraengungJeGeraet:
    def test_ein_geraet_mit_beiden_zweigen_zaehlt_nur_einmal(self, geraet):
        """**Der Fall, den kein Test kannte.**

        Dasselbe Gerät liefert Betriebsart-Zähler **und** eine Modus-Spur — was
        eintritt, sobald jemand zu seinen Riemann-Zählern auch einen
        Betriebsmodus-Sensor zuordnet. Ohne K2 stünden 8 + 8 = 16 kWh Heizen
        unter einer Bezugsmenge von 10 kWh: eine Teilmenge, die größer ist als
        ihr Ganzes.
        """
        stapel = falte_tages_stapel(
            _gemessen(heizen=8.0, kuehlen=1.0),
            {"7": 10.0},
            _abgeleitet(heizen=8.0, kuehlen=1.0, bezug=10.0),
            geraet,
            DATUM,
        )

        assert stapel.heizen_kwh == 8.0
        assert stapel.kuehlen_kwh == 1.0
        assert stapel.bezug_kwh == 10.0, "die Bezugsmenge zählt einmal, nicht doppelt"
        assert stapel.hat_gemessen is True

    def test_die_teilmenge_bleibt_kleiner_als_ihr_ganzes(self, geraet):
        """Die Invariante ausgesprochen — sie ist der Grund für K2."""
        stapel = falte_tages_stapel(
            _gemessen(heizen=8.0, kuehlen=1.0),
            {"7": 10.0},
            _abgeleitet(heizen=8.0, kuehlen=1.0, bezug=10.0),
            geraet,
            DATUM,
        )
        summe = (
            stapel.heizen_kwh + stapel.kuehlen_kwh + stapel.warmwasser_kwh
            + stapel.lueften_kwh + stapel.entfeuchten_kwh
            + stapel.nicht_aufgeteilt_kwh
        )
        assert summe == pytest.approx(stapel.bezug_kwh)

    def test_verdraengt_wird_JE_GERAET_nicht_je_anlage(self):
        """⭐ **Die Trennlinie, an der die Regel hängt.**

        Eine Klimaanlage mit Betriebsart-Zählern und eine Wärmepumpe ohne
        dürfen nebeneinander stehen — das zweite Gerät behält seinen
        abgeleiteten Split. Eine Verdrängung „je Anlage" hätte es stumm
        gemacht.
        """
        stapel = falte_tages_stapel(
            _gemessen(heizen=8.0, kuehlen=1.0),
            {"7": 10.0},
            {
                "7": _abgeleitet(8.0, 1.0, 10.0)["7"],
                "9": ModusSplit(
                    kwh_je_modus={HEIZEN: 4.0}, abdeckung_h=24.0, bezug_kwh=5.0
                ),
            },
            {"7": _Investition(), "9": _Investition()},
            DATUM,
        )

        assert stapel.heizen_kwh == 12.0, "8 gemessen (Gerät 7) + 4 abgeleitet (Gerät 9)"
        assert stapel.bezug_kwh == 15.0
        assert stapel.hat_gemessen is True

    def test_ohne_gemessenen_zweig_traegt_der_abgeleitete_allein(self, geraet):
        stapel = falte_tages_stapel(
            {}, {}, _abgeleitet(heizen=6.0, kuehlen=0.0, bezug=8.0), geraet, DATUM,
        )
        assert stapel.heizen_kwh == 6.0
        assert stapel.nicht_aufgeteilt_kwh == 2.0
        assert stapel.hat_gemessen is False
        assert stapel.hat_split is True


class TestGrenzenDieMitgewandertSind:
    """Was die Route vorher tat und weiter tun muss."""

    def test_ein_geraet_ohne_tages_bezug_wird_ganz_ausgelassen(self, geraet):
        """Ohne Bezug gibt es nichts, wovon die Teilmenge eine Teilmenge wäre."""
        stapel = falte_tages_stapel(
            _gemessen(heizen=8.0, kuehlen=1.0), {}, {}, geraet, DATUM,
        )
        assert stapel.ist_leer

    def test_teilmenge_groesser_als_bezug_wird_ausgelassen_statt_gekappt(self, geraet):
        """⚠ Eine stille Kappung machte aus einem Widerspruch eine plausible
        Zahl — deshalb fällt das Gerät **ganz** heraus."""
        stapel = falte_tages_stapel(
            _gemessen(heizen=20.0, kuehlen=0.0), {"7": 10.0}, {}, geraet, DATUM,
        )
        assert stapel.ist_leer

    def test_ein_am_tag_inaktives_geraet_zaehlt_nicht(self):
        stapel = falte_tages_stapel(
            _gemessen(heizen=8.0, kuehlen=1.0),
            {"7": 10.0},
            _abgeleitet(8.0, 1.0, 10.0),
            {"7": _Investition(aktiv=False)},
            DATUM,
        )
        assert stapel.ist_leer

    def test_abdeckung_wird_ueber_geraete_gedeckelt_nicht_summiert(self):
        """W-17 (dietmar1968, T89667 #210): zwei Geräte mit je 18 Stunden
        ergeben nicht 36 Stunden Erkenntnis — ein Tag hat 24."""
        stapel = falte_tages_stapel(
            {}, {},
            {
                "7": ModusSplit(kwh_je_modus={HEIZEN: 4.0}, abdeckung_h=18.0, bezug_kwh=5.0),
                "9": ModusSplit(kwh_je_modus={HEIZEN: 4.0}, abdeckung_h=18.0, bezug_kwh=5.0),
            },
            {"7": _Investition(), "9": _Investition()},
            DATUM,
        )
        assert stapel.abdeckung_h <= 24.0
