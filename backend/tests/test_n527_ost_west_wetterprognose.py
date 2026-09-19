"""N-527 / N-528 — „Ost-West (gemischt)" in der Wetterprognose, Ausrichtung eines Assistenten-BKW.

**N-527.** PVGIS rechnete eine Ost-West-Komponente seit jeher als zwei halbe Anlagen (Ost -90°,
West +90°, ``api/routes/pvgis._kappungs_abrufe``). Der OpenMeteo-Pfad — Live, 14-Tage-Prognose,
Prognose-Kanon, Prefetch, HA-/MQTT-Prognosesensoren — kannte den Wert nicht: ``AUSRICHTUNG_MAP``
hatte keinen Eintrag, ``get_pv_azimut`` fiel auf Süd (0°) zurück. Gefunden an Kai2s Anlage
(T89667 #345, 18.09.2026): zwei BKW à 2 × 550 Wp, „Ost-West (gemischt)", 14°.

**N-528.** Die PVGIS-Route las die Ausrichtung nur aus der Spalte ``Investition.ausrichtung``;
ein Balkonkraftwerk aus dem Einrichtungsassistenten trägt sie nur im ``parameter``-JSON
(``PARAM_BALKONKRAFTWERK["AUSRICHTUNG"]``) — und wurde deshalb als Süd gerechnet.

Die Proben halten: (1) Ost-West = zwei Hälften, (2) Ost-West gewinnt vor einem alten
``ausrichtung_grad``, (3) alles andere bleibt bitgleich, (4) ein Prädikat für beide Pfade,
(5) die Hälften teilen sich ihre AC-Grenze, (6) PVGIS und Aktualitätsprüfung lesen die
Ausrichtung nicht mehr aus der Spalte allein.
"""
from __future__ import annotations

import inspect
import re
from datetime import date
from pathlib import Path

import pytest

from backend.api.routes import pvgis as pvgis_route
from backend.core.berechnungen.wr_kappung import kappe_stunde, zuordne_grenzen
from backend.services import pvgis_aktualitaet
from backend.services.prognose_kanon import _kappungs_mitglieder
from backend.services.pv_orientation import (
    Abruf,
    ausrichtung_text,
    erzeuger_abrufe,
    erzeuger_string_configs,
    ist_ost_west,
    orientierungs_gruppen,
)


class _Inv:
    """Investition-Double mit genau den Attributen, die die Helper lesen."""

    _naechste_id = [900]

    def __init__(self, typ="balkonkraftwerk", **kw):
        self.typ = typ
        self.bezeichnung = None
        self.leistung_kwp = None
        self.neigung_grad = None
        self.ausrichtung = None
        self.parameter = {}
        self.parent_investition_id = None
        self.id = self._naechste_id[0]
        self._naechste_id[0] += 1
        self.__dict__.update(kw)

    def ist_aktiv_an(self, _tag):
        return True


def _kai2_bkw(**extra):
    """BKW 2 von Kai2, so wie das Bearbeiten-Formular es speichert (Spalte + JSON)."""
    params = {"anzahl": 2, "leistung_wp": 550, "ausrichtung": "Ost-West", "neigung_grad": 14}
    params.update(extra.pop("parameter", {}))
    return _Inv(bezeichnung="BKW 2 1100W/800 Growatt", ausrichtung="Ost-West",
                neigung_grad=14, parameter=params, **extra)


# ---------------------------------------------------------------- N-527

def test_ost_west_bkw_liefert_zwei_halbe_abrufe():
    abrufe = erzeuger_abrufe(_kai2_bkw())
    assert abrufe == [Abruf(kwp=0.55, neigung=14, ausrichtung=-90),
                      Abruf(kwp=0.55, neigung=14, ausrichtung=90)]


def test_orientierungs_gruppen_teilen_ost_west_wie_pvgis():
    gruppen = orientierungs_gruppen([_kai2_bkw()])
    assert sorted((g.neigung, g.ausrichtung, g.kwp) for g in gruppen) == [
        (14, -90, pytest.approx(0.55)), (14, 90, pytest.approx(0.55)),
    ]


def test_ost_west_gewinnt_vor_altem_ausrichtung_grad():
    """Das Formular schreibt bei Ost-West keinen Grad; ein früherer Süd-Wert kann liegen bleiben —
    PVGIS entscheidet Ost-West zuerst, die Wetterprognose jetzt genauso."""
    modul = _Inv(typ="pv-module", leistung_kwp=2.0, ausrichtung="Ost-West", neigung_grad=30,
                 parameter={"ausrichtung_grad": 0})
    assert [a.ausrichtung for a in erzeuger_abrufe(modul)] == [-90, 90]


def test_feste_ausrichtung_bleibt_bitgleich():
    """Rainers Anlage aus test_bkw_kanon_und_wr_kappung_347: ein Abruf, dieselben Werte wie zuvor."""
    pv = _Inv(typ="pv-module", leistung_kwp=8.0, ausrichtung="Süd", neigung_grad=30)
    bkw = _Inv(parameter={"leistung_wp": 420, "anzahl": 3, "ausrichtung": "Süd", "neigung_grad": 30})
    assert erzeuger_abrufe(pv) == [Abruf(kwp=8.0, neigung=30, ausrichtung=0)]
    gruppen = orientierungs_gruppen([pv, bkw])
    assert len(gruppen) == 1 and gruppen[0].kwp == pytest.approx(9.26)
    assert erzeuger_abrufe(_Inv(typ="pv-module", leistung_kwp=0.0)) == []


@pytest.mark.parametrize("text", [
    "Ost-West", "ost-west", "OST-WEST", "Ost-West (gemischt)", "east-west", "OW", "o-w",
    "Süd", "Ost", "West", "Südost", "", None,
])
def test_ein_praedikat_fuer_pvgis_und_wetterprognose(text):
    assert ist_ost_west(text) == pvgis_route._ist_ost_west(text)


def test_ost_west_haelften_teilen_sich_die_ac_grenze():
    """Kai2: 1,10 kWp an 800 W. Zwei Mitglieder in zwei Gruppen, EINE Grenze — bei voller
    Sonne liefern beide Hälften zusammen 0,8 kW, nicht je 0,8 kW."""
    bkw = _kai2_bkw(parameter={"wechselrichter_leistung_w": 800})
    gruppen = orientierungs_gruppen([bkw])
    grenzen = zuordne_grenzen([bkw], [], [])
    mitglieder = _kappungs_mitglieder([bkw], gruppen, date(2026, 6, 21), grenzen)
    assert [len(m) for m in mitglieder] == [1, 1]
    kennungen = {m.grenz_id for gruppe in mitglieder for m in gruppe}
    assert len(kennungen) == 1 and None not in kennungen
    assert all(m.grenze_kw == pytest.approx(0.8) for gruppe in mitglieder for m in gruppe)
    # Beide Gruppen liefern 0,55 kW (= 1 kW/kWp): ungekappt 1,1 kW, gekappt 0,8 kW gesamt.
    gekappt = kappe_stunde([0.55, 0.55], [g.kwp for g in gruppen], mitglieder)
    assert sum(gekappt) == pytest.approx(0.8)


def test_string_configs_nennen_die_haelften():
    strings = erzeuger_string_configs([_kai2_bkw(), _Inv(typ="pv-module", leistung_kwp=4.0,
                                                          bezeichnung="Dach", ausrichtung="Süd")])
    assert [(s.name, s.kwp, s.neigung, s.ausrichtung) for s in strings] == [
        ("BKW 2 1100W/800 Growatt (Ost)", 0.55, 14, -90),
        ("BKW 2 1100W/800 Growatt (West)", 0.55, 14, 90),
        ("Dach", 4.0, 35, 0),
    ]


# ---------------------------------------------------------------- N-528

def test_assistenten_bkw_traegt_die_ausrichtung_nur_im_json():
    """So legt der Einrichtungsassistent ein Balkonkraftwerk an: Spalte leer, JSON gefüllt."""
    bkw = _Inv(parameter={"anzahl": 2, "leistung_wp": 400, "ausrichtung": "West", "neigung_grad": 20})
    assert bkw.ausrichtung is None
    assert ausrichtung_text(bkw) == "West"
    assert erzeuger_abrufe(bkw) == [Abruf(kwp=0.8, neigung=20, ausrichtung=90)]
    assert ausrichtung_text(_Inv(ausrichtung="Ost", parameter={"ausrichtung": "West"})) == "Ost"
    assert ausrichtung_text(_Inv()) is None


def test_pvgis_und_aktualitaet_lesen_die_spalte_nicht_mehr_allein():
    """Wächter für die Klasse: keine Route liest `modul.ausrichtung` direkt — der Text-Leser
    kennt beide Ablagen. (Der Speicherpfad in `pvgis_aktualitaet` lief bis N-528 an der
    Spalte vorbei und hätte ein Assistenten-BKW nach dem Speichern als abweichend gemeldet.)"""
    # `prog_modul.ausrichtung_grad` (gespeicherte Prognose-Zeile) ist kein Treffer —
    # gemeint ist die Investition `modul` und ihre Spalte `ausrichtung`.
    spalte = re.compile(r"(?<![A-Za-z0-9_])modul\.ausrichtung(?![A-Za-z0-9_])")
    for modul in (pvgis_route, pvgis_aktualitaet):
        quelle = Path(inspect.getsourcefile(modul)).read_text(encoding="utf-8")
        assert not spalte.search(quelle), modul.__name__
        assert "ausrichtung_text(" in quelle, modul.__name__
