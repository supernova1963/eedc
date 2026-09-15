"""N-451b — **K3 im Nicht-DB-Pfad des laufenden Monats.**

**Konzept Wärme/Klima K1 · K3 (SOLL §3.2, W-1/W-1b) · S1 (SOLL §3.3) ·
ADR-002/P4 · ADR-001/S1.**

⛔ **Der Befund, gemessen am 14.09.2026 über die echte Route.** Die Tabelle
``typ_aggregation["waermepumpe"]`` in ``api/routes/aktueller_monat.py`` hob
``stromverbrauch_kwh``, ``strom_heizen_kwh`` und ``strom_warmwasser_kwh``
**alle drei** in dieselbe Top-Level-Größe ``wp_strom_kwh`` — und ``_aggregate``
addiert. Der Gesamtzähler **und** die Aufteilung, die ihn ersetzt:

============================================  =========  =========  ========
Lage (eine WP, Wärme 3.000 kWh)               vorher     Lesetür    DB-Zweig
============================================  =========  =========  ========
F5: Gesamt 1000 · Heizen 600 · WW 400         **2.000**  1.000      1.000
   → daraus ``wp_jaz``                        **1,5**    —          3,0
dieselbe Lage, Kennzeichen **aus**            **2.000**  1.000      1.000
zwei Geräte (F2 1000 · F5 1000/600/400)       **3.000**  2.000      2.000
============================================  =========  =========  ========

⭐ **Der DB-Zweig war die ganze Zeit richtig** — er geht durch dieselbe Lesetür
(``monats_fakten`` → ``imd_monatsaggregat`` → ``get_wp_strom_kwh``) und nennt
für dieselben Werte 1.000 kWh und 3,0. Der Fehler traf also **nur den laufenden
Monat**, dafür jeden Tag bis zum Abschluss, und heilte sich danach selbst: eine
Anlage, die den ganzen Monat lang **halb so gut** aussieht, wie sie ist. Genau
die Bauform, die ``test_bkw_pv_achse_laufender_monat`` für die PV-Achse
beschreibt — und der Strom-Zwilling zu N-391c/Klausel d (dort die Wärme).

⚠ **Die Klasse:** Der N-451-Bau (WK-12c) hat die Stufenregel für Monat, Stunde
und Kühl-Abzug eingezogen; **diesen** Monatspfad hat er nicht erreicht. Eine
Regel gilt nicht dort, wo sie definiert ist, sondern dort, wo sie gerufen wird.

Schwesterdateien: ``test_n451_monatspfad_k3.py`` (die Stufenregel selbst, an
der Lesetür), ``test_n391c_geldpfade_d1.py`` (dieselbe Bühne ``_nicht_db``, die
Wärmeseite), ``test_n443_f5_ein_stromfeld_fehlt.py`` (Stufe 3).
"""

from __future__ import annotations

import pytest

from backend.tests.test_n391c_geldpfade_d1 import _WP_GAS, _nicht_db

#: Dieselbe Wärmepumpe, nur ohne das Kennzeichen — der Anwender, der die
#: getrennte Messung nie eingeschaltet (oder wieder abgeschaltet) hat, während
#: seine feinen Sensoren weiterlaufen. Für ihn sind die feinen Felder **keine**
#: Summanden; die Tabelle addierte sie trotzdem.
_WP_GESAMT = dict(_WP_GAS, getrennte_strommessung=False)

#: Die Lage, die den Befund trägt: Gesamtzähler **und** vollständige feine
#: Aufteilung, wie sie entsteht, wenn jemand seine Zähler nachrüstet und den
#: alten Gesamtzähler stehen lässt (der Vorschlags-Dienst bietet die Summe
#: sogar aktiv als ``stromverbrauch_kwh`` an).
_F5_MIT_GESAMT = {
    "waerme_kwh": 3000.0, "stromverbrauch_kwh": 1000.0,
    "strom_heizen_kwh": 600.0, "strom_warmwasser_kwh": 400.0,
}


# ═══ a — der Befund: F5 mit Gesamtzähler zählt EINMAL ═══════════════════════

@pytest.mark.asyncio
async def test_a_f5_mit_gesamtzaehler_zaehlt_einmal(db, monkeypatch):
    """**2.000 statt 1.000, und daraus eine Arbeitszahl von 1,5 statt 3,0.**

    Stufe 1 der Vorrangkette (``wp_strom_stufe``): Ist die feine Achse
    vollständig, IST sie die Menge — der Gesamtzähler wird verworfen, *„sonst
    zählte derselbe Strom zweimal"*. Die Tabelle addierte alle drei.

    Die Arbeitszahl steht mit in der Klausel, weil sie die Zahl ist, die der
    Anwender sieht: ``wp_jaz`` entsteht in dieser Route aus genau diesem
    Nenner (``arbeitszahl(wp_waerme, wp_strom, …)``).
    """
    res = await _nicht_db(
        db, monkeypatch, [dict(_F5_MIT_GESAMT)], "N-451b F5 mit Gesamt",
    )

    assert res.wp_strom_kwh == pytest.approx(1000.0), "1000+600+400 wären 2000"
    assert res.wp_jaz == pytest.approx(3.0), "vor dem Bau: 1,5"


@pytest.mark.asyncio
async def test_b_nur_gesamtzaehler_bleibt_bitgleich(db, monkeypatch):
    """F2 — wer nur den Gesamtzähler hat, sieht ihn unverändert (Stufe 2/K1)."""
    res = await _nicht_db(
        db, monkeypatch,
        [{"waerme_kwh": 3000.0, "stromverbrauch_kwh": 1000.0}],
        "N-451b nur Gesamt",
    )

    assert res.wp_strom_kwh == pytest.approx(1000.0)
    assert res.wp_jaz == pytest.approx(3.0)


@pytest.mark.asyncio
async def test_c_f5_ohne_gesamtzaehler_bleibt_bitgleich(db, monkeypatch):
    """F5 ohne Gesamtzähler — die feine Summe, wie bisher (Stufe 1)."""
    res = await _nicht_db(
        db, monkeypatch,
        [{"waerme_kwh": 3000.0, "strom_heizen_kwh": 600.0,
          "strom_warmwasser_kwh": 400.0}],
        "N-451b F5 ohne Gesamt",
    )

    assert res.wp_strom_kwh == pytest.approx(1000.0)


@pytest.mark.asyncio
async def test_d_unvollstaendige_aufteilung_ohne_gesamt_traegt(db, monkeypatch):
    """**Stufe 3** — eine halbe Aufteilung ohne Gesamtzähler ist die einzige
    Messung, die es gibt, und sie trägt (600 kWh).

    Die Klausel ist die Gegenrichtung zu a: K3 heißt nicht *„die feine Achse
    gewinnt"* und auch nicht *„der Gesamtzähler gewinnt"*, sondern eine
    Vorrangkette. Wer sie mit „nimm immer den Gesamtzähler" abkürzt, lässt hier
    den ganzen Block verschwinden — der Befund, den Etappe 3 im Tagespfad
    repariert hat (#263, OB73-gif).
    """
    res = await _nicht_db(
        db, monkeypatch,
        [{"waerme_kwh": 3000.0, "strom_heizen_kwh": 600.0}],
        "N-451b unvollstaendig",
    )

    assert res.wp_strom_kwh == pytest.approx(600.0)


@pytest.mark.asyncio
async def test_e_ohne_kennzeichen_traegt_der_gesamtzaehler(db, monkeypatch):
    """Kennzeichen **aus**, alle drei Werte da ⇒ 1.000, nicht 2.000.

    Ohne ``getrennte_strommessung`` sind die feinen Felder gar keine Summanden
    (``get_wp_strom_kwh`` liest dann ausschließlich den Gesamtzähler). Die
    Tabelle kannte den Parameter nicht und addierte trotzdem — der Fehler war
    also nicht einmal auf getrennt messende Anlagen beschränkt.
    """
    res = await _nicht_db(
        db, monkeypatch, [dict(_F5_MIT_GESAMT)], "N-451b Kennzeichen aus",
        parameter_je_geraet=[dict(_WP_GESAMT)],
    )

    assert res.wp_strom_kwh == pytest.approx(1000.0)
    assert res.wp_jaz == pytest.approx(3.0)


@pytest.mark.asyncio
async def test_f_k3_faellt_je_geraet_nicht_auf_der_anlagensumme(db, monkeypatch):
    """Zwei Wärmepumpen, die verschieden zählen — 1.000 + 1.000 = **2.000**.

    Dieselbe Lehre wie N-391b/N-391c auf der Wärmeseite: Die Stufenregel hängt
    an ``Investition.parameter`` und an den Achsen, die **dieses** Gerät hat.
    Auf den Anlagensummen gestellt (Gesamt 2.000 · Heizen 600 · WW 400), sähe
    sie eine unvollständige Aufteilung neben einem Gesamtzähler, entschiede
    „gesamt" und nennte **2.000** — hier zufällig dieselbe Zahl, aber aus dem
    falschen Grund; deshalb prüft die Klausel zusätzlich die Gegenlage, in der
    die Summen-Auflösung sichtbar danebenliegt.
    """
    res = await _nicht_db(
        db, monkeypatch,
        [{"waerme_kwh": 1500.0, "stromverbrauch_kwh": 1000.0},
         {"waerme_kwh": 1500.0, "stromverbrauch_kwh": 1000.0,
          "strom_heizen_kwh": 600.0, "strom_warmwasser_kwh": 400.0}],
        "N-451b je Geraet",
    )
    assert res.wp_strom_kwh == pytest.approx(2000.0), "vor dem Bau: 3000"

    # Gegenlage: WP1 misst fein und vollständig (ohne Gesamtzähler), WP2 nur
    # grob. Je Gerät: 1000 + 800 = 1800. Auf der Anlagensumme wäre die feine
    # Achse vollständig (600+400) UND ein Gesamtzähler da ⇒ Stufe 1 ⇒ 1000,
    # und die 800 kWh von WP2 verschwänden still (P4).
    gegen = await _nicht_db(
        db, monkeypatch,
        [{"waerme_kwh": 1500.0, "strom_heizen_kwh": 600.0,
          "strom_warmwasser_kwh": 400.0},
         {"waerme_kwh": 1500.0, "stromverbrauch_kwh": 800.0}],
        "N-451b je Geraet gegen",
    )
    assert gegen.wp_strom_kwh == pytest.approx(1800.0)


@pytest.mark.asyncio
async def test_g_bestand_ohne_getrennte_messung_bitgleich(db, monkeypatch):
    """**Bestand** — die weitaus häufigste Anlage bewegt sich nicht.

    Eine Wärmepumpe ohne getrennte Strommessung hat genau einen Stromwert; für
    sie ist die Tabelle vorher wie nachher eine Durchreichung. Die Klausel hält
    beide Größen fest, die an ihr hängen.
    """
    res = await _nicht_db(
        db, monkeypatch,
        [{"waerme_kwh": 3000.0, "stromverbrauch_kwh": 1000.0}],
        "N-451b Bestand",
        parameter_je_geraet=[dict(_WP_GESAMT)],
    )

    assert res.wp_strom_kwh == pytest.approx(1000.0)
    assert res.wp_jaz == pytest.approx(3.0)


@pytest.mark.asyncio
async def test_h_keine_stromquelle_erfindet_keine_null(db, monkeypatch):
    """Kein einziger Stromwert ⇒ **kein** ``wp_strom_kwh`` (P4).

    Die Vorauflösung darf nicht das tun, was ``_aggregate`` nie tat: aus einer
    Abwesenheit eine 0 machen. ``get_wp_strom_kwh({}) == 0.0`` — wer das Ergebnis
    ungeprüft ablegt, schreibt eine Null in eine Sicht, die vorher zu Recht
    nichts anzeigte, und die Arbeitszahl bekäme einen Nenner von 0.
    """
    res = await _nicht_db(
        db, monkeypatch, [{"waerme_kwh": 3000.0}], "N-451b ohne Strom",
    )

    assert res.wp_strom_kwh is None
    assert res.wp_waerme_kwh == pytest.approx(3000.0)
