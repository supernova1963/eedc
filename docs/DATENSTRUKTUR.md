# EEDC WebApp - Datenstruktur-Dokumentation

## Übersicht

Diese Dokumentation beschreibt die komplette Datenstruktur der EEDC WebApp (Erneuerbare Energie Daten Community).

## Datenbankschema-Diagramm

```
┌─────────────────┐
│   mitglieder    │
│─────────────────│
│ id (PK)         │
│ email           │
│ vorname         │
│ nachname        │
│ strasse         │
│ plz             │
│ ort             │
│ ...             │
└─────────────────┘
        │
        ├─────────────────────────────────────────────┐
        │                                             │
        ▼                                             ▼
┌─────────────────┐                          ┌──────────────────────┐
│    anlagen      │                          │ alternative_         │
│─────────────────│                          │ investitionen        │
│ id (PK)         │◄─────────────────────────│──────────────────────│
│ mitglied_id (FK)│                          │ id (PK)              │
│ anlagenname     │                          │ mitglied_id (FK)     │
│ leistung_kwp    │                          │ anlage_id (FK) ◄─────┼─ NEU!
│ installationsdat│                          │ typ                  │
│ standort_plz    │                          │ bezeichnung          │
│ standort_ort    │                          │ anschaffungsdatum    │
│ ...             │                          │ anschaffungskosten_  │
└─────────────────┘                          │   gesamt             │
        │                                    │ parameter (JSONB)    │
        │                                    │ ...                  │
        │                                    └──────────────────────┘
        │                                             │
        │                                             │
        ├──────────────────┐                          │
        │                  │                          │
        ▼                  ▼                          ▼
┌─────────────────┐ ┌──────────────────┐   ┌────────────────────────┐
│  monatsdaten    │ │anlagen_freigaben │   │ investition_           │
│─────────────────│ │──────────────────│   │ monatsdaten            │
│ id (PK)         │ │ id (PK)          │   │────────────────────────│
│ anlage_id (FK)  │ │ anlage_id (FK)   │   │ id (PK)                │
│ mitglied_id (FK)│ │ profil_          │   │ investition_id (FK)    │
│ jahr            │ │   oeffentlich    │   │ jahr                   │
│ monat           │ │ kennzahlen_      │   │ monat                  │
│ pv_erzeugung_kwh│ │   oeffentlich    │   │ verbrauch_daten (JSONB)│
│ gesamtverbrauch │ │ ...              │   │ kosten_daten (JSONB)   │
│ direktverbrauch │ └──────────────────┘   │ einsparung_monat_euro  │
│ batterieentladun│                        │ co2_einsparung_kg      │
│ einspeisung_kwh │                        │ ...                    │
│ netzbezug_kwh   │                        └────────────────────────┘
│ einspeisung_    │                                     │
│   ertrag_euro   │                                     │
│ netzbezug_      │                                     │
│   kosten_euro   │                                     │
│ ...             │                                     │
└─────────────────┘                                     │
        │                                               │
        │                                               │
        ▼                                               ▼
┌─────────────────┐                          ┌────────────────────────┐
│anlagen_         │                          │ investition_           │
│kennzahlen       │                          │ kennzahlen             │
│─────────────────│                          │────────────────────────│
│ id (PK)         │                          │ id (PK)                │
│ anlage_id (FK)  │                          │ investition_id (FK)    │
│ berechnet_am    │                          │ berechnet_am           │
│ bis_jahr        │                          │ bis_jahr               │
│ bis_monat       │                          │ bis_monat              │
│ pv_erzeugung_   │                          │ einsparung_kumuliert_  │
│   gesamt_kwh    │                          │   euro                 │
│ eigenverbrauch_ │                          │ kosten_kumuliert_euro  │
│   gesamt_kwh    │                          │ bilanz_kumuliert_euro  │
│ autarkiegrad_   │                          │ amortisationszeit_     │
│   durchschnitt  │                          │   monate               │
│ investitions-   │                          │ roi_prozent            │
│   kosten_gesamt │                          │ co2_einsparung_        │
│ bilanz_gesamt_  │                          │   kumuliert_kg         │
│   euro          │                          │ baeume_aequivalent     │
│ ...             │                          │ ...                    │
└─────────────────┘                          └────────────────────────┘


┌─────────────────┐                          ┌────────────────────────┐
│  strompreise    │◄─ NEU!                   │ investitionstyp_       │◄─ NEU!
│─────────────────│                          │ config                 │
│ id (PK)         │                          │────────────────────────│
│ mitglied_id (FK)│                          │ id (PK)                │
│ anlage_id (FK)  │                          │ typ (UNIQUE)           │
│ gueltig_ab      │                          │ standardlebensdauer_   │
│ gueltig_bis     │                          │   jahre                │
│ netzbezug_      │                          │ abschreibungsdauer_    │
│   arbeitspreis_ │                          │   jahre                │
│   cent_kwh      │                          │ wartungskosten_        │
│ netzbezug_      │                          │   prozent_pa           │
│   grundpreis_   │                          │ co2_faktor_kg_kwh      │
│   euro_monat    │                          │ bezeichnung            │
│ einspeisung_    │                          │ beschreibung           │
│   verguetung_   │                          │ ...                    │
│   cent_kwh      │                          └────────────────────────┘
│ anbieter_name   │
│ vertragsart     │
│ ...             │
└─────────────────┘
```

## Kern-Entitäten

### 1. mitglieder
**Beschreibung:** Community-Mitglieder der EEDC

**Wichtige Felder:**
- `id` (PK) - Eindeutige ID
- `email` (UNIQUE) - E-Mail-Adresse
- `vorname`, `nachname` - Personendaten
- `plz`, `ort` - Standort für Wetterdaten-Zuordnung
- `latitude`, `longitude` - Geokoordinaten

**Beziehungen:**
- → `anlagen` (1:n)
- → `alternative_investitionen` (1:n)
- → `strompreise` (1:n)

---

### 2. anlagen
**Beschreibung:** PV-Anlagen eines Mitglieds

**Wichtige Felder:**
- `id` (PK)
- `mitglied_id` (FK) → mitglieder
- `anlagenname` - Bezeichnung
- `leistung_kwp` - Nennleistung in kWp
- `installationsdatum` - Inbetriebnahme
- `standort_plz`, `standort_ort` - Anlagenstandort
- `batteriekapazitaet_kwh` - Falls Speicher vorhanden

**Beziehungen:**
- → `monatsdaten` (1:n)
- → `alternative_investitionen` (1:n) - **NEU!**
- → `anlagen_freigaben` (1:1)
- → `anlagen_kennzahlen` (1:1)
- → `strompreise` (1:n) - **NEU!**

---

### 3. alternative_investitionen
**Beschreibung:** Einzelne Investitionen (PV, Speicher, E-Auto, Wärmepumpe, etc.)

**Wichtige Felder:**
- `id` (PK)
- `mitglied_id` (FK) → mitglieder
- `anlage_id` (FK) → anlagen - **NEU!** Verknüpfung zur Anlage
- `typ` - Investitionstyp (siehe unten)
- `bezeichnung` - Name/Bezeichnung
- `anschaffungsdatum` - Kaufdatum
- `anschaffungskosten_gesamt` - Gesamtkosten
- `anschaffungskosten_alternativ` - Kosten der Alternative
- `anschaffungskosten_relevant` - Differenz (berechnet)
- `parameter` (JSONB) - Typspezifische Parameter
- `kosten_jahr_aktuell` (JSONB) - Laufende Kosten aktuell
- `kosten_jahr_alternativ` (JSONB) - Laufende Kosten Alternative
- `parent_investition_id` (FK) - Hierarchie (z.B. PV-Module → Wechselrichter)

**Investitionstypen:**
1. `pv-module` - PV-Module
2. `wechselrichter` - Wechselrichter
3. `speicher` - Batteriespeicher
4. `waermepumpe` - Wärmepumpe
5. `e-auto` - Elektroauto
6. `balkonkraftwerk` - Balkonkraftwerk
7. `wallbox` - Ladestation
8. `sonstiges` - Sonstige Investitionen

**Parameter-Beispiele (JSONB):**
```json
// E-Auto
{
  "km_jahr": 15000,
  "verbrauch_kwh_100km": 18,
  "pv_anteil_prozent": 70,
  "vergleich_verbrenner_l_100km": 6.5,
  "benzinpreis_euro_liter": 1.69
}

// Wärmepumpe
{
  "heizlast_kw": 8,
  "jaz": 3.5,
  "waermebedarf_kwh_jahr": 12000,
  "alter_energietraeger": "Gas",
  "alter_preis_cent_kwh": 8,
  "pv_anteil_prozent": 40
}

// PV-Module
{
  "leistung_kwp_pv": 10.5,
  "anzahl_module": 28,
  "hersteller_pv": "SunPower",
  "modell_pv": "Maxeon 3",
  "ausrichtung": "Süd",
  "neigung_grad": 30,
  "jahresertrag_prognose_kwh_pv": 11500
}
```

**Beziehungen:**
- → `investition_monatsdaten` (1:n)
- → `investition_kennzahlen` (1:1)
- → `alternative_investitionen` (parent-child)

---

### 4. monatsdaten
**Beschreibung:** Monatliche Energiedaten einer Anlage (Haushalt)

**Wichtige Felder:**
- `id` (PK)
- `anlage_id` (FK) → anlagen
- `mitglied_id` (FK) → mitglieder
- `jahr`, `monat` - Zeitraum (UNIQUE zusammen mit anlage_id)
- `pv_erzeugung_kwh` - PV-Erzeugung (aus Wechselrichter)
- `gesamtverbrauch_kwh` - Gesamter Stromverbrauch
- `direktverbrauch_kwh` - PV direkt verbraucht
- `batterieentladung_kwh` - Aus Speicher verbraucht
- `batterieladung_kwh` - In Speicher geladen
- `einspeisung_kwh` - Ins Netz eingespeist
- `netzbezug_kwh` - Aus Netz bezogen
- `einspeisung_ertrag_euro` - Einspeisevergütung
- `netzbezug_kosten_euro` - Netzbezugskosten
- `betriebsausgaben_monat_euro` - Wartung, Versicherung, etc.

**Berechnete Kennzahlen:**
- Eigenverbrauch = Direktverbrauch + Batterieentladung
- Eigenverbrauchsquote = Eigenverbrauch / PV-Erzeugung × 100
- Autarkiegrad = Eigenverbrauch / Gesamtverbrauch × 100

**Constraint:** UNIQUE (anlage_id, jahr, monat)

---

### 5. investition_monatsdaten
**Beschreibung:** Monatsdaten pro Investition

**Wichtige Felder:**
- `id` (PK)
- `investition_id` (FK) → alternative_investitionen
- `jahr`, `monat` - Zeitraum (UNIQUE zusammen mit investition_id)
- `verbrauch_daten` (JSONB) - Typspezifische Verbrauchsdaten
- `kosten_daten` (JSONB) - Monatliche Kosten
- `einsparung_monat_euro` - Berechnete Einsparung
- `co2_einsparung_kg` - CO₂-Einsparung
- `betriebsausgaben_monat_euro` - Monatliche Betriebsausgaben

**Verbrauch_daten Beispiele:**
```json
// Wechselrichter
{
  "pv_erzeugung_ist_kwh": 1250,
  "prognose_kwh": 1180,
  "jahresprognose_kwh": 11500,
  "abweichung_prozent": 5.9,
  "pv_module_ids": ["uuid1", "uuid2"]
}

// E-Auto
{
  "km_gefahren": 1200,
  "strom_kwh": 216,
  "verbrauch_kwh_100km": 18,
  "pv_anteil_kwh": 151,
  "netz_anteil_kwh": 65
}

// Speicher
{
  "batterieladung_kwh": 180,
  "batterieentladung_kwh": 171,
  "wirkungsgrad_prozent": 95,
  "zyklen_monat": 28
}
```

**Constraint:** UNIQUE (investition_id, jahr, monat)

---

## Stammdaten-Tabellen (NEU!)

### 6. strompreise ⚡
**Beschreibung:** Strompreis-Stammdaten mit Gültigkeitszeiträumen

**Wichtige Felder:**
- `id` (PK)
- `mitglied_id` (FK) → mitglieder
- `anlage_id` (FK) → anlagen (optional)
- `gueltig_ab` - Ab wann gültig
- `gueltig_bis` - Bis wann gültig (NULL = aktuell)
- `netzbezug_arbeitspreis_cent_kwh` - Arbeitspreis Netzbezug
- `netzbezug_grundpreis_euro_monat` - Grundpreis pro Monat
- `einspeiseverguetung_cent_kwh` - Einspeisevergütung
- `anbieter_name` - Stromanbieter
- `vertragsart` - Grundversorgung, Sondervertrag, etc.

**Verwendung:**
- Historische Strompreise für korrekte Rückrechnungen
- Anlagenspezifische Preise möglich (anlage_id gesetzt)
- Oder mitgliedweite Preise (anlage_id NULL)

**View:** `strompreise_aktuell` - Zeigt nur aktuell gültige Preise

---

### 7. investitionstyp_config ⚙️
**Beschreibung:** Konfiguration der Berechnungsparameter pro Investitionstyp

**Wichtige Felder:**
- `id` (PK)
- `typ` (UNIQUE) - Investitionstyp
- `standardlebensdauer_jahre` - Erwartete Lebensdauer
- `abschreibungsdauer_jahre` - Abschreibungsdauer
- `wartungskosten_prozent_pa` - Wartungskosten in % p.a.
- `co2_faktor_kg_kwh` - CO₂-Faktor für Berechnungen
- `bezeichnung` - Anzeigename
- `beschreibung` - Erklärung

**Standard-Werte:**
| Typ | Lebensdauer | CO₂-Faktor | Beschreibung |
|-----|-------------|------------|--------------|
| pv-module | 25 Jahre | 0,38 kg/kWh | Netzstrom vermieden |
| wechselrichter | 15 Jahre | 0,38 kg/kWh | Netzstrom vermieden |
| speicher | 15 Jahre | 0,38 kg/kWh | Netzstrom vermieden |
| waermepumpe | 20 Jahre | 0,20 kg/kWh | Gas/Öl vermieden |
| e-auto | 12 Jahre | 0,15 kg/kWh | Benzin/Diesel vermieden |

---

## Kennzahlen-Tabellen (Cache)

### 8. investition_kennzahlen
**Beschreibung:** Cache für berechnete Wirtschaftlichkeitskennzahlen pro Investition

**Wichtige Felder:**
- `id` (PK)
- `investition_id` (FK) → alternative_investitionen (UNIQUE)
- `berechnet_am` - Zeitpunkt der Berechnung
- `bis_jahr`, `bis_monat` - Berechnungsstand
- `einsparung_kumuliert_euro` - Gesamteinsparung
- `kosten_kumuliert_euro` - Gesamtkosten
- `bilanz_kumuliert_euro` - Netto-Bilanz
- `amortisationszeit_monate` - Monate bis Amortisation
- `roi_prozent` - Return on Investment
- `co2_einsparung_kumuliert_kg` - Gesamt-CO₂-Einsparung
- `baeume_aequivalent` - Anzahl Bäume (1 Baum ≈ 10kg CO₂/Jahr)

**Aktualisierung:**
- Trigger bei Einfügen/Update von investition_monatsdaten
- Oder manuell via Funktion `aktualisiere_investition_kennzahlen(investition_id)`

---

### 9. anlagen_kennzahlen
**Beschreibung:** Aggregierte Kennzahlen pro Anlage

**Wichtige Felder:**
- `id` (PK)
- `anlage_id` (FK) → anlagen (UNIQUE)
- `berechnet_am` - Zeitpunkt der Berechnung
- `bis_jahr`, `bis_monat` - Berechnungsstand
- `pv_erzeugung_gesamt_kwh` - Gesamt-Erzeugung
- `eigenverbrauch_gesamt_kwh` - Gesamt-Eigenverbrauch
- `autarkiegrad_durchschnitt_prozent` - Durchschnittlicher Autarkiegrad
- `eigenverbrauchsquote_durchschnitt_prozent` - Durchschnittliche EVQ
- `investitionskosten_gesamt_euro` - Summe aller Investitionen
- `einsparungen_gesamt_euro` - Summe aller Einsparungen
- `bilanz_gesamt_euro` - Netto-Bilanz
- `co2_einsparung_gesamt_kg` - Gesamt-CO₂-Einsparung

---

## Hilfstabellen

### 10. anlagen_freigaben
**Beschreibung:** Öffentliche Freigaben für Community-Vergleiche

**Wichtige Felder:**
- `id` (PK)
- `anlage_id` (FK) → anlagen (UNIQUE)
- `profil_oeffentlich` - Profil sichtbar
- `kennzahlen_oeffentlich` - Kennzahlen sichtbar
- `auswertungen_oeffentlich` - Auswertungen sichtbar
- `investitionen_oeffentlich` - Investitionen sichtbar
- `monatsdaten_oeffentlich` - Monatsdaten sichtbar
- `standort_genau` - Genauer Standort oder nur PLZ-Bereich

---

### 11. wetterdaten
**Beschreibung:** Wetterdaten für Prognosen und Vergleiche

**Wichtige Felder:**
- `id` (PK)
- `plz` - Postleitzahl
- `datum`, `jahr`, `monat` - Zeitraum
- `sonnenstunden` - Sonnenstunden
- `globalstrahlung_kwh_m2` - Globalstrahlung
- `temperatur_durchschnitt_c` - Durchschnittstemperatur
- `datenquelle` - Quelle der Daten

---

## Views

### strompreise_aktuell
```sql
SELECT * FROM strompreise
WHERE gueltig_ab <= CURRENT_DATE
  AND (gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE)
```

### anlagen_komplett
```sql
SELECT a.*, m.vorname, m.nachname,
       COUNT(ai.id) as anzahl_investitionen,
       SUM(ai.anschaffungskosten_gesamt) as investitionen_gesamt_euro
FROM anlagen a
LEFT JOIN mitglieder m ON a.mitglied_id = m.id
LEFT JOIN alternative_investitionen ai ON ai.anlage_id = a.id
GROUP BY a.id, m.id
```

### investitionen_uebersicht
```sql
SELECT ai.*, m.vorname, m.nachname, a.anlagenname,
       k.amortisationszeit_monate, k.roi_prozent, k.bilanz_kumuliert_euro
FROM alternative_investitionen ai
LEFT JOIN mitglieder m ON ai.mitglied_id = m.id
LEFT JOIN anlagen a ON ai.anlage_id = a.id
LEFT JOIN investition_kennzahlen k ON ai.id = k.investition_id
WHERE ai.aktiv = true
```

### monatsdaten_erweitert
```sql
SELECT md.*, a.anlagenname,
       (md.direktverbrauch_kwh + md.batterieentladung_kwh) / md.pv_erzeugung_kwh * 100 as eigenverbrauchsquote_prozent,
       (md.direktverbrauch_kwh + md.batterieentladung_kwh) / md.gesamtverbrauch_kwh * 100 as autarkiegrad_prozent
FROM monatsdaten md
LEFT JOIN anlagen a ON md.anlage_id = a.id
```

---

## Funktionen

### get_strompreis(mitglied_id, anlage_id, datum, typ)
Ermittelt den gültigen Strompreis für ein bestimmtes Datum.

**Parameter:**
- `mitglied_id` - Mitglieds-ID
- `anlage_id` - Anlagen-ID (oder NULL)
- `datum` - Datum für das der Preis gesucht wird
- `typ` - 'netzbezug' oder 'einspeisung'

**Returns:** Preis in ct/kWh

**Beispiel:**
```sql
SELECT get_strompreis(
  '123e4567-e89b-12d3-a456-426614174000',
  NULL,
  '2024-06-15',
  'netzbezug'
) as netzbezug_preis;
-- Returns: 32.50
```

### berechne_monatliche_einsparung(anlage_id, jahr, monat)
Berechnet detaillierte Einsparungen für einen Monat.

**Returns:** TABLE mit Feldern:
- `eigenverbrauch_kwh`
- `eigenverbrauch_wert_euro`
- `einspeisung_wert_euro`
- `netzbezug_kosten_euro`
- `einsparung_brutto_euro`
- `einsparung_netto_euro`

### co2_zu_baeume(co2_kg)
Rechnet CO₂-Einsparung in Bäume-Äquivalent um.

**Formel:** 1 Baum bindet ca. 10 kg CO₂ pro Jahr

### aktualisiere_investition_kennzahlen(investition_id)
Aktualisiert alle Kennzahlen für eine Investition.

**Berechnet:**
- Kumulierte Einsparungen
- Amortisationszeit
- ROI
- CO₂-Bilanz

---

## Datenfluss

### 1. Monatsdaten-Erfassung

```
Wechselrichter-Monatsdaten erfassen
    ↓
PV-Erzeugung in investition_monatsdaten speichern
    ↓
Haushalts-Monatsdaten erfassen (liest PV-Erzeugung automatisch)
    ↓
Monatsdaten in monatsdaten speichern
    ↓
Kennzahlen berechnen (Eigenverbrauchsquote, Autarkiegrad)
    ↓
Optional: anlagen_kennzahlen aktualisieren
```

### 2. Einsparungsberechnung

```
Monatsdaten vorhanden
    ↓
Strompreis für Datum ermitteln (get_strompreis)
    ↓
Eigenverbrauch × Netzbezugspreis = Eingesparte Netzbezugskosten
    ↓
Einspeisung × Einspeisevergütung = Erlöse
    ↓
Einsparung = Eingesparte Kosten + Erlöse - Netzbezugskosten - Betriebsausgaben
    ↓
In investition_monatsdaten.einsparung_monat_euro speichern
    ↓
investition_kennzahlen aktualisieren
```

### 3. ROI-Berechnung

```
Alle Monatsdaten einer Investition summieren
    ↓
Einsparung kumuliert - Kosten kumuliert = Bilanz
    ↓
Bilanz / Anschaffungskosten × 100 = ROI %
    ↓
Wenn Bilanz >= Anschaffungskosten: Amortisiert
    ↓
In investition_kennzahlen speichern
```

---

## Best Practices

### 1. Strompreise
- Immer mit Gültigkeitszeiträumen erfassen
- Bei Preisänderung: Neuen Eintrag mit neuem `gueltig_ab` anlegen
- Alten Eintrag: `gueltig_bis` setzen

### 2. Investitions-Zuordnung
- PV-Module, Wechselrichter, Speicher → immer der Anlage zuordnen
- E-Auto, Wärmepumpe → optional Anlage zuordnen (wenn PV-Strom genutzt)
- Hierarchie nutzen: PV-Module als Child von Wechselrichter

### 3. Monatsdaten
- Immer zuerst Wechselrichter-Daten erfassen
- Dann Haushalts-Daten (liest PV-Erzeugung automatisch)
- Plausibilität prüfen: Eigenverbrauch + Netzbezug ≈ Gesamtverbrauch

### 4. Kennzahlen
- Regelmäßig Cache aktualisieren (z.B. monatlich)
- Bei Datenänderung: Kennzahlen neu berechnen
- Für Performance: Views nutzen statt direkte Joins

---

## Zusammenfassung

**Kernkonzept:**
1. **Mitglieder** haben **Anlagen**
2. **Anlagen** haben **Monatsdaten** (Haushalt)
3. **Mitglieder** haben **Investitionen** (optional **Anlagen** zugeordnet)
4. **Investitionen** haben **Monatsdaten** (investitionsspezifisch)
5. **Strompreise** mit Zeiträumen ermöglichen historische Berechnungen
6. **Kennzahlen-Cache** für schnelle Auswertungen

**Neu hinzugefügt:**
- `alternative_investitionen.anlage_id` - Verknüpfung
- `strompreise` - Stammdaten
- `investitionstyp_config` - Konfiguration
- `investition_kennzahlen` - Wirtschaftlichkeits-Cache
- `anlagen_kennzahlen` - Anlagen-Cache
- Views für vereinfachte Abfragen
- Funktionen für Berechnungen

**Bereit für Auswertungen:** ✅
