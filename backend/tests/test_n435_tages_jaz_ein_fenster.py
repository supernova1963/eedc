"""N-435 — die Tages-Arbeitszahl teilt Wärme und Strom aus DEMSELBEN Fenster.

**Der Fund** (11.09.2026, Klassen-Dreifrage zu N-434): In ``get_tag_detail``
kam die Wärme der Gesamt-Arbeitszahl aus ``get_tagesdetail_kwh`` — Boundary-Diff
[00:00, 24:00) —, der Strom aus ``TagesZusammenfassung.komponenten_kwh``, im
HA-Add-on Σ der LTS-Slots [Vortag 23:00, 23:00). An einer Wärmepumpe, die in
**jeder** Stunde mit 3,0 arbeitet, stand deshalb:

* Randstunden 2,0 / 0,2 kWh Strom ⇒ **2,23** (15,6 kWh Wärme ÷ 7,0 kWh Strom),
* Randstunden 0,2 / 2,0 kWh ⇒ **4,04** (21,0 ÷ 5,2),
* gleiche Randstunden ⇒ 3,0.

⭐ **Die Fixture setzt die Herkunft über den Produktivweg** (``seed_tz_provenance``).

⚠ **Und die Monatssäule muss mitziehen:** Liest die Tagessicht die Wärme im
Fenster ihrer Tageszeile, der Monats-Verlauf aber weiter [00:00, 24:00), nennen
Tag und Monatssäule für denselben Tag verschiedene Wärme (S1).

Schwesterdateien: ``test_n434_tagesfenster_betriebsart.py`` (derselbe Fehler an
der Strom-Aufteilung), ``test_waerme_verlauf_bereichs_leser.py`` (der
Bereichs-Leser im bisherigen Fenster, bleibt unverändert grün).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import select

from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.energie_profil._provenance_helpers import seed_tz_provenance
from backend.services.snapshot.aggregator import (
    TAGESDETAIL_AUSGABE,
    get_tagesdetail_kwh,
)
from backend.services.snapshot.boundary_range import TZ_QUELLE_LTS
from backend.services.snapshot.bereichs_leser import lade_tageswerte_je_feld

DATUM = date(2026, 1, 15)
TAG_KWH = 5.0
COP = 3.0

WAERME_FELDER = {
    k: v for k, v in TAGESDETAIL_AUSGABE.items()
    if v in ("wp_heizung_kwh", "wp_warmwasser_kwh")
}


async def _anlage(db, *, rand_gestern: float, rand_heute: float, lts: bool):
    """Wärmepumpe mit Strom- und Wärmemengenzähler, Arbeitszahl 3,0 in jeder Stunde.

    Stände an Vortag 23:00, 00:00, 23:00, Folgetag 00:00. Die Tageszeile trägt
    den Strom so, wie ihn der jeweilige Pfad schreibt.
    """
    anlage = Anlage(anlagenname="N435", leistung_kwp=10.0,
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

    strom = [100.0, 100.0 + rand_gestern]
    strom += [strom[1] + TAG_KWH, strom[1] + TAG_KWH + rand_heute]
    waerme = [1000.0 + COP * (s - 100.0) for s in strom]
    t0 = datetime.combine(DATUM, datetime.min.time())
    zeiten = [t0 - timedelta(hours=1), t0, t0 + timedelta(hours=23),
              t0 + timedelta(hours=24)]
    felder = {}
    for feld, staende in (("stromverbrauch_kwh", strom), ("heizenergie_kwh", waerme)):
        felder[feld] = {"strategie": "sensor", "sensor_id": f"sensor.{feld}"}
        key = f"inv:{inv.id}:{feld}"
        for ts, wert in zip(zeiten, staende):
            db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=key, zeitpunkt=ts,
                                  wert_kwh=wert, quelle="ha_statistics"))
    anlage.sensor_mapping = {"investitionen": {str(inv.id): {"felder": felder}}}

    bezug = (strom[2] - strom[0]) if lts else (strom[3] - strom[1])
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
    return anlage, bezug


async def _investitionen(db, anlage):
    return {
        str(i.id): i
        for i in (await db.execute(
            select(Investition).where(Investition.anlage_id == anlage.id)
        )).scalars().all()
    }


class TestTagesArbeitszahlImSelbenFenster:
    @pytest.mark.parametrize("rand_gestern,rand_heute", [(2.0, 0.2), (0.2, 2.0)])
    async def test_lts_tag_zeigt_die_echte_arbeitszahl(self, db, rand_gestern, rand_heute):
        """**Der gemessene Fall.** Vor N-435: 2,23 bzw. 4,04."""
        from backend.api.routes.energie_profil.views import get_tag_detail

        anlage, bezug = await _anlage(
            db, rand_gestern=rand_gestern, rand_heute=rand_heute, lts=True,
        )
        r = await get_tag_detail(anlage.id, DATUM, db)

        assert r.wp_jaz == pytest.approx(COP, abs=0.01)
        assert r.wp_jaz_nenner_kwh == pytest.approx(bezug, abs=0.01)
        assert r.wp_waerme_kwh == pytest.approx(COP * bezug, abs=0.01)

    async def test_snapshot_tag_bleibt_im_tagesfenster(self, db):
        """Gegenrichtung: ohne LTS-Herkunft bleibt [00:00, 24:00) — und stimmt dort."""
        from backend.api.routes.energie_profil.views import get_tag_detail

        anlage, bezug = await _anlage(db, rand_gestern=2.0, rand_heute=0.2, lts=False)
        r = await get_tag_detail(anlage.id, DATUM, db)

        assert r.wp_jaz == pytest.approx(COP, abs=0.01)
        assert r.wp_waerme_kwh == pytest.approx(COP * bezug, abs=0.01)


class TestMonatssaeuleNenntDieWaermeDesTages:
    async def test_verlauf_und_tag_nennen_dieselbe_waerme(self, db):
        """S1: dieselbe Größe, derselbe Tag, derselbe Wert — in beiden Sichten."""
        from backend.api.routes.energie_profil.views import get_tag_detail
        from backend.services.energie_profil.waerme_verlauf import lade_waerme_verlauf

        anlage, _bezug = await _anlage(db, rand_gestern=2.0, rand_heute=0.2, lts=True)
        tag = await get_tag_detail(anlage.id, DATUM, db)
        zeilen = await lade_waerme_verlauf(
            db, anlage, await _investitionen(db, anlage), DATUM, DATUM,
        )

        assert len(zeilen) == 1
        assert zeilen[0].waerme_kwh == pytest.approx(tag.wp_waerme_kwh, abs=0.01)

    async def test_bereichs_leser_gleicht_dem_tages_einstieg_im_rueckwaertsfenster(self, db):
        """Die bestehende Gleichheit (``test_waerme_verlauf_bereichs_leser.py``)
        gilt auch im zweiten Fenster — sonst läge die Regel wieder an zwei Orten."""
        anlage, _bezug = await _anlage(db, rand_gestern=2.0, rand_heute=0.2, lts=True)
        invs = await _investitionen(db, anlage)

        bereich = await lade_tageswerte_je_feld(
            db, anlage, invs, DATUM, DATUM, WAERME_FELDER,
            rueckwaerts_tage={DATUM},
        )
        einzeln = await get_tagesdetail_kwh(db, anlage, invs, DATUM, tageszeile_rueckwaerts=True)

        assert bereich[DATUM]["wp_heizung_kwh"] == pytest.approx(
            einzeln.werte["wp_heizung_kwh"], abs=1e-9,
        )
