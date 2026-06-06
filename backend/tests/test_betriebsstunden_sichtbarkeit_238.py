"""#238: WP-Betriebsstunden an allen Sicht-Oberflächen analog zu den Starts.

Der WP-Counter `wp_betriebsstunden` lebt — wie `wp_starts_anzahl` — in
`TagesZusammenfassung.komponenten_starts`. Diese Tests sichern, dass die drei
in #238 nachgezogenen Read-Sites die Stunden parallel zu den Starts ausweisen:

- Monatsbericht (`get_aktueller_monat`): Σ Monat + Max/Tag.
- PDF-Jahresbericht (`build_jahresbericht_context`): Σ + Ø Laufzeit pro Start.
- HA-Sensor-Export (`calculate_investition_sensors`): zwei Counter-Sensoren.

Alle respektieren das Anschaffungs-/Stilllegungsdatum (Tage außerhalb der
WP-Laufzeit zählen nicht), symmetrisch zum Dashboard (#308).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.aktueller_monat import get_aktueller_monat
from backend.api.routes.ha_export import calculate_investition_sensors
from backend.models import Anlage, Investition
from backend.models.tages_energie_profil import TagesZusammenfassung
from backend.services.pdf.builders.jahresbericht import build_jahresbericht_context


async def _seed_wp(db: AsyncSession) -> tuple[int, Investition]:
    """Anlage + WP-Investition (Laufzeit ab 2024) mit zwei Counter-Tagen im
    April 2026 (Σ 20 Starts / 50 h) plus einem Spuk-Tag vor Anschaffung."""
    anlage = Anlage(anlagenname="Test", leistung_kwp=10.0, standort_land="DE")
    db.add(anlage)
    await db.flush()

    wp = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="Test-WP",
        anschaffungsdatum=date(2024, 1, 1), aktiv=True, parameter={},
    )
    db.add(wp)
    await db.flush()

    # Spuk-Tag VOR Anschaffung — darf nirgends mitgezählt werden.
    db.add(TagesZusammenfassung(
        anlage_id=anlage.id, datum=date(2023, 12, 1),
        komponenten_starts={
            "wp_starts_anzahl": {str(wp.id): 99},
            "wp_betriebsstunden": {str(wp.id): 99.0},
        },
    ))
    # Zwei gültige Tage im April 2026.
    for tag, h in ((1, 25.0), (2, 25.0)):
        db.add(TagesZusammenfassung(
            anlage_id=anlage.id, datum=date(2026, 4, tag),
            komponenten_starts={
                "wp_starts_anzahl": {str(wp.id): 10},
                "wp_betriebsstunden": {str(wp.id): h},
            },
        ))
    await db.commit()
    return anlage.id, wp


async def test_monatsbericht_zeigt_betriebsstunden(db):
    anlage_id, _ = await _seed_wp(db)
    result = await get_aktueller_monat(anlage_id=anlage_id, jahr=2026, monat=4, db=db)
    assert result.wp_starts_summe_monat == 20
    assert result.wp_starts_max_tag == 10
    assert result.wp_betriebsstunden_summe_monat == 50.0
    assert result.wp_betriebsstunden_max_tag == 25.0


async def test_monatsbericht_spuktag_vor_anschaffung_zaehlt_nicht(db):
    """Der Dezember-2023-Spuk-Tag liegt vor Anschaffung — April-2026-Abfrage
    bleibt davon unberührt (anderer Monat ohnehin, aber Symmetrie zur Laufzeit)."""
    anlage_id, _ = await _seed_wp(db)
    # Abfrage des Spuk-Monats: WP war noch nicht angeschafft → keine Werte.
    result = await get_aktueller_monat(anlage_id=anlage_id, jahr=2023, monat=12, db=db)
    assert result.wp_betriebsstunden_summe_monat is None
    assert result.wp_betriebsstunden_max_tag is None


async def test_pdf_jahresbericht_counter_kpis(db):
    anlage_id, _ = await _seed_wp(db)
    ctx = await build_jahresbericht_context(db, anlage_id, jahr=2026)
    wp = ctx["waermepumpe"]
    assert wp["starts_summe"] == 20
    assert wp["betriebsstunden_summe"] == 50.0
    # Ø Laufzeit pro Start = 50 h / 20 Starts = 2.5 h.
    assert wp["laufzeit_pro_start_h"] == 2.5


async def test_pdf_gesamtzeitraum_summiert_nur_laufzeit(db):
    """Gesamtzeitraum (jahr=None) summiert alle Tage — aber der Spuk-Tag vor
    Anschaffung bleibt draußen (ist_aktiv_im_monat-Filter)."""
    anlage_id, _ = await _seed_wp(db)
    ctx = await build_jahresbericht_context(db, anlage_id, jahr=None)
    assert ctx["waermepumpe"]["starts_summe"] == 20
    assert ctx["waermepumpe"]["betriebsstunden_summe"] == 50.0


async def test_ha_export_counter_sensoren(db):
    anlage_id, wp = await _seed_wp(db)
    sensors = await calculate_investition_sensors(db, wp, None)
    by_key = {s.definition.key: s.value for s in sensors}
    assert by_key.get("wp_kompressor_starts") == 20
    assert by_key.get("wp_betriebsstunden") == 50.0


async def test_ha_export_ohne_counter_keine_sensoren(db):
    """Keine TagesZusammenfassung → die beiden Counter-Sensoren fehlen ganz
    (kein 0-Krückenwert)."""
    anlage = Anlage(anlagenname="Leer", leistung_kwp=5.0, standort_land="DE")
    db.add(anlage)
    await db.flush()
    wp = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="WP",
        anschaffungsdatum=date(2024, 1, 1), aktiv=True, parameter={},
    )
    db.add(wp)
    await db.commit()

    sensors = await calculate_investition_sensors(db, wp, None)
    keys = {s.definition.key for s in sensors}
    assert "wp_kompressor_starts" not in keys
    assert "wp_betriebsstunden" not in keys
