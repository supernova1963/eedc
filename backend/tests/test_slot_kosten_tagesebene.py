"""Die Tagesebene rechnet mit ihren eigenen Slot-Preisen (SOLL Flex-Tarife, F2).

**Der Entscheid dahinter** (Gernot, 17.09.2026): *„Tage bleiben Messung, Monat
bleibt Abrechnung."* Bis dahin bekam jeder Tag eines Monats denselben Preis —
den Monatswert —, obwohl eedc die Stundenpreise mitschreibt. Gemeldet hat es
OB73-gif als Folgemeldung zu #412: *„die dynamischen Preise sind jeden Tag im
Sept. gleich. Sollten die nicht den Tagesschnitt anzeigen?"*

Geprüft wird hier der SoT ``strompreis_aggregator.lade_slot_kosten_je_tag``
und damit die Regeln **P-2** (unterhalb des abgerechneten Zeitraums gilt die
Messung), **P-4** (nie nach unten interpolieren), **P-8** (null und negative
Preise sind Werte), **A-1/A-3** (mengengewichtet; Kosten sind die Summe der
Slot-Kosten) und **§10 Prüfstein 2** (bei Festpreis bewegt sich keine Zahl).

Schwesterdateien: ``test_tage_werte_symmetrie.py`` (die Tageszeile als Ganzes),
``test_aufgeloester_monatspreis_kaskade.py`` (dieselbe Frage eine Ebene höher).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.models import Anlage, Strompreis
from backend.models.tages_energie_profil import TagesEnergieProfil
from backend.services.strompreis_aggregator import lade_slot_kosten_je_tag

TAG = date(2026, 5, 10)


async def _anlage(db, *, arbeitspreis: float = 30.0) -> tuple[int, Strompreis]:
    anlage = Anlage(anlagenname="SlotKosten", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    tarif = Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2024, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=arbeitspreis,
        einspeiseverguetung_cent_kwh=8.0,
    )
    db.add(tarif)
    await db.flush()
    # ⚠ Die Zeitfenster **vorab** laden. `preis_je_slot` liest sie, und ein
    # Lazy-Load mitten in der Slot-Schleife wäre unter async ein
    # `MissingGreenlet` (beim Schreiben dieser Datei genau so passiert). Der
    # Produktivpfad hat das Problem nicht: `lade_tarife_je_stichtag` holt die
    # Fenster mit. Die Zeile hier hält die Anforderung an den Aufrufer fest.
    await db.refresh(tarif, ["zeitfenster"])
    return anlage.id, tarif


def _stunde(aid: int, h: int, netzbezug, preis=None):
    return TagesEnergieProfil(
        anlage_id=aid, datum=TAG, stunde=h,
        netzbezug_kw=netzbezug, strompreis_cent=preis,
    )


async def _lade(db, aid, tarif, *, abgerechnet=None):
    return (await lade_slot_kosten_je_tag(
        db, aid, von=TAG, bis=TAG,
        tarif_fuer=lambda _t: tarif,
        abgerechnet_fuer=(lambda _t: abgerechnet) if abgerechnet is not None else None,
    )).get(TAG)


@pytest.mark.asyncio
async def test_gemessene_slotpreise_schlagen_den_tarif(db):
    """Der Kern des Entscheids: liegt eine Messung vor, gilt sie.

    Zwei Stunden, zwei sehr verschiedene Preise — der Tages-Ø liegt dazwischen
    und ist **mengengewichtet**, nicht das arithmetische Mittel der beiden
    Preise (A-1).
    """
    aid, tarif = await _anlage(db)
    # 1 kWh zu 10 ct, 3 kWh zu 50 ct ⇒ 1,60 € und Ø 40 ct.
    # Das arithmetische Mittel wäre 30 ct — also zufällig genau der Tarif.
    db.add_all([_stunde(aid, 2, 1.0, 10.0), _stunde(aid, 19, 3.0, 50.0)])
    await db.flush()

    sk = await _lade(db, aid, tarif)

    assert sk.kosten_euro == pytest.approx(1.60)
    assert sk.mittel_cent == pytest.approx(40.0)
    assert sk.herkunft == "gemessen"


@pytest.mark.asyncio
async def test_festpreis_bewegt_keine_zahl(db):
    """§10 Prüfstein 2 — die Regression.

    Ohne Mitschrift leitet der Helper den Slot-Preis aus dem Vertrag ab (T-1).
    Σ(Menge_s × Arbeitspreis) muss **exakt** Tagesmenge × Arbeitspreis sein,
    sonst hätte dieser Bau einem Festpreis-Anwender die Zahlen verschoben.
    """
    aid, tarif = await _anlage(db, arbeitspreis=29.53)
    db.add_all([_stunde(aid, 7, 1.5), _stunde(aid, 8, 2.5), _stunde(aid, 20, 2.0)])
    await db.flush()

    sk = await _lade(db, aid, tarif)

    assert sk.kosten_euro == pytest.approx(6.0 * 29.53 / 100)
    assert sk.mittel_cent == pytest.approx(29.53)
    assert sk.herkunft == "vertrag"


@pytest.mark.asyncio
async def test_abgerechneter_monats_oe_schlaegt_den_stammpreis(db):
    """Stufe 2 der Kaskade — sie hat sich eine rote Probe erkämpft.

    Ohne Mitschrift, aber mit abgerechnetem Ø: Der Tag darf **nicht** den
    Stammpreis nennen, während der Monat mit dem abgerechneten Ø rechnet. Das
    hält seit dem 30.07.2026 ``test_tage_werte_symmetrie.py`` fest (Forum
    simon42 #89667/60) — beim Bau von F2 ist die Probe rot geworden und hatte
    recht.

    ⚠ Die Herkunft sagt ``abgerechnet``, nicht ``gemessen``: Der Wert ist über
    den Monat **verteilt**, nicht in diesem Slot gemessen.
    """
    aid, tarif = await _anlage(db, arbeitspreis=30.0)
    db.add_all([_stunde(aid, 7, 2.0), _stunde(aid, 20, 4.0)])
    await db.flush()

    sk = await _lade(db, aid, tarif, abgerechnet=18.0)

    assert sk.mittel_cent == pytest.approx(18.0)
    assert sk.kosten_euro == pytest.approx(6.0 * 18.0 / 100)
    assert sk.herkunft == "abgerechnet"


@pytest.mark.asyncio
async def test_gemessene_stunde_schlaegt_auch_den_abgerechneten_oe(db):
    """P-2 gilt auch gegen die Abrechnung — sie ist eine Monats-, keine Slot-Aussage.

    Eine Stunde misst 50 ct, die andere hat keinen Preis und fällt auf den
    abgerechneten Ø (18 ct). Herkunft ``gemischt``, und der Ø liegt dazwischen.
    """
    aid, tarif = await _anlage(db)
    db.add_all([_stunde(aid, 19, 2.0, 50.0), _stunde(aid, 20, 2.0)])
    await db.flush()

    sk = await _lade(db, aid, tarif, abgerechnet=18.0)

    assert sk.kosten_euro == pytest.approx((2.0 * 50.0 + 2.0 * 18.0) / 100)
    assert sk.herkunft == "gemischt"
    assert sk.menge_gemessen_kwh == pytest.approx(2.0)


@pytest.mark.asyncio
async def test_negativer_preis_ist_ein_wert(db):
    """P-8: Eine Kaskade prüft „vorhanden", nie „größer null".

    Bei dynamischen Tarifen sind Negativstunden Alltag. Würde die Stunde
    verworfen, bekäme sie den Tarifpreis — also **zu viel** Kosten ausgerechnet
    dort, wo der Anwender Geld bekommen hat.
    """
    aid, tarif = await _anlage(db)
    db.add_all([_stunde(aid, 3, 4.0, -5.0), _stunde(aid, 19, 1.0, 40.0)])
    await db.flush()

    sk = await _lade(db, aid, tarif)

    # 4 kWh × (−5 ct) + 1 kWh × 40 ct = −20 + 40 = 20 ct
    assert sk.kosten_euro == pytest.approx(0.20)
    assert sk.herkunft == "gemessen"
    # Eine 0 ist ebenso ein Wert — sie darf die Stunde nicht unbewertet lassen.
    assert sk.menge_bewertet_kwh == pytest.approx(5.0)


@pytest.mark.asyncio
async def test_ohne_tarif_und_ohne_messung_bleibt_die_menge_unbewertet(db):
    """P-4/P-6: „kein Wert" ist ein zulässiges Ergebnis, keine 0.

    Die Menge steht trotzdem in ``menge_gesamt_kwh`` — die Abdeckung sagt, wie
    viel davon bewertet ist (**A-1**: Anteil der MENGE, nicht der Slots).
    """
    aid, _tarif = await _anlage(db)
    db.add_all([_stunde(aid, 7, 3.0), _stunde(aid, 19, 1.0, 40.0)])
    await db.flush()

    sk = (await lade_slot_kosten_je_tag(
        db, aid, von=TAG, bis=TAG, tarif_fuer=lambda _t: None,
    )).get(TAG)

    assert sk.kosten_euro == pytest.approx(0.40)
    assert sk.menge_bewertet_kwh == pytest.approx(1.0)
    assert sk.menge_gesamt_kwh == pytest.approx(4.0)
    assert sk.abdeckung_menge == pytest.approx(0.25)


@pytest.mark.asyncio
async def test_abdeckung_zaehlt_menge_und_nicht_stunden(db):
    """A-1: „68 % der Stunden" sagt weniger als „68 % des Bezugs".

    Eine von zwei Stunden trägt einen Preis — nach Slots wären das 50 %. Weil
    die teure, verbrauchsstarke Stunde die ungemessene ist, sind es nach Menge
    nur 10 %. Genau diese Zahl gehört neben den Wert.
    """
    aid, _tarif = await _anlage(db)
    db.add_all([_stunde(aid, 3, 1.0, 20.0), _stunde(aid, 19, 9.0)])
    await db.flush()

    sk = (await lade_slot_kosten_je_tag(
        db, aid, von=TAG, bis=TAG, tarif_fuer=lambda _t: None,
    )).get(TAG)

    assert sk.abdeckung_menge == pytest.approx(0.10)


@pytest.mark.asyncio
async def test_negativer_netzbezug_wird_geklemmt(db):
    """Ein Zähler-Glitch darf die Kosten nicht senken.

    Dieselbe Behandlung wie im Monats-Aggregat — beide Ebenen müssen dieselbe
    Menge sehen, sonst driften Tag und Monat auseinander.
    """
    aid, tarif = await _anlage(db)
    db.add_all([_stunde(aid, 7, -5.0, 30.0), _stunde(aid, 19, 2.0, 30.0)])
    await db.flush()

    sk = await _lade(db, aid, tarif)

    assert sk.kosten_euro == pytest.approx(2.0 * 30.0 / 100)
    assert sk.menge_gesamt_kwh == pytest.approx(2.0)
