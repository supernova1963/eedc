"""
Unit-Tests für die zwei WP-Aggregations-Bugs aus Issue #230 (Forum #491).

Bug 1 — WP-Starts Stunden-Plausibilitäts-Cap:
    Counter-Spike (z.B. 49.073) aus HA-Statistics sum/state-Mix (#184) muss in
    `get_hourly_counter_sum_by_feld` auf 0 geklemmt werden, damit Stunden-Tab
    und Tages-Tab nicht drift'n.

Bug 2 — WP-Kategorisierung bei getrennte_strommessung:
    Die Stunden-Kategorie `verbrauch_wp` muss dieselben Felder tragen, die der
    Tagespfad ausgewählt hat — bei getrennter Strommessung also
    `strom_heizen_kwh` + `strom_warmwasser_kwh`, und `stromverbrauch_kwh`,
    solange die feine Achse unvollständig ist (K3, analog `get_wp_strom_kwh`,
    SoT in field_definitions.py).

    ⛔ **Die Auswahl fällt in `investition_beitraege`, nicht in
    `_categorize_counter`** (#298, N-461 vom 13.09.2026). Die Proben unten
    messen sie deshalb an `investition_hourly_eintraege` — der Tür, durch die
    beide Stunden-Konsumenten gehen.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Anlage, Investition  # noqa: F401
from backend.models.sensor_snapshot import SensorSnapshot
from backend.services.snapshot import (
    get_daily_counter_deltas_by_inv,
    get_hourly_counter_sum_by_feld,
    get_komponenten_tageskwh,
)
from backend.services.snapshot.keys import _categorize_counter


# ───────────────────────────── Fixture ──────────────────────────────


async def _make_anlage_with_wp(
    session: AsyncSession,
    *,
    getrennte_strommessung: bool,
) -> tuple[Anlage, Investition]:
    """Anlage + Wärmepumpe-Investition + Sensor-Mapping (split oder single)."""
    anlage = Anlage(anlagenname="Test", leistung_kwp=10.0, standort_land="DE")
    session.add(anlage)
    await session.flush()
    inv = Investition(
        anlage_id=anlage.id,
        typ="waermepumpe",
        bezeichnung="Vitocal Test",
        parameter={"getrennte_strommessung": getrennte_strommessung},
    )
    session.add(inv)
    await session.flush()

    if getrennte_strommessung:
        felder = {
            "strom_heizen_kwh": {
                "strategie": "sensor", "sensor_id": "sensor.wp_heizen",
            },
            "strom_warmwasser_kwh": {
                "strategie": "sensor", "sensor_id": "sensor.wp_ww",
            },
            "wp_starts_anzahl": {
                "strategie": "sensor", "sensor_id": "sensor.wp_starts",
            },
        }
    else:
        felder = {
            "stromverbrauch_kwh": {
                "strategie": "sensor", "sensor_id": "sensor.wp_strom",
            },
            "wp_starts_anzahl": {
                "strategie": "sensor", "sensor_id": "sensor.wp_starts",
            },
        }
    anlage.sensor_mapping = {
        "investitionen": {str(inv.id): {"felder": felder}}
    }
    await session.commit()
    return anlage, inv


async def _put_snapshot(
    session: AsyncSession,
    anlage_id: int,
    sensor_key: str,
    zeitpunkt: datetime,
    wert: float,
) -> None:
    session.add(SensorSnapshot(
        anlage_id=anlage_id,
        sensor_key=sensor_key,
        zeitpunkt=zeitpunkt,
        wert_kwh=wert,
        quelle="ha_statistics",
    ))


# ───────────────────────────── Bug 2: Kategorisierung ──────────────────────────────


class _WpDouble:
    """Die Investition, wie sie die Beitragsschicht sieht — Typ und Parameter."""

    def __init__(self, parameter):
        self.id = 7
        self.typ = "waermepumpe"
        self.parameter = parameter
        self.parent_investition_id = None


def _stundenfelder(parameter, zugeordnet: set[str]) -> set[str]:
    """Welche Felder erreichen die Stunden-Kategorie `verbrauch_wp`? (die Tür)"""
    from backend.services.snapshot.komponenten_beitraege import (
        investition_hourly_eintraege,
    )

    return {
        e.feld for e in investition_hourly_eintraege(
            _WpDouble(parameter), {}, ist_verfuegbar=lambda f: f in zugeordnet,
        )
        if e.kategorie == "verbrauch_wp"
    }


def test_kategorisierung_wp_getrennt_strommessung():
    """Bei getrennte_strommessung zählen die feinen Zähler — **oder** der
    Gesamtzähler, sobald einer zugeordnet ist (N-461, 13.09.2026; WK-16d).

    ⛔ **Hier stand bis dahin `_categorize_counter(…, p_split) is None` für
    `stromverbrauch_kwh`**, und die Substanz *„bei Split zählen die feinen"*
    stimmt unverändert — nur die **Stelle**, an der sie durchgesetzt wird, war
    falsch. `investition_hourly_eintraege` routet seit #298 durch
    `investition_beitraege`, und die trifft die K3-Auswahl schon davor; das
    zweite Tor in `_categorize_counter` warf danach genau das Feld weg, das die
    Beitragsschicht ausgewählt hatte. Folge, gemessen: gefüllte Tagessumme über
    **leerem** Stundenverlauf, sobald das Kennzeichen gesetzt war und ein feiner
    Zähler fehlte. Die Probe misst die Auswahl deshalb an der Tür, an der sie
    fällt.
    """
    p_split = {"wp_art": "luft_wasser", "getrennte_strommessung": True}

    # Nur die feinen Zähler ⇒ sie sind die einzige Messung und tragen beide.
    assert _stundenfelder(p_split, {
        "strom_heizen_kwh", "strom_warmwasser_kwh",
    }) == {"strom_heizen_kwh", "strom_warmwasser_kwh"}

    # ⛔ **Hier stand bis zum 14.09.2026 derselbe Fall MIT `stromverbrauch_kwh`
    # und der Erwartung, die beiden feinen Zähler trügen ihn.** Die Substanz —
    # **eine** Seite trägt, nie beide, sonst steht dieselbe Kilowattstunde
    # zweimal in der Stunde — ist unverändert; seit WK-16d gewinnt der
    # Gesamtzähler (K1). Er zählt jetzt in JEDER dieser drei Lagen.
    assert _stundenfelder(p_split, {
        "strom_heizen_kwh", "strom_warmwasser_kwh", "stromverbrauch_kwh",
    }) == {"stromverbrauch_kwh"}

    # Feine Achse unvollständig ⇒ der Gesamtzähler trägt (K3) — und der
    # Stundenverlauf zeigt dieselbe Menge wie die Tagessumme.
    assert _stundenfelder(p_split, {
        "strom_heizen_kwh", "stromverbrauch_kwh",
    }) == {"stromverbrauch_kwh"}
    assert _stundenfelder(p_split, {"stromverbrauch_kwh"}) == {"stromverbrauch_kwh"}

    # Thermische Felder bleiben ungezählt (Wärme ≠ Strom)
    assert _categorize_counter("heizenergie_kwh", "waermepumpe", p_split) is None
    assert _categorize_counter("warmwasser_kwh", "waermepumpe", p_split) is None


def test_kategorisierung_wp_single_sensor():
    """Ohne getrennte_strommessung → nur stromverbrauch_kwh.

    Die Auswahl trifft `investition_beitraege`: ohne Kennzeichen sind die
    feinen Felder keine Summanden, und ein dort liegengebliebener Zähler zählt
    nicht mit.
    """
    p_single = {"wp_art": "luft_wasser", "getrennte_strommessung": False}
    assert _stundenfelder(p_single, {
        "stromverbrauch_kwh", "strom_heizen_kwh", "strom_warmwasser_kwh",
    }) == {"stromverbrauch_kwh"}


def test_kategorisierung_wp_legacy_kein_param():
    """Legacy-Anlagen ohne parameter-Dict: default = single-Sensor-Modus."""
    assert _categorize_counter("stromverbrauch_kwh", "waermepumpe", None) == "verbrauch_wp"
    assert _stundenfelder(None, {
        "stromverbrauch_kwh", "strom_heizen_kwh",
    }) == {"stromverbrauch_kwh"}


# ───────────────────────────── Bug 2: get_komponenten_tageskwh ──────────────────────────────


async def test_komponenten_tageskwh_wp_split_sensors_summieren(db):
    """Mit getrennte_strommessung: Tages-WP-Verbrauch = strom_heizen + strom_warmwasser."""
    anlage, inv = await _make_anlage_with_wp(db, getrennte_strommessung=True)

    datum = date(2026, 5, 10)
    tag_start = datetime.combine(datum, datetime.min.time())
    tag_ende = tag_start + timedelta(days=1)

    # Tages-Diff: Heizen 200,3 + Warmwasser 44,8 = 245,1 kWh
    await _put_snapshot(db, anlage.id, f"inv:{inv.id}:strom_heizen_kwh", tag_start, 1000.0)
    await _put_snapshot(db, anlage.id, f"inv:{inv.id}:strom_heizen_kwh", tag_ende, 1200.3)
    await _put_snapshot(db, anlage.id, f"inv:{inv.id}:strom_warmwasser_kwh", tag_start, 500.0)
    await _put_snapshot(db, anlage.id, f"inv:{inv.id}:strom_warmwasser_kwh", tag_ende, 544.8)
    await db.commit()

    result = await get_komponenten_tageskwh(
        db, anlage, {str(inv.id): inv}, datum
    )
    assert f"waermepumpe_{inv.id}" in result
    assert abs(result[f"waermepumpe_{inv.id}"] - 245.1) < 0.01


async def test_komponenten_tageskwh_wp_single_sensor(db):
    """Ohne getrennte_strommessung: Tages-WP-Verbrauch = stromverbrauch_kwh."""
    anlage, inv = await _make_anlage_with_wp(db, getrennte_strommessung=False)

    datum = date(2026, 5, 10)
    tag_start = datetime.combine(datum, datetime.min.time())
    tag_ende = tag_start + timedelta(days=1)

    await _put_snapshot(db, anlage.id, f"inv:{inv.id}:stromverbrauch_kwh", tag_start, 1000.0)
    await _put_snapshot(db, anlage.id, f"inv:{inv.id}:stromverbrauch_kwh", tag_ende, 1247.9)
    await db.commit()

    result = await get_komponenten_tageskwh(
        db, anlage, {str(inv.id): inv}, datum
    )
    assert f"waermepumpe_{inv.id}" in result
    assert abs(result[f"waermepumpe_{inv.id}"] - 247.9) < 0.01


# ───────────────────────────── Bug 1: Plausibilitäts-Cap ──────────────────────────────


async def test_hourly_counter_cap_spike_geklemmt(db):
    """Ein einzelner 49.073-Snapshot-Spike in einer Stunde wird auf 0 geklemmt,
    damit Stunden-Tab und Tages-Tab konsistent bleiben."""
    anlage, inv = await _make_anlage_with_wp(db, getrennte_strommessung=True)

    datum = date(2026, 5, 7)
    # Backward-Konvention: Slot h = snap[h] − snap[h−1] mit Start bei
    # Vortag-23. Wir füllen die 25 Snapshots so, dass Slot 1 (von Stunde 0
    # auf 1) auf 49.073 hochspringt und dann wieder runter — der Spike
    # selbst ist absurd, alle umliegenden Werte normal.
    sensor_key = f"inv:{inv.id}:wp_starts_anzahl"
    snaps = []
    for h in range(25):
        ts = datetime.combine(datum, datetime.min.time()) + timedelta(hours=h - 1)
        if h == 1:
            wert = 1_000_049_073.0  # Spike bei Snapshot um Stunde 0:00
        elif h >= 2:
            wert = 100.0 + h  # nach Spike: normale Sequenz
        else:
            wert = 100.0
        snaps.append((ts, wert))
        await _put_snapshot(db, anlage.id, sensor_key, ts, wert)
    await db.commit()

    result = await get_hourly_counter_sum_by_feld(
        db, anlage, {str(inv.id): inv}, datum, "wp_starts_anzahl",
    )
    # Backward-Konvention (#144): Slot h = snap[Heute h:00] − snap[Heute (h−1):00],
    # mit Slot 0 = snap[00:00] − snap[Vortag 23:00].
    #   Slot 0: 1.000.049.073 − 100 = SPIKE → 0
    #   Slot 1: 102 − 1.000.049.073 = negativ → 0
    #   Slot 2: 103 − 102 = 1
    assert all(v is not None for v in result.values())
    assert result[0] == 0, "Spike-Slot muss geklemmt sein"
    assert result[1] == 0, "Folge-Slot mit negativem Delta muss geklemmt sein"
    assert result[2] == 1, "Normaler Slot nach Spike läuft regulär"


async def test_hourly_counter_normal_werte_passieren(db):
    """Realistische WP-Start-Werte (z.B. 2-15 Starts/h) werden NICHT geklemmt."""
    anlage, inv = await _make_anlage_with_wp(db, getrennte_strommessung=True)

    datum = date(2026, 5, 8)
    sensor_key = f"inv:{inv.id}:wp_starts_anzahl"
    # Vortag-23 = 100, plus 5 Starts in jeder Folgestunde → 24×5 = 120 Tages-Total
    for h in range(25):
        ts = datetime.combine(datum, datetime.min.time()) + timedelta(hours=h - 1)
        await _put_snapshot(db, anlage.id, sensor_key, ts, 100.0 + h * 5)
    await db.commit()

    result = await get_hourly_counter_sum_by_feld(
        db, anlage, {str(inv.id): inv}, datum, "wp_starts_anzahl",
    )
    # Jeder Slot = 5
    for h in range(24):
        assert result[h] == 5, f"Slot {h} = {result[h]} (expected 5)"


async def test_betriebsstunden_bleiben_gebrochen_starts_ganzzahlig(db):
    """#238: Float-Counter (Betriebsstunden) dürfen NICHT int-gerundet werden,
    Zähl-Counter (Starts) schon — und beide Aggregator-Pfade (Tag + Stunde)
    müssen dieselbe Entscheidung treffen (FLOAT_COUNTER_FELDER als SoT). Ohne
    das verlieren Betriebsstunden 0,5 h/Stunde und Tages- vs. Stundensicht
    driften auseinander."""
    anlage, inv = await _make_anlage_with_wp(db, getrennte_strommessung=False)
    # Betriebsstunden-Zähler zusätzlich mappen (Fixture mappt nur Starts).
    anlage.sensor_mapping["investitionen"][str(inv.id)]["felder"]["wp_betriebsstunden"] = {
        "strategie": "sensor", "sensor_id": "sensor.wp_stunden",
    }
    await db.flush()

    datum = date(2026, 5, 9)
    stunden_key = f"inv:{inv.id}:wp_betriebsstunden"
    starts_key = f"inv:{inv.id}:wp_starts_anzahl"
    # Je Stunde +0,5 h Laufzeit und +3 Starts. 25 Snapshots (Vortag-23 .. Folgetag-0).
    for h in range(26):
        ts = datetime.combine(datum, datetime.min.time()) + timedelta(hours=h - 1)
        await _put_snapshot(db, anlage.id, stunden_key, ts, 1000.0 + 0.5 * h)
        await _put_snapshot(db, anlage.id, starts_key, ts, 500.0 + 3 * h)
    await db.commit()

    invs = {str(inv.id): inv}
    stunden_hourly = await get_hourly_counter_sum_by_feld(
        db, anlage, invs, datum, "wp_betriebsstunden",
    )
    starts_hourly = await get_hourly_counter_sum_by_feld(
        db, anlage, invs, datum, "wp_starts_anzahl",
    )
    daily = await get_daily_counter_deltas_by_inv(db, anlage, invs, datum)

    # Stunden-Pfad: Betriebsstunden gebrochen (0,5), Starts ganzzahlig (3).
    assert stunden_hourly[5] == 0.5, f"Stunden-Slot gebrochen erwartet, war {stunden_hourly[5]}"
    assert starts_hourly[5] == 3 and isinstance(starts_hourly[5], int)
    # Tages-Pfad: Betriebsstunden gebrochen (24×0,5 = 12,0), Starts int (24×3 = 72).
    assert daily["wp_betriebsstunden"][str(inv.id)] == 12.0
    assert daily["wp_starts_anzahl"][str(inv.id)] == 72
    assert isinstance(daily["wp_starts_anzahl"][str(inv.id)], int)
