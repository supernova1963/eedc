"""Warum eine **Monatskachel** leer bleibt — die eine Stelle, an der das steht (N-472).

## Der Anlass

Die Prüfstand-Anlage der Demo-DB r28 hat für September dreizehn vollständig
aggregierte Tage: Strom, Wärme, Aufteilung. *Cockpit → Monat* zeigte darüber
**drei leere Kacheln**, und daneben stand kein Grund — nur
``quellen.mqtt_inbound: false``, was keine Auskunft ist, sondern ein
Implementierungsdetail. Der Verlauf direkt daneben zeigte dieselben Tage
vollständig (WK-15/F-4, Befund 2).

Dieselbe Lage entsteht ohne Tagesebene beim MQTT-Weg: Wer eedc am 14. einrichtet,
hat am Monatsersten keinen Zählerstand. Bis N-472 fiel damit **jede** Menge aus,
bis der nächste Monat begann.

⭐ **Der Bau löst beide Lagen — dieses Modul ist für das, was danach übrig
bleibt.** Eine Kachel, die auch mit fünf Quellen nichts zu zeigen hat, sagt
warum. Das ist die **W-18-Klasse**, nur eine Zeitebene höher: Dort hat
:mod:`backend.core.tageswert_grund` dem *Tag* seine Gründe gegeben, hier
bekommt sie der *Monat*.

## Warum das nicht in ``tageswert_grund`` steht

Zwei Unterschiede, und beide gehen durch den ganzen Wortlaut:

* **Die Zustandsmenge ist eine andere.** Der Tag unterscheidet *nicht
  zugeordnet* · *keine Zählerstände an den Tagesrändern* · *Rücksprung im
  Tagesfenster* — alles drei Aussagen über eine **Randdifferenz**. Der Monat
  mischt fünf Quellen, von denen nur eine über Ränder rechnet; seine Frage
  lautet „hat überhaupt eine geantwortet?".
* **Der Bezugsrahmen steht in jedem Satz.** *„für diesen Tag"* in einer
  Monatskachel wäre schlicht falsch.

⚠ **Der Rücksprung bekommt hier bewusst keinen eigenen Grund.** Er ist nach dem
Rückfall der letzte verbliebene MQTT-Fall — und er hat bereits **zwei** Orte,
die ihn beim Namen nennen und einen Handgriff anbieten: den Daten-Checker
(Kategorie Zähler-Rücksprünge) und die Reparatur-Werkbank. Ein dritter wäre
Wiederholung, kein Gewinn.

## Die Regeln, die von ``tageswert_grund`` übernommen sind

1. **Der Grund sagt, was IST.** Der Handgriff steht getrennt daneben
   (:data:`MONATSWERT_HANDGRIFF`), damit nicht wieder „Sensor zuordnen" unter
   einer Größe steht, deren Sensor längst zugeordnet ist.
2. **Die Route liefert den fertigen Satz, nicht den Schlüssel.** Eine
   TS-Kopie der Textliste wäre eine zweite Wahrheit — dieselbe Drift-Klasse wie
   F-56 und W-14.
3. **Ein unbekannter Zustand liefert ``None``**, nie den Bezeichner selbst.
"""

from __future__ import annotations

from typing import Final, Optional

#: Keine der fünf Quellen hat für diesen Monat **irgendetwas** geliefert.
#: Der Regelfall einer frisch eingerichteten Anlage und der Fall, in dem eine
#: laufende Anlage ihre Datenquellen verloren hat.
GRUND_KEINE_QUELLE: Final[str] = "keine_quelle_im_monat"

#: Es kamen Werte an — für **diese Größe** aber nicht. Die Unterscheidung ist
#: die Auskunft: Wer PV sieht und Netzbezug nicht, hat kein Anlagen-, sondern
#: ein Zuordnungsproblem an genau einem Zähler.
GRUND_GROESSE_OHNE_QUELLE: Final[str] = "groesse_ohne_quelle"

#: Der Wortlaut je Zustand — beschreibend, nicht bewertend
#: ([[feedback_eedc_ist_nicht_die_strom_polizei]]).
MONATSWERT_GRUND_TEXT: Final[dict[str, str]] = {
    GRUND_KEINE_QUELLE: (
        "Für diesen Monat liegen noch keine Werte vor — weder aus einer "
        "zugeordneten Datenquelle noch aus einem Monatsabschluss."
    ),
    GRUND_GROESSE_OHNE_QUELLE: (
        "Für diese Größe hat in diesem Monat keine Datenquelle einen Wert "
        "geliefert."
    ),
}

#: Was zu TUN ist — je Zustand, nicht je Feld. Anders als beim Tageswert hängt
#: der Handgriff hier nicht an der Größe: Beide Zustände führen auf dieselbe
#: Fläche, und der Unterschied ist nur, ob man dort **etwas** oder **eine
#: bestimmte** Zuordnung sucht.
MONATSWERT_HANDGRIFF: Final[dict[str, str]] = {
    GRUND_KEINE_QUELLE: (
        "Datenquellen zuordnen (Einstellungen → Datenquellen) oder den Monat "
        "im Monatsabschluss pflegen."
    ),
    GRUND_GROESSE_OHNE_QUELLE: (
        "Den Zähler dieser Größe zuordnen (Einstellungen → Datenquellen)."
    ),
}


def monatswert_grund(hat_irgendeine_quelle: bool) -> str:
    """Welcher der beiden Zustände vorliegt.

    Args:
        hat_irgendeine_quelle: Hat für diesen Monat **irgendeine** Quelle
            **irgendeinen** Wert geliefert?
    """
    return (
        GRUND_GROESSE_OHNE_QUELLE if hat_irgendeine_quelle else GRUND_KEINE_QUELLE
    )


def monatswert_grund_text(grund: Optional[str]) -> Optional[str]:
    """Der fertige Anwender-Satz samt Handgriff — oder ``None``.

    ⚠ Ein unbekannter Zustand liefert ``None``. Ein durchgereichter Bezeichner
    wie ``"keine_quelle_im_monat"`` in der Oberfläche wäre schlechter als gar
    kein Text: Er sieht aus wie ein Fehler und ist keine Auskunft.
    """
    if not grund:
        return None
    text = MONATSWERT_GRUND_TEXT.get(grund)
    if text is None:
        return None
    handgriff = MONATSWERT_HANDGRIFF.get(grund)
    return f"{text} {handgriff}" if handgriff else text
