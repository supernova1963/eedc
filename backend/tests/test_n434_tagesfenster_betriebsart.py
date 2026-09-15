"""N-434 — die Tagesaufteilung liest Bezug und Teilmengen im SELBEN Fenster.

**Der Fund** (11.09.2026, bei der Gegenprüfung des Bauplans für Wärme/Klima
Bauschnitt 5): Im HA-Add-on schreibt der Energieprofil-Aggregator
``TagesZusammenfassung.komponenten_kwh`` aus ``get_komponenten_tageskwh_lts`` —
als Σ der 24 Rückwärts-Slots, also [Vortag 23:00, Heute 23:00). Die gemessenen
Betriebsart-Zähler (Zweig 1 der Tagesaufteilung) wurden dagegen über das
HA-Tagesfenster [00:00, 24:00) gelesen. ``falte_tages_stapel`` stellte beide
gegeneinander, und die Differenz zweier Randstunden erschien als Messung:

* Randstunde gestern 2,0 / heute 0,2 kWh ⇒ **1,8 von 7,0 kWh „nicht
  aufgeteilt"** bei einem Gerät, das ausschließlich heizt;
* umgekehrt 0,2 / 2,0 ⇒ die Teilmenge wirkt größer als ihr Bezug, die
  Invariante verwirft das Gerät, **die Aufteilung verschwindet**.

⭐ **Die Fixture stellt die Herkunft über den Produktivweg her**
(``seed_tz_provenance``, wie der Aggregator) — nicht als handgeschriebenes
Dict. Eine Probe, die sich einen Zustand baut, den die Produktion nicht
schreibt, schützt am Ende die Falschaussage.

Schwesterdateien: ``test_263_t3_gemessene_betriebsart_tag.py`` (der gemessene
Zweig am Tag, ohne Herkunft ⇒ bisheriges Fenster, bleibt unverändert grün),
``test_tages_stapel_gemessen_verdraengt_abgeleitet.py`` (K2),
``test_waerme_verlauf_bereichs_leser.py`` (der Monats-Verlauf).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest

from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.energie_profil._provenance_helpers import seed_tz_provenance
from backend.services.snapshot.boundary_range import (
    TZ_QUELLE_LTS,
    tageszeile_ist_rueckwaerts,
)

DATUM = date(2026, 1, 15)
TAG_KWH = 5.0


async def _anlage(db, *, rand_gestern: float, rand_heute: float, lts: bool):
    """Wärmepumpe, deren ganzer Strom Heizen ist — Standby 0.

    Zählerstände des Betriebsart-Zählers (= Gesamtstrom): Vortag 23:00,
    00:00, 23:00, Folgetag 00:00. Die Tageszeile trägt den Bezug so, wie ihn
    der jeweilige Pfad schreibt: LTS ⇒ Σ Rückwärts-Slots (s23 − s_m1),
    Snapshot-Pfad ⇒ Boundary-Diff [0, 24) (s24 − s0).
    """
    anlage = Anlage(anlagenname="N434", leistung_kwp=10.0,
                    installationsdatum=date(2025, 1, 1))
    db.add(anlage)
    await db.flush()
    inv = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Luft-Wasser",
        anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=15000.0,
        parameter={"wp_art": "luft_wasser"},
    )
    db.add(inv)
    await db.flush()

    s_m1 = 100.0
    s_0 = s_m1 + rand_gestern
    s_23 = s_0 + TAG_KWH
    s_24 = s_23 + rand_heute
    t0 = datetime.combine(DATUM, datetime.min.time())
    feld = "betriebsart_strom_heizen_kwh"
    key = f"inv:{inv.id}:{feld}"
    for ts, wert in (
        (t0 - timedelta(hours=1), s_m1),
        (t0, s_0),
        (t0 + timedelta(hours=23), s_23),
        (t0 + timedelta(hours=24), s_24),
    ):
        db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=key, zeitpunkt=ts,
                              wert_kwh=wert, quelle="ha_statistics"))
    anlage.sensor_mapping = {"investitionen": {str(inv.id): {"felder": {
        feld: {"strategie": "sensor", "sensor_id": "sensor.wp_heizen"},
    }}}}

    bezug = (s_23 - s_m1) if lts else (s_24 - s_0)
    tz = TagesZusammenfassung(
        anlage_id=anlage.id, datum=DATUM,
        komponenten_kwh={f"waermepumpe_{inv.id}": round(bezug, 3)},
    )
    seed_tz_provenance(
        tz, writer="test",
        source=TZ_QUELLE_LTS if lts else "auto:monatsabschluss",
    )
    db.add(tz)
    await db.commit()
    return anlage, inv, bezug


# ── Die Regel: welche Tageszeile welches Fenster trägt ─────────────────────


class TestFensterDerTageszeile:
    def test_lts_zeile_ist_rueckwaerts(self):
        z = TagesZusammenfassung(anlage_id=1, datum=DATUM,
                                 komponenten_kwh={"waermepumpe_7": 3.0})
        seed_tz_provenance(z, writer="test", source=TZ_QUELLE_LTS)
        assert tageszeile_ist_rueckwaerts(z.source_provenance) is True

    def test_snapshot_zeile_bleibt_im_tagesfenster(self):
        z = TagesZusammenfassung(anlage_id=1, datum=DATUM,
                                 komponenten_kwh={"waermepumpe_7": 3.0})
        seed_tz_provenance(z, writer="test", source="auto:monatsabschluss")
        assert tageszeile_ist_rueckwaerts(z.source_provenance) is False

    def test_ohne_herkunft_wird_nichts_umgedeutet(self):
        """Altbestand und Fixtures ohne Provenance behalten das bisherige Fenster."""
        assert tageszeile_ist_rueckwaerts(None) is False
        assert tageszeile_ist_rueckwaerts({}) is False

    def test_nur_waermepumpen_schluessel_zaehlen(self):
        """Ein LTS-Vermerk an einem anderen Gerät sagt über die WP nichts."""
        prov = {"komponenten_kwh.pv_3": {"source": TZ_QUELLE_LTS}}
        assert tageszeile_ist_rueckwaerts(prov) is False


# ── Die Tagesroute ─────────────────────────────────────────────────────────


class TestTagesaufteilungImSelbenFenster:
    @pytest.mark.parametrize("rand_gestern,rand_heute", [(2.0, 0.2), (0.2, 2.0)])
    async def test_lts_tag_hat_keinen_scheinbaren_rest(self, db, rand_gestern, rand_heute):
        """**Der gemessene Fall.** Das Gerät heizt ausschließlich — der Rest ist 0,
        die Aufteilung ist da, und Heizen ist der ganze Bezug.

        Vor N-434: (2,0 / 0,2) ⇒ Rest 1,8; (0,2 / 2,0) ⇒ keine Aufteilung.
        """
        from backend.api.routes.energie_profil.views import get_tag_detail

        anlage, _inv, bezug = await _anlage(
            db, rand_gestern=rand_gestern, rand_heute=rand_heute, lts=True,
        )
        r = await get_tag_detail(anlage.id, DATUM, db)

        assert r.wp_modus_gemessen is True
        assert r.wp_modus_strom_bezug_kwh == pytest.approx(bezug, abs=0.01)
        assert r.wp_modus_strom_heizen_kwh == pytest.approx(bezug, abs=0.01)
        assert r.wp_modus_nicht_aufgeteilt_kwh == pytest.approx(0.0, abs=0.01)

    async def test_snapshot_tag_bleibt_unveraendert(self, db):
        """Gegenrichtung: Schreibt der Snapshot-Pfad [0, 24), liest der Leser
        [0, 24) — die bisherige Rechnung, und sie stimmt dort."""
        from backend.api.routes.energie_profil.views import get_tag_detail

        anlage, _inv, bezug = await _anlage(
            db, rand_gestern=2.0, rand_heute=0.2, lts=False,
        )
        r = await get_tag_detail(anlage.id, DATUM, db)

        assert r.wp_modus_strom_bezug_kwh == pytest.approx(bezug, abs=0.01)
        assert r.wp_modus_strom_heizen_kwh == pytest.approx(bezug, abs=0.01)
        assert r.wp_modus_nicht_aufgeteilt_kwh == pytest.approx(0.0, abs=0.01)


# ── Der Monats-Verlauf (Bauschnitt 4) — derselbe Faltweg je Tag ────────────


class TestMonatsVerlaufImSelbenFenster:
    async def test_lts_tag_im_verlauf_hat_keinen_scheinbaren_rest(self, db):
        from sqlalchemy import select

        from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

        anlage, _inv, bezug = await _anlage(
            db, rand_gestern=2.0, rand_heute=0.2, lts=True,
        )
        invs = {
            str(i.id): i
            for i in (await db.execute(
                select(Investition).where(Investition.anlage_id == anlage.id)
            )).scalars().all()
        }
        zeilen = await lade_waerme_verlauf(db, anlage, invs, DATUM, DATUM)

        assert len(zeilen) == 1
        stapel = zeilen[0].stapel
        assert stapel.hat_gemessen is True
        assert stapel.heizen_kwh == pytest.approx(bezug, abs=0.01)
        assert stapel.nicht_aufgeteilt_kwh == pytest.approx(0.0, abs=0.01)
