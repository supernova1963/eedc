"""Der abgerechnete Monats-Ø erreicht ALLE Preis-Bildungsstellen (#412, 11.09.2026).

Schwesterdateien: `test_aufgeloester_monatspreis_kaskade.py` (die Kaskade
selbst), `test_cockpit_ev_ersparnis_flex_326.py` (ein Leser), `test_zeittarif_ht_nt.py`
(Stufe 3 und die „vier Bildungsstellen"-Lehre).

⛔ **Der Befund, den diese Datei festhält.** Beim Bau von #412 gemessen: Von
fünf Aufrufern der E-Mob-Preisachse sahen **drei** den gepflegten Ø nicht —
zwei HA-Export-Sensoren und das Komponenten-Dashboard. Cockpit → Übersicht und
die Aussichten nahmen ihn längst (über `f.tarif.wallbox_preis_effektiv_cent`).
**Dieselbe Größe, zwei Zahlen, je nachdem welche Sicht der Anwender öffnet.**

⚠ Es ist die **F-18-Klasse eine Ebene tiefer**: Der bestehende Wächter
`test_p8_emob_ersparnis_bekommt_die_monatspreise` prüft, **dass** ein Lookup
übergeben wird — nicht, **welcher**. Ein Aufruf mit dem falschen Lookup war für
ihn grün.

⭐ Der Layer sagt die Regel seit Langem ausdrücklich: *„Der Flex-Ø gilt für den
ganzen Zähler — auch für die Wallbox"* (`monats_fakten._lade_tarif`).
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.strompreise import monats_strompreis_lookup
from backend.models import Anlage, Strompreis
from backend.models.monatsdaten import Monatsdaten

JAHR, MONAT = 2026, 5
#: Der gepflegte Ø aus dem Monatsabschluss — bewusst weit weg von beiden
#: Tarifen, damit kein Zufall die Probe grün macht.
GEPFLEGT = 17.5
ALLGEMEIN = 34.0
WALLBOX = 28.0


async def _anlage_mit_gepflegtem_oe(db, *, mit_wallbox_tarif: bool) -> int:
    anlage = Anlage(anlagenname="Flex", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2025, 1, 1), verwendung="allgemein",
        netzbezug_arbeitspreis_cent_kwh=ALLGEMEIN, einspeiseverguetung_cent_kwh=8.0,
        vertragsart="dynamisch",
    ))
    if mit_wallbox_tarif:
        db.add(Strompreis(
            anlage_id=anlage.id, gueltig_ab=date(2025, 1, 1), verwendung="wallbox",
            netzbezug_arbeitspreis_cent_kwh=WALLBOX, einspeiseverguetung_cent_kwh=8.0,
        ))
    db.add(Monatsdaten(
        anlage_id=anlage.id, jahr=JAHR, monat=MONAT,
        netzbezug_durchschnittspreis_cent=GEPFLEGT,
    ))
    await db.flush()
    return anlage.id


@pytest.mark.asyncio
async def test_der_lookup_traegt_den_gepflegten_oe(db):
    """**Der Kern des Befundes.** Bis 11.09.2026 stand hier 34,0 statt 17,5."""
    anlage_id = await _anlage_mit_gepflegtem_oe(db, mit_wallbox_tarif=False)

    lookup = await monats_strompreis_lookup(
        db, anlage_id, "wallbox", [(JAHR, MONAT)], fallback_bezug=30.0,
    )

    assert lookup[(JAHR, MONAT)] == pytest.approx(GEPFLEGT)


@pytest.mark.asyncio
async def test_der_gepflegte_oe_schlaegt_auch_einen_eigenen_wallbox_tarif(db):
    """⚠ **Die Regel gilt dem ganzen Zähler.**

    Wer einen getrennten Wallbox-Tarif gepflegt hat UND einen abgerechneten
    Monats-Ø: Der Ø ist der Preis, der tatsächlich bezahlt wurde — der
    Wallbox-Tarif ist der Stammwert dahinter.
    """
    anlage_id = await _anlage_mit_gepflegtem_oe(db, mit_wallbox_tarif=True)

    lookup = await monats_strompreis_lookup(
        db, anlage_id, "wallbox", [(JAHR, MONAT)], fallback_bezug=30.0,
    )

    assert lookup[(JAHR, MONAT)] == pytest.approx(GEPFLEGT)


@pytest.mark.asyncio
async def test_ohne_gepflegten_oe_bleibt_der_komponenten_tarif(db):
    """Gegenprobe — der Wallbox-Tarif geht nicht verloren.

    Er ist Stufe 4 der Kaskade (`stammpreis_override`), nicht ihr Opfer. Ohne
    diese Probe hätte der Fix den Spezialtarif still durch den allgemeinen
    ersetzt: eine Reparatur, die einen zweiten Fehler einbaut.
    """
    anlage = Anlage(anlagenname="Nur Tarife", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2025, 1, 1), verwendung="allgemein",
        netzbezug_arbeitspreis_cent_kwh=ALLGEMEIN, einspeiseverguetung_cent_kwh=8.0,
    ))
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2025, 1, 1), verwendung="wallbox",
        netzbezug_arbeitspreis_cent_kwh=WALLBOX, einspeiseverguetung_cent_kwh=8.0,
    ))
    await db.flush()

    lookup = await monats_strompreis_lookup(
        db, anlage.id, "wallbox", [(JAHR, MONAT)], fallback_bezug=30.0,
    )

    assert lookup[(JAHR, MONAT)] == pytest.approx(WALLBOX), (
        "der Komponenten-Tarif ist Stufe 4, nicht ersetzt"
    )


@pytest.mark.asyncio
async def test_ohne_tarif_gilt_weiterhin_der_fallback(db):
    """Die Grenze, die vorher galt und weiter gilt."""
    anlage = Anlage(anlagenname="Ohne Tarif", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()

    lookup = await monats_strompreis_lookup(
        db, anlage.id, "wallbox", [(JAHR, MONAT)], fallback_bezug=30.0,
    )

    assert lookup[(JAHR, MONAT)] == pytest.approx(30.0)
