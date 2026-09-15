"""Das Feld „Ø Strompreis" richtet sich nach dem Tarif DES MONATS.

`netzbezug_durchschnittspreis_cent` trägt den abgerechneten Monats-Ø eines
dynamischen Tarifs und schlägt später den Stammdaten-Arbeitspreis
(`resolve_netzbezug_preis_cent`). Angeboten wird das Feld nur bei
`vertragsart == "dynamisch"` (`BEDINGTE_BASIS_FELDER`, Bedingung
`dynamischer_tarif`).

Bis 2026-07-30 entschied darüber der HEUTE gültige Tarif: Wer von dynamisch auf
Festpreis wechselte, kam an den Ø eines Altmonats nicht mehr heran — und
umgekehrt erschien das Feld für alte Festpreis-Monate (Forum simon42
#89667/60).

⭐ **Seit 11.09.2026 (#412, OB73-gif) schalten auch GEMESSENE STUNDENPREISE
DIESES MONATS das Feld frei.** Wo eedc den Bezugspreis aus mitgeschriebenen
Stundenpreisen bildet, muss der Anwender seinen **abgerechneten** Ø danebenstellen
können.

⛔ **Zwischenzeitlich stand hier „ein zugeordneter Strompreis-Sensor genügt".
Das war falsch und ist am selben Tag zurückgenommen worden.** Der
Zuordnungs-Slot für diesen Sensor ist selbst nur bei `vertragsart ==
"dynamisch"` sichtbar (`datenquellen.py`, Forum #89667/54) — der Zustand
„Sensor ohne dynamische Vertragsart" entsteht also fast nur nach einem
**Tarifwechsel**, und die Sensor-Bedingung war **stichtagslos**: Sie hätte das
Feld danach in jedem Monat gezeigt, auch in reinen Festpreis-Monaten.
`test_nach_tarifwechsel_*` hält genau das fest.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.monatsabschluss.views import get_monatsabschluss
from backend.models import Anlage, Strompreis
from backend.models.tages_energie_profil import TagesEnergieProfil

FELD = "netzbezug_durchschnittspreis_cent"


async def _anlage_mit_tarifwechsel(db) -> int:
    """Dynamisch bis Ende 2025, danach Festpreis."""
    anlage = Anlage(anlagenname="Tarifwechsel", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id,
        gueltig_ab=date(2024, 1, 1), gueltig_bis=date(2025, 12, 31),
        netzbezug_arbeitspreis_cent_kwh=25.0, einspeiseverguetung_cent_kwh=8.0,
        vertragsart="dynamisch",
    ))
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2026, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=30.0, einspeiseverguetung_cent_kwh=8.0,
        vertragsart="sondervertrag",
    ))
    await db.flush()
    return anlage.id


def _feld_namen(antwort) -> set[str]:
    return {f.feld for f in antwort.basis_felder}


@pytest.mark.asyncio
async def test_alter_dyn_monat_bietet_das_feld_weiterhin_an(db):
    anlage_id = await _anlage_mit_tarifwechsel(db)

    antwort = await get_monatsabschluss(anlage_id=anlage_id, jahr=2025, monat=6, db=db)

    assert FELD in _feld_namen(antwort)


@pytest.mark.asyncio
async def test_festpreis_monat_bietet_das_feld_nicht_an(db):
    """Gegenprobe — sonst stünde in jedem Festpreis-Monat ein Feld, das dort
    nichts bewirken soll."""
    anlage_id = await _anlage_mit_tarifwechsel(db)

    antwort = await get_monatsabschluss(anlage_id=anlage_id, jahr=2026, monat=3, db=db)

    assert FELD not in _feld_namen(antwort)


async def _anlage_mit_stundenpreisen(db, *, monat_mit_preisen: int) -> int:
    """Festpreis-Tarif, aber eedc hat für EINEN Monat Stundenpreise mitgeschrieben.

    ⚠ Die Preise werden als `TagesEnergieProfil`-Zeilen angelegt — den Weg, auf
    dem sie produktiv entstehen (`aggregator._get_strompreis_stunden`). Eine
    Fixture, die stattdessen nur ein Mapping setzt, stellt einen Zustand her,
    den die Oberfläche nicht erzeugt.
    """
    anlage = Anlage(anlagenname="Stundenpreise", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2025, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=30.0, einspeiseverguetung_cent_kwh=8.0,
        # vertragsart bewusst NICHT gesetzt — leer ist der Normalfall.
    ))
    for stunde in range(24):
        db.add(TagesEnergieProfil(
            anlage_id=anlage.id, datum=date(2025, monat_mit_preisen, 1),
            stunde=stunde, strompreis_cent=22.0, netzbezug_kw=1.0,
        ))
    await db.flush()
    return anlage.id


@pytest.mark.asyncio
async def test_gemessene_stundenpreise_schalten_das_feld_frei(db):
    """#412: **ohne diesen Weg gibt es für den Anwender gar keinen.**

    eedc rechnet für diesen Monat mit 22,0 ct aus der Messung — der Anwender
    muss seinen abgerechneten Wert danebenstellen können.
    """
    anlage_id = await _anlage_mit_stundenpreisen(db, monat_mit_preisen=6)

    antwort = await get_monatsabschluss(anlage_id=anlage_id, jahr=2025, monat=6, db=db)

    assert FELD in _feld_namen(antwort)


@pytest.mark.asyncio
async def test_ein_monat_OHNE_stundenpreise_zeigt_das_feld_nicht(db):
    """⭐ **Die Probe, die den ersten Fix gekippt hat.**

    Dieselbe Anlage, ein Monat ohne Messung. Eine **stichtagslose** Bedingung
    („ist irgendwo ein Sensor zugeordnet?") hätte das Feld auch hier gezeigt —
    in einem Monat, für den es nichts einzutragen gibt. Das ist die
    #392-Lehre: ein Feld, das zum Falschausfüllen einlädt, ist schlechter als
    kein Feld.
    """
    anlage_id = await _anlage_mit_stundenpreisen(db, monat_mit_preisen=6)

    antwort = await get_monatsabschluss(anlage_id=anlage_id, jahr=2025, monat=9, db=db)

    assert FELD not in _feld_namen(antwort)


@pytest.mark.asyncio
async def test_nach_tarifwechsel_bleibt_der_festpreis_monat_leer(db):
    """Der reale Weg in die Lage — und der Grund für die Rücknahme.

    Wer von einem dynamischen Tarif auf einen Festpreis wechselt, behält sein
    Sensor-Mapping; niemand räumt es weg. Der **neue** Monat ist trotzdem ein
    Festpreis-Monat ohne Messung.
    """
    anlage = Anlage(anlagenname="Wechsel", leistung_kwp=10.0)
    anlage.sensor_mapping = {"basis": {"strompreis": {"sensor_id": "sensor.tibber"}}}
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2024, 1, 1), gueltig_bis=date(2025, 12, 31),
        netzbezug_arbeitspreis_cent_kwh=25.0, einspeiseverguetung_cent_kwh=8.0,
        vertragsart="dynamisch",
    ))
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2026, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=30.0, einspeiseverguetung_cent_kwh=8.0,
        vertragsart="sondervertrag",
    ))
    await db.flush()

    antwort = await get_monatsabschluss(anlage_id=anlage.id, jahr=2026, monat=3, db=db)

    assert FELD not in _feld_namen(antwort), (
        "das Mapping steht noch, der Monat ist trotzdem ein Festpreis-Monat"
    )
