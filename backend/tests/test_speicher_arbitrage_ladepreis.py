"""Der Arbitrage-Gewinn erfindet keinen Spread aus dem Bezugspreis (F3).

**Der Befund** (17.09.2026, Gegenprüfung): Das Speicher-Dashboard fiel für den
**Ladepreis** auf ``Monatsdaten.netzbezug_durchschnittspreis_cent`` zurück — den
Monats-Ø des **Bezugs**. Die Gegenseite derselben Rechnung
(``eff_strompreis_cent``) ist ein Mittel derselben Monatszahlen, nur anders
gewichtet. Der ausgewiesene „Arbitrage-Gewinn" war damit die Differenz zweier
Gewichtungen **einer** Zahl: Rauschen, durch ``max(0, …)`` einseitig auf die
positive Seite geklemmt — ein Phantom, kommentarlos als Gewinn ausgewiesen.

⚠ **Kein Test hat diesen Pfad je betreten** (gemessen bei der Gegenprüfung): Die
vorhandenen Speicher-Proben seedeten stets einen IMD-Ladepreis und nahmen damit
die Stufe davor. Diese Datei schließt die Lücke.

Schwesterdateien: ``test_speicher_wirtschaftlichkeit_netzanteil.py`` (die
Layer-Formel), ``test_speicher_kanon_symmetrie.py`` (Hub gegen T-Konto),
``test_speicher_dyn_tarif_und_soc.py`` (der slot-scharfe Ladepreis-Helper).

Regeln: SOLL Flex-Tarife **P-1** (eine Abrechnung gilt für die Größe, für die
sie ausgestellt ist — eine Bezugsabrechnung sagt nichts über eine
Speicherladung), **P-8** (null und negative Preise sind Werte) und **[A-2]**
(Entscheid Gernot: beim Ladepreis schlägt die Messung den gepflegten Wert).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.investitionen.dashboards import get_speicher_dashboard
from backend.models import Anlage, Investition, Monatsdaten, Strompreis
from backend.models.investition import InvestitionMonatsdaten

JAHR, MONAT = 2026, 5
BEZUG_CENT = 30.0
EINSPEISE_CENT = 8.0
KAPAZITAET = 10.0
LADUNG, ENTLADUNG = 500.0, 400.0


async def _anlage(
    db, *, netzladung: float, ladepreis: float | None = None,
    abgerechneter_bezug_oe: float | None = None,
) -> int:
    anlage = Anlage(anlagenname="ArbitrageLadepreis", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2024, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=BEZUG_CENT,
        einspeiseverguetung_cent_kwh=EINSPEISE_CENT,
    ))
    db.add(Monatsdaten(
        anlage_id=anlage.id, jahr=JAHR, monat=MONAT,
        einspeisung_kwh=300.0, netzbezug_kwh=200.0,
        netzbezug_durchschnittspreis_cent=abgerechneter_bezug_oe,
    ))
    speicher = Investition(
        anlage_id=anlage.id, typ="speicher", bezeichnung="Akku",
        anschaffungsdatum=date(2024, 1, 1), anschaffungskosten_gesamt=8000.0,
        parameter={"kapazitaet_kwh": KAPAZITAET},
    )
    db.add(speicher)
    await db.flush()
    vd: dict = {
        "ladung_kwh": LADUNG, "entladung_kwh": ENTLADUNG,
        "ladung_netz_kwh": netzladung,
    }
    if ladepreis is not None:
        vd["speicher_ladepreis_cent"] = ladepreis
    db.add(InvestitionMonatsdaten(
        investition_id=speicher.id, jahr=JAHR, monat=MONAT, verbrauch_daten=vd,
    ))
    await db.commit()
    return anlage.id


async def _anlage_zwei_monate(db) -> int:
    """Zwei Monate mit gegenläufiger Gewichtung — s. Docstring der Probe unten.

    Teurer Monat mit viel Bezug und ohne Ladung, billiger Monat mit wenig Bezug
    und aller Ladung: Nur so weichen bezugsgewichteter und ladungsgewichteter Ø
    voneinander ab.
    """
    anlage = Anlage(anlagenname="ArbitrageZweiMonate", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2024, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=BEZUG_CENT,
        einspeiseverguetung_cent_kwh=EINSPEISE_CENT,
    ))
    db.add(Monatsdaten(
        anlage_id=anlage.id, jahr=JAHR, monat=5,
        einspeisung_kwh=300.0, netzbezug_kwh=1000.0,
        netzbezug_durchschnittspreis_cent=40.0,
    ))
    db.add(Monatsdaten(
        anlage_id=anlage.id, jahr=JAHR, monat=6,
        einspeisung_kwh=300.0, netzbezug_kwh=100.0,
        netzbezug_durchschnittspreis_cent=10.0,
    ))
    speicher = Investition(
        anlage_id=anlage.id, typ="speicher", bezeichnung="Akku",
        anschaffungsdatum=date(2024, 1, 1), anschaffungskosten_gesamt=8000.0,
        parameter={"kapazitaet_kwh": KAPAZITAET},
    )
    db.add(speicher)
    await db.flush()
    db.add(InvestitionMonatsdaten(
        investition_id=speicher.id, jahr=JAHR, monat=5,
        verbrauch_daten={"ladung_kwh": 250.0, "entladung_kwh": 200.0},
    ))
    db.add(InvestitionMonatsdaten(
        investition_id=speicher.id, jahr=JAHR, monat=6,
        verbrauch_daten={
            "ladung_kwh": 250.0, "entladung_kwh": 200.0,
            "ladung_netz_kwh": 500.0,
        },
    ))
    await db.commit()
    return anlage.id


async def _gewinn(db, anlage_id: int) -> float:
    dashboards = await get_speicher_dashboard(anlage_id=anlage_id, db=db)
    return dashboards[0].zusammenfassung["arbitrage_gewinn_euro"]


@pytest.mark.asyncio
async def test_ohne_ladepreis_gibt_es_keinen_arbitrage_gewinn(db):
    """Netzladung ohne jede Preisangabe ⇒ kostenneutrale Durchleitung.

    Die dokumentierte Semantik des Layers: Ohne Ladepreis wird er dem
    Bezugspreis gleichgesetzt, der Spread ist 0.
    """
    aid = await _anlage(db, netzladung=100.0)

    assert await _gewinn(db, aid) == pytest.approx(0.0, abs=0.01)


@pytest.mark.asyncio
async def test_abgerechneter_bezugs_oe_erzeugt_keinen_phantom_gewinn(db):
    """⭐ **Der Kern dieser Datei.** Ein gepflegter Bezugs-Ø ist kein Ladepreis.

    ⚠ **Dieser Fall braucht ZWEI Monate, und das ist der Punkt.** Der erste
    Entwurf dieser Probe hatte nur einen — und blieb bei scharfem Sprengsatz
    **grün**: Mit einem Monat sind ladungsgewichteter und bezugsgewichteter Ø
    dieselbe Zahl, der Spread ist null, und die Probe hätte den Rückfall nie
    gefangen. *Ein Prüfer, der den Defekt nicht auslösen kann, prüft nichts.*

    Die Konstellation, die ihn auslöst:

    * **Mai** — teurer Bezug (40 ct), viel Netzbezug (1.000 kWh), keine Ladung
    * **Juni** — billiger Bezug (10 ct), wenig Netzbezug (100 kWh), 500 kWh Ladung

    Die Bezugsseite mittelt über den **Netzbezug** zu 37,3 ct, der Rückfall
    mittelte den Ladepreis über die **Netzladung** zu 10 ct. Aus derselben
    Zahlenmenge entstanden so zwei sehr verschiedene Preise — und ihre Differenz
    stand als „Arbitrage-Gewinn" in der Kachel, obwohl über den Ladepreis nichts
    bekannt ist.

    Erwartung: **0 €.** eedc weiß nicht, was die Ladung gekostet hat, und
    erfindet es nicht.
    """
    aid = await _anlage_zwei_monate(db)

    assert await _gewinn(db, aid) == pytest.approx(0.0, abs=0.01)


@pytest.mark.asyncio
async def test_gepflegter_ladepreis_wirkt_weiterhin(db):
    """Die Gegenrichtung: Ein echter Ladepreis ergibt einen echten Gewinn.

    Ohne diese Probe könnte die Regel oben auch dadurch „erfüllt" sein, dass
    der Arbitrage-Gewinn gar nicht mehr entsteht.

    ⚠ η wird hier **aus den Daten ermittelt**, nicht vom Default genommen:
    Entladung ÷ Ladung = 400 ÷ 500 = 80 %. Von 100 kWh Netzladung sind also
    80 kWh nutzbar, bezahlt wurden 100.
    """
    aid = await _anlage(db, netzladung=100.0, ladepreis=10.0)

    eta = ENTLADUNG / LADUNG
    erwartet = (100.0 * eta * BEZUG_CENT - 100.0 * 10.0) / 100
    assert await _gewinn(db, aid) == pytest.approx(erwartet, abs=0.2)


@pytest.mark.asyncio
async def test_ladepreis_null_ist_ein_wert_und_kein_fehlender_preis(db):
    """P-8: Zu 0 ct geladen ist der **beste** Arbitrage-Fall, nicht „kein Preis".

    Die alte Prüfung ``if preis > 0`` warf genau diesen Monat aus der
    Gewichtung — bei dynamischen Tarifen ist er Alltag.
    """
    aid = await _anlage(db, netzladung=100.0, ladepreis=0.0)

    eta = ENTLADUNG / LADUNG
    erwartet = (100.0 * eta * BEZUG_CENT - 100.0 * 0.0) / 100
    assert await _gewinn(db, aid) == pytest.approx(erwartet, abs=0.2)
