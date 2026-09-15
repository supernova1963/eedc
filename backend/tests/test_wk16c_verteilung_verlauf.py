"""**Verteilung & Verlauf** — der Wärme/Klima-Strom je Gerät und Funktion (WK-16c).

## Die Frage, die dieser Blockteil beantwortet

*„Wohin ist der Strom meiner Wärme/Klima-Geräte gegangen — und was hat es
gekostet?"* Anlass war der Vergleich mit dietmar1968s selbstgebautem Dashboard
(14.09.2026): Es zeigt einen Donut *Heizung · Warmwasser · Klima Heizen · Klima
Kühlen · Systemverbrauch* und daneben eine Kostentabelle. Auf **derselben**
Datenlage konnte eedc das schon rechnen — es hat es nur nirgends gezeigt.

## Was hier geprüft wird

| Teil | Gegenstand |
| --- | --- |
| **A** | Der Layer: welche Funktion welche Kilowattstunden bekommt, und welche Familie gilt (K2 · K3 · K4 · K5) |
| **B** | Die **zwei Reste** — Zähler-Rest (*System/Standby*) und Modus-Rest (*Ohne Modus*), getrennt benannt und **nie addiert** |
| **C** | Der Dienst: Σ Segmente = Menge, Anteile, Zeitfilter, Schwelle |
| **D** | **Kosten je Funktion** = kWh × Tarif des Monats (P8) — je Monat gerechnet, über das Jahr gewichtet |
| **E** | Temperatur und Wettersymbol je Periode |

⛔ **Was hier NICHT geprüft wird:** die Stundenstufe an einer echten Standreihe.
Sie braucht Snapshots je Zähler und ist damit eine Probe des Tagespfads, nicht
dieser Fläche — dort halten ``test_waerme_verlauf_stunden.py`` und
``test_tages_stapel_gemessen_verdraengt_abgeleitet.py`` die Verteilung auf 24
Slots. Was WK-16c daran neu macht, ist die **Aufschlüsselung je Gerät**
(``StundenVerteilung.je_geraet``), und die ist hier an ihrer Invariante geprüft:
Σ über die Geräte ist bitgleich der bisherige anlagenweite Stapel.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select

from backend.core.berechnungen.tages_stapel import (
    STUNDEN,
    GeraeteBeitrag,
    StundenFormen,
    verteile_tages_stapel_auf_stunden,
)
from backend.core.berechnungen.waerme_verteilung import (
    FAMILIE_KEINE,
    FAMILIE_SUMMANDEN,
    FAMILIE_TEILMENGEN,
    FUNKTION_ENTFEUCHTEN,
    FUNKTION_HEIZEN,
    FUNKTION_KUEHLEN,
    FUNKTION_LABEL,
    FUNKTION_LUEFTEN,
    FUNKTION_OHNE_MODUS,
    FUNKTION_SYSTEM,
    FUNKTION_WARMWASSER,
    GeraetStromEingabe,
    anteile_prozent,
    verteile_geraet_strom,
)
from backend.models import (  # noqa: F401
    Anlage, Investition, InvestitionMonatsdaten, Monatsdaten,
)
from backend.models.strompreis import Strompreis
from backend.models.tages_energie_profil import (
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.waerme_verteilung import lade_verteilung_verlauf

#: Luft-Wasser-Wärmepumpe mit getrennter Strommessung (Sprosse **F5**).
LW_F5 = {"wp_art": "luft_wasser", "getrennte_strommessung": True}
#: Split-Klimaanlage ohne getrennte Strommessung — sie teilt über den Modus auf.
LL = {"wp_art": "luft_luft"}

JAHR = 2025


def _eingabe_aus_zeile(zeile: dict, params: dict) -> GeraetStromEingabe:
    """Die Tür, die auch der Dienst nimmt — nicht eine nachgebaute daneben."""
    from backend.services.waerme_verteilung import _eingabe_aus_monatszeile

    class _Inv:
        id = 1
        bezeichnung = "WP"
        parameter = params

    return _eingabe_aus_monatszeile(_Inv(), zeile)


# ═══════════════════════════════════════════════════════════════════════════
# A · Der Layer — welche Familie, welche Segmente
# ═══════════════════════════════════════════════════════════════════════════


def test_a1_summanden_familie_die_achsen_und_der_systemrest():
    """**dietmar1968s Lage in einer Zeile:** zwei Achsen, ein Gesamtzähler darüber.

    Gesamtzähler 1145 · Heizen 750 · Warmwasser 200 ⇒ Heizen und Warmwasser
    stehen als **Summanden**, die Differenz von 195 kWh heißt *System/Standby*
    (K5, WK-16d). Σ der Segmente ist die Menge — ohne Rest fehlten die 195 kWh
    in Bild **und** Kostentabelle.
    """
    v = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 1145.0,
         "strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0},
        LW_F5,
    ))
    assert v.familie == FAMILIE_SUMMANDEN
    assert v.je_funktion == {
        FUNKTION_HEIZEN: 750.0,
        FUNKTION_WARMWASSER: 200.0,
        FUNKTION_SYSTEM: 195.0,
    }
    assert v.herkunft_je_funktion[FUNKTION_HEIZEN] == "gemessen"
    assert v.herkunft_je_funktion[FUNKTION_SYSTEM] == "rest"
    assert v.aufgeteilt_kwh == v.menge_kwh == 1145.0


def test_a2_ohne_gesamtzaehler_gibt_es_keinen_systemrest():
    """**Ein Rest setzt eine Aufteilung *und* eine größere Menge voraus.**

    Ohne Gesamtzähler ist die Menge die Summe der Achsen (K3/Regel 3) — es
    bleibt nichts übrig. Ein Segment *System/Standby 0 kWh* wäre eine Größe im
    Bild, die es nicht gibt.
    """
    v = verteile_geraet_strom(_eingabe_aus_zeile(
        {"strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0}, LW_F5,
    ))
    assert v.familie == FAMILIE_SUMMANDEN
    assert FUNKTION_SYSTEM not in v.je_funktion
    assert v.aufgeteilt_kwh == 950.0


def test_a3_k4_ein_gemessener_kuehlzaehler_steht_neben_den_achsen():
    """**K4: Summanden und Teilmengen schließen einander nicht aus.**

    Eine kühlfähige Luft-Wasser-Wärmepumpe mit getrennten Zählern **und**
    Kühlzähler: Der Kühlstrom ist eine gemessene Teilmenge und steht als
    eigenes Segment — er ist nicht Teil von *Heizen*, und der Systemrest
    schrumpft entsprechend (1145 − 750 − 200 − 100 = 95).
    """
    v = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 1145.0,
         "strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0,
         "betriebsart_strom_kuehlen_kwh": 100.0},
        LW_F5,
    ))
    assert v.je_funktion[FUNKTION_KUEHLEN] == 100.0
    assert v.herkunft_je_funktion[FUNKTION_KUEHLEN] == "gemessen"
    assert v.je_funktion[FUNKTION_SYSTEM] == 95.0
    assert sum(v.je_funktion.values()) == v.menge_kwh


def test_a4_ein_abgeleiteter_split_wird_neben_den_achsen_nicht_gezeigt():
    """⛔ **Die Doppelzählung, gegen die W-16b gebaut ist.**

    Ein aus dem Betriebsmodus **abgeleiteter** Split verteilt die Menge, die
    die Achsen schon tragen. Erschiene er daneben, stünde derselbe Strom
    zweimal im selben Balken — und die Anteile summierten sich auf über 100 %.
    Gemessen wird das an der Gegenprobe darunter: dieselbe Zeile **ohne** das
    Kennzeichen zeigt den Split sehr wohl.
    """
    zeile = {
        "stromverbrauch_kwh": 1000.0,
        "strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0,
        "modus_strom_heizen_kwh": 600.0, "modus_strom_kuehlen_kwh": 300.0,
        "modus_abdeckung_h": 700.0,
    }
    mit_achsen = verteile_geraet_strom(_eingabe_aus_zeile(zeile, LW_F5))
    assert mit_achsen.familie == FAMILIE_SUMMANDEN
    assert FUNKTION_KUEHLEN not in mit_achsen.je_funktion
    assert sum(mit_achsen.je_funktion.values()) == 1000.0

    ohne_kennzeichen = verteile_geraet_strom(_eingabe_aus_zeile(zeile, LL))
    assert ohne_kennzeichen.familie == FAMILIE_TEILMENGEN
    assert ohne_kennzeichen.je_funktion[FUNKTION_KUEHLEN] == 300.0


def test_a5_teilmengen_familie_traegt_ihre_herkunft():
    """Eine Split-Klimaanlage teilt über den **Modus** auf — und sagt es.

    Die Segmente tragen die Marke *abgeleitet*; der Rest heißt *Ohne Modus*
    (die Stunden ohne Signal), nicht *System/Standby*. Dass beide Reste
    verschiedene Namen haben, ist der Kern von Konzept Kap. 3.
    """
    v = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 100.0,
         "modus_strom_heizen_kwh": 40.0, "modus_strom_kuehlen_kwh": 25.0,
         "modus_abdeckung_h": 600.0},
        LL,
    ))
    assert v.familie == FAMILIE_TEILMENGEN
    assert v.je_funktion == {
        FUNKTION_HEIZEN: 40.0, FUNKTION_KUEHLEN: 25.0, FUNKTION_OHNE_MODUS: 35.0,
    }
    assert v.herkunft_je_funktion[FUNKTION_HEIZEN] == "abgeleitet"
    assert v.herkunft_je_funktion[FUNKTION_OHNE_MODUS] == "rest"


def test_a6_e4_lueften_und_entfeuchten_bekommen_ihr_segment():
    """**E4:** Wer einen Lüftungs- oder Entfeuchtungs-Zähler pflegt, sieht ihn.

    Ohne solche Zähler steckt derselbe Strom weiterhin im Rest — das ist die
    Aussage, nicht eine Lücke (Konzept §2.3: *„Wer sie nicht erfasst, sieht sie
    nicht"*).
    """
    v = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 100.0,
         "betriebsart_strom_heizen_kwh": 40.0,
         "betriebsart_strom_lueften_kwh": 12.0,
         "betriebsart_strom_entfeuchten_kwh": 8.0},
        LL,
    ))
    assert v.je_funktion[FUNKTION_LUEFTEN] == 12.0
    assert v.je_funktion[FUNKTION_ENTFEUCHTEN] == 8.0
    assert v.herkunft_je_funktion[FUNKTION_LUEFTEN] == "gemessen"
    assert v.je_funktion[FUNKTION_OHNE_MODUS] == 40.0


def test_a7_ohne_jeden_weg_gibt_es_keine_aufteilung_aber_eine_menge():
    """**K1 bleibt, auch wo nichts aufzuteilen ist.**

    Ein Gerät mit nur einem Gesamtzähler hat eine Menge und kein Segment. Sie
    als *„Ohne Modus 100 %"* zu zeigen wäre eine Aufteilung, die niemand
    gemessen hat — die Differenz wird stattdessen **genannt**
    (*„Aufgeteilte Menge X von Y kWh"*, W-17b).
    """
    v = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 100.0}, LL,
    ))
    assert v.familie == FAMILIE_KEINE
    assert v.je_funktion == {}
    assert v.menge_kwh == 100.0 and v.aufgeteilt_kwh == 0.0


def test_a8_eine_gemessene_null_ist_eine_messung_aber_kein_segment():
    """Ein Warmwasser-Strom von 0,0 im Sommer **belegt die Achse** (er lässt den
    Rest entstehen) und ist trotzdem **kein Balken**: Ein Segment der Höhe 0
    sähe aus wie *„hier lief nichts"*, während die Achse sagt *„hier lief
    nichts, und das ist gemessen"*. Die Unterscheidung steht an genau dieser
    Stelle — ``wp_nicht_aufgeteilt_kwh`` fragt ``is not None``, die
    Segmentbildung ``> 0``.
    """
    v = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 100.0, "strom_warmwasser_kwh": 0.0}, LW_F5,
    ))
    assert FUNKTION_WARMWASSER not in v.je_funktion
    assert v.je_funktion == {FUNKTION_SYSTEM: 100.0}


def test_a10_tag_und_monat_bilden_denselben_rest_aus_denselben_zahlen():
    """⭐ **Zwei Mengen-Herkünfte, eine Formel** (F-56/N-450).

    Der Tag hat keine ``verbrauch_daten``-Zeile — er faltet Snapshots. Er ruft
    deshalb nicht ``wp_strom_aufteilung``, sondern dessen beide Formeln einzeln
    (``wp_feine_summe_kwh`` · ``wp_nicht_aufgeteilt_kwh``). **Dieselben Zahlen
    müssen durch beide Türen zu derselben Verteilung führen**; täten sie es
    nicht, nennte Cockpit → Tag einen anderen Systemverbrauch als der Monat
    darüber, und beide sähen richtig aus.
    """
    from backend.services.waerme_verteilung import eingabe_aus_tageswerten

    class _Inv:
        id = 1
        bezeichnung = "WP"
        parameter = LW_F5

    aus_monat = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 10.0,
         "strom_heizen_kwh": 7.0, "strom_warmwasser_kwh": 2.0},
        LW_F5,
    ))
    aus_tag = verteile_geraet_strom(eingabe_aus_tageswerten(
        _Inv(), menge_kwh=10.0,
        strom_heizen_kwh=7.0, strom_warmwasser_kwh=2.0, beitrag=None,
    ))
    assert aus_tag.je_funktion == aus_monat.je_funktion == {
        FUNKTION_HEIZEN: 7.0, FUNKTION_WARMWASSER: 2.0, FUNKTION_SYSTEM: 1.0,
    }
    assert aus_tag.familie == aus_monat.familie == FAMILIE_SUMMANDEN


def test_a9_anteile_beziehen_sich_auf_die_aufgeteilte_menge():
    """Der Bezug ist Absicht (W-17b): Ein Gerät ohne Aufteilung steht in keinem
    Segment; es am Nenner zu beteiligen ergäbe Anteile, die sich nicht zu 100 %
    summieren, ohne dass irgendwo stünde, warum."""
    anteile = anteile_prozent({"a": 75.0, "b": 25.0})
    assert anteile == {"a": 75.0, "b": 25.0}
    assert round(sum(anteile.values()), 6) == 100.0


# ═══════════════════════════════════════════════════════════════════════════
# B · Die zwei Reste — getrennt benannt, nie addiert
# ═══════════════════════════════════════════════════════════════════════════


def test_b1_die_zwei_reste_heissen_verschieden():
    """⛔ **Zwei Aufteilungen derselben Menge, zwei Reste** (Konzept Kap. 3).

    *System/Standby* ist der Zähler-Rest (Gesamtzähler − Achsen), *Ohne Modus*
    der Modus-Rest (Stunden ohne Signal). Sie im selben Bild beide
    *„Nicht aufgeteilt"* zu nennen hieße, zwei verschiedene Sachverhalte unter
    einem Namen zu führen — und der Anwender addierte sie.
    """
    assert FUNKTION_LABEL[FUNKTION_SYSTEM] == "System/Standby"
    assert FUNKTION_LABEL[FUNKTION_OHNE_MODUS] == "Ohne Modus"
    assert FUNKTION_LABEL[FUNKTION_SYSTEM] != FUNKTION_LABEL[FUNKTION_OHNE_MODUS]


def test_b2_ein_geraet_traegt_genau_eine_familie_und_damit_einen_rest():
    """**Sie können an einem Gerät nicht gleichzeitig auftreten** — die Familie
    ist alles-oder-nichts (K2). Beide zusammen entstehen nur, wenn zwei
    **Geräte** verschiedene Wege gehen, und dann stehen sie getrennt im Bild."""
    summanden = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 1000.0, "strom_heizen_kwh": 800.0,
         "modus_strom_heizen_kwh": 600.0, "modus_abdeckung_h": 700.0},
        LW_F5,
    ))
    assert FUNKTION_SYSTEM in summanden.je_funktion
    assert FUNKTION_OHNE_MODUS not in summanden.je_funktion

    teilmengen = verteile_geraet_strom(_eingabe_aus_zeile(
        {"stromverbrauch_kwh": 1000.0,
         "modus_strom_heizen_kwh": 600.0, "modus_abdeckung_h": 700.0},
        LL,
    ))
    assert FUNKTION_OHNE_MODUS in teilmengen.je_funktion
    assert FUNKTION_SYSTEM not in teilmengen.je_funktion


def test_b3_die_geraete_stunden_summieren_sich_zum_anlagenstapel():
    """``StundenVerteilung.je_geraet`` ist **dieselbe** Rechnung, eine Stufe früher.

    Wäre sie eine zweite, könnte sie abweichen — und niemand wüsste, welche der
    beiden Zahlen der Balken darüber meint. Gemessen an zwei Geräten mit
    verschiedenen Modus-Formen.
    """
    from backend.core.berechnungen.modus_split import ModusStunde
    from backend.core.betriebsmodus import HEIZEN, KUEHLEN

    beitraege = [
        GeraeteBeitrag(inv_id="1", gemessen=False, bezug_kwh=24.0,
                       heizen_kwh=12.0, nicht_aufgeteilt_kwh=12.0, abdeckung_h=24.0),
        GeraeteBeitrag(inv_id="2", gemessen=False, bezug_kwh=10.0,
                       kuehlen_kwh=10.0, abdeckung_h=10.0),
    ]
    formen = StundenFormen(modus_stunden_je_inv={
        "1": [ModusStunde(stunde=h, modus=(HEIZEN if h < 12 else None), kwh=1.0)
              for h in range(STUNDEN)],
        "2": [ModusStunde(stunde=h, modus=KUEHLEN, kwh=1.0) for h in range(10)],
    })
    v = verteile_tages_stapel_auf_stunden(beitraege, formen)

    assert set(v.je_geraet) == {"1", "2"}
    for h in range(STUNDEN):
        summe_geraete = sum(v.je_geraet[i][h].heizen_kwh for i in v.je_geraet)
        assert abs(summe_geraete - v.stunden[h].heizen_kwh) < 1e-9
        summe_kuehlen = sum(v.je_geraet[i][h].kuehlen_kwh for i in v.je_geraet)
        assert abs(summe_kuehlen - v.stunden[h].kuehlen_kwh) < 1e-9


# ═══════════════════════════════════════════════════════════════════════════
# C/D/E · Der Dienst an einer echten Anlage
# ═══════════════════════════════════════════════════════════════════════════


async def _anlage(db, *, geraete, zeilen_je_monat, tarife=((30.0, date(2025, 1, 1), None),),
                 name="Verteilung") -> Anlage:
    """Anlage · Geräte · Monatszeilen · Tarif — die Fixture der Dienst-Proben.

    ``zeilen_je_monat`` ist ``{monat: [zeile_je_geraet, …]}``; ``None`` heißt
    „dieses Gerät hat in diesem Monat keine Zeile".
    """
    anlage = Anlage(anlagenname=name, leistung_kwp=10.0,
                    installationsdatum=date(2025, 1, 1))
    db.add(anlage)
    await db.flush()
    for cent, ab, bis in tarife:
        db.add(Strompreis(
            anlage_id=anlage.id, netzbezug_arbeitspreis_cent_kwh=cent,
            einspeiseverguetung_cent_kwh=8.0, grundpreis_euro_monat=10.0,
            gueltig_ab=ab, gueltig_bis=bis, verwendung="allgemein",
        ))
    invs = []
    for i, (parameter, extra) in enumerate(geraete, start=1):
        inv = Investition(
            anlage_id=anlage.id, typ="waermepumpe", bezeichnung=f"Gerät {i}",
            anschaffungsdatum=date(2025, 1, 1),
            anschaffungskosten_gesamt=20000.0,
            parameter=dict(parameter), **(extra or {}),
        )
        db.add(inv)
        invs.append(inv)
    await db.flush()
    for monat, zeilen in zeilen_je_monat.items():
        db.add(Monatsdaten(anlage_id=anlage.id, jahr=JAHR, monat=monat,
                           einspeisung_kwh=100.0, netzbezug_kwh=100.0))
        for inv, zeile in zip(invs, zeilen):
            if zeile is None:
                continue
            db.add(InvestitionMonatsdaten(
                investition_id=inv.id, jahr=JAHR, monat=monat,
                verbrauch_daten=dict(zeile), source_provenance={},
            ))
    await db.commit()
    return anlage


async def test_c1_die_segmente_summieren_sich_zur_menge(db):
    """**Die Nachmessung in einem Satz:** Σ Anteile = aufgeteilte Menge, und die
    ist hier die Gesamtmenge — zwei Geräte, zwei Familien, vier Segmente.

    Wärmepumpe (F5, Gesamtzähler 380 = 343,3 + 36,7) und Klimaanlage
    (Betriebsart-Zähler 37,5 von 46,7) — die Lage der Demo r28 im Januar.
    """
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None), (LL, None)],
        zeilen_je_monat={1: [
            {"stromverbrauch_kwh": 380.0,
             "strom_heizen_kwh": 343.3, "strom_warmwasser_kwh": 36.7},
            {"stromverbrauch_kwh": 46.7,
             "betriebsart_strom_heizen_kwh": 37.5, "modus_abdeckung_h": 684.5},
        ]},
    )
    v = await lade_verteilung_verlauf(db, anlage, sicht="monat", jahr=JAHR, monat=1)

    assert v.stufe == "tag"
    werte = {(s.geraet, s.funktion): s.kwh for s in v.segmente}
    assert werte == {
        ("Gerät 1", FUNKTION_HEIZEN): 343.3,
        ("Gerät 1", FUNKTION_WARMWASSER): 36.7,
        ("Gerät 2", FUNKTION_HEIZEN): 37.5,
        ("Gerät 2", FUNKTION_OHNE_MODUS): 9.2,
    }
    assert v.menge_kwh == v.aufgeteilt_kwh == 426.7
    # ⚠ Gerundete Anteile summieren sich nicht exakt auf 100 — die Summe der
    # **Mengen** tut es (Zeile darüber). Wer die gerundeten Prozente zur
    # Kontrolle addiert, prüft die Rundung, nicht die Rechnung.
    assert abs(sum(s.anteil_prozent for s in v.segmente) - 100.0) <= 0.2
    # ⚠ Der Gesamtzähler der Wärmepumpe steht **exakt** auf der Summe ihrer
    # Achsen — ein Fließkomma-Rest von 1e-13 darf kein Segment werden.
    assert FUNKTION_SYSTEM not in {s.funktion for s in v.segmente}


async def test_c2_ein_geraet_ohne_aufteilung_steht_in_keinem_segment(db):
    """**W-17b, hier gemessen:** Die Differenz wird genannt, nicht verteilt.

    Ein zweites Gerät ohne jeden Aufteilungs-Zähler trägt seine 200 kWh zur
    Menge bei und zu keinem Segment. Ohne diese Trennung erschienen sie als
    *„Ohne Modus"* beim **falschen** Gerät (an einer Instanz gemessen: 96,4
    statt 6,4 kWh).
    """
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None), (LL, None)],
        zeilen_je_monat={1: [
            {"stromverbrauch_kwh": 100.0, "strom_heizen_kwh": 100.0},
            {"stromverbrauch_kwh": 200.0},
        ]},
    )
    v = await lade_verteilung_verlauf(db, anlage, sicht="monat", jahr=JAHR, monat=1)
    assert v.menge_kwh == 300.0
    assert v.aufgeteilt_kwh == 100.0
    assert [s.geraet for s in v.segmente] == ["Gerät 1"]


async def test_c3_das_jahr_summiert_die_monate_und_zeigt_sie_als_perioden(db):
    """**Beim Jahr sind Verteilung und Verlauf dieselben Zeilen** — Σ der zwölf
    Perioden ist die Verteilung darüber, auf die Stelle. (Bei Monat und Tag ist
    das bewusst anders: dort kommen die Perioden aus dem Snapshot-Pfad.)"""
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None)],
        zeilen_je_monat={
            1: [{"stromverbrauch_kwh": 100.0, "strom_heizen_kwh": 90.0,
                 "strom_warmwasser_kwh": 10.0}],
            7: [{"stromverbrauch_kwh": 20.0, "strom_heizen_kwh": 0.0,
                 "strom_warmwasser_kwh": 20.0}],
        },
    )
    v = await lade_verteilung_verlauf(db, anlage, sicht="jahr", jahr=JAHR)

    assert v.stufe == "monat"
    assert len(v.perioden) == 12
    assert [p.label for p in v.perioden][:2] == ["Jan", "Feb"]
    werte = {s.funktion: s.kwh for s in v.segmente}
    assert werte == {FUNKTION_HEIZEN: 90.0, FUNKTION_WARMWASSER: 30.0}
    assert v.verlauf_kwh == v.aufgeteilt_kwh == 120.0
    # Der Juli trägt eine gemessene 0 im Heizstrom — sie ist kein Segment.
    juli = next(p for p in v.perioden if p.label == "Jul")
    assert set(juli.kwh_je_segment) == {s.schluessel for s in v.segmente
                                        if s.funktion == FUNKTION_WARMWASSER}


async def test_c4_stillgelegt_zaehlt_im_januar_und_nicht_im_dezember(db):
    """**#236/#239: Anschaffungs- und Stilllegungsdatum sind die Grenze.**

    Ein im März stillgelegtes Gerät gehört in den Januar-Balken und in keinen
    Dezember — auch wenn eine Monatszeile für den Dezember existiert (Import,
    Altbestand). Ohne den Filter stünde ein Gerät im Bild, das es nicht mehr gab.
    """
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, {"stilllegungsdatum": date(2025, 3, 31)})],
        zeilen_je_monat={
            1: [{"stromverbrauch_kwh": 100.0, "strom_heizen_kwh": 100.0}],
            12: [{"stromverbrauch_kwh": 80.0, "strom_heizen_kwh": 80.0}],
        },
    )
    v = await lade_verteilung_verlauf(db, anlage, sicht="jahr", jahr=JAHR)
    assert v.aufgeteilt_kwh == 100.0
    assert next(p for p in v.perioden if p.label == "Dez").kwh_je_segment == {}


async def test_c5_ein_rest_unter_der_anzeigegenauigkeit_ist_kein_segment(db):
    """**Ein Segment, das als „0,0 kWh" dasteht, behauptet eine Größe, die es
    nicht gibt.**

    Gesamtzähler 100,004 neben einer Achse von 100,0: Der Rest ist rechnerisch
    da (4 Wh) und unterhalb jeder Anzeigegenauigkeit. Er erschiene als Zeile
    *System/Standby 0,0 kWh · 0 %* im Balken **und** als Kostenzeile über
    0,00 € — drei Stellen, an denen ein Anwender nach einer Größe sucht, die
    eine Rundung ist. Die **Menge** bleibt davon unberührt (K1): sie steht
    weiter auf 100,004.
    """
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None)],
        zeilen_je_monat={1: [{"stromverbrauch_kwh": 100.004,
                              "strom_heizen_kwh": 100.0}]},
    )
    v = await lade_verteilung_verlauf(db, anlage, sicht="monat", jahr=JAHR, monat=1)
    assert [s.funktion for s in v.segmente] == [FUNKTION_HEIZEN]
    assert v.menge_kwh == 100.0   # gerundet auf zwei Stellen — die Menge bleibt
    assert v.aufgeteilt_kwh == 100.0


async def test_d1_kosten_sind_kwh_mal_tarif_des_monats(db):
    """**Kosten je Funktion, nachgerechnet von Hand** (ADR-002/**P8**).

    Januar 343,3 kWh × 30,0 ct = **102,99 €**; Warmwasser 36,7 × 0,30 =
    **11,01 €**. Die Summe ist der Zeitraum-Betrag, und sie ist zugleich die
    Menge × Preis — wäre sie es nicht, stünde in der Tabelle eine Zahl, die
    keine Zeile trägt.
    """
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None)],
        zeilen_je_monat={1: [{"stromverbrauch_kwh": 380.0,
                              "strom_heizen_kwh": 343.3,
                              "strom_warmwasser_kwh": 36.7}]},
    )
    v = await lade_verteilung_verlauf(db, anlage, sicht="monat", jahr=JAHR, monat=1)
    kosten = {s.funktion: s.kosten_euro for s in v.segmente}
    assert kosten == {FUNKTION_HEIZEN: 102.99, FUNKTION_WARMWASSER: 11.01}
    assert all(s.preis_cent == 30.0 for s in v.segmente)
    assert v.kosten_gesamt_euro == 114.0
    assert round(426.7 * 0.30 - 128.01, 6) == 0.0  # Gegenrechnung der Gesamtmenge


async def test_d2_zwei_monate_zwei_tarife_ein_gewichteter_preis(db):
    """⭐ **Ein Tarif-Wert trägt den Stichtag seines Monats** (P8), und das Jahr
    trägt keinen einzelnen.

    Januar 100 kWh zu 30 ct = 30 €, Juli 100 kWh zu 40 ct = 40 €; das Jahr
    zeigt **70 €** und als Preis den **mengengewichteten** Wert 35 ct — damit
    ``kWh × Preis = Kosten`` auch über das Jahr aufgeht (A6). Ein herausgegriffener
    Monatspreis wäre eine Behauptung über die anderen elf.
    """
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None)],
        zeilen_je_monat={
            1: [{"stromverbrauch_kwh": 100.0, "strom_heizen_kwh": 100.0}],
            7: [{"stromverbrauch_kwh": 100.0, "strom_heizen_kwh": 100.0}],
        },
        tarife=((30.0, date(2025, 1, 1), date(2025, 6, 30)),
                (40.0, date(2025, 7, 1), None)),
    )
    v = await lade_verteilung_verlauf(db, anlage, sicht="jahr", jahr=JAHR)
    zeile = next(s for s in v.segmente if s.funktion == FUNKTION_HEIZEN)
    assert zeile.kosten_euro == 70.0
    assert zeile.preis_cent == 35.0
    assert round(zeile.kwh * zeile.preis_cent / 100.0, 2) == zeile.kosten_euro


async def test_e1_temperatur_und_wettersymbol_je_periode(db):
    """**Das Wettersymbol ist der HÄUFIGSTE Code der Periode**, nicht der
    schlechteste Moment.

    Ein Januartag mit zwanzig klaren Stunden und vier Regenstunden ist ein
    klarer Tag. Open-Meteos Tages-Code neigt zur Gegenrichtung; hier liegen alle
    Stunden vor, und der Modus der Reihe ist die einfachere und ehrlichere
    Antwort. Die Temperatur ist das Mittel derselben Stunden.
    """
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None)],
        zeilen_je_monat={1: [{"stromverbrauch_kwh": 100.0,
                              "strom_heizen_kwh": 100.0}]},
    )
    inv_id = (await db.execute(select(Investition.id))).scalars().first()
    for stunde in range(24):
        db.add(TagesEnergieProfil(
            anlage_id=anlage.id, datum=date(JAHR, 1, 15), stunde=stunde,
            temperatur_c=2.0 if stunde < 12 else 4.0,
            wetter_code=61 if stunde < 4 else 0,
        ))
    # Ohne Tageszeile gäbe es die Periode gar nicht — der Verlauf des Monats
    # kommt aus dem Snapshot-Pfad, nicht aus der Monatszeile (s. Modulkopf des
    # Dienstes). Die Temperatur allein macht keine Zeile.
    db.add(TagesZusammenfassung(
        anlage_id=anlage.id, datum=date(JAHR, 1, 15),
        komponenten_kwh={f"waermepumpe_{inv_id}": 3.0},
    ))
    await db.commit()

    monat = await lade_verteilung_verlauf(db, anlage, sicht="monat", jahr=JAHR, monat=1)
    tag = next(p for p in monat.perioden if p.schluessel == f"{JAHR}-01-15")
    assert tag.temperatur_c == 3.0
    assert tag.wetter_symbol == "sunny"

    jahr = await lade_verteilung_verlauf(db, anlage, sicht="jahr", jahr=JAHR)
    januar = next(p for p in jahr.perioden if p.label == "Jan")
    assert januar.temperatur_c == 3.0
    assert januar.wetter_symbol == "sunny"

    stunden = await lade_verteilung_verlauf(
        db, anlage, sicht="tag", datum=date(JAHR, 1, 15),
    )
    assert stunden.perioden[0].wetter_symbol == "rainy"   # Stunde 0 direkt
    assert stunden.perioden[12].wetter_symbol == "sunny"
    assert stunden.perioden[12].temperatur_c == 4.0


async def test_e2_ohne_wettercode_kein_symbol(db):
    """**Kein Symbol ist besser als ein erfundenes.** ``wetter_code_zu_symbol``
    liefert für ``None`` die Zeichenkette ``"unknown"``, und der Client zeichnet
    dafür die Default-Sonne — eine Behauptung über einen Tag, von dem eedc
    nichts weiß. Deshalb bleibt das Feld hier leer statt „unknown"."""
    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None)],
        zeilen_je_monat={1: [{"stromverbrauch_kwh": 100.0,
                              "strom_heizen_kwh": 100.0}]},
    )
    v = await lade_verteilung_verlauf(db, anlage, sicht="jahr", jahr=JAHR)
    assert all(p.wetter_symbol is None for p in v.perioden)


async def test_e3_die_route_liefert_dieselben_zahlen(db):
    """Die **echte Tür** — gerufen wird die Routenfunktion selbst.

    ⚠ **Nicht über HTTP, und das ist kein Abkürzen:** Der ASGI-Weg hinge an der
    Produktiv-Sitzung und sähe die Fixture-Anlage gar nicht. Was diese Probe
    sichern soll, ist die **Antwort-Schicht** — ein Feld, das der Dienst kennt
    und das Response-Modell nicht, wäre auf jeder Fläche unsichtbar (die
    Klasse, die N-348 ausgelöst hat). Genau die läuft hier mit.
    """
    from backend.api.routes.energie_profil.views import get_waerme_verteilung

    anlage = await _anlage(
        db,
        geraete=[(LW_F5, None)],
        zeilen_je_monat={1: [{"stromverbrauch_kwh": 380.0,
                              "strom_heizen_kwh": 343.3,
                              "strom_warmwasser_kwh": 36.7}]},
    )
    antwort = await get_waerme_verteilung(
        anlage.id, sicht="monat", jahr=JAHR, monat=1, datum=None, db=db,
    )
    assert antwort.sicht == "monat" and antwort.stufe == "tag"
    assert antwort.menge_kwh == 380.0
    assert {s.funktion: s.kosten_euro for s in antwort.segmente} == {
        FUNKTION_HEIZEN: 102.99, FUNKTION_WARMWASSER: 11.01,
    }
    assert antwort.segmente[0].funktion_label == "Heizen"
    assert antwort.verlauf_kwh == 0.0   # keine Tageszeilen in dieser Fixture


async def test_e4_unbekannte_sicht_wird_abgewiesen(db):
    """Eine Route, die alles annimmt, liefert irgendwann eine Antwort zu einer
    Frage, die niemand gestellt hat."""
    from fastapi import HTTPException

    from backend.api.routes.energie_profil.views import get_waerme_verteilung

    anlage = await _anlage(
        db, geraete=[(LW_F5, None)],
        zeilen_je_monat={1: [{"stromverbrauch_kwh": 10.0}]},
    )
    for kwargs in (
        {"sicht": "woche", "jahr": JAHR},
        {"sicht": "monat", "jahr": JAHR},           # Monat fehlt
        {"sicht": "jahr"},                          # Jahr fehlt
        {"sicht": "tag"},                           # Datum fehlt
    ):
        voll = {"jahr": None, "monat": None, "datum": None, **kwargs}
        try:
            await get_waerme_verteilung(anlage.id, db=db, **voll)
        except HTTPException as fehler:
            assert fehler.status_code == 400, kwargs
        else:
            raise AssertionError(f"nicht abgewiesen: {kwargs}")
