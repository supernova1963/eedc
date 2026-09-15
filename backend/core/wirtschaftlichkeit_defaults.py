"""Wirtschaftlichkeits-Defaults — zentrale Konstanten für Berechnungen.

Single Source of Truth für hartcodierte Werte, die bisher an mehreren Stellen
dupliziert waren (siehe `docs/archive/INVENTUR-DRIFT-AUDIT.md`, Domäne B).

⚠ Hier stand bis 2026-09-13 „Pendant im Frontend:
`eedc/frontend/src/lib/wirtschaftlichkeitDefaults.ts` — bei Änderungen dort
spiegeln". **Diese Datei gibt es nicht** (gemessen per `find`); die
Spiegel-Pflicht war unerfüllbar. Die Frontend-Vorgabewerte der Investitionen
stehen in `eedc/frontend/src/lib/investitionParameter.ts` (Kanon je Typ), die
Konstanten hier sind Backend-Rechenwerte ohne Client-Pendant.
"""

from typing import Final


# Wärmepumpen-Wirkungsgrade (alter Energieträger)
# Quelle: Übliche Annahmen für Brennwert-/Niedertemperatur-Heizungen.
WP_WIRKUNGSGRAD_GAS_DEFAULT: Final[float] = 0.90
WP_WIRKUNGSGRAD_OEL_DEFAULT: Final[float] = 0.85
# Strom-Direktheizung (Nachtspeicher, Heizlüfter, Infrarot): Widerstandsheizung
# setzt Strom praktisch verlustfrei in Wärme um. Kein „Kessel"-Verlust, deshalb 1,0.
WP_WIRKUNGSGRAD_STROM_DEFAULT: Final[float] = 1.0

# Energiepreise (Defaults wenn nichts gepflegt)
# Gaspreis: typischer Endkundenpreis 2025/2026 (kanonisch in PARAM_WAERMEPUMPE_DEFAULTS).
GASPREIS_DEFAULT_CENT: Final[float] = 12.0
EINSPEISEVERGUETUNG_DEFAULT_CENT: Final[float] = 8.2
NETZBEZUG_DEFAULT_CENT: Final[float] = 30.0
EXTERNE_LADUNG_DEFAULT_EURO_KWH: Final[float] = 0.50

# E-Auto Vergleichswerte (kanonisch in PARAM_E_AUTO_DEFAULTS).
BENZIN_VERBRAUCH_DEFAULT_L_100KM: Final[float] = 7.5
BENZIN_PREIS_DEFAULT_EURO_L: Final[float] = 1.65

# ⛔ Hier stand bis 2026-09-13 `WP_PV_ANTEIL_DEFAULT = 0.5` — ein fester
# PV-Abschlag auf den Wärmepumpen-Strom. Er ist **ersatzlos entfallen**
# (SOLL Wärme/Klima S1b, N-459): Der Strom einer Wärmepumpe wird in jeder
# Geld- und CO₂-Rechnung voll belastet, weil sein PV-Anteil auf der PV-Seite
# schon gutgeschrieben ist — als Eigenverbrauch (Geld) und als vermiedener
# Netzstrom (CO₂). Ein zweiter Abzug zählte dieselbe Kilowattstunde doppelt
# (ADR-002/P9). Das Feld „PV-Anteil (%)" am Gerät bleibt, beantwortet aber
# eine Mengenfrage (N-277/N-354) und speist keine Preisformel.
