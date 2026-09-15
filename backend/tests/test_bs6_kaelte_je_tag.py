"""Bauschnitt 6 — die **Kälte erreicht den Tag** (Konzept Wärme/Klima §8, E2′).

**Vorher** stand unter *Cockpit → Tag · Arbeitszahl Kühlen* immer ein Grund
(„nur im Monat"): Die Kältemenge (``betriebsart_nutzenergie_kuehlen_kwh``) ist ein
stündlicher Zähler, hatte aber keinen Tagespfad. **Jetzt** rechnet der Tag
dieselbe Kühlzahl wie der Monat (``arbeitszahl_kuehlen``).

Vier Fallen, alle gemessen, bevor gebaut wurde (Bauplan
``plans/bauplan-waerme-klima-bs6-kaelte-tag.md``, Gegenprüfung 11.09.2026):

* **P1 · Innengeräte.** Der Tagespfad las nur den exakten Key; ein Multisplit mit
  Kälte je Innengerät bekam keine Zahl und den Grund „nicht zugeordnet".
* **P2 · Fenster.** Im HA-Add-on steht der Kühlstrom im Fenster der Tageszeile
  [Vortag 23:00, 23:00) — die Kälte muss dort mitlesen (N-435-Klasse).
* **P3 · Geräte-Kreis.** Kälte aller Geräte ÷ Kühlstrom nur der Stapel-Geräte
  ergab **6,0 statt 3,0**, und die Monats-Deckung sperrte nicht.
* **P5 · Grund.** Die Kurzform der Tagesgründe spricht von einem
  *Wärme*mengenzähler — unter der Kühlzahl eine Falschaussage für jeden.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    GRUND_FUNKTION_NICHT_DECKUNGSGLEICH,
    GRUND_KEINE_KAELTE_ABGEGEBEN,
    GRUND_KEINE_KAELTEMENGE,
    GRUND_KEIN_KUEHLBETRIEB,
)
from backend.core.tageswert_grund import (
    GRUND_KEINE_ZAEHLERSTAENDE,
    TAGESWERT_GRUND_KURZ,
)
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.energie_profil._provenance_helpers import seed_tz_provenance
from backend.services.snapshot.aggregator import (
    TAGESDETAIL_AUSGABE,
    WAERME_AUSGABE_KEYS,
    get_tagesdetail_kwh,
)
from backend.services.snapshot.boundary_range import TZ_QUELLE_LTS
from backend.services.snapshot.bereichs_leser import lade_tageswerte_je_feld

DATUM = date(2025, 7, 15)
T0 = datetime.combine(DATUM, datetime.min.time())
KAELTE = "betriebsart_nutzenergie_kuehlen_kwh"
STROM_K = "betriebsart_strom_kuehlen_kwh"
LL = {"wp_art": "luft_luft"}
KAELTE_FELDER = {k: v for k, v in TAGESDETAIL_AUSGABE.items() if v == "wp_kaelte_kwh"}


# ── Aufbau ──────────────────────────────────────────────────────────────────

async def _anlage(db):
    a = Anlage(anlagenname="BS6", leistung_kwp=10.0, installationsdatum=date(2025, 1, 1))
    db.add(a)
    await db.flush()
    a.sensor_mapping = {"investitionen": {}}
    return a


async def _geraet(db, anlage, params=LL):
    inv = Investition(anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Klima",
                      anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=1000.0,
                      parameter=params)
    db.add(inv)
    await db.flush()
    return inv


def _zaehler(db, anlage, inv, feld, staende=None):
    """Feld zuordnen; ``staende`` = [(Zeitpunkt, Stand)] oder ``None`` (nur zugeordnet)."""
    felder = anlage.sensor_mapping["investitionen"].setdefault(
        str(inv.id), {"felder": {}},
    )["felder"]
    felder[feld] = {"strategie": "sensor", "sensor_id": f"sensor.{inv.id}_{feld}"}
    for ts, wert in staende or []:
        db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=f"inv:{inv.id}:{feld}",
                              zeitpunkt=ts, wert_kwh=wert, quelle="ha_statistics"))


def _tageszaehler(db, anlage, inv, feld, kwh):
    """Zwei Stände an den Tagesgrenzen [00:00, 24:00) — der Snapshot-Tag."""
    _zaehler(db, anlage, inv, feld, [(T0, 100.0), (T0 + timedelta(days=1), 100.0 + kwh)])


def _tageszeile(db, anlage, bezug_je_inv: dict, *, lts: bool = False):
    tz = TagesZusammenfassung(
        anlage_id=anlage.id, datum=DATUM,
        komponenten_kwh={f"waermepumpe_{i}": v for i, v in bezug_je_inv.items()},
    )
    seed_tz_provenance(tz, writer="test",
                       source=TZ_QUELLE_LTS if lts else "auto:monatsabschluss")
    db.add(tz)


async def _tag(db, anlage):
    from backend.api.routes.energie_profil.views import get_tag_detail

    # Das Mapping ist ein JSON-Feld — neu zuweisen, damit es persistiert.
    anlage.sensor_mapping = dict(anlage.sensor_mapping)
    await db.commit()
    return await get_tag_detail(anlage.id, DATUM, db)


async def _klima_mit_kuehlstrom(db, anlage, kuehlstrom=6.0, bezug=30.0):
    inv = await _geraet(db, anlage)
    _tageszaehler(db, anlage, inv, STROM_K, kuehlstrom)
    _tageszeile(db, anlage, {inv.id: bezug})
    return inv


# ── P1: Innengeräte ─────────────────────────────────────────────────────────

class TestInnengeraete:
    async def test_nur_innengeraete_ergeben_die_summe(self, db):
        """Kälte nur je Innengerät (7 + 11) ⇒ 18 ÷ 6 = 3,0 — vorher keine Zahl."""
        a = await _anlage(db)
        inv = await _klima_mit_kuehlstrom(db, a, kuehlstrom=6.0)
        _tageszaehler(db, a, inv, f"{KAELTE}-1", 7.0)
        _tageszaehler(db, a, inv, f"{KAELTE}-3", 11.0)

        r = await _tag(db, a)

        assert r.wp_jaz_kuehlen == pytest.approx(3.0)
        assert r.wp_jaz_kuehlen_grund is None

    async def test_geraetefeld_gewinnt_und_wird_nie_addiert(self, db):
        """Gerätefeld 12 neben Innengeräten 5 + 7 ⇒ 12, nicht 24 (SOLL §6.1)."""
        a = await _anlage(db)
        inv = await _geraet(db, a)
        _tageszaehler(db, a, inv, KAELTE, 12.0)
        _tageszaehler(db, a, inv, f"{KAELTE}-1", 5.0)
        _tageszaehler(db, a, inv, f"{KAELTE}-3", 7.0)
        await db.commit()

        d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM)

        assert d.werte["wp_kaelte_kwh"] == pytest.approx(12.0)
        assert d.werte_je_inv["wp_kaelte_kwh"] == {str(inv.id): pytest.approx(12.0)}
        assert "wp_kaelte_kwh" not in d.grund_je_feld


# ── P2: das Fenster der Tageszeile ──────────────────────────────────────────

class TestFenster:
    async def test_lts_tag_liest_die_kaelte_im_rueckwaertsfenster(self, db):
        """Randstunden 2,0 (gestern 23–24) und 0,2 (heute 23–24), Kühlzahl 3,0 in
        jeder Stunde. ⚠ Die Ränder sind bewusst **ungleich** — bei gleichen
        Randstunden ergäben beide Fenster dieselbe Summe, und die Probe maß
        nichts (Lehre Sitzung 200)."""
        a = await _anlage(db)
        inv = await _geraet(db, a)
        zeiten = [T0 - timedelta(hours=1), T0, T0 + timedelta(hours=23),
                  T0 + timedelta(hours=24)]
        strom = [100.0, 102.0, 107.0, 107.2]
        _zaehler(db, a, inv, STROM_K, list(zip(zeiten, strom)))
        _zaehler(db, a, inv, KAELTE,
                 list(zip(zeiten, [1000.0 + 3.0 * (s - 100.0) for s in strom])))
        _tageszeile(db, a, {inv.id: strom[2] - strom[0]}, lts=True)

        r = await _tag(db, a)

        assert r.wp_modus_strom_kuehlen_kwh == pytest.approx(7.0)
        assert r.wp_jaz_kuehlen == pytest.approx(3.0, abs=0.01)


# ── P3: der Geräte-Kreis, beidseitig ────────────────────────────────────────

class TestGeraeteKreis:
    async def _zwei_klimageraete(self, db, bezug_a, *, strom_a: bool = True):
        a = await _anlage(db)
        ia, ib = await _geraet(db, a), await _geraet(db, a)
        for inv in (ia, ib):
            if inv is ia and not strom_a:
                # Zähler **zugeordnet**, aber ohne einen einzigen Stand an diesem
                # Tag: dann gibt es für dieses Gerät keinen Nenner — weder aus der
                # Tageszeile noch aus den Rändern (R-4).
                _zaehler(db, a, inv, STROM_K)
            else:
                _tageszaehler(db, a, inv, STROM_K, 10.0)
            _tageszaehler(db, a, inv, KAELTE, 30.0)
        bezug = {ib.id: 12.0}
        if bezug_a is not None:
            bezug[ia.id] = bezug_a
        _tageszeile(db, a, bezug)
        return await _tag(db, a)

    @pytest.mark.parametrize(
        "bezug_a,strom_a", [(None, False), (5.0, True)],
        ids=["ohne_stromwert", "invariante"],
    )
    async def test_ein_geraet_faellt_aus_dem_stapel(self, db, bezug_a, strom_a):
        """Gerät A fehlt im Stapel, seine 30 kWh Kälte stünden aber im Zähler ⇒
        vorher **6,0**. Jetzt: der Grund.

        ⛔ **Die erste Lage hieß bis zum 15.09.2026 „ohne_bezug" und gab Gerät A
        einen vollen Kühlstrom-Tageswert, nur keine Zeile in
        ``komponenten_kwh``.** Genau diese Lage gibt es seit **R-4** nicht mehr:
        Fehlt die Tageszeile, löst der Tag den Strom aus den Randständen auf
        (``core/berechnungen/wp_tages_praezedenz``) — Gerät A trägt dann sehr
        wohl einen Nenner, und 60 ÷ 20 = 3,0 ist die **richtige** Antwort (die
        Kontrollprobe darunter hält sie fest). *Die Probe war nur wahr, weil der
        Tag eine Messung verlor.*

        **Die Substanz bleibt und wird schärfer:** R2 gilt beidseitig — ein
        Gerät, das Kälte in den Zähler gibt, ohne einen Nenner beizusteuern,
        sperrt die Kühlzahl. Die Lage dafür ist jetzt die echte: der
        Kühlstrom-Zähler ist **zugeordnet, liefert aber an diesem Tag keinen
        einzigen Stand**.
        """
        r = await self._zwei_klimageraete(db, bezug_a, strom_a=strom_a)

        assert r.wp_modus_strom_kuehlen_kwh == pytest.approx(10.0)
        assert r.wp_jaz_kuehlen is None
        assert r.wp_jaz_kuehlen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH

    async def test_beide_im_stapel_ergeben_die_zahl(self, db):
        """Kontrolle: beide tragen bei ⇒ 60 ÷ 20 = 3,0."""
        r = await self._zwei_klimageraete(db, 12.0)

        assert r.wp_jaz_kuehlen == pytest.approx(3.0)

    async def test_ohne_tageszeile_traegt_der_tagesrand(self, db):
        """**R-4, die Gegenprobe zur ersten Lage oben.** Gerät A hat gemessene
        Randstände, aber keinen Eintrag in ``komponenten_kwh`` — der Tag löst
        seinen Strom selbst auf, beide Geräte stehen im Stapel: 60 ÷ 20 = 3,0.

        Vor dem 15.09.2026 fiel A hier aus dem Stapel und die Kühlzahl war
        gesperrt, obwohl **beide** Zähler dieses Geräts gemessen hatten.
        """
        r = await self._zwei_klimageraete(db, None)

        assert r.wp_modus_strom_kuehlen_kwh == pytest.approx(20.0)
        assert r.wp_jaz_kuehlen == pytest.approx(3.0)
        assert r.wp_jaz_kuehlen_grund is None


# ── P4–P6: der Grund sagt, was zutrifft ─────────────────────────────────────

class TestGrund:
    async def test_zugeordnet_aber_ohne_staende(self, db):
        """P4 — die Substanz der früheren N-348-Probe: Einer Anlage MIT
        Kältemengenzähler wird nie gesagt, sie habe keinen."""
        a = await _anlage(db)
        inv = await _klima_mit_kuehlstrom(db, a)
        _zaehler(db, a, inv, KAELTE)  # zugeordnet, für diesen Tag keine Stände

        r = await _tag(db, a)

        assert r.wp_jaz_kuehlen is None
        assert r.wp_jaz_kuehlen_grund == TAGESWERT_GRUND_KURZ[GRUND_KEINE_ZAEHLERSTAENDE]
        assert r.wp_jaz_kuehlen_grund != GRUND_KEINE_KAELTEMENGE

    async def test_ohne_kaeltezaehler_der_normalfall(self, db):
        """P5 — kein Kältemengenzähler (nach IST F8 jeder bekannte Anwender):
        „kein Kältemengenzähler zugeordnet", nie „Wärmemengenzähler"."""
        a = await _anlage(db)
        await _klima_mit_kuehlstrom(db, a)

        r = await _tag(db, a)

        assert r.wp_jaz_kuehlen is None
        assert r.wp_jaz_kuehlen_grund == GRUND_KEINE_KAELTEMENGE
        assert "Wärme" not in r.wp_jaz_kuehlen_grund

    async def test_zaehler_meldet_null(self, db):
        """P6 — Kühlstrom floss, der Kältezähler meldet 0 (z. B. Gerät im
        Kühlmodus pausiert). Nicht „kein Kühlbetrieb": der Kühlstrom steht
        daneben und ist nicht null (Entscheid E1, 11.09.2026)."""
        a = await _anlage(db)
        inv = await _klima_mit_kuehlstrom(db, a)
        _tageszaehler(db, a, inv, KAELTE, 0.0)

        r = await _tag(db, a)

        assert r.wp_jaz_kuehlen is None
        assert r.wp_jaz_kuehlen_grund == GRUND_KEINE_KAELTE_ABGEGEBEN
        assert r.wp_jaz_kuehlen_grund != GRUND_KEIN_KUEHLBETRIEB


# ── P7: Kälte ist keine Wärme ───────────────────────────────────────────────

class TestKaelteIstKeineWaerme:
    def test_kaelte_steht_nicht_in_der_waerme_menge(self):
        """Der Stunden-Verlauf zeichnet genau ``WAERME_AUSGABE_KEYS`` als Wärme-
        Linie — stünde die Kälte darin, flösse sie in die Wärme (Konzept §8:
        eigene Rolle)."""
        assert "wp_kaelte_kwh" in TAGESDETAIL_AUSGABE.values()
        assert "wp_kaelte_kwh" not in WAERME_AUSGABE_KEYS

    async def test_tag_und_monatsverlauf_zaehlen_nur_die_waerme(self, db):
        from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

        a = await _anlage(db)
        inv = await _geraet(db, a, {"wp_art": "luft_wasser"})
        _tageszaehler(db, a, inv, "betriebsart_strom_heizen_kwh", 20.0)
        _tageszaehler(db, a, inv, STROM_K, 10.0)
        _tageszaehler(db, a, inv, "heizenergie_kwh", 60.0)
        _tageszaehler(db, a, inv, KAELTE, 30.0)
        _tageszeile(db, a, {inv.id: 30.0})

        r = await _tag(db, a)
        zeilen = await lade_waerme_verlauf(db, a, {str(inv.id): inv}, DATUM, DATUM)

        assert r.wp_waerme_kwh == pytest.approx(60.0)
        assert r.wp_jaz == pytest.approx(3.0)  # 60 ÷ (30 − 10 Kühlstrom), W-14
        assert r.wp_jaz_kuehlen == pytest.approx(3.0)
        assert zeilen[0].waerme_kwh == pytest.approx(60.0)


# ── P8: der Bereichs-Leser teilt die Regel ──────────────────────────────────

class TestBereichsLeser:
    @pytest.mark.parametrize("zaehler,erwartet", [
        ({f"{KAELTE}-1": 5.0, f"{KAELTE}-3": 7.0}, 12.0),
        ({KAELTE: 12.0, f"{KAELTE}-1": 5.0, f"{KAELTE}-3": 7.0}, 12.0),
    ], ids=["nur_innengeraete", "geraetefeld_gewinnt"])
    async def test_gleicht_dem_tages_einstieg(self, db, zaehler, erwartet):
        a = await _anlage(db)
        inv = await _geraet(db, a)
        for feld, kwh in zaehler.items():
            _tageszaehler(db, a, inv, feld, kwh)
        a.sensor_mapping = dict(a.sensor_mapping)
        await db.commit()
        invs = {str(inv.id): inv}

        bereich = await lade_tageswerte_je_feld(db, a, invs, DATUM, DATUM, KAELTE_FELDER)
        einzeln = await get_tagesdetail_kwh(db, a, invs, DATUM)

        assert bereich[DATUM]["wp_kaelte_kwh"] == pytest.approx(erwartet)
        assert einzeln.werte["wp_kaelte_kwh"] == pytest.approx(erwartet)
