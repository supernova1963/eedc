# Strompreise-Verwaltung

## Übersicht

Die Strompreise-Verwaltung ermöglicht die Erfassung historischer Strompreise mit Gültigkeitszeiträumen für präzise Auswertungen und ROI-Berechnungen.

**Status**: ✅ Vollständig implementiert
**Issues**: #6, #7
**Navigation**: `/stammdaten/strompreise`

---

## Features

### 1. Strompreis-Erfassung

**Komponente**: [components/StrompreisForm.tsx](../../components/StrompreisForm.tsx)
**Route**: `/stammdaten/strompreise/neu`

#### Erfassbare Daten:

**Gültigkeitszeitraum**:
- Gültig ab (Pflichtfeld)
- Gültig bis (optional - leer = unbegrenzt gültig)

**Zuordnung**:
- Anlage (optional) - anlagenspezifischer Preis
- Leer lassen = Standard-Strompreis für alle Anlagen

**Netzbezug**:
- Arbeitspreis (ct/kWh) - Pflichtfeld
- Grundpreis (€/Monat) - Optional

**Einspeisung**:
- Einspeisevergütung (ct/kWh) - Pflichtfeld

**Metadaten**:
- Stromanbieter (optional)
- Vertragsart (Grundversorgung, Sondervertrag, Dynamisch, Sonstiges)
- Notizen (Freitext)

#### Beispiel-Berechnung

Das Formular zeigt automatisch eine Live-Vorschau:
- Netzbezug 100 kWh: X.XX €
- Einspeisung 100 kWh: X.XX €
- **Eigenverbrauch lohnt sich**: X.XX ct/kWh mehr

---

### 2. Strompreis-Übersicht

**Komponente**: [components/StrompreisListe.tsx](../../components/StrompreisListe.tsx)
**Route**: `/stammdaten/strompreise`

#### Anzeige:

- **Liste aller Strompreise** (sortiert nach Gültig-Ab, neueste zuerst)
- **Aktuell-Badge**: Grüner Hintergrund für derzeit gültige Preise
- **Anlagen-Zuordnung**: Zeigt ob anlagenspezifisch oder Standard
- **Preis-Details**:
  - Netzbezug (Arbeits- und Grundpreis)
  - Einspeisevergütung
  - Gültigkeitszeitraum
  - Anbieter und Vertragsart
  - Eigenverbrauch-Vorteil (automatisch berechnet)

#### Aktionen:
- ✏️ **Bearbeiten** - Route: `/stammdaten/strompreise/[id]/bearbeiten`
- 🗑️ **Löschen** - Mit Bestätigungsdialog

---

### 3. Strompreis-Bearbeitung

**Route**: `/stammdaten/strompreise/[id]/bearbeiten`

Erlaubt die Aktualisierung aller Strompreis-Daten mit Pre-Fill der vorhandenen Werte.

---

## Datenbank-Schema

### Tabelle: `strompreise`

```sql
CREATE TABLE strompreise (
  id UUID PRIMARY KEY,
  mitglied_id UUID NOT NULL,
  anlage_id UUID,  -- NULL = gilt für alle Anlagen

  gueltig_ab DATE NOT NULL,
  gueltig_bis DATE,  -- NULL = aktuell gültig

  netzbezug_arbeitspreis_cent_kwh NUMERIC NOT NULL,
  netzbezug_grundpreis_euro_monat NUMERIC DEFAULT 0,
  einspeiseverguetung_cent_kwh NUMERIC NOT NULL,

  anbieter_name TEXT,
  vertragsart TEXT,
  notizen TEXT,

  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT strompreise_zeitraum_check
    CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab)
);
```

### Indizes:

```sql
CREATE INDEX idx_strompreise_mitglied ON strompreise(mitglied_id);
CREATE INDEX idx_strompreise_anlage ON strompreise(anlage_id);
CREATE INDEX idx_strompreise_gueltig
  ON strompreise(mitglied_id, gueltig_ab, gueltig_bis);
```

---

## Row Level Security (RLS)

### Policies:

1. **SELECT**: User sieht nur eigene Strompreise
2. **INSERT**: User kann nur für sich selbst Strompreise erstellen
3. **UPDATE**: User kann nur eigene Strompreise bearbeiten
4. **DELETE**: User kann nur eigene Strompreise löschen

Alle Policies basieren auf `mitglieder.email = auth.email()`.

---

## Helper Function

### `get_aktueller_strompreis()`

Ermittelt den aktuellen Strompreis für ein Mitglied zum Stichtag.

```sql
SELECT * FROM get_aktueller_strompreis(
  p_mitglied_id := 'uuid-hier',
  p_anlage_id := 'uuid-hier',  -- Optional
  p_stichtag := '2024-01-15'   -- Optional, Default: CURRENT_DATE
);
```

**Rückgabe**:
- `netzbezug_cent_kwh`
- `einspeiseverguetung_cent_kwh`
- `grundpreis_euro_monat`

**Logik**:
1. Suche anlagenspezifischen Preis (wenn `p_anlage_id` angegeben)
2. Fallback zu Standard-Preis (anlage_id IS NULL)
3. Neuester Preis vor/am Stichtag wird verwendet

---

## Integration in Berechnungen

### Verwendung in Komponenten:

Die Strompreise werden in folgenden Auswertungen verwendet:

1. **ROI-Dashboard** (`/auswertung?tab=roi`)
   - Netzbezugskosten
   - Einspeiseerlöse
   - Eigenverbrauch-Einsparungen

2. **Jahresübersichten** (`/auswertung`)
   - Finanzielle Auswertungen
   - Autarkiegrad-Berechnungen

3. **Investitions-ROI** (`/investitionen`)
   - Amortisationszeit
   - Renditeberechnungen

### Beispiel-Abfrage in TypeScript:

```typescript
const { data: strompreis } = await supabase
  .rpc('get_aktueller_strompreis', {
    p_mitglied_id: mitgliedId,
    p_anlage_id: anlageId,  // Optional
    p_stichtag: '2024-01-15'
  })
  .single()
```

---

## Best Practices

### 1. Gültigkeitszeiträume

- **Neuer Strompreis**: Gültig-Ab auf Vertragsbeginn setzen
- **Alter Preis**: Gültig-Bis auf Vertragsende setzen (oder leer lassen)
- **Überlappungen vermeiden**: Für gleiche Anlage keine sich überlappenden Zeiträume

### 2. Anlagen-Zuordnung

- **Standard-Preis**: `anlage_id = NULL` - gilt für alle Anlagen
- **Anlagenspezifisch**: Wenn unterschiedliche Tarife pro Anlage
- **Reihenfolge**: Anlagenspezifischer Preis hat Vorrang vor Standard

### 3. Historische Daten

- **Rückwirkend**: Erfasse auch alte Strompreise für korrekte Auswertungen
- **Änderungen**: Bei Preisänderung neuen Eintrag anlegen, alten nicht löschen
- **Dokumentation**: Notizen-Feld für Vertragsnummern, Besonderheiten

---

## Setup

### 1. Datenbank-Migration ausführen:

```bash
# In Supabase SQL Editor:
# scripts/fix-strompreise-table.sql ausführen
```

Dies erstellt:
- ✅ Tabelle mit korrektem Schema
- ✅ RLS Policies
- ✅ Helper Function
- ✅ Indizes

### 2. Ersten Strompreis erfassen:

1. Navigiere zu `/stammdaten/strompreise`
2. Klicke "Neuer Strompreis"
3. Fülle Formular aus
4. Speichern

### 3. Testen:

- ✅ Strompreis erscheint in Übersicht
- ✅ Aktuell-Badge wird angezeigt
- ✅ Bearbeiten funktioniert
- ✅ Löschen mit Bestätigung

---

## Navigation

Die Strompreis-Verwaltung ist in der Sidebar unter **Meine Anlage → Stammdaten → Strompreise** erreichbar.

**Pfad in Sidebar**:
```
Meine Anlage
  └── Stammdaten
      └── Strompreise  ⚡ (Lightning Icon)
```

---

## Dateien

### Komponenten:
- [components/StrompreisForm.tsx](../../components/StrompreisForm.tsx) - Erfassungs-/Bearbeitungsformular
- [components/StrompreisListe.tsx](../../components/StrompreisListe.tsx) - Übersichtsliste

### Routen:
- [app/stammdaten/strompreise/page.tsx](../../app/stammdaten/strompreise/page.tsx) - Übersicht
- [app/stammdaten/strompreise/neu/page.tsx](../../app/stammdaten/strompreise/neu/page.tsx) - Neu
- [app/stammdaten/strompreise/[id]/bearbeiten/page.tsx](../../app/stammdaten/strompreise/[id]/bearbeiten/page.tsx) - Bearbeiten

### Datenbank:
- [migrations/02_strompreise.sql](../../migrations/02_strompreise.sql) - Original Migration
- [scripts/fix-strompreise-table.sql](../../scripts/fix-strompreise-table.sql) - Fix-Script mit RLS

---

## Bekannte Einschränkungen

Keine bekannten Einschränkungen. Feature ist vollständig implementiert und getestet.

---

## Zukünftige Erweiterungen

Mögliche zukünftige Features:

1. **Automatischer Import**: CSV-Import von Strompreisen
2. **Tarif-Vergleich**: Integration von Vergleichsportalen
3. **Prognosen**: Automatische Preisanpassung basierend auf Marktdaten
4. **Benachrichtigungen**: Erinnerung bei Vertragsende
5. **Dynamische Tarife**: Unterstützung für stundenbasierte Preise

---

## Support

Bei Fragen oder Problemen:
1. Prüfe Browser-Konsole (F12)
2. Prüfe Supabase Logs
3. Verifiziere RLS Policies: `SELECT * FROM pg_policies WHERE tablename = 'strompreise'`
