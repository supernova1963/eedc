"""Bauschnitt 8 — die Detail-Liste des Wärme/Klima-Blocks wird **je Funktion**
gruppiert (Konzept Wärme/Klima §4 ②, §5 Position 3; Bauplan
``plans/bauplan-waerme-klima-bs8-funktions-gruppen.md``).

Die Gruppe **Kühlen** braucht eine Zeile „Kälte" — und die Kältemenge stand in
zwei der drei Cockpit-Antworten gar nicht:

* **Jahr** — ``WpJahreskennzahlen.kaelte_kwh`` wurde gerechnet und nicht
  ausgeliefert. Sie kommt aus dem Layer, **nicht** als Σ im Client (6b-M8).
* **Tag** — der Wert existierte nur lokal in der Route, als Zähler der Kühlzahl.

**Nullregel in allen drei Sichten: > 0, sonst ``None``.** Die Jahres-Σ ist 0 auch
ohne Kältemengenzähler; „0 kWh Kälte" behauptete dann eine Messung.

Dazu der **Vertrag, an dem die erste Fassung des Bauplans gescheitert ist**
(Gegenprüfung 11.09.2026): *Wo die Jahres-Arbeitszahl Heizen eine Zahl ist,
sind die angezeigte Heizwärme und der angezeigte Strom Heizen ihr Zähler und
Nenner.* ``getrennte_strommessung`` ist ein Stammdatum; ein Jahr, in dem der
Heizstrom erst ab Juli erfasst ist, **sperrt** — es rechnet nicht mit halben
Mengen. Genau darauf verlassen sich die Funktions-Gruppen, die Strom,
Nutzenergie und Arbeitszahl untereinander zeigen.
"""

from __future__ import annotations

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import GRUND_KEINE_KAELTE_ABGEGEBEN
from backend.models.investition import InvestitionMonatsdaten
from backend.tests.test_b3_hub_matrix import JAHR, LW, SPROSSEN
from backend.tests.test_b4_cockpit_matrix import _anlage, _geraet
from backend.tests.test_bs6_kaelte_je_tag import (
    KAELTE,
    _anlage as _tag_anlage,
    _klima_mit_kuehlstrom,
    _tag,
    _tageszaehler,
)

F5 = {**LW, "getrennte_strommessung": True}


async def _jahr(db, anlage_id):
    from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht

    return await get_cockpit_uebersicht(anlage_id, jahr=JAHR, db=db)


# ── Jahr: die Kältemenge aus dem Layer ──────────────────────────────────────

@pytest.mark.asyncio
async def test_jahr_liefert_die_kaeltemenge_aus_dem_layer(db):
    """F8: 900 kWh Kälte auf 300 kWh Kühlstrom — Zähler und Menge sind dieselbe Zahl."""
    a = await _anlage(db, "BS8 F8")
    await _geraet(db, a, *SPROSSEN["F8_kaeltemenge"])
    await db.commit()
    j = await _jahr(db, a.id)
    assert j.wp_kaelte_kwh == pytest.approx(900.0)
    assert j.wp_jaz_kuehlen == pytest.approx(900.0 / 300.0)


@pytest.mark.asyncio
async def test_jahr_ohne_kaeltezaehler_nennt_keine_kaelte(db):
    """Die Jahres-Σ ist 0 — die Antwort sagt ``None``, nicht „0 kWh Kälte"."""
    a = await _anlage(db, "BS8 F7 ohne Kälte")
    await _geraet(db, a, *SPROSSEN["F7_wmz_je_funktion"])
    await db.commit()
    j = await _jahr(db, a.id)
    assert j.wp_kaelte_kwh is None


# ── Tag: die Kältemenge erreicht die Antwort ────────────────────────────────

class TestTagKaelte:
    async def test_innengeraete_ergeben_die_menge_neben_der_kuehlzahl(self, db):
        """Dieselbe Fixture wie 6a/P1 — 7 + 11 kWh Kälte je Innengerät auf 6 kWh
        Kühlstrom. Die Zeile „Kälte" ist der Zähler der Kühlzahl: 18 ÷ 6 = 3,0."""
        a = await _tag_anlage(db)
        inv = await _klima_mit_kuehlstrom(db, a, kuehlstrom=6.0)
        _tageszaehler(db, a, inv, f"{KAELTE}-1", 7.0)
        _tageszaehler(db, a, inv, f"{KAELTE}-3", 11.0)

        r = await _tag(db, a)

        assert r.wp_kaelte_kwh == pytest.approx(18.0)
        assert r.wp_jaz_kuehlen == pytest.approx(r.wp_kaelte_kwh / 6.0)

    async def test_gemessene_null_ist_keine_zeile_sondern_ein_grund(self, db):
        """Der Zähler meldet 0 — keine Zeile „Kälte 0 kWh", die Kühlzahl sagt warum."""
        a = await _tag_anlage(db)
        inv = await _klima_mit_kuehlstrom(db, a)
        _tageszaehler(db, a, inv, KAELTE, 0.0)

        r = await _tag(db, a)

        assert r.wp_kaelte_kwh is None
        assert r.wp_jaz_kuehlen_grund == GRUND_KEINE_KAELTE_ABGEGEBEN

    async def test_ohne_kaeltezaehler_keine_kaelte(self, db):
        a = await _tag_anlage(db)
        await _klima_mit_kuehlstrom(db, a)

        r = await _tag(db, a)

        assert r.wp_kaelte_kwh is None


# ── Der Vertrag hinter den Gruppen: Zahl ⇒ Zähler und Nenner stehen daneben ──

async def _monat(db, inv, monat, daten):
    db.add(InvestitionMonatsdaten(investition_id=inv.id, jahr=JAHR, monat=monat,
                                  verbrauch_daten=daten, source_provenance={}))


@pytest.mark.asyncio
async def test_heizstrom_erst_ab_juli_sperrt_statt_halb_zu_rechnen(db):
    """Fall A der Gegenprüfung: Kennzeichen ganzjährig (Stammdatum), Wärme im März
    und im Juli, Heizstrom nur im Juli. Mit halben Mengen stünde 3600 ÷ 600 = 6,0
    neben „Heizwärme 3600 · Strom Heizen 600" — die Gruppe spräche sich selbst
    nicht zu. Richtig ist: keine Zahl, aber ein Grund."""
    a = await _anlage(db, "BS8 Fall A")
    inv = await _geraet(db, a, F5)
    await _monat(db, inv, 3, {"heizenergie_kwh": 1800.0})
    await _monat(db, inv, 7, {"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0})
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_heizung_kwh == pytest.approx(3600.0)
    assert j.wp_strom_heizen_kwh == pytest.approx(600.0)
    assert j.wp_jaz_heizen is None
    assert j.wp_jaz_heizen_grund


@pytest.mark.asyncio
async def test_wo_eine_zahl_steht_sind_die_nachbarzeilen_ihr_bruch(db):
    """Fall B: Wärme und Heizstrom beide nur im Juli ⇒ 1800 ÷ 600 = 3,0, und die
    zwei Mengen der Gruppe sind genau Zähler und Nenner dieser Zahl."""
    a = await _anlage(db, "BS8 Fall B")
    inv = await _geraet(db, a, F5)
    await _monat(db, inv, 7, {"heizenergie_kwh": 1800.0, "strom_heizen_kwh": 600.0})
    await db.commit()

    j = await _jahr(db, a.id)

    assert j.wp_heizung_kwh == pytest.approx(1800.0)
    assert j.wp_strom_heizen_kwh == pytest.approx(600.0)
    assert j.wp_jaz_heizen == pytest.approx(j.wp_heizung_kwh / j.wp_strom_heizen_kwh)
