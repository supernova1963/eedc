"""N-472: Der laufende Monat sagt, was er weiß — Rückfall, fünfte Quelle, Grund.

**Der Befund** (WK-15/F-4, zwei Messungen, ein Bild):

1. **MQTT-Weg.** ``mqtt_monats_deltas`` lieferte eine Menge nur, wenn **beide**
   Ränder existierten; der linke war der Monatserste ±5 Minuten. Wer eedc am
   14. einrichtet, sah bis zum 1. des Folgemonats leere Kacheln.
2. **Lokaler Tagesweg.** Auch mit vollständiger Tagesebene blieben die Kacheln
   leer — ``get_aktueller_monat`` kannte vier Quellen (HA-Statistik · Connector ·
   gespeicherte Zeile · MQTT), und die lokale Tagesebene war keine davon. **Der
   Verlauf daneben zeigte dieselben Tage.**
3. In beiden Lagen stand **kein Grund** neben der leeren Kachel;
   ``quellen.mqtt_inbound: false`` ist ein Implementierungsdetail, keine Auskunft.

**Was hier festgehalten wird**

* Der Rückfall greift **nur** beim fehlenden linken Rand und nennt seinen
  Zeitpunkt (``MengeSeit.seit``); Rücksprung und fehlender rechter Rand behalten
  ihr ``None`` (N-341 bleibt scharf).
* Ohne den Schalter ist das Ergebnis **bitgleich** — der
  Monatsabschluss-Vorschlag darf keinen Teilmonat als Monatsmenge anbieten (F-66).
* Die Tagesebene ist die **fünfte und schwächste** Quelle: sie füllt Lücken,
  verdrängt nie, trägt ihre eigene Marke und gilt nur im laufenden Monat.
* Bleibt eine Kachel leer, nennt sie ihren Grund (W-18-Klasse, eine Zeitebene
  höher).

⚠ **Uhr-Unabhängigkeit.** Alle Daten liegen fest in 2026, und wo der *laufende*
Monat geprüft wird, ersetzt eine ``datetime``-Subklasse mit fester ``now()`` die
Prozessuhr. Kein ``datetime.now()`` und kein ``date.today()`` im Probencode —
die Suite fährt in drei Zeitzonen (N-167).
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select

from backend.core.berechnungen.datenquellen import (
    merge_datenquellen,
    mqtt_teilzeitraum_felder,
    teilzeitraum_felder,
)
from backend.core.monatswert_grund import (
    GRUND_GROESSE_OHNE_QUELLE,
    GRUND_KEINE_QUELLE,
    monatswert_grund,
    monatswert_grund_text,
)
from backend.models import (
    Anlage,
    Investition,
    InvestitionMonatsdaten,
    Monatsdaten,
)
from backend.models.mqtt_energy_snapshot import MqttEnergySnapshot
from backend.models.tages_energie_profil import TagesEnergieProfil, TagesZusammenfassung
from backend.services.migrations.migrate_datenquellen_materialisieren import (
    materialisiere_datenquellen,
)
from backend.services.mqtt_energy_history_service import (
    mqtt_monats_deltas,
    mqtt_monats_mengen,
)
from backend.services.snapshot.keys import extract_quellen_energy
from backend.services.snapshot.writer import snapshot_anlage
from backend.tests import factories

#: Der geprüfte Monat. **Fest**, nie aus der Uhr — siehe Modul-Docstring.
JAHR, MONAT = 2026, 9
#: „Jetzt" für die Proben des laufenden Monats: der 14. um 12:00. Genau die
#: Lage des Befunds — dreizehn abgelaufene Tage, kein Monatsabschluss.
JETZT = datetime(JAHR, MONAT, 14, 12, 0, 0)
MONATSERSTER = datetime(JAHR, MONAT, 1)
#: Der Tag, an dem die Anlage eingerichtet wurde (Befund 1).
EINRICHTUNG = datetime(JAHR, MONAT, 14, 0, 0, 0)


class _FesteUhr(datetime):
    """``datetime`` mit stehengebliebener ``now()``.

    ⛔ **Keine Bequemlichkeit, sondern die einzige uhr-freie Art, den laufenden
    Monat über die echte Route zu prüfen.** ``get_aktueller_monat`` entscheidet
    an ``datetime.now()``, ob der Monat läuft; eine Probe, die dafür die echte
    Uhr liest, wettet auf den Tag ihres Laufs (N-167) und wäre am 1. Oktober
    rot. Als **Subklasse** bleibt jeder andere Gebrauch von ``datetime`` in der
    Route unverändert — ``datetime(jahr, monat, 1)`` konstruiert weiter normal.
    """

    @classmethod
    def now(cls, tz=None):  # noqa: D102 — Verhalten steht im Klassen-Docstring
        return JETZT


# ═══════════════════════════════════════════════════════════════════════════
# Teil 1 — Der MQTT-Rückfall auf den ersten Stand des Monats
# ═══════════════════════════════════════════════════════════════════════════


async def _mqtt_anlage(db, staende: dict[str, list[tuple[datetime, float]]]):
    """Standalone-Anlage, ausschließlich per MQTT — über die echten Wege.

    ``materialisiere_datenquellen`` für die ``quellen``-Ablage,
    ``MqttEnergySnapshot``-Zeilen wie der Cache-Schreiber sie anlegt, und der
    Produktions-Writer ``snapshot_anlage`` für die ``sensor_snapshots`` (Lehre
    aus N-328/W-5: wer die Zustände von Hand hinschreibt, prüft seine eigene
    Annahme).
    """
    anlage = await factories.anlage(db, anlagenname="Standalone N-472")
    await db.commit()
    await materialisiere_datenquellen(db)
    await db.commit()
    await db.refresh(anlage)

    zeitpunkte: set[datetime] = set()
    for key, reihe in staende.items():
        for ts, wert in reihe:
            db.add(MqttEnergySnapshot(
                anlage_id=anlage.id, timestamp=ts, energy_key=key, value_kwh=wert,
            ))
            zeitpunkte.add(ts)
    await db.commit()

    for ts in sorted(zeitpunkte):
        await snapshot_anlage(db, anlage, zeitpunkt=ts)
    await db.commit()
    return anlage


async def test_feeder_ab_monatsmitte_misst_seit_dem_ersten_stand(db):
    """**Der gemeldete Fall.** Eingerichtet am 14. ⇒ Menge seit dem 14., nicht nichts.

    Vor N-472 fehlte der Key im Ergebnis, und *Cockpit → Monat* blieb bis zum
    1. Oktober leer.
    """
    anlage = await _mqtt_anlage(db, {
        "netzbezug_kwh": [(EINRICHTUNG, 1000.0), (JETZT, 1042.0)],
    })

    mengen = await mqtt_monats_mengen(
        db, anlage.id, JAHR, MONAT, ["netzbezug_kwh"],
        quellen_energy=extract_quellen_energy(anlage), bis=JETZT,
        rueckfall_erster_stand=True,
    )

    menge = mengen["netzbezug_kwh"]
    assert menge.menge_kwh == 42.0
    assert menge.ab_fenster_beginn is False
    assert menge.seit == EINRICHTUNG, "der genannte Zeitpunkt ist der erste STAND"


async def test_ohne_den_schalter_bleibt_es_bei_keine_aussage(db):
    """REGRESSION F-66: Der Monatsabschluss-Vorschlag sieht den Teilmonat nicht.

    ⛔ Der Rückfall darf **nicht** zum Default werden. Eine Menge „seit dem 14."
    als *Monatsmenge* zu speichern ist genau der Datenverlust, gegen den der
    Weg über die Standreihe gebaut wurde.
    """
    anlage = await _mqtt_anlage(db, {
        "netzbezug_kwh": [(EINRICHTUNG, 1000.0), (JETZT, 1042.0)],
    })

    ohne = await mqtt_monats_deltas(
        db, anlage.id, JAHR, MONAT, ["netzbezug_kwh"],
        quellen_energy=extract_quellen_energy(anlage), bis=JETZT,
    )

    assert ohne == {}, "ohne Schalter unverändert: keine Aussage"


async def test_stand_am_monatsersten_ist_bitgleich_zu_vorher(db):
    """Mit Stand am Monatsersten ändert der Rückfall **nichts** — auch nicht das Feld.

    Beides wird geprüft: die Zahl und die Marke ``ab_fenster_beginn``. Ohne die
    zweite Hälfte wäre eine Menge, die *zufällig* stimmt, aber als Teilzeitraum
    markiert ist, nicht von einer richtigen zu unterscheiden — und der Aufrufer
    würde eine Abdeckung ausweisen, die es nicht gibt.
    """
    anlage = await _mqtt_anlage(db, {
        "netzbezug_kwh": [(MONATSERSTER, 900.0), (JETZT, 1042.0)],
    })
    args = dict(
        quellen_energy=extract_quellen_energy(anlage), bis=JETZT,
    )

    ohne = await mqtt_monats_deltas(db, anlage.id, JAHR, MONAT, ["netzbezug_kwh"], **args)
    mit = await mqtt_monats_mengen(
        db, anlage.id, JAHR, MONAT, ["netzbezug_kwh"],
        rueckfall_erster_stand=True, **args,
    )

    assert ohne == {"netzbezug_kwh": 142.0}
    assert mit["netzbezug_kwh"].menge_kwh == 142.0
    assert mit["netzbezug_kwh"].ab_fenster_beginn is True
    assert mit["netzbezug_kwh"].seit == MONATSERSTER


async def test_der_ruecksprung_bekommt_keinen_rueckfall(db):
    """⛔ N-341 bleibt scharf: ein zurückgesprungener Zähler liefert weiter nichts.

    REGRESSION. Der linke Rand ist hier **da** — das ``None`` kommt aus der
    Datenqualitäts-Entscheidung, nicht aus einem fehlenden Punkt. Ein Rückfall
    würde sie aushebeln und aus einer abgelehnten Zahl eine kleinere, ebenso
    falsche machen.

    ⚠ Diese Probe allein **misst die Nachfrage nach dem linken Rand nicht** —
    das Sprengsatz-Protokoll hat es gezeigt (S3 blieb still): Hier fängt die
    Rücksprung-Regel den Fall ein zweites Mal, weil der erste Stand im Fenster
    derselbe Punkt ist. Was sie wirklich misst, steht in der Probe darunter.
    """
    anlage = await _mqtt_anlage(db, {
        "netzbezug_kwh": [
            (MONATSERSTER, 900.0),
            (datetime(JAHR, MONAT, 7), 1200.0),
            (datetime(JAHR, MONAT, 8), 5.0),    # Reset
            (JETZT, 40.0),
        ],
    })

    mengen = await mqtt_monats_mengen(
        db, anlage.id, JAHR, MONAT, ["netzbezug_kwh"],
        quellen_energy=extract_quellen_energy(anlage), bis=JETZT,
        rueckfall_erster_stand=True,
    )

    assert mengen == {}, "Rücksprung ⇒ keine Aussage, auch nicht mit Rückfall"


async def test_ein_rand_knapp_vor_dem_monat_schliesst_den_rueckfall_aus(db):
    """⛔ **Der Fall, für den die Nachfrage nach dem linken Rand da ist** (S3b).

    Die Lage, gemessen: Der letzte Stand vor dem Monatswechsel liegt um
    **23:57** — innerhalb der ±5-Minuten-Toleranz von ``get_snapshot``, also
    **ist** der linke Rand da. Danach schweigt der Zähler eine Woche, wird am
    8. zurückgesetzt und meldet erst ab dem 9. wieder.

    * Mit der Nachfrage: der Rand steht ⇒ das ``None`` gehört dem Rücksprung.
    * Ohne sie: ``erster_stand_im_fenster`` fände den **9.** (der 23:57-Stand
      liegt vor dem Fenster), und das verkürzte Fenster enthält den Rücksprung
      nicht mehr — eedc meldete **30 kWh**, wo in Wahrheit über 140 liefen.
      Genau die N-341-Klasse, nur durch den Rückfall wieder hereingeholt.
    """
    anlage = await _mqtt_anlage(db, {
        "netzbezug_kwh": [
            (datetime(JAHR, MONAT - 1, 31, 23, 57), 900.0),
            (datetime(JAHR, MONAT, 9), 10.0),   # nach dem Reset
            (JETZT, 40.0),
        ],
    })

    mengen = await mqtt_monats_mengen(
        db, anlage.id, JAHR, MONAT, ["netzbezug_kwh"],
        quellen_energy=extract_quellen_energy(anlage), bis=JETZT,
        rueckfall_erster_stand=True,
    )

    assert mengen == {}, "30 kWh wären eine Zahl, die der Rücksprung verboten hat"


async def test_ohne_jeden_stand_im_monat_bleibt_es_leer(db):
    """Kein Stand im Fenster ⇒ nichts — der Rückfall erfindet keinen Rand."""
    anlage = await _mqtt_anlage(db, {
        "netzbezug_kwh": [(datetime(JAHR, MONAT - 1, 20), 800.0)],
    })

    mengen = await mqtt_monats_mengen(
        db, anlage.id, JAHR, MONAT, ["netzbezug_kwh"],
        quellen_energy=extract_quellen_energy(anlage), bis=JETZT,
        rueckfall_erster_stand=True,
    )

    assert mengen == {}


# ═══════════════════════════════════════════════════════════════════════════
# Teil 2 — Die Präzedenz (reine Funktionen, kein I/O)
# ═══════════════════════════════════════════════════════════════════════════


def _w(x: float) -> tuple[float, str]:
    """Ein Wert-Tupel, dessen zweites Element die Herkunft nur benennt."""
    return (x, "quelle")


def test_tagesebene_fuellt_nur_luecken():
    """Die fünfte Quelle verdrängt nie — auch nicht die schwächste vor ihr."""
    resolved = merge_datenquellen(
        saved={"netzbezug_kwh": _w(100.0)},
        connector={}, mqtt_energy={}, ha_stats={},
        ist_aktueller_monat=True,
        tagesebene={"netzbezug_kwh": _w(80.0), "pv_erzeugung_kwh": _w(265.3)},
    )

    assert resolved["netzbezug_kwh"] == _w(100.0), "gespeicherte Zeile schlägt Tagesebene"
    assert resolved["pv_erzeugung_kwh"] == _w(265.3), "die Lücke füllt sie"


def test_ohne_tagesebene_ist_der_merge_bitgleich():
    """REGRESSION: Der Default-Aufruf verhält sich exakt wie vor N-472."""
    args = dict(
        saved={"netzbezug_kwh": _w(100.0)},
        connector={"pv_erzeugung_kwh": _w(50.0)},
        mqtt_energy={}, ha_stats={"einspeisung_kwh": _w(7.0)},
        ist_aktueller_monat=True,
    )

    assert merge_datenquellen(**args) == merge_datenquellen(**args, tagesebene={})
    assert merge_datenquellen(**args) == merge_datenquellen(**args, tagesebene=None)


def test_teilzeitraum_kennt_den_mqtt_rueckfall():
    """⛔ Das ist keine Kosmetik — es entscheidet über die Aggregations-Sperre.

    Ein MQTT-Feld, dessen linker Rand der Monatserste war, ist **kein**
    Teilzeitraum; eines aus dem Rückfall schon. Ohne die Unterscheidung
    verdrängte eine beschnittene Anlagenzahl die vollständige
    Komponentensumme — die #361-Klasse, eine Quelle weiter.
    """
    mqtt = {"pv_erzeugung_kwh": _w(30.0), "netzbezug_kwh": _w(42.0)}

    teil = mqtt_teilzeitraum_felder(
        mqtt_energy=mqtt,
        mqtt_ab_monatsbeginn={"pv_erzeugung_kwh"},
    )

    assert teil == {"netzbezug_kwh"}


def test_teilzeitraum_nimmt_die_tagesebene_mit():
    """Auch sie misst nur, was aggregiert ist — und sperrt deshalb nicht."""
    teil = mqtt_teilzeitraum_felder(
        mqtt_energy={}, mqtt_ab_monatsbeginn=set(),
        tagesebene={"pv_erzeugung_kwh": _w(265.3)},
    )

    assert teil == {"pv_erzeugung_kwh"}


def test_teilzeitraum_felder_ohne_neue_argumente_ist_bitgleich():
    """REGRESSION: Der Connector-Zweig bleibt unberührt.

    ⚠ Ohne ``mqtt_ab_monatsbeginn`` hat der Aufrufer keine Auskunft gegeben —
    dann zählt **kein** MQTT-Feld als Teilzeitraum (das Verhalten von vor
    N-472), statt aus Vorsicht alle zu markieren und die Aggregation
    umzustellen.
    """
    args = dict(
        saved={},
        connector={"pv_erzeugung_kwh": _w(50.0)},
        mqtt_energy={"netzbezug_kwh": _w(42.0)},
        ha_stats={},
        ist_aktueller_monat=True,
        connector_abdeckung_von=datetime(JAHR, MONAT, 5),
        monat_start=MONATSERSTER,
    )

    assert teilzeitraum_felder(**args) == {"pv_erzeugung_kwh"}


# ═══════════════════════════════════════════════════════════════════════════
# Teil 3 — Die Route: fünfte Quelle und Grund
# ═══════════════════════════════════════════════════════════════════════════


async def _anlage_mit_tagesebene(db, tage: int = 13, ab_tag: int = 1) -> Anlage:
    """Eine Anlage, deren einzige Spur im laufenden Monat die Tagesebene ist.

    Nachgestellt nach der Prüfstand-Anlage der Demo-DB r28: PV-Modul, keine
    ``Monatsdaten``-Zeile für den laufenden Monat, dafür Tageszeilen.
    """
    anlage = await factories.anlage(db, anlagenname="N-472 Tagesebene")
    modul = Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="Süddach",
        anschaffungsdatum=date(2024, 1, 1), leistung_kwp=10.0,
    )
    db.add(modul)
    await db.flush()

    for tag in range(ab_tag, ab_tag + tage):
        datum = date(JAHR, MONAT, tag)
        db.add(TagesZusammenfassung(
            anlage_id=anlage.id, datum=datum,
            komponenten_kwh={f"pv_{modul.id}": 20.0},
        ))
        db.add(TagesEnergieProfil(
            anlage_id=anlage.id, datum=datum, stunde=12,
            pv_kw=20.0, verbrauch_kw=0.0, einspeisung_kw=15.0, netzbezug_kw=8.0,
        ))
    await db.commit()
    return anlage


async def test_tagesebene_speist_die_kacheln_des_laufenden_monats(db, monkeypatch):
    """**Befund 2.** Dreizehn aggregierte Tage — und die Kacheln zeigen sie.

    Gemessen an der echten Route. Vorher: alle vier Quellen ``false``, jede
    Kachel „—", während der Verlauf daneben dieselben Tage vollständig zeichnete.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage = await _anlage_mit_tagesebene(db)

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    assert res.quellen["tagesebene"] is True
    assert res.quellen["gespeichert"] is False, "sie ist NICHT die gespeicherte Zeile"
    assert res.pv_erzeugung_kwh == 260.0     # 13 × 20
    assert res.einspeisung_kwh == 195.0      # 13 × 15
    assert res.netzbezug_kwh == 104.0        # 13 × 8
    assert res.feld_quellen["pv_erzeugung_kwh"].quelle == "tagesebene"


async def test_die_gespeicherte_zeile_schlaegt_die_tagesebene(db, monkeypatch):
    """Präzedenz über die echte Route: was gepflegt ist, gewinnt.

    ⚠ Die PV bleibt hier aus der Tagesebene — die gespeicherte Zeile trägt sie
    nicht. Die Quelle ist **je Feld** und nicht je Zeile; genau deshalb steht
    ``tagesebene`` als eigene Marke daneben.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage = await _anlage_mit_tagesebene(db)
    db.add(Monatsdaten(
        anlage_id=anlage.id, jahr=JAHR, monat=MONAT,
        einspeisung_kwh=500.0, netzbezug_kwh=300.0,
    ))
    await db.commit()

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    assert res.einspeisung_kwh == 500.0
    assert res.netzbezug_kwh == 300.0
    assert res.pv_erzeugung_kwh == 260.0
    assert res.feld_quellen["einspeisung_kwh"].quelle == "gespeichert"
    assert res.feld_quellen["pv_erzeugung_kwh"].quelle == "tagesebene"


async def test_die_tagesebene_weist_ihre_abdeckung_aus(db, monkeypatch):
    """Beginnt die Tagesspur mitten im Monat, steht das in der Antwort (P4).

    ⭐ **Kein neues Feld** — ``abdeckung_von``/``abdeckung_bis`` der
    ``DatenquelleInfo`` sind derselbe Slot, den der Connector seit #361 für
    genau diese Aussage benutzt, und den die Provenanz-Zeile im Client bereits
    beschriftet. Der Fall dahinter ist real: ein später eingerichtetes Add-on
    oder ein Vollbackfill, der nicht bis zum Monatsersten zurückreicht.

    ⚠ Was sie **nicht** aussagen: Lückenlosigkeit dazwischen. Ein Loch in der
    Mitte (Add-on drei Tage aus) sieht man den Rändern nicht an; das meldet der
    Daten-Checker.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage = await _anlage_mit_tagesebene(db, tage=9, ab_tag=5)

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    info = res.feld_quellen["pv_erzeugung_kwh"]
    assert info.abdeckung_von == datetime(JAHR, MONAT, 5)
    assert info.abdeckung_bis == datetime(JAHR, MONAT, 14), "letzter Tag + 1"


async def test_ein_komponentenwert_ersetzt_die_tagesebene(db, monkeypatch):
    """⛔ **Die #361-Klasse, eine Quelle weiter** — über die echte Route gemessen.

    Die Tagesebene setzt ``pv_erzeugung_kwh`` als Anlagen-Gesamtwert. Ein
    Top-Level-Wert **sperrt** normalerweise die Aggregation der Komponenten
    (sonst Doppelzählung) — täte er das hier, verdrängte eine Σ über dreizehn
    Tage die **vollständige** Monatssumme des Sensors. Sie steht deshalb in
    ``teilzeitraum``, und der erste aggregierte Beitrag **ersetzt** sie
    (nicht addiert, das wäre die Doppelzählung, gegen die die Sperre existiert).
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage = await _anlage_mit_tagesebene(db)
    modul = (await db.execute(
        select(Investition).where(Investition.anlage_id == anlage.id)
    )).scalars().first()

    async def _fake_ha_stats(anlage_, j, m):
        return {
            f"inv_{modul.id}_pv_erzeugung_kwh": (
                900.0, am.DatenquelleInfo(quelle="ha_statistics", konfidenz=92),
            ),
        }

    monkeypatch.setattr(am, "_collect_ha_statistics_data", _fake_ha_stats)

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    assert res.pv_erzeugung_kwh == 900.0, "der volle Monat schlägt die dreizehn Tage"
    assert res.feld_quellen["pv_erzeugung_kwh"].quelle == "ha_statistics"
    assert res.pv_erzeugung_kwh != 1160.0, "ersetzt, nicht addiert (260 + 900)"


async def test_im_abgeschlossenen_monat_bleibt_die_tagesebene_aus(db):
    """Die Beschränkung gilt der **Kategorie**, nicht dem Aufwand.

    Im laufenden Monat *ist* eine Teilmenge der Tage die vollständige Auskunft
    über das bisher Geschehene. In einem abgeschlossenen Monat wäre dieselbe
    Teilmenge eine stille Untertreibung — dort ist die Antwort der
    Monatsabschluss, auf den der Daten-Checker ohnehin zeigt.

    ⚠ 2020 ist fest verdrahtet und damit in jeder Zeitzone vergangen; diese
    Probe braucht keine gestellte Uhr.
    """
    import backend.api.routes.aktueller_monat as am
    anlage = await factories.anlage(db, anlagenname="N-472 Vergangenheit")
    db.add(TagesZusammenfassung(
        anlage_id=anlage.id, datum=date(2020, 1, 5), komponenten_kwh={"pv_1": 20.0},
    ))
    db.add(TagesEnergieProfil(
        anlage_id=anlage.id, datum=date(2020, 1, 5), stunde=12,
        pv_kw=20.0, verbrauch_kw=0.0, einspeisung_kw=15.0, netzbezug_kw=8.0,
    ))
    await db.commit()

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=2020, monat=1, db=db)

    assert res.quellen["tagesebene"] is False
    assert res.pv_erzeugung_kwh is None


# ═══════════════════════════════════════════════════════════════════════════
# Teil 3b — Wärme/Klima aus der Tagesebene (Nachtrag A-5)
# ═══════════════════════════════════════════════════════════════════════════
#
# ⛔ **Der Anlass war genau diese Kachel.** Der Verlauf daneben zeichnete die
# Tage vollständig, die Wärme/Klima-Kacheln darüber blieben leer — und für sie
# gibt es im laufenden Monat nie eine ``InvestitionMonatsdaten``-Zeile.
#
# ⚠ **Gelesen wird aus demselben Leser wie der Verlauf**
# (``waerme_verlauf.lade_waerme_monatsmengen_je_geraet``), damit Kachel und
# Verlauf nicht zwei Zahlen für dieselbe Größe nennen (S1).


async def _wp_mit_tagesebene(db, *, tage: int = 13, strom: float = 4.0,
                             waerme: float = 15.0) -> tuple[Anlage, Investition]:
    """Eine Wärmepumpe, deren einzige Spur im laufenden Monat die Tagesebene ist."""
    from backend.models.sensor_snapshot import SensorSnapshot

    anlage = await factories.anlage(db, anlagenname="N-472 WK")
    wp = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Vaillant",
        anschaffungsdatum=date(2024, 1, 1), parameter={"wp_art": "luft_wasser"},
    )
    db.add(wp)
    await db.flush()
    # ⚠ **Die Zuordnung gehört dazu, nicht nur die Stände.** Der Bereichs-Leser
    # liest ein Feld nur, wenn es am Gerät zugeordnet ist — genau wie im Betrieb.
    # Wer die Snapshots ohne Mapping hinschreibt, prüft seine eigene Annahme
    # (dieselbe Lehre wie N-328/W-5).
    anlage.sensor_mapping = {"investitionen": {str(wp.id): {"felder": {
        "waerme_kwh": {
            "strategie": "sensor", "sensor_id": f"sensor.{wp.id}_waerme",
        },
    }}}}

    stand_waerme = 100.0
    for tag in range(1, tage + 2):   # ein Rand mehr als Tage
        datum = date(JAHR, MONAT, tag)
        if tag <= tage:
            db.add(TagesZusammenfassung(
                anlage_id=anlage.id, datum=datum,
                komponenten_kwh={f"waermepumpe_{wp.id}": strom},
            ))
        # Der Wärmemengenzähler als Standreihe — der Bereichs-Leser bildet
        # daraus die Tagesdifferenzen, wie im echten Betrieb.
        db.add(SensorSnapshot(
            anlage_id=anlage.id, sensor_key=f"inv:{wp.id}:waerme_kwh",
            zeitpunkt=datetime.combine(datum, datetime.min.time()),
            wert_kwh=stand_waerme, quelle="ha_statistics",
        ))
        stand_waerme += waerme
    await db.commit()
    return anlage, wp


async def test_die_kacheln_waerme_klima_kommen_aus_der_tagesebene(db, monkeypatch):
    """**Gernots Anlass.** Strom und Wärme stehen in den Kacheln, nicht nur im Verlauf."""
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, wp = await _wp_mit_tagesebene(db, tage=13, strom=4.0, waerme=15.0)

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    assert res.quellen["tagesebene"] is True
    assert res.wp_strom_kwh == 52.0          # 13 × 4
    assert res.wp_waerme_kwh == 195.0        # 13 × 15
    assert res.wp_jaz == 3.75                # 195 ÷ 52 — die eine Rechenstelle
    assert res.feld_quellen["wp_strom_kwh"].quelle == "tagesebene"


async def test_die_tabelle_je_geraet_steht_auch_ohne_monatszeile(db, monkeypatch):
    """Die Zahlen je Gerät kommen aus derselben Funktion wie im Hub und im Tag.

    ⛔ `lade_kennzahlen_je_geraet` liest ``InvestitionMonatsdaten`` — die es im
    laufenden Monat nicht gibt. Ohne den Rückfall auf ``mengen_aus_tageswerten``
    bliebe die Tabelle leer, während die Kachel darüber eine Zahl zeigt.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, wp = await _wp_mit_tagesebene(db, tage=13, strom=4.0, waerme=15.0)

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    (zeile,) = res.wp_geraete
    assert zeile.investition_id == wp.id
    assert zeile.strom_kwh == 52.0
    assert zeile.waerme_kwh == 195.0
    assert zeile.jaz == 3.75


async def test_eine_gepflegte_monatszeile_schlaegt_die_tagesebene_auch_bei_wp(db, monkeypatch):
    """Dieselbe Präzedenz wie oben — auch für die Tabelle je Gerät.

    ⚠ Ersetzt wird **nur, was leer ist**: Trägt das Gerät für diesen Monat
    schon eine Zeile, gewinnt sie, und die Tagesebene füllt nichts nach.
    """
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage, wp = await _wp_mit_tagesebene(db, tage=13, strom=4.0, waerme=15.0)
    db.add(InvestitionMonatsdaten(
        investition_id=wp.id, jahr=JAHR, monat=MONAT,
        verbrauch_daten={"stromverbrauch_kwh": 100.0, "waerme_kwh": 300.0},
    ))
    await db.commit()

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    assert res.wp_strom_kwh == 100.0
    assert res.wp_waerme_kwh == 300.0
    (zeile,) = res.wp_geraete
    assert zeile.strom_kwh == 100.0, "die gepflegte Zeile, nicht die Tagesebene"
    assert res.feld_quellen["wp_strom_kwh"].quelle == "gespeichert"


async def test_ohne_tagesspur_bleibt_die_waerme_leer_und_nennt_den_grund(db, monkeypatch):
    """Keine Tagesspur ⇒ wie bisher: keine Zahl, und der Grund steht daneben."""
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage = await factories.anlage(db, anlagenname="N-472 WK leer")
    db.add(Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Ohne Spur",
        anschaffungsdatum=date(2024, 1, 1),
    ))
    await db.commit()

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    assert res.quellen["tagesebene"] is False
    assert res.wp_strom_kwh is None
    assert res.wp_waerme_kwh is None
    assert res.wp_geraete == []
    assert set(res.datenlage_gruende) == {
        "pv_erzeugung_kwh", "einspeisung_kwh", "netzbezug_kwh",
    }


# ═══════════════════════════════════════════════════════════════════════════
# Teil 4 — Grund statt Leere
# ═══════════════════════════════════════════════════════════════════════════


def test_der_grund_unterscheidet_die_beiden_lagen():
    """Wer PV sieht und Netzbezug nicht, hat ein Zuordnungs-, kein Anlagenproblem."""
    assert monatswert_grund(hat_irgendeine_quelle=False) == GRUND_KEINE_QUELLE
    assert monatswert_grund(hat_irgendeine_quelle=True) == GRUND_GROESSE_OHNE_QUELLE


def test_ein_unbekannter_zustand_liefert_keinen_text():
    """⚠ Ein durchgereichter Bezeichner in der Oberfläche wäre keine Auskunft."""
    assert monatswert_grund_text(None) is None
    assert monatswert_grund_text("gibt_es_nicht") is None


def test_der_grund_nennt_auch_den_handgriff():
    """Regel 1: der Grund sagt, was IST — der Handgriff steht daneben, nicht darin."""
    text = monatswert_grund_text(GRUND_KEINE_QUELLE)

    assert text is not None
    assert "Monatsabschluss" in text
    assert "Datenquellen" in text


async def test_ohne_jede_quelle_nennt_die_kachel_ihren_grund(db):
    """**Befund 3.** Eine leere Kachel sagt, warum sie leer ist.

    ⚠ Nur die drei **Basis**-Größen tragen ihn. Autarkie und Eigenverbrauch
    entstehen aus ihnen; denselben Satz an jeder abgeleiteten Kachel zu
    wiederholen wäre die Strich-Flut, gegen die die D-Sicht gebaut ist.
    """
    import backend.api.routes.aktueller_monat as am
    anlage = await factories.anlage(db, anlagenname="N-472 leer")
    await db.commit()

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=2020, monat=1, db=db)

    assert set(res.datenlage_gruende) == {
        "pv_erzeugung_kwh", "einspeisung_kwh", "netzbezug_kwh",
    }
    assert res.datenlage_gruende["pv_erzeugung_kwh"] == monatswert_grund_text(
        GRUND_KEINE_QUELLE
    )


async def test_eine_kachel_mit_zahl_traegt_keinen_grund(db, monkeypatch):
    """Der Grund steht nur dort, wo nichts steht — sonst wäre er Rauschen."""
    import backend.api.routes.aktueller_monat as am
    monkeypatch.setattr(am, "datetime", _FesteUhr)
    anlage = await _anlage_mit_tagesebene(db)

    res = await am.get_aktueller_monat(anlage_id=anlage.id, jahr=JAHR, monat=MONAT, db=db)

    assert res.datenlage_gruende == {}
