"""**N-398** — die je Betriebsart gepflegte Nutzenergie wird ausgewertet (WK-16f).

## Der Befund

``betriebsart_nutzenergie_heizen_kwh`` ist seit dem 26.08.2026 zuordenbar:
Registry-Feld, je Innengerät, auf der Datenquellen-Fläche angeboten, mit
MQTT-Topic und HA-Slot. Gelesen hat es **niemand**. Wer es pflegte — der Kanon
für eine Split-Klimaanlage, die ihre abgegebene Wärme je Innengerät misst — sah
im Komponenten-Hub ``gesamt_heizenergie_kwh`` **0** und darunter den Grund
*„kein Wärmemengenzähler zugeordnet"*. Der Satz war nicht nur nutzlos, er war
**falsch**: Der Zähler war zugeordnet.

Dasselbe galt für **Lüften** und **Entfeuchten** — dort ohne Kennzahl (E4), aber
auch ohne jede Mengenzeile.

## Die Anlage dieser Datei

**F4h** — eine Split-Klimaanlage (``luft_luft``), die ihren Heizbetrieb misst:

=====================================  =========
Feld                                   Juli 2025
=====================================  =========
``stromverbrauch_kwh``                  700
``betriebsart_strom_heizen_kwh``        700
``betriebsart_nutzenergie_heizen_kwh``  2100
=====================================  =========

Erwartung von Hand: D1 = **2100 kWh** (kein Gesamtwert, kein Gerätefeld ⇒ die
Betriebsart trägt), Arbeitszahl = 2100 ÷ 700 = **3,0**.

⛔ **Warum 700 auch als ``stromverbrauch_kwh`` dasteht.** Ein Betriebsart-Zähler
ist eine **Teilmenge** (Kanon K1); ohne Gesamtzähler hat das Gerät nach
``wp_strom_aufteilung`` gar keine Strommenge, und ohne Nenner gibt es keine
Kennzahl. Das ist die heutige Lage und **kein** Gegenstand dieses Pakets — es
steht als Nebenfund im Bau-Bericht.

## Schwesterdateien

``test_jedes_feld_hat_eine_auswertung.py`` (der Wächter zu R-A) ·
``test_soll_waerme_klima_e4_lueften_entfeuchten.py`` (E4 auf der Stromseite) ·
``test_n391_gesamtwaerme.py`` (D1, dessen dritte Stufe hier dazukommt).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen.betriebsart_gemessen import (
    nutzenergie_ohne_kennzahl_kwh,
)
from backend.core.berechnungen.waermepumpe_kennzahl import heizwaerme_kwh
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.investition import InvestitionMonatsdaten  # noqa: F401
from backend.models.mqtt_gateway_mapping import MqttGatewayMapping  # noqa: F401
from backend.models.sensor_snapshot import SensorSnapshot  # noqa: F401
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)

JAHR, MONAT = 2025, 7

KLIMA = {"wp_art": "luft_luft", "effizienz_modus": "gesamt_jaz"}


# ─── Fixture-Bau ─────────────────────────────────────────────────────────────

async def _anlage(db, name: str) -> Anlage:
    a = Anlage(anlagenname=name, leistung_kwp=10.0,
               installationsdatum=date(2025, 1, 1))
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


async def _hub(db, anlage_id):
    from backend.api.routes.investitionen.dashboards import (
        get_waermepumpe_dashboard,
    )
    return await get_waermepumpe_dashboard(anlage_id, strompreis_cent=30.0, db=db)


async def _monat(db, anlage_id):
    from backend.api.routes.aktueller_monat import get_aktueller_monat
    return await get_aktueller_monat(anlage_id, jahr=JAHR, monat=MONAT, db=db)


async def _jahr(db, anlage_id):
    from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht
    return await get_cockpit_uebersicht(anlage_id, jahr=JAHR, db=db)


F4H_DATEN = {
    "stromverbrauch_kwh": 700.0,
    "betriebsart_strom_heizen_kwh": 700.0,
    "betriebsart_nutzenergie_heizen_kwh": 2100.0,
}


async def _baue_f4h(db, daten: dict | None = None):
    a = await _anlage(db, "F4h Klima misst ihren Heizbetrieb")
    wp = await _geraet(db, a, "Multisplit", KLIMA, dict(daten or F4H_DATEN))
    await db.commit()
    return a, wp


# ═══ Die Weiche selbst (Layer) ══════════════════════════════════════════════

def test_die_betriebsart_traegt_die_heizwaerme_wenn_kein_geraetefeld_dasteht():
    assert heizwaerme_kwh(F4H_DATEN) == pytest.approx(2100.0)


def test_das_geraetefeld_schlaegt_die_betriebsart():
    """K1 in der Richtung, die dieses Paket ergänzt: der gröbere Zähler gewinnt."""
    daten = dict(F4H_DATEN, heizenergie_kwh=1800.0)
    assert heizwaerme_kwh(daten) == pytest.approx(1800.0)


def test_eine_gemessene_null_im_geraetefeld_verdraengt_die_betriebsart():
    """Die F-42-Klasse: „diesen Monat nicht geheizt" ist eine Aussage."""
    assert heizwaerme_kwh(dict(F4H_DATEN, heizenergie_kwh=0)) == 0.0


def test_die_innengeraete_werden_summiert_und_das_geraetefeld_schlaegt_sie():
    """Dieselbe K2-Weiche wie beim Strom — sie steht nur an EINER Stelle."""
    je_geraet = {
        "betriebsart_nutzenergie_heizen_kwh-1": 1200.0,
        "betriebsart_nutzenergie_heizen_kwh-2": 900.0,
    }
    assert heizwaerme_kwh(je_geraet) == pytest.approx(2100.0)
    # Gerätefeld schlägt Σ Innengeräte — und wird NIE dazuaddiert.
    assert heizwaerme_kwh(
        dict(je_geraet, betriebsart_nutzenergie_heizen_kwh=1500.0)
    ) == pytest.approx(1500.0)


def test_ohne_jeden_wert_bleibt_es_bei_keiner_aussage():
    """``None``, nicht 0 — ADR-002/P4."""
    assert heizwaerme_kwh({}) is None
    assert heizwaerme_kwh(None) is None


def test_die_lesetuer_bleibt_fuer_bestandszeilen_bitgleich():
    """Der Legacy-Name gewinnt weiterhin gegen eine 0 im kanonischen Feld.

    ⚠ **Das ist kein schöner Vertrag, aber der geltende.**
    ``get_wp_heizenergie_kwh`` liest seit jeher
    ``heizenergie_kwh or heizung_kwh or 0``. Diese Probe hält fest, dass die
    neue dritte Stufe **nichts** an bestehenden Zeilen verschiebt.
    """
    from backend.core.field_definitions import get_wp_heizenergie_kwh
    for zeile in (
        {"heizenergie_kwh": 5},
        {"heizung_kwh": 7},
        {"heizenergie_kwh": 0},
        {"heizenergie_kwh": 0, "heizung_kwh": 7},
        {"heizenergie_kwh": None, "heizung_kwh": 0},
    ):
        assert heizwaerme_kwh(zeile) == pytest.approx(
            get_wp_heizenergie_kwh(zeile)
        ), zeile


# ═══ Der Hub — der Ort des gemeldeten Symptoms ══════════════════════════════

async def test_f4h_der_hub_zeigt_die_heizwaerme_und_die_arbeitszahl(db):
    """Vorher: ``gesamt_heizenergie_kwh`` 0 und „kein Wärmemengenzähler"."""
    a, _ = await _baue_f4h(db)
    hub = (await _hub(db, a.id))[0]
    z = hub.zusammenfassung
    assert z["gesamt_heizenergie_kwh"] == pytest.approx(2100.0)
    assert z["gesamt_waerme_kwh"] == pytest.approx(2100.0)
    # 2100 ÷ 700 = 3,0 — von Hand, nicht aus dem heutigen Ausgabewert.
    assert z["durchschnitt_cop"] == pytest.approx(3.0, abs=0.01)


async def test_f4h_der_grund_kein_waermemengenzaehler_steht_nicht_mehr_da(db):
    a, _ = await _baue_f4h(db)
    hub = (await _hub(db, a.id))[0]
    z = hub.zusammenfassung
    assert not z.get("durchschnitt_cop_grund"), z.get("durchschnitt_cop_grund")


async def test_ohne_die_nutzenergie_bleibt_es_beim_grund(db):
    """**Die Gegenprobe zur Probe darüber** — sonst hielte sie nichts fest.

    Dieselbe Anlage ohne den Nutzenergie-Zähler: keine Wärme, kein Quotient,
    und der Grund steht wieder da. Ohne diese Zeile wäre nicht gezeigt, dass
    die Zahl oben **aus diesem Feld** kommt.
    """
    a, _ = await _baue_f4h(db, {
        "stromverbrauch_kwh": 700.0,
        "betriebsart_strom_heizen_kwh": 700.0,
    })
    z = (await _hub(db, a.id))[0].zusammenfassung
    assert not z.get("gesamt_heizenergie_kwh")
    assert z.get("durchschnitt_cop") is None
    assert z.get("durchschnitt_cop_grund")


async def test_das_geraetefeld_gewinnt_auch_auf_der_flaeche(db):
    a, _ = await _baue_f4h(db, dict(F4H_DATEN, heizenergie_kwh=1400.0))
    z = (await _hub(db, a.id))[0].zusammenfassung
    assert z["gesamt_heizenergie_kwh"] == pytest.approx(1400.0)
    assert z["durchschnitt_cop"] == pytest.approx(2.0, abs=0.01)


async def test_der_gesamtwert_gewinnt_weiterhin_gegen_beide(db):
    """D1 bleibt D1: ein gemeinsamer Wärmemengenzähler ersetzt die Aufteilung."""
    a, _ = await _baue_f4h(db, dict(F4H_DATEN, waerme_kwh=2800.0))
    z = (await _hub(db, a.id))[0].zusammenfassung
    assert z["gesamt_waerme_kwh"] == pytest.approx(2800.0)
    assert z["durchschnitt_cop"] == pytest.approx(4.0, abs=0.01)


# ═══ Cockpit → Monat und → Jahr ═════════════════════════════════════════════

async def test_f4h_cockpit_monat_traegt_dieselbe_waerme(db):
    """S1: zwei Sichten, **eine** Auskunft."""
    a, _ = await _baue_f4h(db)
    m = await _monat(db, a.id)
    assert m.wp_waerme_kwh == pytest.approx(2100.0)
    assert m.wp_strom_kwh == pytest.approx(700.0)
    assert m.wp_jaz == pytest.approx(3.0, abs=0.01)


async def test_f4h_cockpit_jahr_traegt_dieselbe_waerme(db):
    a, _ = await _baue_f4h(db)
    j = await _jahr(db, a.id)
    assert j.wp_waerme_kwh == pytest.approx(2100.0)


# ═══ R-C — Lüften und Entfeuchten: Menge ja, Kennzahl nein ══════════════════

LUFT_DATEN = {
    "stromverbrauch_kwh": 400.0,
    "betriebsart_strom_lueften_kwh": 60.0,
    "betriebsart_strom_entfeuchten_kwh": 40.0,
    "betriebsart_nutzenergie_lueften_kwh": 150.0,
    "betriebsart_nutzenergie_entfeuchten_kwh": 90.0,
}


def test_die_mengen_tuer_liest_beide_betriebsarten():
    n = nutzenergie_ohne_kennzahl_kwh(LUFT_DATEN)
    assert n.lueften_kwh == pytest.approx(150.0)
    assert n.entfeuchten_kwh == pytest.approx(90.0)
    assert n.gemessen is True


def test_die_mengen_tuer_loest_innengeraete_auf():
    n = nutzenergie_ohne_kennzahl_kwh({
        "betriebsart_nutzenergie_lueften_kwh-1": 100.0,
        "betriebsart_nutzenergie_lueften_kwh-3": 50.0,
    })
    assert n.lueften_kwh == pytest.approx(150.0)
    assert n.entfeuchten_kwh == 0.0
    assert n.gemessen is True


def test_ohne_zaehler_meldet_die_mengen_tuer_nichts_gemessenes():
    n = nutzenergie_ohne_kennzahl_kwh({"stromverbrauch_kwh": 400.0})
    assert (n.lueften_kwh, n.entfeuchten_kwh, n.gemessen) == (0.0, 0.0, False)


def test_eine_gemessene_null_ist_eine_messung():
    n = nutzenergie_ohne_kennzahl_kwh({"betriebsart_nutzenergie_lueften_kwh": 0})
    assert n.gemessen is True


async def test_die_mengenzeile_erscheint_im_hub(db):
    a, _ = await _baue_f4h(db, LUFT_DATEN)
    z = (await _hub(db, a.id))[0].zusammenfassung
    assert z["modus_nutzenergie_lueften_kwh"] == pytest.approx(150.0)
    assert z["modus_nutzenergie_entfeuchten_kwh"] == pytest.approx(90.0)


async def test_die_mengenzeile_erscheint_nur_mit_zahl(db):
    """D-Sicht: ohne Zähler steht die Zeile **nicht** da — keine 0-Zeile."""
    a, _ = await _baue_f4h(db, {
        "stromverbrauch_kwh": 400.0,
        "betriebsart_strom_lueften_kwh": 60.0,
    })
    z = (await _hub(db, a.id))[0].zusammenfassung
    assert "modus_nutzenergie_lueften_kwh" not in z
    assert "modus_nutzenergie_entfeuchten_kwh" not in z


async def test_die_mengenzeile_erreicht_cockpit_monat_und_jahr(db):
    a, _ = await _baue_f4h(db, LUFT_DATEN)
    m = await _monat(db, a.id)
    assert m.wp_modus_nutzenergie_lueften_kwh == pytest.approx(150.0)
    assert m.wp_modus_nutzenergie_entfeuchten_kwh == pytest.approx(90.0)
    j = await _jahr(db, a.id)
    assert j.wp_modus_nutzenergie_lueften_kwh == pytest.approx(150.0)
    assert j.wp_modus_nutzenergie_entfeuchten_kwh == pytest.approx(90.0)


async def test_ohne_werte_bleiben_die_cockpit_felder_leer(db):
    a, _ = await _baue_f4h(db)
    m = await _monat(db, a.id)
    assert m.wp_modus_nutzenergie_lueften_kwh is None
    assert m.wp_modus_nutzenergie_entfeuchten_kwh is None


async def test_die_nutzenergie_lueften_erzeugt_keine_kennzahl(db):
    """**E4 bleibt.** Aus diesen Mengen entsteht kein Quotient — nirgends.

    Die Anlage hat Lüft-Strom **und** Lüft-Nutzenergie; gäbe es irgendwo eine
    „Arbeitszahl Lüften", stünde hier 150 ÷ 60 = 2,5.
    """
    a, _ = await _baue_f4h(db, LUFT_DATEN)
    hub = (await _hub(db, a.id))[0]
    als_text = repr(hub.zusammenfassung)
    assert "lueften" not in als_text.lower().replace(
        "modus_nutzenergie_lueften_kwh", "").replace(
        "modus_strom_lueften_kwh", "")
    # Und die Stromseite bleibt, wie sie war (E4: aus dem Nenner heraus).
    z = hub.zusammenfassung
    assert z["modus_strom_lueften_kwh"] == pytest.approx(60.0)


async def test_die_nutzenergie_faellt_in_keine_waermesumme(db):
    """⛔ Lüften/Entfeuchten sind **keine** Wärme — D1 rührt sie nicht an."""
    a, _ = await _baue_f4h(db, dict(LUFT_DATEN, heizenergie_kwh=500.0))
    z = (await _hub(db, a.id))[0].zusammenfassung
    assert z["gesamt_waerme_kwh"] == pytest.approx(500.0)


# ═══ R-A — die Fläche nennt die Auswertung ══════════════════════════════════

async def test_die_datenquellen_flaeche_nennt_wo_das_feld_ausgewertet_wird(db):
    from backend.api.routes.datenquellen import get_datenquellen_felder

    a, _ = await _baue_f4h(db)
    antwort = await get_datenquellen_felder(a.id, db=db)
    felder = {
        f["feld"]: f
        for g in antwort["gruppen"] for f in g["felder"]
    }
    assert "Komponenten → Wärmepumpe" in (
        felder["betriebsart_nutzenergie_heizen_kwh"]["ausgewertet_in"]
    )
    # Gegenprobe an einem Anlagen-Feld: der Typ-Schlüssel `basis` trifft.
    assert "Cockpit → Monat" in felder["netzbezug_kwh"]["ausgewertet_in"]


async def test_jedes_feld_der_flaeche_nennt_mindestens_eine_auswertung(db):
    """R-A an der **Fläche**, nicht nur an der Registry.

    ⭐ Der Wächter ``test_jedes_feld_hat_eine_auswertung.py`` prüft die Tabelle
    gegen die Registries. Diese Probe prüft die andere Richtung: kommt der Satz
    auch dort an, wo der Anwender ihn liest? Beides ist nötig — zwischen
    Registry und Fläche liegt die Route, und die hat ihre eigene Typ-Frage
    (Gruppen-Typ gegen Eintrags-Typ).
    """
    from backend.api.routes.datenquellen import get_datenquellen_felder
    from backend.core.feld_auswertungen import FELDER_OHNE_AUSWERTUNG_BEKANNT

    a, _ = await _baue_f4h(db)
    antwort = await get_datenquellen_felder(a.id, db=db)
    bekannt_leer = {f for _t, f in FELDER_OHNE_AUSWERTUNG_BEKANNT}
    stumm = [
        f["feld"]
        for g in antwort["gruppen"] for f in g["felder"]
        if not f["ausgewertet_in"] and f["feld"] not in bekannt_leer
    ]
    assert not stumm, (
        f"Diese Felder bietet die Fläche an, ohne zu sagen wo sie wirken: {stumm}"
    )
