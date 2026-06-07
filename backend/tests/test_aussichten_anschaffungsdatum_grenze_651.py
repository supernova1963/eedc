"""Regressionstest: Anschaffungsdatum-Grenze für den PV-Ertrag in der Amortisation.

Befund (Anlass JayJayX #651 / lemuba #561, Re-Examination 2026-06-07): Die
Finanz-Prognose (`get_finanz_prognose`) summierte Einspeise-Erlös + EV-Ersparnis
über ALLE `Monatsdaten` — ohne das `anschaffungsdatum`/`stilllegungsdatum`-Fenster
der PV-Erzeuger zu respektieren. WP/E-Auto/BKW/Sonstige filtern ihre Monate
dagegen längst über `ist_aktiv_im_monat` (#236). Dadurch flossen Monate VOR
PV-Inbetriebnahme (bzw. nach Stilllegung) asymmetrisch in den kumulierten Ertrag
ein und verzerrten die ROI-/Amortisationsstatistik
([[feedback_anschaffungsdatum_grenze]], [[feedback_aggregations_drift]]).

Fix: Der anlagenweite Ertrags-Pfad gateet jetzt auf das aktive Fenster der
PV-Erzeuger (PV-Module ∪ Balkonkraftwerke).

Hinweis: Dieser Fix korrigiert die *Über*-Zählung (Monate ohne aktive PV). Den
*Unter*-Zählungs-Fall von JayJayX (PV real seit Jahren, Tracking-Daten erst
kürzlich → fehlende Vor-Tracking-Erträge) löst er bewusst NICHT — das wäre ein
separates Offset-/Baseline-Feature.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.aussichten import get_finanz_prognose
from backend.core.wirtschaftlichkeit_defaults import EINSPEISEVERGUETUNG_DEFAULT_CENT
from backend.models import Anlage, Investition, InvestitionMonatsdaten, Monatsdaten


async def _seed(db, *, pv_anschaffung: date) -> int:
    """Monatsdaten 2024 + 2025 (je 12 Monate, Einspeisung 400 kWh).
    PV-IMD nur 2025 (1000 kWh/Monat). Die PV-Anschaffung steuert, ab wann
    Einspeise-Erlös in die Amortisation einfließt.

    2024 hat KEINE PV-IMD → EV(2024)=0; nur der Einspeise-Erlös unterscheidet
    Kontroll- und Test-Fall, was die Assertion formelarm hält.
    """
    anlage = Anlage(anlagenname="Grenze", leistung_kwp=10.0, latitude=48.0)
    db.add(anlage)
    await db.flush()
    for jahr in (2024, 2025):
        for monat in range(1, 13):
            db.add(Monatsdaten(
                anlage_id=anlage.id, jahr=jahr, monat=monat,
                einspeisung_kwh=400.0, netzbezug_kwh=300.0,
            ))
    pv = Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
        anschaffungsdatum=pv_anschaffung, leistung_kwp=10.0,
        anschaffungskosten_gesamt=15000.0,
    )
    db.add(pv)
    await db.flush()
    for monat in range(1, 13):
        db.add(InvestitionMonatsdaten(
            investition_id=pv.id, jahr=2025, monat=monat,
            verbrauch_daten={"pv_erzeugung_kwh": 1000.0},
        ))
    await db.flush()
    return anlage.id


async def test_vor_pv_inbetriebnahme_kein_einspeise_ertrag(db):
    """Einspeise-Erlös aus Monaten vor der PV-Anschaffung darf nicht in die
    kumulierten Erträge einfließen — der Unterschied zwischen 'PV seit 2024'
    und 'PV seit 2025' ist exakt der Einspeise-Erlös der 12 Monate 2024."""
    anlage_seit_2024 = await _seed(db, pv_anschaffung=date(2024, 1, 1))
    anlage_seit_2025 = await _seed(db, pv_anschaffung=date(2025, 1, 1))

    res_2024 = await get_finanz_prognose(anlage_id=anlage_seit_2024, monate=12, db=db)
    res_2025 = await get_finanz_prognose(anlage_id=anlage_seit_2025, monate=12, db=db)

    delta = res_2024.bisherige_ertraege_euro - res_2025.bisherige_ertraege_euro
    # 12 Monate × 400 kWh × Einspeisevergütung (Default, kein Tarif geseedet,
    # kein §51-Negativpreis ohne Strompreis-Sensor).
    erwartet = 12 * 400.0 * EINSPEISEVERGUETUNG_DEFAULT_CENT / 100
    assert delta == pytest.approx(erwartet, abs=1.0), (
        f"Differenz {delta:.2f} € ≠ erwarteter 2024-Einspeise-Erlös "
        f"{erwartet:.2f} € — vor dem Fix war die Differenz 0 (2024 wurde "
        f"trotz fehlender PV mitgezählt)."
    )


async def test_pv_aktive_monate_zaehlen_weiterhin(db):
    """Gegenprobe: Die Monate MIT aktiver PV (2025) tragen weiterhin bei —
    der Filter darf nicht alles wegschneiden."""
    anlage_seit_2025 = await _seed(db, pv_anschaffung=date(2025, 1, 1))
    res = await get_finanz_prognose(anlage_id=anlage_seit_2025, monate=12, db=db)
    assert res.bisherige_ertraege_euro > 0
