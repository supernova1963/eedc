"""R2 je Funktion — die Trennlinie ist die Abgrenzung, nicht die Bauart.

**SOLL Wärme/Klima §3.2b (10.09.2026).** Bis hierher legte
``arbeitszahl_je_funktion`` eine Abgrenzungs-Verletzung unbesehen auf **beide**
Zeilen. Für die Anwender-Angabe (Heizstab, bivalenter Erzeuger) und den
Zeitraum-Versatz ist das richtig; für **gemischte Bauarten** und **Geräte ohne
Wärme** war es eine Übersperre: Die Zahl existierte und wurde unterdrückt.

⭐ **Der Melder-Fall (dietmar1968, Fixture A5):** Wärmepumpe mit getrennter
Strommessung neben einer Split-Klimaanlage. Cockpit zeigte drei Striche, während
der Komponenten-Hub für dieselben Geräte längst 3,0 und 2,5 auswies.

⛔ **Warum die Regel BEIDSEITIG zählt und nicht „jedes Gerät mit Strom liefert
auch Wärme".** Die einseitige Fassung fängt nur den Nenner. Der Zähler kippt
genauso — und in die teurere Richtung, weil dann eine **zu hohe** Kennzahl
erscheint statt gar keiner:

* ``heizenergie_kwh`` trägt nur ``!brauchwasser`` (``field_definitions.py``),
  eine Split-Klimaanlage darf also Heizwärme melden.
* ``strom_warmwasser_kwh`` wird **ungefiltert** gelesen
  (``imd_monatsaggregat.py``, mit ausdrücklicher Begründung), und bis zum
  22.08.2026 wurde das Feld einer Klimaanlage mit getrennter Strommessung
  angeboten — Altbestand steht dort.

Schwesterdatei: ``test_soll_waerme_klima_simulation_anlagen.py`` (A5 selbst).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    ARBEITSZAHL_FUNKTIONEN,
    GRUND_BAUARTEN_GEMISCHT,
    GRUND_FREMDSTROM,
    GRUND_FUNKTION_NICHT_DECKUNGSGLEICH,
    GRUND_FUNKTION_VERSCHIEDENE_MONATE,
    abgrenzung_je_funktion,
    arbeitszahl_je_funktion,
    hub_hilft,
)
from backend.models import Anlage, Investition  # noqa: F401
from backend.models.investition import InvestitionMonatsdaten

JAHR, MONAT = 2025, 7


async def _anlage(db, name: str) -> Anlage:
    a = Anlage(anlagenname=name, leistung_kwp=10.0, installationsdatum=date(2025, 1, 1))
    db.add(a)
    await db.flush()
    return a


async def _geraet(db, anlage, bezeichnung: str, parameter: dict, daten: dict, monat: int = MONAT):
    inv = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung=bezeichnung,
        anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=12000.0,
        parameter=parameter,
    )
    db.add(inv)
    await db.flush()
    db.add(InvestitionMonatsdaten(
        investition_id=inv.id, jahr=JAHR, monat=monat, verbrauch_daten=daten,
    ))
    return inv


async def _monat(db, anlage_id, monat: int = MONAT):
    from backend.api.routes.aktueller_monat import get_aktueller_monat
    return await get_aktueller_monat(anlage_id, jahr=JAHR, monat=monat, db=db)


async def _jahr(db, anlage_id):
    from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht
    return await get_cockpit_uebersicht(anlage_id, jahr=JAHR, db=db)


_WP = {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz", "getrennte_strommessung": True}
_KLIMA = {"wp_art": "luft_luft", "effizienz_modus": "gesamt_jaz"}


# ═══ Die Layer-Regel für sich ═══════════════════════════════════════════════

_SAUBER = {f: True for f in ARBEITSZAHL_FUNKTIONEN}


def test_anwender_angabe_trifft_weiterhin_alle_funktionen():
    """Ein Heizstab auf dem Zähler sperrt alles — die Angabe trägt keine Funktion."""
    je = abgrenzung_je_funktion(
        abgrenzung_stoerung="fremdstrom", deckung_je_funktion=_SAUBER,
    )
    assert all(je[f] == GRUND_FREMDSTROM for f in ARBEITSZAHL_FUNKTIONEN)


def test_zeitraum_versatz_trifft_weiterhin_alle_funktionen():
    je = abgrenzung_je_funktion(
        bauarten_gemischt=True, zeitraum_versetzt=True, deckung_je_funktion=_SAUBER,
    )
    assert all(je[f] is not None for f in ARBEITSZAHL_FUNKTIONEN)


def test_bauart_trifft_nur_die_vermischten_funktionen():
    je = abgrenzung_je_funktion(
        bauarten_gemischt=True,
        deckung_je_funktion={"heizen": True, "warmwasser": True, "kuehlen": False},
    )
    assert je["heizen"] is None and je["warmwasser"] is None
    assert je["kuehlen"] == GRUND_BAUARTEN_GEMISCHT


def test_ungleiche_geraetezahl_ohne_andere_lage_bekommt_ihren_eigenen_grund():
    """⭐ Die Lage, die es bis zum 10.09. GAR NICHT gab (8ear).

    Keine Bauart-Mischung, keine Anwender-Angabe, alle Geräte melden Wärme —
    und trotzdem stammen Zähler und Nenner dieser Funktion von verschieden
    vielen Geräten. Vorher stand dort eine **falsche Zahl** ohne jeden Hinweis.
    """
    je = abgrenzung_je_funktion(
        deckung_je_funktion={"heizen": True, "warmwasser": False, "kuehlen": None},
    )
    assert je["warmwasser"] == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
    assert je["heizen"] is None
    # (0, 0) ist KEINE Verletzung — die Funktion gibt es nicht.
    assert je["kuehlen"] is None


def test_fehlender_waermezaehler_bleibt_beim_besseren_satz():
    """``(n, 0)`` ist keine Abgrenzungs-Verletzung — dafür hat `arbeitszahl`
    den genaueren Satz („kein Wärmemengenzähler zugeordnet")."""
    je = abgrenzung_je_funktion(deckung_je_funktion={"heizen": None})
    assert je["heizen"] is None


def test_ohne_angabe_bleibt_der_default_bitgleich():
    """``geraete_je_funktion=None`` sperrt weiter alles — so rufen die Hub-Pfade."""
    je = abgrenzung_je_funktion(bauarten_gemischt=True)
    assert all(je[f] == GRUND_BAUARTEN_GEMISCHT for f in ARBEITSZAHL_FUNKTIONEN)
    je = arbeitszahl_je_funktion(
        heizung_kwh=300.0, strom_heizen_kwh=100.0,
        warmwasser_kwh=100.0, strom_warmwasser_kwh=40.0,
        hat_split=True, abgrenzung_verletzt=GRUND_BAUARTEN_GEMISCHT,
    )
    assert je.heizen.wert is None and je.heizen.grund == GRUND_BAUARTEN_GEMISCHT
    assert je.warmwasser.wert is None


def test_freigegebene_funktion_rechnet_die_gesperrte_nicht():
    je = arbeitszahl_je_funktion(
        heizung_kwh=300.0, strom_heizen_kwh=100.0,
        warmwasser_kwh=100.0, strom_warmwasser_kwh=40.0,
        hat_split=True, abgrenzung_verletzt=GRUND_BAUARTEN_GEMISCHT,
        abgrenzung_je_funktion_grund={"heizen": GRUND_BAUARTEN_GEMISCHT, "warmwasser": None},
    )
    assert je.heizen.wert is None and je.heizen.grund == GRUND_BAUARTEN_GEMISCHT
    assert je.warmwasser.wert == pytest.approx(2.5)


# ═══ Der Melder-Fall, end to end ════════════════════════════════════════════

@pytest.mark.asyncio
async def test_a5_zeigt_je_funktion_in_monat_und_jahr(db):
    """dietmars Bauform: WP + Split-Klima ⇒ Heizen 3,0 · Warmwasser 2,5.

    Die Klimaanlage trägt ihre 200 kWh in ``stromverbrauch_kwh`` — das gehört zu
    **keiner** Funktion und steht in keinem der beiden Quotienten.
    """
    a = await _anlage(db, "A5")
    await _geraet(db, a, "Wärmepumpe", dict(_WP), {
        "strom_heizen_kwh": 800.0, "strom_warmwasser_kwh": 400.0,
        "heizenergie_kwh": 2400.0, "warmwasser_kwh": 1000.0,
    })
    await _geraet(db, a, "Klimaanlage", dict(_KLIMA), {"stromverbrauch_kwh": 200.0})
    await db.commit()

    m = await _monat(db, a.id)
    assert m.wp_jaz_heizen == pytest.approx(3.0) and m.wp_jaz_heizen_grund is None
    assert m.wp_jaz_warmwasser == pytest.approx(2.5) and m.wp_jaz_warmwasser_grund is None
    # ⚠ **Die ANLAGENWEITE Zahl ist KEINE Geräte-Kennzahl** — sie mischt den
    # Strom beider Geräte mit der Wärme eines. Die Substanz dieser Zeile ist
    # unverändert; ihr Wortlaut nicht: Seit **E1b** (14.09.2026) steht statt
    # eines Strichs mit Grund eine **untere Schranke**, die genau das sagt.
    # 3400 kWh Wärme ÷ 1400 kWh Strom = 2,43 — der wahre Wert der Wärmepumpe
    # liegt darüber, weil die 200 kWh der Klimaanlage im Nenner stehen.
    assert m.wp_jaz == pytest.approx(3400 / 1400)
    assert m.wp_jaz_ist_schranke is True
    assert m.wp_jaz_schranke_hinweis == (
        "Klimaanlage: Strom ohne Wärmemessung enthalten"
    )
    # ⛔ **Und deshalb KEIN Grund mehr an dieser Kachel**: Ein Grund hieße „es
    # gibt die Zahl nicht", und es gibt sie.
    assert m.wp_jaz_grund is None

    j = await _jahr(db, a.id)
    assert j.wp_jaz_heizen == pytest.approx(3.0)
    assert j.wp_jaz_warmwasser == pytest.approx(2.5)


# ═══ Die vier Fälle, die WEITERHIN sperren müssen ═══════════════════════════

@pytest.mark.asyncio
async def test_klima_mit_heizwaerme_sperrt_heizen_weiter(db):
    """Zähler zu groß: die Klimaanlage meldet Heizwärme, aber keinen Heizstrom.

    ``heizenergie_kwh`` trägt kein ``!luft_luft``. Eine einseitige Regel
    („jedes Gerät mit Strom liefert auch Wärme") gäbe hier frei und zeigte
    **4,25 statt 3,75** — eine zu hohe Zahl ist teurer als gar keine.
    """
    a = await _anlage(db, "Klima mit Heizwärme")
    await _geraet(db, a, "Wärmepumpe", dict(_WP), {
        "strom_heizen_kwh": 800.0, "heizenergie_kwh": 3000.0,
    })
    await _geraet(db, a, "Klimaanlage", dict(_KLIMA), {
        "stromverbrauch_kwh": 200.0, "heizenergie_kwh": 400.0,
    })
    await db.commit()
    m = await _monat(db, a.id)
    assert m.wp_jaz_heizen is None
    assert m.wp_jaz_heizen_grund == GRUND_BAUARTEN_GEMISCHT


@pytest.mark.asyncio
async def test_klima_mit_altbestand_warmwasserstrom_sperrt_warmwasser_weiter(db):
    """Nenner zu groß: gespeicherter ``strom_warmwasser_kwh`` an der Klimaanlage.

    Das Feld wird ungefiltert gelesen, und bis 22.08.2026 wurde es einer
    Klimaanlage mit getrennter Strommessung angeboten.
    """
    a = await _anlage(db, "Klima mit Altbestand")
    await _geraet(db, a, "Wärmepumpe", dict(_WP), {
        "strom_warmwasser_kwh": 400.0, "warmwasser_kwh": 1000.0,
    })
    await _geraet(db, a, "Klimaanlage",
                  {**_KLIMA, "getrennte_strommessung": True},
                  {"strom_warmwasser_kwh": 100.0})
    await db.commit()
    m = await _monat(db, a.id)
    assert m.wp_jaz_warmwasser is None
    assert m.wp_jaz_warmwasser_grund is not None


@pytest.mark.asyncio
async def test_brauchwasser_wp_sperrt_warmwasser(db):
    """⭐ Der Fall, der bis hierher eine FALSCHE Zahl zeigte (8ear).

    Eine Brauchwasser-Wärmepumpe zählt als Luft-Wasser-Gerät und meldet Wärme —
    damit greift **keine** der bisherigen Sperren: ``bauarten_gemischt`` ist
    False (beide Luft-Wasser) und ``waerme_deckt_nicht_alle_geraete`` ebenfalls
    (beide melden Wärme). Ihre Warmwasser-Wärme landete im Zähler, ihr
    ungeteilter Strom in keinem Nenner ⇒ die Warmwasser-Arbeitszahl war zu hoch,
    **ohne Grund daneben**. Die Mengengleichheit fängt ihn.
    """
    a = await _anlage(db, "WP + Brauchwasser-WP")
    await _geraet(db, a, "Wärmepumpe", dict(_WP), {
        "strom_warmwasser_kwh": 400.0, "warmwasser_kwh": 1000.0,
        "strom_heizen_kwh": 800.0, "heizenergie_kwh": 2400.0,
    })
    await _geraet(db, a, "Brauchwasser-WP",
                  {"wp_art": "brauchwasser", "effizienz_modus": "gesamt_jaz"},
                  {"stromverbrauch_kwh": 300.0, "warmwasser_kwh": 900.0})
    await db.commit()
    m = await _monat(db, a.id)
    # 1900 ÷ 400 = 4,75 wäre die Zahl gewesen, die hier stand.
    assert m.wp_jaz_warmwasser is None, "Warmwasser-Wärme von zwei Geräten, Strom von einem"
    # Heizen bleibt sauber — die Brauchwasser-WP heizt nicht.
    assert m.wp_jaz_heizen == pytest.approx(3.0)


@pytest.mark.asyncio
async def test_heizstab_angabe_sperrt_weiterhin_beide(db):
    """Die Anwender-Angabe trägt keine Funktion ⇒ keine wird freigegeben."""
    a = await _anlage(db, "Heizstab am Zähler")
    await _geraet(db, a, "Wärmepumpe", {**_WP, "abgrenzung": "fremdstrom"}, {
        "strom_heizen_kwh": 800.0, "heizenergie_kwh": 2400.0,
        "strom_warmwasser_kwh": 400.0, "warmwasser_kwh": 1000.0,
    })
    await db.commit()
    m = await _monat(db, a.id)
    assert m.wp_jaz_heizen is None and m.wp_jaz_heizen_grund == GRUND_FREMDSTROM
    assert m.wp_jaz_warmwasser is None and m.wp_jaz_warmwasser_grund == GRUND_FREMDSTROM


@pytest.mark.asyncio
async def test_sommermonat_ohne_heizbetrieb_sperrt_das_jahr_nicht(db):
    """⚠ Die Falle beim Jahres-Pfad.

    Ein Monat ohne Heizbetrieb ist nicht „unsauber abgegrenzt" — er hat die
    Funktion nicht. Wer im Jahr ``all(...)`` über **alle** Monate bildet, sperrt
    die Jahres-Heizzahl an jedem Juli.
    """
    a = await _anlage(db, "Winter + Sommer")
    wp = await _geraet(db, a, "Wärmepumpe", dict(_WP), {
        "strom_heizen_kwh": 800.0, "heizenergie_kwh": 2400.0,
    }, monat=1)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=7,
        verbrauch_daten={"strom_warmwasser_kwh": 400.0, "warmwasser_kwh": 1000.0},
    ))
    await _geraet(db, a, "Klimaanlage", dict(_KLIMA), {"stromverbrauch_kwh": 200.0}, monat=7)
    await db.commit()
    j = await _jahr(db, a.id)
    assert j.wp_jaz_heizen == pytest.approx(3.0), "Januar trägt die Heizzahl, Juli hat keine"


@pytest.mark.asyncio
async def test_monat_mit_waerme_ohne_funktionsstrom_sperrt_das_jahr(db):
    """⭐ Den Fall hat der Sprengsatz gefunden, nicht der Entwurf.

    Januar sauber (800 kWh Strom, 2400 kWh Wärme), Februar trägt 600 kWh Wärme
    **ohne** Heizstrom. Die Jahressumme nimmt die Wärme mit und den Strom nicht:
    3000 ÷ 800 = **3,75** statt 3,0.

    ⛔ **Die Gerätezahlen des Jahres sehen das nicht** — in beiden Monaten ist
    genau ein Gerät beteiligt. Deshalb faltet der Jahres-Pfad die **Urteile je
    Monat** und nicht die Zahlen. Ein erster Entwurf verglich Maxima und war
    gegen diesen Fall blind; der Sprengsatz dazu blieb still, und genau das war
    der Befund.

    ⚠ **Wortlaut umgestellt am 12.09.2026 (N-438), Substanz unverändert.** Die
    Probe hielt bis dahin `GRUND_FUNKTION_NICHT_DECKUNGSGLEICH` fest — an einer
    Anlage mit **einem** Gerät. Die Sperre war richtig (3,75 wäre die Zahl
    gewesen, und sie erscheint weiterhin nicht), der Grund sprach aber von
    „verschiedenen Geräten", wo der Unterschied im **Zeitraum** liegt. Was diese
    Probe sichert, ist unverändert: **die Sperre greift, und sie nennt einen
    Grund**; welcher, sagt jetzt die Lage.
    """
    a = await _anlage(db, "Waerme ohne Funktionsstrom")
    wp = await _geraet(db, a, "WP", dict(_WP), {
        "strom_heizen_kwh": 800.0, "heizenergie_kwh": 2400.0,
    }, monat=1)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=2,
        verbrauch_daten={"heizenergie_kwh": 600.0},
    ))
    await db.commit()
    j = await _jahr(db, a.id)
    assert j.wp_jaz_heizen is None, "3,75 waere die Zahl gewesen"
    assert j.wp_jaz_heizen_grund == GRUND_FUNKTION_VERSCHIEDENE_MONATE


# ═══ N-438 — der Grund nennt die Lage, die wirklich vorliegt ════════════════
#
# Die verletzte Deckung hat ZWEI Ursachen, und `deckung_aus_geraeten` liefert
# für beide `False` (gemessen: `(∅, {1})` und `({1}, {1, 2})`). Bis zum
# 12.09.2026 trug deshalb auch die Ein-Geräte-Anlage den Geräte-Satz.


@pytest.mark.asyncio
async def test_n438_ein_geraet_nennt_die_monate_nicht_die_geraete(db):
    """EIN Gerät, Heizstrom erst ab Juli: der Unterschied liegt im Zeitraum."""
    a = await _anlage(db, "N-438 ein Geraet")
    wp = await _geraet(db, a, "WP", dict(_WP), {"heizenergie_kwh": 1800.0}, monat=3)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=7,
        verbrauch_daten={"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0},
    ))
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_jaz_heizen is None, "6,0 waere die Zahl gewesen"
    assert j.wp_jaz_heizen_grund == GRUND_FUNKTION_VERSCHIEDENE_MONATE
    assert "Geräten" not in j.wp_jaz_heizen_grund


@pytest.mark.asyncio
async def test_n438_zwei_geraete_bleiben_beim_geraete_satz(db):
    """Zwei wärmemeldende Geräte, nur eines mit Heizstrom — der alte Satz stimmt.

    ⚠ **Die Fixture braucht ein ECHTES Über-Einander** (hier ``q = {A, B}``,
    ``e = {A}``). Ein erster Entwurf gab A nur Wärme und B nur Strom — damals
    verglich die Regel Anzahlen, ``(1, 1)`` urteilte `True`, und die Probe löste
    gar keine Sperre aus (gemessen 12.09.2026). ⭐ **Seit N-441 vergleicht
    `deckung_aus_geraeten` die Identitäten**, jener Entwurf wäre heute also
    ebenfalls gesperrt — aber mit derselben Aussage. Diese Fixture bleibt, weil
    sie die Teilmengen-Richtung trifft, die der Block-Satz beschreibt.
    """
    a = await _anlage(db, "N-438 zwei Geraete")
    await _geraet(db, a, "WP A", dict(_WP),
                  {"heizenergie_kwh": 2400.0, "strom_heizen_kwh": 800.0})
    await _geraet(db, a, "WP B", dict(_WP), {"heizenergie_kwh": 600.0})
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


@pytest.mark.asyncio
async def test_n438_mischfall_die_geraete_lage_gewinnt(db):
    """Zwei Geräte UND ein stromloser Monat: die grundsätzlichere Störung zählt.

    ⛔ Ein erster Regel-Entwurf hätte hier seinen eigenen Auslöser geschluckt —
    ein Monat mit `e == 0 ∧ q > 0` hat **immer** `e != q`. Die Geräte-Lage fragt
    deshalb nur Monate, die überhaupt Strom tragen.
    """
    a = await _anlage(db, "N-438 Mischfall")
    wp_a = await _geraet(db, a, "WP A", dict(_WP),
                         {"heizenergie_kwh": 2400.0, "strom_heizen_kwh": 800.0})
    await _geraet(db, a, "WP B", dict(_WP), {"heizenergie_kwh": 600.0})
    db.add(InvestitionMonatsdaten(
        investition_id=wp_a.id, jahr=JAHR, monat=3,
        verbrauch_daten={"heizenergie_kwh": 600.0},
    ))
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


@pytest.mark.asyncio
async def test_n438_ohne_jeden_heizstrom_bleibt_die_maskierung(db):
    """Kein Monat trägt Heizstrom ⇒ der Nenner fehlt ganz.

    `arbeitszahl` prüft `e_gesamt <= 0` **vor** der Abgrenzung; dieser Satz ist
    der genauere (S3) und darf nicht von der neuen Regel verdrängt werden.
    ⚠ `getrennte_strommessung` ist gesetzt — sonst käme das `hat_split`-Tor davor.
    """
    a = await _anlage(db, "N-438 ohne Strom")
    wp = await _geraet(db, a, "WP", dict(_WP), {"heizenergie_kwh": 1800.0}, monat=3)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=7,
        verbrauch_daten={"heizenergie_kwh": 1800.0},
    ))
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_jaz_heizen is None
    assert j.wp_jaz_heizen_grund == "kein Stromverbrauch erfasst"


@pytest.mark.asyncio
async def test_n438_gilt_auch_fuer_warmwasser_und_kuehlen(db):
    """Dieselbe Lage an den beiden anderen Funktionen — deshalb „Nutzenergie".

    Beim Kühlen ist der Zähler eine **Kälte**menge (Bauschnitt 6b); ein Satz mit
    dem Wort „Wärme" wäre dort falsch.
    """
    a = await _anlage(db, "N-438 WW")
    wp = await _geraet(db, a, "WP", dict(_WP), {"warmwasser_kwh": 600.0}, monat=3)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=7,
        verbrauch_daten={"warmwasser_kwh": 600.0, "strom_warmwasser_kwh": 250.0},
    ))

    b = await _anlage(db, "N-438 Kuehlen")
    klima = await _geraet(db, b, "Klima", dict(_KLIMA),
                          {"betriebsart_nutzenergie_kuehlen_kwh": 900.0}, monat=3)
    db.add(InvestitionMonatsdaten(
        investition_id=klima.id, jahr=JAHR, monat=7,
        verbrauch_daten={"betriebsart_nutzenergie_kuehlen_kwh": 900.0,
                         "betriebsart_strom_kuehlen_kwh": 300.0},
    ))
    await db.commit()

    assert (await _jahr(db, a.id)).wp_jaz_warmwasser_grund == GRUND_FUNKTION_VERSCHIEDENE_MONATE
    kuehl_grund = (await _jahr(db, b.id)).wp_jaz_kuehlen_grund
    assert kuehl_grund == GRUND_FUNKTION_VERSCHIEDENE_MONATE
    assert "Wärme" not in kuehl_grund


def test_n438_der_neue_grund_fuehrt_nicht_in_den_hub():
    """Der Hub rechnet je Gerät und über dieselben Monate — er beantwortet die
    Perioden-Lage nicht. Ein Link dorthin wäre ein Weg ins Nichts."""
    assert hub_hilft(GRUND_FUNKTION_VERSCHIEDENE_MONATE) is False
    assert hub_hilft(GRUND_FUNKTION_NICHT_DECKUNGSGLEICH) is True


# ═══ Bauschnitt 3 — der Weg zum Hub, aber nur wo er hilft ═══════════════════

def test_hub_hilft_nur_bei_gruenden_die_der_hub_beantwortet():
    """⛔ Ein Link auf eine Sicht, die dasselbe sagt, ist schlechter als keiner.

    Gemessen an den Hub-Aufrufern (`dashboards.py`): Sie bekommen nur die
    Anwender-Angabe und das Abgeleitet-Flag. Alles, was aus dem Zusammenspiel
    **mehrerer** Geräte entsteht, kennt der Hub gar nicht — dort steht die Zahl.
    """
    from backend.core.berechnungen.waermepumpe_kennzahl import (
        GRUND_GERAETE_OHNE_WAERME, GRUND_KEINE_KAELTEMENGE, GRUND_ZEITRAUM, hub_hilft,
    )
    # Der Hub rechnet je Gerät ⇒ er zeigt die Zahl.
    assert hub_hilft(GRUND_BAUARTEN_GEMISCHT)
    assert hub_hilft(GRUND_GERAETE_OHNE_WAERME)
    assert hub_hilft(GRUND_ZEITRAUM)
    assert hub_hilft(GRUND_FUNKTION_NICHT_DECKUNGSGLEICH)
    # Der Hub sperrt genauso ⇒ kein Weg dorthin.
    assert not hub_hilft(GRUND_FREMDSTROM)
    assert not hub_hilft(GRUND_KEINE_KAELTEMENGE)
    assert not hub_hilft(None)
    # EIN hilfreicher Grund genügt — der Link ist ein Element des Blocks.
    assert hub_hilft(GRUND_FREMDSTROM, None, GRUND_BAUARTEN_GEMISCHT)


@pytest.mark.asyncio
async def test_a5_bekommt_den_weg_zum_hub(db):
    """Die anlagenweite Zahl ist eine Schranke — und der Weg zum Hub bleibt.

    ⭐ **Wortlaut umgestellt, Substanz gehalten** (E1b, 14.09.2026): Geprüft war
    *„die Gesamtzahl bleibt gesperrt UND der Link erscheint"*. Die erste Hälfte
    gibt es nicht mehr — die Zahl erscheint als Schranke. Die zweite Hälfte ist
    die eigentliche Aussage des Falls und gilt unverändert: Bei gemischten
    Bauarten führt ein Weg in den Hub, weil dort **jedes Gerät für sich** steht.
    """
    a = await _anlage(db, "A5 Hub-Link")
    await _geraet(db, a, "Wärmepumpe", dict(_WP), {
        "strom_heizen_kwh": 800.0, "heizenergie_kwh": 2400.0,
    })
    await _geraet(db, a, "Klimaanlage", dict(_KLIMA), {"stromverbrauch_kwh": 200.0})
    await db.commit()
    m = await _monat(db, a.id)
    assert m.wp_jaz is not None and m.wp_jaz_ist_schranke is True
    assert m.wp_jaz_grund is None
    assert m.wp_hub_hilft is True
    j = await _jahr(db, a.id)
    assert j.wp_hub_hilft is True


@pytest.mark.asyncio
async def test_heizstab_bekommt_KEINEN_weg_zum_hub(db):
    """Der Hub sperrt bei gemeldeter Störung genauso — ein Link wäre vergeblich."""
    a = await _anlage(db, "Heizstab ohne Link")
    await _geraet(db, a, "Wärmepumpe", {**_WP, "abgrenzung": "fremdstrom"}, {
        "strom_heizen_kwh": 800.0, "heizenergie_kwh": 2400.0,
    })
    await db.commit()
    m = await _monat(db, a.id)
    assert m.wp_jaz_heizen_grund == GRUND_FREMDSTROM
    assert m.wp_hub_hilft is False
