"""**Kennzahlen folgen den Achsen des Geräts** — WK-16h (N-499 · N-502).

WK-15c hat die Regel *„eine Achse, die am Gerät nicht gilt, trägt in keiner
Rechnung und keinem Hinweis eine Zahl"* für ROI-Schätzung, Formular und die
SCOP/COP-Hinweise durchgesetzt. Die **Kennzahlen je Gerät** kamen einen Tag
später (WK-16ab) und kannten sie nicht.

**Gemessen an der Demo-DB r28 am 15.09.2026, vor dem Bau:**

* Die Brauchwasser-WP *Stiebel WWK 300* hatte eine Gesamt-Arbeitszahl von
  **3,31** und daneben zweimal den Strich *„Strom nicht getrennt je Funktion
  gemessen"* — einmal für die Achse, deren Zahl 3,31 **ist** (ihr ganzer Strom
  ist Warmwasser-Strom), und einmal für eine Achse, die das Gerät nicht hat.
* Die Split-Klimaanlage *Bosch Climate 5000* nannte für **Heizen** den
  Strom-Grund, obwohl zuerst die **Wärme** fehlt (ihre Gesamt-Zeile sagt es
  selbst), und für **Warmwasser** einen Grund für einen Kreis, den sie nicht hat.
* Am Demo-Tag 15.06. trug allein die Klimaanlage Strom bei — und der Kasten
  empfahl *„Getrennte Strommessung einschalten und beide Zähler zuordnen"*.

⛔ **Was diese Datei NICHT noch einmal misst:** die Schranke und die
Kasten-Grundregeln (`test_wk16_e1b_d_sicht.py`), die R2-Sperren je Funktion
(`test_r2_je_funktion.py`), die Registry-Bedingungen selbst
(`test_soll_waerme_klima_achse1_erfassung.py`). Hier steht die **Achsen**-Regel
und ihre Folge für Zahl, Grund, Tabelle und Kasten.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    ARBEITSZAHL_GILT_NICHT,
    GRUND_KEINE_WAERMEMESSUNG,
    GRUND_STROM_NICHT_JE_FUNKTION,
    GRUND_WAERME_NICHT_JE_FUNKTION,
    Arbeitszahl,
    als_arbeitszahl,
    arbeitszahl,
    arbeitszahl_je_funktion,
    systemarbeitszahl,
)
from backend.core.betriebsmodus import HEIZEN, WAERME_ACHSEN, WARMWASSER
from backend.core.field_definitions import (
    WP_WAERME_ACHSEN_BEIDE,
    wp_waerme_achsen,
)
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.investition import InvestitionMonatsdaten
from backend.models.mqtt_gateway_mapping import MqttGatewayMapping  # noqa: F401
from backend.models.sensor_snapshot import SensorSnapshot  # noqa: F401
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.waerme_klima_block import (
    WpGeraetZeile,
    achsen_der_anlage,
    geraete_zeilen,
    was_noch_moeglich,
)
from backend.services.waermepumpe_kennzahlen_je_geraet import (
    GeraetKennzahlen,
    GeraetMengen,
    kennzahlen_aus_mengen,
)

JAHR, MONAT = 2025, 7

_WP = {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz"}
_WP_F5 = {**_WP, "getrennte_strommessung": True}
_KLIMA = {"wp_art": "luft_luft", "effizienz_modus": "gesamt_jaz"}
_BRAUCHWASSER = {"wp_art": "brauchwasser", "effizienz_modus": "gesamt_jaz"}


async def _anlage(db, name: str) -> Anlage:
    a = Anlage(anlagenname=name, leistung_kwp=10.0, installationsdatum=date(2025, 1, 1))
    db.add(a)
    await db.flush()
    return a


async def _geraet(db, anlage, bezeichnung: str, parameter: dict, daten: dict):
    inv = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung=bezeichnung,
        anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=12000.0,
        parameter=parameter,
    )
    db.add(inv)
    await db.flush()
    db.add(InvestitionMonatsdaten(
        investition_id=inv.id, jahr=JAHR, monat=MONAT, verbrauch_daten=daten,
    ))
    return inv


async def _monat(db, anlage_id):
    from backend.api.routes.aktueller_monat import get_aktueller_monat
    return await get_aktueller_monat(anlage_id, jahr=JAHR, monat=MONAT, db=db)


async def _jahr(db, anlage_id):
    from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht
    return await get_cockpit_uebersicht(anlage_id, jahr=JAHR, db=db)


def _mengen(**kw) -> GeraetMengen:
    basis = dict(inv_id=1, name="Gerät", strom_kwh=0.0, waerme_kwh=0.0)
    return GeraetMengen(**{**basis, **kw})


# ═══ Die Registry — welche Achse hat welches Gerät ══════════════════════════

@pytest.mark.parametrize("wp_art,erwartet", [
    ("luft_wasser", {HEIZEN, WARMWASSER}),
    ("sole_wasser", {HEIZEN, WARMWASSER}),
    ("wasser_wasser", {HEIZEN, WARMWASSER}),
    ("luft_luft", {HEIZEN}),
    ("brauchwasser", {WARMWASSER}),
])
def test_die_registry_nennt_die_achsen_je_bauart(wp_art, erwartet):
    """**Die eine Achsen-Frage** — sie liest die Registry, nicht die Bauart-Kette.

    ⚠ Die beiden Sonderfälle sind verschieden hart hinterlegt und müssen
    trotzdem gleich beantwortet werden: ``warmwasser_kwh`` trägt ``!luft_luft``
    **hart** (N-304, kein Warmwasserkreis), ``heizenergie_kwh`` trägt
    ``!brauchwasser`` **weich**. Die weiche Sorte ist der Grund, warum hier
    ``feld_urteil == URTEIL_GILT`` gefragt wird und nicht
    ``groesse_gibt_es_am_geraet`` — jenes lieferte für die Heiz-Achse einer
    Brauchwasser-WP ``True``.
    """
    assert wp_waerme_achsen({"wp_art": wp_art}) == erwartet


def test_ein_unbekanntes_geraet_behaelt_beide_achsen():
    """Fail-open wie die Registry-Auswerter darunter.

    Ein unbekannter (oder fehlender) ``wp_art`` darf keine Kennzahl
    verschwinden lassen — die Gegenrichtung wäre der teurere Fehler.
    """
    assert wp_waerme_achsen({}) == WP_WAERME_ACHSEN_BEIDE
    assert wp_waerme_achsen(None) == WP_WAERME_ACHSEN_BEIDE
    assert WP_WAERME_ACHSEN_BEIDE == WAERME_ACHSEN, (
        "Registry und Kanon führen dieselbe Menge — sonst wären es zwei"
    )


# ═══ Der Layer — R-1 ════════════════════════════════════════════════════════

def test_brauchwasser_die_warmwasser_zahl_ist_die_gesamtzahl():
    """**N-499, der Kern:** 4,8 kWh Wärme auf 1,45 kWh Strom = **3,31**.

    Das Gerät hat genau eine Wärme-Achse. Sein ganzer Strom **ist**
    Warmwasser-Strom; ein getrennter Zähler könnte nichts anderes messen. Also
    ist die Arbeitszahl Warmwasser 3,31 — und nicht ein Strich mit *„Strom nicht
    getrennt je Funktion gemessen"*.
    """
    gesamt = arbeitszahl(4.8, 1.45)
    assert gesamt.wert == pytest.approx(3.31, abs=0.01)

    je = arbeitszahl_je_funktion(
        heizung_kwh=0, strom_heizen_kwh=0,
        warmwasser_kwh=0, strom_warmwasser_kwh=0,
        hat_split=False,
        achsen=wp_waerme_achsen(_BRAUCHWASSER), gesamt=gesamt,
    )
    assert je.warmwasser.wert == pytest.approx(3.31, abs=0.01)
    assert je.warmwasser.grund is None
    assert je.warmwasser.zaehler_kwh == pytest.approx(4.8)
    assert je.warmwasser.nenner_kwh == pytest.approx(1.45)


def test_die_fehlende_achse_traegt_weder_zahl_noch_grund():
    """WK-15c, eine Fläche weiter: **kein Strich mit Text, gar nichts.**

    Ein „—" sagt *„hier fehlt etwas"*. An einer Achse, die das Gerät nicht hat,
    ist das falsch: Es gibt nichts zu beheben, und ein Grund daneben nennte
    einen Mangel, den es nicht gibt.
    """
    je = arbeitszahl_je_funktion(
        heizung_kwh=0, strom_heizen_kwh=0,
        warmwasser_kwh=0, strom_warmwasser_kwh=0,
        hat_split=False,
        achsen=wp_waerme_achsen(_BRAUCHWASSER), gesamt=arbeitszahl(4.8, 1.45),
    )
    assert je.heizen == ARBEITSZAHL_GILT_NICHT
    assert je.heizen.wert is None and je.heizen.grund is None

    je_klima = arbeitszahl_je_funktion(
        heizung_kwh=0, strom_heizen_kwh=0,
        warmwasser_kwh=0, strom_warmwasser_kwh=0,
        hat_split=False,
        achsen=wp_waerme_achsen(_KLIMA), gesamt=arbeitszahl(0, 200.0),
    )
    assert je_klima.warmwasser == ARBEITSZAHL_GILT_NICHT


def test_klimaanlage_der_grund_nennt_die_waerme_nicht_den_strom():
    """**R-2, die Rangfolge** — und sie fällt aus R-1 heraus, ohne zweite Regel.

    Eine Split-Klimaanlage hat genau eine Wärme-Achse (Heizen). Ihre
    Funktions-Arbeitszahl ist damit die Gesamtzahl — und die sagt, was wirklich
    fehlt: *„kein Wärmemengenzähler zugeordnet"*. Vorher stand dort *„Strom
    nicht getrennt je Funktion gemessen"*, also die falsche Seite: Getrennte
    Stromzähler brächten ohne Wärmemengenzähler keine einzige Kennzahl.
    """
    gesamt = arbeitszahl(0, 200.0)
    assert gesamt.grund == GRUND_KEINE_WAERMEMESSUNG

    je = arbeitszahl_je_funktion(
        heizung_kwh=0, strom_heizen_kwh=0,
        warmwasser_kwh=0, strom_warmwasser_kwh=0,
        hat_split=False, achsen=wp_waerme_achsen(_KLIMA), gesamt=gesamt,
    )
    assert je.heizen.wert is None
    assert je.heizen.grund == GRUND_KEINE_WAERMEMESSUNG


def test_die_gesamtzahl_ersetzt_einen_grund_nie_eine_zahl():
    """⛔ **Die Gegenprobe zur Ein-Achsen-Regel.**

    Eine Brauchwasser-WP **mit** getrennter Strommessung und gemessenem
    Warmwasser-Zähler: 4,0 kWh Wärme auf 1,0 kWh Strom = 4,0. Die Gesamtzahl
    daneben ist 3,31 — sie enthält Standby und Steuerung (K1). Die **gemessene**
    Funktions-Zahl gewinnt; sonst nähme die Regel eine richtige Zahl weg.
    """
    je = arbeitszahl_je_funktion(
        heizung_kwh=0, strom_heizen_kwh=0,
        warmwasser_kwh=4.0, strom_warmwasser_kwh=1.0,
        hat_split=True,
        achsen=wp_waerme_achsen(_BRAUCHWASSER), gesamt=arbeitszahl(4.8, 1.45),
    )
    assert je.warmwasser.wert == pytest.approx(4.0)
    assert je.heizen == ARBEITSZAHL_GILT_NICHT, (
        "ein Kennzeichen macht keine Achse — auch mit F5 gibt es hier kein Heizen"
    )


def test_zwei_achsen_bleiben_bitgleich():
    """**Vertraute Anzeigen nur ändern, wo nötig.**

    Ein Gerät mit beiden Achsen rechnet exakt wie vor WK-16h — mit und ohne die
    neuen Argumente dasselbe Ergebnis, Wert **und** Wortlaut.
    """
    kw = dict(
        heizung_kwh=3000.0, strom_heizen_kwh=800.0,
        warmwasser_kwh=500.0, strom_warmwasser_kwh=200.0,
        hat_split=True,
    )
    ohne = arbeitszahl_je_funktion(**kw)
    mit = arbeitszahl_je_funktion(
        **kw, achsen=wp_waerme_achsen(_WP_F5), gesamt=arbeitszahl(3500.0, 1000.0),
    )
    assert mit == ohne

    kw2 = dict(
        heizung_kwh=None, strom_heizen_kwh=None,
        warmwasser_kwh=None, strom_warmwasser_kwh=None,
        hat_split=False,
    )
    assert arbeitszahl_je_funktion(
        **kw2, achsen=wp_waerme_achsen(_WP), gesamt=arbeitszahl(3000.0, 1000.0),
    ) == arbeitszahl_je_funktion(**kw2)
    assert arbeitszahl_je_funktion(**kw2).heizen.grund == GRUND_STROM_NICHT_JE_FUNKTION


def test_ohne_die_neuen_argumente_aendert_sich_nichts():
    """Der Default ist „beide Achsen, keine Ersetzung" — für jeden Altaufrufer."""
    kw = dict(
        heizung_kwh=0, strom_heizen_kwh=0,
        warmwasser_kwh=0, strom_warmwasser_kwh=0, hat_split=False,
    )
    assert arbeitszahl_je_funktion(**kw) == arbeitszahl_je_funktion(
        **kw, achsen=None, gesamt=None,
    )


def test_eine_schranke_wird_nicht_zur_funktions_arbeitszahl():
    """⛔ **Ein „≥" geht nicht mit** (ADR-002/P4).

    Die Funktions-Zeilen haben keine Bauform für eine untere Schranke. Eine
    Schranke dort ohne ihr Zeichen zu zeigen behauptete mehr, als sie weiß —
    also bleibt es in dieser Lage beim gewohnten Weg.
    """
    schranke = systemarbeitszahl(
        3000.0, 1000.0, strom_ohne_waerme_kwh=200.0,
        geraete_ohne_waerme=["Klimaanlage"],
    )
    assert schranke.ist_schranke is True
    assert als_arbeitszahl(schranke) is None

    klar = systemarbeitszahl(3000.0, 1000.0)
    assert klar.ist_schranke is False
    assert als_arbeitszahl(klar) == Arbeitszahl(
        klar.wert, klar.grund, klar.hinweis, klar.zaehler_kwh, klar.nenner_kwh,
    )

    je = arbeitszahl_je_funktion(
        heizung_kwh=0, strom_heizen_kwh=0,
        warmwasser_kwh=0, strom_warmwasser_kwh=0,
        hat_split=False, achsen={HEIZEN}, gesamt=als_arbeitszahl(schranke),
    )
    assert je.heizen.grund == GRUND_STROM_NICHT_JE_FUNKTION, (
        "keine Schranke — also der Grund, den die Funktion selbst findet"
    )


# ═══ Anlagenweit — R-2 ══════════════════════════════════════════════════════

def _k(name, wp_art, strom) -> GeraetKennzahlen:
    return kennzahlen_aus_mengen(_mengen(
        inv_id=abs(hash(name)) % 10000, name=name, strom_kwh=strom,
        waerme_achsen=wp_waerme_achsen({"wp_art": wp_art}),
    ))


def test_anlagenweit_zaehlen_nur_die_achsen_der_beitragenden_geraete():
    """**Beitrag statt Bestand** — dieselbe Regel wie bei der Schranke (N-441).

    Trägt an einem Tag allein die Klimaanlage Strom bei, gibt es anlagenweit
    keine Warmwasser-Achse. Die Wärmepumpe daneben, die an diesem Tag nichts
    verbraucht hat, öffnet keine — sie steht in keinem Nenner.
    """
    nur_klima = [_k("Bosch", "luft_luft", 2.2), _k("Daikin", "luft_wasser", 0.0)]
    assert achsen_der_anlage(nur_klima) == {HEIZEN}

    beide = [_k("Bosch", "luft_luft", 2.2), _k("Daikin", "luft_wasser", 5.0)]
    assert achsen_der_anlage(beide) == {HEIZEN, WARMWASSER}, (
        "die Gegenprobe: sobald das zweite Gerät beiträgt, gibt es beide wieder"
    )


def test_ohne_beitrag_und_ohne_geraete_bleiben_beide_achsen():
    """⛔ **Eine leere Menge ist keine Messung** (P4).

    Trägt kein Gerät bei, gelten die Achsen aller übergebenen — und ohne Geräte
    beide. Sonst hieße eine Zeitraum-Lücke plötzlich *„diese Anlage hat keine
    Warmwasserbereitung"*.
    """
    assert achsen_der_anlage([]) == WAERME_ACHSEN
    ruhend = [_k("Daikin", "luft_wasser", 0.0), _k("Bosch", "luft_luft", 0.0)]
    assert achsen_der_anlage(ruhend) == {HEIZEN, WARMWASSER}


@pytest.mark.asyncio
async def test_eine_klimaanlage_allein_kennt_kein_warmwasser(db):
    """End zu Ende über Monat **und** Jahr — die Lage des Demo-Tages 15.06.

    Der Kasten empfahl dort *„Getrennte Strommessung einschalten und beide
    Zähler zuordnen"* für *Arbeitszahl Heizen · Arbeitszahl Warmwasser*. Beides
    war falsch: Warmwasser gibt es an dieser Ausstattung nicht, und für Heizen
    fehlt zuerst der Wärmemengenzähler.
    """
    a = await _anlage(db, "WK-16h nur Klima")
    await _geraet(db, a, "Bosch Multisplit", dict(_KLIMA),
                  {"stromverbrauch_kwh": 200.0})
    await db.commit()

    for antwort in (await _monat(db, a.id), await _jahr(db, a.id)):
        assert antwort.wp_jaz_warmwasser is None
        assert antwort.wp_jaz_warmwasser_grund is None, (
            "eine Achse, die es an der ganzen beitragenden Ausstattung nicht "
            "gibt, trägt auch anlagenweit keinen Grund"
        )
        assert antwort.wp_jaz_heizen_grund == GRUND_KEINE_WAERMEMESSUNG
        kasten = {z.grund for z in antwort.wp_moeglich}
        assert GRUND_STROM_NICHT_JE_FUNKTION not in kasten, (
            "der Handgriff *getrennte Strommessung einschalten* führt an "
            "diesem Gerät ins Leere"
        )
        groessen = {g for z in antwort.wp_moeglich for g in z.groessen}
        assert "Arbeitszahl Warmwasser" not in groessen


@pytest.mark.asyncio
async def test_der_tag_uebt_dieselbe_regel_aus(db):
    """⛔ **Der Tag ist ein eigener Pfad — und er war zuerst ungeprüft.**

    Der Sprengsatz S14 (die Achsen erreichen ``tag.py`` nicht) blieb bei den
    Proben oben **still**: Monat und Jahr laufen über andere Routen. Genau die
    Lage, um die es geht, ist aber eine **Tages**-Lage — am Demo-Tag 15.06.
    trug allein die Klimaanlage Strom bei.

    ⚠ *Ein Prüfer, der den Pfad nicht betritt, prüft ihn nicht.*
    """
    from backend.tests.test_bs6b_kaelte_linie import (
        DATUM as TAG, LL, _anlage as _bs_anlage, _lts, _reihe, _speichern,
    )
    from backend.api.routes.energie_profil.views import get_tag_detail

    a = await _bs_anlage(db)
    klima = await _wp_bs(db, a, "Bosch Multisplit", dict(LL))
    _lts(db, a, [klima])
    _reihe(db, a, klima, "stromverbrauch_kwh", {10: 2.2})
    await _speichern(db, a)

    t = await get_tag_detail(a.id, TAG, db)
    assert t.wp_jaz_warmwasser is None
    assert t.wp_jaz_warmwasser_grund is None, (
        "eine Split-Klimaanlage allein kennt kein Warmwasser — auch am Tag"
    )
    groessen = {g for z in t.wp_moeglich for g in z.groessen}
    assert "Arbeitszahl Warmwasser" not in groessen
    assert GRUND_STROM_NICHT_JE_FUNKTION not in {z.grund for z in t.wp_moeglich}
    zeile = next(g for g in t.wp_geraete if g.name == "Bosch Multisplit")
    assert zeile.achsen == [HEIZEN]


async def _wp_bs(db, anlage, name, params):
    """Wie ``test_bs6b_kaelte_linie._wp`` — hier mit eigenem Namen, damit die
    Datei nicht zwei ``_wp`` führt."""
    from backend.tests.test_bs6b_kaelte_linie import _wp
    return await _wp(db, anlage, name, params)


@pytest.mark.asyncio
async def test_die_gegenprobe_eine_waermepumpe_daneben_bringt_warmwasser_zurueck(db):
    """⛔ **Ohne sie sperrte die Regel oben womöglich jede Warmwasser-Zahl.**

    Dieselbe Klimaanlage, aber daneben eine Luft-Wasser-Wärmepumpe mit Strom:
    Jetzt **gibt** es die Warmwasser-Achse anlagenweit, und ihr Grund steht
    wieder da.
    """
    a = await _anlage(db, "WK-16h Klima + WP")
    await _geraet(db, a, "Bosch Multisplit", dict(_KLIMA),
                  {"stromverbrauch_kwh": 200.0})
    await _geraet(db, a, "Daikin Altherma", dict(_WP),
                  {"stromverbrauch_kwh": 800.0, "heizenergie_kwh": 3000.0})
    await db.commit()

    m = await _monat(db, a.id)
    assert m.wp_jaz_warmwasser_grund == GRUND_STROM_NICHT_JE_FUNKTION
    assert m.wp_jaz_heizen_grund == GRUND_STROM_NICHT_JE_FUNKTION


@pytest.mark.asyncio
async def test_die_brauchwasser_wp_zeigt_ihre_zahl_in_der_tabelle(db):
    """Die r28-Lage des Prüfstands, end zu ende: **3,31 statt zweier Striche.**"""
    a = await _anlage(db, "WK-16h Prüfstand")
    await _geraet(db, a, "Stiebel WWK 300", dict(_BRAUCHWASSER),
                  {"stromverbrauch_kwh": 1.45, "warmwasser_kwh": 4.8})
    await db.commit()

    m = await _monat(db, a.id)
    zeile = next(g for g in m.wp_geraete if g.name == "Stiebel WWK 300")
    assert zeile.jaz == pytest.approx(3.31, abs=0.01)
    assert zeile.jaz_warmwasser == pytest.approx(3.31, abs=0.01)
    assert zeile.jaz_warmwasser_grund is None
    assert zeile.jaz_heizen is None and zeile.jaz_heizen_grund is None
    assert zeile.achsen == [WARMWASSER], (
        "die Anzeige braucht das Feld, um eine leere Zelle von einem Strich "
        "zu unterscheiden"
    )


# ═══ Der Kasten — R-4 ═══════════════════════════════════════════════════════

def _zeile(**kw) -> WpGeraetZeile:
    basis = dict(investition_id=1, name="Gerät", achsen=[HEIZEN, WARMWASSER])
    return WpGeraetZeile(**{**basis, **kw})


def test_der_kasten_nennt_den_geraete_grund_mit_dem_namen():
    """**N-502:** Vorher stand im ganzen Block nirgends, dass der Bosch der
    Wärmemengenzähler fehlt — nur der Schranken-Satz an der Kachel, und der
    erklärt das „≥", nicht den Strich.
    """
    zeilen = was_noch_moeglich([], [_zeile(
        name="Bosch Climate 5000 Multisplit", achsen=[HEIZEN],
        jaz=None, jaz_grund=GRUND_KEINE_WAERMEMESSUNG,
        jaz_heizen=None, jaz_heizen_grund=GRUND_KEINE_WAERMEMESSUNG,
    )])
    assert len(zeilen) == 1
    assert zeilen[0].grund == (
        f"Bosch Climate 5000 Multisplit: {GRUND_KEINE_WAERMEMESSUNG}"
    )
    assert zeilen[0].groessen == ["Arbeitszahl", "Arbeitszahl Heizen"], (
        "ein Grund, zwei Größen, EINE Zeile"
    )
    assert zeilen[0].handgriff, "ein Ausstattungs-Grund ohne Handgriff hilft nicht"
    assert zeilen[0].link == "#/einstellungen/datenquellen"


def test_der_geraete_grund_wird_gegen_die_anlagenweite_zeile_dedupliziert():
    """⛔ **Dieselbe Auskunft zweimal ist keine zweite Auskunft.**

    Sagt die Anlage schon *„kein Kältemengenzähler zugeordnet"*, wäre
    *„Bosch: kein Kältemengenzähler zugeordnet"* daneben nur Wiederholung —
    genau das, wogegen der Kasten gebaut ist.
    """
    from backend.core.berechnungen.waermepumpe_kennzahl import GRUND_KEINE_KAELTEMENGE
    zeilen = was_noch_moeglich(
        [("Arbeitszahl Kühlen", GRUND_KEINE_KAELTEMENGE)],
        [_zeile(name="Bosch", jaz_kuehlen=None,
                jaz_kuehlen_grund=GRUND_KEINE_KAELTEMENGE)],
    )
    assert [z.grund for z in zeilen] == [GRUND_KEINE_KAELTEMENGE]


def test_ein_zeitraum_grund_des_geraets_steht_nicht_im_kasten():
    """Dieselbe Klassen-Frage wie anlagenweit — sie steht an der Grund-Konstante."""
    from backend.core.berechnungen.waermepumpe_kennzahl import GRUND_KEIN_KUEHLBETRIEB
    assert was_noch_moeglich([], [_zeile(
        name="Daikin", jaz_kuehlen=None, jaz_kuehlen_grund=GRUND_KEIN_KUEHLBETRIEB,
    )]) == []


def test_eine_nicht_geltende_achse_bringt_nichts_in_den_kasten():
    """Sie hat keinen Grund — und selbst wenn dort einer stünde, gilt sie nicht."""
    assert was_noch_moeglich([], [_zeile(
        name="Bosch", achsen=[HEIZEN],
        jaz_warmwasser=None, jaz_warmwasser_grund=GRUND_WAERME_NICHT_JE_FUNKTION,
    )]) == []


def test_eine_zeile_ohne_achsen_faellt_offen_aus():
    """⛔ **Fail-open, wie in der Registry.**

    Eine Zeile mit leerer Achsen-Liste (ein Altbestand, eine von Hand gebaute
    Antwort) darf keine Auskunft verschwinden lassen — eine fehlende Angabe ist
    keine Aussage *„diese Achse gibt es nicht"*. Die teurere Richtung wäre, eine
    gemessene Zahl still auszublenden.
    """
    zeilen = was_noch_moeglich([], [_zeile(
        name="Altbestand", achsen=[],
        jaz_warmwasser=None, jaz_warmwasser_grund=GRUND_WAERME_NICHT_JE_FUNKTION,
    )])
    assert [z.groessen for z in zeilen] == [["Arbeitszahl Warmwasser"]]


def test_eine_zelle_mit_zahl_bringt_nichts_in_den_kasten():
    """Eine Zahl erklärt sich selbst."""
    assert was_noch_moeglich([], [_zeile(
        name="Daikin", jaz=4.89, jaz_grund=None,
        jaz_heizen=5.16, jaz_warmwasser=3.96,
    )]) == []


def test_die_anlagenweiten_zeilen_stehen_vor_den_geraete_zeilen():
    """Die Reihenfolge ist die des Blocks: erst die Anlage, dann die Geräte.

    ⚠ **Die beiden Zeilen erklären seit WK-16j verschiedene Größen**, und das
    ist kein Kosmetik-Eingriff an der Probe: **R-5** lässt je Größe genau eine
    Auskunft stehen, und das ist die mit dem Gerätenamen. Die alte Fassung
    fragte beide Zeilen für *dieselbe* Größe ab — sie war damit nur so lange
    wahr, wie der Kasten die Auskunft doppelt führte. **Die Substanz der Probe
    ist die Reihenfolge**, und die misst sie unverändert.
    """
    zeilen = was_noch_moeglich(
        [("Arbeitszahl Kühlen", GRUND_STROM_NICHT_JE_FUNKTION)],
        [_zeile(name="Bosch", achsen=[HEIZEN],
                jaz=None, jaz_grund=GRUND_KEINE_WAERMEMESSUNG)],
    )
    assert [z.grund for z in zeilen] == [
        GRUND_STROM_NICHT_JE_FUNKTION,
        f"Bosch: {GRUND_KEINE_WAERMEMESSUNG}",
    ]


def test_die_waerme_zelle_traegt_ihren_grund():
    """**R-4 auch an der Mengen-Spalte** — der letzte Strich ohne Grund.

    Gemessen nach dem ersten Bau: Im Block blieb **eine** Zelle unerklärt, die
    Wärme der Klimaanlage. Der Grund steht nicht daneben, er wird **abgeleitet**:
    Steht Strom und keine Wärme, sperrt ``arbeitszahl`` genau an ``q <= 0``, und
    ihr Grund ist die Aussage über die fehlende Wärme.
    """
    zeilen = geraete_zeilen([
        kennzahlen_aus_mengen(_mengen(
            inv_id=14, name="Bosch", strom_kwh=74.2, waerme_kwh=0.0,
            waerme_achsen=wp_waerme_achsen(_KLIMA),
        )),
    ])
    assert zeilen[0].waerme_kwh is None
    assert zeilen[0].waerme_grund == GRUND_KEINE_WAERMEMESSUNG


def test_eine_vorhandene_waerme_bekommt_keinen_grund():
    """Gegenprobe — eine Zahl erklärt sich selbst.

    ⭐ **Geschärft nach einem stillen Sprengsatz** (S16, 15.09.2026): Die erste
    Fassung nahm ein Gerät mit sauberer Gesamtzahl. Die Bedingung
    ``m.waerme_kwh <= 0`` zu entfernen blieb dort **grün** — es gab schlicht
    keinen Grund, der hätte durchsickern können. Diese Lage hat einen: Die
    Wärme steht als **Zahl** in der Zelle und ist trotzdem **abgeleitet**, also
    sperrt die Gesamt-Arbeitszahl. Nur so misst die Probe den Riegel.
    """
    zeilen = geraete_zeilen([
        kennzahlen_aus_mengen(_mengen(
            inv_id=4, name="Daikin", strom_kwh=90.0, waerme_kwh=440.0,
        )),
        kennzahlen_aus_mengen(_mengen(
            inv_id=5, name="Geschätzt", strom_kwh=90.0, waerme_kwh=315.0,
            waerme_abgeleitet=True,
        )),
    ])
    je = {z.name: z for z in zeilen}
    assert je["Daikin"].waerme_kwh == pytest.approx(440.0)
    assert je["Daikin"].waerme_grund is None
    # Die Zahl steht da — der Sperrgrund der Kennzahl gehört nicht an sie.
    assert je["Geschätzt"].waerme_kwh == pytest.approx(315.0)
    assert je["Geschätzt"].jaz is None and je["Geschätzt"].jaz_grund
    assert je["Geschätzt"].waerme_grund is None


def test_die_tabelle_traegt_die_achsen_jedes_geraets():
    """Der Vertrag zur Anzeige — ohne ihn kann sie „leer" nicht von „—" trennen."""
    zeilen = geraete_zeilen([
        kennzahlen_aus_mengen(_mengen(
            inv_id=7, name="Stiebel", strom_kwh=1.45, waerme_kwh=4.8,
            warmwasser_kwh=4.8, waerme_achsen=wp_waerme_achsen(_BRAUCHWASSER),
        )),
    ])
    assert zeilen[0].achsen == [WARMWASSER]
