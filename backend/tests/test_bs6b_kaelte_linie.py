"""Bauschnitt 6b — die **Kälte-Linie** in Tag, Monat und Jahr, und N-437.

Konzept Wärme/Klima §8: Kälte ist eine eigene Rolle — eigene Linie, eigene
Farbe, nie in der Wärme. Bauplan ``plans/bauplan-waerme-klima-bs6b-kaelte-linie.md``
(Fassung 3, zwei Runden Gegenprüfung, 11.09.2026).

⭐ **Der Gegenstand dieser Datei sind einzelne Stunden, nicht die Summe.**
``verteile_menge`` normiert — die Summe einer Linie stimmt per Konstruktion,
auch wenn die Stunden falsch sind. Genau so hätte eine Summenprobe den Defekt
N-437 übersehen: Die Wärme-Linie aus Bauschnitt 5 verteilte die Summe ALLER
Geräte auf die Summe ihrer Formen (Snapshot-Pfad: Bs Wärme in As Stunden;
HA-Hauptpfad: die Form eines Geräts, dessen Tageswert verworfen war) und ließ
eine Menge ohne Form still fallen.

Die Lösung ist die Bauform des Stapels (``tages_stapel.py``): je Gerät, je Feld
verteilen, je Stunde mit ``geraetefeld_oder_innengeraete`` auflösen, den Rest je
Gerät gegen den Tageswert messen.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest

from backend.core.berechnungen.tages_stapel import verteile_felder_auf_stunden
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.energie_profil._provenance_helpers import seed_tz_provenance
from backend.services.snapshot.aggregator import get_tagesdetail_kwh
from backend.services.snapshot.boundary_range import TZ_QUELLE_LTS

DATUM = date(2025, 7, 15)
T0 = datetime.combine(DATUM, datetime.min.time())
KAELTE = "betriebsart_nutzenergie_kuehlen_kwh"
HEIZ = "heizenergie_kwh"
WW = "warmwasser_kwh"
LL = {"wp_art": "luft_luft"}
LW = {"wp_art": "luft_wasser"}


def _eins(h: int) -> list:
    return [1.0 if i == h else 0.0 for i in range(24)]


# ── Aufbau ──────────────────────────────────────────────────────────────────

async def _anlage(db):
    a = Anlage(anlagenname="BS6b", leistung_kwp=10.0, installationsdatum=date(2025, 1, 1))
    db.add(a)
    await db.flush()
    a.sensor_mapping = {"investitionen": {}}
    return a


async def _wp(db, anlage, name, params=LL):
    inv = Investition(anlage_id=anlage.id, typ="waermepumpe", bezeichnung=name,
                      anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=1000.0,
                      parameter=params)
    db.add(inv)
    await db.flush()
    return inv


def _reihe(db, anlage, inv, feld, zuwachs_je_slot: dict, *, start=100.0,
           ruecksprung_bei=None, reset_bei=None):
    """Stände an den Offsets −1 … 24; ``zuwachs_je_slot[k]`` = Zuwachs in [k−1, k).

    Slot 0 ist [Vortag 23:00, 00:00), Slot 24 ist [23:00, 24:00) heute — die
    beiden Randstunden, an denen sich die Fenster [0, 24) und [Vortag 23, 23)
    unterscheiden.
    """
    felder = anlage.sensor_mapping["investitionen"].setdefault(
        str(inv.id), {"felder": {}},
    )["felder"]
    felder[feld] = {"strategie": "sensor", "sensor_id": f"sensor.{inv.id}_{feld}"}
    w = start
    for k in range(-1, 25):
        if reset_bei is not None and k == reset_bei:
            w = 0.0
        if k >= 0:
            w += zuwachs_je_slot.get(k, 0.0)
        if ruecksprung_bei is not None and k == ruecksprung_bei:
            w -= 50.0  # echter Rücksprung, kein Tagesreset
        db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=f"inv:{inv.id}:{feld}",
                              zeitpunkt=T0 + timedelta(hours=k), wert_kwh=w,
                              quelle="ha_statistics"))


def _lts(db, anlage, invs):
    """Tageszeile wie im HA-Hauptpfad — Fenster [Vortag 23:00, 23:00)."""
    tz = TagesZusammenfassung(anlage_id=anlage.id, datum=DATUM, komponenten_kwh={
        f"waermepumpe_{i.id}": 5.0 for i in invs})
    seed_tz_provenance(tz, writer="test", source=TZ_QUELLE_LTS)
    db.add(tz)


async def _speichern(db, anlage):
    anlage.sensor_mapping = dict(anlage.sensor_mapping)
    await db.commit()


async def _stunden(db, anlage):
    from backend.api.routes.energie_profil.views import get_waerme_verlauf_stunden

    await _speichern(db, anlage)
    return await get_waerme_verlauf_stunden(anlage.id, DATUM, db)


def _linie(v, feld: str) -> list:
    return [getattr(s, feld) or 0.0 for s in v.stunden]


# ── P0: die Layer-Funktion ──────────────────────────────────────────────────


class TestVerteilungJeGeraetUndFeld:
    def test_geraetefeld_gewinnt_und_innengeraete_zaehlen_nicht_in_den_rest(self):
        werte, ohne = verteile_felder_auf_stunden(
            {"7": {KAELTE: 4.0, f"{KAELTE}-1": 1.0}},
            {"7": {KAELTE: _eins(10), f"{KAELTE}-1": _eins(3)}},
            KAELTE,
        )
        assert werte[10] == pytest.approx(4.0)
        assert werte[3] == 0.0
        assert ohne == 0.0

    def test_nichts_verteilbar_der_rest_ist_der_tag_nicht_die_feldsumme(self):
        """Rest je Gerät gegen den aufgelösten Tageswert (4,0) — nie Σ der
        Feldwerte (6,5), sonst ergäben Linie + Rest mehr als der Tag."""
        werte, ohne = verteile_felder_auf_stunden(
            {"7": {KAELTE: 4.0, f"{KAELTE}-1": 1.0, f"{KAELTE}-3": 1.5}},
            {"7": {k: [0.0] * 24 for k in (KAELTE, f"{KAELTE}-1", f"{KAELTE}-3")}},
            KAELTE,
        )
        assert sum(werte) == 0.0
        assert ohne == pytest.approx(4.0)

    def test_zwei_geraete_bleiben_in_ihren_stunden(self):
        werte, ohne = verteile_felder_auf_stunden(
            {"A": {HEIZ: 2.0}, "B": {HEIZ: 6.0}},
            {"A": {HEIZ: _eins(5)}, "B": {HEIZ: [0.0] * 24}},
            HEIZ,
        )
        assert werte[5] == pytest.approx(2.0)
        assert sum(werte) == pytest.approx(2.0)
        assert ohne == pytest.approx(6.0)

    def test_nur_innengeraete_ergeben_ihre_stunden(self):
        werte, ohne = verteile_felder_auf_stunden(
            {"7": {f"{KAELTE}-1": 4.0, f"{KAELTE}-3": 8.0}},
            {"7": {f"{KAELTE}-1": _eins(3), f"{KAELTE}-3": _eins(14)}},
            KAELTE,
        )
        assert (werte[3], werte[14], ohne) == (pytest.approx(4.0), pytest.approx(8.0), 0.0)


# ── P1: zwei Geräte, Snapshot-Pfad — keine fremden Stunden ──────────────────


@pytest.mark.parametrize("feld,antwort,rest,params", [
    (HEIZ, "wp_waerme_kwh", "waerme_ohne_stundenform_kwh", LW),
    (KAELTE, "wp_kaelte_kwh", "kaelte_ohne_stundenform_kwh", LL),
], ids=["waerme", "kaelte"])
async def test_p1_snapshot_pfad_zwei_geraete(db, feld, antwort, rest, params):
    """A: 2 kWh in [Vortag 23, 0) und 2 kWh in [10, 11). B: 6 kWh in [23, 24).
    Keine Tageszeile ⇒ Tageswert [0, 24): A 2,0 · B 6,0. Die Form liegt im
    Raster [Vortag 23, 23) — B hat dort nichts."""
    a = await _anlage(db)
    wa = await _wp(db, a, "A", params)
    wb = await _wp(db, a, "B", params)
    _reihe(db, a, wa, feld, {0: 2.0, 11: 2.0})
    _reihe(db, a, wb, feld, {24: 6.0})
    v = await _stunden(db, a)
    tag = await get_tagesdetail_kwh(db, a, {str(wa.id): wa, str(wb.id): wb}, DATUM)
    key = "wp_heizung_kwh" if feld == HEIZ else "wp_kaelte_kwh"

    linie = _linie(v, antwort)
    # As 2 kWh bleiben in As Stunden (innerhalb des Geräts verteilt, BS5 E1 (a)).
    assert linie[11] == pytest.approx(1.0, abs=1e-3)
    assert linie[0] == pytest.approx(1.0, abs=1e-3)
    # Bs 6 kWh stehen in KEINER Stunde — sie werden genannt.
    assert getattr(v, rest) == pytest.approx(6.0)
    assert sum(linie) + getattr(v, rest) == pytest.approx(tag.werte[key], abs=0.01)


# ── P1b: HA-Hauptpfad — ein Gerät ohne Tageswert gibt keine Form ab ─────────


@pytest.mark.parametrize("b_reihe", [
    dict(zuwachs_je_slot={15: 3.0}, ruecksprung_bei=20),
    dict(zuwachs_je_slot={0: 0.3, 15: 3.0}, start=40.0, reset_bei=0),
], ids=["ruecksprung", "tagesreset"])
async def test_p1b_hauptpfad_geraet_ohne_tageswert(db, b_reihe):
    a = await _anlage(db)
    wa = await _wp(db, a, "A", LW)
    wb = await _wp(db, a, "B", LW)
    _reihe(db, a, wa, HEIZ, {5: 1.0})
    _reihe(db, a, wb, HEIZ, **b_reihe)
    _lts(db, a, [wa, wb])
    v = await _stunden(db, a)

    linie = _linie(v, "wp_waerme_kwh")
    assert linie[5] == pytest.approx(1.0, abs=1e-3)
    assert linie[15] == 0.0  # Bs Stunde — B trägt am Tag nichts bei
    assert sum(linie) == pytest.approx(1.0, abs=1e-3)


# ── P2: Innengeräte — die Stunde nimmt dieselbe Quelle wie der Tag ──────────


async def test_p2_ruecksprung_am_geraetefeld_die_innengeraete_tragen_die_stunden(db):
    a = await _anlage(db)
    inv = await _wp(db, a, "Multisplit")
    _reihe(db, a, inv, KAELTE, {k: 1.0 for k in range(3, 9)}, ruecksprung_bei=12)
    _reihe(db, a, inv, f"{KAELTE}-1", {3: 4.0})
    _reihe(db, a, inv, f"{KAELTE}-3", {14: 8.0})
    _lts(db, a, [inv])
    v = await _stunden(db, a)

    linie = _linie(v, "wp_kaelte_kwh")
    assert linie[3] == pytest.approx(4.0, abs=1e-3)
    assert linie[14] == pytest.approx(8.0, abs=1e-3)
    assert linie[5] == 0.0
    assert v.kaelte_ohne_stundenform_kwh is None


async def test_p2b_geraetefeld_intakt_die_innengeraete_werden_nie_addiert(db):
    a = await _anlage(db)
    inv = await _wp(db, a, "Multisplit")
    _reihe(db, a, inv, KAELTE, {10: 12.0})
    _reihe(db, a, inv, f"{KAELTE}-1", {3: 4.0})
    _reihe(db, a, inv, f"{KAELTE}-3", {14: 8.0})
    _lts(db, a, [inv])
    v = await _stunden(db, a)

    linie = _linie(v, "wp_kaelte_kwh")
    assert linie[10] == pytest.approx(12.0, abs=1e-3)
    assert (linie[3], linie[14]) == (0.0, 0.0)
    assert v.kaelte_ohne_stundenform_kwh is None


async def test_p2c_nur_innengeraete_ergeben_eine_linie(db):
    a = await _anlage(db)
    inv = await _wp(db, a, "Multisplit")
    _reihe(db, a, inv, f"{KAELTE}-1", {3: 4.0})
    _reihe(db, a, inv, f"{KAELTE}-3", {14: 8.0})
    _lts(db, a, [inv])
    v = await _stunden(db, a)

    linie = _linie(v, "wp_kaelte_kwh")
    assert (linie[3], linie[14]) == (pytest.approx(4.0, abs=1e-3), pytest.approx(8.0, abs=1e-3))


async def test_p2d_menge_ohne_form_wird_genannt_statt_still_zu_fallen(db):
    """EIN Gerät, Snapshot-Pfad: Heizung nur in [23, 24), Warmwasser in [9, 10).
    Bis 11.09.2026: Tag 7,0, Linie 2,0, kein Hinweis."""
    from backend.api.routes.energie_profil.views import get_tag_detail

    a = await _anlage(db)
    inv = await _wp(db, a, "WP", LW)
    _reihe(db, a, inv, HEIZ, {24: 5.0})
    _reihe(db, a, inv, WW, {10: 2.0})
    v = await _stunden(db, a)
    tag = await get_tag_detail(a.id, DATUM, db)

    linie = _linie(v, "wp_waerme_kwh")
    assert linie[10] == pytest.approx(2.0, abs=1e-3)
    assert v.waerme_ohne_stundenform_kwh == pytest.approx(5.0)
    assert sum(linie) + v.waerme_ohne_stundenform_kwh == pytest.approx(tag.wp_waerme_kwh, abs=0.01)


# ── P3: Kälte ist keine Wärme — Stunde, Monatszeile ─────────────────────────


async def test_p3_kaelte_erreicht_die_waerme_nie(db):
    from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

    a = await _anlage(db)
    inv = await _wp(db, a, "WP", LW)
    _reihe(db, a, inv, HEIZ, {5: 60.0})
    _reihe(db, a, inv, KAELTE, {14: 30.0})
    _lts(db, a, [inv])
    v = await _stunden(db, a)
    zeilen = await lade_waerme_verlauf(db, a, {str(inv.id): inv}, DATUM, DATUM)

    assert sum(_linie(v, "wp_waerme_kwh")) == pytest.approx(60.0, abs=1e-3)
    assert _linie(v, "wp_waerme_kwh")[14] == 0.0
    assert sum(_linie(v, "wp_kaelte_kwh")) == pytest.approx(30.0, abs=1e-3)
    assert zeilen[0].waerme_kwh == pytest.approx(60.0)
    assert zeilen[0].kaelte_kwh == pytest.approx(30.0)


# ── P4/P5: der Monats-Verlauf ───────────────────────────────────────────────


async def test_p4_ein_tag_nur_mit_kaelte_erscheint(db):
    from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

    a = await _anlage(db)
    inv = await _wp(db, a, "Klima")
    _reihe(db, a, inv, KAELTE, {5: 12.0})
    await _speichern(db, a)
    zeilen = await lade_waerme_verlauf(db, a, {str(inv.id): inv}, DATUM, DATUM)

    assert len(zeilen) == 1
    assert zeilen[0].kaelte_kwh == pytest.approx(12.0)
    assert zeilen[0].waerme_kwh is None


async def test_p5_monatssaeule_gleich_tagessicht_im_rueckwaertsfenster(db):
    """Ungleiche Randstunden: [Vortag 23, 23) = 2 + 3 = 5,0; [0, 24) = 3 + 0,5."""
    from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

    a = await _anlage(db)
    inv = await _wp(db, a, "Klima")
    _reihe(db, a, inv, KAELTE, {0: 2.0, 10: 3.0, 24: 0.5})
    _lts(db, a, [inv])
    v = await _stunden(db, a)
    zeilen = await lade_waerme_verlauf(db, a, {str(inv.id): inv}, DATUM, DATUM)
    tag = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM, tageszeile_rueckwaerts=True)

    assert tag.werte["wp_kaelte_kwh"] == pytest.approx(5.0)
    assert zeilen[0].kaelte_kwh == pytest.approx(5.0)
    assert sum(_linie(v, "wp_kaelte_kwh")) == pytest.approx(5.0, abs=1e-3)


# ── P6: die Monatsantwort (Jahr baut seine Punkte daraus) ───────────────────


@pytest.mark.parametrize("kaelte,erwartet", [(30.0, 30.0), (None, None)],
                         ids=["mit_kaeltezaehler", "ohne_kaeltezaehler"])
async def test_p6_monatsantwort_traegt_die_kaelte_oder_nichts(db, kaelte, erwartet):
    from backend.api.routes.aktueller_monat import get_aktueller_monat
    from backend.tests.test_b3_hub_matrix import JAHR, MONAT
    from backend.tests.test_b4_cockpit_matrix import _anlage as _anlage_b4
    from backend.tests.test_b4_cockpit_matrix import _geraet as _geraet_b4

    a = await _anlage_b4(db, "P6")
    daten = {"stromverbrauch_kwh": 40.0, "betriebsart_strom_kuehlen_kwh": 10.0}
    if kaelte is not None:
        daten[KAELTE] = kaelte
    await _geraet_b4(db, a, LW, daten=daten)
    await db.commit()
    m = await get_aktueller_monat(a.id, jahr=JAHR, monat=MONAT, db=db)

    assert m.wp_kaelte_kwh == (pytest.approx(erwartet) if erwartet is not None else None)
    if erwartet is not None:
        # Derselbe Wert wie der Zähler der Kühlzahl daneben (S1).
        assert m.wp_jaz_kuehlen == pytest.approx(3.0)
