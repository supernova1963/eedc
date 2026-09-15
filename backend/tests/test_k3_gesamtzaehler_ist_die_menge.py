"""**K3 Stufe 1 folgt K1** — der Gesamtzähler ist die Menge, die Achsen sind die
Aufteilung, der Rest heißt *nicht aufgeteilt* (WK-16d, 14.09.2026).

## Der Befund in einem Satz

``wp_strom_stufe`` hat bei **vollständiger** feiner Aufteilung den Gesamtzähler
verworfen — *„sonst zählte derselbe Strom zweimal"*. Der Satz stimmte für die
Doppelzählung und war für die **Menge** falsch: Misst der Gesamtzähler mehr als
die beiden Achsen zusammen — Standby, Steuerung, Umwälzpumpen; bei dietmar1968
**145 von 2193 kWh im Jahr**, 6,6 % —, verlor eedc diese Kilowattstunden aus
Strom, **Kosten**, **CO₂** und dem **Arbeitszahl-Nenner**. Das verletzt **K1**
(*„die Gesamtmenge ist immer die Wahrheit"*) und **K5** (*„der Rest heißt nicht
aufgeteilt"*). *Doppelzählung entsteht beim **Addieren**, nicht beim
**Ersetzen*** — die alte Regel verhinderte das Falsche und verwarf dabei eine
Messung.

## Die Regel, die jetzt gilt (Konzept Kap. 3, „K3 in einer Stelle")

| # | Lage | Menge | Rest |
| --- | --- | --- | --- |
| 1 | Gesamtzähler belegt, ≥ Σ Aufteilung | **der Gesamtzähler** (K1) | Gesamt − Σ, *nicht aufgeteilt* (K5) |
| 2 | Gesamtzähler belegt, < Σ Aufteilung − Toleranz | **die Achsen** | 0 — und der Daten-Checker **warnt** |
| 3 | kein Gesamtzähler | **die Achsen**, vollständig oder nicht | 0 |

Die **Toleranz** steht an einer Stelle
(``field_definitions.wp_strom_toleranz_kwh``) und gilt für die Rechnung **und**
den Checker: 1 % der Summe, mindestens 0,5 kWh im Monat / 0,05 kWh im Tag.

## Was diese Datei prüft, und was nicht

Sie prüft die **neue** Regel an ihren Kanten und über die echten Türen
(Monats-Fakten, Tages-Beitragsschicht, Daten-Checker, Datenquellen-Fläche).
Die **Bestandslagen i–viii** stehen unverändert in
``test_n451_monatspfad_k3.py``; sie sind mit diesem Bau nicht weggefallen,
sondern dort umgestellt worden.

⛔ **Eine Grenze, die dazugehört** (Konzept 10.3-Klasse): Der **Tag** entscheidet
an der **Zuordnung**, nicht am Wert — er sieht beim Bau der Beiträge keine
Zahlen und kann Regel 2 deshalb nicht anwenden. Ein zugeordneter Gesamtzähler,
der an einem Tag **nichts liefert**, lässt den Tageswert der Wärmepumpe leer,
statt auf die Achsen zurückzufallen. Das ist unverändert die Lage jedes Geräts
ohne vollständige Achse (seit Etappe 3, 26.08.2026) und keine neue Klasse; der
Rückfall bräuchte eine **n-gegen-1-Präzedenz** wie bei der PV
(``core/berechnungen/pv_tages_praezedenz.py``), weil die vorhandene
Either-Or-Auflösung 1-aus-n ist und von zwei Achsen eine verlöre.
``test_e2_…`` hält fest, was der **Monat** in dieser Lage tut — dort greift
Regel 5 des Konzepts vollständig, weil eine Zeile Werte hat.
"""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.core.berechnungen.waermepumpe_kennzahl import arbeitszahl
from backend.core.field_definitions import (
    WP_STROM_TOLERANZ_MIN_MONAT_KWH,
    WP_STROM_TOLERANZ_MIN_TAG_KWH,
    get_wp_strom_kwh,
    wp_strom_aufteilung,
    wp_strom_stufe,
    wp_strom_toleranz_kwh,
)
from backend.models import (  # noqa: F401
    Anlage, Investition, InvestitionMonatsdaten, Monatsdaten,
)
from backend.services.daten_checker import DatenChecker
from backend.services.snapshot.komponenten_beitraege import investition_beitraege

JAHR, MONAT = 2025, 6

#: Luft-Wasser-Wärmepumpe mit getrennter Strommessung — beide Achsen.
LW_F5 = {"wp_art": "luft_wasser", "getrennte_strommessung": True}
#: Split-Klimaanlage — **eine** Achse (kein Warmwasserkreis, N-304/B5).
LL_F5 = {"wp_art": "luft_luft", "getrennte_strommessung": True}
#: Dieselbe Wärmepumpe ohne das Kennzeichen.
LW_AUS = {"wp_art": "luft_wasser"}

#: Die Wärme über dem Strom — 3600 kWh, wie in Handbuch §6 B/B2.
WAERME = {"heizenergie_kwh": 3000.0, "warmwasser_kwh": 600.0}


class _Inv:
    """Das schlanke Double der Layer-Proben — Typ, Parameter, kein Parent."""

    def __init__(self, params: dict, inv_id: int = 7):
        self.id = inv_id
        self.typ = "waermepumpe"
        self.parameter = params
        self.parent_investition_id = None

    def ist_aktiv_an(self, _datum) -> bool:
        return True


def _tages_felder(params: dict, zugeordnet: set[str]) -> list[str]:
    """Welche Felder trägt der **Tagespfad** bei dieser Zuordnung?"""
    return [
        b.feld for b in investition_beitraege(
            _Inv(params), {}, ist_verfuegbar=lambda f: f in zugeordnet,
        )
    ]


async def _anlage_mit_wps(db, *, geraete: list[tuple[dict, dict]],
                          name: str) -> Anlage:
    """Anlage + je Gerät eine Wärmepumpe mit **einer** Monatszeile (Juni 2025).

    ``geraete`` ist ``[(parameter, zeile), …]`` — eine Liste, damit der
    Mischfall (zwei Geräte, zwei Zählerlagen) dieselbe Fixture nutzt wie der
    Einzelfall. Genau daran hing N-391b: Eine Regel, die je Gerät fällt, muss
    an **mehr als einem** Gerät geprüft werden.
    """
    anlage = Anlage(anlagenname=name, leistung_kwp=10.0,
                    installationsdatum=date(2025, 1, 1))
    db.add(anlage)
    await db.flush()
    for i, (parameter, zeile) in enumerate(geraete, start=1):
        inv = Investition(
            anlage_id=anlage.id, typ="waermepumpe", bezeichnung=f"WP{i}",
            anschaffungsdatum=date(2025, 1, 1),
            anschaffungskosten_gesamt=20000.0,
            parameter=dict(parameter),
        )
        db.add(inv)
        await db.flush()
        db.add(InvestitionMonatsdaten(
            investition_id=inv.id, jahr=JAHR, monat=MONAT,
            verbrauch_daten=dict(zeile), source_provenance={},
        ))
    db.add(Monatsdaten(anlage_id=anlage.id, jahr=JAHR, monat=MONAT,
                       einspeisung_kwh=200.0, netzbezug_kwh=150.0))
    await db.commit()
    return anlage


async def _wp_fakt(db, anlage_id):
    from backend.services.monats_fakten import lade_monats_fakten

    fakten = await lade_monats_fakten(
        db, anlage_id, von=(JAHR, MONAT), bis=(JAHR, MONAT),
    )
    assert fakten, "Der Monat fehlt ganz — die Fixture trägt nicht."
    return fakten[0].wp


async def _checker_meldungen(db, anlage_id) -> list[str]:
    """Die WP-Monatsmeldungen der echten Checker-Tür, je Gerät gesammelt."""
    geladen = (await db.execute(
        select(Anlage)
        .options(selectinload(Anlage.investitionen)
                 .selectinload(Investition.monatsdaten))
        .where(Anlage.id == anlage_id)
    )).scalar_one()
    monatsdaten = list((await db.execute(
        select(Monatsdaten).where(Monatsdaten.anlage_id == anlage_id)
    )).scalars().all())
    out: list[str] = []
    for inv in geladen.investitionen:
        if inv.typ != "waermepumpe":
            continue
        out += [
            e.meldung for e in DatenChecker(db)._check_wp_monatsdaten(
                inv, inv.bezeichnung, inv.parameter, monatsdaten,
            )
        ]
    return out


# ═══════════════════════════════════════════════════════════════════════════
# A · Regel 1 — der Gesamtzähler ist die Menge, der Rest heißt nicht aufgeteilt
# ═══════════════════════════════════════════════════════════════════════════


async def test_a1_gesamt_groesser_als_die_achsen_ist_die_menge(db):
    """**Der Befund selbst: 1145 statt 1050, Rest 95, Nenner 1045.**

    Handbuch §6 **B** mit einem Gesamtzähler daneben: Heizen 750 · Warmwasser
    200 · Kühlen 100 (gemessener Betriebsart-Zähler) = 1050 kWh Aufteilung, der
    Gesamtzähler steht auf 1145. Die 95 kWh Differenz sind der Systemverbrauch.

    * **Menge 1145** (K1) — vorher 1050; die 95 kWh fehlten in Strom, Kosten
      und CO₂.
    * **Rest 95** heißt *nicht aufgeteilt* (K5) und wird als solcher geführt.
    * **Nenner 1045 = 1145 − 100** (E7/Option A): Der Kühlstrom steckt im
      Gesamtzähler und muss abgezogen werden; der **Rest bleibt drin** —
      Standby gehört zur Wärmepumpe, und dietmar1968s eigene 3,25 enthält ihn.
    * Arbeitszahl **3,44** statt 3,79 — niedriger und ehrlicher.
    """
    zeile = {
        "stromverbrauch_kwh": 1145.0,
        "strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0,
        "betriebsart_strom_kuehlen_kwh": 100.0,
        **WAERME,
    }

    auf = wp_strom_aufteilung(zeile, LW_F5)
    assert auf.menge_kwh == pytest.approx(1145.0)
    assert auf.feine_summe_kwh == pytest.approx(1050.0)
    assert auf.nicht_aufgeteilt_kwh == pytest.approx(95.0)
    assert auf.stufe == "gesamt"

    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, zeile)], name="WK16d-A1")
    wp = await _wp_fakt(db, anlage.id)
    assert wp.strom_kwh == pytest.approx(1145.0)
    assert wp.strom_nicht_aufgeteilt_kwh == pytest.approx(95.0)
    assert wp.modus_strom_funktionsfremd_abzug_kwh == pytest.approx(100.0)

    az = arbeitszahl(
        wp.waerme_kwh, wp.strom_kwh,
        strom_funktionsfremd_kwh=wp.modus_strom_funktionsfremd_abzug_kwh,
    )
    assert az.nenner_kwh == pytest.approx(1045.0)
    assert az.wert == pytest.approx(3.444, abs=0.001)


async def test_a1c_der_abzug_folgt_der_neuen_stufe_auch_beim_abgeleiteten_split(db):
    """**E7/Option A zieht mit: Nenner 945 statt 1000, Arbeitszahl 3,81.**

    Dieselbe Lage wie A-1, nur mit **abgeleitetem** Split statt gemessenem
    Betriebsart-Zähler: Gesamtzähler 1145 über den Achsen 600 + 400, dazu ein
    Betriebsmodus-Sensor, der 200 kWh Kühlbetrieb ausweist.

    * **Vorher**: Menge 1000 (die Achsen), Nenner 1000, Arbeitszahl **3,60** —
      der Split verteilte die feine Summe, also wurde nichts abgezogen.
    * **Jetzt**: Menge 1145 (K1), und weil der Nenner der **Gesamtzähler** ist,
      steckt der Kühlstrom darin und muss abgezogen werden ⇒ 945, **3,81**.

    ⭐ **Die Probe hält die Kopplung fest, nicht nur die Zahl** (Klasse N-450:
    *„denselben Layer zu rufen genügt nicht, es müssen dieselben EINGÄNGE
    sein"*). Wer die Menge umstellt und den Abzug am Kennzeichen lässt, bekommt
    3600 ÷ 1145 = 3,14 — dieselbe Anlage, 18 % schlechter, ohne einen einzigen
    neuen Messwert. Gemessen: Sprengsatz **S9** macht genau diese Zeile rot.
    """
    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, {
        "stromverbrauch_kwh": 1145.0,
        "strom_heizen_kwh": 600.0, "strom_warmwasser_kwh": 400.0,
        "modus_strom_heizen_kwh": 800.0, "modus_strom_kuehlen_kwh": 200.0,
        "modus_abdeckung_h": 720.0,
        **WAERME,
    })], name="WK16d-A1c")

    wp = await _wp_fakt(db, anlage.id)
    assert wp.strom_kwh == pytest.approx(1145.0)
    assert wp.strom_nicht_aufgeteilt_kwh == pytest.approx(145.0), (
        "die Summanden-Achsen lassen 145 offen …"
    )
    assert wp.modus_nicht_aufgeteilt_kwh == pytest.approx(145.0), (
        "… und der Modus-Split ebenfalls — ZWEI Reste, hier zufällig gleich, "
        "weil die eine Aufteilung 1000 und die andere 1000 kWh zuordnet"
    )
    assert wp.modus_strom_funktionsfremd_abzug_kwh == pytest.approx(200.0)

    az = arbeitszahl(
        wp.waerme_kwh, wp.strom_kwh,
        strom_funktionsfremd_kwh=wp.modus_strom_funktionsfremd_abzug_kwh,
    )
    assert az.nenner_kwh == pytest.approx(945.0)
    assert az.wert == pytest.approx(3.81, abs=0.005)


def test_a1b_der_rest_setzt_eine_aufteilung_voraus():
    """**K5 wörtlich: „Rest" gibt es nur, wo es eine Aufteilung gibt.**

    Wer nur einen Gesamtzähler pflegt, hat keinen Rest, sondern **nur eine
    Menge**. Würde hier 1000 als *nicht aufgeteilt* erscheinen, läse sich das
    wie eine Diagnose („der Zähler misst Fremdes"), obwohl schlicht keine
    Achse gepflegt ist — dafür gibt es die Meldung *„Strom Heizen/Warmwasser
    fehlt"*, und zwei Hinweise auf denselben Sachverhalt sind Lärm.
    """
    nur_gesamt = wp_strom_aufteilung({"stromverbrauch_kwh": 1000.0}, LW_F5)
    assert nur_gesamt.menge_kwh == pytest.approx(1000.0)
    assert nur_gesamt.nicht_aufgeteilt_kwh == pytest.approx(0.0)

    mit_achse = wp_strom_aufteilung(
        {"stromverbrauch_kwh": 1000.0, "strom_heizen_kwh": 600.0}, LW_F5,
    )
    assert mit_achse.nicht_aufgeteilt_kwh == pytest.approx(400.0)


# ═══════════════════════════════════════════════════════════════════════════
# B · Gleichstand — bitgleich zu vorher
# ═══════════════════════════════════════════════════════════════════════════


async def test_b1_gesamt_gleich_der_summe_aendert_keine_zahl(db):
    """**Die Lage der Demo-Anlage: 180 = 154,8 + 25,2 — nichts bewegt sich.**

    ⭐ **Die wichtigste Probe für den Bestand.** In allen 28 Monatszeilen der
    Demo-Daikin (r27/r28) steht der Gesamtzähler exakt auf der Summe der beiden
    Achsen. Wer dort eine Zahl ändert, hat nicht K1 gebaut, sondern etwas
    anderes. Nur der **Träger** wechselt — und das ist unsichtbar, solange die
    Zahlen gleich sind.
    """
    zeile = {
        "stromverbrauch_kwh": 180.0,
        "strom_heizen_kwh": 154.8, "strom_warmwasser_kwh": 25.2,
        **WAERME,
    }
    auf = wp_strom_aufteilung(zeile, LW_F5)
    assert auf.menge_kwh == pytest.approx(180.0)
    assert auf.nicht_aufgeteilt_kwh == pytest.approx(0.0)

    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, zeile)], name="WK16d-B1")
    wp = await _wp_fakt(db, anlage.id)
    assert wp.strom_kwh == pytest.approx(180.0)
    assert wp.strom_nicht_aufgeteilt_kwh == pytest.approx(0.0)
    assert await _checker_meldungen(db, anlage.id) != [], (
        "die fehlende Anlagen-Monatszeile wäre eine stille Fixture"
    )
    assert not [m for m in await _checker_meldungen(db, anlage.id)
                if "Gesamtzähler" in m], "kein Widerspruch, keine Frage"


# ═══════════════════════════════════════════════════════════════════════════
# C · Regel 2 — der Gesamtzähler misst weniger als die Aufteilung
# ═══════════════════════════════════════════════════════════════════════════


def test_c1_unter_der_toleranz_traegt_der_gesamtzaehler_weiter():
    """**Die Toleranz ist keine Zierde — Zählerstände runden.**

    1000,0 Aufteilung gegen 999,6 Gesamtzähler: 0,4 kWh Abweichung, unter der
    Monatsschwelle von ``max(1 %, 0,5 kWh)``. Der Gesamtzähler bleibt die
    Menge; der Rest ist auf 0 geklemmt, nicht negativ.
    """
    assert wp_strom_toleranz_kwh(1000.0) == pytest.approx(10.0)
    assert wp_strom_toleranz_kwh(10.0) == pytest.approx(
        WP_STROM_TOLERANZ_MIN_MONAT_KWH,
    ), "1 % von 10 kWh liegt unter jeder Rundung — dafür der Mindestwert"
    assert wp_strom_toleranz_kwh(
        10.0, mindest_kwh=WP_STROM_TOLERANZ_MIN_TAG_KWH,
    ) == pytest.approx(0.1), "am Tag entscheidet wieder der Anteil"

    knapp = wp_strom_aufteilung({
        "stromverbrauch_kwh": 999.6,
        "strom_heizen_kwh": 600.0, "strom_warmwasser_kwh": 400.0,
    }, LW_F5)
    assert knapp.stufe == "gesamt"
    assert knapp.menge_kwh == pytest.approx(999.6)
    assert knapp.nicht_aufgeteilt_kwh == pytest.approx(0.0)
    assert knapp.gesamtzaehler_zu_klein is False


async def test_c2_deutlich_kleiner_traegt_die_aufteilung_und_der_checker_warnt(db):
    """**900 gegen 1000: die Achsen tragen, damit nichts verloren geht.**

    ⭐ **Nur diese eine Richtung ist ein Fehler** — Zwilling der Wärme-Invariante
    aus N-391. *Größer* als die Summe ist die normale Lage (Systemverbrauch);
    *kleiner* heißt, dass einer der Werte etwas anderes meint als gedacht:
    meist misst der Gesamtzähler nur einen Teil des Geräts.

    ⚠ **eedc rechnet in dieser Lage mit der Summe**, nicht mit dem
    Gesamtzähler — ADR-002/**P4**: lieber die größere gemessene Menge als eine,
    von der eedc weiß, dass sie unvollständig ist. Und es **sagt es**.
    """
    zeile = {
        "stromverbrauch_kwh": 900.0,
        "strom_heizen_kwh": 600.0, "strom_warmwasser_kwh": 400.0,
        **WAERME,
    }
    auf = wp_strom_aufteilung(zeile, LW_F5)
    assert auf.stufe == "fein"
    assert auf.menge_kwh == pytest.approx(1000.0)
    assert auf.gesamtzaehler_zu_klein is True
    assert auf.nicht_aufgeteilt_kwh == pytest.approx(0.0)

    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, zeile)], name="WK16d-C2")
    wp = await _wp_fakt(db, anlage.id)
    assert wp.strom_kwh == pytest.approx(1000.0)

    meldungen = await _checker_meldungen(db, anlage.id)
    warnung = [m for m in meldungen if "kleiner als die Summe der Achsen" in m]
    assert len(warnung) == 1, meldungen
    assert "06/2025" in warnung[0]

    # **Ein Sachverhalt, eine Meldung.** In dieser Lage tragen die Achsen, die
    # Menge IST die Aufteilung und der Rest ist 0 — die Frage nach dem großen
    # Rest kann gar nicht entstehen.
    # ⚠ **Diese Zeile ist eine Aussage, kein eigener Prüfer**, und steht
    # deshalb hier statt in einer eigenen Probe: Sie folgt strukturell aus
    # ``menge == feine_summe`` und ist durch keinen Sprengsatz rot zu bekommen
    # (gemessen, 14.09.2026 — auch nicht, wenn man den Rest als ``abs(…)``
    # bildete).
    assert not [m for m in meldungen if "misst deutlich mehr" in m], meldungen


# ═══════════════════════════════════════════════════════════════════════════
# D · Regel 6 — Plausibilität: misst er nur die Wärmepumpe?
# ═══════════════════════════════════════════════════════════════════════════


async def test_d1_ein_rest_ueber_25_prozent_stellt_eine_frage(db):
    """**Kein Fehler, eine Frage — INFO mit Handgriff.**

    1000 kWh Gesamtzähler über 600 kWh Aufteilung: 40 % liegen auf keiner
    Achse. Das kann richtig sein; es kann auch heißen, dass am Zähler noch
    etwas anderes hängt. eedc **weiß es nicht** und behauptet es nicht — es
    fragt und nennt den Weg (ADR-002/P4, P-6).
    """
    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, {
        "stromverbrauch_kwh": 1000.0,
        "strom_heizen_kwh": 600.0, "strom_warmwasser_kwh": 0.0,
        **WAERME,
    })], name="WK16d-D1")
    meldungen = await _checker_meldungen(db, anlage.id)
    frage = [m for m in meldungen if "misst deutlich mehr" in m]
    assert len(frage) == 1, meldungen
    assert frage[0].endswith("(06/2025)"), frage[0]


async def test_d2_der_uebliche_systemverbrauch_loest_keine_frage_aus(db):
    """**Die Gegenprobe, ohne die D1 nichts beweist.**

    dietmar1968s eigene Lage: 145 kWh Systemverbrauch auf 2193 kWh Gesamt —
    **6,6 %**, und damit weit unter der Schwelle. Wäre sie enger, bekäme jede
    normal messende Anlage zwölf Fragen im Jahr; genau das macht aus einem
    Hinweis Lärm.
    """
    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, {
        "stromverbrauch_kwh": 2193.0,
        "strom_heizen_kwh": 1500.0, "strom_warmwasser_kwh": 548.0,
        **WAERME,
    })], name="WK16d-D2")
    wp = await _wp_fakt(db, anlage.id)
    assert wp.strom_nicht_aufgeteilt_kwh == pytest.approx(145.0)

    meldungen = await _checker_meldungen(db, anlage.id)
    assert not [m for m in meldungen if "misst deutlich mehr" in m], meldungen


async def test_d3_ohne_aufteilung_fragt_er_nicht_nach_dem_rest(db):
    """**Kein Rest ohne Aufteilung — auch nicht im Checker.**

    Nur der Gesamtzähler gepflegt: Die Achsen fehlen, und das sagt die Meldung
    *„Strom Heizen/Warmwasser fehlt"*. Eine zweite Zeile *„misst deutlich mehr
    als die Achsen"* beschriebe denselben Sachverhalt ein zweites Mal.
    """
    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, {
        "stromverbrauch_kwh": 1000.0, **WAERME,
    })], name="WK16d-D3")
    meldungen = await _checker_meldungen(db, anlage.id)
    assert not [m for m in meldungen if "misst deutlich mehr" in m], meldungen
    assert [m for m in meldungen if "fehlt" in m], (
        "der eigentliche Hinweis muss dafür stehen bleiben"
    )


async def test_d3b_eine_achse_die_nur_null_traegt_ist_keine_aufteilung(db):
    """**Die Kante zwischen den zwei Bedingungen — und sie sind verschieden.**

    Die Zeile trägt **eine** Achse, und die steht auf einer gemessenen 0:
    `strom_warmwasser_kwh: 0.0` neben 1000 kWh Gesamtzähler. Für den **Rest**
    zählt sie (``is not None`` — die Anlage hat in diesem Monat kein Warmwasser
    bereitet, das ist eine Aussage), er beträgt volle 1000 kWh. Für die
    **Frage** zählt sie nicht: Es gibt nichts, wovon der Gesamtzähler „deutlich
    mehr" misst.

    ⚠ **Ohne diese Probe wäre die Bedingung im Checker ungeprüft** — die im
    Layer (`hat_aufteilung`) deckt sie nicht ab, weil sie eine andere Frage
    stellt. Gemessen: Sprengsatz **S8** (Bedingung entfernt) blieb ohne sie
    vollständig grün.
    """
    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, {
        "stromverbrauch_kwh": 1000.0, "strom_warmwasser_kwh": 0.0, **WAERME,
    })], name="WK16d-D3b")

    wp = await _wp_fakt(db, anlage.id)
    assert wp.strom_nicht_aufgeteilt_kwh == pytest.approx(1000.0)

    meldungen = await _checker_meldungen(db, anlage.id)
    assert not [m for m in meldungen if "misst deutlich mehr" in m], meldungen


# ═══════════════════════════════════════════════════════════════════════════
# E · Die zwei Ebenen — Zuordnung (Tag) gegen Zeilenwert (Monat)
# ═══════════════════════════════════════════════════════════════════════════


def test_e1_der_tag_entscheidet_an_der_zuordnung():
    """**Zugeordnet genügt — Werte sieht der Tag beim Bau der Beiträge nicht.**

    Deshalb kennt die Zuordnungs-Ebene **keine** Regel 2: ohne Zahlen gibt es
    keinen Widerspruch zu prüfen. ``wp_strom_stufe`` ohne Werte antwortet
    ``"gesamt"``, sobald ein Gesamtzähler da ist — Regel 1 ohne Vorbehalt.
    """
    assert wp_strom_stufe(hat_gesamtzaehler=True) == "gesamt"
    assert wp_strom_stufe(hat_gesamtzaehler=False) == "fein"

    assert _tages_felder(LW_F5, {
        "stromverbrauch_kwh", "strom_heizen_kwh", "strom_warmwasser_kwh",
    }) == ["stromverbrauch_kwh"]
    assert set(_tages_felder(LW_F5, {
        "strom_heizen_kwh", "strom_warmwasser_kwh",
    })) == {"strom_heizen_kwh", "strom_warmwasser_kwh"}


async def test_e2_ein_zugeordneter_aber_leerer_gesamtzaehler_laesst_die_achsen_tragen(db):
    """**Regel 5 am Monat: „steht ein Wert?", nicht „ist ein Zähler da?"**

    Dieselbe Anlage wie E1 — Gesamtzähler zugeordnet —, aber die Monatszeile
    trägt ihn nicht (Sensor erst später eingerichtet, Ausfall, Handpflege). Der
    Monat fällt auf die Achsen zurück, **ohne** die Zeile leer zu lassen; die
    Zuordnung allein erzeugt keine Zahl.

    ⚠ **Der Tag kann das nicht**, und das steht im Modul-Kopf als benannte
    Grenze: Er entscheidet an der Zuordnung und hat für diesen Tag dann keinen
    Wert. Die Lage ist unverändert die jedes Geräts ohne vollständige Achse.
    """
    anlage = await _anlage_mit_wps(db, geraete=[(LW_F5, {
        "strom_heizen_kwh": 600.0, "strom_warmwasser_kwh": 400.0, **WAERME,
    })], name="WK16d-E2")
    inv = (await db.execute(
        select(Investition).where(Investition.anlage_id == anlage.id)
    )).scalars().first()
    anlage.sensor_mapping = {"investitionen": {str(inv.id): {"felder": {
        f: {"strategie": "sensor", "sensor_id": f"sensor.{f}"}
        for f in ("stromverbrauch_kwh", "strom_heizen_kwh",
                  "strom_warmwasser_kwh")
    }}}}
    await db.commit()

    wp = await _wp_fakt(db, anlage.id)
    assert wp.strom_kwh == pytest.approx(1000.0)
    assert wp.strom_nicht_aufgeteilt_kwh == pytest.approx(0.0)


# ═══════════════════════════════════════════════════════════════════════════
# F · Das Handbuch behält seine Zahlen (§6 B und B2)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize("lage,zeile,erwartet_nenner", [
    # B — drei getrennte Zähler; der Gesamtzähler steht auf ihrer Summe.
    ("B", {
        "stromverbrauch_kwh": 1050.0,
        "strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0,
        "betriebsart_strom_kuehlen_kwh": 100.0,
    }, 950.0),
    # B2 — zwei Zähler plus Betriebsmodus-Sensor, KEIN Gesamtzähler.
    ("B2", {
        "strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0,
        "modus_strom_heizen_kwh": 700.0, "modus_strom_warmwasser_kwh": 150.0,
        "modus_strom_kuehlen_kwh": 100.0, "modus_abdeckung_h": 720.0,
    }, 950.0),
])
async def test_f1_handbuch_b_und_b2_zeigen_weiter_dieselbe_arbeitszahl(
    db, lage, zeile, erwartet_nenner,
):
    """**3,79 in beiden Lagen — Handbuch §6 B/B2, unverändert.**

    ⭐ **Die Zusage, die dieser Bau nicht brechen darf.** Das Handbuch begründet
    ausdrücklich, *warum* beide Anlagen dieselbe Zahl zeigen, obwohl die eine
    einen Zähler mehr hat: In **B** ist der Kühlstrom ein eigener Zähler
    **neben** den anderen und wird abgezogen; in **B2** ist er eine
    **Verteilung** derselben 950 kWh und wird nicht abgezogen. Beide Wege
    führen auf 3600 ÷ 950 = **3,79**.

    ⚠ **In B kommt der Gesamtzähler jetzt hinzu** — und weil er auf der Summe
    der drei Zähler steht (1050), ändert sich nichts. Stünde er höher, wäre die
    Zahl richtigerweise niedriger; das prüft A-1.
    """
    anlage = await _anlage_mit_wps(
        db, geraete=[(LW_F5, {**zeile, **WAERME})], name=f"WK16d-F1-{lage}",
    )
    wp = await _wp_fakt(db, anlage.id)
    az = arbeitszahl(
        wp.waerme_kwh, wp.strom_kwh,
        strom_funktionsfremd_kwh=wp.modus_strom_funktionsfremd_abzug_kwh,
    )
    assert wp.waerme_kwh == pytest.approx(3600.0)
    assert az.nenner_kwh == pytest.approx(erwartet_nenner)
    assert az.wert == pytest.approx(3.79, abs=0.005)


# ═══════════════════════════════════════════════════════════════════════════
# G · Der Mischfall — je Gerät, nie auf der Anlagensumme
# ═══════════════════════════════════════════════════════════════════════════


async def test_g1_zwei_geraete_zwei_zaehlerlagen(db):
    """**Die Summe der je aufgelösten Mengen, nicht die Auflösung der Summe.**

    Gerät 1: Gesamtzähler 1145 über den Achsen 600 + 400 ⇒ Menge 1145, Rest
    145. Gerät 2 (Split-Klimaanlage, **eine** Achse, kein Gesamtzähler): Menge
    300, kein Rest. Anlage: **1445 kWh** und **145 kWh** nicht aufgeteilt.

    ⚠ **Auf der Anlagensumme gestellt wäre die Frage gar nicht beantwortbar** —
    Gerät 2 hat keinen Gesamtzähler, Gerät 1 einen; die Regel hängt an der
    Zählerlage *dieses* Geräts. Dieselbe Lehre wie bei N-391b auf der
    Wärmeseite, wo die Auflösung über den Summen im Mischfall 30 statt 55 ergab.
    """
    anlage = await _anlage_mit_wps(db, geraete=[
        (LW_F5, {
            "stromverbrauch_kwh": 1145.0,
            "strom_heizen_kwh": 600.0, "strom_warmwasser_kwh": 400.0,
            **WAERME,
        }),
        (LL_F5, {"strom_heizen_kwh": 300.0}),
    ], name="WK16d-G1")

    wp = await _wp_fakt(db, anlage.id)
    assert wp.strom_kwh == pytest.approx(1445.0)
    assert wp.strom_nicht_aufgeteilt_kwh == pytest.approx(145.0)


# ═══════════════════════════════════════════════════════════════════════════
# H · Was unberührt bleibt
# ═══════════════════════════════════════════════════════════════════════════


def test_h1_ohne_kennzeichen_gibt_es_keine_summanden_und_keinen_rest():
    """**Der Nicht-getrennt-Zweig ist unberührt** (K3 in beide Richtungen).

    Ohne ``getrennte_strommessung`` sind die feinen Felder keine Summanden —
    das sagt gerade das fehlende Kennzeichen. Also gibt es auch keine
    Aufteilung, deren Rest man bilden könnte; ``stromverbrauch_kwh`` ist die
    Menge und war es immer.
    """
    auf = wp_strom_aufteilung({
        "stromverbrauch_kwh": 1000.0, "strom_heizen_kwh": 600.0,
    }, LW_AUS)
    assert auf.menge_kwh == pytest.approx(1000.0)
    assert auf.feine_summe_kwh == pytest.approx(0.0)
    assert auf.nicht_aufgeteilt_kwh == pytest.approx(0.0)
    assert get_wp_strom_kwh({"strom_kwh": 42.0}, LW_AUS) == pytest.approx(42.0)


def test_h2_die_klimaanlage_behaelt_ihre_eine_achse():
    """**R1/N-304: eine Split-Klimaanlage hat keinen Warmwasserkreis.**

    Gesamtzähler 500 über einer Heiz-Achse von 300 ⇒ Menge 500, Rest 200 —
    Kühlen, Lüften, Standby. Die Zahl ist dieselbe wie vor WK-16d (Lage vii in
    ``test_n451_monatspfad_k3``), weil dort schon der Gesamtzähler trug; neu
    ist allein, dass der Rest jetzt **benannt** wird statt zu verschwinden.
    """
    auf = wp_strom_aufteilung({
        "stromverbrauch_kwh": 500.0, "strom_heizen_kwh": 300.0,
    }, LL_F5)
    assert auf.menge_kwh == pytest.approx(500.0)
    assert auf.nicht_aufgeteilt_kwh == pytest.approx(200.0)
