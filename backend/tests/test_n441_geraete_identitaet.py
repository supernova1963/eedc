"""N-441 — die Deckung vergleicht **Geräte**, nicht Anzahlen.

**SOLL Wärme/Klima §3.2b (R2), §3.3 (S1/S3), §4.2 · ADR-002/P12.** Bis zum
12.09.2026 fragte eedc auf beiden Ebenen die falsche Frage:

* **Je Funktion** verglich ``deckung_aus_geraetezahlen`` zwei ``int``. Wärme
  2400 kWh von Gerät A und Heizstrom 800 kWh von Gerät B ergaben ``1 == 1``,
  also „deckt sich" — im Cockpit stand **3,0 ohne jeden Grund**, und an der
  Community-Grenze ging der Monat als *belastbar* hinaus.
* **Auf Block-Ebene** war die Regel zusätzlich **einseitig**
  (``geraete_mit_waerme < geraete_mit_strom``): Wärme ohne Strom kippte die
  Zahl nach oben und blieb unbemerkt (**3,75** statt 3,0, ausgeliefert mit
  v4.0.44).

⭐ **Dieselbe Ursache trug drei weitere Lagen, alle gemessen:**

* Die Block-Ebene kannte die **Perioden**-Unterscheidung nicht, die N-438 einen
  Tag zuvor für die Funktions-Ebene eingeführt hatte ⇒ *Cockpit → Jahr* **und**
  Komponenten-Hub zeigten **6,0**, wo ein Monat Wärme ohne Strom trägt.
* Eine Geräte-Kreuzung **über** Monate (Wärme von Gerät 1 im März, Strom von
  Gerät 2 im Juli) sieht keine je-Monat-Faltung ⇒ **4,0** ohne Grund.
* In der Gegenrichtung **übersperrte** dieselbe Regel: ein Sommermonat mit
  gemessener Null-Wärme und Standby-Strom nahm der Anlage ihre Gesamtzahl mit
  dem Satz „nicht alle Geräte melden Wärme" — während die Heiz-Arbeitszahl
  daneben 2,77 anzeigte (S1-Verstoß).

⛔ **Was hier NICHT geprüft wird, und warum:** Ein unvollständiger Nenner
**innerhalb eines Geräts** (Warmwasser-Wärme ohne Warmwasser-Strom im selben
Monat ⇒ Gesamtzahl 4,0 statt 3,0) ist keine Geräte-Frage — die Block-Regeln
arbeiten auf Geräte-Mengen, die Verletzung sitzt in der Funktions-Menge
desselben Geräts. Sie gehört an den **Melder** (Daten-Checker), nicht an die
Zahl, und ist ein eigenes Paket.

Schwesterdateien: ``test_r2_je_funktion.py`` (R2 je Funktion, N-427/N-438),
``test_soll_waerme_klima_achse2_abgrenzung.py`` (die Block-Regel selbst),
``test_bs6_kaelte_je_tag.py`` (die Kühl-Deckung im Tag) und
``test_community_jaz_belastbar_p12.py`` (dieselbe Sperre an der Repo-Grenze).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    GRUND_BAUARTEN_GEMISCHT,
    GRUND_FUNKTION_NICHT_DECKUNGSGLEICH,
    GRUND_FUNKTION_VERSCHIEDENE_MONATE,
    GRUND_GERAETE_OHNE_WAERME,
    GRUND_GERAETE_VERSCHIEDEN,
    GRUND_GERAETE_VERSCHIEDENE_MONATE,
    GRUND_ZEITRAUM,
    abgrenzungs_grund,
    deckung_aus_geraeten,
    hub_hilft,
)
from backend.models import Anlage, Investition, Monatsdaten  # noqa: F401
from backend.models.investition import InvestitionMonatsdaten
from backend.models.sensor_snapshot import SensorSnapshot  # noqa: F401
from backend.services.community_service import prepare_community_data
from backend.tests.test_bs6_kaelte_je_tag import (
    DATUM as TAG_DATUM,
)
from backend.tests.test_bs6_kaelte_je_tag import (
    KAELTE,
    STROM_K,
    _tageszaehler,
    _tageszeile,
)
from backend.tests.test_r2_je_funktion import (
    JAHR,
    MONAT,
    _WP,
    _anlage,
    _geraet,
    _jahr,
    _monat,
)


async def _hub(db, anlage_id) -> list[dict]:
    """Die Zusammenfassung je Gerät aus dem Komponenten-Hub."""
    from backend.api.routes.investitionen.dashboards import (
        get_waermepumpe_dashboard,
    )

    geraete = await get_waermepumpe_dashboard(
        anlage_id, strompreis_cent=None, db=db,
    )
    return [(g.zusammenfassung or {}) for g in geraete]


async def _community_anlage(db, geraete: list[dict]) -> int:
    """Eine Anlage, die den Community-Payload wirklich erreicht.

    ⚠ **Drei Filter, alle drei nötig** (``community_service._monatswert``):
    Zählerzeile, PV > 0 und ein **abgeschlossener** Kalendermonat. Ohne die
    PV-Investition liefert ``_monatswert`` ``None``, und eine Probe gegen einen
    nachgebildeten Ausdruck hätte nichts gemessen.
    """
    anlage = Anlage(anlagenname="N-441 Community", leistung_kwp=10.0,
                    installationsdatum=date(2025, 1, 1))
    db.add(anlage)
    await db.flush()
    db.add(Monatsdaten(anlage_id=anlage.id, jahr=JAHR, monat=MONAT,
                       einspeisung_kwh=400.0, netzbezug_kwh=100.0))
    pv = Investition(anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
                     leistung_kwp=10.0, anschaffungsdatum=date(2025, 1, 1),
                     anschaffungskosten_gesamt=12000.0)
    db.add(pv)
    await db.flush()
    db.add(InvestitionMonatsdaten(investition_id=pv.id, jahr=JAHR, monat=MONAT,
                                  verbrauch_daten={"pv_erzeugung_kwh": 1100.0}))
    for nr, daten in enumerate(geraete, start=1):
        await _geraet(db, anlage, f"WP {nr}", dict(_WP), daten)
    await db.commit()
    return anlage.id


def _monatswert(payload) -> dict:
    return next(
        m for m in payload["monatswerte"] if (m["jahr"], m["monat"]) == (JAHR, MONAT)
    )


# ══ Der Anlassfall: Wärme von A, Strom von B ════════════════════════════════
#
# `_WP` trägt `getrennte_strommessung` — ohne sie käme das `hat_split`-Tor vor
# die Funktions-Zeilen und die Probe misst die falsche Sperre.

async def _fall_a(db):
    """Gerät A meldet 2400 kWh Wärme, Gerät B 800 kWh Heizstrom."""
    a = await _anlage(db, "N-441 Anlassfall")
    await _geraet(db, a, "WP A", dict(_WP), {"heizenergie_kwh": 2400.0})
    await _geraet(db, a, "WP B", dict(_WP), {"strom_heizen_kwh": 800.0})
    await db.commit()
    return a


@pytest.mark.asyncio
async def test_p1_anlassfall_jahr_nennt_die_verschiedenen_geraete(db):
    """**P1.** *Cockpit → Jahr* zeigte 3,0 — aus der Wärme von A und dem Strom von B."""
    a = await _fall_a(db)

    j = await _jahr(db, a.id)

    assert j.wp_cop is None, "3,0 aus zwei verschiedenen Geräten war die Zahl"
    assert j.wp_cop_grund == GRUND_GERAETE_VERSCHIEDEN
    assert j.wp_jaz_heizen is None
    assert j.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


@pytest.mark.asyncio
async def test_p2_anlassfall_monat_sagt_dasselbe_wie_das_jahr(db):
    """**P2 (S1).** Dieselbe Größe, dieselbe Auskunft — auch in *Cockpit → Monat*."""
    a = await _fall_a(db)

    m = await _monat(db, a.id)

    assert m.wp_jaz is None
    assert m.wp_jaz_grund == GRUND_GERAETE_VERSCHIEDEN
    assert m.wp_jaz_heizen is None
    assert m.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


@pytest.mark.asyncio
async def test_p3_anlassfall_geht_nicht_mehr_als_belastbar_hinaus(db):
    """**P3.** Der Server rechnet nichts nach — er glaubt dem Flag.

    ⚠ Gemessen an der **echten** Route (``prepare_community_data``), nicht an
    einem nachgebildeten Ausdruck: Der Payload entsteht nur, wenn Zählerzeile,
    PV und abgeschlossener Monat zusammenkommen.
    """
    anlage_id = await _community_anlage(db, [
        {"heizenergie_kwh": 2400.0},
        {"strom_heizen_kwh": 800.0},
    ])

    juli = _monatswert(await prepare_community_data(db, anlage_id))

    assert juli["wp_jaz_belastbar"] is False, (
        "2400 ÷ 800 = 3,0 aus zwei Geräten wäre in fremde Regionalwerte gegangen"
    )
    # E1 — gesperrt ist die Kennzahl, nie die Menge.
    assert juli["wp_heizwaerme_kwh"] == pytest.approx(2400.0, abs=0.1)
    assert juli["wp_stromverbrauch_kwh"] == pytest.approx(800.0, abs=0.1)


@pytest.mark.asyncio
async def test_p4_zwei_vollstaendige_geraete_behalten_ihre_zahl(db):
    """**P4 · Gegenprobe.** Decken sich die Geräte, bleibt die Zahl.

    ⛔ **Der Sprengsatz muss „immer True" sein, nicht „immer False".** Eine
    Regel, die nie deckt, ließe diese Probe grün — sie prüft ja gerade, dass
    **nicht** gesperrt wird. Erst die Umkehrung („alles deckt sich") kippt sie.
    """
    a = await _anlage(db, "N-441 beide vollstaendig")
    await _geraet(db, a, "WP A", dict(_WP),
                  {"heizenergie_kwh": 2400.0, "strom_heizen_kwh": 800.0})
    await _geraet(db, a, "WP B", dict(_WP),
                  {"heizenergie_kwh": 600.0, "strom_heizen_kwh": 300.0})
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_cop == pytest.approx(2.73)
    assert j.wp_cop_grund is None
    assert j.wp_jaz_heizen == pytest.approx(2.73)
    assert j.wp_jaz_heizen_grund is None


@pytest.mark.asyncio
async def test_p5_gleich_viele_geraete_sind_nicht_dieselben(db):
    """**P5.** A trägt beides, B nur Wärme, C nur Strom ⇒ **(2, 2)**.

    ⭐ **Der Fall, der die Anzahl-Regel am deutlichsten widerlegt:** Beide Seiten
    tragen zwei Geräte, und trotzdem stammt die Wärme zur Hälfte von einem
    Gerät, dessen Strom fehlt.
    """
    a = await _anlage(db, "N-441 zwei zu zwei")
    await _geraet(db, a, "WP A", dict(_WP),
                  {"heizenergie_kwh": 2400.0, "strom_heizen_kwh": 800.0})
    await _geraet(db, a, "WP B", dict(_WP), {"heizenergie_kwh": 600.0})
    await _geraet(db, a, "WP C", dict(_WP), {"strom_heizen_kwh": 200.0})
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_cop is None, "3,0 war die Zahl (3000 ÷ 1000)"
    assert j.wp_cop_grund == GRUND_GERAETE_VERSCHIEDEN
    assert j.wp_jaz_heizen is None
    assert j.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


def test_p6_die_layer_regel_fuer_sich():
    """**P6.** Die fünf Lagen der Regel, einzeln."""
    assert deckung_aus_geraeten(frozenset(), frozenset({1})) is False
    assert deckung_aus_geraeten(frozenset({1}), frozenset()) is None
    assert deckung_aus_geraeten(frozenset(), frozenset()) is None
    assert deckung_aus_geraeten(frozenset({1}), frozenset({1})) is True
    # Die Lage, die es vor N-441 nicht gab: gleich viele, verschiedene Geräte.
    assert deckung_aus_geraeten(frozenset({1}), frozenset({2})) is False
    assert deckung_aus_geraeten(frozenset({1, 3}), frozenset({1, 2})) is False


@pytest.mark.asyncio
async def test_p7_ein_geraet_zwei_monate_sperrt_auch_die_gesamtzahl(db):
    """**P7.** Die N-438-Lage erreicht endlich die Block-Ebene — Jahr **und** Hub.

    März 1800 kWh Wärme ohne Strom, Juli 1800/600: Die Funktions-Zeile nannte
    seit N-438 die Monate, die **Gesamt**zahl zeigte daneben unbeirrt 6,0.
    """
    a = await _anlage(db, "N-441 Perioden Block")
    wp = await _geraet(db, a, "WP", dict(_WP), {"heizenergie_kwh": 1800.0}, monat=3)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=7,
        verbrauch_daten={"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0},
    ))
    await db.commit()

    j = await _jahr(db, a.id)
    hub = await _hub(db, a.id)

    assert j.wp_cop is None, "6,0 war die Zahl (3600 ÷ 600)"
    assert j.wp_cop_grund == GRUND_GERAETE_VERSCHIEDENE_MONATE
    assert "Geräten" not in j.wp_cop_grund, "es gibt nur EIN Gerät"
    # S1: der Hub sagt dasselbe wie das Cockpit.
    assert hub[0]["durchschnitt_cop"] is None
    assert hub[0]["durchschnitt_cop_grund"] == GRUND_GERAETE_VERSCHIEDENE_MONATE


@pytest.mark.asyncio
async def test_p8_ein_sommermonat_ohne_waerme_sperrt_nicht_mehr(db):
    """**P8.** Die Übersperre in der Gegenrichtung — gemessene Null ist keine Lücke.

    Januar 1800/600, Juli 0 kWh Wärme (gemessen) und 50 kWh Standby-Strom. Die
    Gesamtzahl war gesperrt („nicht alle Geräte melden Wärme" — bei **einem**
    Gerät), während die Heiz-Arbeitszahl daneben 2,77 anzeigte.
    """
    a = await _anlage(db, "N-441 Sommer-Standby")
    wp = await _geraet(db, a, "WP", dict(_WP),
                       {"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0},
                       monat=1)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=7,
        verbrauch_daten={"heizenergie_kwh": 0.0, "strom_heizen_kwh": 50.0},
    ))
    await db.commit()

    j = await _jahr(db, a.id)
    hub = await _hub(db, a.id)

    assert j.wp_cop == pytest.approx(2.77)
    assert j.wp_cop_grund is None
    # S1: dieselbe Größe, derselbe Wert — vorher „—" neben 2,77.
    assert j.wp_cop == j.wp_jaz_heizen
    assert hub[0]["durchschnitt_cop"] == pytest.approx(2.77)


@pytest.mark.asyncio
async def test_p9_die_block_lage_maskiert_den_funktions_grund_nicht(db):
    """**P9.** Zwei wärmemeldende Geräte, nur eines mit Heizstrom (``w ⊋ s``).

    ⛔ **Die Nicht-Maskierung ist die eigentliche Aussage.** Eine Block-Sperre
    überschreibt jeden Funktions-Grund (``global_grund or …``). Bekäme
    ``abgrenzung_je_funktion`` die neuen Block-Lagen mit, stünde an der
    Heiz-Zeile der allgemeine Block-Satz statt des konkreteren — ein
    S3-Rückschritt, und die fünf N-438-Proben fielen mit.
    """
    a = await _anlage(db, "N-441 Waerme ohne Strom")
    await _geraet(db, a, "WP A", dict(_WP),
                  {"heizenergie_kwh": 2400.0, "strom_heizen_kwh": 800.0})
    await _geraet(db, a, "WP B", dict(_WP), {"heizenergie_kwh": 600.0})
    await db.commit()

    j = await _jahr(db, a.id)
    m = await _monat(db, a.id)

    assert j.wp_cop is None, "3,75 war die Zahl (3000 ÷ 800) — ausgeliefert"
    assert j.wp_cop_grund == GRUND_GERAETE_VERSCHIEDEN
    assert m.wp_jaz_grund == GRUND_GERAETE_VERSCHIEDEN
    # Der Funktions-Grund bleibt der konkretere.
    assert j.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH

    # … und dieselbe Lage ging bis v4.0.44 als belastbar an die Community.
    anlage_id = await _community_anlage(db, [
        {"heizenergie_kwh": 2400.0, "strom_heizen_kwh": 800.0},
        {"heizenergie_kwh": 600.0},
    ])
    juli = _monatswert(await prepare_community_data(db, anlage_id))

    assert juli["wp_jaz_belastbar"] is False


@pytest.mark.asyncio
async def test_p10_der_tag_prueft_die_kuehl_geraete_ohne_sonderweg(db):
    """**P10.** Kälte von A, Kühlstrom von B — eines je Seite, aber nicht dasselbe.

    ⭐ **Der Tag konnte das schon**, aber mit anderthalb Regeln: Er reichte
    ``len(...)`` an die Layer-Regel und prüfte die Identität in einem ``if``
    daneben. Seit N-441 macht es die Regel selbst; diese Probe hält fest, dass
    beim Abbau des Sonderwegs nichts verloren ging.
    """
    from backend.api.routes.energie_profil.views import get_tag_detail
    from backend.tests.test_bs6_kaelte_je_tag import _anlage as _bs6_anlage
    from backend.tests.test_bs6_kaelte_je_tag import _geraet as _bs6_geraet

    a = await _bs6_anlage(db)
    kaelte_geraet = await _bs6_geraet(db, a)
    strom_geraet = await _bs6_geraet(db, a)
    _tageszaehler(db, a, kaelte_geraet, KAELTE, 30.0)
    _tageszaehler(db, a, strom_geraet, STROM_K, 10.0)
    _tageszeile(db, a, {kaelte_geraet.id: 4.0, strom_geraet.id: 12.0})
    a.sensor_mapping = dict(a.sensor_mapping)
    await db.commit()

    r = await get_tag_detail(a.id, TAG_DATUM, db)

    assert r.wp_jaz_kuehlen is None, "30 ÷ 10 = 3,0 aus zwei Geräten"
    assert r.wp_jaz_kuehlen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


def test_p11_der_hub_link_erscheint_nur_wo_der_hub_hilft():
    """**P11.** Die Positivliste unterscheidet die beiden neuen Gründe.

    ⭐ Bei **verschiedenen Geräten** sagt der Hub etwas anderes als das Cockpit:
    je Gerät, welche Seite fehlt. Bei **verschiedenen Monaten** sagt er seit
    N-441 dasselbe — dorthin zu verlinken wäre ein vergeblicher Weg.
    """
    assert hub_hilft(GRUND_GERAETE_VERSCHIEDEN) is True
    assert hub_hilft(GRUND_GERAETE_VERSCHIEDENE_MONATE) is False


@pytest.mark.asyncio
async def test_p12_strom_ohne_jede_waerme_behaelt_den_genaueren_satz(db):
    """**P12.** Ein Monat ganz ohne Wärme ist keine Geräte-Lage.

    ⚑ **Dokumentierte Verhaltensänderung an der Community-Grenze:** Das Flag
    trägt hier künftig ``True`` statt ``False``. Ohne Folge — der Server
    schließt Zeilen ohne Wärme an **allen fünf** Stellen selbst aus
    (``wp_jaz.py`` · ``stats.py`` · ``statistics.py`` · ``benchmark.py``), und
    der Client sendet WP-Felder ohnehin nur bei Strom > 0. Die lokale Auskunft
    bleibt der genauere Satz, der ``q ≤ 0`` **vor** jeder Abgrenzung prüft.
    """
    a = await _anlage(db, "N-441 nur Strom")
    await _geraet(db, a, "WP", dict(_WP), {"strom_heizen_kwh": 500.0})
    await db.commit()
    j = await _jahr(db, a.id)

    assert j.wp_cop is None
    assert j.wp_cop_grund == "kein Wärmemengenzähler zugeordnet"

    anlage_id = await _community_anlage(db, [{"strom_heizen_kwh": 500.0}])
    juli = _monatswert(await prepare_community_data(db, anlage_id))

    assert juli["wp_jaz_belastbar"] is True


def test_p13_die_kette_haengt_die_neuen_glieder_ans_ende():
    """**P13.** Kein bestehender Grund wechselt seinen Platz.

    ⭐ **Warum ans Ende, auch hinter dem Zeitraum:** Im Monat können
    ``geraete_verschieden`` und ``zeitraum_versetzt`` gemeinsam wahr sein
    (Vier-Quellen-Auflösung in ``aktueller_monat``). Vorn eingehängt hätte das
    neue Glied dort einen heute gezeigten Grund samt Hub-Link getauscht.
    """
    assert abgrenzungs_grund(
        bauarten_gemischt=True, geraete_verschieden=True,
    ) == GRUND_BAUARTEN_GEMISCHT
    assert abgrenzungs_grund(
        geraete_ohne_waerme=True, geraete_verschieden=True,
    ) == GRUND_GERAETE_OHNE_WAERME
    assert abgrenzungs_grund(
        zeitraum_versetzt=True, geraete_verschieden=True,
    ) == GRUND_ZEITRAUM
    # Untereinander: die grundsätzlichere Störung gewinnt (wie N-438).
    assert abgrenzungs_grund(
        geraete_verschieden=True, perioden_versetzt=True,
    ) == GRUND_GERAETE_VERSCHIEDEN
    assert abgrenzungs_grund(
        perioden_versetzt=True,
    ) == GRUND_GERAETE_VERSCHIEDENE_MONATE
    assert abgrenzungs_grund() is None


@pytest.mark.asyncio
async def test_p14_der_tag_sperrt_die_heizzahl_in_der_anlassform_mit(db):
    """**P14.** *Cockpit → Tag* erbt die Monats-Näherung — und zeigte 3,0.

    ⚠ **Die Näherung ist Absicht und bleibt es:** Die Tagesebene führt die Wärme
    nur als Anlagensumme, die Frage „steuern dieselben Geräte Zähler und Nenner
    bei?" ist dort strukturell unbeantwortbar. Die Antwort kommt aus dem Monat
    dieses Tages — kein zweiter Rechenweg, sondern derselbe SoT (ADR-002/P10).
    """
    from backend.api.routes.energie_profil.views import get_tag_detail
    from backend.tests.test_bs6_kaelte_je_tag import _anlage as _bs6_anlage

    a = await _bs6_anlage(db)
    waerme_geraet = Investition(
        anlage_id=a.id, typ="waermepumpe", bezeichnung="WP A",
        anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=12000.0,
        parameter=dict(_WP),
    )
    strom_geraet = Investition(
        anlage_id=a.id, typ="waermepumpe", bezeichnung="WP B",
        anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=12000.0,
        parameter=dict(_WP),
    )
    db.add_all([waerme_geraet, strom_geraet])
    await db.flush()
    # Der Monat dieses Tages trägt die Anlassform (Wärme A, Strom B) …
    db.add(InvestitionMonatsdaten(
        investition_id=waerme_geraet.id, jahr=TAG_DATUM.year, monat=TAG_DATUM.month,
        verbrauch_daten={"heizenergie_kwh": 2400.0},
    ))
    db.add(InvestitionMonatsdaten(
        investition_id=strom_geraet.id, jahr=TAG_DATUM.year, monat=TAG_DATUM.month,
        verbrauch_daten={"strom_heizen_kwh": 800.0},
    ))
    # … und der Tag selbst trägt beide Seiten, sonst gewinnt „kein Zähler".
    _tageszaehler(db, a, waerme_geraet, "heizenergie_kwh", 30.0)
    _tageszaehler(db, a, strom_geraet, "strom_heizen_kwh", 10.0)
    _tageszeile(db, a, {waerme_geraet.id: 2.0, strom_geraet.id: 10.0})
    a.sensor_mapping = dict(a.sensor_mapping)
    await db.commit()

    r = await get_tag_detail(a.id, TAG_DATUM, db)

    assert r.wp_jaz_heizen is None, "30 ÷ 10 = 3,0 aus zwei Geräten"
    assert r.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


@pytest.mark.asyncio
async def test_p15_standby_monat_ist_keine_geraete_frage(db):
    """**P15.** Die sechste N-438-Lage — ein Gerät, drei verschiedene Monate.

    Januar vollständig · Mai Wärme ohne Strom · Juli Strom ohne Wärme. Die
    Perioden-Weiche zählte den Juli (``e ≠ ∅, q = ∅``) als Geräte-Lage und nannte
    „von verschiedenen Geräten", wo es nur **eines** gibt — während
    ``_deckung_im_jahr`` denselben Monat längst als ``None`` ausklammert.
    """
    a = await _anlage(db, "N-441 Standby")
    wp = await _geraet(db, a, "WP", dict(_WP),
                       {"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0},
                       monat=1)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=5,
        verbrauch_daten={"heizenergie_kwh": 600.0},
    ))
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=7,
        verbrauch_daten={"heizenergie_kwh": 0.0, "strom_heizen_kwh": 50.0},
    ))
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_jaz_heizen_grund == GRUND_FUNKTION_VERSCHIEDENE_MONATE
    assert j.wp_cop_grund == GRUND_GERAETE_VERSCHIEDENE_MONATE
    assert "Geräten" not in j.wp_jaz_heizen_grund
    # Der Hub sagt dort dasselbe — ein Link dorthin wäre ein vergeblicher Weg.
    assert j.wp_hub_hilft is False


@pytest.mark.asyncio
async def test_p16_ein_zweitgeraet_das_nur_kuehlt_sperrt_nichts(db):
    """**P16.** Der Geräte-Kreis des Nenners wird **nach** dem Abzug gezählt.

    Gerät A heizt vollständig (2400/800), Gerät B kühlt ausschließlich
    (300 kWh Kühlstrom, 900 kWh Kälte). Bs Strom ist funktionsfremd und steht
    im Nenner der Gesamtzahl gar nicht — trotzdem sperrte er sie mit „nicht alle
    Geräte melden Wärme", während Heizen und Kühlen daneben beide 3,0 zeigten.
    """
    a = await _anlage(db, "N-441 nur Kuehlen")
    await _geraet(db, a, "WP A", dict(_WP),
                  {"heizenergie_kwh": 2400.0, "strom_heizen_kwh": 800.0})
    await _geraet(db, a, "Kuehler B",
                  {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz"},
                  {"stromverbrauch_kwh": 300.0,
                   "betriebsart_strom_kuehlen_kwh": 300.0,
                   "betriebsart_nutzenergie_kuehlen_kwh": 900.0})
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_cop == pytest.approx(3.0)
    assert j.wp_cop_grund is None
    assert j.wp_jaz_heizen == pytest.approx(3.0)
    assert j.wp_jaz_kuehlen == pytest.approx(3.0)


@pytest.mark.asyncio
async def test_p17_die_geraete_kreuzung_ueber_monate_nennt_die_geraete(db):
    """**P17.** Wärme von Gerät B im März, Strom von Gerät A im Juli.

    ⭐ **Kein einzelner Monat trägt beide Seiten** — die je-Monat-Faltung sieht
    hier strukturell nichts (gemessen: **4,0** ohne Grund). Die Vereinigungen
    über das Jahr tragen sie: ``W = {B}``, ``S = {A}``.

    ⚠ Ohne die Vereinigungs-Faltung stünde „aus verschiedenen Monaten" — richtig
    gesperrt, aber mit der harmloseren Hälfte begründet.

    ⛔ **Und die Faltung braucht BEIDE Richtungen, nicht ein ``W != S``.** Der
    zweite Teil misst das: Ein Zweitgerät, das erst später dazukommt und nie
    Wärme meldet, ergibt über die Monate ``W ⊊ S`` — dort ist der **gerichtete**
    Satz der richtige („im Nenner der Strom von allen, im Zähler die Wärme von
    weniger"), samt seinem Handgriff. Eine Regel, die nur Ungleichheit prüft,
    sperrt zwar auch, nennt aber die falsche Hälfte.
    """
    a = await _anlage(db, "N-441 Kreuzung")
    await _geraet(db, a, "WP B", dict(_WP), {"heizenergie_kwh": 600.0}, monat=3)
    await _geraet(db, a, "WP A", dict(_WP),
                  {"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0}, monat=7)
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_cop is None, "4,0 war die Zahl (2400 ÷ 600) — ausgeliefert"
    assert j.wp_cop_grund == GRUND_GERAETE_VERSCHIEDEN

    # Zweite Richtung: kein einzelner Monat trägt `w ⊊ s`, die Vereinigung schon.
    b = await _anlage(db, "N-441 Zweitgeraet spaeter")
    await _geraet(db, b, "WP A", dict(_WP),
                  {"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0}, monat=3)
    await _geraet(db, b, "Klima B", dict(_WP),
                  {"strom_heizen_kwh": 300.0}, monat=7)
    await db.commit()

    jb = await _jahr(db, b.id)

    # ⭐ **Wortlaut umgestellt, Substanz gehalten (E1b, 14.09.2026).** Geprüft
    # war: *„hier ist der gerichtete Satz der richtige — nicht der neutrale"*.
    # Genau diese Unterscheidung misst der Fall weiterhin, nur an der **Folge**
    # statt am Satz: Die gerichtete Lage ``W ⊊ S`` macht den Nenner zu groß und
    # den Quotienten damit zu **klein** ⇒ **Schranke** (1800 ÷ 900 = 2,0, wahr
    # ist 3,0). Die neutrale Kreuzung darüber und unten kippt in unbekannte
    # bzw. die andere Richtung ⇒ sie **sperrt weiter**. Das ist der Kern von
    # E1b, und dieser Fall trennt beide Hälften in einem Test.
    assert jb.wp_cop == pytest.approx(2.0)
    assert jb.wp_cop_ist_schranke is True
    assert jb.wp_cop_schranke_hinweis == "Klima B: Strom ohne Wärmemessung enthalten"
    assert jb.wp_cop_grund is None

    # Dritte Lage: vertauschte Geräte in zwei Monaten. Die VEREINIGUNGEN sind
    # gleich ({A, B} auf beiden Seiten) — nur die je-Monat-Faltung sieht es.
    # Deshalb steht sie neben der Vereinigung und nicht an ihrer Stelle.
    c = await _anlage(db, "N-441 vertauscht")
    c_a = await _geraet(db, c, "WP A", dict(_WP),
                        {"heizenergie_kwh": 1800.0}, monat=3)
    c_b = await _geraet(db, c, "WP B", dict(_WP),
                        {"strom_heizen_kwh": 600.0}, monat=3)
    db.add(InvestitionMonatsdaten(
        investition_id=c_a.id, jahr=JAHR, monat=7,
        verbrauch_daten={"strom_heizen_kwh": 600.0},
    ))
    db.add(InvestitionMonatsdaten(
        investition_id=c_b.id, jahr=JAHR, monat=7,
        verbrauch_daten={"heizenergie_kwh": 1800.0},
    ))
    await db.commit()

    jc = await _jahr(db, c.id)

    assert jc.wp_cop is None, "3,0 aus über Kreuz gemessenen Größen"
    assert jc.wp_cop_grund == GRUND_GERAETE_VERSCHIEDEN


@pytest.mark.asyncio
async def test_p18_der_hub_liest_die_gesamtwaerme_wie_der_layer(db):
    """**P18.** Ein Monat pflegt nur ``waerme_kwh`` — der Hub sah dort nichts.

    ⛔ **Zwei Sichten, zwei Lesarten derselben Zeile** (die N-397-Klasse): Der
    Layer nimmt „Gesamtwert vor Summanden" (D1), der Hub addierte
    ``heizenergie + warmwasser``. Folge: *Cockpit → Jahr* sperrte, der Hub
    zeigte 3,0.

    ⭐ **Seit N-391 (14.09.2026) ist diese Zeile eine Anwender-Lage, keine
    Bastelei mehr.** Bis dahin war ``waerme_kwh`` nur über einen JSON-Restore
    erreichbar — die Probe hielt einen Zustand fest, den niemand herstellen
    konnte. Mit dem Monatswert *Wärme gesamt* trägt ihn jeder, der EINEN
    Wärmemengenzähler über Heizung und Warmwasser hat. Die **Summen**seite des
    Hubs prüft `test_n391_gesamtwaerme.py`; hier bleibt die Perioden-Lage.
    """
    a = await _anlage(db, "N-441 Gesamtwaerme")
    wp = await _geraet(db, a, "WP", dict(_WP), {"waerme_kwh": 1800.0}, monat=3)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=7,
        verbrauch_daten={"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0},
    ))
    await db.commit()

    j = await _jahr(db, a.id)
    hub = await _hub(db, a.id)

    assert j.wp_cop_grund == GRUND_GERAETE_VERSCHIEDENE_MONATE
    assert hub[0]["durchschnitt_cop"] is None, "der Hub zeigte 3,0"
    assert hub[0]["durchschnitt_cop_grund"] == GRUND_GERAETE_VERSCHIEDENE_MONATE


@pytest.mark.asyncio
async def test_p19_die_kuehlzahl_spricht_nicht_von_waerme(db):
    """**P19.** Der Block-Satz „nicht alle Geräte melden Wärme" an der Kältezahl.

    A vollständig (Wärme, Heizstrom, Kühlstrom, Kälte) · B nur Kälte · C nur
    Strom. Der Block-Grund trifft zu — sein Wortlaut unter einer **Kälte**zahl
    ist trotzdem eine Falschaussage. Dieselbe Korrektur, die N-438 für den
    Monate-Satz vorgenommen hat.
    """
    a = await _anlage(db, "N-441 Kuehlzahl")
    await _geraet(db, a, "WP A", dict(_WP),
                  {"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0,
                   "betriebsart_strom_kuehlen_kwh": 300.0,
                   "betriebsart_nutzenergie_kuehlen_kwh": 900.0})
    await _geraet(db, a, "Klima B",
                  {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz"},
                  {"betriebsart_nutzenergie_kuehlen_kwh": 400.0})
    await _geraet(db, a, "WP C",
                  {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz"},
                  {"stromverbrauch_kwh": 300.0})
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_jaz_kuehlen is None
    assert "Wärme" not in j.wp_jaz_kuehlen_grund
    assert j.wp_jaz_kuehlen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
    # ⭐ **Die Aussage des Tests ist die KÜHL-Zeile**, und sie ist unverändert.
    # Die Block-Zeile daneben trägt seit E1b keinen Satz mehr, sondern die
    # Schranke — dass die Lage „nicht alle Geräte melden Wärme" vorliegt, misst
    # jetzt das Flag. Substanz gehalten: Der Block-Satz darf nicht unter der
    # Kältezahl stehen, und er tut es nicht.
    assert j.wp_cop_ist_schranke is True
    assert j.wp_cop_grund is None


@pytest.mark.asyncio
async def test_p20_stilllegung_und_anschaffung_sind_kein_fehlalarm(db):
    """**P20 · Gegenprobe.** Geräte kommen und gehen — die Zahl bleibt.

    A ganzjährig · B zum 31.03. stillgelegt · C ab 01.06. angeschafft. Die
    Vereinigungen sind gleich (``W = S = {A, B, C}``); eine Regel, die
    ``W != S`` statt der Teilmengen prüfte, meldete hier einen Fehler, den es
    nicht gibt.
    """
    a = await _anlage(db, "N-441 Stilllegung")
    wp_a = await _geraet(db, a, "WP A", dict(_WP),
                         {"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0},
                         monat=1)
    db.add(InvestitionMonatsdaten(
        investition_id=wp_a.id, jahr=JAHR, monat=7,
        verbrauch_daten={"heizenergie_kwh": 900.0, "strom_heizen_kwh": 300.0},
    ))
    wp_b = await _geraet(db, a, "WP B (stillgelegt)",
                         {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz"},
                         {"heizenergie_kwh": 600.0, "stromverbrauch_kwh": 200.0},
                         monat=1)
    wp_b.stilllegungsdatum = date(JAHR, 3, 31)
    wp_c = await _geraet(db, a, "WP C (neu)",
                         {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz"},
                         {"heizenergie_kwh": 300.0, "stromverbrauch_kwh": 100.0},
                         monat=7)
    wp_c.anschaffungsdatum = date(JAHR, 6, 1)
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_cop == pytest.approx(3.0)
    assert j.wp_cop_grund is None
