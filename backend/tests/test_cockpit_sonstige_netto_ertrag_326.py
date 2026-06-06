"""Cockpit-Übersicht: „Sonstige Erträge & Ausgaben" in der Netto-Ertrag-Kachel — #326.

rilmor-mhrs (#326): Die manuell pro Investition/Monat gepflegten
`sonstige_positionen` (z. B. ein am Wechselrichter erfasster Einspeise-Ertrag)
erschienen in Auswertungen→Finanzen im Netto-Ertrag (`Einspeiseerlös +
EV-Ersparnis + Sonstige-Erträge − Sonstige-Ausgaben`), im Cockpit aber NICHT:
dort floss `sonstige_netto` nur in `kumulative_ersparnis`/ROI, die angezeigte
Netto-Ertrag-Kachel (`netto_ertrag_euro`) ließ es weg. Das Cockpit zeigte eine
andere Summe als die Auswertungen.

Fix (`uebersicht.py`): `sonstige_netto` wird in `netto_ertrag` aufgeschlagen
(nach USt-Abzug) und dafür NICHT mehr separat in `kumulative_ersparnis`
addiert — die Netto-Ertrag-Kachel matcht jetzt die Auswertungen, der ROI bleibt
unverändert (keine Doppelzählung).

Lehre: [[feedback_aggregations_drift]] — ein Read-Pfad (#310 Auswertungen)
gefixt, paralleler (Cockpit) nicht mitgezogen.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.cockpit.uebersicht import get_cockpit_uebersicht
from backend.models import Anlage, Investition, Monatsdaten
from backend.models.investition import InvestitionMonatsdaten


async def _anlage_mit_pv(db, name: str) -> tuple[Anlage, Investition]:
    """PV-System mit Eigenverbrauch (→ EV-Ersparnis > 0) + eigenem Wechselrichter."""
    anlage = Anlage(anlagenname=name, leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()
    db.add(Monatsdaten(anlage_id=anlage.id, jahr=2026, monat=5,
                       netzbezug_kwh=100.0, einspeisung_kwh=300.0))
    wr = Investition(
        anlage_id=anlage.id, typ="wechselrichter", bezeichnung="WR",
        anschaffungsdatum=date(2024, 1, 1), anschaffungskosten_gesamt=2000.0,
    )
    db.add(wr)
    await db.flush()
    pv = Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
        parent_investition_id=wr.id, leistung_kwp=10.0,
        anschaffungsdatum=date(2024, 1, 1), anschaffungskosten_gesamt=10000.0,
    )
    db.add(pv)
    await db.flush()
    db.add(InvestitionMonatsdaten(
        investition_id=pv.id, jahr=2026, monat=5,
        verbrauch_daten={"pv_erzeugung_kwh": 800.0},
    ))
    await db.flush()
    return anlage, wr


async def test_cockpit_netto_ertrag_enthaelt_sonstige_am_wechselrichter(db):
    """Roberts Fall: Ertrag am WR fließt in die Cockpit-Netto-Ertrag-Kachel.

    Differenztest gegen eine baugleiche Anlage OHNE Sonstige: `netto_ertrag_euro`
    steigt um exakt das Sonstige-Netto, während EV-Ersparnis und Einspeiseerlös
    unverändert bleiben (Sonstige darf NUR den Netto-Ertrag verschieben)."""
    # Mit Sonstige-Ertrag (150 €) am Wechselrichter.
    a_mit, wr = await _anlage_mit_pv(db, "Cockpit326-mit")
    db.add(InvestitionMonatsdaten(
        investition_id=wr.id, jahr=2026, monat=5,
        verbrauch_daten={"sonstige_positionen": [
            {"bezeichnung": "Einspeise-Sondertarif", "betrag": 150.0, "typ": "ertrag"},
        ]},
    ))
    # Baugleiche Referenz ohne Sonstige.
    a_ohne, _ = await _anlage_mit_pv(db, "Cockpit326-ohne")
    await db.commit()

    r_mit = await get_cockpit_uebersicht(anlage_id=a_mit.id, jahr=None, db=db)
    r_ohne = await get_cockpit_uebersicht(anlage_id=a_ohne.id, jahr=None, db=db)

    # Sonstige-Netto korrekt ausgewiesen.
    assert r_mit.sonstige_netto_euro == pytest.approx(150.0)
    assert r_ohne.sonstige_netto_euro == pytest.approx(0.0)

    # Energie-/Tarif-Kennzahlen identisch (Sonstige verschiebt sie nicht).
    assert r_mit.ev_ersparnis_euro == pytest.approx(r_ohne.ev_ersparnis_euro)
    assert r_mit.einspeise_erloes_euro == pytest.approx(r_ohne.einspeise_erloes_euro)

    # KERN #326: Netto-Ertrag-Kachel enthält jetzt das Sonstige-Netto.
    assert r_mit.netto_ertrag_euro == pytest.approx(r_ohne.netto_ertrag_euro + 150.0)
    # Und matcht die Auswertungen-Formel: Einspeise + EV + Sonstige-Netto.
    assert r_mit.netto_ertrag_euro == pytest.approx(
        r_mit.einspeise_erloes_euro + r_mit.ev_ersparnis_euro + 150.0
    )


async def test_cockpit_sonstige_kein_roi_doppelzaehlen(db):
    """ROI darf das Sonstige-Netto nur EINMAL enthalten (in netto_ertrag), nicht
    zusätzlich in kumulative_ersparnis. Bei investition_gesamt=12000 € entspricht
    150 € Sonstige genau 1.25 %-Punkten ROI-Zuwachs — nicht 2.5 %."""
    a_mit, wr = await _anlage_mit_pv(db, "Cockpit326-roi-mit")
    db.add(InvestitionMonatsdaten(
        investition_id=wr.id, jahr=2026, monat=5,
        verbrauch_daten={"sonstige_positionen": [
            {"bezeichnung": "THG", "betrag": 150.0, "typ": "ertrag"},
        ]},
    ))
    a_ohne, _ = await _anlage_mit_pv(db, "Cockpit326-roi-ohne")
    await db.commit()

    r_mit = await get_cockpit_uebersicht(anlage_id=a_mit.id, jahr=None, db=db)
    r_ohne = await get_cockpit_uebersicht(anlage_id=a_ohne.id, jahr=None, db=db)

    # investition_gesamt identisch (12000 €) → ROI-Delta = 150/12000 = 1.25 %.
    assert r_mit.investition_gesamt_euro == pytest.approx(r_ohne.investition_gesamt_euro)
    delta = (r_mit.jahres_rendite_prozent or 0) - (r_ohne.jahres_rendite_prozent or 0)
    assert delta == pytest.approx(150.0 / r_mit.investition_gesamt_euro * 100, abs=0.05)
