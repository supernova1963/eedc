"""Feld-Schluessel: Innengeraete-Schluessel (#263) und Legacy-Aufloesung.
"""
# Reiner Umzug aus `core/field_definitions.py` (18.09.2026, Vorlage 3 des Refactorings grosser
# Dateien): Code 1:1 uebernommen, kein Verhaltenswechsel. Die Fassade `__init__.py` exportiert
# alle Namen weiter, die Aufrufer und Tests bisher aus dem Modul importierten.

from typing import Final, Optional
from backend.core.investition_parameter import lade_innengeraete
from backend.core.field_definitions.registry import LEGACY_FELDNAMEN


# =============================================================================
# Feld-Keys je Innengerät (#263)
#
# **Ein Feld-Key kann eine Adresse tragen.** `modus`-, Verbrauchs- und
# Live-Felder einer Split-Klimaanlage gibt es einmal je Innengerät; der Key
# trägt dafür die **vergebene ID** des Innengeräts als Suffix:
#
#     betriebsart_strom_kuehlen_kwh-3      soll_temperatur_c-3
#
# ⚠ **Warum die ID und nicht die Position.** `sensor_mapping` speichert nach
# Key. Eine Positionsnummer verschöbe beim Löschen des mittleren von drei
# Geräten alle folgenden Zuordnungen — jede zeigte danach auf den falschen
# Raum, ohne dass jemand etwas angefasst hätte.
#
# ⚠ **Und warum es EINEN Auflöser gibt.** Quer durchs Backend entscheiden
# Namens-Whitelists über das Verhalten eines Feldes: `ist_zustand_feld`
# (kommt es in den 5-Sekunden-Poller?), `_is_kumulativ_feld` (wird es
# gesnapshottet?), `FELD_EINHEITEN` (welche Einheit?), `get_feld_bedarf`
# (rot oder grau?). Alle vergleichen den **ganzen** Key. Ohne Auflösung fiele
# `betriebsart_strom_kuehlen_kwh-3` durch jede einzelne — und zwar still: das
# Feld wäre zuordenbar und würde nirgends ankommen. Deshalb löst **jeder**
# dieser Leser über `basis_feld_key` auf, statt an vier Stellen ein Suffix zu
# kennen.
#
# Der Trenner ist `-`, und das ist sicher: kein einziger der 53 Feld-Keys der
# Registry enthält einen Bindestrich (Proben in
# `test_263_innengeraete_feld_keys.py`).

INNENGERAET_TRENNER: Final[str] = "-"

def feld_je_innengeraet(basis_feld: str, innengeraet_id: int) -> str:
    """Feld-Key für ein bestimmtes Innengerät — der eine Erzeuger."""
    return f"{basis_feld}{INNENGERAET_TRENNER}{int(innengeraet_id)}"

def basis_feld_key(feld: str) -> str:
    """Der Feld-Key ohne Innengeräte-Suffix — siehe Kasten oben.

    ``betriebsart_strom_kuehlen_kwh-3`` → ``betriebsart_strom_kuehlen_kwh``.
    Ein Key ohne Suffix kommt unverändert zurück; die Funktion ist damit
    überall einsetzbar, wo heute der rohe Key steht.
    """
    if not feld:
        return feld
    kopf, trenner, rest = feld.rpartition(INNENGERAET_TRENNER)
    if trenner and kopf and rest.isdigit():
        return kopf
    return feld

def innengeraet_id_von_feld(feld: str) -> Optional[int]:
    """Die Innengeräte-ID eines Feld-Keys, oder ``None`` ohne Suffix."""
    if not feld:
        return None
    kopf, trenner, rest = feld.rpartition(INNENGERAET_TRENNER)
    if trenner and kopf and rest.isdigit():
        return int(rest)
    return None

#: Felder, die es **je Innengerät** gibt, sobald eine Innengeräte-Liste
#: gepflegt ist. Abgeleitet: alles, was `bedingung: "luft_luft"` trägt.
#: Der Betriebsmodus steht bewusst NICHT dabei — er gehört dem Außengerät,
#: bleibt ein Signal je Gerät, und die abgeleitete Aufteilung ändert sich
#: durch die Liste nicht (Konzept-Fassung 2026-08-21).
def _je_innengeraet_keys(felder: list[dict], key_name: str) -> set[str]:
    return {f[key_name] for f in felder if f.get("je_innengeraet")}

def _mit_innengeraeten(
    felder: list[dict], parameter: Optional[dict], key_name: str,
) -> list[dict]:
    """Hängt je Innengerät eine Kopie der Betriebsart-/Raumfelder an.

    **Das Gerätefeld bleibt stehen.** Wer den ganzen Verbrauch je Betriebsart
    an einem Zähler hat, ordnet ihn dort zu; die Liste ergänzt die
    Aufschlüsselung, sie ersetzt sie nicht. Ein Feld verschwinden zu lassen,
    sobald jemand ein Innengerät anlegt, würde eine bestehende Zuordnung
    unsichtbar machen und unlöschbar zurücklassen — dieselbe Falle, vor der
    `get_alle_felder_fuer_investition` warnt.
    """
    geraete = lade_innengeraete(parameter)
    if not geraete:
        return felder
    kandidaten = _je_innengeraet_keys(felder, key_name)
    if not kandidaten:
        return felder
    out = list(felder)
    for g in geraete:
        for feld in felder:
            if feld[key_name] not in kandidaten:
                continue
            kopie = dict(feld)
            kopie[key_name] = feld_je_innengeraet(feld[key_name], g["id"])
            kopie["label"] = (
                f"{g['bezeichnung']}: "
                f"{feld.get('label_je_innengeraet') or feld['label']}"
            )
            kopie["innengeraet_id"] = g["id"]
            kopie["innengeraet_bezeichnung"] = g["bezeichnung"]
            if kopie.get("csv_suffix"):
                kopie["csv_suffix"] = f"{kopie['csv_suffix']}_IG{g['id']}"
            out.append(kopie)
    return out

def resolve_legacy_key(key: str) -> str:
    """
    Gibt den kanonischen Feldnamen für einen ggf. veralteten Key zurück.

    Für Rückwärtskompatibilität beim Lesen alter DB-Einträge.
    """
    return LEGACY_FELDNAMEN.get(key, key)
