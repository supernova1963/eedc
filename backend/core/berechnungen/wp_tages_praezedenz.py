"""Welche Strommenge ein Wärmeerzeuger an EINEM Tag trägt (R-4, N-482 · N-491).

**Die Frage.** *Cockpit → Tag* nimmt den Strom je Gerät aus
``TagesZusammenfassung.komponenten_kwh`` — der Zahl, die der Aggregator beim
Abschluss des Tages hingelegt hat. Sie fehlt für ein Gerät in genau zwei Lagen,
und beide sind harmlos aussehend und folgenschwer:

1. **Der zugeordnete Gesamtzähler war an diesem Tag stumm** (N-482). Die
   Beitragsschicht entscheidet K3 an der **Zuordnung** (*„ist ein Zähler da?"*),
   nicht an den Werten — sie emittiert dann ``stromverbrauch_kwh`` und sonst
   nichts, der Boundary-Diff liefert ``None``, und die gemessenen feinen Achsen
   daneben tragen **nicht**. Der vorhandene Either-Or-Mechanismus hilft dort
   nicht: er ist **1-aus-n** und nähme bei zwei Achsen genau eine
   (``komponenten_beitraege.resolve_either_or_eintraege``).
2. **Der Tag hat noch/erst einen Teil** (N-491) — erster Tag nach der
   Zuordnung, laufender Tag. Dort liefert der Tagesdetail-Pfad seit R-4 sehr
   wohl Zahlen (Rückfall auf den ersten bzw. letzten Stand), die aggregierte
   Tageszeile aber nicht: sie entsteht **ohne** diesen Rückfall, weil sie
   gespeichert wird (F-66-Klasse eine Zeitebene tiefer).

**Die Antwort ist eine n-gegen-1-Präzedenz, nach dem Vorbild von
``pv_tages_praezedenz``** — und wie dort fällt sie **nach** dem Lesen der Werte,
nicht an der Konfiguration:

* Die **Tageszeile gewinnt**, wo sie eine Zahl trägt. Sie ist die Zahl, mit der
  Bilanz, Kosten und CO₂ dieses Tages gerechnet haben; eine zweite daneben wäre
  die S1-Verletzung, gegen die diese Datei gebaut ist.
* Wo sie **keine** trägt, entscheidet **dieselbe K3-Vorrangkette wie im Monat**
  (``field_definitions.wp_strom_aufteilung``) an den Tageswerten der Zähler.
  ⛔ **Keine zweite Faltung:** Diese Datei stellt die Frage, sie beantwortet sie
  nicht — die Regel steht weiterhin an ihrer einen Stelle.

⚠ **Nur für die Anzeige.** Die Werte hier ersetzen nichts in der Datenbank; der
Aggregator schreibt weiter, was er über beide Tagesränder messen konnte. Eine
Menge „seit 11 Uhr" als gespeicherten Tageswert zu führen wäre derselbe
Datenverlust, den F-66 auf der Monatsebene abgestellt hat.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

from backend.core.field_definitions import wp_strom_aufteilung

__all__ = [
    "QUELLE_TAGESRAND",
    "QUELLE_TAGESZEILE",
    "loese_wp_tagesstrom_auf",
]

#: Der Wert kommt aus ``TagesZusammenfassung.komponenten_kwh`` — der Regelfall.
QUELLE_TAGESZEILE = "tageszeile"
#: Der Wert ist aus den Tagesrand-Ständen dieses Geräts aufgelöst worden (K3).
QUELLE_TAGESRAND = "tagesrand"


def loese_wp_tagesstrom_auf(
    aus_tageszeile: Optional[Mapping[str, float]],
    tageswerte_je_inv: Optional[Mapping[str, Mapping[str, float]]],
    investitionen_by_id: Optional[Mapping[str, Any]] = None,
) -> tuple[dict[str, float], dict[str, str]]:
    """Der Tages-Strom je Gerät — Tageszeile, sonst K3 an den Tageswerten.

    Args:
        aus_tageszeile: ``{inv_id: kwh}`` aus
            ``waermepumpe_kwh_je_investition(komponenten_kwh)``.
        tageswerte_je_inv: ``{inv_id: {registry_feld: kwh}}`` — die
            **Registry**-Feldnamen dieses Tages (``stromverbrauch_kwh``,
            ``strom_heizen_kwh``, ``strom_warmwasser_kwh``, die
            ``betriebsart_strom_*``-Felder samt Innengerät-Suffix). Genau die
            Form, die ``wp_strom_aufteilung`` an einer Monatszeile liest —
            deshalb kann sie hier dieselbe Funktion beantworten.
        investitionen_by_id: für ``parameter`` (``getrennte_strommessung``).

    Returns:
        ``(menge_je_inv, herkunft_je_inv)``. Ein Gerät ohne jede Zahl erscheint
        in **keinem** der beiden Dicts (ADR-002/P4: keine Aussage, keine 0).
    """
    menge: dict[str, float] = {}
    herkunft: dict[str, str] = {}
    for inv_id, kwh in (aus_tageszeile or {}).items():
        menge[str(inv_id)] = float(kwh)
        herkunft[str(inv_id)] = QUELLE_TAGESZEILE

    for inv_id, werte in (tageswerte_je_inv or {}).items():
        inv_id = str(inv_id)
        if inv_id in menge:
            continue
        inv = (investitionen_by_id or {}).get(inv_id)
        params = getattr(inv, "parameter", None) or {}
        if not isinstance(params, dict):
            params = {}
        wert = wp_strom_aufteilung(dict(werte or {}), params).menge_kwh
        # ⚠ **`> 0`, nicht `is not None`** — anders als an der Monatszeile. Eine
        # gemessene 0 wäre dort eine Aussage („diesen Monat nicht geheizt"); hier
        # entsteht sie auch, wenn gar kein Stromfeld im Tagesdetail stand, und
        # ein Gerät mit 0 kWh im Nenner ergäbe nur den Grund „kein
        # Stromverbrauch erfasst" — den es ohne diesen Eintrag ohnehin bekommt.
        if wert > 0:
            menge[inv_id] = wert
            herkunft[inv_id] = QUELLE_TAGESRAND
    return menge, herkunft
