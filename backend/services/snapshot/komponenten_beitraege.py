"""
Per-Typ-Komponenten-Beitrag-Helper (v3.33.0).

Single Source of Truth dafür, welche Sensor-Felder (per Investitions-Typ)
in `TagesZusammenfassung.komponenten_kwh` einfließen und mit welchem
Vorzeichen — gemeinsam genutzt von Snapshot-Aggregator
(`services.snapshot.aggregator.get_komponenten_tageskwh`) und LTS-Aggregator
(`services.snapshot.lts_aggregator.get_komponenten_tageskwh_lts`).

Hintergrund (Issue #290): Vor v3.33.0 lief die LTS-Variante über eine
generische Schleife über alle gemappten Felder. Speicher mit
`ladung_netz_kwh`-Mapping, Wallbox mit `ladung_pv_kwh`/`ladung_netz_kwh`,
E-Auto mit Split-Sensoren und Wärmepumpe mit thermischen oder Counter-
Sensoren produzierten dadurch Doppelzählungen (Faktor 2–10×). Die Per-Typ-
Whitelist hier spiegelt exakt die Snapshot-Variante als semantische
Wahrheit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


# Investitions-Typ → Komponenten-Key-Präfix in komponenten_kwh.
# Spiegel zu PV_KOMPONENTEN_PREFIXE in core/berechnungen/energie.py +
# frontend/src/lib/constants.ts.
_TYP_KEY_PREFIX: dict[str, str] = {
    "pv-module": "pv_",
    "balkonkraftwerk": "bkw_",
    "speicher": "batterie_",
    "waermepumpe": "waermepumpe_",
    "wallbox": "wallbox_",
    "e-auto": "eauto_",
    "sonstiges": "sonstige_",
}


@dataclass(frozen=True)
class KomponentenBeitrag:
    """Ein Sensor-Beitrag zu einem Komponenten-Key in komponenten_kwh.

    - `feld`: das Mapping-Feld (z. B. `ladung_kwh`, `stromverbrauch_kwh`)
    - `target_key`: der Ziel-Schlüssel im JSON-Feld
      (z. B. `wallbox_2`, `einspeisung`)
    - `vorzeichen`: +1 oder -1 (Speicher-Entladung, Sonstiges-Verbraucher)
    - `fallback_gruppe`: optional — Either-Or-Markierung für E-Auto
      (mehrere Beiträge mit identischer Gruppe; der Aggregator nimmt
      nur den ersten, der ein Delta != None liefert).
    """

    feld: str
    target_key: str
    vorzeichen: int = +1
    fallback_gruppe: Optional[str] = None


def _is_sensor_mapping(cfg) -> bool:
    """True wenn ein Feld-Mapping als gültiger Sensor konfiguriert ist."""
    return (
        isinstance(cfg, dict)
        and cfg.get("strategie") == "sensor"
        and bool(cfg.get("sensor_id"))
    )


def basis_beitraege(sensor_mapping: dict) -> list[KomponentenBeitrag]:
    """Einspeisung + Netzbezug aus dem basis-Mapping.

    Liefert für jeden konfigurierten Basis-Zähler einen `+1`-Beitrag mit
    Target-Key = Feldname (`einspeisung` / `netzbezug`).
    """
    beitraege: list[KomponentenBeitrag] = []
    basis = (sensor_mapping or {}).get("basis", {}) or {}
    for feld in ("einspeisung", "netzbezug"):
        cfg = basis.get(feld)
        if _is_sensor_mapping(cfg):
            beitraege.append(KomponentenBeitrag(feld=feld, target_key=feld))
    return beitraege


def investition_beitraege(
    inv,
    sensor_mapping_for_inv: dict,
) -> list[KomponentenBeitrag]:
    """Per-Typ-Beiträge einer Investition zur `komponenten_kwh`.

    Quelle der Wahrheit ist die Snapshot-Variante
    (`services.snapshot.aggregator.get_komponenten_tageskwh:444-516`).
    Diese Funktion ist die einzige Stelle, wo die Per-Typ-Auswahl lebt.

    Args:
        inv: Investitions-Objekt mit Attributen `id`, `typ`, `parameter`,
            `parent_investition_id` (für E-Auto: Skip wenn parent vorhanden).
        sensor_mapping_for_inv: `{"felder": {feld: {strategie, sensor_id, ...}}}`
            Dict aus `sensor_mapping["investitionen"][str(inv.id)]`.

    Returns:
        Liste der Beiträge. Leer wenn keinem der zulässigen Felder ein
        Sensor zugeordnet ist (oder wenn E-Auto-Skip greift).
    """
    typ = getattr(inv, "typ", None)
    prefix = _TYP_KEY_PREFIX.get(typ)
    if prefix is None:
        return []

    felder = (sensor_mapping_for_inv or {}).get("felder", {}) or {}
    inv_id_str = str(getattr(inv, "id", ""))
    target_key = f"{prefix}{inv_id_str}"

    def _add(feld: str, vorzeichen: int = +1, fallback_gruppe: Optional[str] = None):
        if _is_sensor_mapping(felder.get(feld)):
            beitraege.append(
                KomponentenBeitrag(
                    feld=feld,
                    target_key=target_key,
                    vorzeichen=vorzeichen,
                    fallback_gruppe=fallback_gruppe,
                )
            )

    beitraege: list[KomponentenBeitrag] = []

    if typ in ("pv-module", "balkonkraftwerk"):
        _add("pv_erzeugung_kwh")

    elif typ == "speicher":
        # ladung_netz_kwh ist semantisch Teilmenge von ladung_kwh — NICHT
        # zusätzlich aufaddieren (sonst Doppelzählung für Arbitrage-Anwender).
        _add("ladung_kwh", vorzeichen=+1)
        _add("entladung_kwh", vorzeichen=-1)

    elif typ == "waermepumpe":
        # Nur elektrischer Verbrauch. heizenergie_kwh/warmwasser_kwh sind
        # *thermische* Werte (~ Strom × COP) und gehören nicht in die
        # Bilanz. wp_starts_anzahl/wp_betriebsstunden sind reine Counter
        # (eigener Pfad in `get_daily_counter_deltas_by_inv`).
        params = getattr(inv, "parameter", None) or {}
        if isinstance(params, dict) and params.get("getrennte_strommessung"):
            _add("strom_heizen_kwh")
            _add("strom_warmwasser_kwh")
        else:
            _add("stromverbrauch_kwh")

    elif typ == "wallbox":
        # ladung_pv_kwh / ladung_netz_kwh sind Teilmengen von ladung_kwh —
        # NICHT zusätzlich addieren (sonst Doppelzählung wie bei Gernots
        # Wallbox: 14 + 9,24 = 23,24 statt korrekt 14).
        _add("ladung_kwh")

    elif typ == "e-auto":
        # Wenn parent_investition_id gesetzt ist, misst die Wallbox bereits
        # die Ladung — wir überspringen das E-Auto, damit nicht doppelt
        # gezählt wird (spiegelt Live-Pfad).
        if getattr(inv, "parent_investition_id", None) is not None:
            return []
        # Either-Or: erst ladung_kwh, sonst fallback verbrauch_kwh — vom
        # Aggregator über `fallback_gruppe` ausgewertet (genau ein Delta
        # pro Gruppe).
        gruppe = f"eauto_either_or_{inv_id_str}"
        _add("ladung_kwh", fallback_gruppe=gruppe)
        _add("verbrauch_kwh", fallback_gruppe=gruppe)

    elif typ == "sonstiges":
        # Pro Investition genau ein Komponenten-Wert, immer mit positivem
        # Vorzeichen — auch bei Verbraucher-Kategorie. Die Seite leitet das
        # Frontend aus `inv.parameter.kategorie` ab. Wahl primary/secondary
        # spiegelt Snapshot-Variante.
        params = getattr(inv, "parameter", None)
        kategorie = (
            params.get("kategorie", "verbraucher")
            if isinstance(params, dict)
            else "verbraucher"
        )
        primary, secondary = (
            ("erzeugung_kwh", "verbrauch_kwh")
            if kategorie == "erzeuger"
            else ("verbrauch_kwh", "erzeugung_kwh")
        )
        gruppe = f"sonstiges_either_or_{inv_id_str}"
        _add(primary, fallback_gruppe=gruppe)
        _add(secondary, fallback_gruppe=gruppe)

    return beitraege
