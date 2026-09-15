"""
Kanonische Felddefinitionen für Monatsdaten-Eingabe und Import.

Single Source of Truth für alle Eingabe- und Import-Kanäle:
- MonatsabschlussWizard (liest via API)
- MonatsdatenForm (Frontend, direkte Eingabe)
- CSV-Import/Export (personalisiertes Template)
- Custom-Import-Wizard (Spalten-Mapping)
- Portal-Import / Cloud-Import

Kanonische Feldnamen = Backend-Namen (der Wizard war bereits korrekt).
Alle anderen Kanäle wurden auf diese Namen ausgerichtet.

Namens-History:
  speicher_ladung_netz_kwh → ladung_netz_kwh   (Speicher Arbitrage-Netzladung)
  entladung_v2h_kwh        → v2h_entladung_kwh  (E-Auto V2H)

Feld-Attribute:
  feld          — kanonischer Backend-Feldname in verbrauch_daten
  label         — Anzeigename (Wizard, Dropdown)
  einheit       — Einheit für Anzeige (kWh, km, €, ct/kWh, "")
  bedingung     — optionale Bedingung (Parameter-Key), z.B. "arbitrage_faehig"
  weich         — Tupel der Bedingungs-Schlüssel, deren Nicht-Erfüllung das Feld
                  NICHT entfernt, sondern als **erweitert** markiert (R1, SOLL
                  Wärme/Klima §3.2a). Siehe `bedingungs_urteil`.
  label_wenn    — optionales konditionelles Label: {Bedingungs-Key: Alt-Label}.
                  Trifft eine Bedingung zu, ersetzt sie das Default-`label`
                  (#281 — z.B. "Ladung" → "Ladung (gesamt, inkl. Netz)").
  csv_suffix    — Spalten-Suffix in der personalisierten CSV, z.B. "Ladung_kWh"
                  Konvention: {SanitizedBezeichnung}_{csv_suffix}
  csv_suffix_alt— alternativer (Legacy-)Suffix für Rückwärtskompatibilität
  aggregiert_in — Summen-Key für Monatsdaten-Aggregat:
                  "pv_sum", "batterie_ladung_sum", "batterie_entladung_sum"
  typ           — Datentyp für Import-Parsing: "float" (default) | "int"
  placeholder   — optionaler Platzhalter für Eingabefeld
  hinweis       — kurze Feld-Erklärung (welcher Wert/Sensortyp erwartet wird).
                  Universelle Single Source of Truth für Hilfetexte: gerendert im
                  Sensor-Zuordnungs-Wizard, im MQTT-Inbound-Wizard und in der
                  manuellen Monatsdaten-Eingabe. Sensor-Felder konsistent zu
                  docs/SENSOR-REFERENZ.md halten.
  nur_bestand   — True: das Feld ist **gar nicht mehr pflegbar** und faellt aus
                  `get_felder_fuer_investition` (Monatsabschluss). Es bleibt nur
                  in der Registry, damit eine BESTEHENDE Zuordnung sichtbar und
                  entfernbar ist — dafuer traegt es zusaetzlich `nur_manuell`,
                  das `routes/datenquellen.py::ohne_nicht_zuordenbare` auswertet
                  (Feld weg, ausser es traegt heute eine Quelle). Unterschied zu
                  `nur_manuell` allein: dort ist das Feld weiterhin ERFASSBAR,
                  nur nicht mehr zuordenbar. Erster Fall:
                  `wechselrichter/pv_erzeugung_kwh` (Gernot 24.08.2026 — der
                  Wechselrichter ist kein PV-Erzeuger, Begruendung dort).
  nur_manuell   — True: das Feld bleibt in Monatsabschluss, CSV-Import und
                  Export **erfassbar**, verschwindet aber als **zuordenbare
                  Quelle**. Markiert statt gefiltert: `build_expected_topics`
                  reicht die Kennung durch (die Registry ist die SoT „welche
                  Felder gibt es"), ausgewertet wird sie an den Rändern —
                  `routes/datenquellen.py::ohne_nicht_zuordenbare` nimmt das Feld
                  von der Fläche (außer es trägt heute eine Quelle, sonst ließe
                  sich die Zuordnung nicht mehr entfernen), der MQTT-Inbound
                  weist es ab und die Abdeckungs-Prüfung erwartet kein Topic
                  dafür. Der Rückbau-Modus dieses Projekts: kein Löschen,
                  gepflegte Werte bleiben lesbar und pflegbar, nur der
                  automatische Erfassungsweg entfällt
                  ([[feedback_reparatur_statt_loesch_features]]).
"""

from dataclasses import dataclass
from typing import Final, Literal, Optional

from backend.core.investition_parameter import (
    ist_brauchwasser_waermepumpe,
    ist_luft_luft_waermepumpe,
    lade_innengeraete,
)
# Nur die beiden Funktions-NAMEN des Kanons (`core/betriebsmodus.py` importiert
# diese Datei seinerseits erst **in** seinen Funktionen — kein Zyklus). Sie
# hier noch einmal als Literale zu schreiben wäre das zweite Vokabular für
# dieselbe Sache, das N-336 verursacht hat.
from backend.core.betriebsmodus import HEIZEN as BM_HEIZEN
from backend.core.betriebsmodus import WAERME_ACHSEN as BM_WAERME_ACHSEN
from backend.core.betriebsmodus import WARMWASSER as BM_WARMWASSER


# =============================================================================
# Basis-Felder (Monatsdaten — Zählerwerte)
# =============================================================================

BASIS_FELDER = [
    {"feld": "einspeisung_kwh",        "label": "Einspeisung",     "einheit": "kWh",    "mapping_key": "einspeisung",    "gruppe": "zaehler",
     "hinweis": "Kumulativer kWh-Zähler (oder Tagessensor mit 0:00-Reset) der ins Netz eingespeisten Energie. Immer ≥ 0; bei Zweirichtungszähler nur den Einspeise-Anteil."},
    {"feld": "netzbezug_kwh",          "label": "Netzbezug",       "einheit": "kWh",    "mapping_key": "netzbezug",      "gruppe": "zaehler",
     "hinweis": "Kumulativer kWh-Zähler (oder Tagessensor mit 0:00-Reset) der aus dem Netz bezogenen Energie. Immer ≥ 0; bei Zweirichtungszähler nur den Bezugs-Anteil."},
    {"feld": "globalstrahlung_kwh_m2", "label": "Globalstrahlung", "einheit": "kWh/m²", "mapping_key": "globalstrahlung","gruppe": "wetter",
     "hinweis": "Globalstrahlung im Monat (kWh/m²). Wird automatisch von Open-Meteo geholt, wenn nicht manuell gepflegt."},
    # N-426 (Nachbesserung): derselbe Halbsatz wie bei der Globalstrahlung
    # darüber. Seit alle drei Wetterfelder nur noch LÜCKEN füllen, ist er für
    # beide wahr — vorher versprach ihn nur das eine Feld, und keines hielt ihn.
    {"feld": "sonnenstunden",          "label": "Sonnenstunden",   "einheit": "h",      "mapping_key": "sonnenstunden",  "gruppe": "wetter",
     "hinweis": "Sonnenstunden im Monat (h). Wird automatisch von Open-Meteo geholt, wenn nicht manuell gepflegt."},
    # N-426: Bis v4.0.44 stand hier „Wird automatisch von Open-Meteo geholt" —
    # eine Zusage, die der V4-Auto-Fill nicht mehr einlöste (er füllte nur die
    # zwei Felder darüber). Der Hinweis sagt jetzt, was der Knopf wirklich tut,
    # UND woher der Wert kommt: die eigene Messreihe schlägt das Archiv.
    {"feld": "durchschnittstemperatur","label": "Ø Temperatur",    "einheit": "°C",     "mapping_key": "temperatur",     "gruppe": "wetter",
     "hinweis": "Monatsdurchschnittstemperatur (°C). „Auto-Fill\" holt sie aus den gemessenen Außentemperaturen des Monats, sonst von Open-Meteo — ein selbst eingetragener Wert bleibt stehen und lässt sich jederzeit überschreiben."},
]

# =============================================================================
# Bedingte Basis-Felder (Anlage-Ebene)
#
# Diese Felder sind Monatsdaten-Spalten (wie BASIS_FELDER), werden aber nur
# angezeigt wenn eine Anlage-Bedingung erfüllt ist.
#
# bedingung_basis:
#   "dynamischer_tarif"    — Anlage hat einen dynamischen Stromtarif ODER einen
#                            Zeittarif mit Fenstern (N-267). Beides stellt
#                            dieselbe Frage: „welcher EINE Preis beschreibt
#                            diesen Monat?" — deshalb dasselbe Feld und keine
#                            zweite Bedingung. Der Name ist historisch.
#   "variable_einspeisung" — der Tarif trägt „Einspeisevergütung wechselt
#                            monatlich" (#392) — bewusst eine EIGENE Bedingung,
#                            nicht `dynamischer_tarif`: gruaGits Fall ist fixer
#                            Bezug + variable Einspeisung
#   "hat_eauto"            — Anlage hat mindestens eine aktive E-Auto-Investition
#   "hat_waermepumpe"      — Anlage hat mindestens eine aktive Wärmepumpe
# =============================================================================

BEDINGTE_BASIS_FELDER = [
    {
        "feld": "netzbezug_durchschnittspreis_cent",
        "label": "Ø Strompreis",
        "einheit": "ct/kWh",
        "bedingung_basis": "dynamischer_tarif",
        "mapping_key": "strompreis",
        "gruppe": "preise",
        "hinweis": "Dein abgerechneter Ø-Arbeitspreis dieses Monats (ct/kWh) — er schlägt jede Berechnung. Trägst du nichts ein, rechnet eedc mit dem verbrauchsgewichteten Ø deiner mitgeschriebenen Stundenpreise (Tibber/aWATTar/EPEX) und bei einem Zeittarif (HT/NT) mit dem über deinen Netzbezug gewichteten Tarifpreis. Erst wenn beides fehlt — etwa bei handgetragenen Monatswerten — gilt der Preis aus den Stammdaten.",
    },
    {
        "feld": "einspeise_durchschnittspreis_cent",
        "label": "Einspeisevergütung (Monat)",
        "einheit": "ct/kWh",
        "bedingung_basis": "variable_einspeisung",
        "gruppe": "preise",
        "hinweis": "Vergütungssatz dieses Monats (ct/kWh), z. B. der OeMAG-Marktpreis. Schlägt den Stammwert des Tarifs; ohne Eintrag rechnet der Monat mit dem Stammwert. eedc holt den Satz nicht automatisch ab.",
    },
    {
        "feld": "kraftstoffpreis_euro",
        "label": "Ø Benzinpreis",
        "einheit": "€/L",
        "bedingung_basis": "hat_eauto",
        "gruppe": "preise",
        "hinweis": "Ø Kraftstoffpreis des Monats (€/L) für den E-Auto-vs-Verbrenner-Vergleich. Wird sonst automatisch aus dem EU Weekly Oil Bulletin geholt.",
    },
    {
        "feld": "gaspreis_cent_kwh",
        "label": "Ø Gas-/Ölpreis",
        "einheit": "ct/kWh",
        "bedingung_basis": "hat_waermepumpe",
        "gruppe": "preise",
        "hinweis": "Ø Gas-/Ölpreis des Monats (ct/kWh) für den Wärmepumpe-vs-fossile-Heizung-Vergleich.",
    },
]

# =============================================================================
# Optionale Felder (manuelle Eingabe, keine HA-Quelle)
# =============================================================================

OPTIONALE_FELDER = [
    {"feld": "sonderkosten_euro",        "label": "Sonderkosten",  "einheit": "€",  "typ": "number",
     "hinweis": "Einmalige Sonderkosten des Monats (€), z. B. Wartung oder Reparatur. Optional."},
    {"feld": "sonderkosten_beschreibung","label": "Beschreibung",  "einheit": "",   "typ": "text",
     "hinweis": "Kurzbeschreibung der Sonderkosten (Freitext). Optional."},
    {"feld": "notizen",                  "label": "Notizen",       "einheit": "",   "typ": "text",
     "hinweis": "Freie Notizen zum Monat (Freitext). Optional."},
]

# =============================================================================
# Investitions-Felder nach Typ
#
# Bedingungsfelder werden über get_felder_fuer_investition() aufgelöst.
# "bedingung" ist ein informativer String für Dokumentation/Debugging.
#
# Import-Attribute (csv_suffix, aggregiert_in, typ) werden von
# _import_investition_monatsdaten_v09() und _build_investition_felder()
# automatisch ausgewertet — keine hardcodierten Typ-Checks mehr nötig.
# =============================================================================

# ── #263: die gemessenen Betriebsart-Felder einer Split-Klimaanlage ─────────
#
# **Erzeugt statt achtmal getippt.** Die Feldnamen selbst stehen ausgeschrieben
# im Kanon (`core/betriebsmodus.py`) — dort ist die Grep-Barkeit, die dieses
# Projekt braucht. Hier entsteht daraus nur die Registry-Zeile, damit Hinweis
# und Einheit nicht achtmal auseinanderdriften können (dieselbe Bauform wie
# `_sonstiges_felder_*`, N-259).
#
# **Warum `bedingung: luft_luft` — und warum sie seit dem 26.08.2026 WEICH ist.**
# Eine Betriebsart im Sinne von Heizen · Kühlen · Lüften · Entfeuchten hat
# typischerweise ein Klimagerät. Eine Luft-Wasser-WP hat Heizen und Warmwasser —
# dafür gibt es `strom_heizen_kwh`/`strom_warmwasser_kwh`, und die bedeuten
# etwas anderes (Summanden, nicht Teilmengen). Die zwei Familien unbeschriftet
# nebeneinander anzubieten wäre genau die Zweideutigkeit, an der ein Tester
# schon einmal zwei Felder addiert hat (Forum simon42 #89667/62).
#
# ⛔ **Das spricht gegen ACHT Felder in der ersten Reihe jeder Wärmepumpe —
# nicht gegen die Kühl-Achse dort, wo ein Zähler sie belegt** (Befund W-2,
# SOLL §3.2a/R1). MartyBr hat seit dem Sommer 2026 einen getrennten Kühlzähler
# an einer Wärmepumpe und konnte ihn nirgends hinterlegen; pipp086 fragt nach
# derselben Größe (T89667 #199/#200). `weich` löst beides: hart entfernt das
# Feld, weich stellt es hinter „Weitere Größen erfassen" (s.
# `bedingungs_urteil`).
_BETRIEBSART_HINWEIS_STROM = (
    "Elektrische Energie, die dieses Gerät im {label} verbraucht hat (kWh, "
    "kumulativer Zähler oder Tagessensor). **Teilmenge** des Gesamtverbrauchs — "
    "eedc addiert sie nie dazu. Liegt dieser Wert vor, hat er Vorrang vor der "
    "Aufteilung, die eedc sonst aus dem Betriebsmodus ableitet — und zwar "
    "für **alle** Betriebsarten dieses Monats: sobald hier ein Zähler steht, "
    "zählt für dieses Gerät nur noch Gemessenes. Eine Betriebsart ohne Zähler "
    "erscheint dann unter „nicht aufgeteilt“. "
    "In Home Assistant bekommt man ihn mit einem **Utility Meter** (Helfer) auf "
    "den Energie-Sensor des Geräts, mit einem Tarif je Betriebsart. "
    "⚠ An Multisplit-Geräten misst kein Innengerät seinen eigenen Anteil: Was "
    "dort als Verbrauch erscheint, ist der Anteil des Außengeräts, der dem "
    "gerade anfordernden Innengerät zugeschrieben wird."
)
_BETRIEBSART_HINWEIS_NUTZ = (
    "Abgegebene Nutzenergie im {label} (kWh, kumulativer Zähler oder "
    "Tagessensor) — thermisch, NICHT Strom. Beim Kühlen ist das die abgeführte "
    "Wärme. Optional; ohne Wärmemengenzähler gibt es diesen Wert nicht, und "
    "eedc rechnet ihn nicht herbei."
)


#: CSV-Spaltenteil je Betriebsart — **ohne Umlaute**, wie jede bestehende
#: CSV-Spalte dieses Projekts (`Strom_Heizen_kWh`, `Ladung_PV_kWh`). Ein „ü" im
#: Spaltennamen überlebt die Runde durch Tabellenkalkulation und
#: Zeichensatz-Wechsel nicht zuverlässig, und die Spalte ist der Schlüssel, an
#: dem der Import wiederfindet, wohin ein Wert gehört.
_BETRIEBSART_CSV: dict[str, str] = {
    "heizen": "Heizbetrieb",
    "kuehlen": "Kuehlbetrieb",
    "lueften": "Lueftbetrieb",
    "entfeuchten": "Entfeuchtung",
}


def _betriebsart_felder() -> list[dict]:
    from backend.core.betriebsmodus import (
        BETRIEBSART_LABEL,
        BETRIEBSART_NUTZENERGIE_FELD,
        BETRIEBSART_STROM_FELD,
        MESSBARE_MODI,
    )
    out: list[dict] = []
    for modus in MESSBARE_MODI:
        label = BETRIEBSART_LABEL[modus]
        out.append({
            "feld": BETRIEBSART_STROM_FELD[modus],
            "label": f"Strom {label}",
            "einheit": "kWh",
            "bedingung": "luft_luft",
            "weich": ("luft_luft",),
            "je_innengeraet": True,
            "csv_suffix": f"Strom_{_BETRIEBSART_CSV[modus]}_kWh",
            "hinweis": _BETRIEBSART_HINWEIS_STROM.format(label=label),
        })
    for modus in MESSBARE_MODI:
        label = BETRIEBSART_LABEL[modus]
        out.append({
            "feld": BETRIEBSART_NUTZENERGIE_FELD[modus],
            "label": f"Nutzenergie {label}",
            "einheit": "kWh",
            "bedingung": "luft_luft",
            "weich": ("luft_luft",),
            "je_innengeraet": True,
            "csv_suffix": f"Nutzenergie_{_BETRIEBSART_CSV[modus]}_kWh",
            "hinweis": _BETRIEBSART_HINWEIS_NUTZ.format(label=label),
        })
    return out


_BETRIEBSART_FELDER: list[dict] = _betriebsart_felder()

#: Die reinen Feldnamen — für die Ausnahmelisten weiter unten, die (typ, feld)
#: erwarten. Aus derselben Quelle wie die Registry-Zeilen, damit eine spätere
#: Betriebsart nicht in der einen Liste steht und in der anderen fehlt.
_BETRIEBSART_STROM_FELDNAMEN: tuple[str, ...] = tuple(
    f["feld"] for f in _BETRIEBSART_FELDER if f["feld"].startswith("betriebsart_strom_")
)
_BETRIEBSART_NUTZENERGIE_FELDNAMEN: tuple[str, ...] = tuple(
    f["feld"] for f in _BETRIEBSART_FELDER
    if f["feld"].startswith("betriebsart_nutzenergie_")
)


INVESTITION_FELDER: dict = {
    "pv-module": [
        {
            "feld": "pv_erzeugung_kwh", "label": "PV-Erzeugung", "einheit": "kWh",
            "csv_suffix": "kWh",
            "aggregiert_in": "pv_erzeugung_sum",
            "hinweis": "Kumulativer kWh-Zähler (oder Tagessensor) der erzeugten Energie dieses PV-Strings. Immer ≥ 0. Alternativ anteilig per kWp aus dem PV-Gesamt-Sensor verteilt.",
        },
    ],

    # ⛔ **Der Wechselrichter ist KEIN PV-Erzeuger** (Entscheid Gernot 24.08.2026).
    # Das Feld bleibt nur noch stehen, damit eine BESTEHENDE Zuordnung sichtbar
    # und entfernbar ist — `nur_manuell` nimmt es sonst von der Flaeche
    # (`routes/datenquellen.py::ohne_nicht_zuordenbare`), und im Monatsabschluss
    # erscheint es gar nicht mehr.
    #
    # **Warum es weg musste, gemessen 24.08.:**
    # 1. Ein Wert hier wird von NIEMANDEM gelesen. Baumweit gilt
    #    `PV_ERZEUGER_TYPEN = ("pv-module", "balkonkraftwerk")`; der
    #    Wechselrichter steht in `live_sensor_config.SKIP_TYPEN` und fehlt in
    #    `snapshot/komponenten_beitraege._TYP_KEY_PREFIX`. Gemessen an der
    #    Fakten-Schicht: 900 kWh am Wechselrichter ⇒ `erzeugung.pv_kwh = 0.0`,
    #    dieselben 900 an einem PV-Modul ⇒ 900.0.
    # 2. Schlimmer als folgenlos: Das Feld war `("pflicht", "pv_energie")` und
    #    hat damit die Alternativ-Gruppe BESETZT. Wer seinen Zaehler hier
    #    zuordnete — auf der Zuordnungs-Flaeche ging das, obwohl der
    #    Monatsabschluss das Feld bei vorhandenen Modulen laengst ausblendete —,
    #    bekam eine Sackgasse: `basis:pv_gesamt` **und** das Modul-Feld meldeten
    #    „bereits an anderer Stelle zugeordnet", waehrend die einzige belegte
    #    Quelle nirgends gelesen wurde. Die Live-Kachel fiel auf die
    #    Trapez-Hochrechnung zurueck (+31 %, #388/F-57).
    # 3. Der Hinweistext sagte „Nur noetig, wenn keine separaten
    #    PV-Modul-Investitionen erfasst werden" — genau diese Lage ergibt aber
    #    **0 kWh PV** (gemessen: Anlagen-Aggregat 1000 ohne Modul-Komponente ⇒
    #    0.0) und wird vom Daten-Checker bereits als ERROR gemeldet
    #    („keine PV-Module angelegt"). Das Feld beschrieb ein Modell, das die
    #    Rechnung nicht kennt.
    #
    # **Der Weg ohne dieses Feld** ist gemessen und offen: der anlagenweite
    # Zaehler `basis:pv_gesamt` speist seit 2026-08-07 den Monatswert
    # (`snapshot/keys.py`: `basis["pv_gesamt"]` -> `Monatsdaten.pv_erzeugung_kwh`),
    # und von dort verteilt `resolve_pv_je_modul` kWp-gewichtet auf die Module.
    #
    # ⚠ `bedingung_anlage: keine_pv_module` ist bewusst ENTFALLEN: es blendete
    # das Feld genau dann aus, wenn Module existierten — also im Regelfall — und
    # liess es stehen, wenn es nichts bewirken konnte. Genau verkehrt herum.
    "wechselrichter": [
        {
            "feld": "pv_erzeugung_kwh", "label": "PV-Erzeugung", "einheit": "kWh",
            "csv_suffix": "kWh",
            "aggregiert_in": "pv_erzeugung_sum",
            "nur_manuell": True,
            "nur_bestand": True,
            "hinweis": (
                "\u26a0 Nicht mehr verwenden. Die PV-Erzeugung geh\u00f6rt an die "
                "PV-Module (oder an das Balkonkraftwerk); der anlagenweite Z\u00e4hler "
                "steht unter Anlage (Basis) als \u201ePV-Erzeugung Z\u00e4hlerstand\u201c. "
                "Ein Wert an dieser Stelle wird nicht ausgewertet. Das Feld erscheint "
                "nur noch, solange hier eine alte Zuordnung h\u00e4ngt \u2014 entferne "
                "sie und ordne den Z\u00e4hler neu zu."
            ),
        },
    ],

    "speicher": [
        {
            "feld": "ladung_kwh", "label": "Ladung", "einheit": "kWh",
            # #281: Mit Netzladung ist "Ladung" mehrdeutig (Gesamt vs. PV-Anteil).
            # `ladung_kwh` ist die Gesamtladung, `ladung_netz_kwh` ⊆ `ladung_kwh`.
            "label_wenn": {"laedt_aus_netz": "Ladung (gesamt, inkl. Netz)"},
            "csv_suffix": "Ladung_kWh",
            "aggregiert_in": "batterie_ladung_sum",
            # N-60/#351: Die Messstelle war nicht genannt — und ohne sie sind ein
            # DC-Zähler an der Batterie und ein AC-Zähler am Batterie-Wechsel-
            # richter **beide** vertragskonform und liefern trotzdem verschiedene
            # Zahlen (dazwischen liegt der Wandlungsverlust). Der Kanon ist
            # deshalb an die Kopplung gebunden: sie ist die einzige Angabe, die
            # für beide Bauformen erhebbar ist — bei einem DC-gekoppelten
            # Speicher gibt es zwischen Batterie und Hybrid-Wechselrichter gar
            # keinen AC-Punkt, ein „immer AC"-Vertrag wäre dort nicht messbar.
            "hinweis": "Gesamte in den Speicher geladene Energie (kWh, kumulativer Zähler oder Tagessensor). Immer ≥ 0. Gemessen an der Stelle, die zur Kopplung des Speichers passt: bei AC-Kopplung hausseitig hinter dem Batterie-Wechselrichter, bei DC-Kopplung am Batterie-Anschluss. Ladung und Entladung müssen von derselben Seite kommen — sonst enthält der Wirkungsgrad die Wandlung nur in eine Richtung.",
        },
        {
            "feld": "entladung_kwh", "label": "Entladung", "einheit": "kWh",
            "csv_suffix": "Entladung_kWh",
            "aggregiert_in": "batterie_entladung_sum",
            "hinweis": "Gesamte aus dem Speicher entladene Energie (kWh, kumulativer Zähler oder Tagessensor). Immer ≥ 0. Dieselbe Messstelle wie die Ladung (s. dort) — bei gemischten Seiten misst der Wirkungsgrad die Messstelle statt den Speicher.",
        },
        # Konditionell — nur wenn laedt_aus_netz=true (arbitrage_faehig impliziert das):
        {
            "feld": "ladung_netz_kwh", "label": "Netzladung", "einheit": "kWh",
            "bedingung": "laedt_aus_netz",
            "csv_suffix": "Netzladung_kWh",
            "hinweis": "Anteil der Ladung, der aus dem Netz kam (kWh, kumulativ oder Tagessensor). Optional und muss ≤ Ladung sein. Nur nötig, wenn der Speicher aus dem Netz lädt — bei reiner PV-Ladung leer lassen.",
        },
        # Ladepreis nur bei echter Arbitrage relevant — Backup-/Notladung läuft zum Bezugspreis.
        # `nur_manuell`: ein MONATSWERT, kein Messwert. Es gibt keinen Erfassungsweg,
        # der ihn aus einem Sensor oder Topic zöge (`snapshot/keys.py` schließt ihn
        # ausdrücklich aus) — angeboten wurde er auf der Zuordnungs-Fläche trotzdem,
        # und ein Tester hat dort einen Preis-Sensor hinterlegt, der nichts bewirkte,
        # aber eine Daten-Checker-Meldung auslöste (Forum simon42 #89667/54 + /64,
        # MartyBr; dort stand zudem ein €/kWh-Sensor in einem ct/kWh-Feld). Erfassbar
        # bleibt er im Monatsabschluss, im CSV-Import und über den errechneten
        # Vorschlag bei dynamischem Tarif.
        {
            "feld": "speicher_ladepreis_cent", "label": "Ø Ladepreis", "einheit": "ct/kWh",
            "bedingung": "arbitrage_faehig",
            "nur_manuell": True,
            "csv_suffix": "Ladepreis_Cent",
            "hinweis": "Ø Preis der Netzladung in ct/kWh. Nur bei Arbitrage relevant (gezielt günstig laden) — Backup-/Notladung läuft zum normalen Bezugspreis. Meist manuell im Monatsabschluss; bei dynamischem Tarif rechnet eedc den Wert selbst aus den Stundenpreisen.",
        },
    ],

    "waermepumpe": [
        # Default-Modus (getrennte_strommessung=false):
        {
            "feld": "stromverbrauch_kwh", "label": "Stromverbrauch", "einheit": "kWh",
            # **Weich seit dem 26.08.2026 (K3).** Ein gesetztes Kennzeichen darf
            # einen vorhandenen Gesamtzähler niemals entwerten — genau daran
            # verschwand bei OB73-gif der ganze Block *Wärme/Klima* (#263). Die
            # Auswertung hat das seit `530996f5` gelernt; die **Pflege** nicht:
            # im Monatsabschluss war das Feld hart weg, wer seine Aufteilung erst
            # halb eingerichtet hatte, konnte die Gesamtmenge nicht mehr
            # nachtragen. Auf der Zuordnungs-Fläche war es ohnehin schon sichtbar
            # (dort filtert nur die Geräteklasse) — die beiden Flächen sagten
            # also Gegenteiliges.
            "bedingung": "!getrennte_strommessung",
            "weich": ("getrennte_strommessung",),
            "csv_suffix": "Strom_kWh",
            # ⛔ Der Hinweis endete bis zum 14.09.2026 mit „Bei getrennter
            # Messung: Summe aus Heizen + Warmwasser." Das war die Zusage, die
            # WK-16d aufgehoben hat: Der Zähler misst, was er misst — und wenn
            # das mehr ist als die beiden Achsen, gilt seither er und die
            # Differenz heißt „nicht aufgeteilt" (K1/K5).
            "hinweis": "Gesamter elektrischer Energieverbrauch der WP (kWh, kumulativ oder Tagessensor). Auch bei getrennter Messung sinnvoll: misst er mehr als Heizen + Warmwasser zusammen (Standby, Steuerung, Umwälzpumpen), gilt sein Wert als Verbrauch des Geräts und die Differenz erscheint als „nicht aufgeteilt“.",
        },
        # Getrennte-Strommessung-Modus (getrennte_strommessung=true):
        {
            "feld": "strom_heizen_kwh", "label": "Strom Heizen", "einheit": "kWh",
            # ⚠ **Zwei Bedingungen verschiedener Härte** — der Fall, für den
            # `weich` die Schlüssel nennt statt ein Bool zu sein:
            # `getrennte_strommessung` ist **hart** (ohne Kennzeichen gibt es
            # die getrennte Achse nicht), `!brauchwasser` ist **weich** (eine
            # Brauchwasser-WP heizt typischerweise nicht — wer doch einen
            # Heizzähler hat, ordnet ihn unter „Weitere Größen erfassen" zu).
            "bedingung": ["getrennte_strommessung", "!brauchwasser"],
            "weich": ("brauchwasser",),
            "csv_suffix": "Strom_Heizen_kWh",
            "hinweis": "Elektrische Energie für den Heizbetrieb (kWh, kumulativ oder Tagessensor). Nur bei getrennter Strommessung.",
        },
        {
            "feld": "strom_warmwasser_kwh", "label": "Strom Warmwasser", "einheit": "kWh",
            # B5 (Entscheid Gernot 2026-08-22) — **die zweite Hälfte von N-304.**
            # Dort bekam `warmwasser_kwh` sein `!luft_luft`, weil eine
            # Split-Klimaanlage keinen Warmwasserkreis hat. Für den zugehörigen
            # STROM galt derselbe Satz und stand trotzdem nicht da: das Feld
            # wurde einer Klimaanlage mit getrennter Strommessung weiter
            # angeboten, und der Daten-Checker verlangte es unter dem Label
            # „Strom Heizen/Warmwasser".
            #
            # ⚠ **Zwei Bedingungen, nicht eine** — deshalb die Liste (UND, siehe
            # `bedingung_erfuellt`): `getrennte_strommessung` sagt, ob die Achse
            # überhaupt getrennt erfasst wird, `!luft_luft`, ob es die zweite
            # Seite der Achse an diesem Gerät gibt. Vorher konnte die Auswertung
            # nur eine Bedingung tragen — genau daran ist N-304 hier hängen
            # geblieben.
            #
            # `strom_heizen_kwh` bleibt bewusst OHNE `!luft_luft`: die
            # Heiz-Achse existiert an einer Klimaanlage sehr wohl (dieselbe
            # Trennlinie wie bei `heizenergie_kwh` in N-304).
            "bedingung": ["getrennte_strommessung", "!luft_luft"],
            "csv_suffix": "Strom_Warmwasser_kWh",
            "hinweis": "Elektrische Energie für die Warmwasserbereitung (kWh, kumulativ oder Tagessensor). Nur bei getrennter Strommessung.",
        },
        # Immer vorhanden:
        # #120: Wording-Schaerfung — abgegebene thermische Waerme, nicht Strom.
        # CSV-Suffix bleibt fuer Backwards-Kompat unveraendert.
        {
            "feld": "heizenergie_kwh", "label": "Heizwärme", "einheit": "kWh",
            # Eine Brauchwasser-WP gibt keine Heizwärme ab (SOLL §2.1/A6).
            # **Weich, nicht hart:** die Bauart ist eine Anwender-Angabe, und
            # ein Gerät, das doch beides kann, soll seinen Zähler behalten
            # dürfen. Die Warmwasser-Achse daneben bleibt hart erwartet.
            "bedingung": "!brauchwasser",
            "weich": ("brauchwasser",),
            "csv_suffix": "Heizung_kWh",
            "hinweis": "Abgegebene Heizwärme (thermisch, NICHT Strom!) in kWh, kumulativ oder Tagessensor. Ohne Wärmemengenzähler aus Stromverbrauch × JAZ berechnet.",
        },
        {
            # #120-Schaerfung, zweite Haelfte (01.09.2026, dietmar1968 T89667 #283).
            # `heizenergie_kwh` bekam mit #120 ausdruecklich "abgegebene thermische
            # Waerme, nicht Strom" ins LABEL — dieses Schwesterfeld blieb bei
            # "Warmwasser" stehen. Das Label ist die einzige Beschriftung, die
            # die Custom-Import-Zuordnung zeigt (`custom_import/analyze.py` baut
            # die Option aus `label` + Einheit), und genau dort ordnete ein
            # Melder eine Umgebungswaerme-Spalte auf dieses Feld zu. Bei
            # "Heizwaerme" daneben ist ihm das nicht passiert.
            # CSV-Suffix bleibt unveraendert — wie bei #120.
            "feld": "warmwasser_kwh", "label": "Warmwasser-Wärme", "einheit": "kWh",
            "csv_suffix": "Warmwasser_kWh",
            # N-304: **eine Split-Klimaanlage hat keinen Warmwasserkreis.** Das
            # Feld war dort nicht nur überflüssig, sondern schädlich: es fließt
            # in dieselbe Summe `wp_waerme` wie die Heizwärme
            # (`imd_monatsaggregat`, D1) und speist damit `gas_kosten_altanlage`
            # und die CO₂-Bilanz — ein gefüllter Wert erzeugt an einem Gerät
            # ohne Warmwasserbereitung eine **erfundene Ersparnis**.
            #
            # ⚠ `heizenergie_kwh` bleibt bewusst OHNE diese Bedingung: eine
            # Klimaanlage gibt sehr wohl Wärme ab, und genau daran hängen die
            # Gas- und CO₂-Ersparnis, die vor dem #263-Konzept ganz fehlten
            # (Gernot, 2026-08-21). Nur die Warmwasser-Achse gibt es nicht.
            #
            # Die Entscheidung selbst ist älter: `64826a40` (N-86, 16.08.) hat
            # eine Klimaanlage von der Heizwärme-PFLICHT befreit, weil „die
            # Größe am Gerät nicht existiert" — umgesetzt aber nur in
            # `get_feld_bedarf`, also auf der Zuordnungs-Fläche. Der
            # Monatsabschluss liest `get_felder_fuer_investition` und kannte
            # die Unterscheidung nicht. Genau das Muster, das jener Commit
            # selbst beklagt: „dieselbe Anlage, zwei Flächen, gegenteilige
            # Aussage."
            "bedingung": "!luft_luft",
            "hinweis": "Abgegebene Warmwasser-Wärme (thermisch) in kWh, kumulativ oder Tagessensor. Optional — misst EIN Zähler Heizung und Warmwasser zusammen, gehört sein Wert unter „Wärme gesamt“.",
        },
        {
            # N-391 — **der Ort für EINEN gemeinsamen Wärmemengenzähler.**
            #
            # ⛔ **Warum es das Feld bis zum 14.09.2026 nicht gab und was das
            # gekostet hat.** Eine Luft-Wasser-Wärmepumpe mit Umschaltventil hat
            # EINEN Vorlauf; der Wärmemengenzähler sitzt dort und misst Heizung
            # **und** Warmwasser. Wer so misst, trug seine Zahl mangels
            # Alternative unter *Heizwärme* ein (so stand es im Handbuch) — und
            # bei getrennter Strommessung (F5) rechnete eedc daraus
            # `Gesamtwärme ÷ Heizstrom`: gemessen **5,0** statt 3,0, ohne
            # jeden Grund daneben. Eine Zahl, die gut aussieht und nichts misst.
            #
            # ⭐ **Der LESE-Vertrag stand schon** (D1,
            # `waermepumpe_kennzahl.waerme_gesamt_kwh`, seit 26.08.): „Liegt eine
            # gemessene Gesamtwärme vor, gilt sie. Sonst ist die Wärme die Summe
            # ihrer beiden Achsen." Es fehlte allein der **Erfassungsweg** —
            # ohne Registry-Eintrag gibt es kein Formularfeld, keinen
            # Zuordnungs-Slot und keinen `csv_suffix`.
            #
            # ⚠ **Keine `bedingung`** (Entscheid 14.09.): Die Bilanzgröße gibt es
            # an jedem Gerät, wie `stromverbrauch_kwh` auf der Stromseite. Sie an
            # eine Bauart zu binden wäre die Bauform, die R1 abgelöst hat — was
            # ein Gerät liefern kann, sagt der zugeordnete Zähler.
            #
            # ⭐ **Und die Vorrangregel ist seit WK-16d dieselbe wie auf der
            # Stromseite:** Gesamtwert ⇒ Menge, Aufteilung ⇒ daneben, Rest ⇒
            # *nicht aufgeteilt* (K1/K5). ⛔ Bis zum 14.09.2026 stand hier das
            # Gegenteil — *„auf der Stromseite gewinnt die vollständige feine
            # Aufteilung, weil `getrennte_strommessung` erklärt, dass die zwei
            # Zähler zusammen das Ganze sind"*. Das Kennzeichen erklärt, dass die
            # zwei Zähler **Summanden** sind; dass sie zusammen **alles** messen,
            # erklärt es nicht (Standby, Steuerung, Umwälzpumpen). Die beiden
            # Seiten sagen jetzt denselben Satz.
            "feld": "waerme_kwh", "label": "Wärme gesamt", "einheit": "kWh",
            "csv_suffix": "Waerme_Gesamt_kWh",
            "hinweis": "Abgegebene Wärme GESAMT (thermisch, NICHT Strom!) in kWh, kumulativ oder Tagessensor — für EINEN Wärmemengenzähler, der Heizung und Warmwasser zusammen misst. Wer getrennte Zähler hat, lässt das Feld leer. Trägt hier ein Wert, gilt er als die Wärme des Geräts; Heizwärme und Warmwasser-Wärme stehen dann nur noch als Aufteilung daneben.",
        },
        # #263 — GEMESSENER Verbrauch je Betriebsart (Split-Klimaanlage).
        # Erzeugt aus dem Kanon (`core/betriebsmodus.py`), siehe
        # `_betriebsart_felder` unter dieser Tabelle.
        *_BETRIEBSART_FELDER,
    ],

    "e-auto": [
        {
            "feld": "km_gefahren", "label": "Gefahrene km", "einheit": "km",
            "placeholder": "z.B. 1200",
            "csv_suffix": "km",
            "hinweis": "Gefahrene Kilometer im Monat — kumulativer km-Zähler (Auto-Integration/OBD) oder Tagessensor, sonst manuell.",
        },
        # #407 (8ear): der TACHOSTAND als Handeingabe — das Zählerstand-Modell
        # aus #377 auf das Auto übertragen: eedc führt den Stand, die einzige
        # Rechnung darauf ist Ende − Anfang, und die landet als Vorschlag auf
        # „Gefahrene km" (`vorschlag_service._get_berechnete_werte`). Das Feld
        # darüber bleibt unverändert die MENGE — alle Leser (Effizienz, Benzin-
        # Vergleich, HA-Export, Community) lesen weiter nur `km_gefahren`.
        #
        # `stand: True` — eine Bestandsgröße, keine Menge (kein Vormonats-/
        # Durchschnitts-Vorschlag: ein Tachostand hat keinen Mittelwert, s.
        # `ist_stand_feld`). `nur_manuell` — der SENSOR-Weg existiert schon:
        # ein Kilometerstand-Sensor gehört auf `km_gefahren`, dort bildet die
        # HA-Statistik bzw. die MQTT-Reihe (#396) die Differenz selbst. Ein
        # zweiter Sensor-Slot für denselben Stand wäre Doppelerfassung.
        # ⛔ Kein Parameter „Kilometerstand bei Anschaffung": der erste Monat
        # hat keinen Anfang, und das Modell weist eine fehlende Anfangsmessung
        # aus (`anfang_vollstaendig`), statt sie zu erfinden.
        {
            "feld": "km_stand", "label": "Tachostand", "einheit": "km",
            "placeholder": "z.B. 45230",
            "csv_suffix": "Tachostand",
            "stand": True,
            "nur_manuell": True,
            "hinweis": (
                "Kilometerstand am Monatsende, wie er im Auto steht. eedc rechnet "
                "daraus die gefahrenen Kilometer (Stand dieses Monats minus Stand des "
                "Vormonats) und schlägt sie oben vor. Nur für die Handeingabe — ein "
                "Kilometerstand-Sensor gehört auf „Gefahrene km“, dort bildet eedc die "
                "Differenz selbst."
            ),
        },
        {
            "feld": "verbrauch_kwh", "label": "Verbrauch", "einheit": "kWh",
            "placeholder": "z.B. 216",
            "csv_suffix": "Verbrauch_kWh",
            "hinweis": "Kumulativer kWh-Zähler des gefahrenen Energieverbrauchs (zählt fortlaufend hoch, Tagessensor geht auch) — der reine Fahrverbrauch, NICHT pro Fahrt und NICHT kWh/100 km. eedc errechnet daraus mit den km die Effizienz. Optional: fehlt der Wert, nähert eedc die kWh/100 km aus der geladenen Energie an (inkl. Ladeverluste).",
        },
        {
            "feld": "ladung_pv_kwh", "label": "Heim: PV", "einheit": "kWh",
            "placeholder": "z.B. 130",
            "csv_suffix": "Ladung_PV_kWh",
            # Phase 2a: existiert eine Wallbox-Investition, ist SIE die kanonische
            # Quelle der Heimladung — dann nicht zusätzlich am E-Auto erfassen
            # (sonst Dual-Daten / Doppelzählung, siehe docs/KONZEPT-WALLBOX-EAUTO.md).
            "bedingung_anlage": "keine_wallbox",
            "hinweis": "Zu Hause aus PV geladene Energie (kWh, kumulativ oder Tagessensor). Nur ohne Wallbox — mit Wallbox wird die Heimladung dort erfasst. Alternativ per EV-Quote aus der Gesamt-Ladung berechnet.",
        },
        {
            "feld": "ladung_netz_kwh", "label": "Heim: Netz", "einheit": "kWh",
            "placeholder": "z.B. 50",
            "csv_suffix": "Ladung_Netz_kWh",
            "bedingung_anlage": "keine_wallbox",  # s. ladung_pv_kwh (Phase 2a)
            "hinweis": "Zu Hause aus dem Netz geladene Energie (kWh, kumulativ oder Tagessensor). Nur ohne Wallbox. Alternativ per EV-Quote berechnet.",
        },
        {
            "feld": "ladung_extern_kwh", "label": "Extern", "einheit": "kWh",
            "placeholder": "z.B. 36",
            "csv_suffix": "Ladung_Extern_kWh",
            "hinweis": "Unterwegs geladene Energie (Autobahn, Arbeit) in kWh. Meist manuell im Monatsabschluss. Optional.",
        },
        {
            "feld": "ladung_extern_euro", "label": "Extern Kosten", "einheit": "€",
            "placeholder": "z.B. 18.00",
            "csv_suffix": "Ladung_Extern_Euro",
            "hinweis": "Kosten der externen Ladung (€). Manuell. Optional.",
        },
        # Konditionell — nur wenn v2h_faehig=true oder nutzt_v2h=true:
        {
            "feld": "v2h_entladung_kwh", "label": "V2H Entladung", "einheit": "kWh",
            "bedingung": "v2h_faehig",
            "placeholder": "z.B. 25",
            "csv_suffix": "V2H_kWh",
            "hinweis": "Vehicle-to-Home zurück ins Haus gespeiste Energie (kWh, kumulativ oder Tagessensor). Nur bei V2H-fähigem Fahrzeug. Optional.",
        },
    ],

    "wallbox": [
        {
            "feld": "ladung_kwh", "label": "Ladung gesamt", "einheit": "kWh",
            "placeholder": "z.B. 200",
            "csv_suffix": "Ladung_kWh",
            "hinweis": "Gesamte von der Wallbox abgegebene Ladeenergie (kWh, kumulativer Zähler oder Tagessensor). Kanonische Heimladungs-Quelle (Phase 2a) — hier mappen, nicht am E-Auto.",
        },
        {
            "feld": "ladung_pv_kwh", "label": "Ladung PV", "einheit": "kWh",
            "placeholder": "z.B. 80",
            "csv_suffix": "Ladung_PV_kWh",
            "hinweis": "PV-Anteil der Wallbox-Ladung (kWh, kumulativ oder Tagessensor). Optional — manche Wallboxen (z. B. go-e) messen das separat.",
        },
        {
            "feld": "ladevorgaenge", "label": "Ladevorgänge", "einheit": "",
            "placeholder": "z.B. 12",
            "csv_suffix": "Ladevorgaenge",
            "typ": "int",
            "hinweis": "Anzahl der Ladevorgänge (kumulativer Zähler oder Tagessensor). Optional.",
        },
    ],

    # N-266: Hängen `pv-module` unter dem Balkonkraftwerk (seit 2026-08-17
    # möglich, damit zwei Module über Eck zwei Ausrichtungen tragen können),
    # dann wird `pv_erzeugung_kwh` zum **Aggregat seiner Kinder** — genau die
    # Rolle, die `Monatsdaten.pv_erzeugung_kwh` für die ganze Anlage hat: die
    # gemessenen Modulwerte gewinnen, das Aggregat füllt nur deren Lücken
    # (ADR-002/**P7**, aufgelöst in `services/pv_monatswerte.py`).
    #
    # ⛔ **Bewusst NICHT das `nur_manuell`-Muster des BKW-Akkus zwei Felder
    # weiter unten**, obwohl der Auftrag es als Blaupause vorsah. Beim Akku ist
    # der Kind-Weg strikt reicher (Live-Leistung, SoC, Energiefluss, Zählerpfad)
    # — das eigene Feld kennt nur einen Monatswert, es zu sperren verliert
    # nichts. Hier ist es umgekehrt: der Wechselrichter des BKW ist oft der
    # **einzige** Zähler, den es gibt, und die Module darunter haben gar keinen
    # eigenen Sensor. Das Feld zu sperren hätte dem Melder-Fall (ein Set, zwei
    # Ausrichtungen, ein Sensor) jede Erfassung genommen. Also bleibt es
    # vollständig zuordenbar; die Doppelzählung verhindert die **Leserichtung**,
    # nicht ein Erfassungsverbot.
    "balkonkraftwerk": [
        {
            "feld": "pv_erzeugung_kwh", "label": "Erzeugung", "einheit": "kWh",
            "csv_suffix": "Erzeugung_kWh",
            "csv_suffix_alt": "kWh",  # Rückwärtskompatibilität
            "aggregiert_in": "pv_erzeugung_sum",
            "hinweis": "Kumulativer kWh-Zähler (oder Tagessensor) der BKW-Erzeugung vom Wechselrichter. Immer ≥ 0. Sind dem Balkonkraftwerk PV-Module zugeordnet, gilt dieser Wert als deren Gesamtsumme: eigene Modulwerte haben Vorrang, dieser hier füllt die Lücken.",
        },
        {
            "feld": "eigenverbrauch_kwh", "label": "Eigenverbrauch", "einheit": "kWh",
            "csv_suffix": "Eigenverbrauch_kWh",
            "hinweis": "Direkt im Haushalt verbrauchte BKW-Erzeugung (kWh, kumulativ oder Tagessensor). Optional — sonst aus Erzeugung − Einspeisung berechnet.",
        },
        # Konditionell — nur wenn hat_speicher=true. ALTBESTAND, `nur_manuell`:
        # Der Kanon für einen BKW-Akku ist seit 2026-07-31 die **eigene
        # Speicher-Investition mit Parent Balkonkraftwerk** (Weg A) — die trägt
        # Live-Leistung, SoC, Energiefluss-Knoten und Zählerpfad, während diese
        # beiden Felder nur einen Monatswert kennen. Sie bleiben erfassbar,
        # damit gepflegte Werte lesbar bleiben, sind aber nicht mehr
        # **zuordenbar**: kein Sensor, kein MQTT-Topic. Wer sie gepflegt hat,
        # wird vom Daten-Checker auf Weg A gewiesen (`daten_checker/stammdaten.py`).
        {
            "feld": "speicher_ladung_kwh", "label": "Speicher Ladung", "einheit": "kWh",
            "bedingung": "hat_speicher",
            "nur_manuell": True,
            "csv_suffix": "Speicher_Ladung_kWh",
            "aggregiert_in": "batterie_ladung_sum",
            "hinweis": "In den BKW-Akku geladene Energie (kWh). Nur manuell oder per Import — für Sensor-/MQTT-Zuordnung den Akku als eigene Speicher-Investition mit Parent Balkonkraftwerk erfassen.",
        },
        {
            "feld": "speicher_entladung_kwh", "label": "Speicher Entladung", "einheit": "kWh",
            "bedingung": "hat_speicher",
            "nur_manuell": True,
            "csv_suffix": "Speicher_Entladung_kWh",
            "aggregiert_in": "batterie_entladung_sum",
            "hinweis": "Aus dem BKW-Akku entladene Energie (kWh). Nur manuell oder per Import — für Sensor-/MQTT-Zuordnung den Akku als eigene Speicher-Investition mit Parent Balkonkraftwerk erfassen.",
        },
    ],

    # Sonstiges: Felder hängen von der Kategorie ab (via get_felder_fuer_sonstiges)
    "sonstiges": {
        "erzeuger": [
            {
                "feld": "erzeugung_kwh", "label": "Erzeugung", "einheit": "kWh",
                "csv_suffix": "Erzeugung_kWh",
                "aggregiert_in": "pv_erzeugung_sum",
                "hinweis": "Erzeugte Energie (z. B. BHKW, Windrad) in kWh, kumulativer Zähler oder Tagessensor.",
            },
            {
                "feld": "eigenverbrauch_kwh", "label": "Eigenverbrauch", "einheit": "kWh",
                "csv_suffix": "Eigenverbrauch_kWh",
                "hinweis": "Direkt selbst verbrauchter Anteil der Erzeugung (kWh, kumulativ oder Tagessensor). Optional.",
            },
            {
                "feld": "einspeisung_kwh", "label": "Einspeisung", "einheit": "kWh",
                "csv_suffix": "Einspeisung_kWh",
                "hinweis": "Ins Netz eingespeister Anteil der Erzeugung (kWh, kumulativ oder Tagessensor). Optional.",
            },
            # Konzept-Wirtschaftlichkeit §9 Weg 2 (Bauschritt 9): eedc kennt
            # genau EINEN Einspeisesatz je Anlage (`Strompreis.anlage_id`). Wer
            # einen zweiten Erzeuger mit eigenem Vergütungssatz betreibt, kann
            # dessen Erlös deshalb nicht von eedc ausrechnen lassen — wohl aber
            # von Home Assistant: ein Template-Sensor kennt beide Sätze und
            # liefert den Betrag monatsgenau. Damit entfällt der geschätzte
            # Jahresbetrag aus §8/1 für diesen Fall.
            #
            # ⚠ KEIN Abzug von der Anlagen-Bewertung (Entscheid Maintainer,
            # 2026-08-10): zwei Vergütungssätze bedeuten zwei Messungen — sonst
            # könnte der Netzbetreiber nicht abrechnen. In den Anlagen-
            # Einspeisezähler gehört ohnehin nur die zum Anlagentarif vergütete
            # Menge; dieser Betrag kommt zusätzlich dazu. Der Hinweis sagt das.
            {
                "feld": "einspeise_erloes_euro", "label": "Einspeise-Erlös", "einheit": "€",
                "placeholder": "z. B. 42.30",
                "csv_suffix": "Einspeise_Erloes_Euro",
                "hinweis": (
                    "Erlös DIESES Erzeugers in € — für einen eigenen Einspeisetarif, "
                    "den eedc nicht kennen kann (es gibt einen Satz je Anlage). Am besten "
                    "als kumulativer Helfer-Sensor aus Home Assistant (state_class "
                    "total_increasing, device_class monetary), dann wird der Wert im "
                    "Monatsabschluss vorgeschlagen. Wichtig: In den Anlagen-Einspeisezähler "
                    "gehört nur die Menge, die zum Anlagentarif abgerechnet wird — dieser "
                    "Betrag kommt zusätzlich dazu."
                ),
            },
        ],
        "verbraucher": [
            {
                "feld": "verbrauch_sonstig_kwh", "label": "Verbrauch", "einheit": "kWh",
                "csv_suffix": "Verbrauch_kWh",
                "hinweis": "Verbrauchte Energie (z. B. Sauna, Pool) in kWh, kumulativer Zähler oder Tagessensor.",
            },
            {
                "feld": "bezug_pv_kwh", "label": "davon PV", "einheit": "kWh",
                "csv_suffix": "Bezug_PV_kWh",
                "hinweis": "PV-gedeckter Anteil des Verbrauchs (kWh, kumulativ oder Tagessensor). Optional.",
            },
            {
                "feld": "bezug_netz_kwh", "label": "davon Netz", "einheit": "kWh",
                "csv_suffix": "Bezug_Netz_kWh",
                "hinweis": "Netz-gedeckter Anteil des Verbrauchs (kWh, kumulativ oder Tagessensor). Optional.",
            },
        ],
        # Abgabe an Dritte — der dritte Weg der Netzpunkt-Bilanz (KONZEPT-
        # WIRTSCHAFTLICHKEITSRECHNUNG §9.2, Entscheid 05.09.2026, #402/N-378).
        # Mieterstrom, Allgemeinstrom, Nachbarhaus: Energie, die das Haus hinter
        # dem Hausanschluss verlässt, ohne Eigenverbrauch und ohne Netz-
        # Einspeisung zu sein. Die Menge ist ein ZÄHLER an der Übergabestelle —
        # gemessen, nie geschätzt; ohne Zähler bleibt die Handbuch-Grenze.
        "abgabe": [
            {
                "feld": "abgabe_kwh", "label": "Abgabe", "einheit": "kWh",
                "csv_suffix": "Abgabe_kWh",
                "hinweis": (
                    "An Dritte abgegebene Energie (Mieterstrom, Allgemeinstrom, "
                    "Nachbarhaus) in kWh — Zähler an der Übergabestelle, kumulativ "
                    "oder Tagessensor. eedc zieht sie vom Eigenverbrauch ab; sie ist "
                    "weder Eigenverbrauch noch Netz-Einspeisung."
                ),
            },
            {
                "feld": "einspeise_erloes_euro", "label": "Erlös", "einheit": "€",
                "placeholder": "z. B. 42.30",
                "csv_suffix": "Erloes_Euro",
                "hinweis": (
                    "Erlös aus der Abgabe in € (eigener Satz, den eedc nicht kennen "
                    "kann). Am besten als kumulativer Helfer-Sensor aus Home Assistant; "
                    "die Abrechnung an die Abnehmer ist nicht Sache von eedc."
                ),
            },
        ],
        "speicher": [
            # Hinweis: cockpit/komponenten.py liest erzeugung_kwh/verbrauch_sonstig_kwh
            # für Sonstiges-Speicher — diese Feldnamen sind bindend.
            {
                "feld": "erzeugung_kwh", "label": "Erzeugung/Entladung", "einheit": "kWh",
                "csv_suffix": "Erzeugung_kWh",
                "aggregiert_in": "batterie_entladung_sum",
                "hinweis": "Aus dem Speicher entladene Energie (kWh, kumulativer Zähler oder Tagessensor).",
            },
            {
                "feld": "verbrauch_sonstig_kwh", "label": "Verbrauch/Ladung", "einheit": "kWh",
                "csv_suffix": "Verbrauch_kWh",
                "aggregiert_in": "batterie_ladung_sum",
                "hinweis": "In den Speicher geladene Energie (kWh, kumulativer Zähler oder Tagessensor).",
            },
        ],
        # #377 / N-294 — Verbrauchszähler für Gas, Öl, Wasser: **erfassen und
        # anzeigen, nicht bewerten.** Die Kategorie führt genau EINEN Wert, den
        # **Zählerstand**; die einzige Rechnung darauf ist `Ende − Anfang` des
        # betrachteten Fensters. Die Einheit hängt am **Gerät**
        # (`zaehler_einheit`), nicht am Feld — deshalb steht hier `""`.
        #
        # ⚑ **Die leere Einheit IST die Sicherung, nicht eine Auslassung.**
        # `einheit_klasse("")` ist `None` (s. u.) ⇒ das Feld kann strukturell
        # nie als Energie gelesen werden: es fällt aus
        # `kumulative_zaehler_felder_je_typ()` heraus, aus der Energiebilanz,
        # aus Autarkie/Eigenverbrauch, aus dem Community-Datensatz. Wer hier
        # „m³" oder gar „kWh" einträgt — auch „nur der Klarheit halber" —,
        # hebt genau diesen Schutz auf und lässt Gas in die Strombilanz laufen.
        # Die Anzeige-Einheit kommt aus `einheit_fuer(feld, investition)`.
        "zaehler": [
            {
                "feld": "zaehlerstand", "label": "Zählerstand", "einheit": "",
                "einheit_je_geraet": "zaehler_einheit",
                "csv_suffix": "Zaehlerstand",
                # ⚑ **`stand: True` — der Marker, an dem F-58 hing** (dietmar1968,
                # T89667 #185, 21.08.2026). Der stündliche Snapshot-Job holte den
                # Wert wie jeden anderen Zähler über `get_value_at`, und das nimmt
                # bei `has_sum` **ausschließlich HAs `sum`**: die reset-bereinigte
                # **Verbrauchssumme seit Aufzeichnungsbeginn**. Für einen
                # Energiezähler ist das richtig und ausdrücklich so entschieden
                # (v3.25.18 / #184) — für einen **Zählerstand** ist es die falsche
                # Größe. Sein Wasserzähler meldete 47,360 m³, eedc zeigte 90.
                #
                # Ein Zählerstand ist eine **Bestandsgröße**: die Zahl, die auf dem
                # Zähler steht. Sie kommt aus `state`, nie aus `sum`, und sie wird
                # **nicht umgerechnet** (§3 des Modells). Der Marker steht am Feld
                # und nicht als Liste in `snapshot/keys.py` — das war N-259, wo
                # genau so eine zweite Handliste auseinandergelaufen ist.
                "stand": True,
                "hinweis": (
                    "Der abgelesene Zählerstand — die Zahl, die auf dem Zähler steht "
                    "(Gas, Wasser, Heizöl …). eedc rechnet daraus nur die Differenz "
                    "zwischen Anfang und Ende des angezeigten Zeitraums; in "
                    "Energiebilanz, Autarkie, Wirtschaftlichkeit und CO₂ geht der Wert "
                    "bewusst nicht ein. Aus einem Sensor (stündlich) oder im "
                    "Monatsabschluss von Hand."
                ),
            },
        ],
    },
}

# =============================================================================
# Live-Felder pro Investitionstyp (Echtzeit: W, kW, %, °C)
#
# Diese Felder werden als MQTT-Topics und im Sensor-Mapping-Wizard verwendet.
# "key"     — MQTT-Topic-Suffix / Sensor-Mapping-Key
# "label"   — Anzeigename
# "einheit" — W, %, °C
# "bedingung" — optional, gleiche Semantik wie in INVESTITION_FELDER
# =============================================================================

LIVE_FELDER_INV: dict = {
    # Live-Felder speisen ausschließlich das Live-Dashboard (Momentanwerte in W/%).
    # Für Monatswerte, Statistik und Wirtschaftlichkeit zählen die kWh-Felder oben —
    # ein fehlender Live-Sensor kostet also nur die Echtzeit-Anzeige.
    "pv-module": [
        {"key": "leistung_w", "label": "Leistung", "einheit": "W",
         "hinweis": "Momentane Leistung dieses Strings in W. Ohne eigenen Sensor je Modul "
                    "nutzt eedc „PV gesamt (W)“ der Anlage — sobald hier einer zugeordnet "
                    "ist, hat er Vorrang."},
    ],
    "wechselrichter": [
        {"key": "leistung_w", "label": "Leistung", "einheit": "W",
         "hinweis": "Momentane AC-Ausgangsleistung des Wechselrichters in W."},
    ],
    "speicher": [
        {"key": "leistung_w", "label": "Leistung", "einheit": "W",
         "hinweis": "Momentane Lade-/Entladeleistung in W. Ein vorzeichenbehafteter Sensor "
                    "genügt (+ laden / − entladen); zeigt er in die falsche Richtung, dreht "
                    "ihn das ⇅-Symbol am Wert."},
        {"key": "soc",        "label": "Ladestand", "einheit": "%",
         "hinweis": "Ladestand des Speichers in Prozent (0–100)."},
    ],
    "e-auto": [
        {"key": "leistung_w", "label": "Ladeleistung", "einheit": "W",
         "hinweis": "Momentane Ladeleistung des Fahrzeugs in W. Bei vorhandener Wallbox "
                    "misst diese meist dasselbe — denselben Sensor nicht beiden Geräten "
                    "zuordnen, sonst zählt die Live-Bilanz ihn doppelt."},
        {"key": "soc",        "label": "Ladestand",    "einheit": "%",
         "hinweis": "Ladestand der Fahrzeugbatterie in Prozent (0–100)."},
    ],
    "wallbox": [
        {"key": "leistung_w", "label": "Leistung", "einheit": "W",
         "hinweis": "Momentane Ladeleistung der Wallbox in W."},
    ],
    "waermepumpe": [
        {"key": "leistung_w",              "label": "Leistung gesamt",      "einheit": "W",
         # #263: mit Innengeräte-Liste gibt es ihn zusätzlich je Innengerät —
         # das Gerätefeld bleibt der Anlagenwert, die Kopien sind die Aufschlüsselung.
         "je_innengeraet": True,
         "label_je_innengeraet": "Leistung",
         "hinweis": "Momentane elektrische Leistungsaufnahme der Wärmepumpe in W "
                    "(nicht die abgegebene Wärmeleistung)."},
        {"key": "leistung_heizen_w",       "label": "Leistung Heizen",      "einheit": "W",
         "hinweis": "Elektrische Leistungsaufnahme im Heizbetrieb in W. Nur sinnvoll, wenn "
                    "Heizen und Warmwasser getrennt gemessen werden."},
        {"key": "leistung_warmwasser_w",   "label": "Leistung Warmwasser",  "einheit": "W",
         "hinweis": "Elektrische Leistungsaufnahme der Warmwasserbereitung in W. Nur "
                    "sinnvoll bei getrennter Messung."},
        # ⭐ **W-13 (26.08.2026) — die dritte Leistung, die es bis dahin nicht gab.**
        # `leistung_heizen_w` und `leistung_warmwasser_w` stehen hier seit Langem
        # und an JEDER Wärmepumpe; für den Kühlbetrieb gab es kein Gegenstück —
        # an keiner Bauart. MartyBr schreibt am 25.08. (T89667 #200): „getrennte
        # Zähler für Heizung, Warmwassererwärmung … und seit dem Sommer auch für
        # den **Kühlbetrieb**. Es werden sowohl die **Live-Werte (Power in W)**
        # als auch die kumulierten Werte (Energy in kWh) [erfasst]."
        #
        # ⚠ **Ohne diese Zeile erreicht R1 seinen Fall nur zur Hälfte:** die
        # Energie-Achse wird mit `betriebsart_strom_kuehlen_kwh` zuordenbar, seine
        # Live-Leistung bliebe heimatlos.
        #
        # ⛔ **Bewusst KEINE vier `betriebsart_leistung_*_w`.** An einem
        # Luft-Luft-Gerät stünden dann `leistung_heizen_w` und
        # `betriebsart_leistung_heizen_w` nebeneinander — dieselbe Zweideutigkeit
        # zweier Familien, an der ein Tester schon einmal zwei Felder addiert hat
        # (#89667/62). Eine Zeile in der bestehenden Familie, ohne Bedingung wie
        # ihre beiden Nachbarn.
        # ⭐ **Der Anzeigepfad kam am 13.09.2026 nach** (N-439, Entscheid Gernot
        # Tor G-K). Das Feld war seit W-13 zuordenbar und wurde an keiner
        # Station gelesen — „Live-Wert" stand als Zusage in WAS-IST-NEU, ohne
        # dass irgendetwas ihn zeigte. Jetzt läuft er den Weg der Nachbarn:
        # Live-Bild (Summe + Symbol), Live-Tagesverlauf und Tag-Stundenverlauf
        # (eigene Fläche), MQTT-Snapshot. **„Reine Anzeige" bleibt wörtlich
        # gültig:** aus diesem Feld entsteht keine kWh, keine Integration und
        # keine Kennzahl — die Mengen kommen aus dem Zähler (E4).
        {"key": "leistung_kuehlen_w",      "label": "Leistung Kühlen",      "einheit": "W",
         "hinweis": "Elektrische Leistungsaufnahme im Kühlbetrieb in W. Nur sinnvoll, "
                    "wenn der Kühlbetrieb getrennt gemessen wird — reine Anzeige: "
                    "erscheint im Live-Bild und als eigene Fläche im Tagesverlauf, "
                    "die Mengen kommen aus dem kWh-Zähler."},
        {"key": "warmwasser_temperatur_c", "label": "Warmwasser-Temperatur","einheit": "°C",
         "hinweis": "Temperatur im Warmwasserspeicher in °C — reine Anzeige, geht in keine "
                    "Berechnung ein."},
        # #263 K-2: der erste Wert in eedc, der ein ZUSTAND ist statt einer Zahl.
        # `zustand: True` ist keine Kosmetik, sondern die Weiche — siehe
        # ZUSTAND_LIVE_FELDER unter der Tabelle.
        {"key": "betriebsmodus", "label": "Betriebsmodus", "einheit": "",
         "zustand": True,
         "hinweis": "Die `climate`-Entität der Klimaanlage/Wärmepumpe (z. B. "
                    "`climate.wohnzimmer`) — sie meldet Heizen, Kühlen, Entfeuchten "
                    "oder Aus. Optional: ohne sie zählt eedc den Stromverbrauch wie "
                    "bisher als eine Zahl, mit ihr kann es sagen, welcher Teil davon "
                    "ins Heizen und welcher ins Kühlen ging. Ein Zustand, kein "
                    "Messwert — deshalb nur als HA-Sensor zuordenbar, nicht über MQTT."},
        # #263 — Raumtemperaturen einer Split-Klimaanlage. Bewusst **ohne
        # Auswertung**: sie gehen in keine Bilanz, keine Effizienz und keine
        # Bewertung ein, sondern stehen im Live-Block, weil sie da sind
        # (Entscheid Gernots, 2026-08-21). Mit Innengeräte-Liste je Gerät.
        {"key": "soll_temperatur_c", "label": "Soll-Temperatur", "einheit": "°C",
         "bedingung": "luft_luft", "je_innengeraet": True,
         "hinweis": "Eingestellte Zieltemperatur in °C — reine Anzeige, geht in keine "
                    "Berechnung ein."},
        {"key": "ist_temperatur_c", "label": "Raumtemperatur", "einheit": "°C",
         "bedingung": "luft_luft", "je_innengeraet": True,
         "hinweis": "Gemessene Raumtemperatur in °C — reine Anzeige, geht in keine "
                    "Berechnung ein."},
    ],
    "balkonkraftwerk": [
        {"key": "leistung_w", "label": "Leistung", "einheit": "W",
         "hinweis": "Momentane Leistung des Balkonkraftwerks in W."},
    ],
    "sonstiges": [
        {"key": "leistung_w", "label": "Leistung", "einheit": "W",
         "hinweis": "Momentane Leistung in W — bei einem Erzeuger positiv als Erzeugung, "
                    "bei einem Verbraucher als Verbrauch gewertet."},
    ],
}

# Live-Felder auf Anlage-Ebene (kein Investment-Bezug).
#
# `bedarf`/`bedarf_gruppe` steuern die Zuordnungs-Fläche (Datenquellen-V4):
# „pflicht" wird rot und aufgeklappt gezeigt, solange weder das Feld selbst noch
# ein anderes Mitglied seiner `bedarf_gruppe` eine Quelle hat; „optional" bleibt
# leise grau und zählt nicht als offener Punkt. Live-Felder sind durchweg
# optional — ohne sie bleibt nur das Live-Dashboard leer, die Statistik läuft
# über die kWh-Zählerstände weiter.
BASIS_LIVE_FELDER: list[dict] = [
    {"key": "einspeisung_w",       "label": "Einspeisung",              "einheit": "W",
     "hinweis": "Momentane Einspeiseleistung in W — nur für das Live-Dashboard. "
                "Alternative: ein einzelner Sensor mit Vorzeichen unter „Netz kombiniert (±)“."},
    {"key": "netzbezug_w",         "label": "Netzbezug",                "einheit": "W",
     "hinweis": "Momentane Bezugsleistung in W — nur für das Live-Dashboard. "
                "Alternative: ein einzelner Sensor mit Vorzeichen unter „Netz kombiniert (±)“."},
    {"key": "netz_kombi_w",        "label": "Netz kombiniert (±)",      "einheit": "W",
     "hinweis": "EIN vorzeichenbehafteter Netz-Sensor (+ Bezug / − Einspeisung) statt zweier "
                "getrennter. Wirkt nur, wenn „Einspeisung (W)“ und „Netzbezug (W)“ beide auf "
                "„keine“ stehen — sonst haben die getrennten Felder Vorrang. Zeigt der Sensor "
                "in die falsche Richtung, dreht ihn das ⇅-Symbol am Wert."},
    {"key": "pv_gesamt_w",         "label": "PV gesamt",                "einheit": "W",
     "hinweis": "Momentane PV-Leistung der ganzen Anlage in W. Nur nötig, wenn die PV-Module "
                "keine eigenen Leistungs-Sensoren haben — sobald dort einer zugeordnet ist, "
                "wird diese Angabe ignoriert."},
    {"key": "aussentemperatur_c",  "label": "Außentemperatur",          "einheit": "°C",
     "hinweis": "Außentemperatur in °C für Live-Anzeige und Wärmepumpen-Kontext. Optional — "
                "fehlt sie, nutzt eedc die Wetterdaten des Standorts."},
    # SFML- und Solcast-Sensoren werden per Auto-Discovery erkannt (prognose_discovery.py),
    # kein manuelles Mapping mehr nötig.
]

# Preis-Felder auf Anlage-Ebene — weder Zähler noch Live-Leistung.
#
# Eigene Familie, weil ein Preis an drei Stellen anders behandelt wird als die
# übrigen Basis-Felder:
#   1. **Kein MQTT.** Der Wert wird ausschließlich als HA-Sensor gelesen
#      (stündlicher LTS-Mittelwert, `energie_profil/_helpers.py`). Deshalb steht
#      er NICHT in `BASIS_ENERGY_TOPICS` — dort wäre er ein erwartetes
#      MQTT-Topic, das niemand bedient, und der Abdeckungs-Check (#134) würde
#      ihn als Lücke melden.
#   2. **Kein Zähler.** `state_class: measurement` ist hier richtig; der
#      LTS-Summen-Check ist nicht zuständig (`daten_checker/sensoren.py`).
#   3. **Nur bei dynamischem Tarif sichtbar.** Bei einem Festpreis gehört der
#      Preis in die Stammdaten, nicht an einen Sensor — und ein angebotener
#      Preis-Slot verleitet genau dazu (Forum simon42 #89667/54, MartyBr hatte
#      seinen Festpreis-Template-Sensor mangels Alternative an den
#      Speicher-Ø-Ladepreis gehängt).
#
# Der Slot existierte bis v3 im Sensor-Mapping-Wizard („Basis-Sensoren") und ist
# beim V4-Umbau ersatzlos entfallen — das Backend las `basis.strompreis` weiter,
# nur setzen konnte man ihn nicht mehr. Bestehende v3-Zuordnungen waren davon
# nie betroffen.
BASIS_PREIS_FELDER: list[dict] = [
    {"key": "strompreis", "label": "Strompreis (dynamischer Tarif)", "einheit": "ct/kWh",
     "bedingung_basis": "dynamischer_tarif",
     "hinweis": "HA-Sensor mit dem aktuellen Arbeitspreis (Tibber, aWATTar, EPEX-Endpreis). "
                "eedc schreibt daraus die Stundenpreise mit und rechnet damit den "
                "verbrauchsgewichteten Ø-Bezugspreis des Monats sowie den Ø-Ladepreis der "
                "Speicher-Netzladung. Einheit ct/kWh oder €/kWh — eedc rechnet um. "
                "Ohne Sensor bleibt der Arbeitspreis aus den Stammdaten maßgeblich."},
]

# =============================================================================
# Bedarf je Feld — steuert die Zuordnungs-Fläche (Datenquellen-V4)
#
# EINE Tabelle statt eines Attributs an ~40 verstreuten Feld-Dicts: die
# Einstufung ist eine fachliche Festlegung und muss an einer Stelle prüfbar
# bleiben. Die Feld-TEXTE (`hinweis`) stehen weiter beim Feld — Text beschreibt,
# diese Tabelle bewertet.
#
#   "pflicht"  — ohne diesen Wert fehlt eine Kernauswertung. Die Fläche zeigt
#                das Feld rot und mit aufgeklapptem Hinweis, solange weder es
#                selbst noch ein Mitglied seiner `gruppe` eine Quelle hat.
#   "optional" — leise grau, zählt nie als offener Punkt.
#
# `gruppe` = Alternativ-Gruppe: EINE belegte Quelle in der Gruppe genügt, die
# übrigen Mitglieder gelten dann als abgedeckt (nicht als Lücke). Das löst die
# Konstellationen auf, in denen zwei Erfassungswege einander ausschließen:
#   pv_energie — Anlagen-Zählerstand ODER Zähler je PV-Modul/Balkonkraftwerk
#   pv_live    — Anlagen-Leistung ODER Leistung je Modul
#   netz_live  — „Netz kombiniert (±)" ODER Einspeisung+Netzbezug getrennt
#
# WICHTIG — „keine Quelle" ist kein Fehler: alle kWh-Felder lassen sich im
# Monatsabschluss auch manuell erfassen. Rot heißt deshalb „hier fehlt noch
# etwas", nie „falsch"; die Hinweistexte nennen die manuelle Alternative.
# =============================================================================

FELD_BEDARF: dict[tuple[str, str], tuple[str, Optional[str]]] = {
    # ── Anlage (Basis) ──────────────────────────────────────────────────────
    # Kernwerte laut Daten-Checker (`daten_checker/monatsdaten.py`: „Kernfeld —
    # ohne Einspeisung sind Eigenverbrauch und Autarkie nicht berechenbar").
    ("basis", "einspeisung_kwh"): ("pflicht", None),
    ("basis", "netzbezug_kwh"): ("pflicht", None),
    ("basis", "pv_gesamt_kwh"): ("pflicht", "pv_energie"),
    # Live-Felder sind durchweg optional: ohne sie bleibt das Live-Dashboard
    # leer, die Statistik läuft über die kWh-Zählerstände weiter.
    ("basis", "einspeisung_w"): ("optional", "netz_live"),
    ("basis", "netzbezug_w"): ("optional", "netz_live"),
    ("basis", "netz_kombi_w"): ("optional", "netz_live"),
    ("basis", "pv_gesamt_w"): ("optional", "pv_live"),
    ("basis", "aussentemperatur_c"): ("optional", None),

    # ── PV ──────────────────────────────────────────────────────────────────
    ("pv-module", "pv_erzeugung_kwh"): ("pflicht", "pv_energie"),
    ("pv-module", "leistung_w"): ("optional", "pv_live"),
    # ⛔ Kein PV-Erzeuger mehr (Gernot 24.08.2026) — und DIESE Zeile war der
    # eigentliche Schaden: als Mitglied der Gruppe `pv_energie` hat ein hier
    # belegtes Feld `basis:pv_gesamt` UND das Modul-Feld auf „bereits an
    # anderer Stelle zugeordnet" gesetzt, waehrend es selbst nirgends gelesen
    # wurde. Drei Quellen inaktiv, keine wirksam (#388/F-57). `("optional",
    # None)` statt Streichung: der Eintrag traegt die Begruendung, und ein
    # fehlender Schluessel faellt still auf FELD_BEDARF_DEFAULT zurueck.
    ("wechselrichter", "pv_erzeugung_kwh"): ("optional", None),
    ("wechselrichter", "leistung_w"): ("optional", "pv_live"),
    ("balkonkraftwerk", "pv_erzeugung_kwh"): ("pflicht", "pv_energie"),
    ("balkonkraftwerk", "leistung_w"): ("optional", "pv_live"),
    ("balkonkraftwerk", "eigenverbrauch_kwh"): ("optional", None),
    ("balkonkraftwerk", "speicher_ladung_kwh"): ("optional", None),
    ("balkonkraftwerk", "speicher_entladung_kwh"): ("optional", None),

    # ── Speicher ────────────────────────────────────────────────────────────
    # Ohne Lade-/Entlademenge bleibt die gesamte Speicher-Auswertung leer und
    # der Hausverbrauch wird falsch gerechnet (Daten-Checker warnt darauf).
    ("speicher", "ladung_kwh"): ("pflicht", None),
    ("speicher", "entladung_kwh"): ("pflicht", None),
    ("speicher", "ladung_netz_kwh"): ("optional", None),
    ("speicher", "speicher_ladepreis_cent"): ("optional", None),
    ("speicher", "leistung_w"): ("optional", None),
    ("speicher", "soc"): ("optional", None),

    # ── Wärmepumpe ──────────────────────────────────────────────────────────
    # Strom UND abgegebene Wärme: erst beide zusammen ergeben JAZ, Ersparnis
    # und CO₂. Der Strom kommt je nach Parameter aus einem oder zwei Feldern.
    ("waermepumpe", "stromverbrauch_kwh"): ("pflicht", "wp_strom"),
    ("waermepumpe", "strom_heizen_kwh"): ("pflicht", "wp_strom"),
    ("waermepumpe", "strom_warmwasser_kwh"): ("pflicht", "wp_strom"),
    # Ausnahme Split-Klimaanlage: s. KLIMA_OHNE_WAERMEMENGE unter der Tabelle.
    #
    # N-391: **eine ALTERNATIV-Gruppe** (`BEDARF_GRUPPEN_ALTERNATIV` unter der
    # Tabelle) — wer EINEN gemeinsamen Wärmemengenzähler hat, trägt seinen Wert
    # unter *Wärme gesamt* ein, und *Heizwärme* ist damit gedeckt. Beide Wege
    # führen zur selben Größe; keiner ist ein Summand des anderen.
    ("waermepumpe", "heizenergie_kwh"): ("pflicht", "wp_waerme"),
    ("waermepumpe", "waerme_kwh"): ("pflicht", "wp_waerme"),
    ("waermepumpe", "warmwasser_kwh"): ("optional", None),
    ("waermepumpe", "leistung_w"): ("optional", None),
    ("waermepumpe", "leistung_heizen_w"): ("optional", None),
    ("waermepumpe", "leistung_warmwasser_w"): ("optional", None),
    ("waermepumpe", "leistung_kuehlen_w"): ("optional", None),
    ("waermepumpe", "warmwasser_temperatur_c"): ("optional", None),
    # #263 K-2 (Konzept §7 E-E): JEDER Wärmepumpe angeboten, nicht nur
    # `wp_art = luft_luft`. Der Grund ist gemessen, nicht vorsorglich:
    # azywietz-webs zwei Klimaanlagen laufen als `luft_wasser`, weil das Feld
    # „Wärmepumpenart" als Community-Einstellung beschriftet war — wer nur
    # `luft_luft` bedient, baut an genau der Gruppe vorbei, die das Thema
    # meldet. Es gibt außerdem Luft-Wasser-Wärmepumpen MIT Kühlfunktion.
    # „optional": wer keinen Modus-Sensor zuordnet, merkt nichts.
    ("waermepumpe", "betriebsmodus"): ("optional", None),

    # ── E-Auto ──────────────────────────────────────────────────────────────
    # Kilometer sind der Bezugswert für Effizienz und Benzin-Vergleich.
    # Die Heimladungs-Felder sind bei vorhandener Wallbox verdrängt
    # (`bedingung_anlage: keine_wallbox`) — das wertet die Fläche selbst aus.
    ("e-auto", "km_gefahren"): ("pflicht", None),
    # #407: der Stand ist Hilfe, nicht Pflicht — wer die Menge kennt, trägt sie ein.
    ("e-auto", "km_stand"): ("optional", None),
    ("e-auto", "verbrauch_kwh"): ("optional", None),
    ("e-auto", "ladung_pv_kwh"): ("optional", None),
    ("e-auto", "ladung_netz_kwh"): ("optional", None),
    ("e-auto", "ladung_extern_kwh"): ("optional", None),
    ("e-auto", "ladung_extern_euro"): ("optional", None),
    ("e-auto", "v2h_entladung_kwh"): ("optional", None),
    ("e-auto", "leistung_w"): ("optional", None),
    ("e-auto", "soc"): ("optional", None),

    # ── Wallbox ─────────────────────────────────────────────────────────────
    ("wallbox", "ladung_kwh"): ("pflicht", None),
    ("wallbox", "ladung_pv_kwh"): ("optional", None),
    ("wallbox", "ladevorgaenge"): ("optional", None),
    ("wallbox", "leistung_w"): ("optional", None),
}

# Default für alles, was nicht in der Tabelle steht (u. a. „sonstiges", dessen
# Felder kategorie-abhängig erzeugt werden): nie rot, nie als Lücke gezählt.
FELD_BEDARF_DEFAULT: tuple[str, Optional[str]] = ("optional", None)

# Die Gruppen, deren Mitglieder **Alternativen** sind — ein belegtes Feld deckt
# die Gruppe, die übrigen sind dann nichts mehr einzutragen.
#
# ⭐ **Warum diese Menge existiert (N-391, 14.09.2026).** Die Spalte
# `bedarf_gruppe` trug bis dahin ZWEI Bedeutungen in einem Wort:
#
# * **Alternativen** — Anlagen-Gesamtzähler *oder* Komponentenzähler
#   (`pv_energie`), kombinierter *oder* getrennter Netz-Live-Sensor
#   (`netz_live`), gemeinsamer *oder* getrennte Wärmemengenzähler (`wp_waerme`).
#   Ein belegtes Mitglied macht die Gruppe vollständig.
# * **Summanden** — `wp_strom` bei getrennter Strommessung: `strom_heizen_kwh`
#   und `strom_warmwasser_kwh` tragen **zusammen** den Verbrauch, jedes einzeln
#   nur die Hälfte. Genau das hat N-456 (13.09.) festgestellt und mit
#   `pflicht_am_geraet` abgesichert.
#
# ⛔ **Ohne die Unterscheidung an EINER Stelle wäre N-391 an N-456 gescheitert:**
# `heizenergie_kwh` und `waerme_kwh` sind an jedem Gerät beide „pflicht", also
# hätte die Regel von N-456 („zwei Pflichtfelder derselben Gruppe sind
# Summanden") sie beide gefordert — die Zuordnungs-Fläche und der Daten-Checker
# hätten einen zweiten Wärmemengenzähler angemahnt, den es nicht gibt.
# Die Alternative wären zwei Sonderregeln in zwei Konsumenten gewesen; die
# benannte Menge sagt es einmal.
BEDARF_GRUPPEN_ALTERNATIV: frozenset[str] = frozenset({
    "pv_energie", "pv_live", "netz_live", "wp_waerme",
})

# Felder, deren Pflicht bei einer Split-Klimaanlage (`wp_art="luft_luft"`) entfällt.
#
# Die Tabelle oben kennt nur (typ, feld) — für die Wärmepumpe reicht das nicht: eine
# Split-Klimaanlage hat weder Wärmemengenzähler noch Warmwasserkreis. Genau deshalb
# stellt der Daten-Checker die „Heizwärme fehlt"-Forderung dort seit K-0 NICHT mehr
# (`daten_checker/monatsdaten.py::_check_wp_monatsdaten`, Begründung dort:
# „Dauer-Falschpositiv"). Die Zuordnungs-Fläche stellte sie weiter — dieselbe Anlage,
# zwei Flächen, gegenteilige Aussage: der Checker schwieg, *Einstellungen →
# Datenquellen* zeigte „Heizwärme" rot, aufgeklappt und zählte sie als offene Pflicht
# (Fund N-86; Melder mit Klimaanlage: dietmar1968 #89667/87, kingcap1 #263).
#
# „optional" und nicht „inaktiv": inaktiv heißt „ein anderer Weg gewinnt"
# (Alternativ-Gruppe belegt, verdrängendes Gerät) — hier gewinnt kein anderer Weg,
# die Größe existiert an diesem Gerät schlicht nicht. Wer doch einen
# Wärmemengenzähler an seiner Klimaanlage hat, ordnet ihn weiterhin zu.
#
# `warmwasser_kwh` steht bewusst nicht hier: es ist ohnehin schon „optional".
KLIMA_OHNE_WAERMEMENGE: frozenset[tuple[str, str]] = frozenset({
    ("waermepumpe", "heizenergie_kwh"),
})


def get_feld_bedarf(
    typ: str, feld: str, parameter: Optional[dict] = None,
) -> tuple[str, Optional[str]]:
    """Bedarf + Alternativ-Gruppe eines Felds — siehe {@link FELD_BEDARF}.

    `parameter` ist das `Investition.parameter`-Dict des Geräts (auf Anlagen-Ebene
    None). Ohne es bleibt die reine (typ, feld)-Einstufung — Aufrufer, die keinen
    Geräte-Kontext haben, müssen nichts wissen.
    """
    # #263 — je-Innengerät-Keys erben die Einstufung ihres Basis-Felds.
    feld = basis_feld_key(feld)
    bedarf = FELD_BEDARF.get((typ, feld), FELD_BEDARF_DEFAULT)
    if (typ, feld) in KLIMA_OHNE_WAERMEMENGE and ist_luft_luft_waermepumpe(parameter):
        return ("optional", bedarf[1])
    # B2 (05.09.2026, R1): **Ein erweitertes Feld ist nie Pflicht.** Die weiche
    # Bedingung sagt „an diesem Gerät untypisch, aber möglich" — wer es
    # gepflegt hat, meint es so; wer nicht, dem fehlt nichts. Bis dahin galt
    # `strom_heizen_kwh` an einer Brauchwasser-Wärmepumpe als Pflicht, obwohl
    # dieselbe Registry es hinter „Weitere Größen erfassen" stellte: dieselbe
    # Anlage, zwei Aussagen. Die Regel steht HIER, damit jeder Frager (Checker,
    # Topic-Registry, Zuordnungs-Fläche) dieselbe Antwort bekommt.
    if parameter is not None and feld_urteil(typ, feld, parameter) == URTEIL_ERWEITERT:
        return ("optional", bedarf[1])
    return bedarf


def feld_urteil(typ: str, feld: str, parameter: Optional[dict]) -> str:
    """Gilt das Feld an diesem Gerät, ist es **erweitert**, oder gibt es die Größe nicht?

    Öffentliche Lesetür auf `bedingungs_urteil` für Frager außerhalb der
    Registry (B2, 05.09.2026). ⭐ **Sie ist die eine Antwort auf die Frage, die
    bis dahin vier Daten-Checker-Stellen selbst mit `ist_luft_luft_waermepumpe`
    beantworteten** — jede ein wenig anders (Erwartung nach Bauart, Schweigen
    nach Bauart, Label nach Bauart). SOLL Wärme/Klima R1: *was ein Gerät liefern
    kann, sagt der zugeordnete Zähler, nicht seine Bauart* — und was die Bauart
    **vorschlagen** darf, steht genau einmal, in den `bedingung`/`weich`-Einträgen
    dieser Registry. Wer fragt, fragt hier; die Bauart selbst liest er nicht mehr
    (ADR-002/P13 hält das baumweit).

    Fail-open wie `groesse_gibt_es_am_geraet`: unbekannter Typ oder unbekanntes
    Feld ⇒ ``URTEIL_GILT``.
    """
    feld = basis_feld_key(feld)
    for eintrag in INVESTITION_FELDER.get(typ) or ():
        if not isinstance(eintrag, dict) or eintrag.get("feld") != feld:
            continue
        return bedingungs_urteil(
            eintrag.get("bedingung"), eintrag.get("weich"), _bedingungs_werte(parameter),
        )
    return URTEIL_GILT


def feld_herabgestuft(typ: str, feld: str, parameter: Optional[dict]) -> bool:
    """Hat die Registry dieses Feld **für dieses Gerät** zurückgenommen?

    ``True``, wenn die Größe am Gerät nicht existiert (``URTEIL_NEIN``),
    erweitert ist (``URTEIL_ERWEITERT``) oder ihr Bedarf gegenüber dem Typ-
    Default herabgesetzt wurde (`KLIMA_OHNE_WAERMEMENGE`: Heizwärme an einer
    Split-Klimaanlage ist optional statt Pflicht). Das ist die Frage, die ein
    Hinweis stellen muss, bevor er eine Zusatz-Messstelle anmahnt: **Erwartet
    eedc diese Größe an diesem Gerät überhaupt?** — und die Antwort kommt aus
    der Registry, nicht aus der Bauart (B2, R1).
    """
    feld = basis_feld_key(feld)
    if feld_urteil(typ, feld, parameter) != URTEIL_GILT:
        return True
    return get_feld_bedarf(typ, feld, parameter)[0] != get_feld_bedarf(typ, feld, None)[0]


def pflicht_felder_am_geraet(
    typ: str, parameter: Optional[dict], gruppe: Optional[str] = None,
) -> list[str]:
    """Die Felder, die dieses Gerät **liefern muss** — Pflicht UND am Gerät geltend.

    ``gruppe`` schränkt auf eine Alternativ-Gruppe der `FELD_BEDARF`-Tabelle ein
    (z. B. ``"wp_strom"`` — die Zählerfelder, die die Energieprofil-Abdeckung
    prüft). Ohne sie kommen alle Pflichtfelder, also auch die Heizwärme, die
    keine Zählerfrage ist.

    Registry-Antwort auf „welche Zähler erwartet der Daten-Checker?" (B2). Ein
    Feld zählt, wenn sein Bedarf `pflicht` ist und sein Urteil ``URTEIL_GILT``
    (weder erweitert noch nicht vorhanden). Für die Wärmepumpe ergibt das je nach
    Parametern: ohne getrennte Strommessung ``stromverbrauch_kwh``; mit ihr
    ``strom_heizen_kwh`` + ``strom_warmwasser_kwh``; an einer Split-Klimaanlage
    entfällt die Warmwasser-Seite (kein Warmwasserkreis, N-304/B5), an einer
    Brauchwasser-Wärmepumpe die Heiz-Seite (erweitert, A6). **Kein `if wp_art`
    im Frager** — die Ausnahmen stehen in der Registry, einmal.

    ⚠ **Felder einer ALTERNATIV-Gruppe stehen hier weiterhin mit drin**
    (`heizenergie_kwh`): Die Liste sagt, was eedc an diesem Gerät **erwartet**,
    und das tut sie weiter. Ob ein belegtes Geschwisterfeld sie **verdrängen**
    darf, ist eine andere Frage — sie wird dort beantwortet, wo verdrängt wird
    (`mqtt_topic_registry` setzt `pflicht_am_geraet`, `stufe_bedarf_ein` liest
    es), und zwar an `BEDARF_GRUPPEN_ALTERNATIV`.
    """
    felder = INVESTITION_FELDER.get(typ)
    if not isinstance(felder, list):
        return []
    out: list[str] = []
    for eintrag in felder:
        if not isinstance(eintrag, dict) or eintrag.get("nur_bestand"):
            continue
        feld = eintrag["feld"]
        bedarf, bedarf_gruppe = get_feld_bedarf(typ, feld, parameter)
        if bedarf != "pflicht":
            continue
        if gruppe is not None and bedarf_gruppe != gruppe:
            continue
        if feld_urteil(typ, feld, parameter) != URTEIL_GILT:
            continue
        out.append(feld)
    return out


# Typen mit SoC-Live-Sensor (aus LIVE_FELDER_INV abgeleitet)
SOC_TYPEN: frozenset[str] = frozenset(
    typ for typ, felder in LIVE_FELDER_INV.items()
    if any(f["key"] == "soc" for f in felder)
)


# Live-Felder, deren Wert ein ZUSTAND ist statt einer Zahl (#263 K-2).
#
# **Warum diese Menge existiert und nicht drei verstreute Ausnahmen.** Der
# gesamte Live-Pfad ist numerisch, und zwar an drei Stellen unabhängig
# voneinander:
#
#   1. `live_power_service._states_zu_w` → `normalize_to_w(float(state))` — läuft
#      über JEDE Live-Zuordnung, alle 5 Sekunden. Ein `climate`-State ergibt dort
#      garantiert `None`; es wäre ein Dauerabruf ohne Ergebnis.
#   2. `mqtt_inbound_service` → `float(payload)`. Ein Modus über MQTT ist damit
#      nicht empfangbar — also wird er auch nicht als Topic **angeboten**, statt
#      dem Anwender eine Quelle hinzustellen, die nichts liefert (die P-6-Falle:
#      ein Hinweis bzw. hier ein Angebot, das niemand einlösen kann).
#   3. `daten_checker/sensoren.py` prüft Einheiten (kW≠kWh) — ein Feld ohne
#      Einheit hat dort nichts zu suchen.
#
# Statt an jeder dieser Stellen `if key == "betriebsmodus"` zu schreiben, steht
# die Eigenschaft **am Feld** und wird von hier gelesen. Ein zweites
# Zustandsfeld erbt damit alle drei Weichen, ohne dass jemand sie sucht.
#
# ⚠ Die Umkehrung gilt ausdrücklich: was hier NICHT steht, ist eine Zahl. Wer
# ein Feld ohne `einheit` einträgt, hat damit noch kein Zustandsfeld gebaut.
ZUSTAND_LIVE_FELDER: frozenset[tuple[str, str]] = frozenset(
    (typ, f["key"])
    for typ, felder in LIVE_FELDER_INV.items()
    for f in felder
    if f.get("zustand")
)

# Nur die Feld-Keys — für die Pfade, die ihren Investitionstyp nicht kennen
# (der Live-Poller sieht `{inv_id: {key: entity}}` ohne Typ-Kontext).
ZUSTAND_FELD_KEYS: frozenset[str] = frozenset(key for _, key in ZUSTAND_LIVE_FELDER)


def einheit_fuer(feld: str, investition=None) -> str:
    """Die Einheit, die neben diesem Wert stehen soll — **der eine Leser** (#377).

    Für fast jedes Feld steht sie fest in der Registry (`FELD_EINHEITEN`). Für
    den **Zählerstand** nicht: Er ist einheitenlos gespeichert, und was daneben
    steht (m³, l, kg, t, kWh), hängt am **Gerät** — ein Haushalt kann einen
    Gaszähler in m³ und einen Wasserzähler in m³ und einen Öltank in Litern
    führen.

    **Warum die Eigenschaft am Feld steht und nicht als `if feld ==`:**
    dieselbe Bauform wie `ZUSTAND_LIVE_FELDER`/`ist_zustand_feld` (#263 K-2) —
    *Eigenschaft am Feld, abgeleitete Menge, ein Leser*. Ein zweites Feld mit
    geräteabhängiger Einheit kostet damit einen Registry-Eintrag
    (`einheit_je_geraet: "<param>"`) und keine neue Verzweigung.

    ⚠ **Die Einheit ist Anzeige, nie Rechnung.** eedc rechnet Zählerstände
    grundsätzlich nicht um. Wer sein Gerät von m³ auf kWh umstellt, ändert das
    Wort neben der Zahl — die Zahl bleibt, wie der Zähler sie meldet.
    """
    # #263 — je-Innengerät-Keys tragen die Einheit ihres Basis-Felds.
    feld = basis_feld_key(feld)
    param_key = FELD_EINHEIT_JE_GERAET.get(feld)
    if param_key:
        if investition is not None:
            wert = (getattr(investition, "parameter", None) or {}).get(param_key)
            if wert:
                return str(wert)
        # Gerät ohne gepflegte Einheit: der Registry-Default gilt. Lokaler
        # Import, weil `investition_parameter` die Defaults führt und ein
        # Top-Level-Import dieses Basis-Modul an es binden würde.
        from backend.core.investition_parameter import PARAM_SONSTIGES_DEFAULTS

        standard = PARAM_SONSTIGES_DEFAULTS.get(param_key)
        if standard:
            return str(standard)
    return FELD_EINHEITEN.get(feld, "")


def ist_zustand_feld(feld: str, typ: Optional[str] = None) -> bool:
    """Ist dieses Live-Feld ein Zustand statt einer Zahl? — siehe {@link ZUSTAND_LIVE_FELDER}.

    `typ` schärft die Antwort, wo der Aufrufer ihn hat; ohne ihn gilt der
    Feld-Key allein. Beides ist gewollt: die Zuordnungs-Fläche kennt den Typ,
    der Live-Poller nicht.
    """
    # #263: Der Key kann eine Innengeräte-Adresse tragen
    # (`betriebsmodus-3`). Die Zustands-Eigenschaft hängt am Feld, nicht am
    # Innengerät — ohne Auflösung liefe eine `climate`-Entität in den
    # 5-Sekunden-Poller und in ein MQTT-Topic, das `float(payload)` nie
    # annehmen kann.
    basis = basis_feld_key(feld)
    if typ is not None:
        return (typ, basis) in ZUSTAND_LIVE_FELDER
    return basis in ZUSTAND_FELD_KEYS


# =============================================================================
# Alte Feldnamen → neue kanonische Namen (für Lese-Kompatibilität mit alten DB-Einträgen)
LEGACY_FELDNAMEN: dict[str, str] = {
    "speicher_ladung_netz_kwh": "ladung_netz_kwh",   # Speicher Arbitrage
    "entladung_v2h_kwh":        "v2h_entladung_kwh", # E-Auto V2H
}

# Summen-Keys die _import_investition_monatsdaten_v09 zurückgibt
IMPORT_SUMMEN_KEYS = ("pv_erzeugung_sum", "batterie_ladung_sum", "batterie_entladung_sum")


# =============================================================================
# Hilfsfunktionen
# =============================================================================

def get_feld_hinweise() -> dict[str, dict[str, str]]:
    """Liefert die Feld-Hilfetexte als ``{kontext: {schluessel: hinweis}}``.

    Single Source of Truth für alle Hilfetexte (Sensor-Zuordnungs-Wizard,
    künftiger MQTT-Inbound-Wizard, manuelle Monatsdaten-Eingabe). Speist sich
    ausschließlich aus den ``hinweis``-Attributen der Felddefinitionen.

    Kontext-Schlüssel:
      - ``"basis"``            → keyed by ``mapping_key`` (so adressiert der
                                 BasisSensorenStep, z. B. ``"einspeisung"``)
      - Investitionstyp        → keyed by ``feld`` (z. B. ``"e-auto"``)
      - ``"sonstiges:<kat>"``  → keyed by ``feld``, je Sonstiges-Kategorie
                                 (Feldname allein ist mehrdeutig: Verbraucher
                                 vs. Speicher)
    """
    result: dict[str, dict[str, str]] = {}

    basis: dict[str, str] = {}
    for e in (*BASIS_FELDER, *BEDINGTE_BASIS_FELDER):
        mk, hinweis = e.get("mapping_key"), e.get("hinweis")
        if mk and hinweis:
            basis[mk] = hinweis
    result["basis"] = basis

    for typ, val in INVESTITION_FELDER.items():
        if isinstance(val, dict):  # sonstiges → nach Kategorie aufgeschlüsselt
            for kat, felder in val.items():
                result[f"sonstiges:{kat}"] = {
                    e["feld"]: e["hinweis"] for e in felder if e.get("hinweis")
                }
        else:
            result[typ] = {e["feld"]: e["hinweis"] for e in val if e.get("hinweis")}

    return result


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


#: Bedingungs-Schlüssel, die eine **Geräteklasse** beschreiben statt eines
#: Schalters. Der Unterschied entscheidet auf der Zuordnungs-Fläche
#: (`get_alle_felder_fuer_investition`): Ein Schalter ist umlegbar, sein Feld
#: bleibt deshalb zuordenbar; eine Geräteklasse schließt die Größe aus, ihr Feld
#: verschwindet. Weiche Bedingungen sind von beidem unberührt — sie entfernen
#: nie, sie markieren (`bedingungs_urteil`).
GERAETEKLASSEN_SCHLUESSEL: Final[frozenset[str]] = frozenset(
    {"luft_luft", "brauchwasser"}
)


def _ist_geraeteklasse(bedingung) -> bool:
    """Trägt `bedingung` einen Geräteklassen-Schlüssel? (auch negiert, auch in Liste)"""
    if not bedingung:
        return False
    tokens = (bedingung,) if isinstance(bedingung, str) else tuple(bedingung)
    return any(t.lstrip("!") in GERAETEKLASSEN_SCHLUESSEL for t in tokens)


def _bedingungs_werte(parameter: Optional[dict]) -> dict[str, bool]:
    """Die Bedingungs-Keys einer Investition — eine Auswertung für alle Feld-Wege.

    Dieselben Keys steuern `bedingung` (Feld zeigen?) und `label_wenn` (wie heißt
    es dann?). Beide Wege lesen sie hier, damit die Zuordnungs-Fläche kein zweites,
    abweichendes Bild bekommt.
    """
    params = parameter or {}
    arbitrage_faehig = bool(params.get("arbitrage_faehig"))
    return {
        # #263: eine Betriebsart (Heizen/Kühlen/Lüften/Entfeuchten) hat nur ein
        # Klimagerät — bei der Luft-Wasser-WP heißt die Achse Heizen/Warmwasser.
        "luft_luft": ist_luft_luft_waermepumpe(params),
        # R1/A6: ein Gerät mit ausschließlich Warmwasser-Achse. Steuert die
        # WEICHE Herabstufung von Heizen — nie deren Entfernung.
        "brauchwasser": ist_brauchwasser_waermepumpe(params),
        "getrennte_strommessung": bool(params.get("getrennte_strommessung")),
        "arbitrage_faehig": arbitrage_faehig,
        # Arbitrage impliziert Netzladung — das Flag ist nur ein Erfassungs-Schalter,
        # die UI für `ladung_netz_kwh` muss auch ohne Arbitrage sichtbar sein können.
        "laedt_aus_netz": bool(params.get("laedt_aus_netz")) or arbitrage_faehig,
        "v2h_faehig": bool(params.get("v2h_faehig") or params.get("nutzt_v2h")),
        "hat_speicher": bool(params.get("hat_speicher")),
    }


#: Die drei Ausgänge von `bedingungs_urteil`.
URTEIL_GILT: Final[str] = "gilt"
URTEIL_ERWEITERT: Final[str] = "erweitert"
URTEIL_NEIN: Final[str] = "nein"


#: `bedingung_anlage` → der Investitionstyp, dessen Vorhandensein das Feld
#: verdrängt. **Der eine Ort dieser Zuordnung** (N-79).
#:
#: ⚠ Bis 2026-08-29 stand dieselbe Abbildung **zweimal** fest verdrahtet: hier
#: als `if`-Kette in `get_felder_fuer_investition` und als `_VERDRAENGT_TYP` in
#: `services/datenquellen_validierung.py`. Beide Kopien waren wertgleich — und
#: genau das ist die Falle: Ein dritter Wert, nur in eine der beiden Kopien
#: eingetragen, verdrängt das Feld auf der Datenquellen-Fläche, aber nicht im
#: Monatsabschluss (oder umgekehrt), und zwar **still**.
#:
#: ⚑ `bedingung` und `weich` hatten ihren Auswerter längst (`bedingungs_urteil`),
#: `label_wenn` wird an genau einer Stelle gelesen — `bedingung_anlage` war der
#: einzige Schlüssel der Registry ohne SoT.
BEDINGUNG_ANLAGE_VERDRAENGT: Final[dict[str, str]] = {
    "keine_wallbox": "wallbox",
    # Von keinem Feld mehr benutzt (s. Kasten bei `ladung_pv_kwh`: die Bedingung
    # ist 2026 bewusst entfallen) — der Wert bleibt im Vokabular, damit die
    # Regel wieder gesetzt werden kann, ohne sie neu herzuleiten.
    "keine_pv_module": "pv-module",
}


def verdraengender_typ(bedingung_anlage) -> Optional[str]:
    """Welcher Investitionstyp verdrängt ein Feld mit dieser `bedingung_anlage`?

    Gibt den Typ zurück (`"wallbox"`), oder `None`, wenn das Feld keine solche
    Bedingung trägt **oder der Wert unbekannt ist**.

    ⚠ **Ein unbekannter Wert verdrängt nicht** (fail-open) — dieselbe Wahl wie
    in `bedingung_erfuellt` und `bedingungs_urteil`, und aus demselben Grund:
    Die Gegenrichtung ließe ein bereits **zugeordnetes** Feld unsichtbar
    verschwinden und damit unlöschbar zurückbleiben. Ein Auswerter, der wirft,
    wäre die F-59-Klasse (latenter 500er im Lesepfad).

    Gegen den Tippfehler steht deshalb ein Wächter, kein Laufzeitfehler:
    ``test_bedingung_anlage_sot_n79.py::test_jeder_bedingung_anlage_wert_ist_bekannt``.
    """
    if not bedingung_anlage:
        return None
    return BEDINGUNG_ANLAGE_VERDRAENGT.get(bedingung_anlage)


def bedingungs_urteil(
    bedingung, weich, bedingungs_werte: dict[str, bool],
) -> str:
    """Gilt das Feld, ist es **erweitert**, oder gibt es die Größe hier nicht?

    ⭐ **Es gibt zwei Sorten Bauart-Abhängigkeit, und bis zum 26.08.2026 waren
    sie derselbe Mechanismus** — das ist die Ursache hinter Befund W-2:

    ======  ====================================  ==========================
    Sorte   Beispiel                              Folge
    ======  ====================================  ==========================
    hart    Luft-Luft hat keinen Warmwasserkreis  Feld verschwindet
    weich   Sole-Wasser-WP **mit** Kühlung        Feld ist „erweitert"
    ======  ====================================  ==========================

    MartyBr hat seit dem Sommer 2026 einen getrennten Kühlzähler an einer
    Wärmepumpe und konnte ihn **nirgends** hinterlegen; pipp086 fragt nach
    derselben Größe (Forum T89667 #199/#200). Die alte Begründung — „acht
    Betriebsart-Felder an jeder Wärmepumpe sind acht Angebote, die niemand
    einlösen kann" — bleibt richtig und wird hier eingelöst, **ohne** einen
    Fall auszuschließen: erweiterte Felder stehen auf der Zuordnungs-Fläche
    hinter einem Schritt „Weitere Größen erfassen".

    ⚠ **Hart schlägt weich.** Ein Feld kann beides tragen — `strom_heizen_kwh`
    braucht `getrennte_strommessung` **hart** (ohne Kennzeichen gibt es die
    getrennte Achse nicht) und `!brauchwasser` **weich** (an einer
    Brauchwasser-WP untypisch, aber möglich). Genau diese Kombination ist der
    Grund, warum `weich` die **Schlüssel** nennt und kein Wahrheitswert am Feld
    ist: mit einem Bool ließe sich nicht sagen, *welche* der beiden Bedingungen
    weich gemeint war.

    ⚠ **Ein unbekannter Schlüssel gilt** (fail-open) — wie in
    `bedingung_erfuellt`, und aus demselben Grund: ein Tippfehler ließe sonst
    ein **zugeordnetes** Feld unsichtbar verschwinden und damit unlöschbar
    zurückbleiben. Gewächtert wird der Tippfehler, nicht abgefangen
    (`test_b5_strom_warmwasser_luft_luft.py::
    test_jede_bedingung_der_registry_ist_ein_bekannter_schluessel`).
    """
    if not bedingung:
        return URTEIL_GILT
    weiche_schluessel = frozenset(weich or ())
    tokens = (bedingung,) if isinstance(bedingung, str) else tuple(bedingung)
    urteil = URTEIL_GILT
    for token in tokens:
        negiert = token.startswith("!")
        schluessel = token[1:] if negiert else token
        if schluessel not in bedingungs_werte:
            continue  # unbekannt → nicht filtern, s. Kasten oben
        if bedingungs_werte[schluessel] == negiert:
            if schluessel not in weiche_schluessel:
                return URTEIL_NEIN  # hart schlägt weich, sofort
            urteil = URTEIL_ERWEITERT
    return urteil


def bedingung_erfuellt(bedingung, bedingungs_werte: dict[str, bool]) -> bool:
    """Ist die `bedingung` eines Feldes erfüllt? — **der eine Auswerter**.

    ⚠ **Kennt die weiche Sorte NICHT** und beantwortet deshalb nur die harte
    Frage. Wer wissen muss, ob ein Feld „erweitert" ist, ruft
    `bedingungs_urteil`; die Aufrufer hier brauchen die Unterscheidung nicht
    (sie fragen „ist diese eine Bedingung erfüllt?", nicht „zeige ich das
    Feld?").

    Eine Bedingung ist ein Schlüssel aus `_bedingungs_werte`, optional mit `!`
    negiert. **Mehrere Bedingungen stehen als Liste und gelten alle zusammen
    (UND)** — genau das braucht `strom_warmwasser_kwh` (B5/N-304): getrennte
    Strommessung ja, Split-Klimaanlage nein. Vorher war die Auswertung eine
    Kette aus `elif bedingung == "…"`; sie konnte eine Bedingung ausdrücken und
    keine zwei, und jeder neue Schlüssel kostete dort einen Zweig.

    ⚠ **Ein unbekannter Schlüssel zeigt das Feld** (fail-open) — bitgleich zum
    früheren Verhalten, wo eine unbekannte Zeichenkette durch alle `elif` fiel.
    Die Gegenrichtung wäre schlimmer: ein Tippfehler ließe ein **zugeordnetes**
    Feld unsichtbar verschwinden, und damit unlöschbar zurückbleiben (dieselbe
    Falle, vor der `get_alle_felder_fuer_investition` warnt). Ein Auswerter, der
    stattdessen wirft, wäre die F-59-Klasse: ein latenter 500er im Lesepfad.
    Gegen den Tippfehler steht deshalb ein Wächter, kein Laufzeitfehler —
    `test_b5_strom_warmwasser_luft_luft.py::
    test_jede_bedingung_der_registry_ist_ein_bekannter_schluessel`.
    """
    if not bedingung:
        return True
    tokens = (bedingung,) if isinstance(bedingung, str) else tuple(bedingung)
    for token in tokens:
        negiert = token.startswith("!")
        schluessel = token[1:] if negiert else token
        if schluessel not in bedingungs_werte:
            continue  # unbekannt → nicht filtern, s. Kasten oben
        if bedingungs_werte[schluessel] == negiert:
            return False
    return True


#: Welches Registry-Feld **ist** die Wärme-Achse. Die Namen kommen aus dem
#: Kanon (``core/betriebsmodus.py``) — kein zweites Vokabular für dieselbe
#: Sache, das war die Ursache von N-336.
#:
#: ⚠ **Die Wärme-Seite entscheidet, nicht die Strom-Seite:**
#: ``strom_heizen_kwh`` trägt zusätzlich die **harte** Bedingung
#: ``getrennte_strommessung`` und wäre an jedem Gerät ohne dieses Kennzeichen
#: „nein" — das ist eine Aussage über die *Messung*, nicht über die *Funktion*
#: des Geräts.
#:
#: ⛔ **``kuehlen`` steht hier nicht.** Kühlen ist keine Wärme-Achse; seine
#: Kennzahl hat einen eigenen Zähler (die **Kälte**menge) und eine eigene
#: Sperre (``arbeitszahl_kuehlen``).
_WP_ACHSEN_FELD: Final[dict] = {
    BM_HEIZEN: "heizenergie_kwh",
    BM_WARMWASSER: "warmwasser_kwh",
}

#: Beide Wärme-Achsen — der Default überall dort, wo die Frage nicht gestellt
#: wird (bitgleich zum Stand vor WK-16h). **Aus dem Kanon**, nicht aus der
#: Tabelle darüber: Die beiden müssen deckungsgleich sein, und ein Feld, das
#: hier fehlte, fiele so sofort auf (``assert`` darunter).
WP_WAERME_ACHSEN_BEIDE: Final[frozenset] = BM_WAERME_ACHSEN
assert frozenset(_WP_ACHSEN_FELD) == BM_WAERME_ACHSEN, (
    "Jede Wärme-Achse des Kanons braucht ihr Registry-Feld"
)


def wp_waerme_achsen(parameter: Optional[dict]) -> frozenset:
    """Welche Wärme-Achsen hat dieses Gerät? — **die eine Achsen-Frage** (WK-16h).

    Rückgabe ist eine Teilmenge von {@link WP_WAERME_ACHSEN_BEIDE}: eine
    **Brauchwasser**-Wärmepumpe trägt nur ``warmwasser``, eine
    **Split-Klimaanlage** nur ``heizen`` (N-304: kein Warmwasserkreis), jedes
    andere Gerät beide.

    ⭐ **Warum es diese Funktion gibt.** WK-15c hat die Regel *„eine Achse, die
    am Gerät nicht gilt, trägt in keiner Rechnung und keinem Hinweis eine Zahl"*
    für ROI-Schätzung, Formular und die SCOP/COP-Hinweise durchgesetzt — die
    **Kennzahlen je Gerät** kamen einen Tag später (WK-16ab) und kannten sie
    nicht. Gemessen an der r28 (15.09.2026): die Brauchwasser-WP *Stiebel WWK
    300* hatte eine Gesamt-Arbeitszahl von 3,31 und daneben zweimal den Strich
    *„Strom nicht getrennt je Funktion gemessen"* — einmal für die Achse, deren
    Zahl 3,31 **ist**, und einmal für eine Achse, die das Gerät nicht hat
    (N-499).

    ⚠ **`feld_urteil(...) == URTEIL_GILT` und NICHT
    {@link groesse_gibt_es_am_geraet}** — dieselbe Trennlinie wie in
    ``investitionen/crud.py::_achse_gilt`` (WK-15c) und
    ``daten_checker/stammdaten.py`` (WK-15b). Jene Funktion prüft
    ``!= URTEIL_NEIN`` und liefert an der Brauchwasser-WP für die Heiz-Achse
    ``True``, weil die Bedingung dort **weich** ist („untypisch, nicht
    unmöglich": wer doch einen kleinen Heizkreis hat, darf seinen Zähler
    behalten). Für den **Lesepfad einer gemessenen Menge** ist das richtig; für
    die Frage, welche Achse eine **Kennzahl** tragen darf, ist es zu weit.

    ⛔ **Sie entscheidet nichts über Abdeckung.** „Kein Zähler zugeordnet" und
    „das Gerät hat die Achse nicht" sind verschiedene Lagen — die erste gehört
    dem Daten-Checker, die zweite hierher (derselbe Kasten wie bei
    ``groesse_gibt_es_am_geraet``).
    """
    return frozenset(
        achse for achse, feld in _WP_ACHSEN_FELD.items()
        if feld_urteil("waermepumpe", feld, parameter) == URTEIL_GILT
    )


def groesse_gibt_es_am_geraet(
    typ: str, feld: str, parameter: Optional[dict],
) -> bool:
    """Kann dieses Gerät diese Größe überhaupt haben? — **für den LESEPFAD**.

    ``False`` heißt: die Größe existiert an diesem Gerät nicht (``URTEIL_NEIN``,
    die *harte* Sorte). Ein **erweitertes** Feld gilt hier als vorhanden — es
    ist untypisch, nicht unmöglich, und wer es gepflegt hat, meint es so.

    ⭐ **Warum es diese Funktion gibt: die Erfassung kannte die Regel, der
    Lesepfad nicht.** N-304 hat ``warmwasser_kwh`` an einer Split-Klimaanlage
    aus der Erfassung genommen, weil das Gerät keinen Warmwasserkreis hat —
    der Docstring von ``test_klima_ohne_warmwasser_n304.py`` benennt den Schaden
    wörtlich: *„Ein an einer Luft-Luft-Anlage gepflegter Warmwasser-Wert erzeugt
    eine Ersparnis für Wärme, die das Gerät nie erzeugt hat."* Ein **bereits
    gespeicherter** Wert erzeugte sie weiter: elf Faltstellen in sechs Dateien
    lesen ``warmwasser_kwh`` direkt aus ``verbrauch_daten``, und
    ``ist_luft_luft_waermepumpe`` kam in keiner davon vor. Gemeldet von
    dietmar1968 (T89667 #295) mit 889 kWh „Warmwasser" an einer Klimaanlage,
    daraus eine Gas-Ersparnis von 38 € und eine CO₂-Zahl von −112 kg.

    ⚠ **Vierte Runde der #236-Folgewellen-Klasse** (``ist-waerme-klima.md``
    §W-12 nennt N-304 selbst die dritte): *ein Filter auf einer Schicht reicht
    nicht, wenn mehrere Pfade dieselbe Größe lesen.* Deshalb steht hier eine
    Frage an die **bestehende** Registry und keine zweite Regel — wer morgen
    eine Bedingung ergänzt, bekommt den Lesepfad umsonst mit.

    ⚠ **Fail-open wie die beiden Auswerter darunter.** Ein unbekannter Typ oder
    ein unbekanntes Feld liefert ``True``: Im Lesepfad wäre die Gegenrichtung
    schlimmer als hier — ein Tippfehler ließe eine **gemessene** Menge still aus
    jeder Summe fallen. Gegen den Tippfehler steht der Wächter der Registry
    (``test_b5_strom_warmwasser_luft_luft.py``), nicht diese Funktion.

    ⛔ **Sie entscheidet NICHT über Abdeckung.** „Kein Zähler zugeordnet" und
    „das Gerät hat die Größe nicht" sind verschiedene Lagen — die erste gehört
    dem Daten-Checker, die zweite hierher. Wer diese Funktion für eine fehlende
    Messung benutzt, blendet gute Daten aus (Entscheid 29.08., Total-Fall).
    """
    for eintrag in INVESTITION_FELDER.get(typ) or ():
        if not isinstance(eintrag, dict) or eintrag.get("feld") != feld:
            continue
        urteil = bedingungs_urteil(
            eintrag.get("bedingung"), eintrag.get("weich"),
            _bedingungs_werte(parameter),
        )
        return urteil != URTEIL_NEIN
    return True


def _label_aufgeloest(feld: dict, bedingungs_werte: dict[str, bool]) -> str:
    """#281: konditionelles Label — nutzt dieselben Bedingungs-Keys wie `bedingung`."""
    for cond_key, alt_label in (feld.get("label_wenn") or {}).items():
        if bedingungs_werte.get(cond_key):
            return alt_label
    return feld["label"]


def get_felder_fuer_investition(
    typ: str,
    parameter: Optional[dict],
    anlage_investitionen: Optional[list] = None,
    belegte_felder: Optional[set[str]] = None,
) -> list[dict]:
    """
    Gibt die relevanten Felder für eine Investition zurück (Bedingungen aufgelöst).

    Filtert konditionelle Felder basierend auf:
    - Investitions-Parametern ("bedingung", z.B. "arbitrage_faehig")
    - Anlage-Kontext ("bedingung_anlage", z.B. "keine_pv_module")

    Für Typ "sonstiges" bitte get_felder_fuer_sonstiges() verwenden.

    Args:
        typ: Investitionstyp (z.B. "speicher", "e-auto")
        parameter: Investitions-Parameter-Dict (inv.parameter)
        anlage_investitionen: Alle Investitionen der Anlage (für bedingung_anlage).
                              None → bedingung_anlage wird nicht ausgewertet.
        belegte_felder: Feldnamen, für die es an diesem Gerät bereits einen Wert
                        oder eine Zuordnung gibt. Sie entscheiden über die
                        **erweiterten** Felder (R1, `weich` — s.
                        `bedingungs_urteil`): ein erweitertes Feld erscheint hier
                        nur, wenn es belegt ist.

                        ⭐ **Das ist R1 wörtlich:** *„was ein Gerät liefern kann,
                        sagt der zugeordnete Zähler, nicht seine Bauart."* Ohne
                        das Argument (Import, Checker) bleibt es beim harten
                        Bild — dort ändert sich nichts.

    Returns:
        Liste von Feld-Dicts ohne "bedingung"-Keys (bereits aufgelöst)
    """
    params = parameter or {}
    alle_felder = INVESTITION_FELDER.get(typ, [])

    if isinstance(alle_felder, dict):
        # Sonstiges — Kategorie-abhängig. Ohne gepflegte Kategorie wird hier
        # NICHT geraten (N-244); die Entscheidung liegt im SoT darunter.
        return get_felder_fuer_sonstiges(params.get("kategorie"))

    # Anlage-Kontext vorberechnen (einmalig, nicht pro Feld)
    anlage_typen: set[str] = set()
    if anlage_investitionen is not None:
        anlage_typen = {getattr(i, "typ", None) for i in anlage_investitionen}

    result = []
    bedingungs_werte = _bedingungs_werte(params)

    # Steuer-Schlüssel — hier ausgewertet bzw. nur für die Zuordnungs-Fläche
    # relevant, gehören nicht in die Eingabe-Antwort.
    SKIP_KEYS = {"bedingung", "weich", "bedingung_anlage", "label_wenn",
                 "nur_manuell", "nur_bestand", "je_innengeraet",
                 "label_je_innengeraet"}
    belegt = belegte_felder or set()

    for feld in alle_felder:
        # ⛔ `nur_bestand`: gar nicht mehr pflegbar — siehe Kopf dieser Datei.
        # Es bleibt allein in der Registry, damit eine BESTEHENDE Zuordnung auf
        # der Zuordnungs-Flaeche sichtbar und entfernbar ist; dort entscheidet
        # `ohne_nicht_zuordenbare` ueber `nur_manuell`. Hier faellt es immer.
        if feld.get("nur_bestand"):
            continue
        bedingung = feld.get("bedingung")
        bedingung_anlage = feld.get("bedingung_anlage")

        # ── Anlage-Kontext-Bedingung ─────────────────────────────────────────
        # Hier wird gefiltert (Monatsabschluss/Import-Kontext). Die Datenquellen-
        # Fläche nutzt bewusst `get_alle_felder_fuer_investition` und wertet
        # `bedingung_anlage` selbst aus — sie muss ein bereits ZUGEORDNETES Feld
        # weiter zeigen, sonst verschwindet die Zuordnung unsichtbar und lässt
        # sich nicht mehr entfernen (`_bedarf_einstufung` in routes/datenquellen.py).
        if bedingung_anlage and anlage_investitionen is not None:
            # N-79: die Zuordnung Wert → verdrängender Typ steht im SoT
            # `BEDINGUNG_ANLAGE_VERDRAENGT`, nicht als `if`-Kette hier.
            # Unbekannter Wert ⇒ `None` ⇒ verdrängt nichts (fail-open).
            if verdraengender_typ(bedingung_anlage) in anlage_typen:
                continue  # Feld ausblenden: der verdrängende Typ ist da

        # ── Investment-Parameter-Bedingung ───────────────────────────────────
        urteil = bedingungs_urteil(bedingung, feld.get("weich"), bedingungs_werte)
        if urteil == URTEIL_NEIN:
            continue
        if urteil == URTEIL_ERWEITERT and basis_feld_key(feld["feld"]) not in belegt:
            # Erweitert und unbelegt: die Größe ist an diesem Gerät untypisch und
            # nichts deutet darauf hin, dass es sie gibt. Sie bleibt erreichbar —
            # über die Zuordnungs-Fläche, die erweiterte Felder ausdrücklich
            # zeigt. Hier stünde sie als leeres Eingabefeld in der ersten Reihe.
            continue

        aufgeloest = dict(feld)
        if urteil == URTEIL_ERWEITERT:
            aufgeloest["erweitert"] = True
        aufgeloest["label"] = _label_aufgeloest(feld, bedingungs_werte)
        result.append(aufgeloest)

    # #263 — je Innengerät eine Kopie, VOR dem Abstreifen der Steuer-Schlüssel:
    # `je_innengeraet` ist selbst einer, und ohne ihn wüsste die Erweiterung
    # nicht mehr, welche Felder sie vervielfältigen soll.
    result = _mit_innengeraeten(result, params, "feld")

    return [{k: v for k, v in f.items() if k not in SKIP_KEYS} for f in result]


def get_alle_felder_fuer_investition(typ: str, parameter: Optional[dict] = None) -> list[dict]:
    """
    Gibt ALLE Felder für einen Investitionstyp zurück — ohne Bedingungsfilter.

    Für Import-Kontext: alle Felder anbieten, unabhängig von aktuellen Parametern.
    Der Import soll nie Daten stillschweigend ignorieren. Dasselbe gilt für die
    Datenquellen-Fläche: ein bereits zugeordnetes Feld darf nicht unsichtbar
    verschwinden, sobald ein Parameter kippt.

    Das **Label** wird trotzdem an der konkreten Investition aufgelöst
    (`label_wenn`) — die Steuer-Keys (`bedingung`, `nur_manuell`, …) bleiben im
    Dict, weil die Aufrufer sie selbst auswerten. Ohne diese Auflösung hieß das
    Speicher-Feld auf der Fläche nur „Ladung", während im Monatsabschluss daneben
    „Ladung (gesamt, inkl. Netz)" stand — genau die Zweideutigkeit, an der ein
    Tester PV-Ladung und Netzladung addiert im Gesamt-Feld ablegte UND als
    Netzladung nochmal (Forum simon42 #89667/62 + /71, MartyBr).

    Args:
        typ: Investitionstyp
        parameter: Investitions-Parameter-Dict (Sonstiges-Kategorie + `label_wenn`)

    Returns:
        Liste aller Feld-Dicts (inkl. konditioneller Felder), Labels aufgelöst
    """
    alle_felder = INVESTITION_FELDER.get(typ, [])

    if isinstance(alle_felder, dict):
        # Sonstiges — Kategorie-abhängig. Ohne gepflegte Kategorie wird hier
        # NICHT geraten (N-244); die Entscheidung liegt im SoT darunter.
        params = parameter or {}
        return list(get_felder_fuer_sonstiges(params.get("kategorie")))

    # Kopie je Feld: die Dicts sind Modul-Konstanten, ein direktes Setzen des
    # Labels würde die Definition für alle folgenden Aufrufe umschreiben.
    bedingungs_werte = _bedingungs_werte(parameter)
    # ⚠ **Diese Funktion filtert NICHTS — sie markiert.** Drei Stufen, drei
    # Marken, und die Entscheidung fällt die Fläche
    # (`routes/datenquellen.py::ohne_nicht_zuordenbare`).
    #
    # Die Schalter (`getrennte_strommessung`, `arbitrage_faehig`, …) sind
    # umlegbar; bis dahin soll das Feld zuordenbar bleiben. Eine **harte**
    # Geräteklassen-Bedingung schließt die Größe dagegen aus: eine
    # Split-Klimaanlage hat keinen Warmwasserkreis, und das Feld dort anzubieten
    # wäre ein Angebot, das niemand einlösen kann (die P-6-Falle). Dazwischen
    # steht seit dem 26.08.2026 die **weiche** Bedingung: die Größe ist an
    # dieser Bauart untypisch, aber möglich — sie wird mit `erweitert` markiert,
    # die Fläche stellt sie hinter „Weitere Größen erfassen" (R1/W-2).
    #
    # ⛔ **Warum auch die harte Verletzung nur MARKIERT und nicht entfernt wird
    # — das ist der teuerste Teil dieser Funktion.** Ein Feld hier verschwinden
    # zu lassen, hieße: eine **bestehende Zuordnung** wird unsichtbar und damit
    # **unlöschbar**. Der Fall ist real und belegt: azywietz-web führt zwei
    # Klimaanlagen als `luft_wasser` (#383, weil das Feld „Wärmepumpenart" wie
    # eine Community-Einstellung beschriftet war). Stellt er sie um, hätte ein
    # zugeordneter `warmwasser_kwh`-Sensor keinen Weg mehr heraus.
    # `test_klima_ohne_warmwasser_n304.py::test_zuordnungsflaeche_zeigt_das_feld_weiter`
    # hält genau das fest — und hat am 26.08. einen ersten, zu groben Fix dieser
    # Stelle gefangen, der die Marke gegen ein `return None` getauscht hatte.
    #
    # ⛔ **Hier stand bis dahin ein exakter String-Vergleich**
    # (`f.get("bedingung") != "luft_luft"`), und der war die Ursache von **W-12**:
    # Er kannte weder die Negation `"!luft_luft"` (`warmwasser_kwh`) noch die
    # Listenform `["getrennte_strommessung", "!luft_luft"]`
    # (`strom_warmwasser_kwh`). Beide liefen daran vorbei — die Zuordnungs-Fläche
    # bot einer Split-Klimaanlage also **genau die zwei Warmwasser-Felder** an,
    # deren Fehlen der Daten-Checker bei OB73-gif zu Unrecht angemahnt hatte
    # (#263, repariert mit v4.0.28 — im Checker, nicht hier). Dritte Runde der
    # #236-Klasse: eine Regel auf einer Schicht reicht nicht bei parallelen
    # Pfaden. Der Auswerter (`bedingungs_urteil`) kennt beide Formen, und die
    # Fläche nimmt das markierte Feld heraus — **außer** es hat eine Quelle.
    # Dieselbe Bauform wie `nur_manuell`: Registry markiert, Fläche entscheidet.
    def _mit_urteil(feld: dict) -> dict:
        urteil = bedingungs_urteil(
            feld.get("bedingung"), feld.get("weich"), bedingungs_werte,
        )
        aufgeloest = {**feld, "label": _label_aufgeloest(feld, bedingungs_werte)}
        if urteil == URTEIL_ERWEITERT:
            aufgeloest["erweitert"] = True
        elif urteil == URTEIL_NEIN and _ist_geraeteklasse(feld.get("bedingung")):
            aufgeloest["nicht_an_dieser_bauart"] = True
        return aufgeloest

    return _mit_innengeraeten(
        [_mit_urteil(f) for f in alle_felder], parameter, "feld",
    )


def get_basis_felder(
    hat_dynamischen_tarif: bool = False,
    aktive_inv_typen: Optional[set[str]] = None,
    hat_variable_einspeisung: bool = False,
) -> list[dict]:
    """
    Gibt alle Basis-Felder für eine Anlage zurück (inkl. aufgelöster bedingter Felder).

    Kombiniert BASIS_FELDER + BEDINGTE_BASIS_FELDER, wobei letztere nur bei
    erfüllter Bedingung enthalten sind.

    Args:
        hat_dynamischen_tarif: True wenn die Anlage einen dynamischen Stromtarif hat
        aktive_inv_typen: Set der aktiven Investitionstypen (z.B. {"pv-module", "e-auto"})
        hat_variable_einspeisung: True wenn der (zum Stichtag gültige) allgemeine
            Tarif „Einspeisevergütung wechselt monatlich" trägt (#392)

    Returns:
        Liste von Feld-Dicts (ohne bedingung_basis-Key)
    """
    typen = aktive_inv_typen or set()
    result = list(BASIS_FELDER)

    for feld in BEDINGTE_BASIS_FELDER:
        bedingung = feld.get("bedingung_basis")
        if bedingung == "dynamischer_tarif" and not hat_dynamischen_tarif:
            continue
        if bedingung == "variable_einspeisung" and not hat_variable_einspeisung:
            continue
        if bedingung == "hat_eauto" and "e-auto" not in typen:
            continue
        if bedingung == "hat_waermepumpe" and "waermepumpe" not in typen:
            continue
        # bedingung_basis nicht an Consumer durchreichen
        result.append({k: v for k, v in feld.items() if k != "bedingung_basis"})

    return result


# Alle Monatsdaten-Feldnamen (Basis + Bedingte + Optionale) für generisches Speichern.
# Beim Save müssen keine Bedingungen geprüft werden — gespeichert wird was gesendet wurde.
ALLE_MONATSDATEN_FELDNAMEN: set[str] = {
    f["feld"] for f in BASIS_FELDER + BEDINGTE_BASIS_FELDER + OPTIONALE_FELDER
}


# Die Richtung, als die ein *Sonstiges*-Gerät **ohne gepflegte** `kategorie`
# gelesen wird — die eine benannte Stelle für eine Annahme, die am 17.08.2026
# an sechs Stellen als String-Literal `"verbraucher"` und an drei weiteren als
# `"erzeuger"` stand (N-244).
#
# **Warum ausgerechnet Verbraucher?** Weil beide Tages-Schreibpfade den Wert
# unter dieser Annahme überhaupt erst erzeugen (`live_sensor_config` ·
# `snapshot/komponenten_beitraege`) — wer ihn danach anders liest, liest an
# seiner eigenen Schreibweise vorbei. Begründung im Volltext:
# `berechnungen.energie.sonstiges_kwh_je_richtung`.
#
# ⚠ **Kein Ersatz für `energie.sonstiges_richtung`.** Diese Konstante gilt, wenn
# **kein Wert** vorliegt (Feldauswahl, Schlüsselbildung, Serienaufbau). Liegt
# einer vor, entscheidet er — das ist eine andere Frage und hat ihre eigene
# Funktion (N-250).
SONSTIGES_KATEGORIE_UNGEPFLEGT: Final[str] = "verbraucher"

# ─── Der dritte Zustand: Kategorien OHNE Stromrichtung (#377 / N-294) ────────
#
# *Sonstiges* war bis v4.0.22 **binär**: eine Kategorie ist entweder Erzeuger
# oder Verbraucher, und wer keine gepflegt hat, wird als Verbraucher gelesen
# (`SONSTIGES_KATEGORIE_UNGEPFLEGT`, neun Stellen — N-244). Ein **Zähler** ist
# weder das eine noch das andere: er trägt gar keine Stromrichtung, weil er gar
# keinen Strom führt. Ihn in eine der beiden Schubladen zu legen, hieße Gas oder
# Wasser in die Hausstrom-Aufschlüsselung zu geben.
#
# **Diese Konstante ist DER EINE ORT dafür.** Jede Stelle, die „ist das ein
# Erzeuger oder ein Verbraucher?" fragt, fragt zuerst hier — statt an neun
# Stellen `if kategorie == "zaehler"` zu schreiben, was die N-244-Wette ein
# zweites Mal wäre. Präzedenz im Baum: die Kategorie `speicher`, die
# `berechnungen.energie.sonstiges_kwh_je_richtung` bereits überspringt.
#
# ⚠ Eine Kategorie hier einzutragen heißt: sie taucht in **keiner**
# Energie-Rechnung auf. Wer eine hinzufügt, prüft die Stellen aus
# `test_377_zaehlerstaende.py` mit.
SONSTIGES_ZAEHLER_KATEGORIEN: Final[frozenset[str]] = frozenset({"zaehler"})

#: Der dritte Weg der Netzpunkt-Bilanz (§9.2): eine Kategorie mit EIGENER
#: Richtung — weder Erzeuger noch Verbraucher. Ihr Feld darf einem Gerät ohne
#: gepflegte Kategorie NICHT angeboten werden: dort liest jeder wertführende
#: Pfad „Verbraucher", und eine Abgabe als Verbrauch gelesen ist die N-244-Klasse
#: mit anderem Vorzeichen (dieselbe Begründung wie beim Verbrauchszähler).
SONSTIGES_ABGABE_KATEGORIE: Final[str] = "abgabe"


def ist_abgabe_kategorie(kategorie: Optional[str]) -> bool:
    """Gibt dieses *Sonstiges*-Gerät Strom an Dritte ab (§9.2)?"""
    return kategorie == SONSTIGES_ABGABE_KATEGORIE


#: Anzeigename der Kategorie — **ein** Wort für alle drei Zeilen, die dasselbe
#: Gerät nennen: die Energiezeile der Verwendungsseite, die Geldzeile im T-Konto
#: (`erloes_label`) und der Posten der Kapitalrechnung
#: (`BEZEICHNUNG_ABGABE = "Erlös aus " + dieser Name`). Regel 0: wer im T-Konto
#: „Einspeisung" liest, sucht in der Bilanz ein Wort, das dort nicht steht.
#: ⚑ Der **Schlüssel** bleibt `einspeise_erloes_euro` — §9.2: der Schlüssel ist
#: Code, der Anzeigename kommt aus der Kategorie.
SONSTIGES_ABGABE_LABEL: Final[str] = "Abgabe an Dritte"
#: Der eine Feldname der Kategorie — ausgeschrieben statt aus der Registry
#: gezogen, weil dieses Projekt von der Grep-Barkeit lebt. Dass beide
#: übereinstimmen, hält `test_377_zaehlerstaende.py` fest.
ZAEHLERSTAND_FELD: Final[str] = "zaehlerstand"


def ist_zaehler_kategorie(kategorie: Optional[str]) -> bool:
    """Trägt diese *Sonstiges*-Kategorie einen Zählerstand statt Strom?

    Die eine Frage hinter {@link SONSTIGES_ZAEHLER_KATEGORIEN} — als Funktion,
    damit die Aufrufer nicht das Set importieren und dabei die Prüfung selbst
    formulieren (dieselbe Begründung wie bei `ist_zustand_feld`).
    """
    return kategorie in SONSTIGES_ZAEHLER_KATEGORIEN


def ist_gepflegte_sonstiges_kategorie(kategorie: Optional[str]) -> bool:
    """Ist ``kategorie`` eine **gepflegte** Kategorie eines *Sonstiges*-Geräts?

    Abgeleitet aus der Registry, damit eine vierte Kategorie nicht an einer
    handgeschriebenen Aufzählung vorbeiläuft. Gegenstück zu
    ``berechnungen.energie.sonstiges_richtung``: die dort getroffene
    Entscheidung kennt nur die zwei **Richtungen**, diese Frage kennt alle
    Kategorien — auch ``speicher``, der keine Richtung hat.
    """
    return kategorie in INVESTITION_FELDER.get("sonstiges", {})


def _sonstiges_felder_ungepflegt() -> list[dict]:
    """Alle Richtungen eines *Sonstiges*-Geräts, dedupliziert — **abgeleitet**.

    Verbraucher-Felder zuerst: das ist die Richtung, die jeder wertführende Pfad
    ohne gepflegte Kategorie annimmt (`SONSTIGES_KATEGORIE_UNGEPFLEGT`), also
    die wahrscheinlichere Eingabe. `speicher` bringt keinen eigenen Feldnamen
    mit und steht deshalb nicht extra in der Liste — die Ableitung nimmt ihn
    trotzdem mit, damit eine künftige Erweiterung der Kategorie nicht still
    danebenfällt.

    **Abgeleitet statt geschrieben, aus demselben Grund wie N-259:** eine
    handgepflegte vierte Feldliste wäre wieder die Wette darauf, dass jemand
    sie beim nächsten neuen Feld mitzieht.

    ⛔ **Zähler-Kategorien sind ausgenommen** (#377): Diese Liste beantwortet
    „welche Felder könnte ein Gerät führen, dessen Kategorie noch **nicht
    gepflegt** ist?" — und ein Zählerstand gehört nie dazu. Ohne die Ausnahme
    böte die Zuordnungsfläche eines kategorielosen Geräts `zaehlerstand` neben
    den Strom-Feldern an, und der Anwender ordnete einen Gassensor einem Gerät
    zu, das eedc anschließend als Verbraucher liest: **N-244 ein zweites Mal.**
    """
    sonstiges = INVESTITION_FELDER.get("sonstiges", {})
    reihenfolge = [SONSTIGES_KATEGORIE_UNGEPFLEGT] + [
        k for k in sonstiges
        if (
            k != SONSTIGES_KATEGORIE_UNGEPFLEGT
            and not ist_zaehler_kategorie(k)
            and not ist_abgabe_kategorie(k)
        )
    ]
    gesehen: set[str] = set()
    out: list[dict] = []
    for kat in reihenfolge:
        for feld in sonstiges.get(kat, []):
            if feld["feld"] in gesehen:
                continue
            gesehen.add(feld["feld"])
            out.append(feld)
    return out


def get_felder_fuer_sonstiges(kategorie: Optional[str]) -> list[dict]:
    """
    Gibt Felder für eine Sonstiges-Investition nach Kategorie zurück.

    Args:
        kategorie: "erzeuger", "verbraucher", "speicher" — oder ``None``/leer/
                   unbekannt für ein Gerät **ohne gepflegte Kategorie**.

    Returns:
        Liste von Feld-Dicts. Ohne gepflegte Kategorie **alle Richtungen**
        (`SONSTIGES_FELDER_UNGEPFLEGT`), nicht eine geratene.

    **Warum hier nicht mehr geraten wird (N-244).** Bis 17.08.2026 stand hier
    ``sonstiges.get(kategorie, sonstiges.get("erzeuger", []))`` — ein Gerät ohne
    gepflegte Kategorie bekam also **Erzeuger**-Felder angeboten
    (``erzeugung_kwh`` · ``eigenverbrauch_kwh`` · ``einspeisung_kwh`` ·
    ``einspeise_erloes_euro``), während **jeder** wertführende Pfad denselben
    Zustand als *Verbraucher* liest und ``verbrauch_sonstig_kwh`` ·
    ``bezug_pv_kwh`` · ``bezug_netz_kwh`` erwartet (`sonstiges_feld_reihenfolge`
    28 Zeilen weiter unten, die beiden Tages-Schreibpfade,
    `berechnungen.energie.sonstiges_kwh_je_richtung`). Die **Schnittmenge beider
    Feldlisten ist leer** — die Zuordnungsfläche bot damit ausschließlich Felder
    an, die der Snapshot-Pfad für dieses Gerät nie sucht. Das ist die
    **N-259-Klasse**: nicht „Wert fehlt", sondern „Feld wird nirgends gefunden".
    """
    if ist_gepflegte_sonstiges_kategorie(kategorie):
        return INVESTITION_FELDER["sonstiges"][kategorie]
    return SONSTIGES_FELDER_UNGEPFLEGT


# Modul-Konstante statt Aufruf je Leser: die Ableitung ist rein und die
# Feld-Dicts sind ohnehin geteilte Modul-Objekte (wie in `INVESTITION_FELDER`).
SONSTIGES_FELDER_UNGEPFLEGT: Final[list[dict]] = _sonstiges_felder_ungepflegt()


def resolve_legacy_key(key: str) -> str:
    """
    Gibt den kanonischen Feldnamen für einen ggf. veralteten Key zurück.

    Für Rückwärtskompatibilität beim Lesen alter DB-Einträge.
    """
    return LEGACY_FELDNAMEN.get(key, key)


def get_live_felder_fuer_investition(typ: str, parameter: Optional[dict] = None) -> list[dict]:
    """
    Gibt die Live-Felder (W/kW/%) für einen Investitionstyp zurück.

    Bedingungen werden anhand der Parameter aufgelöst (gleiche Semantik wie
    get_felder_fuer_investition). Gibt immer eine leere Liste zurück wenn der
    Typ keine Live-Felder hat.

    Args:
        typ: Investitionstyp
        parameter: Investitions-Parameter-Dict (für konditionelle Felder)

    Returns:
        Liste von Live-Feld-Dicts (key, label, einheit)
    """
    params = parameter or {}
    alle = LIVE_FELDER_INV.get(typ, [])
    bedingungs_werte = _bedingungs_werte(params)

    # ⛔ **Hier stand bis zum 26.08.2026 eine eigene `elif`-Kette** — der dritte
    # Nachbau derselben Frage, neben `bedingung_erfuellt` und dem
    # String-Vergleich in `get_alle_felder_fuer_investition` (W-12). Sie konnte
    # weder Listen noch neue Schlüssel: `brauchwasser` hätte sie stillschweigend
    # ignoriert, und zwar fail-open in die falsche Richtung. Jetzt liest auch sie
    # `bedingungs_urteil`.
    result = []
    for feld in alle:
        urteil = bedingungs_urteil(
            feld.get("bedingung"), feld.get("weich"), bedingungs_werte,
        )
        if urteil == URTEIL_NEIN:
            continue
        eintrag = {k: v for k, v in feld.items() if k not in ("bedingung", "weich")}
        if urteil == URTEIL_ERWEITERT:
            eintrag["erweitert"] = True
        result.append(eintrag)

    return _mit_innengeraeten(result, params, "key")


def build_feld_labels() -> dict[str, str]:
    """
    Baut ein vollständiges Label-Dict aus der Registry auf.

    Kombiniert:
    - BASIS_FELDER (mapping_key → label)
    - INVESTITION_FELDER (feld → label, alle Typen/Kategorien)
    - LIVE_FELDER_INV (key → label)
    - Basis-Level-Extras (pv_gesamt, etc.)

    Returns:
        dict: {feldname_oder_key: anzeigelabel}
    """
    labels: dict[str, str] = {}

    # Basis-Felder (mapping_key-Form: "einspeisung", "netzbezug", ...)
    for f in BASIS_FELDER:
        labels[f["mapping_key"]] = f["label"]
        labels[f["feld"]] = f["label"]  # auch DB-Feldname → Label

    # Bedingte Basis-Felder
    for f in BEDINGTE_BASIS_FELDER:
        labels[f["feld"]] = f["label"]
        if "mapping_key" in f:
            labels[f["mapping_key"]] = f["label"]

    # Basis-Live-Felder
    for f in BASIS_LIVE_FELDER:
        labels[f["key"]] = f["label"]

    # Investitions-Felder (alle Typen)
    for typ, felder in INVESTITION_FELDER.items():
        if isinstance(felder, dict):
            # Sonstiges — Kategorien
            for kat_felder in felder.values():
                for f in kat_felder:
                    labels[f["feld"]] = f["label"]
        else:
            for f in felder:
                labels[f["feld"]] = f["label"]

    # Live-Felder (Investitions-Ebene)
    for felder in LIVE_FELDER_INV.values():
        for f in felder:
            labels[f["key"]] = f["label"]

    # Extras die nicht in oben definierter Struktur stecken
    labels["pv_gesamt"] = "PV Erzeugung Gesamt"
    # Counter-Felder (TagesEnergieProfil), erscheinen im Statistik-Import wenn
    # im Sensor-Mapping einer WP-Investition gemappt — detLAN #187/1 + #238.
    labels["wp_starts_anzahl"] = "Kompressor-Starts"
    labels["wp_betriebsstunden"] = "Betriebsstunden"

    return labels


# Vorgefertigtes Label-Dict (einmalig berechnet)
FELD_LABELS: dict[str, str] = build_feld_labels()


def build_feld_einheiten() -> dict[str, str]:
    """Baut {feldname_oder_key_oder_mapping_key: einheit} aus der Registry.

    Single Source of Truth für Einheiten-Plausibilität (Daten-Checker
    `_check_sensor_mapping_einheit`): erlaubt, zu jedem gemappten Slot die
    erwartete Einheit nachzuschlagen, statt sie aus Namenskonventionen zu raten.
    Deckt Basis-Zähler (mapping_key + feld), Basis-Live-Keys, alle
    Investitions-Felder (inkl. Sonstiges-Kategorien) und Investitions-Live-Keys
    ab. Strings kollidieren nicht über Kontexte (z. B. `einspeisung` vs.
    `einspeisung_kwh` vs. `einspeisung_w`); gleiche Strings tragen dieselbe
    Einheit.
    """
    einheiten: dict[str, str] = {}

    for f in BASIS_FELDER + BEDINGTE_BASIS_FELDER:
        if "mapping_key" in f:
            einheiten[f["mapping_key"]] = f.get("einheit", "")
        einheiten[f["feld"]] = f.get("einheit", "")

    for f in BASIS_LIVE_FELDER:
        einheiten[f["key"]] = f.get("einheit", "")

    for felder in INVESTITION_FELDER.values():
        if isinstance(felder, dict):  # sonstiges → nach Kategorie
            for kat_felder in felder.values():
                for f in kat_felder:
                    einheiten[f["feld"]] = f.get("einheit", "")
        else:
            for f in felder:
                einheiten[f["feld"]] = f.get("einheit", "")

    for felder in LIVE_FELDER_INV.values():
        for f in felder:
            einheiten[f["key"]] = f.get("einheit", "")

    return einheiten


# Vorgefertigtes Einheiten-Dict (einmalig berechnet)
FELD_EINHEITEN: dict[str, str] = build_feld_einheiten()


def _build_einheit_je_geraet() -> dict[str, str]:
    """`{feld: parameter-schlüssel}` für Felder mit **geräteabhängiger** Einheit.

    **Abgeleitet aus der Registry, nicht danebengeschrieben** — dieselbe
    Begründung wie bei `ZUSTAND_LIVE_FELDER` (#263 K-2) und `_sonstiges_felder_
    ungepflegt` (N-259): eine handgepflegte zweite Liste ist die Wette darauf,
    dass jemand sie beim nächsten Feld mitzieht.
    """
    out: dict[str, str] = {}
    for felder in INVESTITION_FELDER.values():
        listen = list(felder.values()) if isinstance(felder, dict) else [felder]
        for liste in listen:
            for f in liste:
                if f.get("einheit_je_geraet"):
                    out[f["feld"]] = f["einheit_je_geraet"]
    return out


#: Felder, deren Einheit erst am Gerät feststeht (#377). Leser: `einheit_fuer`.
FELD_EINHEIT_JE_GERAET: dict[str, str] = _build_einheit_je_geraet()


# ─── Einheiten-Dimension (SoT für Leistung↔Energie-Verwechslung) ────────────
# Gemeinsam genutzt vom Daten-Checker (`SENSOR_MAPPING_EINHEIT`) UND der
# Datenquellen-V4-Zuordnungs-Validierung (§2i, kWh-Sensor in W-Feld = #200).
# Bewusst NUR Leistung/Energie: SoC (%)/Temperatur (°C)/Preis/km sind legitime
# Einheiten-Varianten → kein Fehlalarm.
_POWER_EINHEITEN = {"W", "kW", "MW"}
_ENERGY_EINHEITEN = {"kWh", "Wh", "MWh"}


def einheit_klasse(unit: Optional[str]) -> Optional[str]:
    """Dimensions-Klasse einer Einheit: 'leistung' | 'energie' | None (egal)."""
    if unit in _POWER_EINHEITEN:
        return "leistung"
    if unit in _ENERGY_EINHEITEN:
        return "energie"
    return None


# ─── Zählerdifferenz-Felder (SoT für „darf aus HA-LTS gelesen werden?") ─────
# Zähler ohne Energie-Einheit: monoton steigend, der Monatswert ist die
# Differenz zweier Zählerstände. Energie-Felder erkennt `einheit_klasse`.
_ZAEHLER_FELDER_OHNE_ENERGIE_EINHEIT: frozenset[str] = frozenset({
    "km_gefahren",        # km-Zähler (Auto-Integration/OBD)
    "ladevorgaenge",      # Anzahl-Zähler der Wallbox
    "wp_starts_anzahl",   # #136
    "wp_betriebsstunden",  # #238
    # Basis-Mapping-Schlüssel des PV-Sammelzählers. kWh wie „einspeisung"/
    # „netzbezug", steht aber in KEINER Feld-Registry: es ist ein reiner
    # Mapping-Key, kein IMD-Feld — `FELD_EINHEITEN` kennt ihn deshalb nicht.
    # Ohne diesen Eintrag fiele der Sammelzähler still aus dem Statistik-Import
    # (gewächtert in test_zaehler_differenz_feld.py).
    "pv_gesamt",
})


def ist_zaehler_differenz_feld(feld: str) -> bool:
    """Darf der Monatswert dieses Feldes als Zählerdifferenz gelesen werden?

    Die Monatswert-Pfade aus HA (`monatsabschluss`-Vorschläge,
    HA-Statistik-Import) rechnen ausnahmslos `MAX(sum) − MIN(sum)` mit
    Fallback `MAX(state) − MIN(state)`. Das ist für einen Zählerstand richtig
    und für alles andere Unsinn: bei einem Preis-Sensor käme die **Preis-Spanne
    des Monats** heraus, bei einer Temperatur die Spreizung.

    Vorher iterierten beide Pfade ungefiltert über alles, was im Mapping stand.
    Praktisch blieb das meist folgenlos, weil ein `measurement`-Sensor weder
    `state` noch `sum` führt und still `None` liefert — aber eine Preis-Entität
    mit gefüllter `state`-Spalte schrieb ihre Monats-Spreizung als Ø Ladepreis
    in die Datenbank (Forum simon42 #89667/54, Anlass war die Sensor-Zuordnung
    an einem ct/kWh-Feld).

    Kein Gegenstück in `snapshot/keys.py`: dort geht es um den stündlichen
    Snapshot-Job, hier um den Monatswert aus HA-Langzeitstatistik. Die Mengen
    überschneiden sich, sind aber nicht dieselbe Frage — `ladung_extern_kwh`
    etwa ist ein Monatswert ohne Snapshot-Erfassung.
    """
    if einheit_klasse(FELD_EINHEITEN.get(feld)) == "energie":
        return True
    return feld in _ZAEHLER_FELDER_OHNE_ENERGIE_EINHEIT


# ─── Snapshot-Zählerfelder: die Ableitung für `services/snapshot/keys.py` ────
#
# **Warum es das gibt (N-259, Melder rapahl, 16.08.2026).** `snapshot/keys.py`
# führte `KUMULATIVE_ZAEHLER_FELDER` als **zweite, handgepflegte Liste**
# derselben Feldnamen, die hier oben in `INVESTITION_FELDER` stehen. Die beiden
# sind auseinandergelaufen, und niemand konnte es sehen:
#
# * Ein *Sonstiges*-Verbraucher heißt hier **`verbrauch_sonstig_kwh`** — die
#   Zuordnungsfläche schreibt diesen Key ins `sensor_mapping`, und
#   `mqtt_topic_registry` baut daraus das Topic
#   `…/inv/<id>_<name>/verbrauch_sonstig_kwh`. Die Snapshot-Liste kannte
#   stattdessen **`verbrauch_kwh`**, einen Namen, den es für diesen Typ gar
#   nicht gibt. Folge: `_mqtt_key_to_sensor_key` verwarf das **selbst
#   publizierte** Topic, `_add("verbrauch_kwh")` fand nie ein Mapping ⇒ ein
#   Heizstab mit eigenem Zähler existierte auf Stunden- und Tagesebene nicht.
#   Der Monat kam an, weil `get_sonstiges_verbrauch_kwh` **beide** Namen liest.
# * Der *Sonstiges*-**Erzeuger** war nie betroffen: er heißt in beiden Welten
#   `erzeugung_kwh`. Genau deshalb fiel es so lange nicht auf.
#
# **Die Ableitung ändert das heutige Verhalten NICHT** (außer dem belegten
# Fehler). Jede Abweichung zwischen Feld-Registry und Snapshot-Liste steht
# unten mit Grund — „bewusst nicht" ist von „noch nicht bewertet" unterscheidbar
# geworden, und genau das fehlte. Gewächtert in
# `test_snapshot_felder_sot_konformitaet.py`.

# (typ, feld) → Grund, warum das kWh-Feld NICHT stündlich gesnapshottet wird.
_SNAPSHOT_AUSNAHMEN: dict[tuple[str, str], str] = {
    # — Balkonkraftwerk: Kanon-Entscheid 2026-07-31 (Weg A) —
    ("balkonkraftwerk", "speicher_ladung_kwh"):
        "nur_manuell: BKW-Akku ist Kanon-Weg A eine eigene speicher-Investition "
        "mit Parent BKW; ein zweiter Zählerpfad wäre Doppelerfassung",
    ("balkonkraftwerk", "speicher_entladung_kwh"):
        "nur_manuell: siehe speicher_ladung_kwh",
    ("balkonkraftwerk", "eigenverbrauch_kwh"):
        "kein Zähler, sondern optionale Verfeinerung aus manueller Pflege/Import "
        "(Begründung: core/berechnungen/bkw_finanz.py)",
    # — Sonstiges-Erzeuger: dieselbe Klasse wie beim BKW —
    ("sonstiges", "eigenverbrauch_kwh"):
        "wie balkonkraftwerk/eigenverbrauch_kwh — Verfeinerung, kein Zähler",
    ("sonstiges", "einspeisung_kwh"):
        "Anteil der Erzeugung, optional gepflegt; die Bilanz führt der "
        "Anlagen-Einspeisezähler (basis:einspeisung)",
    # — Teilmengen des Sonstiges-Verbrauchs —
    ("sonstiges", "bezug_pv_kwh"):
        "⚠ UNBEWERTET: Teilmenge von verbrauch_sonstig_kwh. Bei der Wallbox ist "
        "das Gegenstück (ladung_pv_kwh) sehr wohl erfasst — die Ungleichheit ist "
        "gemessen, aber nicht entschieden. Beim nächsten Eingriff bewerten",
    ("sonstiges", "bezug_netz_kwh"):
        "⚠ UNBEWERTET: siehe bezug_pv_kwh",
    # — E-Auto —
    ("e-auto", "ladung_extern_kwh"):
        "Monatswert ohne Snapshot-Erfassung — auswärts geladene Energie fließt "
        "nicht durch den Hauszähler (so auch im Docstring von "
        "ist_zaehler_differenz_feld festgehalten)",
    ("e-auto", "v2h_entladung_kwh"):
        "⚠ UNBEWERTET: V2H speist ins Haus zurück und ist damit bilanzrelevant; "
        "warum das Feld nie im Snapshot-Pfad stand, ist nicht dokumentiert. "
        "Beim nächsten Eingriff am E-Auto-Pfad bewerten",
    # — Wechselrichter —
    ("wechselrichter", "pv_erzeugung_kwh"):
        "⚠ UNBEWERTET: Der Typ hat keinen Komponenten-Präfix "
        "(snapshot/komponenten_beitraege._TYP_KEY_PREFIX) und damit keinen "
        "Ziel-Key; die MQTT-Seite kennt ihn dagegen "
        "(mqtt_energy_history_service._MQTT_FIELD_TO_LIVE_KEY). Beim nächsten "
        "Eingriff am Wechselrichter-Pfad bewerten",
}

# Namen, die die Snapshot-Liste führt, obwohl es sie für diesen Typ in der
# Feld-Registry NICHT gibt. Sie bleiben stehen, weil sie in Altbeständen im
# `sensor_mapping` liegen können und ein Entfernen dort Zuordnungen unsichtbar
# machen würde — dieselbe Falle, die `nur_manuell` schon einmal gestellt hat.
# Wirkungslos sind sie nicht automatisch: `sonstiges/verbrauch_kwh` stand an der
# Stelle, an der `verbrauch_sonstig_kwh` fehlte, und täuschte Abdeckung vor.
_SNAPSHOT_KOMPATIBILITAET: dict[str, tuple[str, ...]] = {
    "wallbox": ("ladung_netz_kwh",),   # Wallbox-Registry kennt nur ladung_kwh/ladung_pv_kwh
    "e-auto": ("ladung_kwh",),         # Registry führt verbrauch_kwh; komponenten_beitraege nutzt beide
    "sonstiges": ("verbrauch_kwh",),   # Legacy-Zwilling von verbrauch_sonstig_kwh (s. get_sonstiges_verbrauch_kwh)
}


# (typ, feld) → Grund, warum das Feld zwar als **Zähler** mitgeschnitten wird,
# aber KEINEN Beitrag zu `komponenten_kwh` liefert.
#
# ⚑ **Diese Unterscheidung fehlte, und sie ist die eigentliche N-259-Lehre.**
# „Wird gesnapshottet" und „zählt in die Bilanz" sind zwei Fragen; bis hierher
# beantwortete sie eine Liste plus eine Reihe von `if typ ==`-Zweigen, zwischen
# denen niemand einen Abgleich ziehen konnte. `verbrauch_sonstig_kwh` fehlte in
# **beiden** — und weil es keine Deckungsprüfung gab, sah das aus wie Absicht.
_SNAPSHOT_OHNE_KOMPONENTEN_BEITRAG: dict[tuple[str, str], str] = {
    ("wallbox", "ladung_pv_kwh"):
        "Teilmenge von ladung_kwh — zusätzlich addiert wäre es die "
        "Doppelzählung aus #298 (14 + 9,24 = 23,24 statt 14)",
    ("wallbox", "ladung_netz_kwh"): "Teilmenge von ladung_kwh, s. ladung_pv_kwh",
    ("e-auto", "ladung_pv_kwh"): "Teilmenge der Ladung, s. wallbox/ladung_pv_kwh",
    ("e-auto", "ladung_netz_kwh"): "Teilmenge der Ladung, s. wallbox/ladung_pv_kwh",
    ("speicher", "ladung_netz_kwh"):
        "Teilmenge von ladung_kwh — sonst Doppelzählung für Arbitrage-Anwender",
    ("waermepumpe", "heizenergie_kwh"):
        "THERMISCH (~ Strom × COP), nicht elektrisch — gehört nicht in die "
        "Energiebilanz, nur in die JAZ-Rechnung",
    ("waermepumpe", "warmwasser_kwh"): "thermisch, s. heizenergie_kwh",
    # N-391: der gemeinsame Wärmemengenzähler — thermisch wie seine beiden
    # Achsen. Er ist zusätzlich der Gesamtwert ÜBER ihnen (D1); stünde er in der
    # Energiebilanz, zählte dieselbe Wärme zweimal.
    ("waermepumpe", "waerme_kwh"): "thermisch, s. heizenergie_kwh",
}

# #263 — die gemessenen Betriebsart-Zähler, aus zwei verschiedenen Gründen:
#
# * **Strom je Betriebsart ist eine Teilmenge** von `stromverbrauch_kwh` —
#   dieselbe Klasse wie `wallbox/ladung_pv_kwh` darüber. Als eigener
#   Komponenten-Beitrag stünde der Verbrauch der Wärmepumpe in der Tages- und
#   Stundenbilanz doppelt (einmal gesamt, einmal je Betriebsart).
#   ⭐ **Seit dem 15.09.2026 gilt dieser Satz mit einer Bedingung (R-1/K3 Regel
#   4, N-486): „Teilmenge von" setzt voraus, dass es die Menge gibt.** Ist weder
#   ein Gesamtzähler noch eine feine Achse zugeordnet, tragen die
#   Betriebsart-Zähler die Menge selbst und liefern dann sehr wohl einen
#   Beitrag (`komponenten_beitraege.investition_beitraege`). Der Eintrag bleibt
#   hier stehen, weil er den **Regelfall** beschreibt — und weil ihn der
#   Wächter `test_snapshot_felder_sot_konformitaet.py` in der Lage ohne
#   Gesamtzähler ohnehin als „gedeckt" sieht.
# * **Nutzenergie je Betriebsart ist thermisch**, nicht elektrisch — dieselbe
#   Klasse wie `heizenergie_kwh`.
#
# ⚠ Der Monatswert entsteht davon unberührt: er kommt über die Vorschläge des
# Monatsabschlusses (HA-Statistik · MQTT · Connector) in die IMD-Zeile, nicht
# über den Komponenten-Beitrag. Gesnapshottet werden die Zähler weiterhin —
# nur eben ohne eigenen Eintrag in der Energiebilanz.
_SNAPSHOT_OHNE_KOMPONENTEN_BEITRAG.update({
    **{
        ("waermepumpe", _feld):
            "Teilmenge von stromverbrauch_kwh (#263) — als eigener Beitrag "
            "stünde der WP-Verbrauch in der Tagesbilanz doppelt"
        for _feld in _BETRIEBSART_STROM_FELDNAMEN
    },
    **{
        ("waermepumpe", _feld):
            "THERMISCH, nicht elektrisch (#263) — s. heizenergie_kwh"
        for _feld in _BETRIEBSART_NUTZENERGIE_FELDNAMEN
    },
})


def kumulative_zaehler_felder_je_typ() -> dict[str, tuple[str, ...]]:
    """Je Investitionstyp die kWh-Felder, die als **kumulativer Zähler**
    stündlich gesnapshottet werden — abgeleitet aus `INVESTITION_FELDER`.

    Regel: jedes Feld mit Energie-Einheit, außer es steht in
    `_SNAPSHOT_AUSNAHMEN`. Dazu die Kompatibilitäts-Namen aus
    `_SNAPSHOT_KOMPATIBILITAET`. Bei `sonstiges` werden die Kategorien
    (erzeuger/verbraucher/speicher) vereinigt — welche Felder ein konkretes
    Gerät führt, entscheidet erst `get_felder_fuer_sonstiges`.

    Die Reihenfolge ist stabil (Registry-Reihenfolge, dann Kompatibilität),
    damit Proben sie vergleichen können.
    """
    out: dict[str, tuple[str, ...]] = {}
    for typ, felder in INVESTITION_FELDER.items():
        listen = (list(felder.values()) if isinstance(felder, dict) else [felder])
        namen: list[str] = []
        for liste in listen:
            for f in liste:
                feld = f["feld"]
                if einheit_klasse(FELD_EINHEITEN.get(feld)) != "energie":
                    continue
                if (typ, feld) in _SNAPSHOT_AUSNAHMEN:
                    continue
                if feld not in namen:
                    namen.append(feld)
        for feld in _SNAPSHOT_KOMPATIBILITAET.get(typ, ()):
            if feld not in namen:
                namen.append(feld)
        if namen:
            out[typ] = tuple(namen)
    return out


def stand_felder() -> frozenset[str]:
    """Die Felder, deren Wert ein **Stand** ist und keine Menge — abgeleitet
    aus `INVESTITION_FELDER` über den Marker ``stand: True``.

    **Warum es diese Unterscheidung gibt (F-58, 21.08.2026).** Die
    Snapshot-Schiene holt jeden gemappten Zähler über
    `ha_statistics_service.get_value_at`, und das nimmt bei einem Sensor mit
    `has_sum` **ausschließlich HAs `sum`** — die reset-bereinigte
    Verbrauchssumme seit Aufzeichnungsbeginn. Das ist für eine **Flussgröße**
    richtig und bewusst so entschieden (v3.25.18, Issue #184): ein
    utility_meter mit Tagesreset hat in `state` den Tageswert, nur `sum` ist
    die Lebensdauer-Zahl.

    Für eine **Bestandsgröße** ist dieselbe Wahl falsch. Der Zählerstand eines
    Gas-, Wasser- oder Ölzählers ist die Zahl, die auf dem Zähler steht; sie
    steht in `state`. Ein Melder sah 90 m³, wo sein Sensor 47,360 m³ meldete —
    und wir haben ihm zunächst geantwortet, eedc zeige „genau die Zahl, die
    dein Sensor meldet".

    ⚠ **Der zweite Zweig war genauso falsch:** ohne `has_sum` verlangt
    `_value_at_wert` eine Energie-Einheit und liefert sonst `None`. Ein
    Wasserzähler in m³ bekam damit **gar keinen** Snapshot. Ein Stand-Feld
    braucht beides nicht — es liest `state` und rechnet nichts um.

    ⛔ **Was hier bewusst NICHT steht: `wp_starts_anzahl` und
    `wp_betriebsstunden`.** Sie sind zwar ebenfalls Bestandsgrößen, aber ihr
    Snapshot wird **nur differenziert** (`aggregate_day`), und der
    Lebensdauer-Stand kommt aus einem eigenen Leser
    (`snapshot/reader.get_counter_lifetime`, HA-Live-State zuerst). Sie
    umzustellen hieße, eine bestehende Reihe von `sum` auf `state` zu
    verschieben — bei einer WP, deren Gerätezähler weit über HAs
    Aufzeichnungssumme liegt, ergäbe das an genau einem Tag einen Sprung in
    der Größe des Lebensdauer-Zählers. `_get_counter_deltas_for_day` kappt
    **negative** Deltas, positive nicht. Das ist als Nebenfund geführt, nicht
    als Auslassung.
    """
    namen: set[str] = set()
    for felder in INVESTITION_FELDER.values():
        listen = (list(felder.values()) if isinstance(felder, dict) else [felder])
        for liste in listen:
            for f in liste:
                if f.get("stand"):
                    namen.add(f["feld"])
    return frozenset(namen)


#: Die Stand-Felder als Konstante — einmal abgeleitet, überall dieselbe Antwort.
STAND_FELDER: Final[frozenset[str]] = stand_felder()


def ist_stand_feld(feld: str) -> bool:
    """Ist der Wert dieses Feldes ein **Stand** (Bestandsgröße)?

    Mit Innengeräte-Auflösung wie jede andere Namens-Whitelist — ein Feld-Key
    kann das Suffix `-<id>` tragen (`basis_feld_key`).
    """
    if not feld:
        return False
    return basis_feld_key(feld) in STAND_FELDER


# =============================================================================
# Reader-Helper für `verbrauch_daten`-JSON
#
# Drift-Audit Domäne F: bisher waren 27+ Aufrufer mit Mustern wie
# `data.get("a", 0) or data.get("b", 0)` über das Repo verstreut. Bei
# Schema-Drift (alter Key bleibt in Daten, neuer Key fehlt) führte das
# zu inkonsistentem Verhalten zwischen Endpoints.
#
# Diese Helper sind die SoT für PV/WP/E-Auto/Speicher-Energiewerte. Bei
# künftigen Schema-Wechseln nur hier anpassen.
# =============================================================================

def get_pv_erzeugung_kwh(data: dict) -> float:
    """PV-Modul- oder BKW-Erzeugung. Liest `pv_erzeugung_kwh` (kanonisch),
    Legacy-Fallback `erzeugung_kwh`.
    """
    if not data:
        return 0.0
    return float(data.get("pv_erzeugung_kwh") or data.get("erzeugung_kwh") or 0)


def get_wp_heizenergie_kwh(data: dict) -> float:
    """Wärmepumpen-Heizenergie (nicht Warmwasser).
    Liest `heizenergie_kwh` (kanonisch), Legacy-Fallback `heizung_kwh`.
    """
    if not data:
        return 0.0
    return float(data.get("heizenergie_kwh") or data.get("heizung_kwh") or 0)


def get_wp_warmwasser_kwh(data: dict, params: Optional[dict] = None) -> float:
    """Abgegebene Warmwasser-Wärme einer Wärmepumpe — **die eine Lesetür**.

    Spiegelbild zu `get_wp_heizenergie_kwh`, mit einem Zusatz: Es fragt die
    Registry, ob **dieses Gerät die Größe überhaupt hat**
    (`groesse_gibt_es_am_geraet`). Eine Split-Klimaanlage hat keinen
    Warmwasserkreis; ein dort gespeicherter Wert ist keine Wärme dieses Geräts
    und darf in keiner Summe erscheinen, die eine Abgabe behauptet.

    ⭐ **N-379 — warum es diese Funktion gibt.** N-304 hat das Feld am
    22.08.2026 aus der **Erfassung** genommen und im Docstring seiner Probe den
    Schaden wörtlich benannt: *„Ein an einer Luft-Luft-Anlage gepflegter
    Warmwasser-Wert erzeugt eine Ersparnis für Wärme, die das Gerät nie erzeugt
    hat."* Für **bereits gespeicherte** Werte galt das weiter, denn elf
    Faltstellen in sechs Dateien lasen `warmwasser_kwh` roh aus
    `verbrauch_daten` — Hub, Cockpit → Monat, Aussichten, HA-Export und der
    Gas-/CO₂-Vergleich. Gemeldet von dietmar1968 (T89667 #295): 889 kWh
    „Warmwasser" an seiner Klimaanlage, daraus „Ersparnis vs. Gas 38 €" und
    „CO₂-Ersparnis −112 kg".

    ⚠ **Vierte Runde der #236-Folgewellen-Klasse.** `ist-waerme-klima.md` §W-12
    nennt N-304 selbst die dritte: *ein Filter auf einer Schicht reicht nicht,
    wenn mehrere Pfade dieselbe Größe lesen.* Deshalb eine Tür statt fünf
    Pflaster — wer eine sechste Read-Site baut, liest hier.

    ⛔ **Der gespeicherte Wert bleibt** (keine Migration): eedc weiß nicht, was
    er ist, nur dass er an diesem Gerät keine Warmwasser-Wärme sein kann. Der
    Daten-Checker benennt ihn und nennt seinen Platz.

    ⛔ **Ohne `params` verhält sie sich wie der Rohzugriff.** Das ist kein
    Schlupfloch, sondern die Lage der Aufrufer, die keine Investition zur Hand
    haben (Import-/Schreibpfade); sie sollen nichts filtern.
    """
    if not data:
        return 0.0
    if params is not None and not groesse_gibt_es_am_geraet(
        "waermepumpe", "warmwasser_kwh", params
    ):
        return 0.0
    return float(data.get("warmwasser_kwh") or 0)


def hat_wp_warmwasser_wert(data: dict, params: Optional[dict] = None) -> bool:
    """Trägt diese Monatszeile überhaupt einen Warmwasser-Wert? — **Anwesenheit,
    nicht Menge.**

    Schwester von `get_wp_warmwasser_kwh` mit derselben Geräte-Bedingung, aber
    der anderen Frage. Die Lesetür liefert `float` und macht aus einem fehlenden
    Wert eine 0 (`data.get(...) or 0`) — für eine Summe ist das richtig, für die
    Frage *„wurde hier je etwas gemessen?"* nicht: Eine **gepflegte** 0 ist eine
    Messung, ein fehlender Eintrag ist eine Leerstelle, und beide kämen als
    `0.0` zurück. Das ist die `is not None`-Regel aus `CLAUDE.md`, hier als
    eigene Tür statt als Rohzugriff daneben.

    ⭐ **Wofür sie gebraucht wird (8ear, #404):** SOLL Wärme/Klima §3.2a **R1**
    sagt *„was ein Gerät liefern kann, sagt der zugeordnete Zähler, nicht seine
    Bauart — wer keinen zuordnet, sieht die Achse nicht."* Die Warmwasser-Achse
    im Komponenten-Hub hing bis dahin allein an der Bauart
    (`groesse_gibt_es_am_geraet`) und stand deshalb an **jeder** Luft-Wasser-WP,
    auch an einer, die nachweislich nie Warmwasser gemessen hat — dauerhaft auf
    Null, samt Balken, Spalte und Legendeneintrag.

    ⛔ **Sie ersetzt `groesse_gibt_es_am_geraet` NICHT, sie ergänzt es.** Die
    Bauart-Frage bleibt die härtere: Eine Split-Klimaanlage hat keinen
    Warmwasserkreis, dort zählt ein gespeicherter Wert auch dann nicht, wenn er
    dasteht (N-379). Diese Funktion trägt die weichere Hälfte und darf nur
    **zusätzlich** geprüft werden, nie an ihrer Stelle.

    ⚠ **Und sie entscheidet nur über die ANZEIGE einer Achse, nie über eine
    Kennzahl je Monatszeile.** Eine Arbeitszahl fragt, ob das Gerät die Größe
    hat — nicht, ob ein anderer Monat sie trug.
    """
    if not data:
        return False
    if params is not None and not groesse_gibt_es_am_geraet(
        "waermepumpe", "warmwasser_kwh", params
    ):
        return False
    return data.get("warmwasser_kwh") is not None


def get_eauto_ladung_kwh(data: dict) -> float:
    """E-Auto- oder Wallbox-Gesamtladung in kWh.
    Liest `ladung_kwh` (kanonisch), Legacy-Fallback `verbrauch_kwh`.
    """
    if not data:
        return 0.0
    return float(data.get("ladung_kwh") or data.get("verbrauch_kwh") or 0)


def get_speicher_netzladung_kwh(data: dict) -> float:
    """Speicher-Netzladung (Arbitrage). Liest `ladung_netz_kwh` (kanonisch),
    Legacy-Fallback `speicher_ladung_netz_kwh`.
    """
    if not data:
        return 0.0
    return float(data.get("ladung_netz_kwh") or data.get("speicher_ladung_netz_kwh") or 0)


def get_emob_pv_netz_kwh(data: dict, total_kwh: float | None = None) -> tuple[float, float]:
    """E-Mobilitäts-PV-/Netz-Anteil aus Wallbox-/E-Auto-Monatsdaten.

    Liest `ladung_pv_kwh` direkt. Für `ladung_netz_kwh`:
    - wenn als Key vorhanden → verwenden (auch 0 ist ein gültiger gepflegter Wert)
    - sonst aus Gesamt-Ladung ableiten: `netz = max(0, total - pv)`.

    Hintergrund #262 (junky84): der evcc-Portal-Import liefert pro Session nur
    `Energie (kWh)` + `Sonne (%)` und schreibt damit `ladung_kwh` + `ladung_pv_kwh`,
    aber kein `ladung_netz_kwh`. Pool-Max-Aggregationen, die nur diese beiden Keys
    direkt lasen, sahen Netz = 0 und damit PV-Anteil = 100 %.

    `total_kwh` darf vom Aufrufer übergeben werden, wenn die Gesamt-Ladung bereits
    via `get_eauto_ladung_kwh()` bestimmt wurde — spart eine zweite Lesung.
    """
    if not data:
        return (0.0, 0.0)
    pv = float(data.get("ladung_pv_kwh") or 0)
    if "ladung_netz_kwh" in data and data["ladung_netz_kwh"] is not None:
        return (pv, float(data["ladung_netz_kwh"]))
    if total_kwh is None:
        total_kwh = get_eauto_ladung_kwh(data)
    return (pv, max(0.0, total_kwh - pv))


# Die Verbrauchs-Felder eines *Sonstiges*-Geräts, in Präzedenz-Reihenfolge:
# `verbrauch_sonstig_kwh` ist der **kanonische** Registry-Name — so heißt der
# `sensor_mapping`-Key, und unter diesem Namen publiziert eedc auch sein
# MQTT-Topic. `verbrauch_kwh` ist der Legacy-Zwilling und bleibt nur lesbar
# (Altbestand im Mapping); er darf nie zusätzlich zählen, beide gehören
# derselben Either-Or-Gruppe an.
SONSTIGES_VERBRAUCH_FELDER: tuple[str, ...] = ("verbrauch_sonstig_kwh", "verbrauch_kwh")


def sonstiges_feld_reihenfolge(kategorie: str | None) -> tuple[str, ...]:
    """Energie-Felder eines *Sonstiges*-Geräts in **Präzedenz-Reihenfolge**.

    Ein solches Gerät hat entweder eine Erzeugung oder einen Verbrauch, nie
    beides — die gepflegte ``kategorie`` sagt, welches Feld führt. Wer keine
    gepflegt hat, wird als Verbraucher gelesen (dieselbe Lesart wie in den
    Schreibpfaden, siehe ``berechnungen.energie.sonstiges_richtung``).

    **Warum das eine Funktion ist (N-259).** Dieselbe Reihenfolge stand am
    16.08.2026 an **drei** Stellen handgeschrieben — und ein einziger
    abweichender Name hat gereicht, damit eedc ein MQTT-Topic **selbst
    publizierte und beim Einlesen wieder verwarf**: Der Snapshot suchte
    ``verbrauch_kwh``, die Zuordnungsfläche schrieb ``verbrauch_sonstig_kwh``.
    Der Monat kam trotzdem an (dieser Getter liest beide), der Tageswert nicht —
    es sah nach „Wert fehlt" aus statt nach „Feld wird nirgends gefunden".
    Eine vierte Kopie wäre dieselbe Wette noch einmal.

    ⚠ **Ein Zähler liefert `()` — und das ist kein Sonderfall, sondern die
    Antwort auf die gestellte Frage** (#377): Diese Funktion nennt die
    **Energie**-Felder eines Geräts, und ein Gaszähler hat keine. Ohne den
    leeren Rückgabewert liefe der Fallback in Zeile darunter, und der Snapshot
    suchte am Gaszähler nach `verbrauch_sonstig_kwh` — die N-259-Klasse in der
    Gegenrichtung: nicht ein falscher Name, sondern ein Feld, das es an diesem
    Gerät gar nicht geben darf.
    """
    if ist_zaehler_kategorie(kategorie):
        return ()
    if ist_abgabe_kategorie(kategorie):
        return ("abgabe_kwh",)
    if kategorie == "erzeuger":
        return ("erzeugung_kwh", *SONSTIGES_VERBRAUCH_FELDER)
    return (*SONSTIGES_VERBRAUCH_FELDER, "erzeugung_kwh")


def get_sonstiges_verbrauch_kwh(data: dict) -> float:
    """Sonstiges-Verbraucher-Energie. Liest `verbrauch_sonstig_kwh` (kanonisch),
    Legacy-Fallback `verbrauch_kwh` — Reihenfolge aus
    `SONSTIGES_VERBRAUCH_FELDER`, damit sie nicht neben dem SoT driftet.
    """
    if not data:
        return 0.0
    for feld in SONSTIGES_VERBRAUCH_FELDER:
        wert = data.get(feld)
        if wert:
            return float(wert)
    return 0.0


#: Die zwei **Summanden**-Achsen des Wärmepumpen-Stroms (Gegenstück zu den
#: Betriebsart-Teilmengen). Nur die Namen — welche davon ein konkretes Gerät
#: hat, beantwortet `feine_strom_achsen` an der Registry.
FEINE_STROM_FELDER: Final[tuple[str, ...]] = (
    "strom_heizen_kwh", "strom_warmwasser_kwh",
)

#: Die Feldnamen, unter denen eine **Gesamt**-Strommenge einer Wärmepumpe in
#: einer Monatszeile stehen kann — das kanonische Feld und seine zwei
#: Legacy-Namen. ⭐ Sie stehen hier als Liste, seit K3 Regel 4 (R-1) fragen muss,
#: ob **überhaupt** eine Gesamtmenge da ist: dieselbe Kette ein zweites Mal
#: hinzuschreiben wäre die F-56-Form.
WP_GESAMT_STROM_FELDER: Final[tuple[str, ...]] = (
    "stromverbrauch_kwh", "strom_kwh", "verbrauch_kwh",
)


def feine_strom_achsen(parameter: dict) -> list[str]:
    """Welche feinen Strom-Achsen **hat** dieses Gerät? (K3, SOLL §3.2)

    Die Frage ist eine Eigenschaft des **Geräts**, nicht der Erfassung: Eine
    Luft-Wasser-Wärmepumpe hat Heizen und Warmwasser, eine Split-Klimaanlage
    nur Heizen (kein Warmwasserkreis — ``strom_warmwasser_kwh`` trägt
    ``!luft_luft``, N-304/B5).

    ⚠ **Deshalb wird die Registry mit gesetztem Kennzeichen befragt**, auch wenn
    es an der Investition aus ist: ``getrennte_strommessung`` sagt, ob die Achsen
    *getrennt erfasst werden*, nicht ob es sie *gibt*. Ohne diese Normalisierung
    meldete ein Gerät mit ausgeschaltetem Kennzeichen „gar keine Achsen" — und
    K3 könnte in dieser Richtung (Kennzeichen aus, feiner Zähler zugeordnet)
    nicht greifen.

    ⭐ **Registry statt Bauart-Abfrage** (R1): ``ist_luft_luft_waermepumpe`` hier
    aufzurufen wäre die zweite Stelle, die dieselbe Frage beantwortet — genau
    die Drift-Klasse, an der F-56 entstanden ist.

    ⛔ **Hier stand sie bis zum 13.09.2026 nicht, sondern in**
    ``services/snapshot/komponenten_beitraege.py`` — mit einem *lokalen* Import
    auf dieses Modul, weil ein Modul-Import zirkulär gewesen wäre. Sie ist
    hierher gezogen worden, als {@link wp_strom_stufe} dieselbe Frage stellte:
    Die K3-Stufenregel steht seither an **einer** Stelle statt an zweien (F-56).

    ⚠ **Seit WK-16d (14.09.2026) fragt die Stufenregel sie nicht mehr** — ein
    Gesamtzähler ist die Menge, ob die Aufteilung vollständig ist oder nicht.
    Geblieben ist ihr **zweiter** Leser, und der ist der ältere: die
    Beitragsschicht des Tages braucht die Namen der Achsen, die sie emittiert,
    wenn kein Gesamtzähler zugeordnet ist. Sie bleibt hier, damit *„welche
    Achsen hat dieses Gerät?"* weiterhin an **einer** Stelle beantwortet wird.
    """
    angeboten = {
        f["feld"] for f in get_felder_fuer_investition(
            "waermepumpe", {**(parameter or {}), "getrennte_strommessung": True},
        )
    }
    return [f for f in FEINE_STROM_FELDER if f in angeboten]


#: Wie weit darf der Gesamtzähler **unter** der Summe der Achsen liegen, bevor
#: eedc ihn für widersprüchlich hält? — **eine** Stelle für beide Ebenen
#: (WK-16d/K1). Anteilig, weil ein Zählerstand mit der Menge rundet; mit einem
#: Mindestwert, weil 1 % einer kleinen Menge unter jeder Rundung liegt.
WP_STROM_TOLERANZ_ANTEIL: Final[float] = 0.01
#: Mindest-Toleranz einer **Monats**zeile (kWh) — wie beim Wärme-Zwilling in
#: ``daten_checker/monatsdaten.py`` (N-391).
WP_STROM_TOLERANZ_MIN_MONAT_KWH: Final[float] = 0.5
#: Mindest-Toleranz eines **Tages** (kWh). Ein Zehntel der Monatsschwelle:
#: dieselbe Rundung, ein Dreißigstel der Menge.
WP_STROM_TOLERANZ_MIN_TAG_KWH: Final[float] = 0.05


def wp_strom_toleranz_kwh(
    feine_summe_kwh: float,
    *,
    mindest_kwh: float = WP_STROM_TOLERANZ_MIN_MONAT_KWH,
) -> float:
    """Die Toleranz für *„Gesamtzähler kleiner als die Summe der Achsen?"*.

    ⛔ **Sie steht hier und nicht bei den zwei Fragern** ({@link
    wp_strom_stufe} und der Daten-Checker, der dieselbe Lage meldet): Zwei
    Schwellen für dieselbe Frage wären die F-56-Klasse — die Fläche würde eine
    Lage bemängeln, die die Rechnung daneben durchgehen lässt, oder umgekehrt.
    """
    return max(abs(feine_summe_kwh) * WP_STROM_TOLERANZ_ANTEIL, mindest_kwh)


def wp_strom_stufe(
    *,
    hat_gesamtzaehler: bool,
    gesamt_kwh: float | None = None,
    feine_summe_kwh: float | None = None,
    toleranz_mindest_kwh: float = WP_STROM_TOLERANZ_MIN_MONAT_KWH,
    hat_feine_achsen: bool = True,
    hat_betriebsart_zaehler: bool = False,
) -> Literal["fein", "gesamt", "betriebsart"]:
    """K3 in EINER Stelle — die Regel, nicht ihre Eingänge (Konzept Kap. 3).

    Die Vorrangkette für *„welche Menge ist der Stromverbrauch dieses
    Geräts?"*:

    1. **Ein Gesamtzähler ist die Menge** (K1 — *„die Gesamtmenge ist immer die
       Wahrheit"*) ⇒ ``"gesamt"``. Die feinen Achsen (Heizen/Warmwasser) und die
       Betriebsart-Zähler sind die **Aufteilung darunter**; was er mehr misst
       als sie, heißt *nicht aufgeteilt* (K5, {@link wp_strom_aufteilung}).
    2. **Es sei denn, er misst weniger als die Aufteilung** — mehr als die
       Toleranz ({@link wp_strom_toleranz_kwh}) darunter ⇒ ``"fein"``, und der
       Daten-Checker nennt den Widerspruch. Zwilling der Wärme-Invariante aus
       N-391: nur **diese** Richtung ist ein Fehler.
    3. **Kein Gesamtzähler** ⇒ ``"fein"``: die Aufteilung ist dann die einzige
       Messung, die es gibt, ob sie vollständig ist oder nicht. Sie zu verwerfen
       hieße den Block verschwinden zu lassen (#263, OB73-gif).
    4. **Auch keine feinen Achsen, aber gemessene Betriebsart-Zähler** ⇒
       ``"betriebsart"``: dann sind *sie* die einzige Messung, und derselbe Satz
       aus Regel 3 gilt für sie (**R-1**, Konzept Kap. 3/K3, 15.09.2026).

    ⛔ **Regel 4 fehlte bis zum 15.09.2026, und der Satz von Regel 3 galt
    trotzdem schon** (N-486). Gemessen:
    ``get_wp_strom_kwh({'betriebsart_strom_heizen_kwh': 700}, {'wp_art':
    'luft_luft'})`` = **0,0**. Wer an seiner Split-Klimaanlage nur
    Betriebsart-Zähler zuordnete, bekam **gar keinen** Strom — keine Kosten,
    kein CO₂, keine Kennzahl —, während die Datenquellen-Fläche daneben
    „ausgewertet in …" behauptete. Die Begründung ist die **der Kategorie**,
    nicht des Beispiels: *ein Zähler, der misst, ist die einzige Messung, die es
    gibt.* Sie trägt für die feinen Achsen (Regel 3) und für die
    Betriebsart-Zähler gleichermaßen.

    ⚠ **Die Reihenfolge ist keine Geschmacksfrage.** Die Betriebsart-Zähler sind
    **Teilmengen** (Konzept Kap. 3, Familientabelle) — neben einer
    Summanden-Achse dürfen sie die Menge nicht tragen, sonst stünde in derselben
    Zeile eine Teilmenge an der Stelle eines Summanden. Sie kommen deshalb erst,
    wenn **weder** ein Gesamtzähler **noch** eine feine Achse da ist; dann teilen
    sie nichts mehr auf, sondern *sind* die Menge (Modus-Rest 0).

    ⚠ **E7 bleibt unberührt.** Die Summe ist eine **Menge**, kein
    Funktions-Nenner: ``arbeitszahl_je_funktion`` nimmt weiterhin ausschließlich
    den gemessenen Strom *dieser* Funktion, und der steht in
    ``strom_heizen_kwh``/``strom_warmwasser_kwh`` — in dieser Stufe gibt es ihn
    per Definition nicht.

    ⛔ **Hier stand bis zum 14.09.2026 eine erste Stufe: „Die feine Aufteilung
    ist vollständig ⇒ fein; ein zusätzlicher Gesamtzähler wird verworfen, sonst
    zählte derselbe Strom zweimal."** Der Satz stimmte für die *Doppelzählung*
    und war für die *Menge* falsch. Misst der Gesamtzähler **mehr** als die
    beiden Achsen — Standby, Steuerung, Umwälzpumpen; bei dietmar1968 145 von
    2193 kWh im Jahr, 6,6 % —, verlor eedc diese Kilowattstunden aus Strom,
    Kosten, CO₂ und Arbeitszahl-Nenner. Das verletzt **K1** und **K5**.
    *Doppelzählung entsteht beim **Addieren** von Gesamt und Achsen, nicht beim
    **Ersetzen*** — die alte Regel verhinderte das Falsche und verwarf dabei
    eine Messung.

    ⚠ **Tag und Monat beantworten „belegt?" verschieden — und sie MÜSSEN das.**
    Der Tag fragt *„ist ein Zähler zugeordnet?"* (``ist_verfuegbar``), der Monat
    *„steht ein Wert in der Zeile?"* (``data.get(feld) is not None``); eine
    Monatszeile darf ohne jeden Zähler von Hand gepflegt sein. Was beide teilen,
    ist die **Vorrangkette** — sie steht deshalb hier und nicht zweimal (F-56).
    Auf der Zuordnungs-Ebene gibt es keine Werte; dort bleiben ``gesamt_kwh``
    und ``feine_summe_kwh`` leer und Regel 2 greift nicht.

    ⛔ **Das Kennzeichen ``getrennte_strommessung`` steht nicht mehr hier.** Es
    beantwortet die andere Frage — *„sind die feinen Achsen **Summanden**?"* —
    und die stellt {@link get_wp_strom_kwh} vor dem Aufruf. K3 gilt weiter in
    beide Richtungen: Kennzeichen **aus**, kein Gesamtzähler, aber ein feiner
    Zähler zugeordnet ⇒ Regel 3, er trägt.

    Args:
        hat_gesamtzaehler: trägt dieses Gerät ``stromverbrauch_kwh`` — in der
            Ebene des Aufrufers (Zuordnung bzw. Zeilenwert).
        gesamt_kwh: sein Wert, wo es einen gibt (Monatszeile). ``None`` auf der
            Zuordnungs-Ebene.
        feine_summe_kwh: die Menge, die die Aufteilung sonst trüge — also genau
            das, was der feine Zweig von {@link get_wp_strom_kwh} rechnet.
        toleranz_mindest_kwh: ``WP_STROM_TOLERANZ_MIN_MONAT_KWH`` oder
            ``…_TAG_KWH``, je nach Ebene des Aufrufers.
        hat_feine_achsen: trägt dieses Gerät eine **Summanden**-Achse
            (``strom_heizen_kwh``/``strom_warmwasser_kwh``) — in der Ebene des
            Aufrufers. ⚠ **Default ``True``**, damit ein Aufrufer, der die Frage
            nicht stellt, bitgleich zu vor dem 15.09.2026 antwortet: Regel 4
            greift dann nie.
        hat_betriebsart_zaehler: trägt es einen **gemessenen**
            Betriebsart-Stromzähler (Gerätefeld oder Innengerät) — nur dann gibt
            es Regel 4 überhaupt.

    Returns:
        ``"gesamt"`` (``stromverbrauch_kwh`` trägt die Menge), ``"fein"`` (die
        Summanden-Achsen tragen sie) oder ``"betriebsart"`` (Σ der gemessenen
        Betriebsart-Ströme trägt sie).
    """
    def _ohne_gesamtzaehler() -> Literal["fein", "betriebsart"]:
        # Regel 4 vor Regel 3 nur dort, wo Regel 3 nichts zu tragen hat.
        if not hat_feine_achsen and hat_betriebsart_zaehler:
            return "betriebsart"
        return "fein"

    if not hat_gesamtzaehler:
        return _ohne_gesamtzaehler()
    if gesamt_kwh is not None and feine_summe_kwh is not None:
        if gesamt_kwh < feine_summe_kwh - wp_strom_toleranz_kwh(
            feine_summe_kwh, mindest_kwh=toleranz_mindest_kwh,
        ):
            return _ohne_gesamtzaehler()
    return "gesamt"


def wp_feine_summe_kwh(
    strom_heizen_kwh: float | None,
    strom_warmwasser_kwh: float | None,
    funktionsfremd_kwh: float = 0.0,
    *,
    betriebsart_gemessen: bool = False,
) -> float:
    """Was die **Summanden**-Aufteilung eines Geräts trägt (K4).

    ``strom_heizen_kwh + strom_warmwasser_kwh`` und — bei **gemessener**
    Betriebsart — die funktionsfremden Teilmengen (W-16: ein gemessener
    Betriebsart-Zähler steht *neben* den beiden Achsen, nicht darin; ein
    **abgeleiteter** Split verteilt dagegen die vorhandene Menge, ihn zu
    addieren wäre die Doppelzählung von W-16b).

    ⭐ **Warum das eine eigene Funktion ist** (WK-16c, 14.09.2026): Die Formel
    wird an **zwei** Ebenen gebraucht — an der Monatszeile von {@link
    wp_strom_aufteilung} und an den Tageswerten der Verteilungs-Sicht
    (``services/waerme_verteilung.py``), die keine ``verbrauch_daten``-Zeile
    hat, sondern Snapshot-Summen je Gerät. Sie dort nachzubauen wäre die
    F-56-Klasse; die **Eingänge** dürfen sich unterscheiden, die Formel nicht.
    """
    summe = float((strom_heizen_kwh or 0) + (strom_warmwasser_kwh or 0))
    if betriebsart_gemessen:
        summe += float(funktionsfremd_kwh or 0.0)
    return summe


def wp_nicht_aufgeteilt_kwh(
    menge_kwh: float, feine_summe_kwh: float, *, hat_aufteilung: bool,
) -> float:
    """Der **Zähler**-Rest eines Geräts (K5) — ``Menge − Aufteilung ≥ 0``.

    Standby, Steuerung, Umwälzpumpen — dietmar1968s „Systemverbrauch".

    ⚠ **``hat_aufteilung`` ist keine Formsache:** *„nicht aufgeteilt"* setzt
    eine Aufteilung voraus. Wer nur einen Gesamtzähler pflegt, hat keinen Rest,
    sondern nur eine Menge; dass die Achsen fehlen, sagt der Daten-Checker.

    ⛔ **Nicht zu verwechseln mit dem Modus-Rest**
    (``WpFakten.modus_nicht_aufgeteilt_kwh`` bzw.
    ``TagesStapel.nicht_aufgeteilt_kwh``). Zwei Reste zweier verschiedener
    Aufteilungen derselben Menge; sie zu addieren wäre Doppelzählung
    (Konzept Wärme/Klima Kap. 3, Zwei-Reste-Tabelle).

    Zweiter Aufrufer neben {@link wp_strom_aufteilung}: die Tagesebene der
    Verteilungs-Sicht — s. {@link wp_feine_summe_kwh}.
    """
    return max(0.0, menge_kwh - feine_summe_kwh) if hat_aufteilung else 0.0


@dataclass(frozen=True)
class WpStromAufteilung:
    """Menge **und** Rest einer Monatszeile — K1 und K5 in einer Antwort.

    ⭐ **Warum der Rest hier entsteht und nicht beim Leser.** Er ist die
    Differenz zweier Größen, die nur diese Funktion beide kennt: der gewählten
    Menge und der Summe, die die Aufteilung trägt. Ein Leser, der ihn selbst
    bildete, müsste die Stufenregel nachbauen — die F-56-Klasse.
    """

    #: Die Menge dieses Geräts (K1) — was jede Bilanz, jede Kosten- und jede
    #: CO₂-Rechnung liest.
    menge_kwh: float
    #: Was die feine Aufteilung trägt: ``strom_heizen_kwh + strom_warmwasser_kwh``
    #: und — bei **gemessener** Betriebsart — die funktionsfremden Teilmengen
    #: (W-16). 0.0 im Nicht-getrennt-Zweig: dort gibt es keine Summanden.
    feine_summe_kwh: float
    #: ``Menge − Aufteilung ≥ 0``, der **Zähler**-Rest (K5): Standby, Steuerung,
    #: Umwälzpumpen — dietmar1968s „Systemverbrauch".
    #:
    #: ⛔ **Nicht zu verwechseln mit** ``WpFakten.modus_nicht_aufgeteilt_kwh``.
    #: Das sind **zwei** Reste zweier **verschiedener** Aufteilungen derselben
    #: Menge, und beide sind richtig: hier der Rest der **Summanden**-Achsen
    #: (Heizen/Warmwasser), dort der Rest der **Betriebsart**-Teilmengen
    #: (Stunden ohne Modus-Signal). Sie zu addieren wäre Doppelzählung.
    #:
    #: ⚠ **0.0, solange es gar keine Aufteilung gibt** — *„nicht aufgeteilt"*
    #: setzt eine Aufteilung voraus. Wer nur einen Gesamtzähler pflegt, hat
    #: keinen Rest, sondern nur eine Menge; dass die Achsen fehlen, sagt der
    #: Daten-Checker, nicht diese Zahl.
    nicht_aufgeteilt_kwh: float
    #: Welche Regel gewonnen hat — s. {@link wp_strom_stufe}.
    stufe: Literal["fein", "gesamt"]
    #: Regel 2: der Gesamtzähler steht **unter** der Aufteilung (jenseits der
    #: Toleranz). Die Achsen tragen, und der Daten-Checker meldet es.
    gesamtzaehler_zu_klein: bool


def wp_strom_aufteilung(
    data: dict | None, params: dict | None = None,
) -> WpStromAufteilung:
    """Menge, Aufteilung und Rest einer Monatszeile (K1 · K3 · K5).

    Die **eine** Auflösung hinter {@link get_wp_strom_kwh}; dessen Rückgabe ist
    ``menge_kwh``. Wer zusätzlich den Rest oder den Widerspruch braucht — die
    Monats-Fakten und der Daten-Checker —, ruft diese Tür.
    """
    d = data or {}
    if not d:
        return WpStromAufteilung(0.0, 0.0, 0.0, "fein", False)

    # Lokaler Import: `betriebsart_gemessen` liest `basis_feld_key` aus diesem
    # Modul — ein Import auf Modulebene wäre zirkulär.
    from backend.core.berechnungen.betriebsart_gemessen import modus_strom_zeile

    zeile = modus_strom_zeile(d)

    if not (params or {}).get("getrennte_strommessung"):
        # ⚠ **Im Nicht-getrennt-Zweig wird NICHTS addiert und nichts
        # aufgeteilt:** ``stromverbrauch_kwh`` ist der Zählerstand des ganzen
        # Geräts und enthält den Kühlbetrieb bereits. Die feinen Felder sind
        # hier keine Summanden (das sagt gerade das fehlende Kennzeichen), es
        # gibt also auch keinen Rest einer Summanden-Aufteilung.
        #
        # ⭐ **R-1/K3 Regel 4 (15.09.2026, N-486):** Steht hier **gar keine**
        # Gesamtmenge — weder das kanonische Feld noch einer der beiden
        # Legacy-Namen —, dann sind die gemessenen Betriebsart-Zähler die
        # einzige Messung, die es gibt, und sie tragen. Das ist der Satz von
        # Regel 3, eine Familie weiter. ⚠ Der Zweig steht **vor** der
        # Menge-Zeile darunter, aber **hinter** der Frage nach dem Gesamtwert:
        # ein zugeordneter Gesamtzähler bleibt die Menge (K1), die
        # Betriebsart-Zähler bleiben seine Aufteilung.
        # ⛔ **Die Bedingung wird hier NICHT nachgebaut** — sonst stünde K3
        # Regel 4 an zwei Stellen, und genau das hat der Sprengsatz S1 am
        # 15.09.2026 sichtbar gemacht: Regel 4 aus ``wp_strom_stufe``
        # herausgenommen, und diese Zeile trug sie trotzdem weiter (F-56 in
        # Reinform, im selben Bau entstanden).
        if wp_strom_stufe(
            hat_gesamtzaehler=any(
                d.get(f) is not None for f in WP_GESAMT_STROM_FELDER
            ),
            # Ohne Kennzeichen sind die feinen Felder **keine** Summanden (das
            # sagt gerade das fehlende Kennzeichen) — sie können hier nichts
            # tragen, und Regel 3 hat nichts, worauf sie fallen könnte.
            hat_feine_achsen=False,
            hat_betriebsart_zaehler=zeile.gemessen,
        ) == "betriebsart":
            return WpStromAufteilung(
                menge_kwh=zeile.gemessene_summe_kwh,
                # Es gibt keine **Summanden**-Aufteilung — also auch keinen
                # Summanden-Rest (K5 setzt eine Aufteilung voraus). Der
                # Modus-Rest ist 0, weil die Menge Σ der Teilmengen IST; er
                # entsteht ohnehin woanders (`WpFakten.modus_nicht_aufgeteilt_kwh`).
                feine_summe_kwh=0.0,
                nicht_aufgeteilt_kwh=0.0,
                stufe="betriebsart",
                gesamtzaehler_zu_klein=False,
            )
        return WpStromAufteilung(
            menge_kwh=float(
                d.get("stromverbrauch_kwh")
                or d.get("strom_kwh")
                or d.get("verbrauch_kwh")
                or 0
            ),
            feine_summe_kwh=0.0,
            nicht_aufgeteilt_kwh=0.0,
            stufe="gesamt" if d.get("stromverbrauch_kwh") is not None else "fein",
            gesamtzaehler_zu_klein=False,
        )

    # W-16 und die Begründung stehen im Docstring von `wp_feine_summe_kwh` —
    # seit WK-16c an einer Stelle, weil die Tagesebene der Verteilungs-Sicht
    # dieselbe Formel auf Snapshot-Summen anwendet (F-56).
    feine_summe = wp_feine_summe_kwh(
        d.get("strom_heizen_kwh"), d.get("strom_warmwasser_kwh"),
        zeile.funktionsfremd_kwh, betriebsart_gemessen=zeile.gemessen,
    )

    gesamt = d.get("stromverbrauch_kwh")
    # R-1/K3 Regel 4: „hat feine Achsen?" fragt die **Zeile**, wie überall im
    # Monatspfad — `is not None`, nicht truthy: ein Warmwasser-Strom von 0,0 im
    # Sommer ist eine Messung und hält die Summanden-Familie offen.
    hat_f5_wert = any(d.get(f) is not None for f in FEINE_STROM_FELDER)
    stufe = wp_strom_stufe(
        hat_gesamtzaehler=gesamt is not None,
        gesamt_kwh=float(gesamt) if gesamt is not None else None,
        feine_summe_kwh=feine_summe,
        hat_feine_achsen=hat_f5_wert,
        hat_betriebsart_zaehler=zeile.gemessen,
    )
    if stufe == "betriebsart":
        # Kennzeichen gesetzt, aber keine der beiden Achsen gepflegt — das
        # Kennzeichen sagt, dass die Achsen *Summanden wären*, nicht dass sie
        # da sind (K3 gilt in beide Richtungen). Dann tragen die gemessenen
        # Betriebsart-Zähler, und zwar **alle vier**: bis zum 15.09.2026 stand
        # hier nur ihr funktionsfremder Teil (über `wp_feine_summe_kwh`), der
        # Heizstrom fiel heraus.
        return WpStromAufteilung(
            menge_kwh=zeile.gemessene_summe_kwh,
            feine_summe_kwh=0.0,
            nicht_aufgeteilt_kwh=0.0,
            stufe="betriebsart",
            gesamtzaehler_zu_klein=False,
        )
    zu_klein = gesamt is not None and stufe == "fein"
    menge = float(gesamt) if stufe == "gesamt" else feine_summe
    # K5 setzt eine Aufteilung voraus — s. Feld-Docstring. `is not None`, nicht
    # truthy: ein Warmwasser-Strom von 0,0 im Sommer ist eine Messung.
    hat_aufteilung = (
        any(d.get(f) is not None for f in FEINE_STROM_FELDER)
        or (zeile.gemessen and zeile.funktionsfremd_kwh > 0)
    )
    return WpStromAufteilung(
        menge_kwh=menge,
        feine_summe_kwh=feine_summe,
        nicht_aufgeteilt_kwh=wp_nicht_aufgeteilt_kwh(
            menge, feine_summe, hat_aufteilung=hat_aufteilung,
        ),
        stufe=stufe,
        gesamtzaehler_zu_klein=zu_klein,
    )


def nenner_ist_feine_summe(data: dict | None, params: dict | None) -> bool:
    """Ist der WP-Strom **dieser Monatszeile** die Summe der feinen Achsen?

    Die Frage, die {@link
    backend.core.berechnungen.betriebsart_gemessen.funktionsfremd_abzug_kwh}
    als ``hat_split`` stellt — *„steht der funktionsfremde Anteil überhaupt im
    Nenner?"*. Sie hängt an der **Stufe**, die {@link get_wp_strom_kwh} für
    diese Zeile gewählt hat, nicht am Kennzeichen ``getrennte_strommessung``.

    ⛔ **Der Unterschied ist gemessen und kostet 20 %** (N-462, 13.09.2026):
    Fällt die Zeile auf den Gesamtzähler zurück, steckt der Kühlstrom darin —
    wie im Nicht-getrennt-Zweig — und muss abgezogen werden. Am Kennzeichen
    festgemacht, zeigte dasselbe Gerät mit denselben Zählern **3,0 statt 3,75**,
    allein weil ein Schalter gesetzt war, der in dieser Lage nichts misst. Das
    ist die S1-Verletzung, gegen die E7 gebaut wurde, mit umgekehrtem Vorzeichen
    (Klasse N-450: *„denselben Layer zu rufen genügt nicht, es müssen dieselben
    EINGÄNGE sein"*).

    ⭐ **Seit WK-16d (14.09.2026) heißt „fein" seltener und genauer.** Ein
    zugeordneter Gesamtzähler ist jetzt die Menge (K1), auch neben einer
    vollständigen Aufteilung — der Nenner ist dann **nicht** mehr die feine
    Summe, und der funktionsfremde Anteil steckt in ihm und muss abgezogen
    werden. Die Antwort folgt weiterhin der Stufe und nur der Stufe; dass sie
    sich mit der Stufe mitverändert, ist genau der Punkt von N-450.
    """
    d = data or {}
    if not (params or {}).get("getrennte_strommessung"):
        # ⚠ **Der Monat hat für Geräte ohne Kennzeichen keine „fein"-Lage.**
        # {@link get_wp_strom_kwh} liest dort ausschließlich
        # ``stromverbrauch_kwh``/``strom_kwh``/``verbrauch_kwh`` — die feinen
        # Felder einer Monatszeile sind ohne Kennzeichen keine Summanden. Der
        # Nenner ist also nie die feine Summe. (Der **Tag** kennt den Rückfall
        # auf einen feinen Zähler auch ohne Kennzeichen, weil dort ein
        # *zugeordneter* feiner Zähler die einzige Messung sein kann — die zwei
        # Ebenen sind hier verschieden, und jede Antwort ist für ihre Ebene
        # exakt.)
        return False
    return wp_strom_aufteilung(d, params).stufe == "fein"


def get_wp_strom_kwh(data: dict, params: dict | None = None) -> float:
    """Wärmepumpen-Stromverbrauch in kWh — single source of truth.

    Bei `getrennte_strommessung=True` entscheidet die Vorrangkette aus
    {@link wp_strom_stufe}: ein belegter **Gesamtzähler ist die Menge** (K1),
    die feinen Achsen sind die Aufteilung darunter; misst er weniger als sie,
    tragen sie; ohne ihn tragen sie ohnehin. Ohne das Kennzeichen wird der
    Gesamt-Sensor genutzt
    (`stromverbrauch_kwh`/`strom_kwh`/`verbrauch_kwh`-Legacy-Fallbacks).
    Wer neben der Menge den **Rest** braucht, ruft
    {@link wp_strom_aufteilung} — diese Funktion ist deren ``menge_kwh``.

    ⛔ **Hier stand bis zum 13.09.2026: „das alte `stromverbrauch_kwh`-Feld wird
    ignoriert, auch wenn ein parallel laufender Sensor noch hineinschreibt."**
    Das war der Vorrang der **Absicht** vor der **Messung** und damit K3 verletzt
    (SOLL §3.2, W-1/W-1b): Wer den Schalter umlegte, verlor rückwirkend jede
    Monatszahl, für die er einen Gesamtzähler gepflegt hatte — in Cockpit
    Monat/Jahr, Komponenten-Hub, Kosten, CO₂, PDF, Community und den
    HA-Sensoren. Der Tagespfad hat diesen Vorrang am 26.08.2026 abgelegt
    (`komponenten_beitraege`), der Monatspfad erst jetzt; dazwischen lagen
    18 Tage, in denen Tag und Monat für dasselbe Gerät verschiedene Zahlen
    nannten (gemessen: Arbeitszahl 5,0 statt 3,0).

    ⛔ **Und bis zum 14.09.2026 stand daneben: „solange die feine Achse
    unvollständig ist."** Dieser Halbsatz war der Rest derselben Klasse. Bei
    *vollständiger* Achse wurde der Gesamtzähler verworfen — und mit ihm alles,
    was er **mehr** misst als die zwei Summanden (Standby, Steuerung,
    Umwälzpumpen: dietmar1968s „Systemverbrauch", 145 von 2193 kWh). Seit WK-16d
    gilt K1 ohne diesen Vorbehalt; der Rest heißt *nicht aufgeteilt*.
    **#183 bleibt ausgeschlossen, nur mit anderer Begründung:** Nicht die Wahl
    der Menge trennt die drei JAZ, sondern die Wahl des **Nenners** — und
    ``arbeitszahl_je_funktion`` nimmt für eine Funktions-Arbeitszahl
    ausschließlich den gemessenen Strom **dieser** Funktion (E7), nie diese
    Menge. Der Gesamtzähler kann deshalb neben zwei Funktionszahlen stehen,
    ohne dass eine dritte aus einer anderen Quelle entsteht.
    **`is not None`, nicht truthy:** ein Warmwasser-Strom von 0,0 im Sommer ist
    eine Messung, keine Leerstelle.
    ⚠ **Die Grenze:** Der Monat entscheidet an der **Zeile**, der Tag an der
    **Zuordnung**. Steht ein feiner Zähler zugeordnet, hat aber in einem Monat
    keinen Wert in der Zeile, fällt der Monat auf den Gesamtzähler und der Tag
    nicht — der Daten-Checker nennt genau diesen Monat (N-443).

    Hintergrund #183: Mit beiden Pfaden parallel driften die drei JAZ-Werte
    (Gesamt vs. Heizen vs. Warmwasser) gegeneinander, weil der Gesamt-JAZ
    aus der alten Quelle gerechnet wird, die getrennten JAZ aber aus den
    neuen Sensoren — Folge: Gesamt-JAZ kann mathematisch außerhalb der
    gewichteten Mitte der beiden Einzel-JAZ liegen.

    ⭐ **W-16 (2026-08-26): Der getrennte Zweig kannte nur zwei Funktionen.**
    ``strom_heizen_kwh + strom_warmwasser_kwh`` war der ganze Verbrauch,
    solange eine Wärmepumpe nur heizen und Warmwasser machen konnte. Seit
    **R1/W-2** ist ein **Kühlzähler an jeder Bauart** zuordenbar — und sein
    Strom stand in **keinem** der beiden Felder. Folge an einer nachgestellten
    Anlage gemessen (MartyBrs Bauform, T89667 #200): **950 statt 1050 kWh**,
    also 100 kWh, die in Kosten, CO₂ und Verbrauchsseite fehlten.

    ⭐ **Und die zweite Folge, W-16b:** Weil der Nenner den Kühlstrom nie
    enthielt, zog ``arbeitszahl(...)`` ihn über ``strom_funktionsfremd_kwh``
    ein **zweites** Mal ab — 3600 ÷ 850 statt 3600 ÷ 950, die Anlage sah 12 %
    besser aus, als sie ist. Mit der Ergänzung hier wird jener Abzug wieder
    richtig, **ohne dass ein Aufrufer sich ändert**.

    ⚠ **Nur der GEMESSENE Split wird addiert, und das ist der Kern.** Ein
    **abgeleiteter** Split (aus dem Stunden-Signal) verteilt den *vorhandenen*
    Gesamtstrom auf Betriebsarten — sein Kühlanteil ist bereits Teil der
    **Summe** ``strom_heizen_kwh + strom_warmwasser_kwh``. Ihn zu addieren wäre
    genau die Doppelzählung, die W-16b beseitigt, nur andersherum.
    ``ModusStromZeile.gemessen`` trennt die beiden Fälle; ``funktionsfremd_kwh``
    ist die **eine Stelle**, die sagt, welche Betriebsarten keine bewertete
    Nutzenergie haben (Kühlen · Lüften · Entfeuchten, **E4**) — sie hier
    aufzuzählen wäre die Bauform, an der W-14 entstanden ist.

    ⛔ **Hier stand bis zum 12.09.2026 „Teil von ``strom_heizen_kwh``", und die
    Begründung war eine Aussage über die Physik.** Beides war zu eng bzw.
    falsch begründet. Der tragende Grund ist **arithmetisch**: Der abgeleitete
    Split wird auf **die Menge dieses Geräts** normiert — tagesweise auf
    ``TagesZusammenfassung.komponenten_kwh[waermepumpe_<id>]``
    (``modus_split.py``), monatsweise auf genau diese Funktion
    (``energie_profil/modus_split_schreiben.py``). Sein Kühlanteil ist damit per
    Konstruktion ein **Ausschnitt aus der Menge**, unabhängig davon, was der
    Zähler physisch misst. *(Bis zum 14.09.2026 stand hier statt „die Menge"
    der engere Satz „genau ``strom_heizen_kwh + strom_warmwasser_kwh``, weil die
    Beitragsschicht beide Felder in EINEN Ziel-Key addiert". Seit WK-16d trägt
    derselbe Ziel-Key den Gesamtzähler, sobald einer zugeordnet ist — die
    Begründung gilt unverändert, nur ist sie jetzt an der Menge festgemacht
    statt an einer ihrer möglichen Herkünfte.)*

    ⛔ **In welchem der zwei Felder er sitzt, ist nicht gespeichert.** Der Monat
    hält nur ``modus_strom_<modus>_kwh`` je Betriebsart, ohne Zuordnung zu einer
    der beiden Summanden-Achsen. Deshalb gibt es **keine** Korrektur je Funktion
    (SOLL-§9-**E7**: der Nenner einer Funktions-Arbeitszahl ist der *gemessene*
    Strom dieser Funktion) — und deshalb kürzt ein abgeleiteter Anteil auch die
    **Gesamt**-Arbeitszahl nicht (*Ergänzung zu E7*, Option A; die Regel steht
    in ``berechnungen/betriebsart_gemessen.funktionsfremd_abzug_kwh``).

    ⚠ **Im Nicht-getrennt-Zweig wird NICHTS addiert:** ``stromverbrauch_kwh``
    ist der Zählerstand des ganzen Geräts und enthält den Kühlbetrieb bereits.
    """
    return wp_strom_aufteilung(data, params).menge_kwh
