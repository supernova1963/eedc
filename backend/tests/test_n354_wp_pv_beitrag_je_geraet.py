"""**N-354** — die zwei WP-PV-Größen der Finanzprognose lesen den gepflegten Anteil.

`GET /api/aussichten/finanzen/{id}` trug dieselbe Größe **dreimal verschieden**:

* `:1783` — der Eigenverbrauchs-Fallback, mit N-277 (`029533d1`) auf den
  gepflegten Anteil umgestellt. **Wirksam**, hat seine eigene Probe.
* `:2249` — `jahres_wp_verbrauch * 0.5` in den Komponenten-Beiträgen.
* `:2458` — `jahres_wp_verbrauch × fester 50-%-Anteil` im Response-Feld
  `wp_pv_anteil_kwh`.

Die letzten beiden hatten **keinen Leser im Baum** (am 30.08. und erneut am
13.09.2026 gemessen: im Frontend nur typisiert, kein Render in
`AussichtTeile.tsx`, `RoiAnalyse.tsx`, `CockpitAussichtV4.tsx`; kein
Backend-Leser). Sie sind trotzdem **Felder einer öffentlichen Route** — wer sie
direkt abfragt, bekam einen festen Anteil und, bei zwei Wärmepumpen, **denselben
vollen Betrag zweimal**.

⭐ **Nachtrag 13.09.2026 (N-459, SOLL Wärme/Klima S1b).** Es gab eine **vierte**
Stelle: `wp_netz_anteil = 1.0 - WP_PV_ANTEIL_DEFAULT` in derselben Datei. Hier
stand bis dahin, sie bleibe bewusst beim festen Default, weil der gepflegte
Anteil dort eine angezeigte Zahl bewegte. **Diese Nicht-Änderung ist mit S1b
erledigt, aber in die andere Richtung:** Der PV-Abschlag ist ganz entfallen —
der WP-Strom wird in jeder Geld- und CO₂-Rechnung voll belastet, weil sein
PV-Anteil auf der PV-Seite schon als Eigenverbrauch gutgeschrieben ist
(ADR-002/P9). ``test_der_gepflegte_anteil_bewegt_die_alternativ_ersparnis_nicht``
hält die **Substanz** der alten Probe: zwei verschieden gepflegte Anlagen weisen
dieselbe Alternativ-Ersparnis aus. Nur der Grund ist ein anderer — nicht mehr
„ein fester Default gilt für alle", sondern „die Geldformel liest das Feld gar
nicht mehr".

⚠ **Der Rechenweg von `:1783` ist nicht übertragbar** (Fundtext): Dort wird über
die zwölf Kalendermonate normiert, weil eine Saisonform im Spiel ist. Hier steht
ein Jahreswert ohne Saisonform. Übernommen wird die **Lesetür**, nicht die
Formel.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.api.routes.aussichten import get_finanz_prognose
from backend.core.berechnungen.alternativkosten import ERSETZT_NICHTS
from backend.core.investition_parameter import PARAM_WAERMEPUMPE_DEFAULTS
from backend.models import Anlage, Investition, Monatsdaten, Strompreis
from backend.models.investition import InvestitionMonatsdaten

JAHR = 2025

#: Strom je Wärmepumpe und Monat — die Zahl, aus der der Gerätenenner entsteht.
WP_STROM_MONAT = 300.0


async def _seed(db, *, wp: list[dict], name: str = "N-354") -> int:
    """Anlage mit PV und *n* Wärmepumpen; je WP ein Parameter-Satz.

    Jeder Eintrag in ``wp``: ``{"pv_anteil": float | None, "strom": float,
    "heizenergie": float, "traeger": str | None}``. ``traeger=None`` heißt
    „Neubau, nichts ersetzt".
    """
    anlage = Anlage(anlagenname=name, leistung_kwp=10.0,
                    standort_plz="10115", latitude=48.0, longitude=11.0)
    db.add(anlage)
    await db.flush()
    db.add(Strompreis(
        anlage_id=anlage.id, gueltig_ab=date(2020, 1, 1),
        netzbezug_arbeitspreis_cent_kwh=30.0, einspeiseverguetung_cent_kwh=8.0,
    ))
    db.add(Investition(
        anlage_id=anlage.id, typ="pv-module", bezeichnung="Dach",
        anschaffungsdatum=date(2024, 1, 1),
        anschaffungskosten_gesamt=20000.0, leistung_kwp=10.0,
    ))
    for m in range(1, 13):
        db.add(Monatsdaten(anlage_id=anlage.id, jahr=JAHR, monat=m,
                           netzbezug_kwh=400.0, gaspreis_cent_kwh=12.0))

    for i, cfg in enumerate(wp, start=1):
        params: dict = {"wp_art": "luft_wasser", "jaz": 3.5}
        if cfg.get("pv_anteil") is not None:
            params["pv_anteil_prozent"] = cfg["pv_anteil"]
        if cfg.get("traeger") is not None:
            params["alter_energietraeger"] = cfg["traeger"]
        inv = Investition(
            anlage_id=anlage.id, typ="waermepumpe", bezeichnung=f"WP {i}",
            anschaffungsdatum=date(2024, 1, 1),
            anschaffungskosten_gesamt=15000.0, parameter=params,
        )
        db.add(inv)
        await db.flush()
        daten = {"stromverbrauch_kwh": cfg.get("strom", WP_STROM_MONAT)}
        if cfg.get("heizenergie"):
            daten["heizenergie_kwh"] = cfg["heizenergie"]
        for m in range(1, 13):
            db.add(InvestitionMonatsdaten(
                investition_id=inv.id, jahr=JAHR, monat=m,
                verbrauch_daten=dict(daten),
            ))
    await db.commit()
    return anlage.id


def _pv_beitraege(prognose) -> dict[str, float]:
    """Die kWh-Beiträge vom Typ ``waermepumpe-pv``, je Bezeichnung."""
    return {
        b.bezeichnung: b.beitrag_kwh_jahr
        for b in prognose.komponenten_beitraege
        if b.typ == "waermepumpe-pv"
    }


def _ersparnis_beitraege(prognose) -> dict[str, float]:
    return {
        b.bezeichnung: b.beitrag_euro_jahr
        for b in prognose.komponenten_beitraege
        if b.typ == "waermepumpe-ersparnis"
    }


# ═══ Klausel 1 — der gepflegte Anteil wirkt ═════════════════════════════════

@pytest.mark.asyncio
async def test_der_gepflegte_anteil_bestimmt_wp_pv_anteil_kwh(db):
    """70 % gepflegt ⇒ 70 % des ausgewiesenen WP-Jahresstroms. Einzelwerte."""
    aid = await _seed(db, wp=[{"pv_anteil": 70}])
    p = await get_finanz_prognose(anlage_id=aid, monate=12, db=db)

    assert p.wp_stromverbrauch_kwh > 0, "ohne WP-Strom misst die Probe nichts"
    assert p.wp_pv_anteil_kwh == pytest.approx(
        round(0.70 * p.wp_stromverbrauch_kwh, 0), abs=1.0
    )


@pytest.mark.asyncio
async def test_ohne_pflege_gilt_der_katalog_default_wie_bei_n277(db):
    """Ungepflegt = derselbe Default wie an der wirksamen Stelle (`:1783`).

    ⚠ **Hier weicht der Bau von der Auftrags-Vorgabe ab, und das ist gemessen.**
    Der Auftrag nannte als Erwartung *„ohne Pflege ⇒ 0,5"* (die damalige
    Konstante `WP_PV_ANTEIL_DEFAULT`) und im selben Satz *„dieselbe Lesetür"*
    wie `:1783`. Beides zusammen ging nicht: Die Lesetür dort — und ebenso im
    Formular (`investitionFormHelpers.ts:280`) — trägt
    `PARAM_WAERMEPUMPE_DEFAULTS["pv_anteil_prozent"]` = **30**. Mit 0,5 stünden
    in **einer** Antwort weiterhin zwei Vorgabewerte für dieselbe Größe — also
    genau der Defekt, den dieser Fund beseitigt, nur verschoben. **Sichtbar
    wird die Wahl für niemanden:** beide Felder haben keinen Leser im Baum.

    ⭐ **Nachtrag 13.09.2026 (S1b):** Die Frage hat sich damit endgültig
    erledigt — es gibt nur noch **einen** Vorgabewert. Die 0,5-Konstante ist
    ersatzlos gelöscht, und der ROI-Pfad (`investitionen/roi.py`), der das Feld
    bis dahin als dritte Lesestelle in eine Geldformel trug, liest es nicht
    mehr. Übrig sind die zwei Mengen-Leser: dieser hier und der N-277-Fallback.
    """
    ohne = await _seed(db, wp=[{"pv_anteil": None}], name="ohne")
    default = await _seed(
        db, wp=[{"pv_anteil": PARAM_WAERMEPUMPE_DEFAULTS["pv_anteil_prozent"]}],
        name="default",
    )

    p_ohne = await get_finanz_prognose(anlage_id=ohne, monate=12, db=db)
    p_def = await get_finanz_prognose(anlage_id=default, monate=12, db=db)

    assert p_ohne.wp_pv_anteil_kwh == pytest.approx(p_def.wp_pv_anteil_kwh)
    assert p_ohne.wp_pv_anteil_kwh == pytest.approx(
        round(0.30 * p_ohne.wp_stromverbrauch_kwh, 0), abs=1.0
    )


# ═══ Klausel 2 — je Gerät sein eigener Beitrag ══════════════════════════════

@pytest.mark.asyncio
async def test_zwei_waermepumpen_bekommen_nicht_zweimal_den_vollen_betrag(db):
    """**Der Kern des Funds.** Zwei Geräte, verschiedene Anteile, ein Nenner je Gerät.

    WP 1: 600 kWh/Monat, 20 % PV · WP 2: 200 kWh/Monat, 80 % PV.
    Stromanteile 75 % / 25 % ⇒ Beiträge 0,75 × 0,20 und 0,25 × 0,80 des
    Jahresstroms — und **Σ der beiden ist der Anlagenwert**, nicht sein
    Doppeltes.
    """
    aid = await _seed(db, wp=[
        {"pv_anteil": 20, "strom": 600.0},
        {"pv_anteil": 80, "strom": 200.0},
    ])
    p = await get_finanz_prognose(anlage_id=aid, monate=12, db=db)

    beitraege = _pv_beitraege(p)
    assert set(beitraege) == {"WP 1 (PV-Nutzung)", "WP 2 (PV-Nutzung)"}

    gesamt = p.wp_stromverbrauch_kwh
    assert beitraege["WP 1 (PV-Nutzung)"] == pytest.approx(
        round(0.75 * 0.20 * gesamt, 0), abs=1.0
    )
    assert beitraege["WP 2 (PV-Nutzung)"] == pytest.approx(
        round(0.25 * 0.80 * gesamt, 0), abs=1.0
    )
    # Vor dem Bau stand hier zweimal `gesamt * 0.5`.
    assert beitraege["WP 1 (PV-Nutzung)"] != beitraege["WP 2 (PV-Nutzung)"]


@pytest.mark.asyncio
async def test_die_liste_und_das_response_feld_kommen_aus_einer_quelle(db):
    """K1: Σ der Gerätebeiträge == `wp_pv_anteil_kwh`. Keine zweite Rechnung."""
    aid = await _seed(db, wp=[
        {"pv_anteil": 20, "strom": 600.0},
        {"pv_anteil": 80, "strom": 200.0},
    ])
    p = await get_finanz_prognose(anlage_id=aid, monate=12, db=db)

    assert sum(_pv_beitraege(p).values()) == pytest.approx(
        p.wp_pv_anteil_kwh, abs=1.0
    )


@pytest.mark.asyncio
async def test_der_euro_betrag_folgt_der_kwh_menge(db):
    """Die Ersparnis ist die Menge × Netzbezugspreis — an beiden Orten dieselbe."""
    aid = await _seed(db, wp=[{"pv_anteil": 40}])
    p = await get_finanz_prognose(anlage_id=aid, monate=12, db=db)

    assert p.wp_pv_ersparnis_euro == pytest.approx(
        p.wp_pv_anteil_kwh * 30.0 / 100, abs=0.5
    )


# ═══ Klausel 3 — die Alternativkosten-Ersparnis je Gerät ════════════════════

@pytest.mark.asyncio
async def test_die_gas_ersparnis_wird_thermisch_geteilt_statt_verdoppelt(db):
    """Zwei ersetzende Geräte ⇒ zwei Anteile, deren Σ die Anlagen-Ersparnis ist.

    Bis zum 13.09.2026 stand der volle Anlagenbetrag **je Gerät** in der Liste;
    bei zwei Wärmepumpen also doppelt.
    """
    aid = await _seed(db, wp=[
        {"pv_anteil": 30, "strom": 300.0, "heizenergie": 900.0, "traeger": "gas"},
        {"pv_anteil": 30, "strom": 100.0, "heizenergie": 300.0, "traeger": "gas"},
    ])
    p = await get_finanz_prognose(anlage_id=aid, monate=12, db=db)

    ersparnis = _ersparnis_beitraege(p)
    assert len(ersparnis) == 2
    assert sum(ersparnis.values()) == pytest.approx(
        p.wp_alternativ_ersparnis_euro, abs=0.05
    )
    # 900 : 300 thermisch ⇒ 3 : 1.
    assert ersparnis["WP 1 (vs. Gas)"] == pytest.approx(
        3 * ersparnis["WP 2 (vs. Gas)"], rel=0.01
    )


@pytest.mark.asyncio
async def test_eine_neubau_waermepumpe_bekommt_keine_ersatz_ersparnis(db):
    """Sie hat nichts ersetzt — bis hierher stand die volle Anlagensumme daneben."""
    aid = await _seed(db, wp=[
        {"pv_anteil": 30, "strom": 300.0, "heizenergie": 900.0, "traeger": "gas"},
        {"pv_anteil": 30, "strom": 300.0, "heizenergie": 900.0, "traeger": ERSETZT_NICHTS},
    ])
    p = await get_finanz_prognose(anlage_id=aid, monate=12, db=db)

    ersparnis = _ersparnis_beitraege(p)
    assert "WP 2 (vs. Gas)" not in ersparnis and "WP 2 (vs. Öl)" not in ersparnis
    assert list(ersparnis) == ["WP 1 (vs. Gas)"]
    # Die PV-Nutzung bekommt sie weiterhin — sie verbraucht ja Strom.
    assert "WP 2 (PV-Nutzung)" in _pv_beitraege(p)


# ═══ Klausel 4 — die bewusste Nicht-Änderung ════════════════════════════════

@pytest.mark.asyncio
async def test_der_gepflegte_anteil_bewegt_die_alternativ_ersparnis_nicht(db):
    """⛔ Die Geldformel liest den gepflegten Anteil **nicht** (SOLL S1b).

    ⚠ **Diese Probe hieß bis 2026-09-13 `…bleibt_beim_festen_default`** und
    schützte eine bewusste Nicht-Änderung: die Jahresformel trug damals einen
    festen PV-Abschlag von 50 %, und den gepflegten Anteil dort einzusetzen
    hätte eine angezeigte Zahl bewegt. **Die Substanz ist dieselbe geblieben,
    ihr Grund hat sich umgedreht:** Mit S1b (N-459) ist der Abschlag ganz
    entfallen — der WP-Strom trägt den vollen Netztarif, das Feld „PV-Anteil
    (%)" beantwortet eine Mengenfrage und speist keine Preisformel.

    Zwei Anlagen mit **verschieden** gepflegtem Anteil, sonst identisch, weisen
    deshalb dieselbe Alternativ-Ersparnis aus — und der Anteil kommt trotzdem
    an, nur in den Mengenfeldern.
    """
    wenig = await _seed(db, wp=[
        {"pv_anteil": 10, "strom": 300.0, "heizenergie": 900.0, "traeger": "gas"},
    ], name="wenig")
    viel = await _seed(db, wp=[
        {"pv_anteil": 90, "strom": 300.0, "heizenergie": 900.0, "traeger": "gas"},
    ], name="viel")

    p_wenig = await get_finanz_prognose(anlage_id=wenig, monate=12, db=db)
    p_viel = await get_finanz_prognose(anlage_id=viel, monate=12, db=db)

    assert p_wenig.wp_alternativ_ersparnis_euro == pytest.approx(
        p_viel.wp_alternativ_ersparnis_euro
    )
    # …und der gepflegte Anteil ist trotzdem angekommen, nur eben dort, wo er
    # hingehört: in den Feldern ohne Leser.
    assert p_wenig.wp_pv_anteil_kwh < p_viel.wp_pv_anteil_kwh
