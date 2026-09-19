"""N-391b — **D1 ist eine Regel je Gerät, und der Tag hat sie auf die Anlage
angewendet.**

**SOLL Wärme/Klima §3.2a (R1) · Konzept §3 K1 · §10.2 E1 (Mengen summiert) ·
ADR-002/P4.**

⛔ **Der Fall, gemessen am 14.09.2026 nach der Abnahme von WK-14b.** Zwei
Wärmepumpen an einer Anlage, verschieden verzählert — der Normalfall, sobald
jemand nachrüstet:

======================  =====================  ===================
Gerät                   Felder eines Tages     D1 dieses Geräts
======================  =====================  ===================
WP1 (Umschaltventil)    ``waerme_kwh`` 30      **30**
WP2 (zwei Zähler)       ``heizenergie`` 20     **25**
                        ``warmwasser`` 5
======================  =====================  ===================

Die Wärme des Tages ist **55**, und genau das sagt der Monat für denselben
Bestand (``imd_monatsaggregat`` wendet D1 je IMD-Zeile an). Der Tagespfad stand
an **drei** Stellen eine Ebene zu hoch:

* **Kachel** ``energie_profil/tag.py`` — ``waerme_gesamt_kwh`` auf
  ``TagesDetail.werte``, den Anlagensummen ⇒ ``waerme_gesamt_kwh(30, 20, 5)`` =
  **30**. Die Aufteilung von WP2 verschwand hinter dem Gesamtwert von WP1.
* **Stundenlinie** ``_waerme_linien_keys`` — ein **Alles-oder-nichts**: trug
  irgendein Gerät ``wp_waerme_kwh``, wurde für **alle** nur der Gesamtschlüssel
  gezeichnet. WP2 fehlte in der Linie vollständig, und zwar auch im genannten
  Rest (``waerme_ohne_stundenform_kwh``) — ihr Feld wurde gar nicht erst
  gelesen.
* **Wärmeverlauf-Tagesliste** ``waerme_verlauf.py`` — dieselbe Vorrangfrage auf
  der Summe, die ``lade_tageswerte_je_feld`` lieferte.

⚠ **Warum keine der 15 Proben aus ``test_n391_gesamtwaerme.py`` das sah:** sie
stellen durchweg **eine** Wärmepumpe nach. Mit einem Gerät ist die Anlagensumme
die Gerätezeile, und D1 auf der falschen Ebene ist bitgleich zur richtigen. Der
Defekt ist strukturell nur mit **zwei verschieden zählenden** Geräten sichtbar
— deshalb diese eigene Datei statt eines Anhangs: der Gegenstand ist nicht der
Erfassungsweg (N-391), sondern die **Ebene der Auflösung** auf der Leseseite.

⭐ **Was P4 dazu sagt:** *„Ein Wert-Pfad darf nie eine Null oder eine Teilsumme
als gültiges Ergebnis ausliefern, ohne dass die Antwort selbst es sagt."* 30
statt 55 ist genau eine solche Teilsumme — ohne Hinweis, und im Monat daneben
steht die richtige Zahl.

Schwesterdateien: ``test_n391_gesamtwaerme.py`` (der Erfassungsweg und die
Einzelgerät-Lagen), ``test_bs6b_kaelte_linie.py`` (die Bauform der Linie je
Gerät, N-437), ``test_r2_je_funktion.py`` (die Funktions-Dimension desselben
Quotienten).
"""

from __future__ import annotations

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    geraete_mit_gesamtwaerme,
    waerme_gesamt_je_geraet,
)
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.investition import InvestitionMonatsdaten
from backend.models.sensor_snapshot import SensorSnapshot  # noqa: F401
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.tests.test_bs6b_kaelte_linie import (
    DATUM,
    HEIZ,
    LW,
    WW,
    _anlage,
    _linie,
    _lts,
    _reihe,
    _speichern,
    _stunden,
    _wp,
)

#: Der gemeinsame Wärmemengenzähler (N-391) als Mapping-Feld.
GESAMT = "waerme_kwh"
#: Die Monatszeile, in der die Tageswerte stehen — ``DATUM`` liegt darin.
JAHR, MONAT = DATUM.year, DATUM.month


# ── Aufbau: EIN Bestand, zwei Wege in denselben Zeitraum ────────────────────


async def _mischfall(db, *, monatszeilen: bool = False):
    """Zwei Wärmepumpen, verschieden verzählert — Tag **und** Monat.

    Die Tageswerte sind zugleich die Monatswerte: Der Bestand hat an genau
    diesem einen Tag gearbeitet. Damit ist *Tag = Monat* keine Näherung,
    sondern eine Gleichung.
    """
    a = await _anlage(db)
    wp1 = await _wp(db, a, "WP1 Umschaltventil", LW)
    wp2 = await _wp(db, a, "WP2 zwei Zähler", LW)
    _lts(db, a, [wp1, wp2])
    _reihe(db, a, wp1, GESAMT, {10: 30.0})
    _reihe(db, a, wp2, HEIZ, {14: 20.0})
    _reihe(db, a, wp2, WW, {16: 5.0})
    if monatszeilen:
        db.add(InvestitionMonatsdaten(
            investition_id=wp1.id, jahr=JAHR, monat=MONAT,
            verbrauch_daten={"waerme_kwh": 30.0, "stromverbrauch_kwh": 10.0},
        ))
        db.add(InvestitionMonatsdaten(
            investition_id=wp2.id, jahr=JAHR, monat=MONAT,
            verbrauch_daten={"heizenergie_kwh": 20.0, "warmwasser_kwh": 5.0,
                             "stromverbrauch_kwh": 10.0},
        ))
    return a, wp1, wp2


async def _tag(db, anlage):
    from backend.api.routes.energie_profil.views import get_tag_detail

    await _speichern(db, anlage)
    return await get_tag_detail(anlage.id, DATUM, db)


# ═══ Die Layer-Regel für sich ══════════════════════════════════════════════


def test_die_regel_loest_je_geraet_auf_und_summiert_danach():
    """``waerme_gesamt_je_geraet`` ist D1 je Zeile — 30 + (20 + 5) = 55."""
    je_geraet = waerme_gesamt_je_geraet(
        {"1": 30.0}, {"2": 20.0}, {"2": 5.0},
    )

    assert je_geraet == {"1": pytest.approx(30.0), "2": pytest.approx(25.0)}
    assert sum(je_geraet.values()) == pytest.approx(55.0)


def test_der_gesamtwert_verdraengt_nur_die_aufteilung_seines_eigenen_geraets():
    """Lage BEIDES an WP1 — ihre 28 zählen nicht, WP2 behält ihre 25 (K1)."""
    je_geraet = waerme_gesamt_je_geraet(
        {"1": 30.0}, {"1": 28.0, "2": 20.0}, {"2": 5.0},
    )

    assert je_geraet["1"] == pytest.approx(30.0)
    assert je_geraet["2"] == pytest.approx(25.0)


def test_eine_gemessene_null_ist_kein_gesamtwert():
    """Sonst verlöre ein Gerät seine Aufteilung an einen Zähler, der schweigt."""
    assert geraete_mit_gesamtwaerme({"1": 0.0, "2": 30.0}) == frozenset({"2"})
    assert waerme_gesamt_je_geraet({"1": 0.0}, {"1": 20.0})["1"] == pytest.approx(20.0)


# ═══ a) Die Tages-Kachel ═══════════════════════════════════════════════════


async def test_a_die_tageskachel_nennt_die_waerme_beider_geraete(db):
    """Vorher **30** — die 25 kWh von WP2 fielen ohne Hinweis aus der Zahl."""
    a, _, _ = await _mischfall(db)

    tag = await _tag(db, a)

    assert tag.wp_waerme_kwh == pytest.approx(55.0)


# ═══ b) Die Stundenlinie ═══════════════════════════════════════════════════


async def test_b_die_stundenlinie_traegt_beide_geraete(db):
    """Vorher zeichnete sie **nur** WP1 (Alles-oder-nichts), Summe 30.

    Die Stunden sind der eigentliche Gegenstand: ``verteile_menge`` normiert,
    eine Summenprobe allein könnte eine falsche Zuordnung übersehen.
    """
    a, _, _ = await _mischfall(db)

    v = await _stunden(db, a)

    linie = _linie(v, "wp_waerme_kwh")
    assert linie[10] == pytest.approx(30.0, abs=1e-3)   # WP1, Gesamtzähler
    assert linie[14] == pytest.approx(20.0, abs=1e-3)   # WP2, Heizwärme
    assert linie[16] == pytest.approx(5.0, abs=1e-3)    # WP2, Warmwasser
    assert sum(linie) == pytest.approx(55.0, abs=1e-3)
    assert v.waerme_ohne_stundenform_kwh is None


async def test_b2_ein_geraet_mit_beidem_zeichnet_seine_waerme_nur_einmal(db):
    """Die Gegenprobe zur Aufhebung des Alles-oder-nichts.

    WP1 trägt Gesamtzähler **und** Aufteilung. Würde der Geräte-Filter fehlen,
    stünde ihre Wärme zweimal in der Linie (30 + 28) — genau deshalb steht
    ``wp_waerme_kwh`` nicht in ``WAERME_AUSGABE_KEYS``.
    """
    a = await _anlage(db)
    wp1 = await _wp(db, a, "WP1", LW)
    wp2 = await _wp(db, a, "WP2", LW)
    _lts(db, a, [wp1, wp2])
    _reihe(db, a, wp1, GESAMT, {10: 30.0})
    _reihe(db, a, wp1, HEIZ, {12: 28.0})
    _reihe(db, a, wp2, HEIZ, {14: 20.0})

    v = await _stunden(db, a)

    linie = _linie(v, "wp_waerme_kwh")
    assert linie[10] == pytest.approx(30.0, abs=1e-3)
    assert linie[12] == 0.0, "die verdrängte Aufteilung von WP1 gehört nicht dazu"
    assert linie[14] == pytest.approx(20.0, abs=1e-3)
    assert sum(linie) == pytest.approx(50.0, abs=1e-3)


# ═══ c) Die Wärmeverlauf-Tagesliste ════════════════════════════════════════


async def test_c_die_tagesliste_des_monatsverlaufs_nennt_dieselbe_waerme(db):
    """Die Säule in *Cockpit → Monat* — vorher **30**, wie die Kachel."""
    from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

    a, wp1, wp2 = await _mischfall(db)
    await _speichern(db, a)

    zeilen = await lade_waerme_verlauf(
        db, a, {str(wp1.id): wp1, str(wp2.id): wp2}, DATUM, DATUM,
    )

    assert len(zeilen) == 1
    assert zeilen[0].waerme_kwh == pytest.approx(55.0)


async def test_c2_die_tagesliste_haelt_die_kaelte_aus_der_waerme(db):
    """Der Bereichs-Leser liefert seit N-391b je Gerät — die Rolle bleibt getrennt."""
    from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

    a, wp1, wp2 = await _mischfall(db)
    _reihe(db, a, wp2, "betriebsart_nutzenergie_kuehlen_kwh", {18: 9.0})
    await _speichern(db, a)

    zeilen = await lade_waerme_verlauf(
        db, a, {str(wp1.id): wp1, str(wp2.id): wp2}, DATUM, DATUM,
    )

    assert zeilen[0].waerme_kwh == pytest.approx(55.0)
    assert zeilen[0].kaelte_kwh == pytest.approx(9.0)


# ═══ d) Tag = Monat ════════════════════════════════════════════════════════


async def test_d_der_tag_nennt_dieselbe_waerme_wie_der_monat(db):
    """**Eine Aussage, nicht zwei Zahlen** (SOLL §3.3/S1).

    Derselbe Bestand, derselbe Zeitraum, beide Wege durch die echten Routen:
    *Cockpit → Tag* gegen *Cockpit → Monat*. Vor dem Bau standen dort **30**
    und **55** — dieselbe Anlage, zwei Auskünfte.
    """
    from backend.api.routes.aktueller_monat import get_aktueller_monat

    a, _, _ = await _mischfall(db, monatszeilen=True)

    tag = await _tag(db, a)
    monat = await get_aktueller_monat(a.id, jahr=JAHR, monat=MONAT, db=db)

    assert tag.wp_waerme_kwh == pytest.approx(monat.wp_waerme_kwh)
    assert tag.wp_waerme_kwh == pytest.approx(55.0)
