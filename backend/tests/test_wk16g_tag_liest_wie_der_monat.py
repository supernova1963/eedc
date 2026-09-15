"""WK-16g — **der Tag liest wie der Monat** (R-1 … R-5).

Fünf Regeln, ein Anlass: Gernots Screenshot der Prüfstand-Anlage im HAOS-Lab
vom 15.09.2026, *Cockpit → Tag 14.09.* Zu sehen waren **eine** Zahl („Strom
verbraucht 2 kWh") und daneben zwei Sätze, die beide nicht stimmten —
*„Arbeitszahl · kein Stromverbrauch erfasst"* und *„Wärme erzeugt · für diesen
Tag keine Zählerstände"*, obwohl seit 11:30 Uhr Stände mitgeschrieben wurden.

| Regel | Fund | Was sie sagt |
| --- | --- | --- |
| **R-1** | N-486 | Betriebsart-Zähler sind feine Zähler: kein Gesamtzähler, keine F5-Achse, aber gemessene Betriebsart-Ströme ⇒ **sie** sind die Menge (K3 Regel 4) |
| **R-2** | N-487 | Die Tages-Heizwärme kennt die Betriebsart-Nutzenergie (D1-Stufe 3) |
| **R-3** | N-488 | Der Daten-Checker liest dieselbe Weiche wie die Anzeige |
| **R-4** | N-491 · N-482 | Fehlt ein Tagesrand, gilt der erste bzw. letzte Stand **im** Tag — mit Marke; ein stummer Gesamtzähler lässt die Achsen tragen |
| **R-5** | N-492 | Trägt die Kachel eine Zahl, heißt der Grund nicht „kein Stromverbrauch erfasst" |

⛔ **Was diese Datei NICHT misst.** Die Wärme-**Linie** des Stundenverlaufs
zeichnet weiterhin nur ``wp_heizung_kwh``/``wp_warmwasser_kwh``; ein Gerät, das
seine Heizwärme ausschließlich je Betriebsart misst, hat seine Menge in der
Kachel und keine Linie. Das ist eine benannte Grenze (Bericht §7/A-4), keine
Regression — und es ist der Grund, warum hier keine Linien-Probe steht.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    GRUND_KEIN_STROM,
    heizwaerme_je_geraet,
)
from backend.core.field_definitions import get_wp_strom_kwh, wp_strom_aufteilung
from backend.core.tageswert_grund import TAGESWERT_GRUND_KURZ, GRUND_KEINE_ZAEHLERSTAENDE
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.investition import InvestitionMonatsdaten
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.snapshot.aggregator import (
    get_komponenten_tageskwh,
    get_tagesdetail_kwh,
)
from backend.services.snapshot.komponenten_beitraege import investition_beitraege

DATUM = date(2025, 7, 15)
T0 = datetime.combine(DATUM, datetime.min.time())

BA_HEIZEN = "betriebsart_strom_heizen_kwh"
BA_KUEHLEN = "betriebsart_strom_kuehlen_kwh"
NE_HEIZEN = "betriebsart_nutzenergie_heizen_kwh"
LL = {"wp_art": "luft_luft"}
F5 = {"wp_art": "luft_wasser", "getrennte_strommessung": True}


# ── Aufbau ──────────────────────────────────────────────────────────────────

async def _anlage(db):
    a = Anlage(anlagenname="WK16g", leistung_kwp=10.0,
               installationsdatum=date(2025, 1, 1))
    db.add(a)
    await db.flush()
    a.sensor_mapping = {"investitionen": {}}
    return a


async def _geraet(db, anlage, params=LL, name="Klima"):
    inv = Investition(anlage_id=anlage.id, typ="waermepumpe", bezeichnung=name,
                      anschaffungsdatum=date(2025, 1, 1),
                      anschaffungskosten_gesamt=1000.0, parameter=params)
    db.add(inv)
    await db.flush()
    return inv


def _map(anlage, inv, feld):
    anlage.sensor_mapping["investitionen"].setdefault(
        str(inv.id), {"felder": {}},
    )["felder"][feld] = {"strategie": "sensor", "sensor_id": f"sensor.{inv.id}_{feld}"}


def _stand(db, anlage, inv, feld, ts, wert):
    db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=f"inv:{inv.id}:{feld}",
                          zeitpunkt=ts, wert_kwh=wert, quelle="ha_statistics"))


def _zaehler(db, anlage, inv, feld, kwh, *, ab_stunde=0, bis_stunde=24):
    """Zähler zuordnen und zwei Stände setzen — voreingestellt an den Tagesrändern.

    ``ab_stunde``/``bis_stunde`` verschieben die Ränder **innerhalb** des Tages;
    damit entstehen die beiden Lagen aus N-491 (erster Tag ab 11 Uhr, laufender
    Tag bis 5 Uhr) ohne einen zweiten Aufbau.
    """
    _map(anlage, inv, feld)
    if kwh is None:
        return
    _stand(db, anlage, inv, feld, T0 + timedelta(hours=ab_stunde), 1000.0)
    _stand(db, anlage, inv, feld, T0 + timedelta(hours=bis_stunde), 1000.0 + kwh)


def _tageszeile(db, anlage, bezug_je_inv: dict):
    db.add(TagesZusammenfassung(
        anlage_id=anlage.id, datum=DATUM,
        komponenten_kwh={f"waermepumpe_{i}": v for i, v in bezug_je_inv.items()},
    ))


async def _tag(db, anlage):
    from backend.api.routes.energie_profil.views import get_tag_detail

    anlage.sensor_mapping = dict(anlage.sensor_mapping)
    await db.commit()
    return await get_tag_detail(anlage.id, DATUM, db)


def _inv_double(typ, params, inv_id=7):
    class _Inv:
        id = inv_id
        parent_investition_id = None

        def __init__(self):
            self.typ = typ
            self.parameter = params
    return _Inv()


def _mapping(*felder):
    return {"felder": {f: {"strategie": "sensor", "sensor_id": "sensor.x"}
                       for f in felder}}


# ── R-1 · Betriebsart-Zähler sind feine Zähler (N-486) ──────────────────────

class TestR1Menge:
    """K3 Regel 4 am **Wert** (Monatszeile) und an der **Zuordnung** (Tag)."""

    def test_ein_betriebsart_zaehler_ohne_gesamtzaehler_traegt_die_menge(self):
        """`get_wp_strom_kwh({'betriebsart_strom_heizen_kwh': 700}, luft_luft)`
        lieferte bis zum 15.09.2026 **0,0** — der gemessene Zähler trug nichts."""
        daten = {BA_HEIZEN: 700.0}
        assert get_wp_strom_kwh(daten, LL) == pytest.approx(700.0)
        auf = wp_strom_aufteilung(daten, LL)
        assert auf.stufe == "betriebsart"
        # Modus-Rest 0: die Menge IST die Σ der Teilmengen.
        assert auf.nicht_aufgeteilt_kwh == 0.0
        assert auf.feine_summe_kwh == 0.0

    def test_alle_vier_betriebsarten_zaehlen(self):
        daten = {BA_HEIZEN: 700.0, BA_KUEHLEN: 300.0,
                 "betriebsart_strom_lueften_kwh": 20.0,
                 "betriebsart_strom_entfeuchten_kwh": 5.0}
        assert get_wp_strom_kwh(daten, LL) == pytest.approx(1025.0)

    def test_je_innengeraet_aufgeloest_und_nie_addiert(self):
        """K2: Gerätefeld schlägt Σ Innengeräte — auch in der neuen Stufe."""
        nur_innen = {f"{BA_HEIZEN}-3": 400.0, f"{BA_HEIZEN}-4": 300.0}
        assert get_wp_strom_kwh(nur_innen, LL) == pytest.approx(700.0)
        mit_geraet = {BA_HEIZEN: 700.0, f"{BA_HEIZEN}-3": 400.0}
        assert get_wp_strom_kwh(mit_geraet, LL) == pytest.approx(700.0)

    def test_ein_gesamtzaehler_bleibt_die_menge(self):
        """**K1, unverändert (WK-16d):** Regel 4 kommt erst, wenn es weder
        Gesamtzähler noch feine Achse gibt. Die Gegenprobe zu R-1."""
        daten = {BA_HEIZEN: 700.0, "stromverbrauch_kwh": 1000.0}
        assert get_wp_strom_kwh(daten, LL) == pytest.approx(1000.0)
        assert wp_strom_aufteilung(daten, LL).stufe == "gesamt"

    def test_eine_feine_achse_bleibt_die_menge(self):
        """Und die zweite Gegenprobe: eine Summanden-Achse schlägt die Teilmenge."""
        daten = {"strom_heizen_kwh": 750.0, "strom_warmwasser_kwh": 200.0,
                 BA_KUEHLEN: 100.0}
        auf = wp_strom_aufteilung(daten, F5)
        assert auf.stufe == "fein"
        assert auf.menge_kwh == pytest.approx(1050.0)   # W-16: Kühlstrom daneben

    def test_ein_legacy_gesamtfeld_schlaegt_die_betriebsart(self):
        """`strom_kwh`/`verbrauch_kwh` sind Gesamtmengen unter altem Namen."""
        assert get_wp_strom_kwh({"strom_kwh": 900.0, BA_HEIZEN: 700.0}, LL) == 900.0

    def test_der_abgeleitete_split_traegt_keine_menge(self):
        """`modus_strom_*` ist eine **Verteilung** — sie darf nichts tragen."""
        assert get_wp_strom_kwh({"modus_strom_heizen_kwh": 500.0}, LL) == 0.0

    @pytest.mark.parametrize("params", [LL, F5], ids=["ohne_kennzeichen", "F5"])
    def test_die_stufe_gilt_in_beiden_zweigen(self, params):
        """K3 hat keine Richtung: das Kennzeichen entscheidet nicht, ob ein
        Zähler zählt (Konzept Kap. 3)."""
        assert get_wp_strom_kwh({BA_HEIZEN: 700.0}, params) == pytest.approx(700.0)


class TestR1Zuordnung:
    """Dieselbe Regel eine Ebene tiefer — die Beitragsschicht des Tages."""

    def test_der_betriebsart_zaehler_liefert_einen_tagesbeitrag(self):
        b = investition_beitraege(_inv_double("waermepumpe", LL),
                                  _mapping(BA_HEIZEN, BA_KUEHLEN))
        assert [x.feld for x in b] == [BA_HEIZEN, BA_KUEHLEN]

    def test_innengeraete_ohne_geraetefeld(self):
        b = investition_beitraege(_inv_double("waermepumpe", LL),
                                  _mapping(f"{BA_HEIZEN}-3", f"{BA_HEIZEN}-4"))
        assert [x.feld for x in b] == [f"{BA_HEIZEN}-3", f"{BA_HEIZEN}-4"]

    def test_geraetefeld_verdraengt_die_innengeraete(self):
        b = investition_beitraege(_inv_double("waermepumpe", LL),
                                  _mapping(BA_HEIZEN, f"{BA_HEIZEN}-3"))
        assert [x.feld for x in b] == [BA_HEIZEN]

    def test_mit_gesamtzaehler_bleibt_es_beim_gesamtzaehler(self):
        b = investition_beitraege(_inv_double("waermepumpe", LL),
                                  _mapping(BA_HEIZEN, "stromverbrauch_kwh"))
        assert [x.feld for x in b] == ["stromverbrauch_kwh"]

    def test_w16_am_tag_der_kuehlzaehler_steht_neben_den_achsen(self):
        """**Die Additionsseite des Tages folgt der des Monats.** Bis zum
        15.09.2026 ließ der Tag den gemessenen Kühlstrom weg und lieferte eine
        kleinere Menge als der Monat für denselben Bestand."""
        b = investition_beitraege(_inv_double("waermepumpe", F5),
                                  _mapping("strom_heizen_kwh", BA_KUEHLEN))
        assert [x.feld for x in b] == ["strom_heizen_kwh", BA_KUEHLEN]

    def test_der_betriebsart_heizstrom_wird_nie_neben_die_achse_gelegt(self):
        """W-16b-Gegenprobe: `betriebsart_strom_heizen_kwh` steckt **in**
        `strom_heizen_kwh` — beide zu nehmen wäre Doppelzählung."""
        b = investition_beitraege(_inv_double("waermepumpe", F5),
                                  _mapping("strom_heizen_kwh", BA_HEIZEN))
        assert [x.feld for x in b] == ["strom_heizen_kwh"]


class TestR1AmTag:
    async def test_die_klimaanlage_bekommt_einen_tageswert(self, db):
        """Ende zu Ende: nur Betriebsart-Zähler ⇒ Tagesbilanz, Kachel, Nenner."""
        a = await _anlage(db)
        inv = await _geraet(db, a)
        _zaehler(db, a, inv, BA_HEIZEN, 7.0)
        _zaehler(db, a, inv, BA_KUEHLEN, 3.0)
        await db.commit()

        kt = await get_komponenten_tageskwh(db, a, {str(inv.id): inv}, DATUM)

        assert kt[f"waermepumpe_{inv.id}"] == pytest.approx(10.0)


# ── R-4 · Der Tag liest wie der Monat (N-491 · N-482) ───────────────────────

class TestR4Tagesrand:
    async def _erster_tag(self, db, *, ab=11, bis=24):
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _map(a, inv, "strom_heizen_kwh")
        _map(a, inv, "heizenergie_kwh")
        _stand(db, a, inv, "strom_heizen_kwh", T0 + timedelta(hours=ab), 100.0)
        _stand(db, a, inv, "strom_heizen_kwh", T0 + timedelta(hours=bis), 103.0)
        _stand(db, a, inv, "heizenergie_kwh", T0 + timedelta(hours=ab), 500.0)
        _stand(db, a, inv, "heizenergie_kwh", T0 + timedelta(hours=bis), 512.0)
        await db.commit()
        return a, inv

    async def test_erster_tag_ab_elf_uhr_traegt_die_differenz(self, db):
        """**N-491 in Reinform.** Der Stand um 0 Uhr fehlt; gemessen wird ab dem
        ersten Stand — 103 − 100 = 3,0 kWh, und die Zahl sagt, ab wann."""
        a, inv = await self._erster_tag(db)

        d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM)

        assert d.werte["wp_strom_heizen_kwh"] == pytest.approx(3.0)
        assert d.werte["wp_heizung_kwh"] == pytest.approx(12.0)
        assert "wp_strom_heizen_kwh" not in d.grund_je_feld
        assert d.abdeckung_von == T0 + timedelta(hours=11)
        assert d.abdeckung_bis is None

    async def test_der_laufende_tag_misst_bis_zum_letzten_stand(self, db):
        """R-4b: kein rechter Rand — der letzte Stand des Tages trägt."""
        a, inv = await self._erster_tag(db, ab=0, bis=5)

        d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM)

        assert d.werte["wp_strom_heizen_kwh"] == pytest.approx(3.0)
        assert d.abdeckung_von is None
        assert d.abdeckung_bis == T0 + timedelta(hours=5)

    async def test_ein_tag_ohne_jeden_stand_behaelt_seinen_grund(self, db):
        """**R-4d, die Gegenprobe.** Der W-18-Grund bleibt — und er muss."""
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _map(a, inv, "strom_heizen_kwh")
        await db.commit()

        d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM)

        assert "wp_strom_heizen_kwh" not in d.werte
        assert d.grund_je_feld["wp_strom_heizen_kwh"] == GRUND_KEINE_ZAEHLERSTAENDE
        assert d.abdeckung_von is None and d.abdeckung_bis is None

    async def test_der_volle_tag_traegt_keine_marke(self, db):
        """Bitgleich zu vorher: stehen beide Ränder, gibt es nichts zu sagen."""
        a, inv = await self._erster_tag(db, ab=0, bis=24)

        d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM)

        assert d.werte["wp_strom_heizen_kwh"] == pytest.approx(3.0)
        assert d.abdeckung_von is None and d.abdeckung_bis is None

    async def test_ein_ruecksprung_bekommt_keinen_rueckfall(self, db):
        """**N-341 bleibt scharf.** Beide Ränder stehen, der Zähler springt
        dazwischen zurück ⇒ keine Aussage. Ein Rückfall dürfte daraus keine
        kleinere, ebenso falsche Zahl machen.

        ⚠ **Was diese Probe NICHT misst** (Sprengsatz S9, 15.09.2026): Nimmt man
        die Bedingung ``if s0 is None`` heraus, bleibt sie **grün** — in ihrer
        Lage findet ``erster_stand_im_fenster`` denselben Punkt wie
        ``get_snapshot(ts_start)``, das Fenster ändert sich nicht. Die Lage, in
        der die Zeile wirklich trägt, baut die Probe darunter. Dieselbe Lehre
        wie N-472/S3b, eine Zeitebene tiefer."""
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _map(a, inv, "strom_heizen_kwh")
        for stunde, wert in ((0, 100.0), (10, 140.0), (11, 5.0), (24, 45.0)):
            _stand(db, a, inv, "strom_heizen_kwh", T0 + timedelta(hours=stunde), wert)
        await db.commit()

        d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM)

        assert "wp_strom_heizen_kwh" not in d.werte
        assert d.grund_je_feld["wp_strom_heizen_kwh"] == "zaehler_ruecksprung"

    async def test_ein_rand_knapp_vor_dem_tag_schliesst_den_rueckfall_aus(self, db):
        """**Die geschärfte Fassung (Sprengsatz S9).**

        Der letzte Stand des Vortages liegt um **23:57** — innerhalb der
        ±5-Minuten-Toleranz von ``get_snapshot``, der linke Rand **ist** also da
        (140,0). Danach ein Reset: 06:00 steht auf 20,0, 18:00 auf 50,0, und der
        Tag läuft noch (kein Stand um 24:00). Nur der **rechte** Rand fehlt also
        — die Lage, in der der Rückfall überhaupt arbeitet.

        * **Mit** der Nachfrage nach dem linken Rand: 50 − 140 < 0 ⇒ Rücksprung
          ⇒ keine Aussage.
        * **Ohne** sie rückte auch der linke Rand auf den ersten Stand **im**
          Tag (06:00 = 20,0), das verkürzte Fenster enthielte den Rücksprung
          nicht mehr — und eedc meldete **30,0 kWh** statt keiner Aussage.
        """
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _map(a, inv, "strom_heizen_kwh")
        _stand(db, a, inv, "strom_heizen_kwh",
               T0 - timedelta(minutes=3), 140.0)
        _stand(db, a, inv, "strom_heizen_kwh", T0 + timedelta(hours=6), 20.0)
        _stand(db, a, inv, "strom_heizen_kwh", T0 + timedelta(hours=18), 50.0)
        await db.commit()

        d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM)

        assert "wp_strom_heizen_kwh" not in d.werte
        assert d.grund_je_feld["wp_strom_heizen_kwh"] == "zaehler_ruecksprung"

    async def test_ein_einziger_stand_im_tag_ist_kein_fenster(self, db):
        """Ein Stand ist kein Fenster: ``von == bis`` ergäbe eine gemessene
        **0** — und die sähe aus wie „nichts gelaufen" (P4/F-42)."""
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _map(a, inv, "strom_heizen_kwh")
        _stand(db, a, inv, "strom_heizen_kwh", T0 + timedelta(hours=12), 100.0)
        await db.commit()

        d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, DATUM)

        assert "wp_strom_heizen_kwh" not in d.werte
        assert d.grund_je_feld["wp_strom_heizen_kwh"] == GRUND_KEINE_ZAEHLERSTAENDE

    async def test_der_betriebsart_zaehler_bekommt_denselben_rueckfall(self, db):
        """**Die Teilmengen lesen im selben Fenster wie ihr Bezug.** Ohne den
        Rückfall in ``get_betriebsart_strom_tageswerte`` fiele am ersten Tag die
        ganze Aufteilung in den Rest *nicht aufgeteilt*, obwohl sie gemessen
        ist (Sprengsatz S21)."""
        from backend.services.snapshot.aggregator import (
            get_betriebsart_strom_tageswerte,
        )

        a = await _anlage(db)
        inv = await _geraet(db, a)
        _map(a, inv, BA_KUEHLEN)
        _stand(db, a, inv, BA_KUEHLEN, T0 + timedelta(hours=11), 100.0)
        _stand(db, a, inv, BA_KUEHLEN, T0 + timedelta(hours=24), 104.0)
        await db.commit()

        ba = await get_betriebsart_strom_tageswerte(db, a, {str(inv.id): inv}, DATUM)

        assert ba == {str(inv.id): {BA_KUEHLEN: pytest.approx(4.0)}}

    async def test_die_marke_erreicht_die_route(self, db):
        a, inv = await self._erster_tag(db)
        _tageszeile(db, a, {})

        r = await _tag(db, a)

        assert r.wp_abdeckung_hinweis == "gemessen ab 11:00 Uhr"

    async def test_der_volle_tag_nennt_keine_marke_in_der_route(self, db):
        a, inv = await self._erster_tag(db, ab=0, bis=24)
        _tageszeile(db, a, {})

        r = await _tag(db, a)

        assert r.wp_abdeckung_hinweis is None


class TestR4StummerGesamtzaehler:
    """N-482 — die n-gegen-1-Präzedenz am Tag."""

    async def _anlage_mit_stummem_gesamtzaehler(self, db, *, gesamt_kwh=None):
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _zaehler(db, a, inv, "strom_heizen_kwh", 8.0)
        _zaehler(db, a, inv, "strom_warmwasser_kwh", 2.0)
        _zaehler(db, a, inv, "heizenergie_kwh", 30.0)
        # Der Gesamtzähler ist **zugeordnet** — er liefert an diesem Tag nur
        # nichts. Genau daran entschied die Beitragsschicht bisher 1-aus-n.
        _zaehler(db, a, inv, "stromverbrauch_kwh", gesamt_kwh)
        _tageszeile(db, a, {})
        return a, inv

    async def test_ein_stummer_gesamtzaehler_laesst_die_achsen_tragen(self, db):
        a, inv = await self._anlage_mit_stummem_gesamtzaehler(db)

        r = await _tag(db, a)

        assert r.wp_jaz_nenner_kwh == pytest.approx(10.0)
        assert r.wp_jaz == pytest.approx(3.0)
        assert [g.strom_kwh for g in r.wp_geraete] == [pytest.approx(10.0)]

    async def test_ein_sprechender_gesamtzaehler_bleibt_die_menge(self, db):
        """Die Gegenprobe: liefert er einen Stand, gilt K1 unverändert."""
        a, inv = await self._anlage_mit_stummem_gesamtzaehler(db, gesamt_kwh=12.0)

        r = await _tag(db, a)

        assert r.wp_jaz_nenner_kwh == pytest.approx(12.0)

    async def test_die_tageszeile_schlaegt_den_tagesrand(self, db):
        """**Die Präzedenz, und zwar in der Lage, in der sie etwas entscheidet**
        (Sprengsatz S13): Die Tageszeile trägt **20,0**, die Randstände ergäben
        10,0. Gilt die Zeile, ist die Bilanzzahl dieses Tages dieselbe, mit der
        Kosten und CO₂ schon gerechnet haben — eine zweite daneben wäre die
        S1-Verletzung, gegen die diese Präzedenz gebaut ist."""
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _zaehler(db, a, inv, "strom_heizen_kwh", 8.0)
        _zaehler(db, a, inv, "strom_warmwasser_kwh", 2.0)
        _zaehler(db, a, inv, "heizenergie_kwh", 40.0)
        _tageszeile(db, a, {inv.id: 20.0})

        r = await _tag(db, a)

        assert r.wp_jaz_nenner_kwh == pytest.approx(20.0)
        assert r.wp_jaz == pytest.approx(2.0)


# ── R-5 · Eine Strommenge je Bildschirm (N-492) ─────────────────────────────

class TestR5EinBildschirm:
    async def test_kachel_mit_zahl_bekommt_nicht_kein_stromverbrauch(self, db):
        """**Der Satz auf dem Screenshot.** Zähler zugeordnet, an diesem Tag
        kein Stand ⇒ der Grund nennt den Randstand, nicht das Gerät."""
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _map(a, inv, "strom_heizen_kwh")
        _map(a, inv, "heizenergie_kwh")
        _stand(db, a, inv, "heizenergie_kwh", T0, 500.0)
        _stand(db, a, inv, "heizenergie_kwh", T0 + timedelta(hours=24), 530.0)
        _tageszeile(db, a, {})

        r = await _tag(db, a)

        assert r.wp_jaz is None
        assert r.wp_jaz_grund != GRUND_KEIN_STROM
        assert r.wp_jaz_grund == TAGESWERT_GRUND_KURZ[GRUND_KEINE_ZAEHLERSTAENDE]

    async def test_ohne_jeden_stromzaehler_bleibt_der_alte_satz(self, db):
        """**Gegenprobe.** Ist gar kein Stromzähler zugeordnet, ist *„kein
        Stromverbrauch erfasst"* die richtige Auskunft — samt ihrem Handgriff.
        Der Wortlaut von ``GRUND_NICHT_ZUGEORDNET`` spräche hier von einem
        *Wärme*mengenzähler und wäre unter einer Stromzeile falsch."""
        a = await _anlage(db)
        inv = await _geraet(db, a, F5, name="WP")
        _zaehler(db, a, inv, "heizenergie_kwh", 30.0)
        _tageszeile(db, a, {})

        r = await _tag(db, a)

        assert r.wp_jaz_grund == GRUND_KEIN_STROM


# ── R-2 · Die Tages-Heizwärme kennt die Betriebsart-Nutzenergie (N-487) ─────

class TestR2Heizwaerme:
    def test_die_weiche_je_geraet(self):
        """D1-Stufe 3, je Gerät: Achse schlägt Betriebsart, addiert wird nie."""
        assert heizwaerme_je_geraet({"1": 10.0}, {"1": 7.0, "2": 4.0}) == {
            "1": 10.0, "2": 4.0,
        }

    def test_eine_gemessene_null_der_achse_gewinnt(self):
        """F-42: „diesen Monat nicht geheizt" ist eine Messung."""
        assert heizwaerme_je_geraet({"1": 0.0}, {"1": 7.0}) == {"1": 0.0}

    async def test_der_tag_traegt_die_betriebsart_waerme(self, db):
        a = await _anlage(db)
        inv = await _geraet(db, a)
        _zaehler(db, a, inv, BA_HEIZEN, 10.0)
        _zaehler(db, a, inv, NE_HEIZEN, 30.0)
        _tageszeile(db, a, {})

        r = await _tag(db, a)

        assert r.wp_heizung_kwh == pytest.approx(30.0)
        assert r.wp_waerme_kwh == pytest.approx(30.0)
        assert r.wp_jaz == pytest.approx(3.0)
        assert r.wp_waerme_grund is None

    async def test_summe_der_tage_ist_der_monat(self, db):
        """**Die Probe, die der Auftrag verlangt.** Ein Gerät mit nur
        Betriebsart-Wärme: Σ der Tage = der Monatswert derselben Größe."""
        a = await _anlage(db)
        inv = await _geraet(db, a)
        _map(a, inv, BA_HEIZEN)
        _map(a, inv, NE_HEIZEN)
        tage = [DATUM, DATUM + timedelta(days=1), DATUM + timedelta(days=2)]
        # Vier Ränder für drei Tage — jeder Stand genau einmal (der Endrand
        # eines Tages IST der Anfangsrand des nächsten).
        for i in range(len(tage) + 1):
            t = datetime.combine(DATUM, datetime.min.time()) + timedelta(days=i)
            _stand(db, a, inv, BA_HEIZEN, t, 1000.0 + 10.0 * i)
            _stand(db, a, inv, NE_HEIZEN, t, 5000.0 + 30.0 * i)
        db.add(InvestitionMonatsdaten(
            investition_id=inv.id, jahr=DATUM.year, monat=DATUM.month,
            verbrauch_daten={BA_HEIZEN: 30.0, NE_HEIZEN: 90.0},
        ))
        await db.commit()

        summe_tage = 0.0
        for tag in tage:
            d = await get_tagesdetail_kwh(db, a, {str(inv.id): inv}, tag)
            summe_tage += heizwaerme_je_geraet(
                d.werte_je_inv.get("wp_heizung_kwh"),
                d.werte_je_inv.get("wp_betriebsart_heizen_kwh"),
            ).get(str(inv.id), 0.0)

        from backend.core.berechnungen.waermepumpe_kennzahl import heizwaerme_kwh
        monat = heizwaerme_kwh({BA_HEIZEN: 30.0, NE_HEIZEN: 90.0})
        assert summe_tage == pytest.approx(90.0)
        assert monat == pytest.approx(90.0)


# ── R-3 · Der Checker liest die Weiche (N-488) ──────────────────────────────

class TestR3Checker:
    """Der Prüfer liest dieselben Eingänge wie die Anzeige (Konzept 11.5).

    ⚠ **Ohne DB, wie die Schwesterdatei** ``test_daten_checker_wp_arbeitszahl.py``:
    ``_check_wp_arbeitszahl_unplausibel`` liest nur Attribute, und eine Fixture
    mit Session machte die Aussage nicht schärfer.
    """

    @staticmethod
    def _anlage_double(verbrauch_daten: dict, parameter=None):
        from types import SimpleNamespace

        imd = SimpleNamespace(jahr=2026, monat=8, verbrauch_daten=verbrauch_daten)
        inv = SimpleNamespace(
            id=1, typ="waermepumpe", bezeichnung="Split-Klima", monatsdaten=[imd],
            parameter=parameter if parameter is not None else dict(F5),
        )
        return SimpleNamespace(investitionen=[inv])

    def test_der_pruefer_sieht_die_betriebsart_waerme(self):
        """**N-488.** 10 kWh Heizstrom auf 120 kWh Heizwärme je Betriebsart ⇒
        Arbeitszahl 12, und der Prüfer meldet sie. Mit der alten Lesetür
        (``get_wp_heizenergie_kwh``) sah er **gar keine** Wärme, ``waerme <= 0``
        griff, und er schwieg — während Hub und Cockpit die Zahl zeigen."""
        from backend.services.daten_checker.waermepumpe import WaermepumpeChecks

        ergebnisse = WaermepumpeChecks()._check_wp_arbeitszahl_unplausibel(
            self._anlage_double({"strom_heizen_kwh": 10.0, NE_HEIZEN: 120.0}),
        )

        assert ergebnisse, "der Prüfer muss die Betriebsart-Wärme sehen"
        assert "Arbeitszahl 12" in ergebnisse[0].meldung

    def test_eine_plausible_betriebsart_waerme_meldet_nichts(self):
        """Gegenprobe: dieselbe Weiche, gesunde Zahl ⇒ Schweigen."""
        from backend.services.daten_checker.waermepumpe import WaermepumpeChecks

        assert WaermepumpeChecks()._check_wp_arbeitszahl_unplausibel(
            self._anlage_double({"strom_heizen_kwh": 10.0, NE_HEIZEN: 35.0}),
        ) == []

    def test_die_achse_behaelt_den_vorrang(self):
        """D1 unverändert: die gepflegte Achse schlägt die Betriebsart-Menge —
        35 ÷ 10 = 3,5 ist plausibel, obwohl die Teilmenge 120 eine 12 ergäbe."""
        from backend.services.daten_checker.waermepumpe import WaermepumpeChecks

        assert WaermepumpeChecks()._check_wp_arbeitszahl_unplausibel(
            self._anlage_double({
                "strom_heizen_kwh": 10.0, "heizenergie_kwh": 35.0, NE_HEIZEN: 120.0,
            }),
        ) == []
