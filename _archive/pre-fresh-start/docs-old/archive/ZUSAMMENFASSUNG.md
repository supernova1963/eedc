# EEDC WebApp - Zusammenfassung der Stammdaten-Ergänzungen

## ✅ Fertiggestellt

Alle notwendigen Stammdaten-Strukturen für aussagekräftige Auswertungen wurden erstellt.

---

## 📦 Was wurde erstellt?

### 1. Datenbank-Migrationen (Option A) ✅

**Ordner:** `/migrations/`

#### Migrations-Dateien:
1. **01_add_anlage_id.sql** - Verknüpfung Investitionen ↔ Anlagen
2. **02_strompreise.sql** - Strompreis-Stammdaten mit Gültigkeitszeiträumen
3. **03_investitionstyp_config.sql** - Konfiguration pro Investitionstyp (8 Typen)
4. **04_kennzahlen_tables.sql** - Cache-Tabellen für Wirtschaftlichkeitskennzahlen
5. **05_constraints_and_indexes.sql** - Unique Constraints & Performance-Indizes
6. **06_views.sql** - 4 Views für vereinfachte Abfragen
7. **07_functions.sql** - 4 Funktionen für Berechnungen

**Komplett-Datei:** `_all_migrations.sql` - Alle Migrationen in einer Datei

#### Neue Tabellen:
- `strompreise` - Historische Strompreise (Netzbezug + Einspeisung)
- `investitionstyp_config` - Berechnungsparameter (Lebensdauer, CO₂-Faktoren)
- `investition_kennzahlen` - Wirtschaftlichkeits-Cache (ROI, Amortisation)
- `anlagen_kennzahlen` - Anlagen-Gesamt-Cache (Autarkiegrad, Bilanz)

#### Neue Spalte:
- `alternative_investitionen.anlage_id` - Verknüpfung zu Anlagen

#### Neue Views:
- `strompreise_aktuell` - Nur aktuell gültige Strompreise
- `anlagen_komplett` - Anlagen mit Investitionen aggregiert
- `investitionen_uebersicht` - Komplette Investitionsübersicht mit Kennzahlen
- `monatsdaten_erweitert` - Monatsdaten mit berechneten Kennzahlen

#### Neue Funktionen:
- `get_strompreis(mitglied_id, anlage_id, datum, typ)` - Strompreis ermitteln
- `berechne_monatliche_einsparung(anlage_id, jahr, monat)` - Detaillierte Einsparung
- `co2_zu_baeume(co2_kg)` - CO₂ in Bäume-Äquivalent umrechnen
- `aktualisiere_investition_kennzahlen(investition_id)` - Kennzahlen neu berechnen

---

### 2. Formulare für Stammdaten (Option B) ✅

**Ordner:** `/components/`

#### Komponenten:

1. **StrompreisForm.tsx**
   - Erfassung von Strompreisen mit Gültigkeitszeiträumen
   - Netzbezug (Arbeitspreis + Grundpreis)
   - Einspeisevergütung
   - Anlagenspezifisch oder global
   - Live-Berechnung: "Eigenverbrauch lohnt sich um X ct/kWh mehr"

2. **StrompreisListe.tsx**
   - Übersicht aller erfassten Strompreise
   - Kennzeichnung aktuell gültiger Preise
   - Bearbeiten & Löschen
   - Gruppierung nach Anlage
   - Filterung nach Status

3. **InvestitionAnlageZuordnung.tsx**
   - Drag-&-Drop-artige Zuordnung von Investitionen zu Anlagen
   - Statistik: Zugeordnet vs. Nicht zugeordnet
   - Gruppierung nach Anlage
   - Icons pro Investitionstyp (☀️ 🔋 🚗 ♨️)
   - Schnelles Zuordnen per Dropdown

#### Seiten:

4. **app/stammdaten/page.tsx**
   - Zentrale Übersichtsseite für alle Stammdaten
   - Dashboard-Karten mit Statistiken
   - Schnellzugriff auf alle Funktionen
   - Hilfe-Texte und Erklärungen

**Weitere benötigte Seiten (noch zu erstellen):**
- `/app/stammdaten/strompreise/page.tsx` - Nutzt StrompreisListe
- `/app/stammdaten/strompreise/neu/page.tsx` - Nutzt StrompreisForm
- `/app/stammdaten/strompreise/[id]/bearbeiten/page.tsx` - Nutzt StrompreisForm
- `/app/stammdaten/zuordnung/page.tsx` - Nutzt InvestitionAnlageZuordnung

---

### 3. Datenstruktur-Dokumentation (Option C) ✅

**Ordner:** `/docs/`

#### Dokumentations-Dateien:

1. **DATENSTRUKTUR.md**
   - Vollständiges Datenbank-Schema-Diagramm (ASCII-Art)
   - Detaillierte Beschreibung aller 11 Tabellen
   - Beziehungen und Foreign Keys
   - JSONB-Struktur-Beispiele (parameter, verbrauch_daten, etc.)
   - Berechnungsformeln (Eigenverbrauchsquote, Autarkiegrad, ROI)
   - Views und Funktionen erklärt
   - Datenfluss-Diagramme
   - Best Practices

2. **MIGRATION_ANLEITUNG.md**
   - Schritt-für-Schritt Anleitung für Supabase
   - Option 1: Alle Migrationen auf einmal
   - Option 2: Einzelne Migrationen
   - Verifizierungs-Queries
   - Erste Testdaten anlegen
   - Troubleshooting-Guide
   - Rollback-Anleitung
   - Checkliste

3. **schema_ergaenzungen.sql**
   - Komplette SQL-Datei mit allen Ergänzungen
   - Inkl. Kommentare und Erklärungen
   - Für Referenz und Verständnis

---

## 📊 Datenmodell-Übersicht

```
mitglieder (Community)
    ├── anlagen (PV-Anlagen)
    │   ├── monatsdaten (Haushalts-Energiedaten)
    │   ├── anlagen_kennzahlen (Cache: Gesamtbilanz)
    │   └── anlagen_freigaben (Öffentliche Sichtbarkeit)
    │
    ├── alternative_investitionen (Einzelne Investitionen)
    │   ├── anlage_id → anlagen ⭐ NEU!
    │   ├── investition_monatsdaten (Investitions-spezifische Daten)
    │   └── investition_kennzahlen (Cache: Wirtschaftlichkeit)
    │
    └── strompreise ⭐ NEU!
        └── Historische Preise mit Gültigkeitszeiträumen

investitionstyp_config ⭐ NEU!
    └── Berechnungsparameter (Lebensdauer, CO₂-Faktoren)
```

---

## 🎯 Bereit für Auswertungen?

### ✅ Ja! Folgende Daten sind jetzt vollständig:

1. **Energiedaten**
   - ✅ Monatsdaten (Haushalt)
   - ✅ Investitions-Monatsdaten
   - ✅ PV-Erzeugung (aus Wechselrichter)
   - ✅ Verbrauch, Einspeisung, Netzbezug

2. **Finanz-Daten**
   - ✅ Strompreise (historisch mit Gültigkeitszeiträumen)
   - ✅ Anschaffungskosten
   - ✅ Laufende Kosten
   - ✅ Einspeisevergütung

3. **Kennzahlen**
   - ✅ Eigenverbrauchsquote
   - ✅ Autarkiegrad
   - ✅ ROI, Amortisation (vorbereitet in Cache)
   - ✅ CO₂-Einsparung

4. **Verknüpfungen**
   - ✅ Mitglied ↔ Anlagen
   - ✅ Anlage ↔ Investitionen ⭐ NEU!
   - ✅ Anlage ↔ Monatsdaten
   - ✅ Investition ↔ Monatsdaten

---

## 📋 Nächste Schritte

### 1. Migration durchführen

```bash
# In Supabase SQL Editor:
# Kopiere Inhalt von migrations/_all_migrations.sql
# Führe aus und verifiziere
```

Detaillierte Anleitung: `/docs/MIGRATION_ANLEITUNG.md`

### 2. Fehlende Seiten erstellen

Erstelle noch folgende Seiten:
- `/app/stammdaten/strompreise/page.tsx`
- `/app/stammdaten/strompreise/neu/page.tsx`
- `/app/stammdaten/zuordnung/page.tsx`

### 3. Erste Daten erfassen

1. Strompreis anlegen (über neues Formular)
2. Investitionen Anlagen zuordnen (über Zuordnungs-UI)
3. Monatsdaten erfassen (wie bisher)

### 4. Auswertungen erstellen

Jetzt kannst du mit den Auswertungs-Modulen beginnen:

#### Priorität 1 - Einfache Auswertungen:
- Dashboard mit Gesamt-Kennzahlen
- Monats-Charts (Erzeugung, Verbrauch, Autarkiegrad)
- Jahres-Übersichten
- SOLL/IST-Vergleiche

#### Priorität 2 - Wirtschaftlichkeit:
- ROI-Berechnung pro Investition
- Amortisations-Prognose
- Gesamtbilanz pro Anlage
- Einsparungs-Trend

#### Priorität 3 - Community:
- Vergleiche mit anderen Anlagen (nach Freigaben)
- Regionale Auswertungen (nach PLZ)
- Benchmarking (Eigenverbrauchsquote, Autarkiegrad)

---

## 📁 Datei-Struktur

```
eedc-webapp/
├── migrations/
│   ├── README.md
│   ├── 01_add_anlage_id.sql
│   ├── 02_strompreise.sql
│   ├── 03_investitionstyp_config.sql
│   ├── 04_kennzahlen_tables.sql
│   ├── 05_constraints_and_indexes.sql
│   ├── 06_views.sql
│   ├── 07_functions.sql
│   └── _all_migrations.sql ← DIESE DATEI IN SUPABASE AUSFÜHREN
│
├── docs/
│   ├── DATENSTRUKTUR.md ← Vollständige Schema-Dokumentation
│   └── MIGRATION_ANLEITUNG.md ← Schritt-für-Schritt Anleitung
│
├── components/
│   ├── StrompreisForm.tsx ← Strompreis erfassen
│   ├── StrompreisListe.tsx ← Strompreise verwalten
│   └── InvestitionAnlageZuordnung.tsx ← Investitionen zuordnen
│
├── app/
│   └── stammdaten/
│       └── page.tsx ← Stammdaten-Übersicht
│
├── schema_ergaenzungen.sql ← Original-Datei (Referenz)
└── ZUSAMMENFASSUNG.md ← DIESE DATEI
```

---

## 🚀 Quick Start

### Für die Migration:
1. Öffne Supabase Dashboard
2. SQL Editor → New Query
3. Kopiere `/migrations/_all_migrations.sql`
4. Run
5. Verifiziere mit Queries aus `/docs/MIGRATION_ANLEITUNG.md`

### Für die Formulare:
1. Erstelle fehlende Seiten (siehe oben)
2. Teste Strompreis-Erfassung
3. Teste Investitions-Zuordnung

### Für Auswertungen:
1. Lies `/docs/DATENSTRUKTUR.md`
2. Nutze vorhandene Views und Funktionen
3. Beginne mit einfachen Dashboard-Komponenten

---

## 💡 Wichtige Hinweise

### Strompreise
- **Immer mit Gültigkeitszeiträumen** erfassen
- Bei Preisänderung: Neuen Eintrag anlegen, alten beenden
- Ermöglicht historische Auswertungen

### Investitions-Zuordnung
- PV-Module, Wechselrichter, Speicher → **immer** Anlage zuordnen
- E-Auto, Wärmepumpe → optional, wenn PV-Strom genutzt wird
- Ermöglicht anlagenbezogene Auswertungen

### Kennzahlen-Cache
- `investition_kennzahlen` wird bei Monatsdaten-Änderung aktualisiert
- `anlagen_kennzahlen` manuell oder per Trigger aktualisieren
- Für Performance: Cache nutzen statt Echtzeit-Berechnung

### Funktionen nutzen
```sql
-- Strompreis für Datum ermitteln
SELECT get_strompreis(mitglied_id, anlage_id, '2024-06-15', 'netzbezug');

-- Monatliche Einsparung berechnen
SELECT * FROM berechne_monatliche_einsparung(anlage_id, 2024, 6);

-- CO₂ in Bäume umrechnen
SELECT co2_zu_baeume(3800); -- Returns: 380 Bäume

-- Kennzahlen aktualisieren
SELECT aktualisiere_investition_kennzahlen(investition_id);
```

---

## ✨ Zusammenfassung

**Was wurde erreicht:**
- ✅ Vollständiges Datenmodell für Wirtschaftlichkeitsanalysen
- ✅ Historische Strompreise mit Zeiträumen
- ✅ Anlage-Investition-Verknüpfung
- ✅ Kennzahlen-Cache für Performance
- ✅ Wiederverwendbare Berechnungsfunktionen
- ✅ Benutzerfreundliche Formulare
- ✅ Umfassende Dokumentation

**Bereit für:**
- ✅ Einsparungs-Berechnungen
- ✅ ROI & Amortisations-Analysen
- ✅ CO₂-Bilanzen
- ✅ Anlagenbezogene Auswertungen
- ✅ Community-Vergleiche

**Nächster Schritt:**
→ Migration durchführen (siehe `/docs/MIGRATION_ANLEITUNG.md`)

---

**Status:** 🎉 **Bereit für aussagekräftige Auswertungen!**

Erstellt am: 2026-01-24
