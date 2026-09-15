"""Der Tag-Verlauf (Wärme/Klima Bauschnitt 5) — die Stunde verteilt den Tag.

**Die teuerste Falle, vor der der Auftrag warnt:** Stunden-kWh aus dem
Leistungspfad, Tageswert aus dem Zähler — ohne den Faktor aus
``falte_modus_split_tag`` hätte der Stapel eine andere Summe als der Balken
darunter. Das ist wörtlich W-17b (dietmar1968: 30 kWh gegen 284 kWh).

⭐ **Deshalb ist der Gegenstand dieser Datei die Summe:** Für jedes Segment gilt
Σ₂₄ Stunden = Tagesbalken — für beide Zweige, mit K2 an einem Gerät, mit
Innengeräten, über die echte Route gegen ``tag-detail`` derselben Anlage.

Und drei Fälle aus der Gegenprüfung (11.09.2026, Opus als Ersatz für Fable):

* **G3** — ``modus_strom_zeile`` ist nur mit fester Schlüsselmenge linear: fehlt
  das Gerätefeld in einer Stunde, summiert es die Innengeräte (5,5 statt 4,0).
* **W1** — eine Menge ohne Stundenform wird nicht gleichmäßig verteilt, sondern
  als ``ohne_stundenform_kwh`` genannt (P4).
* **Das Tor des Tages** — jede Stunde trägt es; sonst verschwände der Rest der
  Stunden ohne Modus aus der Zeichnung.

Schwesterdateien: ``test_tages_stapel_gemessen_verdraengt_abgeleitet.py`` (K2 am
Tag), ``test_n434_tagesfenster_betriebsart.py`` / ``test_n435_tages_jaz_ein_fenster.py``
(das Fenster, auf dem die Summe steht).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest

from backend.core.berechnungen.modus_split import (
    ModusSplit,
    ModusStunde,
    falte_modus_split_tag,
)
from backend.core.berechnungen.tages_stapel import (
    StundenFormen,
    beitraege_des_tages,
    falte_tages_stapel,
    verteile_tages_stapel_auf_stunden,
)
from backend.core.betriebsmodus import HEIZEN, KUEHLEN
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.energie_profil._provenance_helpers import seed_tz_provenance
from backend.services.snapshot.boundary_range import TZ_QUELLE_LTS

DATUM = date(2026, 1, 15)
SEGMENTE = ("heizen_kwh", "warmwasser_kwh", "kuehlen_kwh", "lueften_kwh",
            "entfeuchten_kwh", "nicht_aufgeteilt_kwh", "bezug_kwh")


class _Inv:
    def __init__(self, aktiv: bool = True):
        self._aktiv = aktiv

    def ist_aktiv_an(self, _datum) -> bool:
        return self._aktiv


def _summe(stunden, segment: str) -> float:
    return sum(getattr(s, segment) for s in stunden)


# ── Layer: die Summe ─────────────────────────────────────────────────────


class TestSummeDerStundenIstDerTag:
    def _eingaenge(self):
        """Gerät 7: Zweig 1 mit Innengeräten (UND einer Modus-Spur ⇒ K2).
        Gerät 8: Zweig 2. Gerät 9: stillgelegt."""
        gemessen = {"7": {
            "betriebsart_strom_heizen_kwh-1": 2.0,
            "betriebsart_strom_heizen_kwh-2": 1.0,
            "betriebsart_strom_kuehlen_kwh-1": 0.5,
        }, "9": {"betriebsart_strom_heizen_kwh": 3.0}}
        zaehler = {"7": 4.0, "8": 6.0, "9": 3.0}
        stunden8 = [ModusStunde(kwh=-0.5, modus=(HEIZEN if h < 8 else KUEHLEN if h < 16 else None),
                                stunde=h) for h in range(24)]
        stunden7 = [ModusStunde(kwh=-0.2, modus=HEIZEN, stunde=h) for h in range(24)]
        splits = {
            "7": falte_modus_split_tag(stunden7, tages_kwh=4.0),
            "8": falte_modus_split_tag(stunden8, tages_kwh=6.0),
        }
        invs = {"7": _Inv(), "8": _Inv(), "9": _Inv(aktiv=False)}
        formen = StundenFormen(
            felder_je_inv={"7": {
                "betriebsart_strom_heizen_kwh-1": [0.1 if h % 2 else 0.0 for h in range(24)],
                "betriebsart_strom_heizen_kwh-2": [0.05 if h < 20 else None for h in range(24)],
                "betriebsart_strom_kuehlen_kwh-1": [0.5 if h == 14 else 0.0 for h in range(24)],
            }},
            gesamt_je_inv={"7": [0.3] * 24},
            modus_stunden_je_inv={"7": stunden7, "8": stunden8},
        )
        return gemessen, zaehler, splits, invs, formen

    def test_je_segment_summiert_der_tag(self):
        gemessen, zaehler, splits, invs, formen = self._eingaenge()
        tag = falte_tages_stapel(gemessen, zaehler, splits, invs, DATUM)
        v = verteile_tages_stapel_auf_stunden(
            beitraege_des_tages(gemessen, zaehler, splits, invs, DATUM), formen,
        )
        assert len(v.stunden) == 24
        assert v.ohne_stundenform_kwh == 0.0
        for segment in SEGMENTE:
            assert _summe(v.stunden, segment) == pytest.approx(getattr(tag, segment), abs=1e-9), segment

    def test_k2_gilt_auch_in_der_stunde(self):
        """Gerät 7 hat Zähler UND Modus-Spur — seine Stunden kommen nur aus den Zählern."""
        gemessen, zaehler, splits, invs, formen = self._eingaenge()
        v = verteile_tages_stapel_auf_stunden(
            beitraege_des_tages(gemessen, zaehler, splits, invs, DATUM), formen,
        )
        # Kühlen kommt allein aus Gerät 7s Zähler (Stunde 14) und aus Gerät 8
        # (Stunden 8–15). Ohne K2 stünde Gerät 7s Modus-Heizen zusätzlich da.
        assert _summe(v.stunden, "heizen_kwh") == pytest.approx(3.0 + 6.0 * 8 / 24, abs=1e-9)

    def test_tor_des_tages_steht_in_jeder_stunde(self):
        gemessen, zaehler, splits, invs, formen = self._eingaenge()
        v = verteile_tages_stapel_auf_stunden(
            beitraege_des_tages(gemessen, zaehler, splits, invs, DATUM), formen,
        )
        assert all(s.hat_split and s.hat_gemessen for s in v.stunden)


class TestZweig2IstDerFaktor:
    def test_stunde_mal_faktor(self):
        """Anteil × Tagesmenge ist derselbe Faktor wie in `falte_modus_split_tag`."""
        stunden = [ModusStunde(kwh=-(0.2 + 0.1 * (h % 3)), modus=HEIZEN, stunde=h) for h in range(24)]
        roh = sum(abs(s.kwh) for s in stunden)
        split = falte_modus_split_tag(stunden, tages_kwh=12.0)
        v = verteile_tages_stapel_auf_stunden(
            beitraege_des_tages({}, {}, {"8": split}, {"8": _Inv()}, DATUM),
            StundenFormen(modus_stunden_je_inv={"8": stunden}),
        )
        faktor = 12.0 / roh
        for h, s in enumerate(v.stunden):
            assert s.heizen_kwh == pytest.approx(abs(stunden[h].kwh) * faktor, abs=1e-9)


class TestInnengeraeteBrauchenFesteSchluessel:
    def test_geraetefeld_gewinnt_auch_in_stunden_ohne_eigenen_wert(self):
        """G3 (Gegenprüfung): Gerätefeld 4,0, Innengeräte 1,0 + 1,5. Hat das
        Gerätefeld in einer Stunde keinen Zuwachs, darf die Stunde NICHT auf
        die Innengeräte ausweichen — sonst Σ 5,5 statt 4,0."""
        felder = {
            "betriebsart_strom_heizen_kwh": 4.0,
            "betriebsart_strom_heizen_kwh-1": 1.0,
            "betriebsart_strom_heizen_kwh-2": 1.5,
        }
        formen = StundenFormen(felder_je_inv={"7": {
            "betriebsart_strom_heizen_kwh": [1.0 if h < 4 else 0.0 for h in range(24)],
            "betriebsart_strom_heizen_kwh-1": [1.0 / 24] * 24,
            "betriebsart_strom_heizen_kwh-2": [1.5 / 24] * 24,
        }}, gesamt_je_inv={"7": [1.0 if h < 4 else 0.0 for h in range(24)]})
        v = verteile_tages_stapel_auf_stunden(
            beitraege_des_tages({"7": felder}, {"7": 4.0}, {}, {"7": _Inv()}, DATUM), formen,
        )
        assert _summe(v.stunden, "heizen_kwh") == pytest.approx(4.0, abs=1e-9)
        assert v.stunden[10].heizen_kwh == 0.0


class TestOhneFormWirdNichtErfunden:
    def test_menge_ohne_form_wird_genannt(self):
        """W1: Ein Zähler, dessen Form in allen Slots 0 ist — keine Gleichverteilung."""
        felder = {"betriebsart_strom_heizen_kwh": 2.0}
        formen = StundenFormen(
            felder_je_inv={"7": {"betriebsart_strom_heizen_kwh": [0.0] * 24}},
            gesamt_je_inv={"7": [0.0] * 24},
        )
        v = verteile_tages_stapel_auf_stunden(
            beitraege_des_tages({"7": felder}, {"7": 2.0}, {}, {"7": _Inv()}, DATUM), formen,
        )
        assert _summe(v.stunden, "heizen_kwh") == 0.0
        assert v.ohne_stundenform_kwh == pytest.approx(2.0)


# ── Die Route gegen tag-detail derselben Anlage ──────────────────────────


#: ⚠ **Slot 0 (Vortag 23–24 Uhr) ist bewusst größer als Slot 24 (heute 23–24 Uhr).**
#: Mit gleichen Randstunden liefern [00:00, 24:00) und [Vortag 23:00, 23:00)
#: dieselbe Summe, und die Probe kann das Fenster nicht unterscheiden — genau so
#: blieb der Sprengsatz „Route liest im falschen Fenster" beim ersten Lauf still
#: (11.09.2026), obwohl er scharf war. Ein stiller Sprengsatz war hier ein
#: Befund über die Fixture, nicht über den Code.
HEIZEN_JE_SLOT = [2.0] + [0.5 if h % 3 == 0 else 0.2 for h in range(1, 25)]
STANDBY = 0.1


async def _anlage(db):
    """WP 1 (Zweig 1: Betriebsart-Zähler, Gesamtzähler, Wärmemengenzähler) und
    WP 2 (Zweig 2: Modus-Spur). Tageszeile wie im HA-Hauptpfad (LTS)."""
    anlage = Anlage(anlagenname="BS5", leistung_kwp=10.0, installationsdatum=date(2025, 1, 1))
    db.add(anlage)
    await db.flush()
    wp1 = Investition(anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Luft-Wasser",
                      anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=15000.0,
                      parameter={"wp_art": "luft_wasser"})
    wp2 = Investition(anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Split",
                      anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=3000.0,
                      parameter={"wp_art": "luft_luft"})
    db.add_all([wp1, wp2])
    await db.flush()

    t0 = datetime.combine(DATUM, datetime.min.time())
    ba, ges, waerme = 100.0, 200.0, 1000.0
    staende = {"betriebsart_strom_heizen_kwh": {}, "stromverbrauch_kwh": {}, "heizenergie_kwh": {}}
    for k in range(-1, 25):
        if k >= 0:
            ba += HEIZEN_JE_SLOT[k]
            ges += HEIZEN_JE_SLOT[k] + STANDBY
            waerme += 3.0 * HEIZEN_JE_SLOT[k]
        staende["betriebsart_strom_heizen_kwh"][k] = ba
        staende["stromverbrauch_kwh"][k] = ges
        staende["heizenergie_kwh"][k] = waerme
    felder = {}
    for feld, reihe in staende.items():
        felder[feld] = {"strategie": "sensor", "sensor_id": f"sensor.{feld}"}
        for k, wert in reihe.items():
            db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=f"inv:{wp1.id}:{feld}",
                                  zeitpunkt=t0 + timedelta(hours=k), wert_kwh=wert,
                                  quelle="ha_statistics"))
    anlage.sensor_mapping = {"investitionen": {str(wp1.id): {"felder": felder}}}

    bezug1 = staende["stromverbrauch_kwh"][23] - staende["stromverbrauch_kwh"][-1]
    tz = TagesZusammenfassung(anlage_id=anlage.id, datum=DATUM, komponenten_kwh={
        f"waermepumpe_{wp1.id}": round(bezug1, 3), f"waermepumpe_{wp2.id}": 12.0,
    })
    seed_tz_provenance(tz, writer="test", source=TZ_QUELLE_LTS)
    db.add(tz)
    for h in range(24):
        db.add(TagesEnergieProfil(
            anlage_id=anlage.id, datum=DATUM, stunde=h,
            waermepumpe_kw=HEIZEN_JE_SLOT[h] + STANDBY + 0.4,
            komponenten={f"waermepumpe_{wp2.id}": -0.4},
            betriebsmodus_je_wp={str(wp2.id): HEIZEN if h < 12 else KUEHLEN},
        ))
    await db.commit()
    return anlage, wp1, wp2


class TestRouteGegenTagDetail:
    async def test_stunden_summieren_den_balken_der_tagessicht(self, db):
        from backend.api.routes.energie_profil.views import (
            get_tag_detail,
            get_waerme_verlauf_stunden,
        )

        anlage, _wp1, _wp2 = await _anlage(db)
        tag = await get_tag_detail(anlage.id, DATUM, db)
        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)

        assert len(v.stunden) == 24
        assert v.ohne_stundenform_kwh is None
        for feld in ("wp_modus_strom_heizen_kwh", "wp_modus_strom_kuehlen_kwh",
                     "wp_modus_nicht_aufgeteilt_kwh", "wp_modus_strom_bezug_kwh"):
            summe = sum(getattr(s, feld) or 0.0 for s in v.stunden)
            assert summe == pytest.approx(getattr(tag, feld), abs=0.02), feld
        # Die gemessene Wärme: Σ Stunden = Tages-Kachel (S1).
        assert sum(s.wp_waerme_kwh or 0.0 for s in v.stunden) == pytest.approx(
            tag.wp_waerme_kwh, abs=0.02,
        )

    async def test_gemessene_stunde_ist_die_messung(self, db):
        """Im HA-Hauptpfad liegt der Tageswert im Fenster der Slots — die Stunde
        ist dann der Zählerzuwachs selbst, nicht skaliert."""
        from backend.api.routes.energie_profil.views import get_waerme_verlauf_stunden

        anlage, _wp1, _wp2 = await _anlage(db)
        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)

        # Slot 3: WP 1 heizt 0,5 (gemessen), WP 2 heizt 0,4 × 12/9,6 (abgeleitet).
        assert v.stunden[3].wp_modus_strom_heizen_kwh == pytest.approx(0.5 + 0.4 * 12 / 9.6, abs=1e-3)
        assert v.stunden[3].wp_waerme_kwh == pytest.approx(1.5, abs=1e-3)

    async def test_jede_stunde_traegt_das_tor_des_tages(self, db):
        from backend.api.routes.energie_profil.views import get_waerme_verlauf_stunden

        anlage, _wp1, _wp2 = await _anlage(db)
        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)

        assert all(s.wp_modus_gemessen is True for s in v.stunden)
        # Die Zählerspalte: ihre Summe ist die Kachel „Strom verbraucht".
        assert sum(s.wp_strom_kwh for s in v.stunden) == pytest.approx(
            sum(HEIZEN_JE_SLOT[h] + STANDBY + 0.4 for h in range(24)), abs=0.01,
        )

    async def test_ohne_aufteilung_bleibt_der_stapel_leer(self, db):
        """P4: keine Aufteilung ⇒ `None` statt 24 Nullen."""
        from backend.api.routes.energie_profil.views import get_waerme_verlauf_stunden

        anlage = Anlage(anlagenname="leer", leistung_kwp=5.0, installationsdatum=date(2025, 1, 1))
        db.add(anlage)
        await db.commit()
        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)

        assert len(v.stunden) == 24
        assert all(s.wp_modus_strom_heizen_kwh is None for s in v.stunden)
        assert all(s.wp_waerme_kwh is None for s in v.stunden)


# ── Der Funktions-Stapel (WK-09 B2, SOLL §3.3/S2a) ───────────────────────
#
# ⭐ **Eine andere Familie neben dem Betriebsart-Stapel, nie im selben Balken.**
# `strom_heizen_kwh`/`strom_warmwasser_kwh` sind **Summanden** des Gesamtstroms
# (Sprosse F5), `betriebsart_strom_*` sind **Teilmengen** (F4). Sie zu addieren
# ist der Fehler aus SOLL §3.2, an dem schon ein Tester gescheitert ist —
# deshalb schaltet der Verlauf um, statt zu überlagern.
#
# **Gemessen (12.09.2026):** Ein Funktions-Zähler bekommt dieselbe Stundenform
# wie die Wärmelinie — `lade_stundenformen` liest ihn generisch aus derselben
# Standreihe. 12 kWh Heizen in zwei Stunden liegen als 6,0/6,0 in Slot 6 und 18.

#: 12 kWh Heizen in genau ZWEI Slots (6 und 18) à 6,0 — eine Form, die eine
#: Gleichverteilung sofort verrät (0,5 je Slot statt 6,0).
FUNK_HEIZEN_JE_SLOT = [6.0 if k in (6, 18) else 0.0 for k in range(25)]
#: 3 kWh Warmwasser in drei anderen Slots à 1,0.
FUNK_WW_JE_SLOT = [1.0 if k in (7, 12, 20) else 0.0 for k in range(25)]
FUNK_STANDBY = 0.1


async def _anlage_funktionszaehler(db, *, mit_funktionszaehler: bool = True):
    """Eine WP der Sprosse **F5**: getrennte Zähler Heizen/Warmwasser plus
    Gesamtzähler — **kein** Betriebsart-Zähler, **kein** Modus-Signal. Genau die
    Lage, in der der Betriebsart-Stapel nichts zu sagen hat."""
    anlage = Anlage(anlagenname="B2", leistung_kwp=10.0, installationsdatum=date(2025, 1, 1))
    db.add(anlage)
    await db.flush()
    wp = Investition(anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Luft-Wasser",
                     anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=15000.0,
                     parameter={"wp_art": "luft_wasser"})
    db.add(wp)
    await db.flush()

    t0 = datetime.combine(DATUM, datetime.min.time())
    heiz, ww, ges = 100.0, 50.0, 200.0
    reihen: dict[str, dict[int, float]] = {
        "strom_heizen_kwh": {}, "strom_warmwasser_kwh": {}, "stromverbrauch_kwh": {},
    }
    for k in range(-1, 25):
        if k >= 0:
            heiz += FUNK_HEIZEN_JE_SLOT[k]
            ww += FUNK_WW_JE_SLOT[k]
            ges += FUNK_HEIZEN_JE_SLOT[k] + FUNK_WW_JE_SLOT[k] + FUNK_STANDBY
        reihen["strom_heizen_kwh"][k] = heiz
        reihen["strom_warmwasser_kwh"][k] = ww
        reihen["stromverbrauch_kwh"][k] = ges

    felder = {}
    for feld, reihe in reihen.items():
        if not mit_funktionszaehler and feld != "stromverbrauch_kwh":
            continue
        felder[feld] = {"strategie": "sensor", "sensor_id": f"sensor.{feld}"}
        for k, wert in reihe.items():
            db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=f"inv:{wp.id}:{feld}",
                                  zeitpunkt=t0 + timedelta(hours=k), wert_kwh=wert,
                                  quelle="ha_statistics"))
    anlage.sensor_mapping = {"investitionen": {str(wp.id): {"felder": felder}}}

    bezug = reihen["stromverbrauch_kwh"][23] - reihen["stromverbrauch_kwh"][-1]
    tz = TagesZusammenfassung(anlage_id=anlage.id, datum=DATUM, komponenten_kwh={
        f"waermepumpe_{wp.id}": round(bezug, 3),
    })
    seed_tz_provenance(tz, writer="test", source=TZ_QUELLE_LTS)
    db.add(tz)
    for h in range(24):
        db.add(TagesEnergieProfil(
            anlage_id=anlage.id, datum=DATUM, stunde=h,
            waermepumpe_kw=FUNK_HEIZEN_JE_SLOT[h] + FUNK_WW_JE_SLOT[h] + FUNK_STANDBY,
        ))
    await db.commit()
    return anlage, wp


class TestFunktionsStapel:
    async def test_die_stunde_traegt_die_gemessene_form(self, db):
        """Einzelwerte, keine Summe: Slot 6 heizt 6,0 und wärmt kein Wasser,
        Slot 7 umgekehrt. Eine Gleichverteilung stünde bei 0,5 bzw. 0,125."""
        from backend.api.routes.energie_profil.views import get_waerme_verlauf_stunden

        anlage, _wp = await _anlage_funktionszaehler(db)
        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)

        assert v.funktions_stapel_verfuegbar is True
        s6 = v.stunden[6]
        assert s6.wp_funktion_strom_heizen_kwh == pytest.approx(6.0, abs=1e-3)
        assert s6.wp_funktion_strom_warmwasser_kwh == pytest.approx(0.0, abs=1e-3)
        # Der Rest hält die Höhe auf dem Gesamtstrom: 6,1 − 6,0 = 0,1 Standby.
        assert s6.wp_strom_kwh == pytest.approx(6.1, abs=1e-3)
        assert s6.wp_funktion_uebrige_kwh == pytest.approx(0.1, abs=1e-3)

        s7 = v.stunden[7]
        assert s7.wp_funktion_strom_heizen_kwh == pytest.approx(0.0, abs=1e-3)
        assert s7.wp_funktion_strom_warmwasser_kwh == pytest.approx(1.0, abs=1e-3)
        assert s7.wp_funktion_uebrige_kwh == pytest.approx(0.1, abs=1e-3)

        # Eine Stunde ganz ohne Funktion ist reiner Rest, keine Lücke.
        s5 = v.stunden[5]
        assert s5.wp_funktion_strom_heizen_kwh == 0.0
        assert s5.wp_funktion_uebrige_kwh == pytest.approx(0.1, abs=1e-3)

    async def test_summe_der_stunden_ist_der_tageswert(self, db):
        """Σ Stunden = Tageszähler je Funktion (S1) — und Σ aller drei Segmente
        = Σ Gesamtstrom, das ist K1 in dieser Sicht."""
        from backend.api.routes.energie_profil.views import (
            get_tag_detail, get_waerme_verlauf_stunden,
        )

        anlage, _wp = await _anlage_funktionszaehler(db)
        tag = await get_tag_detail(anlage.id, DATUM, db)
        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)

        assert v.funktion_ohne_stundenform_kwh is None
        assert sum(s.wp_funktion_strom_heizen_kwh for s in v.stunden) == pytest.approx(12.0, abs=1e-3)
        assert sum(s.wp_funktion_strom_warmwasser_kwh for s in v.stunden) == pytest.approx(3.0, abs=1e-3)
        # Dieselben Zahlen wie die Tages-Kacheln daneben.
        assert tag.wp_strom_heizen_kwh == pytest.approx(12.0, abs=1e-3)
        assert tag.wp_strom_warmwasser_kwh == pytest.approx(3.0, abs=1e-3)
        # K1: die Stapelhöhe ist der Gesamtstrom, Slot für Slot.
        for s in v.stunden:
            assert (
                s.wp_funktion_strom_heizen_kwh
                + s.wp_funktion_strom_warmwasser_kwh
                + s.wp_funktion_uebrige_kwh
            ) == pytest.approx(s.wp_strom_kwh, abs=1e-3)

    async def test_ohne_funktionszaehler_gibt_es_die_sicht_nicht(self, db):
        """S2a: „nach Funktion" erscheint nur, wo Funktions-Zähler gepflegt sind
        — sonst wären es 24 Nullen unter einer Überschrift (P4)."""
        from backend.api.routes.energie_profil.views import get_waerme_verlauf_stunden

        anlage, _wp = await _anlage_funktionszaehler(db, mit_funktionszaehler=False)
        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)

        assert v.funktions_stapel_verfuegbar is False
        assert all(s.wp_funktion_strom_heizen_kwh is None for s in v.stunden)
        assert all(s.wp_funktion_strom_warmwasser_kwh is None for s in v.stunden)
        assert all(s.wp_funktion_uebrige_kwh is None for s in v.stunden)

    async def test_der_betriebsart_stapel_bleibt_unberuehrt(self, db):
        """Die zweite Sicht ändert die erste nicht — dieselbe Anlage wie
        `TestRouteGegenTagDetail`, dieselben Zahlen."""
        from backend.api.routes.energie_profil.views import get_waerme_verlauf_stunden

        anlage, _wp1, _wp2 = await _anlage(db)
        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)

        assert v.funktions_stapel_verfuegbar is False
        assert v.stunden[3].wp_modus_strom_heizen_kwh == pytest.approx(0.5 + 0.4 * 12 / 9.6, abs=1e-3)
        assert v.stunden[3].wp_waerme_kwh == pytest.approx(1.5, abs=1e-3)

    async def test_menge_ohne_stundenform_wird_genannt(self, db):
        """P4: Was in keinen Slot fällt, wird **benannt** statt verteilt.

        Die Lage ist die im Modul-Kopf von `tages_stapel.py` genannte: Der
        Tageswert steht im **Vorwärts**-Fenster [00:00, 24:00) (Snapshot-Pfad,
        keine LTS-Provenance), die Slots liegen im Rückwärts-Raster
        [Vortag 23:00, heute 23:00). Ein Zuwachs zwischen 23 und 24 Uhr gehört
        damit zum Tag, aber zu keinem Slot — er darf nicht auf die 24 Stunden
        verschmiert werden (ADR-002/P4, E6 (a)).
        """
        from backend.api.routes.energie_profil.views import get_waerme_verlauf_stunden

        anlage = Anlage(anlagenname="B2rand", leistung_kwp=10.0,
                        installationsdatum=date(2025, 1, 1))
        db.add(anlage)
        await db.flush()
        wp = Investition(anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Luft-Wasser",
                         anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=15000.0,
                         parameter={"wp_art": "luft_wasser"})
        db.add(wp)
        await db.flush()

        t0 = datetime.combine(DATUM, datetime.min.time())
        # Der ganze Warmwasser-Zuwachs (2,0 kWh) liegt in [23:00, 24:00).
        ww, ges = 50.0, 200.0
        felder = {}
        for feld in ("strom_warmwasser_kwh", "stromverbrauch_kwh"):
            felder[feld] = {"strategie": "sensor", "sensor_id": f"sensor.{feld}"}
        for k in range(-1, 25):
            if k == 24:
                ww += 2.0
                ges += 2.0
            db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=f"inv:{wp.id}:strom_warmwasser_kwh",
                                  zeitpunkt=t0 + timedelta(hours=k), wert_kwh=ww,
                                  quelle="ha_statistics"))
            db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=f"inv:{wp.id}:stromverbrauch_kwh",
                                  zeitpunkt=t0 + timedelta(hours=k), wert_kwh=ges,
                                  quelle="ha_statistics"))
        anlage.sensor_mapping = {"investitionen": {str(wp.id): {"felder": felder}}}
        # ⚠ KEINE LTS-Provenance ⇒ Vorwärtsfenster für den Tageswert.
        db.add(TagesZusammenfassung(anlage_id=anlage.id, datum=DATUM,
                                    komponenten_kwh={f"waermepumpe_{wp.id}": 2.0}))
        for h in range(24):
            db.add(TagesEnergieProfil(anlage_id=anlage.id, datum=DATUM, stunde=h,
                                      waermepumpe_kw=0.0))
        await db.commit()

        v = await get_waerme_verlauf_stunden(anlage.id, DATUM, db)
        assert v.funktions_stapel_verfuegbar is True
        # Keine Stunde bekommt etwas — und die 2,0 kWh stehen als genannte Menge da.
        assert all(s.wp_funktion_strom_warmwasser_kwh == 0.0 for s in v.stunden)
        assert v.funktion_ohne_stundenform_kwh == pytest.approx(2.0, abs=0.02)
