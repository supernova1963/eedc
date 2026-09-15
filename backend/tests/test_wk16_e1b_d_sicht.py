"""**E1b + D-Sicht** — die anlagenweite Schranke und der eine Kasten (WK-16ab).

**Der Anlass, in einem Satz** (Gernot, 14.09.2026): *„Das release ich so nicht."*
Cockpit → Monat zeigte im Block *Wärme/Klima* **vier** Striche mit Grund-Texten,
während dietmar1968s selbstgebautes Dashboard auf **derselben** Datenlage überall
Zahlen zeigt und „–" nur dort, wo wirklich nichts ist.

Zwei Entscheide, beide hier gemessen:

* **E1b** — die Anlage bekommt eine **Systemarbeitszahl der Wärmeerzeugung**.
  Steht im Nenner Strom, dem keine gemessene Wärme gegenübersteht, ist sie eine
  **untere Schranke** und wird so gezeigt („≥ 3,25"). E1 bleibt für die Kennzahl
  **eines Geräts** unverändert gültig.
* **D-Sicht** — Kacheln und Zeilen nur mit Zahl; was die Ausstattung nicht
  hergibt, steht **einmal je Sicht** im Kasten *„Was noch möglich wäre"*.

⛔ **Was diese Datei NICHT noch einmal misst:** die R2-Sperren je Funktion
(`test_r2_je_funktion.py`), die Geräte-Identität (`test_n441_geraete_identitaet.py`)
und die nachgestellten Anlagen (`test_soll_waerme_klima_simulation_anlagen.py`).
Dort sind die Wortlaute mit demselben Paket umgestellt worden; hier steht die
**neue** Regel.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    ARBEITSZAHL_FUNKTIONEN,
    GRUND_BAUARTEN_GEMISCHT,
    GRUND_GERAETE_OHNE_WAERME,
    GRUND_GERAETE_VERSCHIEDEN,
    GRUND_KEIN_HEIZBETRIEB,
    GRUND_KEIN_STROM,
    GRUND_KEINE_KAELTEMENGE,
    GRUND_KEINE_WAERMEMESSUNG,
    GRUND_KLASSE,
    GRUND_KLASSE_AUSSTATTUNG,
    GRUND_KLASSE_ZEITRAUM,
    GRUND_NUR_KUEHLBETRIEB,
    GRUND_STROM_NICHT_JE_FUNKTION,
    GRUND_WAERME_ABGELEITET,
    HANDGRIFF_JE_GRUND,
    arbeitszahl,
    arbeitszahl_je_funktion,
    grund_klasse,
    ist_ausstattungs_grund,
    systemarbeitszahl,
)
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.investition import InvestitionMonatsdaten
from backend.models.mqtt_gateway_mapping import MqttGatewayMapping  # noqa: F401
# N-337: der Hub liest `sensor_snapshots` (wp_starts_anzahl). Ohne diesen Import
# steht das Modell nicht in `Base.metadata`, wenn diese Datei ALLEIN laeuft.
from backend.models.sensor_snapshot import SensorSnapshot  # noqa: F401
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.waerme_klima_block import (
    GROESSEN_IM_KASTEN,
    was_noch_moeglich,
)

JAHR, MONAT = 2025, 7

_WP = {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz"}
_WP_F5 = {**_WP, "getrennte_strommessung": True}
_KLIMA = {"wp_art": "luft_luft", "effizienz_modus": "gesamt_jaz"}


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


# ═══ Der Layer für sich ═════════════════════════════════════════════════════

def test_die_schranke_ist_dietmars_eigene_rechnung():
    """7075 ÷ (2193 − 17) = 3,25 — genau so rechnet er selbst.

    ⭐ **Die Zahl stammt aus seinem Dashboard, nicht aus einer Erfindung:**
    AZ Heizung 3,94 × 1188 kWh + AZ Warmwasser 2,84 × 843 kWh = 7075 kWh Wärme;
    7075 ÷ 3,25 = 2177 = Gesamtstrom 2193 **minus** Klima-Kühlen 17. Er teilt
    also die gemessene Wärme durch **allen** Strom der Wärmeerzeuger außer dem
    Kühlstrom — Klima-Heizstrom (ohne Wärmemessung) eingeschlossen.
    """
    s = systemarbeitszahl(
        7075.0, 2193.0,
        kuehlstrom_kwh=17.0,
        strom_ohne_waerme_kwh=300.0,
        geraete_ohne_waerme=["Klimaanlage"],
    )
    assert s.wert == pytest.approx(7075 / 2176, rel=1e-6)
    assert round(s.wert, 2) == 3.25
    assert s.ist_schranke is True
    assert s.schranke_hinweis == "Klimaanlage: Strom ohne Wärmemessung enthalten"
    assert s.nenner_kwh == pytest.approx(2176.0), "der Kühlstrom ist abgezogen"


def test_ohne_strom_ohne_waerme_ist_es_die_gewohnte_arbeitszahl():
    """**Ein Gerät, alles gemessen ⇒ keine Schranke.**

    ⛔ **Die Gegenprobe zur Probe darüber, und sie trägt den Bau:** Eine Regel,
    die IMMER „≥" setzt, wäre dort ebenso grün — und hätte jeder sauber
    messenden Anlage ein Zeichen vor die Zahl gesetzt, das eine Unsicherheit
    behauptet, die es nicht gibt.
    """
    s = systemarbeitszahl(3000.0, 1000.0)
    assert s.wert == pytest.approx(3.0)
    assert s.ist_schranke is False
    assert s.schranke_hinweis is None


def test_der_kuehlstrom_steht_in_keinem_nenner():
    """**E7/Option A** — dieselbe Regel wie in ``arbeitszahl``, nicht eine zweite.

    Ohne Abzug stünde 3000 ÷ 1000 = 3,0 statt 3000 ÷ 900 = 3,33.
    """
    ohne = systemarbeitszahl(3000.0, 1000.0)
    mit = systemarbeitszahl(3000.0, 1000.0, kuehlstrom_kwh=100.0)
    assert ohne.wert == pytest.approx(3.0)
    assert mit.wert == pytest.approx(3000 / 900)


def test_ohne_gemessene_waerme_gibt_es_einen_grund_und_keine_schranke():
    """``Q = 0`` ⇒ Grund. Eine Schranke „≥ 0" ist wahr und sagt nichts.

    ⚠ Sie sähe zudem aus wie eine **Bewertung** des Geräts — dieselbe
    Begründung, mit der ``arbeitszahl`` bei ``q == 0`` keinen Quotienten bildet.
    """
    s = systemarbeitszahl(0.0, 1000.0, strom_ohne_waerme_kwh=1000.0)
    assert s.wert is None
    assert s.ist_schranke is False
    assert s.grund == GRUND_KEINE_WAERMEMESSUNG


def test_ohne_strom_und_bei_reinem_kuehlbetrieb_dieselben_worte_wie_bisher():
    """Zwei Sprachen für einen Sachverhalt wären die N-327-Klasse."""
    assert systemarbeitszahl(3000.0, 0.0).grund == GRUND_KEIN_STROM
    assert systemarbeitszahl(
        3000.0, 100.0, kuehlstrom_kwh=100.0,
    ).grund == GRUND_NUR_KUEHLBETRIEB


def test_die_gegenrichtung_sperrt_weiter():
    """⛔ **Wärme ohne ihren Strom kippt die Zahl nach OBEN — keine Schranke.**

    Das ist der Kern der Unterscheidung: ``GRUND_GERAETE_VERSCHIEDEN``,
    ``GRUND_FREMDWAERME`` und ``…aus verschiedenen Monaten`` machen den **Zähler**
    zu groß. Eine untere Schranke wäre dort eine Falschaussage — und zwar die
    teurere, weil sie eine zu gute Anlage behauptet.
    """
    s = systemarbeitszahl(
        3000.0, 1000.0,
        strom_ohne_waerme_kwh=200.0, geraete_ohne_waerme=["Klima"],
        abgrenzung_verletzt=GRUND_GERAETE_VERSCHIEDEN,
    )
    assert s.wert is None and s.grund == GRUND_GERAETE_VERSCHIEDEN
    assert s.ist_schranke is False


def test_abgeleitete_waerme_sperrt_auch_die_schranke():
    """Eine aus ``Strom × JAZ`` gerechnete Wärme gäbe den Faktor zurück (§3.5)."""
    s = systemarbeitszahl(3000.0, 1000.0, waerme_abgeleitet_kwh=1.0)
    assert s.wert is None and s.grund == GRUND_WAERME_ABGELEITET


def test_der_heizstab_hinweis_gilt_auch_fuer_die_systemzahl():
    """Unter 2,0 erklärt derselbe Satz wie bei ``arbeitszahl`` — nicht zwei.

    ⚠ **Er ist NICHT der Schranken-Satz.** Beide in ein Feld zu falten hieße,
    zwei verschiedene Aussagen unter einem Namen zu führen; die Route liefert
    sie deshalb getrennt aus.
    """
    s = systemarbeitszahl(1000.0, 1000.0, strom_ohne_waerme_kwh=100.0,
                          geraete_ohne_waerme=["Heizstab"])
    assert s.wert == pytest.approx(1.0)
    assert s.hinweis is not None and "Heizstab" in s.hinweis
    assert s.schranke_hinweis == "Heizstab: Strom ohne Wärmemessung enthalten"


# ═══ Die Grund-Klassen (D-Sicht 2) ══════════════════════════════════════════

def test_jeder_grund_traegt_genau_eine_klasse():
    """⛔ **Die Klassifizierung steht an der Konstante, einmal.**

    Sie im Client zu treffen hieße, Grund-**Texte** zu vergleichen; dieselbe
    Aussage stünde dann an zwei Orten und liefe beim nächsten Wortlaut
    auseinander (die W-3-Klasse).
    """
    assert set(GRUND_KLASSE.values()) == {
        GRUND_KLASSE_AUSSTATTUNG, GRUND_KLASSE_ZEITRAUM,
    }
    assert grund_klasse(GRUND_KEIN_HEIZBETRIEB) == GRUND_KLASSE_ZEITRAUM
    assert grund_klasse(GRUND_KEINE_KAELTEMENGE) == GRUND_KLASSE_AUSSTATTUNG
    assert grund_klasse(None) is None


def test_ein_unbekannter_grund_gilt_als_ausstattung():
    """Die vorsichtige Richtung: er landet im Kasten, wo ihn jemand liest.

    ⭐ Die Gegenrichtung wäre ein **still verschluckter** Hinweis — genau das,
    was die D-Sicht abschaffen soll.
    """
    assert ist_ausstattungs_grund("ein Grund, den es 2027 gibt") is True


def test_jeder_ausstattungs_grund_mit_handgriff_hat_auch_einen():
    """Ein Grund im Kasten ohne Handgriff ist erlaubt — aber nicht stillschweigend.

    ⚠ **Nicht jeder hat einen**, und das ist Absicht: *„…aus verschiedenen
    Monaten"* hat einen, *„Nutzenergie und Strom dieser Funktion stammen von
    verschiedenen Geräten"* auch — aber es gibt keinen allgemeingültigen Weg für
    jede künftige Lage. Diese Probe hält fest, welche heute einen tragen, damit
    ein Wegfall auffällt.
    """
    ohne = sorted(
        g for g, k in GRUND_KLASSE.items()
        if k == GRUND_KLASSE_AUSSTATTUNG and g not in HANDGRIFF_JE_GRUND
    )
    assert ohne == [], f"Ausstattungs-Gründe ohne Handgriff: {ohne}"


def test_kein_zeitraum_grund_traegt_einen_handgriff():
    """⛔ **Die Gegenprobe**: Ein Handgriff an einem Zeitraum-Grund wäre ein Rat,
    der ins Leere führt — genau die Klasse, die W-18 ausgelöst hat (*„eedc sagt,
    ich soll einen Sensor zuordnen, den ich habe"*).
    """
    falsch = sorted(
        g for g, k in GRUND_KLASSE.items()
        if k == GRUND_KLASSE_ZEITRAUM and g in HANDGRIFF_JE_GRUND
    )
    assert falsch == []


# ═══ Der Kasten (D-Sicht 1) ═════════════════════════════════════════════════

def test_der_kasten_nennt_jeden_grund_genau_einmal():
    """Ein fehlender Zähler sperrt zwei Kennzahlen — der Satz steht **einmal**.

    ⭐ **Das ist der ganze Zweck des Kastens.** Vier Kacheln mit demselben Satz
    waren der Anlass; die betroffenen Größen stehen nebeneinander in einer Zeile.
    """
    zeilen = was_noch_moeglich([
        ("Arbeitszahl Heizen", GRUND_STROM_NICHT_JE_FUNKTION),
        ("Arbeitszahl Warmwasser", GRUND_STROM_NICHT_JE_FUNKTION),
        ("Arbeitszahl Kühlen", GRUND_KEINE_KAELTEMENGE),
    ])
    assert [z.grund for z in zeilen] == [
        GRUND_STROM_NICHT_JE_FUNKTION, GRUND_KEINE_KAELTEMENGE,
    ]
    assert zeilen[0].groessen == ["Arbeitszahl Heizen", "Arbeitszahl Warmwasser"]
    assert zeilen[0].groesse == "Arbeitszahl Heizen · Arbeitszahl Warmwasser"
    assert zeilen[0].handgriff == HANDGRIFF_JE_GRUND[GRUND_STROM_NICHT_JE_FUNKTION]
    assert zeilen[0].link == "#/einstellungen/datenquellen"


def test_ein_zeitraum_grund_steht_nicht_im_kasten():
    """⛔ **Die Gegenprobe, und ohne sie misst die Probe darüber nichts.**

    Eine Fassung, die **jeden** Grund einträgt, wäre dort ebenso grün — und der
    Kasten stünde im Juni voll mit Sätzen, zu denen es nichts zu tun gibt.
    """
    assert was_noch_moeglich([("Arbeitszahl Heizen", GRUND_KEIN_HEIZBETRIEB)]) == []


def test_die_groessen_namen_sind_der_vertrag():
    """Der Client fragt mit diesen Bezeichnern ab — nicht mit Grund-Texten.

    ⚠ **Spiegel:** ``src/v4/waermeKlimaSicht.ts::GROESSE``. Ein Name ist ein
    Schlüssel, ein Satz ist eine Formulierung — und die Tages-Route reicht an
    derselben Kachel die **Kurzform** eines W-18-Grundes herein, während unter
    der Kachel die **Langform** steht. Ein Textvergleich im Client hätte dort
    nie getroffen, und zwar still.
    """
    assert GROESSEN_IM_KASTEN == frozenset({
        "Arbeitszahl", "Arbeitszahl Heizen", "Arbeitszahl Warmwasser",
        "Arbeitszahl Kühlen", "Wärme erzeugt",
    })


# ═══ F-5 — gemessene 0 im NENNER ist kein fehlender Zähler ══════════════════

def test_f5_gemessener_null_heizstrom_heisst_kein_heizbetrieb():
    """**F-5.** „kein Stromverbrauch erfasst" bei gemessen 0 Heizstrom war falsch.

    ⭐ **Spiegelbildlich zu ``GRUND_KEIN_KUEHLBETRIEB``**, den
    ``arbeitszahl_kuehlen`` bei ``e <= 0`` seit jeher nennt. W-18/ef696c1c hat
    dieselbe Unterscheidung für den **Zähler** gebaut (gemessene Wärme 0 ⇒ „kein
    Heizbetrieb"); der **Nenner** blieb offen. Wer seinen Heizstrom getrennt
    misst, las im Juni, er erfasse keinen Strom — an einer Anlage, die ihn sehr
    wohl erfasst.
    """
    az = arbeitszahl(
        0.0, 0.0,
        kein_betrieb_grund=GRUND_KEIN_HEIZBETRIEB,
    )
    assert az.grund == GRUND_KEIN_HEIZBETRIEB


def test_f5_ohne_gemessene_null_bleibt_der_alte_wortlaut():
    """⛔ **Zwei Riegel, und beide müssen tragen.**

    ``strom_kwh is None`` heißt „nie erfasst" — dort ist „kein Stromverbrauch
    erfasst" die richtige Auskunft. Und ohne ``kein_betrieb_grund`` (Monat und
    Jahr summieren vorher, ``sum()`` liefert 0 in beiden Lagen) bleibt es
    ebenfalls beim alten Satz. **Der Default ist bitgleich zu vorher.**
    """
    assert arbeitszahl(
        0.0, None, kein_betrieb_grund=GRUND_KEIN_HEIZBETRIEB,
    ).grund == GRUND_KEIN_STROM
    assert arbeitszahl(0.0, 0.0).grund == GRUND_KEIN_STROM


def test_f5_greift_je_funktion_nur_wo_die_null_gemessen_ist():
    """Der Tag unterscheidet „gemessen 0" von „nie erfasst" — Monat und Jahr nicht."""
    je_tag = arbeitszahl_je_funktion(
        heizung_kwh=0.0, strom_heizen_kwh=0.0,
        warmwasser_kwh=100.0, strom_warmwasser_kwh=40.0,
        hat_split=True, null_ist_gemessen=True,
    )
    assert je_tag.heizen.grund == GRUND_KEIN_HEIZBETRIEB
    je_monat = arbeitszahl_je_funktion(
        heizung_kwh=0.0, strom_heizen_kwh=0.0,
        warmwasser_kwh=100.0, strom_warmwasser_kwh=40.0,
        hat_split=True,
    )
    assert je_monat.heizen.grund == GRUND_KEIN_STROM


# ═══ Die Routen — Monat und Jahr an der nachgestellten Anlage ═══════════════

@pytest.mark.asyncio
async def test_monat_und_jahr_zeigen_schranke_und_geraete_tabelle(db):
    """**Die Lage des Melders, end to end** — Daikin + Multisplit.

    Wärmepumpe 3000 kWh Wärme auf 800 kWh Strom (⇒ 3,75), Klimaanlage 200 kWh
    Strom ohne Wärmemessung. Anlagenweit: 3000 ÷ 1000 = **≥ 3,0**.

    ⭐ **Das ist Handbuch §6 Lage A, und der Block sagt jetzt beides:** die
    Schranke oben, die Gerätezahl daneben. Bis zum 14.09.2026 stand dort „—"
    mit dem Grund *„Wärmepumpe und Klimaanlage in einer Zahl"*.
    """
    a = await _anlage(db, "WK-16 Melder")
    await _geraet(db, a, "Daikin Altherma", dict(_WP),
                  {"stromverbrauch_kwh": 800.0, "heizenergie_kwh": 3000.0})
    await _geraet(db, a, "Bosch Multisplit", dict(_KLIMA),
                  {"stromverbrauch_kwh": 200.0})
    await db.commit()

    for antwort, feld_wert, feld_schranke, feld_hinweis in (
        (await _monat(db, a.id), "wp_jaz", "wp_jaz_ist_schranke",
         "wp_jaz_schranke_hinweis"),
        (await _jahr(db, a.id), "wp_cop", "wp_cop_ist_schranke",
         "wp_cop_schranke_hinweis"),
    ):
        assert getattr(antwort, feld_wert) == pytest.approx(3.0)
        assert getattr(antwort, feld_schranke) is True
        assert getattr(antwort, feld_hinweis) == (
            "Bosch Multisplit: Strom ohne Wärmemessung enthalten"
        )
        je_geraet = {g.name: g for g in antwort.wp_geraete}
        assert je_geraet["Daikin Altherma"].jaz == pytest.approx(3.75)
        assert je_geraet["Bosch Multisplit"].jaz is None, (
            "eine Klimaanlage ohne Wärmemessung hat keine Arbeitszahl — "
            "sie bekommt sie auch nicht über die Anlagensumme"
        )
        assert je_geraet["Bosch Multisplit"].strom_kwh == pytest.approx(200.0), (
            "die MENGE bleibt, gesperrt ist die Kennzahl (K1)"
        )


@pytest.mark.asyncio
async def test_der_kasten_steht_je_sicht_einmal_und_ohne_zeitraum_gruende(db):
    """Ohne getrennte Strommessung sperrt **ein** Grund zwei Kennzahlen.

    Er steht einmal im Kasten, mit beiden Größen und dem Handgriff. Der
    Kühl-Grund *„kein Kühlbetrieb in diesem Zeitraum"* steht **nicht** darin —
    es gibt nichts zu tun.
    """
    a = await _anlage(db, "WK-16 Kasten")
    await _geraet(db, a, "Wärmepumpe", dict(_WP),
                  {"stromverbrauch_kwh": 1000.0, "heizenergie_kwh": 3000.0})
    await db.commit()

    m = await _monat(db, a.id)
    gruende = {z.grund: z for z in m.wp_moeglich}
    assert GRUND_STROM_NICHT_JE_FUNKTION in gruende
    assert sorted(gruende[GRUND_STROM_NICHT_JE_FUNKTION].groessen) == [
        "Arbeitszahl Heizen", "Arbeitszahl Warmwasser",
    ]
    assert gruende[GRUND_STROM_NICHT_JE_FUNKTION].handgriff
    assert all(
        grund_klasse(z.grund) == GRUND_KLASSE_AUSSTATTUNG for z in m.wp_moeglich
    ), "ein Zeitraum-Grund gehört nicht in den Kasten"
    # Die Gesamtzahl ist hier sauber — sie steht in keinem Kasten.
    assert m.wp_jaz == pytest.approx(3.0) and m.wp_jaz_ist_schranke is False


@pytest.mark.asyncio
async def test_der_hub_link_bleibt_wo_die_schranke_steht(db):
    """⛔ **Ohne diesen Fall verschwände der Weg genau dort, wo er hilft.**

    Die Gründe, die den Link bisher auslösten (``GRUND_BAUARTEN_GEMISCHT``,
    ``GRUND_GERAETE_OHNE_WAERME``), SIND jetzt die Schranke und stehen nicht
    mehr als Grund da. Der Hub sagt hier etwas anderes als die Schranke:
    *„diese Wärmepumpe: 3,75"* statt *„mindestens 3,0"*.
    """
    a = await _anlage(db, "WK-16 Hub-Link")
    await _geraet(db, a, "Wärmepumpe", dict(_WP),
                  {"stromverbrauch_kwh": 800.0, "heizenergie_kwh": 3000.0})
    await _geraet(db, a, "Klimaanlage", dict(_KLIMA), {"stromverbrauch_kwh": 200.0})
    await db.commit()

    m = await _monat(db, a.id)
    assert m.wp_jaz_ist_schranke is True
    assert m.wp_jaz_grund is None
    assert m.wp_hub_hilft is True


@pytest.mark.asyncio
async def test_der_dienst_ist_die_eine_rechenstelle_fuer_cockpit_und_hub(db):
    """Cockpit-Tabelle und Komponenten-Hub liefern **dieselbe** Zahl je Gerät.

    ⭐ **Das ist die Aussage von WK-16a**: Die Kennzahl je Gerät gab es im Hub;
    sie im Cockpit ein zweites Mal zu rechnen wäre die W-3-Klasse gewesen —
    dieselbe Kennzahl an zwei Orten, und diese Fläche hat sie schon dreimal
    erlebt (W-3 · W-15 · N-397).
    """
    from backend.api.routes.investitionen.dashboards import get_waermepumpe_dashboard

    a = await _anlage(db, "WK-16 eine Rechenstelle")
    # ⚠ **Mit gemessenem Kühlstrom**, und das ist kein Beiwerk: Ohne ihn wären
    # Nenner und Stromverbrauch dieselbe Zahl, und der Vergleich unten liefe
    # auch gegen eine naive Rechnung durch (gemessen 14.09.2026 — der erste
    # Entwurf dieser Probe unterschied nur um eine Rundungsstelle).
    await _geraet(db, a, "Wärmepumpe", dict(_WP_F5),
                  {"strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0,
                   "heizenergie_kwh": 3000.0, "warmwasser_kwh": 600.0,
                   "betriebsart_strom_kuehlen_kwh": 100.0})
    await db.commit()

    m = await _monat(db, a.id)
    hub = await get_waermepumpe_dashboard(a.id, strompreis_cent=None, db=db)
    z = hub[0].zusammenfassung
    zeile = m.wp_geraete[0]

    # ⚠ **Der Nenner ist NICHT der Stromverbrauch** (E7/Option A) — genau daran
    # zeigt sich, ob beide Sichten dieselbe Rechenstelle lesen. Eine zweite,
    # naive Rechnung (`Wärme ÷ Strom`) käme hier auf einen anderen Wert.
    assert abs(zeile.jaz - (zeile.waerme_kwh or 0) / (zeile.strom_kwh or 1)) > 0.3, (
        "sonst prüft der Vergleich unten nichts — 3600 ÷ 950 gegen 3600 ÷ 1050"
    )

    assert zeile.jaz == pytest.approx(z["durchschnitt_cop"])
    assert zeile.jaz_heizen == pytest.approx(z["jaz_heizen"])
    assert zeile.jaz_warmwasser == pytest.approx(z["jaz_warmwasser"])
    assert zeile.strom_kwh == pytest.approx(z["gesamt_stromverbrauch_kwh"])
    assert zeile.waerme_kwh == pytest.approx(z["gesamt_waerme_kwh"])


@pytest.mark.asyncio
async def test_die_schranke_zaehlt_den_beitrag_nicht_den_bestand(db):
    """⛔ **Ein Gerät ohne Strom im Zeitraum macht keine Schranke auf.**

    Dieselbe Regel wie in ``deckung_aus_geraeten`` (N-441): gezählt wird der
    **Beitrag**, nicht die Stammdaten. Ohne sie trüge jede Anlage mit einem
    stillstehenden Zweitgerät dauerhaft ein „≥" vor ihrer Zahl.
    """
    a = await _anlage(db, "WK-16 Beitrag")
    await _geraet(db, a, "Wärmepumpe", dict(_WP),
                  {"stromverbrauch_kwh": 1000.0, "heizenergie_kwh": 3000.0})
    await _geraet(db, a, "Klimaanlage (aus)", dict(_KLIMA), {"stromverbrauch_kwh": 0.0})
    await db.commit()

    m = await _monat(db, a.id)
    assert m.wp_jaz == pytest.approx(3.0)
    assert m.wp_jaz_ist_schranke is False
    assert [g.name for g in m.wp_geraete] == ["Wärmepumpe"], (
        "ein Gerät ohne jede Menge ist keine Zeile aus Strichen"
    )


@pytest.mark.asyncio
async def test_der_hinweis_nennt_nur_die_geraete_die_wirklich_beitragen(db):
    """⛔ **Die diskriminierende Hälfte derselben Regel — und die teurere.**

    Der Fall darüber bleibt auch dann grün, wenn der Beitrags-Riegel fällt: Ein
    Gerät mit 0 kWh addiert 0, und ohne Menge gibt es ohnehin keine Schranke.
    **Sichtbar wird der Riegel erst neben einem Gerät, das WIRKLICH beiträgt** —
    dann stünde ein Name im Hinweis, der nichts im Nenner hat. (Gemessen am
    14.09.2026: ein Sprengsatz, der nur den Fall oben prüfte, blieb still.)
    """
    a = await _anlage(db, "WK-16 Hinweis-Namen")
    await _geraet(db, a, "Wärmepumpe", dict(_WP),
                  {"stromverbrauch_kwh": 800.0, "heizenergie_kwh": 3000.0})
    await _geraet(db, a, "Klima Wohnzimmer", dict(_KLIMA), {"stromverbrauch_kwh": 200.0})
    await _geraet(db, a, "Klima Dachgeschoss (aus)", dict(_KLIMA),
                  {"stromverbrauch_kwh": 0.0})
    await db.commit()

    m = await _monat(db, a.id)
    assert m.wp_jaz_ist_schranke is True
    assert m.wp_jaz_schranke_hinweis == (
        "Klima Wohnzimmer: Strom ohne Wärmemessung enthalten"
    ), "das stillstehende Gerät steht in keinem Nenner und gehört in keinen Satz"


@pytest.mark.asyncio
async def test_e1_gilt_unveraendert_je_geraet(db):
    """**E1 ist nicht aufgeweicht** — die Geräte-Kennzahl bleibt getrennt.

    Die Klimaanlage bekommt ihre eigene Zahl (400 ÷ 200 = 2,0), die Wärmepumpe
    ihre (3000 ÷ 800 = 3,75). Was E1b hinzufügt, ist eine **dritte** Größe mit
    eigenem Namen — keine gemeinsame JAZ der beiden Geräte.
    """
    a = await _anlage(db, "WK-16 E1")
    await _geraet(db, a, "Wärmepumpe", dict(_WP),
                  {"stromverbrauch_kwh": 800.0, "heizenergie_kwh": 3000.0})
    await _geraet(db, a, "Klimaanlage", dict(_KLIMA),
                  {"stromverbrauch_kwh": 200.0, "heizenergie_kwh": 400.0})
    await db.commit()

    m = await _monat(db, a.id)
    je = {g.name: g.jaz for g in m.wp_geraete}
    assert je["Wärmepumpe"] == pytest.approx(3.75)
    assert je["Klimaanlage"] == pytest.approx(2.0)
    # Beide messen ihre Wärme ⇒ keine Schranke, aber auch keine Geräte-Zahl:
    # die 3,4 heißt Systemarbeitszahl und steht neben den beiden, nicht statt.
    assert m.wp_jaz == pytest.approx(3.4)
    assert m.wp_jaz_ist_schranke is False


@pytest.mark.asyncio
async def test_die_funktions_gruende_bleiben_unberuehrt(db):
    """⛔ **E1b ändert NICHTS an R2 je Funktion.**

    Ohne getrennte Strommessung gibt es Heizen und Warmwasser weiterhin nicht —
    die Schranke betrifft allein die **anlagenweite** Zahl. Und der Block-Grund
    *„Wärmepumpe und Klimaanlage in einer Zahl"* ist nicht verschwunden: Er
    steht im Kasten, mit dem Weg in den Hub, wo jedes Gerät für sich steht.
    """
    a = await _anlage(db, "WK-16 je Funktion")
    await _geraet(db, a, "Wärmepumpe", dict(_WP),
                  {"stromverbrauch_kwh": 800.0, "heizenergie_kwh": 3000.0})
    await _geraet(db, a, "Klimaanlage", dict(_KLIMA), {"stromverbrauch_kwh": 200.0})
    await db.commit()

    m = await _monat(db, a.id)
    assert m.wp_jaz_heizen_grund == GRUND_STROM_NICHT_JE_FUNKTION
    assert m.wp_jaz_warmwasser_grund == GRUND_STROM_NICHT_JE_FUNKTION
    assert set(ARBEITSZAHL_FUNKTIONEN) == {"heizen", "warmwasser", "kuehlen"}
    # ⭐ Die anlagenweite Zahl ist trotzdem da — als Schranke. Das ist die
    # ganze Änderung: eine Größe mehr, keine Regel weniger.
    assert m.wp_jaz == pytest.approx(3.0) and m.wp_jaz_ist_schranke is True


@pytest.mark.asyncio
async def test_der_block_grund_lebt_weiter_im_kasten(db):
    """⛔ **„Wärmepumpe und Klimaanlage in einer Zahl" ist nicht gelöscht.**

    Er sperrt die **Anlagenzahl** nicht mehr — als Grund **je Funktion** gilt er
    unverändert, und dort landet er im Kasten, samt Weg in den Hub. Wer ihn für
    verschwunden hält, hat die Hälfte der Regel weggeworfen.
    """
    a = await _anlage(db, "WK-16 Block-Grund")
    # Dieselbe Lage wie `test_r2_je_funktion::test_klima_mit_heizwaerme_sperrt_
    # heizen_weiter`: Die Klimaanlage meldet Heizwärme, aber keinen Heizstrom —
    # der Zähler wäre zu groß, die Heizzahl zu hoch.
    await _geraet(db, a, "Wärmepumpe", dict(_WP_F5),
                  {"strom_heizen_kwh": 800.0, "heizenergie_kwh": 3000.0})
    await _geraet(db, a, "Klimaanlage", dict(_KLIMA),
                  {"stromverbrauch_kwh": 200.0, "heizenergie_kwh": 400.0})
    await db.commit()

    m = await _monat(db, a.id)
    gruende = {z.grund for z in m.wp_moeglich}
    assert GRUND_BAUARTEN_GEMISCHT in gruende, (
        "der Grund je Funktion gilt weiter — er steht jetzt im Kasten"
    )
    zeile = next(z for z in m.wp_moeglich if z.grund == GRUND_BAUARTEN_GEMISCHT)
    assert zeile.link == "#/komponenten/waermepumpe", (
        "hier hilft der Hub — er zeigt jedes Gerät für sich (GRUENDE_HUB_HILFT)"
    )
    assert GRUND_GERAETE_OHNE_WAERME not in gruende


# ═══ Der TAG — die Kreuzung, die nur er sehen kann ══════════════════════════

@pytest.mark.asyncio
async def test_tag_kreuzung_sperrt_statt_eine_schranke_zu_behaupten(db):
    """⛔ **Wärme von Gerät A, Strom von Gerät B — am TAG gezählt, nicht genähert.**

    ⭐ **Gemessen an der Demo r28 (15.06.2026), und zwar an meinem eigenen
    ersten Entwurf:** Dort trägt die Daikin die Wärme des Tages, aber keinen
    Tages-Stromzähler, während der Multisplit Strom trägt und keine Wärme. Mit
    der Monats-Näherung — im Monat decken sich die Geräte — stand im Block
    **„≥ 30,0"**. Eine untere Schranke ist das nicht: Der **Zähler** ist zu
    groß, die Zahl kippt nach oben.

    Seit N-391b führt der Tag die Wärme je Gerät; die Kreuzung ist damit exakt
    entscheidbar und sperrt wieder — mit dem Satz, der sie beschreibt.
    """
    from backend.tests.test_n391b_tag_je_geraet import _mischfall, _tag
    from backend.tests.test_bs6b_kaelte_linie import _lts

    a, wp1, wp2 = await _mischfall(db)
    # Nur WP2 trägt Strom; WP1 trägt die Wärme. `_mischfall` hat beide gelistet,
    # deshalb die Tageszeile hier neu setzen.
    from backend.models.tages_energie_profil import TagesZusammenfassung
    from sqlalchemy import delete
    await db.execute(delete(TagesZusammenfassung))
    _lts(db, a, [wp2])
    t = await _tag(db, a)

    assert t.wp_jaz is None, "Wärme des einen durch den Strom des anderen"
    assert t.wp_jaz_grund == GRUND_GERAETE_VERSCHIEDEN
    assert t.wp_jaz_ist_schranke is False


@pytest.mark.asyncio
async def test_tag_mischfall_ohne_kreuzung_traegt_die_zahl_und_beide_geraete(db):
    """⛔ **Die Gegenprobe — ohne sie sperrte die Regel oben womöglich alles.**

    Derselbe Bestand, aber **beide** Geräte tragen Strom: Die Deckung stimmt,
    die Zahl erscheint, und die Tabelle nennt beide Geräte mit ihrer eigenen.
    """
    from backend.tests.test_n391b_tag_je_geraet import _mischfall, _tag

    a, wp1, wp2 = await _mischfall(db)
    t = await _tag(db, a)

    assert t.wp_jaz is not None and t.wp_jaz_grund is None
    assert t.wp_jaz_ist_schranke is False
    assert sorted(g.name for g in t.wp_geraete) == [
        "WP1 Umschaltventil", "WP2 zwei Zähler",
    ]
    # D1 je Gerät (N-391b): 30 und 20 + 5 = 25 — nicht 30 für die ganze Anlage.
    je = {g.name: g.waerme_kwh for g in t.wp_geraete}
    assert je["WP1 Umschaltventil"] == pytest.approx(30.0)
    assert je["WP2 zwei Zähler"] == pytest.approx(25.0)
