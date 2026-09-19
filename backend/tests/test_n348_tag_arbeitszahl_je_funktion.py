"""N-348: **Cockpit → Tag beantwortet die drei Arbeitszahlen je Funktion.**

**Der Fund** (2026-08-29, beim Messen von dietmar1968s WP-Karte, T89667 #245/#248):
Die Blockfabrik `KomponentenSektionen.tsx` ist für Monat und Tag **dieselbe**, und
`jazZeile` rendert eine Zeile erst, wenn **Wert oder Grund** gesetzt ist. Der Monat
ruft `arbeitszahl_je_funktion` **unbedingt** (`aktueller_monat.py:2103`) und liefert
immer beide Hälften; der Tag rief sie nie. Ergebnis: *Arbeitszahl · Heizen /
· Warmwasser / · Kühlen* verschwanden unter *Cockpit → Tag* **ersatzlos** — nicht
als „—", sondern gar nicht.

**Warum das ein Fehler ist und nicht bloß eine Lücke.** SOLL §3.3/**S3**: *„Eine
Sicht, die weniger zeigt als die Nachbarsicht, sagt warum."* Der Kommentar über
`jazZeile` sagt es sogar selbst — *„Eine fehlende Zeile wäre von ‚nicht getrennt
gemessen' nicht zu unterscheiden."* Genau dieser Fall trat ein, und er trifft
beide Datenlagen: mit getrennten Zählern fehlte die Zahl neben ihren eigenen
Zutaten, ohne sie nannte der Monat einen Grund und der Tag schwieg.

⛔ **Warum ein Begründungssatz KEIN Fix gewesen wäre.** „Liegt nur monatlich vor"
ist für Heizen/Warmwasser unwahr: §3.3 stellt den Tag auf *„alles, was aus
stündlichen Zählern entsteht"*, und alle vier Eingänge liegen in der Tagesantwort
(`tag.py`, `wp_strom_heizen_kwh` · `wp_strom_warmwasser_kwh` · `wp_heizung_kwh` ·
`wp_warmwasser_kwh`). Die ehrliche Auskunft ist die Rechnung.

## Kühlen — bis Bauschnitt 6 die Ausnahme

Bis zum 11.09.2026 stand für Kühlen ein Grund statt einer Zahl: Die **Kältemenge**
(`betriebsart_nutzenergie_kuehlen_kwh`) erreichte den Tag nicht, der Tag nannte
deshalb „nur im Monat". Seit Bauschnitt 6 hat sie einen Tagespfad, und die Kühlzahl
entsteht wie im Monat. Die Probe unten hält jetzt die Zahl fest; die Aussage, die
sie vorher trug — *einer Anlage mit Kältemengenzähler nie „kein Kältemengenzähler
zugeordnet" sagen* —, steht in `test_bs6_kaelte_je_tag.py` (P4).

Schwesterdatei: `test_soll_waerme_klima_w4_arbeitszahl_je_funktion.py` — dort steht
der **Layer**, hier die **Sicht**. Der Layer war nie defekt; genau deshalb hat ihn
keine der acht W-4-Proben gefangen.
"""

from __future__ import annotations

import pytest

from datetime import date, datetime, timedelta

from backend.core.berechnungen.waermepumpe_kennzahl import (
    GRUND_FREMDSTROM,
    GRUND_KEINE_KAELTEMENGE,
    GRUND_KEIN_KUEHLBETRIEB,
    GRUND_STROM_NICHT_JE_FUNKTION,
)
from backend.core.investition_parameter import ABGRENZUNG_FREMDSTROM
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.sensor_snapshot import SensorSnapshot
from backend.models.tages_energie_profil import (  # noqa: F401
    TagesEnergieProfil,
    TagesZusammenfassung,
)

DATUM = date(2025, 6, 15)


async def _anlage(db, *, zaehler, params, wp_tag_kwh=30.0):
    """Anlage + Wärmepumpe mit gemappten Tageszählern.

    `zaehler`: ``{feldname: tages_kwh}`` — je Feld zwei Snapshots an den
    Tagesgrenzen, damit der Boundary-Diff den echten Weg nimmt.
    """
    anlage = Anlage(anlagenname="N348", leistung_kwp=10.0,
                    installationsdatum=date(2025, 1, 1))
    db.add(anlage)
    await db.flush()
    inv = Investition(
        anlage_id=anlage.id, typ="waermepumpe", bezeichnung="WP",
        anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=15000.0,
        parameter=params,
    )
    db.add(inv)
    await db.flush()

    felder = {}
    t0 = datetime.combine(DATUM, datetime.min.time())
    for feld, tages_kwh in zaehler.items():
        felder[feld] = {"strategie": "sensor", "sensor_id": f"sensor.wp_{feld}"}
        key = f"inv:{inv.id}:{feld}"
        db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=key,
                              zeitpunkt=t0, wert_kwh=1000.0, quelle="ha_statistics"))
        db.add(SensorSnapshot(anlage_id=anlage.id, sensor_key=key,
                              zeitpunkt=t0 + timedelta(days=1),
                              wert_kwh=1000.0 + tages_kwh, quelle="ha_statistics"))

    anlage.sensor_mapping = {"investitionen": {str(inv.id): {"felder": felder}}}
    db.add(TagesZusammenfassung(
        anlage_id=anlage.id, datum=DATUM,
        komponenten_kwh={f"waermepumpe_{inv.id}": wp_tag_kwh},
    ))
    await db.commit()
    return anlage, inv


async def _tag(db, **kw):
    from backend.api.routes.energie_profil.views import get_tag_detail
    anlage, _inv = await _anlage(db, **kw)
    return await get_tag_detail(anlage.id, DATUM, db)


# Eine Anlage, die alles misst, was der Tag messen kann: 20 kWh Heizstrom für
# 80 kWh Heizwärme (AZ 4,0) und 10 kWh WW-Strom für 20 kWh Warmwasser (AZ 2,0).
# ⭐ Die beiden Zahlen sind bewusst verschieden — genau darum geht es: die
# Gesamtzahl (100 ÷ 30 = 3,33) beschreibt keine der beiden.
VOLL = dict(
    zaehler={
        "strom_heizen_kwh": 20.0, "heizenergie_kwh": 80.0,
        "strom_warmwasser_kwh": 10.0, "warmwasser_kwh": 20.0,
    },
    params={"wp_art": "luft_wasser", "getrennte_strommessung": True},
)


# ── Der Kern: die Zahlen erreichen den Tag ─────────────────────────────────

async def test_n348_der_tag_rechnet_je_funktion(db):
    """Vorher: beide Felder `None`, die Zeilen fielen weg. Jetzt: zwei Zahlen."""
    resp = await _tag(db, **VOLL)

    assert resp.wp_jaz_heizen == 4.0
    assert resp.wp_jaz_warmwasser == 2.0
    # Steht ein Wert, steht kein Grund — nie beides (P4-Bauform).
    assert resp.wp_jaz_heizen_grund is None
    assert resp.wp_jaz_warmwasser_grund is None


async def test_n348_die_gesamtzahl_beschreibt_keine_der_beiden(db):
    """Die fachliche Pointe, an Zahlen festgehalten.

    100 kWh Wärme ÷ 30 kWh Strom = 3,33 — eine Zahl, die weder das gute Heizen
    (4,0) noch das erwartbar schwächere Warmwasser (2,0) beschreibt. Wer nur sie
    sieht, hält eine Anlage mit viel Warmwasseranteil für schlechter, als sie ist.
    """
    resp = await _tag(db, **VOLL)
    assert resp.wp_jaz == pytest.approx(100 / 30)
    assert resp.wp_jaz_heizen > resp.wp_jaz > resp.wp_jaz_warmwasser


# ── S3: auch das gesperrte „—" trägt seinen Grund ──────────────────────────

async def test_n348_ohne_getrennte_messung_steht_der_grund_da(db):
    """Die Lage, in der der Monat antwortete und der Tag schwieg.

    Ohne `getrennte_strommessung` gibt es E je Funktion nicht. Der Monat schreibt
    dann „— (Strom nicht getrennt je Funktion gemessen)"; der Tag ließ die Zeile
    ersatzlos weg — von „nicht getrennt gemessen" nicht zu unterscheiden.
    """
    resp = await _tag(
        db,
        zaehler={"heizenergie_kwh": 80.0, "warmwasser_kwh": 20.0},
        params={"wp_art": "luft_wasser"},   # kein getrennte_strommessung
    )

    assert resp.wp_jaz_heizen is None
    assert resp.wp_jaz_warmwasser is None
    assert resp.wp_jaz_heizen_grund == GRUND_STROM_NICHT_JE_FUNKTION
    assert resp.wp_jaz_warmwasser_grund == GRUND_STROM_NICHT_JE_FUNKTION


async def test_n348_die_r2_sperren_gelten_auch_im_tag(db):
    """Kein zweiter Rechenweg: der Helfer bringt seine Sperren mit.

    Ein Heizstab auf dem WP-Zähler sperrt die Gesamtzahl — und muss beide
    Funktionszahlen mitsperren. Genau das war der W-3-Befund am Hub: dieselbe
    Anlage, zwei Aussagen. Hier ist es dieselbe Anlage, dieselbe Sicht.
    """
    resp = await _tag(
        db,
        zaehler={
            "strom_heizen_kwh": 20.0, "heizenergie_kwh": 80.0,
            "strom_warmwasser_kwh": 10.0, "warmwasser_kwh": 20.0,
        },
        params={"wp_art": "luft_wasser", "getrennte_strommessung": True,
                "abgrenzung": ABGRENZUNG_FREMDSTROM},
    )

    assert resp.wp_jaz is None and resp.wp_jaz_grund == GRUND_FREMDSTROM
    assert resp.wp_jaz_heizen is None
    assert resp.wp_jaz_warmwasser is None
    assert resp.wp_jaz_heizen_grund == GRUND_FREMDSTROM
    assert resp.wp_jaz_warmwasser_grund == GRUND_FREMDSTROM


# ── Kühlen: der Grund sagt die Wahrheit, nicht die bequeme Antwort ─────────

async def test_n348_kuehlen_ohne_kuehlbetrieb_sagt_das(db):
    """Eine Luft-Wasser-WP, die nie kühlt, liest keinen Aggregations-Hinweis.

    ⭐ Die erste Fassung setzte `GRUND_KUEHLZAHL_NUR_MONAT` **unbedingt** — dann
    hätte jede reine Heizungs-Wärmepumpe einen Hinweis auf eine Lücke gelesen,
    die sie nichts angeht. Der Tag kennt den Kühlstrom und kann die
    aussagekräftigere Antwort geben; die Reihenfolge ist dieselbe wie in
    `arbeitszahl_kuehlen` selbst.
    """
    resp = await _tag(db, **VOLL)

    assert resp.wp_jaz_kuehlen is None
    assert resp.wp_jaz_kuehlen_grund == GRUND_KEIN_KUEHLBETRIEB


async def test_n348_kuehlen_mit_kaeltezaehler_rechnet_im_tag(db):
    """Mit Kühlstrom UND Kältemengenzähler steht die Kühlzahl im Tag (Bauschnitt 6).

    Bis zum 11.09.2026 hielt diese Probe den Grund „nur im Monat" fest — eine
    Aussage, die nur wahr war, solange die Kälte keinen Tagespfad hatte. Ihre
    Substanz („einer Anlage mit Zähler nie ‚kein Zähler' sagen") steht jetzt in
    `test_bs6_kaelte_je_tag.py`; hier steht die Zahl: 18 ÷ 6 = 3,0.
    """
    resp = await _tag(
        db,
        zaehler={
            "strom_heizen_kwh": 20.0, "heizenergie_kwh": 80.0,
            "betriebsart_strom_kuehlen_kwh": 6.0,
            "betriebsart_nutzenergie_kuehlen_kwh": 18.0,
        },
        params={"wp_art": "luft_luft", "getrennte_strommessung": True},
    )

    assert resp.wp_modus_strom_kuehlen_kwh == 6.0, "Nenner ist im Tag da"
    assert resp.wp_jaz_kuehlen == pytest.approx(3.0)
    # Steht ein Wert, steht kein Grund — und schon gar nicht der, dass der
    # Zähler fehle (die Lehre der N-132-Klasse: die AUSSAGE prüfen, nicht eine
    # Konstante gegen sich selbst).
    assert resp.wp_jaz_kuehlen_grund is None
    assert resp.wp_jaz_kuehlen_grund != GRUND_KEINE_KAELTEMENGE


# ── Der Wächter gegen den Rückfall ─────────────────────────────────────────

async def test_n348_keine_der_drei_zeilen_ist_je_stumm(db):
    """**Die Regel selbst**, nicht ihre drei Ausprägungen.

    Der Defekt war nicht „die Zahl fehlt", sondern „die Zeile verschwindet
    lautlos". Die geteilte Blockfabrik rendert nichts, wenn Wert UND Grund fehlen
    — dieser Test hält deshalb fest, dass **je Funktion immer genau eines von
    beidem** gesetzt ist, in jeder Datenlage.

    ⚑ Er fängt damit auch eine vierte Funktion, die es heute noch nicht gibt:
    wer eine hinzufügt und die Antwort vergisst, bekommt hier rot — die Fassung
    „prüfe die drei bekannten Felder" könnte das nicht.
    """
    lagen = [
        ("alles gemessen", VOLL),
        ("ohne getrennte Messung", dict(
            zaehler={"heizenergie_kwh": 80.0, "warmwasser_kwh": 20.0},
            params={"wp_art": "luft_wasser"})),
        ("ohne jeden Wärmezähler", dict(
            zaehler={"strom_heizen_kwh": 20.0, "strom_warmwasser_kwh": 10.0},
            params={"wp_art": "luft_wasser", "getrennte_strommessung": True})),
        ("Heizstab am Zähler", dict(
            zaehler={"strom_heizen_kwh": 20.0, "heizenergie_kwh": 80.0},
            params={"wp_art": "luft_wasser", "getrennte_strommessung": True,
                    "abgrenzung": ABGRENZUNG_FREMDSTROM})),
    ]
    for name, kw in lagen:
        resp = await _tag(db, **kw)
        for funktion in ("heizen", "warmwasser", "kuehlen"):
            wert = getattr(resp, f"wp_jaz_{funktion}")
            grund = getattr(resp, f"wp_jaz_{funktion}_grund")
            assert wert is not None or grund, (
                f"[{name}] wp_jaz_{funktion}: weder Wert noch Grund — die Zeile "
                f"verschwindet in der Tagessicht lautlos (N-348/S3)"
            )


# ── Nachtrag 10.09.2026 — die gemessene Null (dietmar1968, T89667 #322) ────
#
# **Der Fund.** Derselbe Melder, dieselbe Fläche, ein Jahr später im Kalender:
# Er hat BEIDE Wärmemengenzähler zugeordnet (`sensor.boiler_energy_heating`
# steht auf 9125,59 kWh) und liest am 7. September trotzdem
# *„Arbeitszahl · Heizen — (kein Wärmemengenzähler zugeordnet)"*. Im September
# heizt seine Wärmepumpe nicht; der Zähler meldet korrekt Null.
#
# ⛔ **Warum W-18 den Fall NICHT geheilt hat.** W-18 (26.08.) gab `arbeitszahl`
# den Eingang `waerme_fehlt_grund` für „Wert fehlt, und ich weiß warum". Ein
# **gemessener** Wert bekommt aber nie einen solchen Grund: `snapshot/
# aggregator.py` vergibt sie ausschließlich für Felder OHNE Summe. Dazu faltete
# `float(waerme_kwh or 0.0)` `None` und `0.0` zusammen. Beide Lagen liefen
# deshalb in denselben Satz — und für die eine ist er wahr, für die andere eine
# Falschaussage, die den Melder einen Zuordnungsfehler suchen ließ, den es nicht
# gab.
#
# ⭐ **Der Wortlaut ist von der Kühlseite geliehen** (`GRUND_KEIN_KUEHLBETRIEB`,
# W-5), nicht neu erfunden: dieselbe Lage, dieselbe Sprache.


@pytest.mark.asyncio
async def test_gemessene_null_heisst_kein_betrieb_nicht_kein_zaehler(db):
    """Zähler zugeordnet, Tageswert echt 0 ⇒ der Grund nennt den Betrieb."""
    from backend.core.berechnungen.waermepumpe_kennzahl import (
        GRUND_KEIN_HEIZBETRIEB,
    )

    resp = await _tag(db, zaehler={
        # Heizzähler DA, an diesem Tag aber 0 kWh — Standby/Umwälzung auf dem
        # Stromzähler. Warmwasser läuft normal weiter, sonst griffe die
        # Gesamt-Sperre und der Fall wäre nicht isoliert.
        "strom_heizen_kwh": 1.0, "heizenergie_kwh": 0.0,
        "strom_warmwasser_kwh": 1.0, "warmwasser_kwh": 4.0,
    }, params={"wp_art": "luft_wasser", "getrennte_strommessung": True})

    assert resp.wp_jaz_heizen is None
    assert resp.wp_jaz_heizen_grund == GRUND_KEIN_HEIZBETRIEB, (
        "Ein zugeordneter Zähler, der 0 meldet, ist kein fehlender Zähler — "
        "genau diese Verwechslung hat dietmar1968 einen Zuordnungsfehler "
        "suchen lassen, den es nicht gab (T89667 #322)"
    )
    # Die Gegenprobe in derselben Antwort: Warmwasser lief, also eine Zahl.
    assert resp.wp_jaz_warmwasser == 4.0


@pytest.mark.asyncio
async def test_fehlender_zaehler_behaelt_seinen_satz(db):
    """Die Gegenrichtung — ohne Zähler bleibt es beim alten Wortlaut.

    ⚠ **Die wichtigere Hälfte des Nachtrags.** Der neue Satz darf den alten
    nicht verdrängen: Wer gar keinen Wärmemengenzähler hat, muss weiterhin
    lesen, dass ihm einer fehlt — sonst wäre „kein Heizbetrieb" die nächste
    Falschaussage, nur in der Gegenrichtung.
    """
    resp = await _tag(db, zaehler={
        "strom_heizen_kwh": 20.0, "strom_warmwasser_kwh": 10.0,
    }, params={"wp_art": "luft_wasser", "getrennte_strommessung": True})

    assert resp.wp_jaz_heizen is None
    assert "Wärmemengenzähler" in (resp.wp_jaz_heizen_grund or ""), (
        'Ohne Zähler darf NICHT „kein Heizbetrieb“ stehen — der Anwender '
        'verlöre den Hinweis auf die fehlende Zuordnung'
    )
