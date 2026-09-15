"""A6 — der Monats-Ø der Performance Ratio nennt seine Grundgesamtheit (N-365).

Die Kachel *Performance Ratio* in Cockpit → Monat sagte „Ø der täglichen
Performance Ratio", ohne zu sagen, über wie viele Tage gemittelt wurde. Ein Ø
ohne Grundgesamtheit ist genau die Auskunft, die A6 verlangt.

⛔ **Der Nenner ist `len(pr_werte)` und NICHT `tage_mit_daten`.** Das sind zwei
verschiedene Mengen: `tage_mit_daten` zählt jeden Tag mit irgendeiner
Stundenzeile, die Performance Ratio gibt es nur an Tagen mit
Einstrahlungsdaten. Wer den bequemeren Nenner nähme, schriebe neben den Ø eine
Zahl, mit der er nie gerechnet hat — die `fa270c6f`-Klasse.

Die dritte Probe unten ist der eigentliche Gegenstand: sie baut einen Monat, in
dem die beiden Zahlen auseinanderfallen.

Schwesterdateien: ``test_a6_eingesetzte_werte.py`` (die drei T-Konto-Felder
desselben Pakets) und ``test_energie_profil_rollup_kette.py`` (dieselbe
Tag→Monat-Kette, andere Größen).
"""

from __future__ import annotations

from datetime import date

from backend.api.routes.energie_profil.views import get_monatsauswertung
from backend.models.tages_energie_profil import (
    TagesEnergieProfil,
    TagesZusammenfassung,
)
from backend.tests.factories import anlage

JAHR, MONAT = 2025, 6


async def _tag(db, anlage_id: int, tag: int, *, pr: float | None):
    """Ein Tag mit einer Stundenzeile (⇒ zählt in `tage_mit_daten`) und
    optionaler Performance Ratio (⇒ zählt nur dann in den Ø)."""
    d = date(JAHR, MONAT, tag)
    db.add(TagesEnergieProfil(anlage_id=anlage_id, datum=d, stunde=12,
                              pv_kw=3.0, verbrauch_kw=1.0))
    db.add(TagesZusammenfassung(anlage_id=anlage_id, datum=d, performance_ratio=pr))
    await db.flush()


async def test_der_o_nennt_die_zahl_seiner_tage(db):
    a = await anlage(db)
    for tag, pr in ((1, 0.80), (2, 0.82), (3, 0.90)):
        await _tag(db, a.id, tag, pr=pr)
    await db.commit()

    res = await get_monatsauswertung(anlage_id=a.id, jahr=JAHR, monat=MONAT, top_n=10, db=db)
    assert res.performance_ratio_avg == 0.84   # (0,80 + 0,82 + 0,90) / 3
    assert res.performance_ratio_tage == 3


async def test_ohne_einstrahlungsdaten_bleibt_beides_leer(db):
    """Zweite Regelhälfte: keine Zahl, keine Grundgesamtheit — statt einer 0,
    die wie „an null Tagen gemessen" neben einem fehlenden Ø stünde."""
    a = await anlage(db)
    await _tag(db, a.id, 1, pr=None)
    await db.commit()

    res = await get_monatsauswertung(anlage_id=a.id, jahr=JAHR, monat=MONAT, top_n=10, db=db)
    assert res.performance_ratio_avg is None
    assert res.performance_ratio_tage is None


async def test_die_tage_sind_NICHT_tage_mit_daten(db):
    """⭐ Der eigentliche Gegenstand.

    Fünf Tage mit Stundenwerten, aber nur zwei mit Performance Ratio. Wer
    `tage_mit_daten` als Nenner nähme, schriebe „Ø aus 5 Tagen" neben einen Ø,
    der aus zweien entstanden ist.
    """
    a = await anlage(db)
    for tag, pr in ((1, 0.80), (2, None), (3, 0.90), (4, None), (5, None)):
        await _tag(db, a.id, tag, pr=pr)
    await db.commit()

    res = await get_monatsauswertung(anlage_id=a.id, jahr=JAHR, monat=MONAT, top_n=10, db=db)
    assert res.tage_mit_daten == 5
    assert res.performance_ratio_tage == 2
    assert res.performance_ratio_avg == 0.85
