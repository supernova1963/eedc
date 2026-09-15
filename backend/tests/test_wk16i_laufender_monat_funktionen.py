"""**Der laufende Monat kennt seine Funktionen** — WK-16i (N-503).

WK-16e hat dem laufenden Monat seine fünfte Quelle gegeben: Fehlt die
``Monatsdaten``-Zeile — und die fehlt dort **immer**, einen automatischen
Monatsabschluss gibt es nicht —, kommen Kacheln und Tabelle *Zahlen je Gerät*
aus der lokalen Tagesebene. Die **anlagenweiten Eingänge der
Funktions-Arbeitszahl** hat es nicht mitgenommen.

**Gemessen an der Demo-DB r28 (Prüfstand Wärme/Klima, September 2026), vor dem
Bau:** Im Kasten *„Was noch möglich wäre"* stand

    Arbeitszahl Heizen · Arbeitszahl Warmwasser
    — Strom nicht getrennt je Funktion gemessen
    → Getrennte Strommessung einschalten und beide Zähler zuordnen

und **direkt darüber** zeigte die Tabelle *Zahlen je Gerät* für die Nibe S1255
**5,58** und **3,32**. Zwei Leser, ein Bildschirm (dieselbe Klasse wie N-492) —
und der Handgriff führte ins Leere: Vaillant und Nibe tragen das Kennzeichen
``getrennte_strommessung`` längst.

⛔ **Was diese Datei NICHT noch einmal misst:** die fünfte Quelle selbst
(``test_n472_laufender_monat_quellen.py``), die Achsen-Regel je Gerät
(``test_wk16h_achsen_der_kennzahl.py``), die R2-Sperren im Layer
(``test_r2_je_funktion.py``), die Schranke und den Kasten
(``test_wk16_e1b_d_sicht.py``). Hier steht **eine** Frage: woher die
anlagenweiten Eingänge kommen, wenn die Monatszeile nichts trägt.
"""

from __future__ import annotations

from datetime import date, datetime

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    ARBEITSZAHL_FUNKTIONEN,
    GRUND_FUNKTION_NICHT_DECKUNGSGLEICH,
    GRUND_STROM_NICHT_JE_FUNKTION,
)
from backend.core.betriebsmodus import HEIZEN, WARMWASSER
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.investition import InvestitionMonatsdaten
from backend.models.mqtt_gateway_mapping import MqttGatewayMapping  # noqa: F401
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.monats_fakten import WpFakten
from backend.services.waerme_klima_block import (
    FunktionsEingaengeDerAnlage,
    funktions_eingaenge_der_anlage,
    traegt_menge,
)
from backend.services.waermepumpe_kennzahlen_je_geraet import (
    GeraetMengen,
    kennzahlen_aus_mengen,
)
from backend.tests import factories

#: Der geprüfte Monat — **fest**, nie aus der Uhr (N-167).
JAHR, MONAT = 2026, 9
#: „Jetzt": der 14. um 12:00 — dreizehn abgelaufene Tage, kein Monatsabschluss.
#: Genau die Lage des Befunds.
JETZT = datetime(JAHR, MONAT, 14, 12, 0, 0)
TAGE = 13

_LW = {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz"}
_LW_F5 = {**_LW, "getrennte_strommessung": True}
_BRAUCHWASSER = {"wp_art": "brauchwasser", "effizienz_modus": "gesamt_jaz"}


class _FesteUhr(datetime):
    """``datetime`` mit stehengebliebener ``now()`` — wie in ``test_n472_*``.

    ``get_aktueller_monat`` entscheidet an ``datetime.now()``, ob der Monat
    läuft. Eine Probe, die dafür die echte Uhr liest, wettet auf den Tag ihres
    Laufs (N-167). Als **Subklasse** bleibt jeder andere Gebrauch von
    ``datetime`` in der Route unverändert.
    """

    @classmethod
    def now(cls, tz=None):  # noqa: D102 — Verhalten steht im Klassen-Docstring
        return JETZT


# ═══════════════════════════════════════════════════════════════════════════
# Teil 1 — Die Faltung als reine Funktion
# ═══════════════════════════════════════════════════════════════════════════


def _mengen(**kw) -> GeraetMengen:
    basis = dict(inv_id=1, name="Gerät", strom_kwh=10.0, waerme_kwh=40.0)
    return kennzahlen_aus_mengen(GeraetMengen(**{**basis, **kw}))


def test_die_faltung_summiert_nur_die_geraete_mit_der_achse():
    """**R-1 anlagenweit:** die Heizwärme einer Brauchwasser-WP zählt nicht mit.

    Ein Altwert in der Zeile ändert nichts daran, dass es die Achse an diesem
    Gerät nicht gibt (ADR-002/**P13**) — und eine anlagenweite Heiz-Arbeitszahl
    mit ihm im Zähler wäre eine Zahl über eine Funktion, die dieses Gerät nicht
    hat.
    """
    e = funktions_eingaenge_der_anlage([
        _mengen(inv_id=1, heizung_kwh=100.0, strom_heizen_kwh=25.0,
                waerme_achsen=frozenset({HEIZEN, WARMWASSER})),
        _mengen(inv_id=2, heizung_kwh=60.0, strom_heizen_kwh=20.0,
                waerme_achsen=frozenset({WARMWASSER})),
    ])

    assert e.heizung_kwh == 100.0, "die 60 der Brauchwasser-WP gehören nicht dazu"
    assert e.strom_heizen_kwh == 25.0
    assert e.geraete_q_heizen == frozenset({1})
    assert e.geraete_e_heizen == frozenset({1})


def test_hat_split_fragt_die_BEITRAGENDEN_geraete():
    """Beitrag statt Bestand — wie ``achsen_der_anlage`` und der Tag (N-441).

    Ein stillstehendes Gerät mit getrennter Strommessung darf einen Monat nicht
    freischalten, in dem es keinen Strom verbraucht hat.
    """
    ohne_beitrag = funktions_eingaenge_der_anlage([
        _mengen(inv_id=1, strom_kwh=0.0, waerme_kwh=0.0,
                hat_getrennte_strommessung=True),
    ])
    mit_beitrag = funktions_eingaenge_der_anlage([
        _mengen(inv_id=1, strom_kwh=10.0, hat_getrennte_strommessung=True),
    ])

    assert ohne_beitrag.hat_split is False
    assert mit_beitrag.hat_split is True


def test_waerme_ist_gesamt_kommt_aus_den_geraeten():
    """**N-391 anlagenweit.** Ein gemeinsamer Wärmemengenzähler sagt es selbst.

    Ohne dieses Feld hieße die leere Funktions-Zeile *„kein Wärmemengenzähler
    zugeordnet"* an einer Anlage, deren Zähler zugeordnet **ist** — die
    W-18-Klasse.
    """
    mit = funktions_eingaenge_der_anlage([
        _mengen(inv_id=1, hat_getrennte_strommessung=True,
                waerme_ist_gesamt_getrennt=True),
    ])
    ohne = funktions_eingaenge_der_anlage([
        _mengen(inv_id=1, hat_getrennte_strommessung=True),
    ])

    assert mit.waerme_ist_gesamt is True
    assert ohne.waerme_ist_gesamt is False


@pytest.mark.parametrize("q_inv,e_inv,erwartet", [
    (1, 1, True),     # dasselbe Gerät auf beiden Seiten
    (1, 2, False),    # Wärme von A, Strom von B — die N-441-Lage
    (None, 1, None),  # Strom ohne Wärme: `arbeitszahl` hat den besseren Satz
])
def test_die_deckung_vergleicht_identitaeten(q_inv, e_inv, erwartet):
    """Dieselbe Layer-Regel wie die Monatszeile, nur auf den Geräte-Mengen."""
    geraete = [
        _mengen(inv_id=i,
                heizung_kwh=100.0 if i == q_inv else 0.0,
                strom_heizen_kwh=25.0 if i == e_inv else 0.0)
        for i in (1, 2)
    ]

    assert funktions_eingaenge_der_anlage(geraete).deckung_je_funktion(
        "heizen") is erwartet


def test_kuehlen_beantwortet_die_faltung_nicht():
    """Sie liefert die Eingänge, deren **Mengen** sie auch liefert.

    Die anlagenweite Kälte und der Kühlstrom kommen im laufenden Monat weiterhin
    aus der Monatszeile; eine Deckungs-Aussage aus einer anderen Quelle als die
    Mengen wäre die Mischung, gegen die R2 steht.
    """
    e = funktions_eingaenge_der_anlage([
        _mengen(inv_id=1, kaelte_kwh=50.0, modus_strom_kuehlen_kwh=20.0),
    ])

    assert e.deckung_je_funktion("kuehlen") is None


def test_ohne_geraete_sagt_die_faltung_nichts():
    """Eine leere Faltung ist keine Messung (**P4**) — und bitgleich zu vorher."""
    e = funktions_eingaenge_der_anlage([])

    assert (e.heizung_kwh, e.warmwasser_kwh) == (0.0, 0.0)
    assert (e.strom_heizen_kwh, e.strom_warmwasser_kwh) == (0.0, 0.0)
    assert e.hat_split is False and e.waerme_ist_gesamt is False
    assert all(e.deckung_je_funktion(f) is None for f in ARBEITSZAHL_FUNKTIONEN)


def test_traegt_menge_ist_dieselbe_frage_fuer_zeile_und_geraet():
    """**Die S5-Weiche steht einmal** — F-56: eine Regel, nicht zwei Schreibweisen."""
    assert traegt_menge(None) is False
    assert traegt_menge(WpFakten()) is False
    assert traegt_menge(WpFakten(strom_kwh=5.0)) is True
    assert traegt_menge(WpFakten(waerme_kwh=5.0)) is True
    assert traegt_menge(GeraetMengen(inv_id=1, name="x")) is False
    assert traegt_menge(GeraetMengen(inv_id=1, name="x", waerme_kwh=1.0)) is True


def test_beide_herkuenfte_sprechen_dieselbe_sprache():
    """Der Vokabular-Wächter: ein Codeweg trägt nur mit **gleichen Feldnamen**.

    ⚠ Die Route liest ``_wp_funktion.<feld>`` und weiß nicht, welche der beiden
    Herkünfte sie vor sich hat. Benennt eine Seite eine Größe um, fiele das sonst
    erst in der Antwort auf — und nur in der Lage, die diese Herkunft trifft.
    """
    gemeinsam = {
        "heizung_kwh", "warmwasser_kwh", "strom_heizen_kwh",
        "strom_warmwasser_kwh", "hat_split", "waerme_ist_gesamt",
    }
    assert gemeinsam <= set(FunktionsEingaengeDerAnlage.__dataclass_fields__)
    assert gemeinsam <= set(WpFakten.__dataclass_fields__)
    for f in ARBEITSZAHL_FUNKTIONEN:
        WpFakten().deckung_je_funktion(f)
        FunktionsEingaengeDerAnlage().deckung_je_funktion(f)


# ═══════════════════════════════════════════════════════════════════════════
# Teil 2 — Die Route: der laufende Monat
# ═══════════════════════════════════════════════════════════════════════════
#
# Die Tagesebene wird über die echten Wege gebaut: `komponenten_kwh` für den
# Gesamtstrom je Gerät, `sensor_mapping` + `SensorSnapshot`-Standreihen für die
# Achsen. Wer die Werte von Hand in die Zwischenschicht schreibt, prüft seine
# eigene Annahme (die Lehre aus N-328/W-5).


async def _anlage_mit_tagesebene(db, geraete: list[tuple[str, dict, dict]]):
    """Eine Anlage, deren einzige Spur im laufenden Monat die Tagesebene ist.

    Args:
        geraete: ``(bezeichnung, parameter, felder)`` — ``felder`` ist der
            **Tageszuwachs** je Registry-Feld; ``stromverbrauch_kwh`` landet als
            Zählerstrom in ``komponenten_kwh``, alles andere als Standreihe.
    """
    anlage = await factories.anlage(db, anlagenname="WK-16i")
    mapping: dict[str, dict] = {}
    invs: list[Investition] = []
    for bezeichnung, parameter, felder in geraete:
        inv = Investition(
            anlage_id=anlage.id, typ="waermepumpe", bezeichnung=bezeichnung,
            anschaffungsdatum=date(2024, 1, 1), parameter=parameter,
        )
        db.add(inv)
        await db.flush()
        invs.append(inv)
        mapping[str(inv.id)] = {"felder": {
            feld: {"strategie": "sensor", "sensor_id": f"sensor.{inv.id}_{feld}"}
            for feld in felder if feld != "stromverbrauch_kwh"
        }}
    anlage.sensor_mapping = {"investitionen": mapping}

    stand = {(inv.id, feld): 100.0 for inv in invs for feld in geraete[0][2]}
    for tag in range(1, TAGE + 2):
        datum = date(JAHR, MONAT, tag)
        if tag <= TAGE:
            db.add(TagesZusammenfassung(
                anlage_id=anlage.id, datum=datum,
                komponenten_kwh={
                    f"waermepumpe_{inv.id}": felder["stromverbrauch_kwh"]
                    for inv, (_, _, felder) in zip(invs, geraete)
                    if felder.get("stromverbrauch_kwh")
                },
            ))
        for inv, (_, _, felder) in zip(invs, geraete):
            for feld, zuwachs in felder.items():
                if feld == "stromverbrauch_kwh":
                    continue
                db.add(SensorSnapshot(
                    anlage_id=anlage.id, sensor_key=f"inv:{inv.id}:{feld}",
                    zeitpunkt=datetime.combine(datum, datetime.min.time()),
                    wert_kwh=stand.setdefault((inv.id, feld), 100.0),
                    quelle="ha_statistics",
                ))
                stand[(inv.id, feld)] += zuwachs
    await db.commit()
    return anlage, invs


#: Gerät A — beide Achsen gemessen, getrennte Strommessung.
#: 13 × 10,0 = 130,0 Heizwärme ÷ 13 × 2,5 = 32,5 Heizstrom ⇒ **4,0**
#: 13 × 4,5 = 58,5 Warmwasser ÷ 13 × 1,5 = 19,5 ⇒ **3,0**
_A = ("Nibe S1255", _LW_F5, {
    "stromverbrauch_kwh": 4.0, "heizenergie_kwh": 10.0, "warmwasser_kwh": 4.5,
    "strom_heizen_kwh": 2.5, "strom_warmwasser_kwh": 1.5,
})
#: Gerät B — getrennte Strommessung, aber EIN gemeinsamer Wärmemengenzähler.
#: Es steht mit Heiz- und Warmwasser-Strom im Nenner und mit keiner
#: Funktions-Wärme im Zähler.
_B = ("Vaillant aroTHERM", _LW_F5, {
    "stromverbrauch_kwh": 3.0, "waerme_kwh": 12.0,
    "strom_heizen_kwh": 2.0, "strom_warmwasser_kwh": 1.0,
})
#: Gerät C — Brauchwasser-WP ohne getrennte Strommessung.
_C = ("Stiebel WWK 300", _BRAUCHWASSER, {
    "stromverbrauch_kwh": 2.0, "warmwasser_kwh": 8.0,
})
#: Gerät D — dieselbe Brauchwasser-WP, aber mit einem **Heiz**zähler daran.
#: Die Registry-Bedingung ist dort **weich**: Die Menge darf gelesen werden
#: („untypisch, nicht unmöglich"), eine *Arbeitszahl Heizen* verspricht eedc
#: trotzdem nicht — genau die Trennlinie aus WK-15c/WK-16h.
_D = ("Stiebel mit Heizkreis", _BRAUCHWASSER, {
    "stromverbrauch_kwh": 2.0, "warmwasser_kwh": 8.0, "heizenergie_kwh": 5.0,
})


async def _monat(db, anlage_id, jahr=JAHR, monat=MONAT):
    import backend.api.routes.aktueller_monat as am
    return await am.get_aktueller_monat(anlage_id=anlage_id, jahr=jahr, monat=monat, db=db)


async def test_der_laufende_monat_zeigt_die_funktions_arbeitszahlen(db, monkeypatch):
    """**Der Kern des Pakets.** Ein Gerät mit getrennten Zählern, kein Abschluss.

    Handrechnung: 130,0 ÷ 32,5 = **4,0** · 58,5 ÷ 19,5 = **3,0**. Vorher stand
    an beiden Zeilen *„Strom nicht getrennt je Funktion gemessen"* — obwohl das
    Kennzeichen gesetzt ist und die Tabelle daneben dieselben Zahlen zeigt.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, _ = await _anlage_mit_tagesebene(db, [_A])

    res = await _monat(db, anlage.id)

    assert res.wp_heizung_kwh == 130.0
    assert res.wp_warmwasser_kwh == 58.5
    assert res.wp_strom_heizen_kwh == 32.5
    assert res.wp_strom_warmwasser_kwh == 19.5
    assert res.wp_jaz_heizen == pytest.approx(4.0)
    assert res.wp_jaz_warmwasser == pytest.approx(3.0)
    assert res.wp_jaz_heizen_grund is None
    assert res.wp_jaz_warmwasser_grund is None
    assert res.wp_moeglich == [], "kein Kasten-Eintrag, wo beide Zahlen stehen"


async def test_der_kasten_widerspricht_der_tabelle_nicht_mehr(db, monkeypatch):
    """**N-503 in Reinform** — die Lage der r28 (Prüfstand, September 2026).

    Gerät B trägt Heiz- und Warmwasser-**Strom** bei und misst seine Wärme mit
    einem Gesamtzähler; damit stammen Zähler und Nenner je Funktion von
    verschiedenen Geräten (Konzept §7). Es gibt anlagenweit **keine** Zahl — aber
    der Grund ist jetzt der zutreffende, und er widerspricht der Tabelle nicht:
    Gerät A zeigt dort weiterhin seine 4,0 und 3,0.

    ⛔ **Der alte Satz ist weg.** *„Getrennte Strommessung einschalten und beide
    Zähler zuordnen"* führte an dieser Anlage ins Leere — beide Geräte tragen
    das Kennzeichen längst.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, _ = await _anlage_mit_tagesebene(db, [_A, _B])

    res = await _monat(db, anlage.id)

    assert res.wp_jaz_heizen is None and res.wp_jaz_warmwasser is None
    assert res.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
    assert res.wp_jaz_warmwasser_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
    gruende = [z.grund for z in res.wp_moeglich]
    assert GRUND_STROM_NICHT_JE_FUNKTION not in gruende
    # ⚠ **Seit WK-16j nennt der Kasten das Gerät statt des generischen Satzes**
    # (**R-5**: je Größe eine Auskunft, und es ist die konkretere). Die Substanz
    # bleibt: Beide Funktionen stehen im Kasten, mit einem Grund, den es an
    # dieser Anlage wirklich gibt — der anlagenweite Grund an der **Zahl** ist
    # unverändert ``GRUND_FUNKTION_NICHT_DECKUNGSGLEICH`` (zwei Zeilen weiter oben).
    assert gruende == [f"{_B[0]}: Wärme nicht je Funktion gemessen"]
    assert {g for z in res.wp_moeglich for g in z.groessen} == {
        "Arbeitszahl Heizen", "Arbeitszahl Warmwasser",
    }
    assert res.wp_hub_hilft is True, "der Hub zeigt jedes Gerät für sich"
    zeile_a = next(z for z in res.wp_geraete if z.name == _A[0])
    assert (zeile_a.jaz_heizen, zeile_a.jaz_warmwasser) == (4.0, 3.0)


#: Gerät E — **zwei** Achsen, ohne getrennte Strommessung, nur Warmwasser-Wärme.
#: ⚠ **Es ist seit WK-16j der Verletzer, nicht mehr die Brauchwasser-WP:** Deren
#: ganzer Strom *ist* Warmwasser-Strom (Ein-Achsen-Regel, **R-4**), sie deckt
#: sich also. Ein Gerät mit zwei Achsen hat eine Aufteilung, die fehlen kann.
_E = ("Zwei Achsen ohne Split", _LW, {
    "stromverbrauch_kwh": 2.0, "warmwasser_kwh": 8.0,
})


async def test_die_deckung_gilt_je_funktion_nicht_je_block(db, monkeypatch):
    """SOLL §3.2b: eine saubere Funktion behält ihre Zahl.

    Gerät E steuert Warmwasser-**Wärme** ohne Warmwasser-**Strom** bei — das
    trifft die Warmwasser-Zeile und **nur** sie.

    ⚠ **Hier stand bis WK-16j die Brauchwasser-WP** (``_C``). Sie war nur so
    lange ein Verletzer, wie die Faltung ihren Strom nirgends zählte: Mit **R-4**
    steht ihr Gesamtstrom als Warmwasser-Strom im Nenner, und die Deckung ist zu
    Recht erfüllt (eigene Probe in ``test_wk16j_tag_deckung.py``). Die **Substanz
    dieser Probe** — Deckung je Funktion, nicht je Block — braucht ein Gerät mit
    **zwei** Achsen, dem die Aufteilung fehlt.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, _ = await _anlage_mit_tagesebene(db, [_A, _E])

    res = await _monat(db, anlage.id)

    assert res.wp_jaz_heizen == pytest.approx(4.0), "Heizen deckt sich"
    assert res.wp_jaz_heizen_grund is None
    assert res.wp_jaz_warmwasser is None
    assert res.wp_jaz_warmwasser_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
    assert res.wp_warmwasser_kwh == 162.5, "58,5 (A) + 104,0 (E) — beide haben die Achse"
    assert res.wp_strom_heizen_kwh == 32.5, "E hat keinen Heizstrom"


async def test_die_brauchwasser_wp_deckt_sich_seit_r4(db, monkeypatch):
    """Die **Gegenprobe** dazu — und der Grund, warum ``_E`` oben eingezogen ist.

    Dieselbe Lage mit der Brauchwasser-WP: Ihr Gesamtstrom **ist** der Strom
    ihrer einzigen Achse (**WK-16j/R-4**), Zähler und Nenner meinen dieselben
    zwei Geräte. Handrechnung: (58,5 + 104,0) ÷ (19,5 + 26,0) = 162,5 ÷ 45,5
    = **3,5714**.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, _ = await _anlage_mit_tagesebene(db, [_A, _C])

    res = await _monat(db, anlage.id)

    assert res.wp_jaz_warmwasser == pytest.approx(3.5714, abs=1e-4)
    assert res.wp_jaz_warmwasser_grund is None
    assert res.wp_strom_warmwasser_kwh == 45.5, "19,5 (A) + 26,0 (C)"


async def test_die_route_summiert_nur_die_achsen_des_geraets(db, monkeypatch):
    """**R-1 anlagenweit, an der Route gemessen** (ADR-002/**P13**).

    Gerät D misst Heizwärme, obwohl es eine Brauchwasser-WP ist — die Registry
    erlaubt die **Menge** (weiche Bedingung), die **Kennzahl** nicht. Ihre
    65,0 kWh gehören deshalb in keine anlagenweite Heizwärme; sonst stünden im
    Zähler der Heiz-Arbeitszahl 195,0 kWh gegen einen Nenner, der den Strom
    dieses Geräts gar nicht trennt.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, _ = await _anlage_mit_tagesebene(db, [_A, _D])

    res = await _monat(db, anlage.id)

    assert res.wp_heizung_kwh == 130.0, "die 65,0 der Brauchwasser-WP zählen nicht"
    assert res.wp_jaz_heizen == pytest.approx(4.0)


async def test_eine_achse_die_kein_geraet_hat_traegt_weder_zahl_noch_grund(
    db, monkeypatch,
):
    """**WK-16h/R-2 erreicht den laufenden Monat.** Nur eine Brauchwasser-WP.

    Ihre einzige Achse ist *Warmwasser*; die Heiz-Zeile bleibt ohne Zahl **und**
    ohne Grund, und die Warmwasser-Zahl ist die Gesamt-Arbeitszahl — ihr ganzer
    Strom **ist** Warmwasser-Strom (13 × 8,0 = 104,0 ÷ 13 × 2,0 = 26,0 = 4,0).
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, _ = await _anlage_mit_tagesebene(db, [_C])

    res = await _monat(db, anlage.id)

    assert res.wp_jaz == pytest.approx(4.0)
    assert res.wp_jaz_warmwasser == pytest.approx(4.0)
    assert res.wp_jaz_heizen is None and res.wp_jaz_heizen_grund is None


async def test_die_gepflegte_monatszeile_gewinnt(db, monkeypatch):
    """**Vorrang unverändert** (S5): die Zeile schlägt den Rückfall.

    Sie trägt hier **andere** Zahlen als die Tagesebene — stünde am Ende die
    Tagesebene, wäre es sofort sichtbar.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, invs = await _anlage_mit_tagesebene(db, [_A])
    db.add(InvestitionMonatsdaten(
        investition_id=invs[0].id, jahr=JAHR, monat=MONAT,
        verbrauch_daten={
            "heizenergie_kwh": 200.0, "warmwasser_kwh": 100.0,
            "strom_heizen_kwh": 50.0, "strom_warmwasser_kwh": 25.0,
        },
    ))
    await db.commit()

    res = await _monat(db, anlage.id)

    assert res.wp_heizung_kwh == 200.0
    assert res.wp_strom_heizen_kwh == 50.0
    assert res.wp_jaz_heizen == pytest.approx(4.0)
    assert res.wp_jaz_warmwasser == pytest.approx(4.0)


async def test_der_rueckfall_ersetzt_die_monatszeile_nicht(db, monkeypatch):
    """Die Zeile gewinnt — **auch dort, wo der Rückfall strenger wäre**.

    Eine Brauchwasser-WP mit gepflegter Heizwärme: Die Monatszeile summiert sie
    anlagenweit mit (``heizwaerme_kwh`` kennt keinen Achsen-Filter — die
    Gegenrichtung zu N-379, das die **Warmwasser**-Seite filtert), die Faltung
    täte es nicht. Der Rückfall greift trotzdem nicht: Er ist der Rückfall,
    nicht die bessere Lesart, und ein stiller Wechsel der Lesart wäre ein
    Zahlensprung ohne Anlass.

    ⭐ **Die Lage, an der sich die beiden Herkünfte messbar unterscheiden.** Die
    Probe darüber (gepflegte Zeile mit denselben Größen) kann das nicht zeigen —
    dort sagen beide dasselbe; gemessen am Sprengsatz S4.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, invs = await _anlage_mit_tagesebene(db, [_C])
    db.add(InvestitionMonatsdaten(
        investition_id=invs[0].id, jahr=JAHR, monat=MONAT,
        verbrauch_daten={"stromverbrauch_kwh": 30.0, "heizenergie_kwh": 60.0},
    ))
    await db.commit()

    res = await _monat(db, anlage.id)

    assert res.wp_heizung_kwh == 60.0, "die Monatszeile, nicht die Faltung"
    assert res.wp_strom_kwh == 30.0


async def test_ohne_tagesspur_bleibt_es_beim_bisherigen_grund(db, monkeypatch):
    """Gegenprobe: kein Beitrag ⇒ keine Freischaltung, keine neue Behauptung.

    ⚠ **Beitrag statt Bestand** — das Kennzeichen am Gerät allein macht keinen
    Nenner. Die Auskunft bleibt wortgleich die von vorher.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage = await factories.anlage(db, anlagenname="WK-16i ohne Spur")
    db.add(Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Nibe",
        anschaffungsdatum=date(2024, 1, 1), parameter=_LW_F5,
    ))
    await db.commit()

    res = await _monat(db, anlage.id)

    assert res.wp_jaz_heizen is None
    assert res.wp_jaz_heizen_grund == GRUND_STROM_NICHT_JE_FUNKTION
    assert res.wp_jaz_warmwasser_grund == GRUND_STROM_NICHT_JE_FUNKTION


async def test_der_abgeschlossene_monat_liest_weiter_die_zeile(db, monkeypatch):
    """Der Rückfall gibt es nur im laufenden Monat — sonst wäre er eine Erfindung.

    Dieselbe Anlage, ein **vergangener** Monat: Es gibt keine Tagesebene-Abfrage
    und keine Faltung; die Antwort kommt aus der Monatszeile.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, invs = await _anlage_mit_tagesebene(db, [_A])
    db.add(InvestitionMonatsdaten(
        investition_id=invs[0].id, jahr=JAHR, monat=MONAT - 1,
        verbrauch_daten={
            "heizenergie_kwh": 300.0, "strom_heizen_kwh": 60.0,
            "warmwasser_kwh": 90.0, "strom_warmwasser_kwh": 30.0,
        },
    ))
    await db.commit()

    res = await _monat(db, anlage.id, monat=MONAT - 1)

    assert res.wp_heizung_kwh == 300.0
    assert res.wp_jaz_heizen == pytest.approx(5.0)
    assert res.wp_jaz_warmwasser == pytest.approx(3.0)
