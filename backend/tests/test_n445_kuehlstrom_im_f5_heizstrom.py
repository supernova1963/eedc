"""**N-445 (WK-06)** — F5 + F3 ohne F4: der abgeleitete Kühlanteil kürzt nichts.

⭐ **Die Regel, die diese Datei hält (SOLL §4.1, „Ergänzung zu E7", Option A,
Entscheid Gernot 12.09.2026): *Abgezogen wird nur, was im Nenner steht.***
Ein funktionsfremder Stromanteil (Kühlen · Lüften · Entfeuchten) kürzt den
Nenner der **Gesamt**-Arbeitszahl nur, wenn er auch darin enthalten ist — im
nicht-getrennten Zweig immer (der Gesamtzähler enthält ihn), im F5-Zweig nur,
wenn er **gemessen** ist (dann wurde er zum Topf addiert, W-16). Ein
**abgeleiteter** Anteil ist eine Verteilung dieses Topfs, keine Menge darin.

Die Funktions-Arbeitszahlen bleiben davon unberührt (**SOLL-§9-E7**: ihr Nenner
ist der gemessene F5-Zähler, dort wird ohnehin nichts abgezogen).

Ziel: **Ausstattung F5 + F3 ohne F4**
  * F5 — getrennte Strommessung (`strom_heizen_kwh` + `strom_warmwasser_kwh`)
  * F3 — Betriebsmodus-Sensor, daraus der **abgeleitete** Split
    (`modus_strom_*_kwh`, `ModusStromZeile.gemessen == False`)
  * kein F4 — **kein** `betriebsart_strom_kuehlen_kwh`

**Die Lage in einem Satz.** Der abgeleitete Split ist an einer F5-Anlage
arithmetisch eine **Aufteilung von `strom_heizen_kwh + strom_warmwasser_kwh`**
(Normierung tagesweise auf `TagesZusammenfassung.komponenten_kwh
[waermepumpe_<id>]`, das bei belegter feiner Achse genau diese Summe ist —
`snapshot/komponenten_beitraege.py`, EIN `target_key`; Invariante und Bezug im
Lesepfad gegen `get_wp_strom_kwh`, `modus_split_schreiben.py` bzw.
`modus_split_monat.py`).

⭐ **Warum das die Frage entscheidet, ohne die Physik zu kennen.** Ob der
Zähler *Strom Heizen* den Verdichter im Kühlbetrieb **physisch** mitmisst, weiß
eedc nicht und kann es aus gespeicherten Daten nicht erfahren — in welchem der
zwei Felder der Anteil säße, ist nirgends abgelegt. Genau deshalb fällt die
Entscheidung an der **Kategorie** statt am Einzelfall: Ein Abzug ist nur dann
eine Abgrenzung, wenn die abgezogene Menge im Nenner **steht**; steht sie nicht
darin, ist er eine Kürzung. eedc trifft diese Unterscheidung auf der
**Additionsseite** bereits (`get_wp_strom_kwh` addiert nur den *gemessenen*
funktionsfremden Strom, W-16) — Option A stellt die Symmetrie her, die dort
schon steht.

⛔ **Hier standen bis zum 12.09.2026 zwei `xfail`-Proben („Welt A" / „Welt B")
nebeneinander, weil die Frage offen war.** Sie ist entschieden; die Welt-B-Probe
ist gelöscht (sie prüfte ohnehin nur Arithmetik auf selbst eingesetzten Zahlen —
`750 − 100` —, konnte also nie rot werden), die Welt-A-Lesart ist scharf.

Bezug: SOLL §3.2b (R2), §4.1 **SOLL-§9-E7**, ADR-002/P12.
Vorbild: `test_soll_waerme_klima_w4_arbeitszahl_je_funktion.py`,
`test_263_k2_modus_split.py`, `test_soll_waerme_klima_achse3_aufloesung.py`.
"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import pytest

from backend.core.berechnungen.betriebsart_gemessen import modus_strom_zeile
from backend.core.berechnungen.imd_monatsaggregat import imd_typ_beitrag
from backend.core.berechnungen.modus_split import (
    ModusSplit,
    ModusStunde,
    falte_modus_split_tag,
)
from backend.core.berechnungen.tages_stapel import falte_tages_stapel
from backend.core.berechnungen.waermepumpe_kennzahl import (
    arbeitszahl,
    arbeitszahl_je_funktion,
    waerme_gesamt_kwh,
)
from backend.core.betriebsmodus import HEIZEN, KUEHLEN, WARMWASSER
from backend.core.field_definitions import get_wp_strom_kwh
from backend.services.monats_fakten import _RohMonat

DATUM = date(2026, 6, 15)


def _wp(**params):
    """Eine Wärmepumpe mit getrennter Strommessung — Layer braucht nur zwei Attribute."""
    return SimpleNamespace(
        id=1,
        typ="waermepumpe",
        parameter={"getrennte_strommessung": True, **params},
        ist_aktiv_an=lambda _d: True,
        ist_aktiv_im_monat=lambda _j, _m: True,
    )


def _wp_ohne_split(**params):
    """Das Gegenstück: ein Gerät mit **einem** Gesamtzähler (nicht-F5)."""
    return SimpleNamespace(
        id=2,
        typ="waermepumpe",
        parameter=dict(params),
        ist_aktiv_an=lambda _d: True,
        ist_aktiv_im_monat=lambda _j, _m: True,
    )


# ═══════════════════════════════════════════════════════════════════════════
# 1 · MONAT — ein Winter-/Übergangsmonat, in dem auch gekühlt wurde
# ═══════════════════════════════════════════════════════════════════════════
#
# Die Zahlen sind bewusst die des **Handbuch-Fall B** (`HANDBUCH_WAERME_KLIMA.md`
# §6 B: Heizen 3000 kWh Wärme auf 750 kWh Strom · Warmwasser 600 auf 200 ·
# Kühlen 100 kWh Strom ohne Kältemenge) — nur ohne den dortigen **Kühlzähler**.
# Dieselbe physische Anlage, ein Erfassungsweg weniger.

MONAT_F5_F3 = {
    # F5 — die zwei gemessenen Zähler
    "strom_heizen_kwh": 750.0,
    "strom_warmwasser_kwh": 200.0,
    # Wärme, beide gemessen
    "heizenergie_kwh": 3000.0,
    "warmwasser_kwh": 600.0,
    # F3 — der ABGELEITETE Split (Σ = 950 = die zwei Zähler, Invariante hält)
    "modus_strom_heizen_kwh": 700.0,
    "modus_strom_warmwasser_kwh": 150.0,
    "modus_strom_kuehlen_kwh": 100.0,
    "modus_abdeckung_h": 700.0,
}


def test_n445_monat_der_split_ist_eine_aufteilung_der_zwei_f5_zaehler():
    """**Die Messung, auf der alles Weitere steht** — die Normierung selbst.

    ⭐ **Hier wird die Normierung GEFAHREN, nicht nachgerechnet.** Bis zum
    12.09.2026 addierte diese Probe die drei Zahlen des Fixture-Wörterbuchs und
    verglich sie mit einer vierten daraus — Arithmetik auf selbst gesetzten
    Werten. Der Sprengsatz „`faktor = 1.0` in `modus_split.py`" blieb dabei
    **still** (gemessen 12.09.), obwohl er genau die Behauptung dieser Probe
    zerstört. Jetzt läuft die echte Faltung: eine **rohe Stundenform** aus dem
    Leistungspfad (Σ 19 kWh, völlig anderes Niveau) wird auf den F5-Pot 950
    normiert.

    Das ist der tragende Grund der ganzen Regel: Der abgeleitete Split ist
    arithmetisch eine **Aufteilung von `strom_heizen + strom_warmwasser`**,
    unabhängig davon, was der Zähler physisch misst.
    """
    inv = _wp()
    pot = get_wp_strom_kwh(MONAT_F5_F3, inv.parameter)
    assert pot == pytest.approx(950.0)

    # Der Leistungspfad kennt die FORM, der Zählerpfad die MENGE.
    roh = [
        ModusStunde(stunde=h, modus=m, kwh=k) for h, m, k in (
            (6, HEIZEN, 8.0), (12, KUEHLEN, 2.0), (18, WARMWASSER, 3.0),
            (22, HEIZEN, 6.0),
        )
    ]
    split = falte_modus_split_tag(roh, tages_kwh=pot)

    assert sum(abs(s.kwh) for s in roh) == pytest.approx(19.0), (
        "Die Rohform hat ein ganz anderes Niveau — sonst prüfte die Normierung "
        "nichts."
    )
    assert split.bezug_kwh == pytest.approx(950.0)
    summe_teilmengen = (
        split.teilmenge_kwh(HEIZEN)
        + split.teilmenge_kwh(KUEHLEN)
        + split.teilmenge_kwh(WARMWASSER)
    )
    assert summe_teilmengen == pytest.approx(950.0), (
        "Der Split verteilt genau den Pot der zwei F5-Zähler — deshalb steckt "
        "sein Kühlanteil per Konstruktion in einem der beiden."
    )

    # Und die gespeicherte Zeile trägt dieselbe Eigenschaft.
    zeile = modus_strom_zeile(MONAT_F5_F3)
    assert zeile.gemessen is False, "F3 ohne F4 ⇒ der abgeleitete Zweig gilt"
    assert (
        zeile.heizen_kwh + zeile.kuehlen_kwh + zeile.warmwasser_kwh
    ) == pytest.approx(950.0)


def test_n445_monat_der_abgeleitete_anteil_kuerzt_den_f5_nenner_nicht():
    """**Die Kernaussage, an den Einzelwerten der Zeile — Option A.**

    Die Zeile trägt einen abgeleiteten Kühlanteil von 100 kWh. Er bleibt als
    **Menge** unverändert stehen (`wp_modus_strom_kuehlen`, K1), aber der
    **Abzug** ist 0 — er steckt nicht neben dem F5-Nenner, sondern darin.
    """
    inv = _wp()
    b = imd_typ_beitrag(inv, MONAT_F5_F3)
    q = waerme_gesamt_kwh(None, b.wp_heizung, b.wp_warmwasser)

    assert b.wp_hat_split is True
    assert b.wp_modus_strom_kuehlen == pytest.approx(100.0), (
        "Die MENGE bleibt — sie trägt Aufteilung, Balken und Restmenge (K1)."
    )
    assert b.wp_modus_strom_funktionsfremd_abzug == pytest.approx(0.0), (
        "Der ABZUG ist 0: der abgeleitete Anteil ist eine Verteilung des "
        "F5-Topfs, keine Menge daneben."
    )

    gesamt = arbeitszahl(
        q, b.wp_strom,
        strom_funktionsfremd_kwh=b.wp_modus_strom_funktionsfremd_abzug,
    )
    # 3600 ÷ 950 — genau der Wert, den dieselbe Anlage MIT Kühlzähler zeigt.
    assert gesamt.wert == pytest.approx(3.789, abs=0.001)
    assert gesamt.nenner_kwh == pytest.approx(950.0)


def test_n445_monat_je_funktion_bleibt_unveraendert():
    """**E7 bleibt E7** — die Funktions-Arbeitszahlen ändern sich nicht.

    Ihr Nenner ist der gemessene F5-Zähler; dort wurde nie abgezogen und wird
    auch jetzt nichts abgezogen. Die Probe hält fest, dass Option A **nur** die
    Gesamtzahl bewegt.
    """
    inv = _wp()
    b = imd_typ_beitrag(inv, MONAT_F5_F3)
    je_funktion = arbeitszahl_je_funktion(
        heizung_kwh=b.wp_heizung,
        strom_heizen_kwh=b.wp_strom_heizen,
        warmwasser_kwh=b.wp_warmwasser,
        strom_warmwasser_kwh=b.wp_strom_warmwasser,
        hat_split=b.wp_hat_split,
    )

    assert je_funktion.heizen.wert == pytest.approx(4.00)       # 3000 ÷ 750
    assert je_funktion.heizen.nenner_kwh == pytest.approx(750.0)
    assert je_funktion.warmwasser.wert == pytest.approx(3.00)   # 600 ÷ 200


def test_n445_monat_derselbe_wert_wie_mit_kuehlzaehler():
    """**Die schärfste Einzelaussage: der Erfassungsweg bewegt die Zahl nicht mehr.**

    Handbuch Fall B rechnet für dieselbe Anlage MIT Kühlzähler
    `3600 ÷ (1050 − 100) = 3,79`. Bis zum 12.09.2026 zeigte sie mit
    Betriebsmodus-Sensor statt Kühlzähler **4,24** — 12 % besser bei gleicher
    Physik, also SOLL §3.3/**S1** in seiner Kern-Verletzung. Jetzt stehen beide
    Wege auf **3,79**, und diese Probe misst beide nebeneinander.
    """
    inv = _wp()

    b_modus = imd_typ_beitrag(inv, MONAT_F5_F3)
    mit_modus = arbeitszahl(
        3600.0, b_modus.wp_strom,
        strom_funktionsfremd_kwh=b_modus.wp_modus_strom_funktionsfremd_abzug,
    )

    mit_zaehler = {
        "strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0,
        "heizenergie_kwh": 3000.0, "warmwasser_kwh": 600.0,
        "betriebsart_strom_kuehlen_kwh": 100.0,        # F4 statt F3
    }
    b_zaehler = imd_typ_beitrag(inv, mit_zaehler)
    mit_f4 = arbeitszahl(
        3600.0, b_zaehler.wp_strom,
        strom_funktionsfremd_kwh=b_zaehler.wp_modus_strom_funktionsfremd_abzug,
    )

    assert b_modus.wp_strom == pytest.approx(950.0)     # nichts addiert
    assert b_zaehler.wp_strom == pytest.approx(1050.0)  # W-16 addiert
    assert mit_modus.wert == pytest.approx(3.789, abs=0.001)
    assert mit_f4.wert == pytest.approx(3.789, abs=0.001)
    assert mit_modus.wert == pytest.approx(mit_f4.wert)


def test_n445_monat_die_heizzahl_wird_NICHT_um_den_kuehlanteil_gekuerzt():
    """**Die verworfene Gegenlesart (Welt B) darf nicht zurückkommen.**

    Sie hieße: der Zähler *Strom Heizen* misst den Verdichter im Kühlbetrieb
    mit, also gehört der Kühlanteil aus dem Heiz-Nenner heraus (3000 ÷ 650 =
    4,62 bzw. anteilig 4,47). **Verworfen** — sie verstößt gegen SOLL-§9-E7
    (*Messung − Verteilung* ist keine Messung) und ist zudem nicht bestimmbar:
    nirgends steht, in **welchem** der zwei Felder der Anteil säße.

    Die Probe misst am Layer, dass die Heizzahl auf dem **vollen** gemessenen
    Zähler steht — nicht auf einem um den Modus-Split gekürzten.
    """
    inv = _wp()
    b = imd_typ_beitrag(inv, MONAT_F5_F3)
    je_funktion = arbeitszahl_je_funktion(
        heizung_kwh=b.wp_heizung,
        strom_heizen_kwh=b.wp_strom_heizen,
        warmwasser_kwh=b.wp_warmwasser,
        strom_warmwasser_kwh=b.wp_strom_warmwasser,
        hat_split=b.wp_hat_split,
    )

    assert je_funktion.heizen.nenner_kwh == pytest.approx(750.0), (
        "Der Heiz-Nenner trägt den vollen gemessenen Zähler — kein Abzug."
    )
    assert je_funktion.heizen.wert == pytest.approx(4.00)
    assert je_funktion.heizen.wert != pytest.approx(4.615, abs=0.001)
    assert je_funktion.heizen.wert != pytest.approx(4.470, abs=0.001)


# ── Der Sommermonat: eine Selbstwidersprüchlichkeit ohne Welt-Annahme ──────
#
# ⭐ **Diese Probe braucht KEINE der beiden Welten.** Sie zeigt, dass eedc im
# selben Block zwei Sätze nebeneinander stellt, die einander ausschließen.
#
# Die Lage ist der Normalfall, nicht die Ausnahme: Eine Luft-Wasser-WP mit
# aktiver Kühlung steht im Sommer den ganzen Monat auf `cool`, und seit v4.0.30
# gilt „**Leerlauf behält deinen Modus**" (`HANDBUCH_WAERME_KLIMA.md` §5). Die
# Warmwasserbereitung derselben Stunden fällt damit unter *Kühlen* — für
# `warmwasser` gibt es in `_ZUSTAND_ZU_KANON` keinen HVACMode, nur eigene
# Text-Sensoren (`betriebsmodus.py:354-359`).

MONAT_SOMMER_F5_F3 = {
    "strom_heizen_kwh": 20.0,        # Bereitschaft / Umwälzung
    "strom_warmwasser_kwh": 60.0,    # GEMESSEN, der Zähler lief
    "heizenergie_kwh": 0.0,
    "warmwasser_kwh": 180.0,         # GEMESSEN, 180 kWh Warmwasser
    "modus_strom_heizen_kwh": 0.0,
    "modus_strom_warmwasser_kwh": 0.0,
    "modus_strom_kuehlen_kwh": 80.0,  # der ganze Pot, Modus stand auf `cool`
    "modus_abdeckung_h": 720.0,
}


def test_n445_sommermonat_bekommt_seine_zahl_zurueck():
    """**Der Selbstwiderspruch ist weg — und er brauchte nie eine Welt-Annahme.**

    Bis zum 12.09.2026 stand hier *„nur Kühlbetrieb in diesem Zeitraum"* und
    zwei Zeilen darunter *„Arbeitszahl Warmwasser 3,0"* — aus **derselben**
    Zeile, die 180 kWh Warmwasser auf einem gemessenen 60-kWh-Zähler ausweist.
    Zustande kam das, weil der abgeleitete Split den ganzen Pot dem Kühlen
    zuschlug (Leerlauf behält den Modus, Handbuch §5) und der Abzug ihn dann
    vollständig aus dem Nenner nahm: `e == 0`.

    Jetzt trägt der Nenner die vollen 80 kWh: **180 ÷ 80 = 2,25**, neben der
    Warmwasser-Zahl 3,00 — zwei Sätze, die zueinander passen.
    """
    inv = _wp()
    b = imd_typ_beitrag(inv, MONAT_SOMMER_F5_F3)
    q = waerme_gesamt_kwh(None, b.wp_heizung, b.wp_warmwasser)

    assert b.wp_modus_strom_kuehlen == pytest.approx(80.0)   # Menge: unverändert
    assert b.wp_modus_strom_funktionsfremd_abzug == pytest.approx(0.0)

    gesamt = arbeitszahl(
        q, b.wp_strom,
        strom_funktionsfremd_kwh=b.wp_modus_strom_funktionsfremd_abzug,
    )
    je_funktion = arbeitszahl_je_funktion(
        heizung_kwh=b.wp_heizung,
        strom_heizen_kwh=b.wp_strom_heizen,
        warmwasser_kwh=b.wp_warmwasser,
        strom_warmwasser_kwh=b.wp_strom_warmwasser,
        hat_split=b.wp_hat_split,
    )

    assert gesamt.grund is None
    assert gesamt.wert == pytest.approx(2.25)                 # 180 ÷ 80
    assert gesamt.nenner_kwh == pytest.approx(80.0)
    assert je_funktion.warmwasser.wert == pytest.approx(3.00)  # 180 ÷ 60


# ═══════════════════════════════════════════════════════════════════════════
# 2 · TAG — dieselbe Lage in `energie_profil/tag.py::get_tag_detail`
# ═══════════════════════════════════════════════════════════════════════════
#
# Der Tag baut seinen Nenner aus `komponenten_kwh` (Σ `waermepumpe_*`) und
# seinen funktionsfremden Abzug aus dem `TagesStapel`; die Heizzahl liest
# `detail["wp_strom_heizen_kwh"]` roh (beide Stellen in `tag.py::get_tag_detail`).

TAG_DETAIL = {
    "wp_strom_heizen_kwh": 6.0,
    "wp_strom_warmwasser_kwh": 4.0,
    "wp_heizung_kwh": 15.0,
    "wp_warmwasser_kwh": 12.0,
}
TAG_POT_KWH = 10.0          # komponenten_kwh["waermepumpe_1"] = 6,0 + 4,0
TAG_SPLIT = ModusSplit(
    kwh_je_modus={HEIZEN: 4.0, WARMWASSER: 3.0, KUEHLEN: 3.0},
    abdeckung_h=24.0,
    bezug_kwh=TAG_POT_KWH,
)


def _tages_stapel():
    inv = _wp()
    return falte_tages_stapel(
        {},                                  # kein F4
        {"1": TAG_POT_KWH},
        {"1": TAG_SPLIT},
        {"1": inv},
        DATUM,
    )


def test_n445_tag_der_stapel_verteilt_denselben_pot():
    stapel = _tages_stapel()

    assert stapel.hat_gemessen is False
    assert stapel.bezug_kwh == pytest.approx(TAG_POT_KWH)
    assert (
        stapel.heizen_kwh + stapel.warmwasser_kwh + stapel.kuehlen_kwh
    ) == pytest.approx(TAG_POT_KWH)


def test_n445_tag_der_stapel_traegt_den_abzug_und_nicht_die_menge():
    """**Die Tages-Entsprechung — am Stapel gemessen, nicht nachgerechnet.**

    Der Stapel weist weiterhin 3,0 kWh Kühlstrom aus (Balken, Restmenge, K1),
    aber sein `funktionsfremd_abzug_kwh` ist 0: Das Gerät misst getrennt und
    seine Aufteilung ist abgeleitet.
    """
    stapel = _tages_stapel()

    assert stapel.kuehlen_kwh == pytest.approx(3.0)
    assert stapel.funktionsfremd_abzug_kwh == pytest.approx(0.0)


def test_n445_tag_gesamt_und_je_funktion_passen_zueinander():
    """Gesamt **2,70** (27 ÷ 10) neben Heizen 2,50 — vorher 3,86 neben 2,50.

    ⭐ Die alte Lage war nicht nur zu hoch, sie war **unmöglich**: Eine
    Gesamtzahl von 3,86 über zwei Funktionen, deren Einzelzahlen 2,50 und 3,00
    lauten, liegt außerhalb der gewichteten Mitte — genau die Drift, die #183
    schon einmal beschrieben hat.
    """
    stapel = _tages_stapel()
    q = waerme_gesamt_kwh(
        None, TAG_DETAIL["wp_heizung_kwh"], TAG_DETAIL["wp_warmwasser_kwh"],
    )

    gesamt = arbeitszahl(
        q, TAG_POT_KWH,
        strom_funktionsfremd_kwh=stapel.funktionsfremd_abzug_kwh,
    )
    je_funktion = arbeitszahl_je_funktion(
        heizung_kwh=TAG_DETAIL["wp_heizung_kwh"],
        strom_heizen_kwh=TAG_DETAIL["wp_strom_heizen_kwh"],
        warmwasser_kwh=TAG_DETAIL["wp_warmwasser_kwh"],
        strom_warmwasser_kwh=TAG_DETAIL["wp_strom_warmwasser_kwh"],
        hat_split=True,
        null_ist_gemessen=True,
    )

    assert gesamt.wert == pytest.approx(2.70)               # 27 ÷ 10
    assert gesamt.nenner_kwh == pytest.approx(10.0)
    assert je_funktion.heizen.wert == pytest.approx(2.50)   # 15 ÷ 6
    assert je_funktion.warmwasser.wert == pytest.approx(3.00)
    assert 2.50 <= gesamt.wert <= 3.00, (
        "Eine Gesamtzahl muss zwischen ihren Funktionszahlen liegen (#183)."
    )


# ═══════════════════════════════════════════════════════════════════════════
# 3 · Die Gegenprobe, die NICHT kippen darf
# ═══════════════════════════════════════════════════════════════════════════

def test_n445_gegenprobe_f5_mit_gemessenem_kuehlzaehler_bleibt_unveraendert():
    """**MartyBrs Bauform (F5 + F4) ist NICHT betroffen** — Handbuch Fall B.

    Jede Lösung muss diese Zahlen bitgleich lassen: `get_wp_strom_kwh` addiert
    den gemessenen Kühlstrom (W-16), `arbeitszahl` zieht ihn wieder ab (W-16b),
    und die Heizzahl steht auf dem reinen Heizzähler.
    """
    inv = _wp()
    daten = {
        "strom_heizen_kwh": 750.0,
        "strom_warmwasser_kwh": 200.0,
        "heizenergie_kwh": 3000.0,
        "warmwasser_kwh": 600.0,
        "betriebsart_strom_kuehlen_kwh": 100.0,   # F4
    }
    zeile = modus_strom_zeile(daten)
    assert zeile.gemessen is True

    b = imd_typ_beitrag(inv, daten)
    assert b.wp_strom == pytest.approx(1050.0)
    assert b.wp_modus_strom_funktionsfremd_abzug == pytest.approx(100.0), (
        "GEMESSEN ⇒ der Abzug bleibt voll: `get_wp_strom_kwh` hat ihn zum "
        "Topf addiert (W-16), also steht er im Nenner."
    )

    gesamt = arbeitszahl(
        3600.0, b.wp_strom,
        strom_funktionsfremd_kwh=b.wp_modus_strom_funktionsfremd_abzug,
    )
    je_funktion = arbeitszahl_je_funktion(
        heizung_kwh=3000.0, strom_heizen_kwh=750.0,
        warmwasser_kwh=600.0, strom_warmwasser_kwh=200.0,
        hat_split=True,
    )
    assert gesamt.wert == pytest.approx(3.789, abs=0.001)
    assert je_funktion.heizen.wert == pytest.approx(4.00)
    assert je_funktion.warmwasser.wert == pytest.approx(3.00)


def test_n445_gegenprobe_ohne_f5_bleibt_der_abzug_richtig():
    """**Der W-14-Fall bleibt unangetastet.**

    Ohne getrennte Strommessung ist der Nenner `stromverbrauch_kwh` — der
    Zählerstand des ganzen Geräts, Kühlbetrieb **enthalten**. Dort ist der
    Abzug des abgeleiteten Kühlanteils richtig und muss es bleiben.
    """
    inv = SimpleNamespace(id=2, typ="waermepumpe", parameter={})
    daten = {
        "stromverbrauch_kwh": 1050.0,
        "heizenergie_kwh": 3000.0,
        "warmwasser_kwh": 600.0,
        "modus_strom_heizen_kwh": 800.0,
        "modus_strom_kuehlen_kwh": 100.0,
        "modus_abdeckung_h": 700.0,
    }
    b = imd_typ_beitrag(inv, daten)
    assert b.wp_strom == pytest.approx(1050.0)
    assert b.wp_hat_split is False
    assert b.wp_modus_strom_funktionsfremd_abzug == pytest.approx(100.0), (
        "Ohne getrennte Strommessung ist der Nenner der Zählerstand des "
        "ganzen Geräts — der Kühlbetrieb steckt darin, der Abzug bleibt (W-14)."
    )

    gesamt = arbeitszahl(
        3600.0, b.wp_strom,
        strom_funktionsfremd_kwh=b.wp_modus_strom_funktionsfremd_abzug,
    )
    assert gesamt.wert == pytest.approx(3.789, abs=0.001)


# ═══════════════════════════════════════════════════════════════════════════
# 4 · Die MISCHANLAGE — der Abzug fällt je Gerät, nie anlagenweit
# ═══════════════════════════════════════════════════════════════════════════
#
# ⭐ **Die Lage, die eine anlagenweite Entscheidung falsch machen würde** (K2:
# *„gemessen schlägt abgeleitet — je Gerät, ganz oder gar nicht"*). Eine Anlage
# darf ein F5-Gerät neben einem nicht-F5-Gerät haben; `WpFakten.hat_split` ist
# dort bereits ein `any(...)` über alle Wärmepumpen. Wer den Abzug erst auf
# dieser Ebene entscheidet, trifft immer eines der beiden Geräte falsch.
#
# Gemessen wird an `_RohMonat` — der Stelle, an der die Beiträge zusammenfließen
# und an der eine anlagenweite Fassung überhaupt erst formulierbar wäre.


def _misch_roh():
    """Zwei Wärmepumpen in einem Monat: eine mit F5, eine ohne."""
    roh = _RohMonat()
    roh.falte(_wp(), {
        "strom_heizen_kwh": 750.0,
        "strom_warmwasser_kwh": 200.0,
        "heizenergie_kwh": 3000.0,
        "warmwasser_kwh": 600.0,
        "modus_strom_heizen_kwh": 700.0,
        "modus_strom_warmwasser_kwh": 150.0,
        "modus_strom_kuehlen_kwh": 100.0,
        "modus_abdeckung_h": 700.0,
    })
    roh.falte(_wp_ohne_split(), {
        "stromverbrauch_kwh": 500.0,
        "heizenergie_kwh": 1200.0,
        "modus_strom_heizen_kwh": 440.0,
        "modus_strom_kuehlen_kwh": 60.0,
        "modus_abdeckung_h": 700.0,
    })
    return roh


def test_n445_mischanlage_der_abzug_faellt_je_geraet():
    """**60 statt 0 und statt 160** — nur das nicht-F5-Gerät steuert bei.

    * anlagenweit „hat_split" ⇒ 0 (das nicht-F5-Gerät verlöre seinen richtigen
      Abzug, W-14 fiele)
    * anlagenweit „kein hat_split" ⇒ 160 (das F5-Gerät bekäme die Kürzung, die
      Option A gerade abgeschafft hat)
    * je Gerät ⇒ **60**
    """
    roh = _misch_roh()

    assert roh.wp_hat_split is True, "anlagenweit ist die Lage nicht mehr trennbar"
    assert roh.wp_modus_strom_kuehlen == pytest.approx(160.0), (
        "Die MENGEN bleiben beide — sie tragen die Aufteilung (K1)."
    )
    assert roh.wp_modus_strom_funktionsfremd_abzug == pytest.approx(60.0), (
        "Nur das Gerät OHNE getrennte Strommessung steuert seinen Kühlanteil "
        "zum Abzug bei."
    )


def test_n445_mischanlage_die_gesamtzahl_der_anlage():
    """Die Zahl, die daraus entsteht — an den Einzelwerten belegt.

    Σ Wärme 4800 · Σ Strom 1450 (950 F5 + 500 Gesamtzähler) · Abzug 60.
    ⇒ 4800 ÷ 1390 = **3,45**. Mit anlagenweitem Abzug wären es 4800 ÷ 1290 =
    3,72, ohne jeden Abzug 4800 ÷ 1450 = 3,31.
    """
    roh = _misch_roh()

    assert roh.wp_waerme == pytest.approx(4800.0)
    assert roh.wp_strom == pytest.approx(1450.0)

    az = arbeitszahl(
        roh.wp_waerme, roh.wp_strom,
        strom_funktionsfremd_kwh=roh.wp_modus_strom_funktionsfremd_abzug,
    )
    assert az.nenner_kwh == pytest.approx(1390.0)
    assert az.wert == pytest.approx(3.453, abs=0.001)


def test_n445_mischanlage_am_tag_dieselbe_trennung():
    """Dieselbe Frage im Tagespfad — `falte_tages_stapel`, zwei Geräte.

    Ohne sie gälte die Je-Gerät-Regel nur für Monat und Jahr; der Tag hat
    seinen eigenen Stapel und hätte die Drift ein zweites Mal aufgemacht (F-56).
    """
    stapel = falte_tages_stapel(
        {},
        {"1": TAG_POT_KWH, "2": 5.0},
        {
            "1": TAG_SPLIT,
            "2": ModusSplit(
                kwh_je_modus={HEIZEN: 3.0, KUEHLEN: 2.0},
                abdeckung_h=24.0, bezug_kwh=5.0,
            ),
        },
        {"1": _wp(), "2": _wp_ohne_split()},
        DATUM,
    )

    assert stapel.kuehlen_kwh == pytest.approx(5.0)            # 3,0 + 2,0
    assert stapel.funktionsfremd_abzug_kwh == pytest.approx(2.0), (
        "Nur das Gerät ohne getrennte Strommessung steuert bei."
    )
