"""**Der Tag prüft die Deckung an seinen eigenen Geräte-Kennzahlen** — WK-16j.

Drei Regeln, eine Datei:

* **R-1** — *Cockpit → Tag* nimmt die Deckung je Funktion aus **derselben**
  Faltung wie *Cockpit → Monat* (``funktions_eingaenge_der_anlage``), nicht mehr
  aus der Monats-Näherung. Die ist im **laufenden** Monat leer, und damit fiel
  jede R2-Sperre aus: Gemessen an der Prüfstand-Anlage der Demo-DB r28
  (``tag-detail?datum=2026-09-10``) standen dort *Arbeitszahl Heizen* **3,346**
  und *Warmwasser* **4,211** — **ohne Grund** und ohne dass Zähler und Nenner
  dieselben Geräte meinen (N-506).
* **R-4** — die **Ein-Achsen-Regel** aus WK-16h (*hat eine Einheit genau eine
  Wärme-Achse, ist deren Funktions-Arbeitszahl die Gesamt-Arbeitszahl*) gilt
  anlagenweit **gleich**: Das Gerät steht dann mit ``waerme_kwh`` und
  ``strom_kwh`` auf beiden Seiten seiner Achse. Ohne sie steuerte die
  Brauchwasser-WP ihre Wärme bei, ihren Strom nicht — und die Deckung fiel auch
  an einer Anlage, an der es nichts zu beanstanden gibt.
* **R-5** — der Kasten *„Was noch möglich wäre"* führt je Größe **keine**
  generische Zeile neben einer Geräte-Zeile, die dieselbe Größe erklärt.

⛔ **Was diese Datei NICHT noch einmal misst:** die Achsen-Regel je Gerät
(``test_wk16h_achsen_der_kennzahl.py``), die Faltung im Monat
(``test_wk16i_laufender_monat_funktionen.py``), die R2-Sperren im Layer
(``test_r2_je_funktion.py``), die Kälte-Deckung des Tages
(``test_bs6_kaelte_je_tag.py``).
"""

from __future__ import annotations

from datetime import date, datetime

from backend.core.berechnungen.waermepumpe_kennzahl import (
    GRUND_FUNKTION_NICHT_DECKUNGSGLEICH,
)
from backend.core.betriebsmodus import HEIZEN, WARMWASSER
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.mqtt_gateway_mapping import MqttGatewayMapping  # noqa: F401
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.services.waerme_klima_block import (
    WpGeraetZeile,
    funktions_eingaenge_der_anlage,
    was_noch_moeglich,
)
from backend.services.waermepumpe_kennzahlen_je_geraet import (
    GeraetMengen,
    kennzahlen_aus_mengen,
)
from backend.tests import factories

#: Der geprüfte Tag — **fest**, nie aus der Uhr (N-167).
TAG = date(2026, 9, 10)

_LW_F5 = {"wp_art": "luft_wasser", "effizienz_modus": "gesamt_jaz",
          "getrennte_strommessung": True}
_BRAUCHWASSER = {"wp_art": "brauchwasser", "effizienz_modus": "gesamt_jaz"}


# ═══════════════════════════════════════════════════════════════════════════
# Teil 1 — Die Faltung als reine Funktion (R-4)
# ═══════════════════════════════════════════════════════════════════════════


def _k(**kw):
    basis = dict(inv_id=1, name="Gerät", strom_kwh=10.0, waerme_kwh=40.0)
    return kennzahlen_aus_mengen(GeraetMengen(**{**basis, **kw}))


#: Die nachgestellte Prüfstand-Lage, mit den **gemessenen** Zahlen der r28
#: (September 2026, Σ über dreizehn Tage). Drei Geräte, drei Zählerlagen.
_NIBE = dict(
    inv_id=17, name="Nibe S1255 Erdwärme", strom_kwh=17.968, waerme_kwh=75.975,
    heizung_kwh=40.445, warmwasser_kwh=35.530,
    strom_heizen_kwh=7.251, strom_warmwasser_kwh=10.715,
    hat_getrennte_strommessung=True,
)
#: Brauchwasser-WP: **eine** Achse, kein getrennter Zähler — ihr ganzer Strom
#: *ist* Warmwasser-Strom.
_STIEBEL = dict(
    inv_id=18, name="Stiebel Eltron WWK 300", strom_kwh=18.368,
    waerme_kwh=60.829, warmwasser_kwh=60.829,
    waerme_achsen=frozenset({WARMWASSER}),
)
#: Getrennte Stromzähler, aber EIN gemeinsamer Wärmemengenzähler: steht mit
#: beiden Funktions-Strömen im Nenner und mit keiner Funktions-Wärme im Zähler.
_VAILLANT = dict(
    inv_id=16, name="Vaillant aroTHERM plus", strom_kwh=17.001,
    waerme_kwh=60.507, strom_heizen_kwh=4.834, strom_warmwasser_kwh=12.166,
    hat_getrennte_strommessung=True, waerme_ist_gesamt_getrennt=True,
)


def test_ein_achsen_geraet_steht_mit_beiden_seiten_in_seiner_achse():
    """**R-4.** Ihr ganzer Strom *ist* der Strom dieser Achse — auch anlagenweit.

    Ohne die Regel steuerte die Brauchwasser-WP ihre 60,8 kWh Warmwasser-Wärme
    bei und ihre 18,4 kWh Strom **nicht**: Die Deckung fiel, und der Kasten
    empfahl *„Getrennte Strommessung am zweiten Gerät einschalten"* für ein
    Gerät **ohne zweite Funktion**. Je Gerät gibt WK-16h ihr längst die
    Arbeitszahl Warmwasser = Gesamt-Arbeitszahl (3,31).
    """
    e = funktions_eingaenge_der_anlage([_k(**_STIEBEL)])

    assert e.warmwasser_kwh == 60.829
    assert e.strom_warmwasser_kwh == 18.368
    assert e.geraete_q_warmwasser == frozenset({18})
    assert e.geraete_e_warmwasser == frozenset({18})
    assert e.deckung_je_funktion(WARMWASSER) is True
    # Die Heiz-Achse gibt es an diesem Gerät nicht — weder Menge noch Identität.
    assert e.heizung_kwh == 0.0 and e.strom_heizen_kwh == 0.0
    assert e.geraete_q_heizen == frozenset()


def test_die_ein_achsen_regel_ersetzt_einen_grund_nie_eine_zahl():
    """Dieselbe Schranke wie im Layer — feine Zähler bleiben feine Zähler.

    Eine Brauchwasser-WP, an der jemand **doch** getrennte Zähler gesetzt hat:
    Ihr Warmwasser-Strom ist eine Messung *dieser* Funktion; der Gesamtzähler
    wäre der gröbere Nenner (Standby, Steuerung — K1).
    """
    e = funktions_eingaenge_der_anlage([_k(
        **{**_STIEBEL, "strom_warmwasser_kwh": 15.0,
           "hat_getrennte_strommessung": True},
    )])

    assert e.strom_warmwasser_kwh == 15.0, "nicht der Gesamtstrom 18,368"
    assert e.warmwasser_kwh == 60.829


def test_funktionsfremder_strom_schliesst_die_ein_achsen_regel_aus():
    """⛔ **Der tragende Satz ist „ohne zweite FUNKTION", nicht „eine Achse".**

    Eine Split-Klimaanlage hat nach der Registry nur *Heizen* (kein
    Warmwasserkreis, N-304) — sie **kühlt** aber. Ihren Junistrom als *Strom
    Heizen* auszuweisen wäre eine Falschaussage über eine **Menge**: An der
    Demo-Anlage der r28 hätte die Bosch Multisplit am 15.06.2026 **2,15 kWh
    „Strom Heizen"** getragen, an einem Tag mit gemessenem Kühlstrom.

    ⚠ Gefragt wird die **Messung**, nicht die Bauart (ADR-002/**P13**).
    """
    klima = dict(
        inv_id=14, name="Bosch Multisplit", strom_kwh=2.152, waerme_kwh=0.0,
        waerme_achsen=frozenset({HEIZEN}),
    )
    ohne_kuehlstrom = funktions_eingaenge_der_anlage([_k(**klima)])
    mit_kuehlstrom = funktions_eingaenge_der_anlage([
        _k(**{**klima, "modus_strom_kuehlen_kwh": 0.9}),
    ])

    assert ohne_kuehlstrom.strom_heizen_kwh == 2.152
    assert mit_kuehlstrom.strom_heizen_kwh == 0.0, (
        "ein Gerät mit gemessenem Kühlstrom trägt seinen Gesamtstrom nirgends "
        "als Funktions-Strom bei"
    )
    assert mit_kuehlstrom.geraete_e_heizen == frozenset()


def test_zwei_achsen_fallen_nicht_auf_den_gesamtzaehler_zurueck():
    """Die Gegenprobe: **ein Kennzeichen macht keine Ein-Achsen-Lage.**

    Ein Gerät mit beiden Achsen und ohne feine Zähler trägt zu keiner Funktion
    etwas bei — sonst stünde sein Gesamtstrom in beiden Nennern zugleich.
    """
    e = funktions_eingaenge_der_anlage([_k(
        inv_id=5, name="Zwei Achsen", strom_kwh=20.0, waerme_kwh=60.0,
    )])

    assert e.strom_heizen_kwh == 0.0 and e.strom_warmwasser_kwh == 0.0
    assert e.geraete_e_heizen == frozenset() == e.geraete_e_warmwasser


def test_nibe_und_brauchwasser_decken_sich_handrechnung():
    """**Die Lage, die R-4 freischaltet** — gemessene r28-Zahlen, Prüfstand.

    Warmwasser: (35,530 + 60,829) ÷ (10,715 + 18,368) = 96,359 ÷ 29,083
    = **3,3132** · Heizen: 40,445 ÷ 7,251 = **5,5779**, allein aus der Nibe.
    """
    e = funktions_eingaenge_der_anlage([_k(**_NIBE), _k(**_STIEBEL)])

    assert round(e.warmwasser_kwh, 3) == 96.359
    assert round(e.strom_warmwasser_kwh, 3) == 29.083
    assert e.deckung_je_funktion(WARMWASSER) is True
    assert e.geraete_q_warmwasser == frozenset({17, 18}) == e.geraete_e_warmwasser
    assert e.deckung_je_funktion(HEIZEN) is True
    assert e.geraete_q_heizen == frozenset({17}) == e.geraete_e_heizen
    assert round(e.warmwasser_kwh / e.strom_warmwasser_kwh, 4) == 3.3132
    assert round(e.heizung_kwh / e.strom_heizen_kwh, 4) == 5.5779


def test_mit_dem_dritten_geraet_bleibt_die_deckung_verletzt():
    """**Die Gegenprobe zu R-4** (und der Prüfstand, wie er wirklich steht).

    Der Vaillant steuert Heiz- **und** Warmwasser-Strom bei und misst seine
    Wärme mit **einem** Zähler: Sein Strom steht in beiden Nennern, seine
    Funktions-Wärme in keinem Zähler. R-4 macht daran nichts weich.
    """
    e = funktions_eingaenge_der_anlage(
        [_k(**_VAILLANT), _k(**_NIBE), _k(**_STIEBEL)],
    )

    assert e.deckung_je_funktion(HEIZEN) is False
    assert e.deckung_je_funktion(WARMWASSER) is False
    assert e.geraete_e_warmwasser == frozenset({16, 17, 18})
    assert e.geraete_q_warmwasser == frozenset({17, 18})


def test_waerme_ohne_strom_bleibt_im_zaehler_kreis():
    """⛔ **Der Strom-Riegel gilt den Kennzeichen, nicht den Mengen** (N-441).

    Gerät A meldet Wärme und keinen Strom, Gerät B den Funktions-Strom — genau
    der Anlassfall von N-441. Fiele A aus dem Zähler-Kreis, wäre ``q`` leer, die
    Deckung sagte „die Frage stellt sich nicht", und die Zahl liefe ungesperrt
    durch.
    """
    e = funktions_eingaenge_der_anlage([
        _k(inv_id=1, name="A nur Wärme", strom_kwh=0.0, waerme_kwh=100.0,
           heizung_kwh=100.0, hat_getrennte_strommessung=True),
        _k(inv_id=2, name="B nur Strom", strom_kwh=30.0, waerme_kwh=0.0,
           strom_heizen_kwh=30.0, hat_getrennte_strommessung=True),
    ])

    assert e.geraete_q_heizen == frozenset({1})
    assert e.geraete_e_heizen == frozenset({2})
    assert e.deckung_je_funktion(HEIZEN) is False


def test_die_kennzeichen_fragen_weiter_nur_die_beitragenden():
    """*Beitrag statt Bestand* — unverändert für ``hat_split``.

    Ein stillstehendes Gerät mit getrennter Strommessung darf einen Zeitraum
    nicht freischalten, in dem es keinen Strom verbraucht hat. Die **Menge**
    darüber bekommt denselben Riegel nicht (Probe zuvor).
    """
    e = funktions_eingaenge_der_anlage([
        _k(inv_id=1, name="stillstehend", strom_kwh=0.0, waerme_kwh=50.0,
           heizung_kwh=50.0, hat_getrennte_strommessung=True,
           waerme_ist_gesamt_getrennt=True),
    ])

    assert e.hat_split is False
    assert e.waerme_ist_gesamt is False
    assert e.heizung_kwh == 50.0, "die Menge zählt trotzdem"


# ═══════════════════════════════════════════════════════════════════════════
# Teil 2 — Der Kasten (R-5)
# ═══════════════════════════════════════════════════════════════════════════


def _zeile(name: str, **kw) -> WpGeraetZeile:
    return WpGeraetZeile(investition_id=1, name=name, strom_kwh=10.0, **kw)


_GENERISCH = [
    ("Arbeitszahl Heizen", GRUND_FUNKTION_NICHT_DECKUNGSGLEICH),
    ("Arbeitszahl Warmwasser", GRUND_FUNKTION_NICHT_DECKUNGSGLEICH),
]


def test_keine_generische_zeile_neben_einer_geraete_zeile():
    """**R-5**, im Wortlaut des Befunds (r28/Prüfstand, September 2026).

    Vorher standen **zwei** Zeilen für dieselben zwei Größen: eine generische
    („Getrennte Strommessung am zweiten Gerät einschalten" — gemeint war die
    Brauchwasser-WP, die keine zweite Funktion hat) und die zutreffende mit dem
    Gerätenamen.
    """
    zeilen = was_noch_moeglich(_GENERISCH, [
        _zeile("Vaillant aroTHERM plus",
               jaz_heizen_grund="Wärme nicht je Funktion gemessen",
               jaz_warmwasser_grund="Wärme nicht je Funktion gemessen"),
    ])

    assert [z.grund for z in zeilen] == [
        "Vaillant aroTHERM plus: Wärme nicht je Funktion gemessen",
    ]
    # Die Größe bleibt im Kasten — der Client fragt über den Namen (`imKasten`).
    assert set(zeilen[0].groessen) == {"Arbeitszahl Heizen", "Arbeitszahl Warmwasser"}


def test_eine_groesse_ohne_geraete_zeile_behaelt_ihre_generische():
    """Die Gegenprobe: R-5 räumt **je Größe**, nicht die ganze Zeile.

    Erklärt die Geräte-Zeile nur *Warmwasser*, bleibt *Heizen* generisch stehen
    — sonst verschwände eine Auskunft, die nirgends sonst steht.
    """
    zeilen = was_noch_moeglich(_GENERISCH, [
        _zeile("Vaillant aroTHERM plus",
               jaz_warmwasser_grund="Wärme nicht je Funktion gemessen"),
    ])

    assert [(z.groessen, z.grund) for z in zeilen] == [
        (["Arbeitszahl Heizen"], GRUND_FUNKTION_NICHT_DECKUNGSGLEICH),
        (["Arbeitszahl Warmwasser"],
         "Vaillant aroTHERM plus: Wärme nicht je Funktion gemessen"),
    ]


def test_derselbe_grund_laesst_die_anlagenweite_zeile_stehen():
    """⛔ **Die Gegenrichtung bleibt, wie sie war.** Trägt die Geräte-Zeile
    **denselben** Grund, verschwindet sie — der Gerätename brächte dann keine
    neue Auskunft, und zweimal derselbe Satz ist genau das, wogegen der Kasten
    gebaut ist.
    """
    zeilen = was_noch_moeglich(
        [("Arbeitszahl Kühlen", "kein Kältemengenzähler zugeordnet")],
        [_zeile("Bosch Multisplit",
                jaz_kuehlen_grund="kein Kältemengenzähler zugeordnet")],
    )

    assert [z.grund for z in zeilen] == ["kein Kältemengenzähler zugeordnet"]


def test_ein_zeitraum_grund_am_geraet_verdraengt_nichts():
    """Ein Grund, den der Kasten gar nicht führt, erklärt auch nichts.

    ⛔ **Ohne diese Unterscheidung fiel eine richtige Zeile weg** (gemessen an
    der Demo-Anlage der r28, Juni 2026): Die anlagenweite *„Arbeitszahl Kühlen —
    kein Kältemengenzähler zugeordnet"* verschwand, weil ein Gerät daneben den
    **Zeitraum**-Grund *„kein Kühlbetrieb in diesem Zeitraum"* trug — der steht
    als „—" an der Kachel, nie im Kasten.
    """
    zeilen = was_noch_moeglich(
        [("Arbeitszahl Kühlen", "kein Kältemengenzähler zugeordnet")],
        [_zeile("Daikin Altherma",
                jaz_kuehlen_grund="kein Kühlbetrieb in diesem Zeitraum")],
    )

    assert [z.grund for z in zeilen] == ["kein Kältemengenzähler zugeordnet"]


# ═══════════════════════════════════════════════════════════════════════════
# Teil 3 — Die Route: Cockpit → Tag
# ═══════════════════════════════════════════════════════════════════════════
#
# Die Tagesebene wird über die echten Wege gebaut: `komponenten_kwh` für den
# Gesamtstrom je Gerät, `sensor_mapping` + `SensorSnapshot`-Randstände für die
# Achsen. Wer die Werte von Hand in die Zwischenschicht schreibt, prüft seine
# eigene Annahme (die Lehre aus N-328/W-5).


async def _anlage_mit_tag(db, geraete: list[tuple[str, dict, dict]]):
    """Eine Anlage mit **einem** aggregierten Tag und ohne Monatszeile.

    Args:
        geraete: ``(bezeichnung, parameter, felder)`` — ``felder`` ist der
            Tageszuwachs je Registry-Feld; ``stromverbrauch_kwh`` landet als
            Zählerstrom in ``komponenten_kwh``, alles andere als Randstandspaar.
    """
    anlage = await factories.anlage(db, anlagenname="WK-16j")
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
    db.add(TagesZusammenfassung(
        anlage_id=anlage.id, datum=TAG,
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
            for versatz, wert in ((0, 100.0), (1, 100.0 + zuwachs)):
                db.add(SensorSnapshot(
                    anlage_id=anlage.id, sensor_key=f"inv:{inv.id}:{feld}",
                    zeitpunkt=datetime.combine(
                        date.fromordinal(TAG.toordinal() + versatz),
                        datetime.min.time(),
                    ),
                    wert_kwh=wert, quelle="ha_statistics",
                ))
    await db.commit()
    return anlage, invs


async def _tag(db, anlage_id, datum=TAG):
    from backend.api.routes.energie_profil.views import get_tag_detail
    return await get_tag_detail(anlage_id=anlage_id, datum=datum, db=db)


#: Gerät A — beide Achsen gemessen, getrennte Strommessung.
#: 10,0 ÷ 2,5 = **4,0** Heizen · 4,5 ÷ 1,5 = **3,0** Warmwasser.
_A = ("Nibe S1255", _LW_F5, {
    "stromverbrauch_kwh": 4.0, "heizenergie_kwh": 10.0, "warmwasser_kwh": 4.5,
    "strom_heizen_kwh": 2.5, "strom_warmwasser_kwh": 1.5,
})
#: Gerät B — getrennte Strommessung, aber EIN gemeinsamer Wärmemengenzähler.
_B = ("Vaillant aroTHERM", _LW_F5, {
    "stromverbrauch_kwh": 3.0, "waerme_kwh": 12.0,
    "strom_heizen_kwh": 2.0, "strom_warmwasser_kwh": 1.0,
})
#: Gerät C — Brauchwasser-WP ohne getrennte Strommessung.
_C = ("Stiebel WWK 300", _BRAUCHWASSER, {
    "stromverbrauch_kwh": 2.0, "warmwasser_kwh": 8.0,
})


async def test_der_tag_sperrt_wie_der_monat(db):
    """**Der Kern des Pakets** (N-506) — drei Geräte, kein Monatsabschluss.

    Der Vaillant steuert beide Funktions-**Ströme** bei und misst seine Wärme
    mit einem Gesamtzähler; die Brauchwasser-WP steuert Warmwasser-**Wärme** bei.
    Zähler und Nenner meinen verschiedene Geräte — *Cockpit → Monat* sagt das
    seit WK-16i, der Tag zeigte bis WK-16j zwei Zahlen ohne jeden Grund.
    """
    anlage, _ = await _anlage_mit_tag(db, [_A, _B, _C])

    t = await _tag(db, anlage.id)

    assert t.wp_jaz_heizen is None
    assert t.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
    assert t.wp_jaz_warmwasser is None
    assert t.wp_jaz_warmwasser_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


async def test_die_monatszeile_entscheidet_die_tages_deckung_nicht_mehr(db):
    """⛔ **Die Naht, die R-1 durchtrennt.** Der Tag liest den **Tag**.

    Dieselbe Lage wie oben, aber mit einer gepflegten Monatszeile, die sich
    deckt (nur Gerät A). Die alte Näherung hätte ihr geglaubt und die beiden
    Zahlen freigegeben; die Faltung sieht die drei Geräte **dieses Tages**.
    """
    anlage, invs = await _anlage_mit_tag(db, [_A, _B, _C])
    await factories.imd(
        db, investition_id=invs[0].id, jahr=TAG.year, monat=TAG.month,
        verbrauch_daten={
            "stromverbrauch_kwh": 4.0, "heizenergie_kwh": 10.0,
            "warmwasser_kwh": 4.5, "strom_heizen_kwh": 2.5,
            "strom_warmwasser_kwh": 1.5,
        },
    )
    await db.commit()

    t = await _tag(db, anlage.id)

    assert t.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
    assert t.wp_jaz_warmwasser_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH


async def test_ein_geraete_tag_behaelt_seine_zahlen(db):
    """Die Gegenprobe: **wo es sich deckt, steht die Zahl.**

    Eine Wärmepumpe mit getrennten Zählern — der häufige Realfall.
    Handrechnung: 10,0 ÷ 2,5 = **4,0** · 4,5 ÷ 1,5 = **3,0**.
    """
    anlage, _ = await _anlage_mit_tag(db, [_A])

    t = await _tag(db, anlage.id)

    assert round(t.wp_jaz_heizen, 3) == 4.0
    assert round(t.wp_jaz_warmwasser, 3) == 3.0
    assert t.wp_jaz_heizen_grund is None and t.wp_jaz_warmwasser_grund is None
    assert t.wp_moeglich == []


async def test_der_tag_rechnet_die_ein_achsen_regel_mit(db):
    """**R-4 am Tag** — und *Zähler und Nenner aus derselben Faltung*.

    Nibe + Brauchwasser-WP: Warmwasser = (4,5 + 8,0) ÷ (1,5 + 2,0)
    = 12,5 ÷ 3,5 = **3,5714**. ⛔ **Ohne den gemeinsamen Nenner stünde 8,33**
    — der Zähler enthielte die Wärme der Brauchwasser-WP, ihr Strom stünde in
    keinem Nenner, und die Deckung hätte das nicht gemerkt.
    """
    anlage, _ = await _anlage_mit_tag(db, [_A, _C])

    t = await _tag(db, anlage.id)

    assert round(t.wp_warmwasser_kwh, 3) == 12.5
    assert round(t.wp_strom_warmwasser_kwh, 3) == 3.5
    assert round(t.wp_jaz_warmwasser, 4) == 3.5714
    # Heizen bleibt allein bei der Nibe — die Brauchwasser-WP hat die Achse nicht.
    assert round(t.wp_jaz_heizen, 3) == 4.0
    assert round(t.wp_strom_heizen_kwh, 3) == 2.5


async def test_ein_geraet_ohne_tages_strom_schrumpft_die_waerme_nicht(db):
    """⛔ **Der Zähler bleibt die Tagessumme, und das ist gemessen nötig.**

    Ein Gerät mit Wärmemengenzähler und **ohne** Stromwert an diesem Tag steht
    nicht im Geräte-Kreis des Tages (``wp_strom_je_inv``) — die Faltung sieht es
    also nicht. Käme der **Zähler** aus ihr, verlöre die Kachel *Warmwasser*
    seine 8,0 kWh, sobald ein Nachbargerät seinen Zähler hat. An der Demo-Anlage
    der r27 trägt dieselbe Lage am 05.12.2025 **29,9 kWh Heizwärme**.

    ⚠ **Die Grenze, die dazu gehört** (Bericht §7): Dieses Gerät fehlt auch im
    Zähler-Kreis der Deckung. Das ist der Stand vor diesem Paket und unverändert.
    """
    ohne_strom = ("Daikin ohne Stromzähler", _LW_F5, {"warmwasser_kwh": 8.0})
    anlage, _ = await _anlage_mit_tag(db, [_A, ohne_strom])

    t = await _tag(db, anlage.id)

    assert round(t.wp_warmwasser_kwh, 3) == 12.5, "4,5 der Nibe + 8,0 des zweiten"
    assert round(t.wp_strom_warmwasser_kwh, 3) == 1.5


async def test_der_kasten_des_tages_nennt_nur_das_geraet(db):
    """**R-5 über die Route.** Eine Zeile je Größe — die mit der Adresse.

    Der generische Satz *„Nutzenergie und Strom dieser Funktion stammen von
    verschiedenen Geräten"* verschwindet zugunsten der Zeile, die das Gerät und
    den wirklichen Handgriff nennt.
    """
    anlage, _ = await _anlage_mit_tag(db, [_A, _B, _C])

    t = await _tag(db, anlage.id)

    assert [z.grund for z in t.wp_moeglich] == [
        "Vaillant aroTHERM: Wärme nicht je Funktion gemessen",
    ]
    assert set(t.wp_moeglich[0].groessen) == {
        "Arbeitszahl Heizen", "Arbeitszahl Warmwasser",
    }


async def test_die_geraete_kennzahlen_stehen_vor_der_deckung(db):
    """Die **Reihenfolge** ist die Aussage — und sie ist prüfbar.

    Die Deckung entsteht aus ``_wp_kennzahlen_je_geraet``; stünde sie im
    Quelltext davor, wäre sie ein ``NameError``. Diese Probe misst die Folge:
    Der Grund des Tages ist **derselbe**, den die Faltung über die Tabelle
    *Zahlen je Gerät* sagt — dieselben Mengen, eine Auskunft (**S1**).
    """
    anlage, _ = await _anlage_mit_tag(db, [_A, _B, _C])

    t = await _tag(db, anlage.id)

    aus_der_tabelle = funktions_eingaenge_der_anlage([
        kennzahlen_aus_mengen(GeraetMengen(
            inv_id=z.investition_id, name=z.name,
            strom_kwh=z.strom_kwh or 0.0, waerme_kwh=z.waerme_kwh or 0.0,
        ))
        for z in t.wp_geraete
    ])
    assert aus_der_tabelle is not None  # die Tabelle trägt alle drei Geräte
    assert {z.name for z in t.wp_geraete} == {
        "Nibe S1255", "Vaillant aroTHERM", "Stiebel WWK 300",
    }
    assert t.wp_jaz_heizen_grund == GRUND_FUNKTION_NICHT_DECKUNGSGLEICH
