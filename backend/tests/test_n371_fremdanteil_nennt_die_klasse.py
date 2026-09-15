"""**N-371** — der Sperrgrund für `fremdstrom` nennt die Klasse, nicht ein Gerät.

Bis zum 13.09.2026 lautete er wörtlich **„Heizstab-Strom auf dem WP-Zähler"**.
Es ist die einzige Angabe, mit der ein Anwender eedc sagen kann, dass sein
WP-Stromzähler mehr misst als die Wärmepumpe — und je einzelnem Gerät die
einzige Lage, die die Arbeitszahl-Sperre überhaupt auslöst. Wer eine
**Klimaanlage** auf demselben Zähler hat (dietmar1968, T89667 #290), las in
Cockpit, Hub und PDF einen Satz über ein Gerät, das er nicht besitzt.

⭐ **Dieselbe Bauform wie N-349, nur auf der Gegenseite.** Dort nannte der
bivalente Fall vier Mal „Gas- oder Ölkessel" und verschwieg den Heizstab; hier
nannte die Gegenlage den Heizstab und verschwieg alles andere. Die **Regel**
(`abgrenzung_verletzt` — *ein* Eingang, keine Flag-Liste) war beide Male
allgemein, ihr **Anwendertext** blieb Fallsammlung.

⚠ **Warum diese Probe die Zeichenkette hart prüft und nicht die Konstante.**
Jede vorhandene Probe vergleicht gegen ``GRUND_FREMDSTROM`` — sie bliebe grün,
wenn jemand den Wortlaut morgen wieder auf ein Gerät verengt. Genau das ist der
Befund. Die Aussage dieses Funds ist der **Wortlaut**, also steht er hier.

⛔ **Was NICHT geändert wurde und hier festgehalten ist:** der gespeicherte Wert
``"fremdstrom"`` (eine Beschriftung braucht keine Migration) und die Beschreibung
unter dem Formularfeld (sie war schon allgemein). Der Heizstab bleibt als
**Beispiel** in beiden Lagen — ``test_n349_beide_lagen_nennen_den_heizstab…``
hält fest, warum: nicht das Gerät entscheidet den Fall, sondern wo die Zähler
sitzen.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend.core.berechnungen.waermepumpe_kennzahl import (
    GRUND_FREMDSTROM,
    abgrenzungs_grund,
)
from backend.models import Anlage, Investition  # noqa: F401  (Base.metadata)
from backend.models.investition import InvestitionMonatsdaten

JAHR, MONAT = 2025, 7


async def _anlage_mit_fremdstrom(db, *, wp_art: str) -> Anlage:
    """Eine Anlage, ein Gerät, Angabe „Fremdanteil = fremdstrom", volle Monatszeile."""
    a = Anlage(anlagenname=f"N-371 {wp_art}", leistung_kwp=10.0,
               installationsdatum=date(2025, 1, 1))
    db.add(a)
    await db.flush()
    inv = Investition(
        anlage_id=a.id, typ="waermepumpe", bezeichnung="Gerät",
        anschaffungsdatum=date(2025, 1, 1), anschaffungskosten_gesamt=12000.0,
        parameter={"wp_art": wp_art, "effizienz_modus": "gesamt_jaz",
                   "abgrenzung": "fremdstrom"},
    )
    db.add(inv)
    await db.flush()
    db.add(InvestitionMonatsdaten(
        investition_id=inv.id, jahr=JAHR, monat=MONAT,
        verbrauch_daten={"stromverbrauch_kwh": 800.0, "heizenergie_kwh": 2400.0},
    ))
    await db.commit()
    return a


# ═══ Klausel 1 — der Wortlaut selbst ════════════════════════════════════════

def test_der_grund_nennt_einen_weiteren_verbraucher_statt_nur_des_heizstabs():
    """Die eine Zeile, um die es geht — hart, ohne Umweg über die Konstante."""
    assert GRUND_FREMDSTROM == "Ein weiterer Verbraucher auf dem WP-Zähler (z. B. Heizstab)"


def test_der_grund_fuehrt_den_heizstab_weiter_als_beispiel():
    """Er ist der häufigste Fall — nur nicht der einzige (N-349-Symmetrie).

    Diese Klausel trägt sich allein: Wer das Beispiel streicht und nur die
    Klasse stehen lässt, meldet hier rot, während die Gegenklausel darunter
    grün bliebe.
    """
    assert "Heizstab" in GRUND_FREMDSTROM


def test_der_grund_stellt_die_klasse_voran_nicht_das_geraet():
    """Die Gegenrichtung — und die eigentliche Aussage des Funds.

    Sie trägt sich ebenfalls allein: Der alte Wortlaut („Heizstab-Strom auf dem
    WP-Zähler") enthielt das Wort *Heizstab* und wäre an der Klausel darüber
    vorbeigekommen.
    """
    assert not GRUND_FREMDSTROM.startswith("Heizstab")
    assert "weiterer Verbraucher" in GRUND_FREMDSTROM


# ═══ Klausel 2 — was der Anwender an der Route liest ════════════════════════

def test_der_layer_uebersetzt_die_angabe_in_den_neuen_wortlaut():
    """`abgrenzungs_grund` ist die EINE Übersetzungsstelle (Layer, nicht Route)."""
    assert abgrenzungs_grund(abgrenzung_stoerung="fremdstrom") == (
        "Ein weiterer Verbraucher auf dem WP-Zähler (z. B. Heizstab)"
    )


@pytest.mark.asyncio
async def test_cockpit_monat_liefert_den_neuen_wortlaut_je_funktion(db):
    """Einzelwerte an der Route — Cockpit → Monat, Wärmepumpe mit Heizstab-Angabe."""
    a = await _anlage_mit_fremdstrom(db, wp_art="luft_wasser")

    from backend.api.routes.aktueller_monat import get_aktueller_monat
    m = await get_aktueller_monat(a.id, jahr=JAHR, monat=MONAT, db=db)

    # 2400 ÷ 800 = 3,0 stünde hier ohne die Angabe.
    assert m.wp_jaz is None
    assert m.wp_jaz_grund == "Ein weiterer Verbraucher auf dem WP-Zähler (z. B. Heizstab)"


@pytest.mark.asyncio
async def test_der_wortlaut_erreicht_auch_die_klimaanlage_die_ihn_ausgeloest_hat(db):
    """dietmar1968s Lage: eine **Klimaanlage** auf dem WP-Stromzähler.

    Der Rechenweg war für sie immer richtig — nur der Satz daneben sprach von
    einem Heizstab. Genau hier wäre der alte Wortlaut eine Falschaussage
    gewesen, nicht bloß eine Verengung.
    """
    a = await _anlage_mit_fremdstrom(db, wp_art="luft_luft")

    from backend.api.routes.aktueller_monat import get_aktueller_monat
    m = await get_aktueller_monat(a.id, jahr=JAHR, monat=MONAT, db=db)

    assert m.wp_jaz is None
    assert m.wp_jaz_grund is not None
    assert "Heizstab-Strom auf dem WP-Zähler" not in m.wp_jaz_grund
    assert m.wp_jaz_grund.startswith("Ein weiterer Verbraucher")


# ═══ Klausel 3 — das Handbuch zitiert ihn wörtlich ══════════════════════════

def test_die_gruende_tabelle_im_handbuch_traegt_den_neuen_wortlaut():
    """§4 „Die Gründe, wörtlich" ist die Nachschlagestelle des Anwenders.

    ⚠ Der Nachbar-Prüfer
    ``test_handbuch_waerme_klima_zitiert_die_gruende_woertlich`` deckt dieselbe
    Richtung ab und ist der allgemeine Wächter. Diese Zeile hier hält
    zusätzlich fest, dass es **die Tabellenzeile** ist, die den Satz trägt —
    ein Vorkommen im Fließtext daneben wäre keine Nachschlagestelle.
    """
    from pathlib import Path

    doc = Path(__file__).resolve().parents[3] / "docs" / "HANDBUCH_WAERME_KLIMA.md"
    if not doc.exists():  # eedc-Standalone-Spiegel trägt `docs/` nicht mit
        pytest.skip("docs/ liegt nur im Source-of-Truth-Repo")

    zeilen = [z for z in doc.read_text(encoding="utf-8").splitlines()
              if z.startswith("|") and GRUND_FREMDSTROM in z]
    assert len(zeilen) == 1, (
        "Die Gründe-Tabelle in §4 nennt den Sperrgrund nicht mehr genau einmal "
        f"— gefunden: {zeilen}"
    )
    assert zeilen[0].startswith(f"| **{GRUND_FREMDSTROM}** |"), (
        "Der Grund steht nicht mehr als Zeilen-Überschrift der Tabelle: "
        f"{zeilen[0][:160]}"
    )
