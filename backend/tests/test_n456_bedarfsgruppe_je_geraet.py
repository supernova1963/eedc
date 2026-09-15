"""**N-456** — die Bedarfs-Gruppe verdrängt nur noch innerhalb ihres Geräts.

Zwei Defekte, eine Ursache: `stufe_bedarf_ein` schlüsselte die Belegung
ausschließlich nach `bedarf_gruppe`.

1. **Getrennte Strommessung (F5).** `stromverbrauch_kwh`, `strom_heizen_kwh` und
   `strom_warmwasser_kwh` liegen alle in der Gruppe `wp_strom`. War eines der
   beiden Split-Felder zugeordnet, erklärte die Zuordnungs-Fläche das andere für
   *„Der WP-Stromverbrauch ist bereits zugeordnet — hier ist nichts
   einzutragen."* — während `_check_energieprofil_abdeckung` daneben genau
   dieses Feld als Pflicht führt und warnt. **Dieselbe Anlage, zwei Flächen,
   gegenteilige Aussage** (N-86-Klasse). Bei F5 sind die beiden Split-Felder
   **Summanden**, keine Alternativen.
2. **Zwei Geräte.** Der Schlüssel trug keine Investitions-ID: An einer Anlage
   mit zwei Wärmepumpen schaltete ein belegtes Feld an Gerät A die leeren Felder
   an Gerät B ab. Das Feld des zweiten Geräts konnte gar nicht als offen
   erscheinen.

⭐ **Gebaut ohne Sonderregel für `wp_strom`, und das ist der Punkt.** Die
Registry weiß schon, welche Felder ein Gerät liefern muss
(`pflicht_felder_am_geraet`); die Fläche fragt sie jetzt über das Kennzeichen
`pflicht_am_geraet`. Ein Feld, das an **diesem** Gerät Pflicht ist, wird nicht
verdrängt — wäre es eine Alternative, hätte die Registry es als `erweitert` oder
`nicht_an_dieser_bauart` markiert und der Helfer ließe es weg. Genau das
passiert mit `stromverbrauch_kwh`, sobald F5 an ist.

⛔ **Was ausdrücklich NICHT kippt:** Die Anlagen-Ebene (`typ: basis`) deckt
weiter in **beide** Richtungen — dort ist die Gruppe eine echte Alternative
(Anlagen-Zählerstand gegen Komponenten-Zähler, `pv_energie`). Nur zwischen
**zwei Geräten** gibt es keine Deckung mehr.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.datenquellen import (
    QUELLE_HA_APP,
    QUELLEN_KEY,
    get_datenquellen_felder,
)
from backend.core.field_definitions import pflicht_felder_am_geraet
from backend.models.anlage import Anlage
from backend.models.investition import Investition
# Import registriert das Modell in `Base.metadata` — der `/felder`-Handler
# fragt die Gateway-Zeilen ab, die Tabelle muss in der Test-DB existieren.
from backend.models.mqtt_gateway_mapping import MqttGatewayMapping  # noqa: F401
from backend.services.datenquellen_validierung import stufe_bedarf_ein

F5 = {"wp_art": "luft_wasser", "getrennte_strommessung": True}
OHNE_F5 = {"wp_art": "luft_wasser"}
KLIMA_F5 = {"wp_art": "luft_luft", "getrennte_strommessung": True}


async def _anlage_mit_wps(db, *, geraete: list[dict], zugeordnet: list[str] = ()):
    """Anlage + *n* Wärmepumpen; `zugeordnet` sind Feld-IDs mit HA-Sensor.

    Die Feld-IDs entstehen erst aus den vergebenen Investitions-IDs, deshalb
    trägt `zugeordnet` Platzhalter der Form ``"{1}:strom_heizen_kwh"`` — die
    Zahl ist die Position in `geraete`.
    """
    anlage = Anlage(anlagenname="N-456", leistung_kwp=10.0, sensor_mapping={})
    db.add(anlage)
    await db.flush()
    ids: list[int] = []
    for i, params in enumerate(geraete, start=1):
        inv = Investition(
            anlage_id=anlage.id, typ="waermepumpe", bezeichnung=f"WP {i}",
            anschaffungsdatum=date(2024, 1, 1), anschaffungskosten_gesamt=12000.0,
            parameter=dict(params),
        )
        db.add(inv)
        await db.flush()
        ids.append(inv.id)

    quellen = {}
    for eintrag in zugeordnet:
        pos, feld = eintrag.split(":", 1)
        fid = f"inv_energy_{ids[int(pos) - 1]}_{feld}"
        quellen[fid] = {"quelle": QUELLE_HA_APP, "sensor": f"sensor.test_{feld}"}
    anlage.sensor_mapping = {QUELLEN_KEY: quellen}
    await db.commit()
    return anlage.id, ids


async def _felder(db, anlage_id: int) -> dict[str, dict]:
    resp = await get_datenquellen_felder(anlage_id, db)
    return {f["id"]: f for g in resp["gruppen"] for f in g["felder"]}


def _bedarf(felder: dict, inv_id: int, feld: str):
    eintrag = felder.get(f"inv_energy_{inv_id}_{feld}")
    return None if eintrag is None else (eintrag.get("bedarf"), eintrag.get("bedarf_grund"))


# ═══ Klausel 1 — F5: das zweite Split-Feld bleibt Pflicht ═══════════════════

@pytest.mark.asyncio
async def test_bei_f5_bleibt_das_zweite_stromfeld_pflicht(db):
    """Der Kernfall. Heizstrom zugeordnet, Warmwasserstrom leer ⇒ **Pflicht**.

    Bis zum 13.09.2026 stand hier ``("inaktiv", "gruppe:wp_strom")`` — und
    daneben warnte der Abdeckungs-Check für dasselbe Feld.
    """
    aid, ids = await _anlage_mit_wps(
        db, geraete=[F5], zugeordnet=["1:strom_heizen_kwh"],
    )
    felder = await _felder(db, aid)

    assert _bedarf(felder, ids[0], "strom_warmwasser_kwh") == ("pflicht", None)
    # Das belegte Feld bleibt, was es ist.
    assert _bedarf(felder, ids[0], "strom_heizen_kwh") == ("pflicht", None)


@pytest.mark.asyncio
async def test_bei_f5_ist_das_gesamtstromfeld_optional_mit_grund(db):
    """Die Gegenrichtung derselben Regel — sonst wäre sie „nie verdrängen".

    `stromverbrauch_kwh` ist bei F5 **nicht** Pflicht am Gerät (die Registry
    stuft es auf `erweitert` zurück) — es steht also nicht rot in der Fläche und
    zählt in keinem Rollup als offene Lücke. Genau darum ging es bei N-456.

    ⛔ **Bis zum 14.09.2026 stand hier ``("inaktiv", "gruppe:wp_strom")``** samt
    dem Satz *„Der WP-Stromverbrauch ist bereits zugeordnet — hier ist nichts
    einzutragen."* Mit WK-16d ist das falsch geworden: Ein Gesamtzähler ist die
    Menge (K1) und trägt, was die beiden Achsen **nicht** messen — Standby,
    Steuerung, Umwälzpumpen. Wer ihn wegen jenes Satzes nicht zuordnet, verliert
    genau diese Kilowattstunden. Ein **Summand** deckt seine Geschwister nie ab;
    das sagt `BEDARF_GRUPPEN_ALTERNATIV` seit N-391, und `stufe_bedarf_ein`
    liest es jetzt auch.

    **Die Substanz von N-456 ist unverändert: nicht Pflicht, keine Lücke.** Nur
    die Begründung, die der Anwender liest, ist eine andere geworden.
    """
    aid, ids = await _anlage_mit_wps(
        db, geraete=[F5], zugeordnet=["1:strom_heizen_kwh"],
    )
    felder = await _felder(db, aid)

    assert _bedarf(felder, ids[0], "stromverbrauch_kwh") == ("optional", None)
    text = felder[f"inv_energy_{ids[0]}_stromverbrauch_kwh"].get("bedarf_text") or ""
    assert "nicht aufgeteilt" in text, text
    assert "nichts einzutragen" not in text, text


@pytest.mark.asyncio
async def test_die_flaeche_folgt_derselben_quelle_wie_der_abdeckungs_check(db):
    """**Die eigentliche Zusicherung: eine Wahrheit, zwei Leser.**

    Jedes Feld, das `pflicht_felder_am_geraet(..., gruppe="wp_strom")` nennt,
    steht auf der Zuordnungs-Fläche als Pflicht — auch wenn ein Geschwisterfeld
    schon belegt ist. Das ist genau die Menge, aus der
    `_check_energieprofil_abdeckung` seine Warnung bildet.
    """
    aid, ids = await _anlage_mit_wps(
        db, geraete=[F5], zugeordnet=["1:strom_heizen_kwh"],
    )
    felder = await _felder(db, aid)

    erwartet = pflicht_felder_am_geraet("waermepumpe", F5, gruppe="wp_strom")
    assert erwartet == ["strom_heizen_kwh", "strom_warmwasser_kwh"]
    for feld in erwartet:
        assert _bedarf(felder, ids[0], feld) == ("pflicht", None), feld


# ═══ Klausel 2 — zwei Geräte werden getrennt eingestuft ═════════════════════

@pytest.mark.asyncio
async def test_zwei_waermepumpen_werden_getrennt_eingestuft(db):
    """Gerät A zugeordnet ⇒ Gerät B bleibt offen, statt still abgeschaltet.

    ⚠ Ohne getrennte Strommessung, damit **allein** die Geräte-Trennung geprüft
    wird und nicht zusätzlich die Pflicht-Regel aus Klausel 1.
    """
    aid, ids = await _anlage_mit_wps(
        db, geraete=[OHNE_F5, OHNE_F5], zugeordnet=["1:stromverbrauch_kwh"],
    )
    felder = await _felder(db, aid)

    assert _bedarf(felder, ids[0], "stromverbrauch_kwh") == ("pflicht", None)
    assert _bedarf(felder, ids[1], "stromverbrauch_kwh") == ("pflicht", None)


@pytest.mark.asyncio
async def test_zwei_pv_module_teilen_sich_die_live_gruppe_nicht_mehr(db):
    """**Die Klausel, die die Geräte-Trennung ALLEIN trägt.**

    ⚑ Befund am Prüfstand: Die Zwei-Wärmepumpen-Probe darüber bleibt grün, wenn
    man nur die Geräte-Trennung herausnimmt — dort greift schon die
    Pflicht-Regel (`stromverbrauch_kwh` ist an jedem Gerät Pflicht). Um die
    Trennung selbst zu messen, braucht es eine Gruppe, in der **kein** Mitglied
    Pflicht ist: `pv_live`.

    Westdach hat einen Leistungssensor, Ostdach nicht. Der Sensor am Westdach
    sagt nichts über das Ostdach — bis zum 13.09.2026 stand dort trotzdem
    *„Die PV-Leistung ist bereits an anderer Stelle zugeordnet"*.
    """
    anlage = Anlage(anlagenname="N-456 PV", leistung_kwp=10.0, sensor_mapping={})
    db.add(anlage)
    await db.flush()
    ids = []
    for name in ("West", "Ost"):
        inv = Investition(
            anlage_id=anlage.id, typ="pv-module", bezeichnung=name,
            anschaffungsdatum=date(2024, 1, 1), anschaffungskosten_gesamt=5000.0,
            leistung_kwp=5.0,
        )
        db.add(inv)
        await db.flush()
        ids.append(inv.id)
    anlage.sensor_mapping = {QUELLEN_KEY: {
        f"inv_live_{ids[0]}_leistung_w": {
            "quelle": QUELLE_HA_APP, "sensor": "sensor.west_w",
        },
    }}
    await db.commit()

    felder = await _felder(db, anlage.id)
    ost = felder[f"inv_live_{ids[1]}_leistung_w"]
    assert ost["bedarf"] == "optional"
    assert ost["bedarf_grund"] is None


# ═══ Klausel 3 — Luft-Luft hat kein Warmwasser-Pflichtfeld ══════════════════

@pytest.mark.asyncio
async def test_eine_klimaanlage_bekommt_kein_warmwasser_pflichtfeld(db):
    """N-304/B5: kein Warmwasserkreis ⇒ das Feld ist gar nicht an der Fläche.

    Die neue Pflicht-Regel darf es **nicht** zurückholen — sie fragt die
    Registry, und die sagt für `luft_luft` „gibt es hier nicht".
    """
    aid, ids = await _anlage_mit_wps(
        db, geraete=[KLIMA_F5], zugeordnet=["1:strom_heizen_kwh"],
    )
    felder = await _felder(db, aid)

    assert _bedarf(felder, ids[0], "strom_warmwasser_kwh") is None
    assert pflicht_felder_am_geraet("waermepumpe", KLIMA_F5, gruppe="wp_strom") \
        == ["strom_heizen_kwh"]


# ═══ Klausel 4 — der Bestand: die Anlagen-Ebene deckt weiter ════════════════

def test_die_anlagen_ebene_deckt_weiter_in_beide_richtungen():
    """`pv_energie` bleibt eine echte Alternative — Bestand, unverändert.

    ⛔ Diese Klausel ist der Grund, warum die Regel **nicht** einfach
    „je (Investition, Gruppe)" lautet: Der Anlagen-Zählerstand hat gar keine
    Investition. Würde er in einen eigenen Topf fallen, deckte er die
    Modul-Zeile nicht mehr ab — und umgekehrt.
    """
    basis = {"id": "b", "feld": "pv_gesamt_kwh", "typ": "basis", "belegt": False,
             "bedarf": "pflicht", "bedarf_gruppe": "pv_energie", "inv_id": None}
    modul = {"id": "m", "feld": "pv_erzeugung_kwh", "typ": "pv-module", "belegt": True,
             "bedarf": "pflicht", "bedarf_gruppe": "pv_energie", "inv_id": "7"}

    # Gerät belegt ⇒ die Basis-Zeile ist abgedeckt.
    r = stufe_bedarf_ein([basis, modul], {"pv-module"})
    assert r["b"]["bedarf"] == "inaktiv"

    # Und umgekehrt: Basis belegt ⇒ die Modul-Zeile ist abgedeckt.
    r2 = stufe_bedarf_ein(
        [{**basis, "belegt": True}, {**modul, "belegt": False}], {"pv-module"},
    )
    assert r2["m"]["bedarf"] == "inaktiv"
    assert r2["m"]["grund"] == "gruppe:pv_energie"


def test_zwei_module_decken_sich_nicht_mehr_gegenseitig_ab():
    """Die zweite Hälfte des Funds, an einer anderen Gruppe gemessen.

    Sie war im Fundtext als „beim Bau messen" offen: Die anlagenweite Belegung
    trifft **jede** Gruppe, sobald zwei Geräte darin stehen. Zwei PV-Strings
    sind derselbe Fall wie zwei Wärmepumpen — der Ertragssensor am Westdach
    sagt nichts über das Ostdach.
    """
    west = {"id": "w", "feld": "pv_erzeugung_kwh", "typ": "pv-module", "belegt": True,
            "bedarf": "pflicht", "bedarf_gruppe": "pv_energie", "inv_id": "1"}
    ost = {"id": "o", "feld": "pv_erzeugung_kwh", "typ": "pv-module", "belegt": False,
           "bedarf": "pflicht", "bedarf_gruppe": "pv_energie", "inv_id": "2"}

    r = stufe_bedarf_ein([west, ost], {"pv-module"})
    assert r["o"]["bedarf"] == "pflicht"
    assert r["o"]["grund"] is None


def test_ohne_inv_id_verhaelt_sich_alles_wie_vorher():
    """Die Vorgabe hält die vorhandenen Proben gültig — und ist selbst geprüft.

    Ein Aufrufer, der `inv_id` nicht mitgibt, bekommt die anlagenweite Deckung
    von vor N-456. Ohne diese Klausel wäre die Rückwärtskompatibilität eine
    Behauptung.
    """
    a = {"id": "a", "feld": "netzbezug_w", "typ": "basis", "belegt": True,
         "bedarf": "optional", "bedarf_gruppe": "netz_live"}
    b = {"id": "b", "feld": "netz_kombi_w", "typ": "basis", "belegt": False,
         "bedarf": "optional", "bedarf_gruppe": "netz_live"}

    r = stufe_bedarf_ein([a, b], set())
    assert r["b"]["bedarf"] == "inaktiv"
