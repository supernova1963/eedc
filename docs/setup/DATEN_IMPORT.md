# Daten-Import Feature

## Übersicht

**Status**: ✅ Produktionsbereit
**URL**: `/daten-import`
**Zweck**: CSV/Excel-Upload für Monatsdaten-Import

---

## Features

### 1. CSV-Template (Dynamisch)
**API**: `/api/csv-template?anlageId={uuid}`

**Features**:
- ✅ **Personalisiert**: Nur Felder für spezifische Anlage
- ✅ **Intelligente Spalten**:
  - Batteriefelder nur wenn `batteriekapazitaet_kwh > 0`
  - E-Auto Feld nur wenn `ekfz_vorhanden = true`
- ✅ **Beispieldaten**: 2 Zeilen mit Muster-Werten
- ✅ **Auto-Berechnung**: Hinweis auf automatische Kosten/Erlöse

**Spalten**:
- **Pflichtfelder**: Jahr, Monat
- **Immer**: PV-Erzeugung, Verbrauch, Netzbezug, Einspeisung, Tarife
- **Conditional**: Batterie (nur mit Speicher), E-Auto (nur mit EKFZ)

**Download**: Link in Upload-Komponente generiert dynamisch basierend auf gewählter Anlage

### 2. Upload-Komponente
**Komponente**: `components/MonatsdatenUpload.tsx`

**Funktionen**:
- ✅ Drag & Drop Upload
- ✅ Datei-Auswahl via Browser
- ✅ Unterstützte Formate: `.csv`, `.xlsx`, `.xls`
- ✅ Dateigröße-Limit: 5 MB
- ✅ Preview-Modus (zeigt erste 10 Zeilen)
- ✅ Fehler- & Warnungs-Anzeige
- ✅ Validierung vor Import
- ✅ Duplikat-Erkennung
- ✅ Erfolgs-Feedback mit Auto-Reload

### 3. API-Route
**Endpoint**: `/api/upload-monatsdaten`
**Methode**: `POST`

**Parameter**:
```typescript
FormData {
  file: File               // CSV/Excel-Datei
  anlageId: string         // UUID der Anlage
  preview: 'true' | 'false' // Preview oder echter Import
}
```

**Response**:
```typescript
{
  success: boolean
  data?: ParsedMonatsdaten[]
  errors?: ValidationError[]
  warnings?: ValidationError[]
  message?: string
}
```

### 4. Upload-Seite
**Route**: `app/daten-import/page.tsx`

**Features**:
- ✅ Automatische Anlagen-Auswahl
- ✅ Anzeige bestehender Datensätze
- ✅ Schritt-für-Schritt-Anleitung
- ✅ Hinweis auf Duplikate
- ✅ Unterstützte Felder-Übersicht

---

## Technische Details

### Dependencies
```json
{
  "papaparse": "^5.x",
  "@types/papaparse": "^5.x"
}
```

### Datenmapping
Deutsche Spaltennamen werden automatisch auf DB-Felder gemappt:

```typescript
{
  'Jahr' → 'jahr',
  'Monat' → 'monat',
  'Gesamtverbrauch (kWh)' → 'gesamtverbrauch_kwh',
  'PV-Erzeugung (kWh)' → 'pv_erzeugung_kwh',
  'Direktverbrauch (kWh)' → 'direktverbrauch_kwh',
  'Batterieentladung (kWh)' → 'batterieentladung_kwh',
  'Batterieladung (kWh)' → 'batterieladung_kwh',
  'Netzbezug (kWh)' → 'netzbezug_kwh',
  'Einspeisung (kWh)' → 'einspeisung_kwh',
  'E-Auto Ladung (kWh)' → 'ekfz_ladung_kwh',
  'Netzbezug Kosten (€)' → 'netzbezug_kosten_euro',
  'Einspeisung Ertrag (€)' → 'einspeisung_ertrag_euro',
  'Grundpreis (€)' → 'grundpreis_euro',
  'Netzbezugspreis (Cent/kWh)' → 'netzbezugspreis_cent_kwh',
  'Einspeisevergütung (Cent/kWh)' → 'einspeiseverguetung_cent_kwh',
  'Betriebsausgaben (€)' → 'betriebsausgaben_monat_euro',
  'Notizen' → 'notizen'
}
```

### Validierung

**Pflichtfeld-Checks**:
- Jahr: 2000-2100
- Monat: 1-12

**Plausibilitätsprüfungen** (Warnungen):
- PV-Erzeugung > 10.000 kWh
- Gesamtverbrauch > 20.000 kWh

**Duplikat-Check**:
- Kombiniert: Jahr + Monat + Anlage-ID
- Verhindert doppelte Einträge

**Zahlenformat-Unterstützung**:
- Deutsche Notation: `1.234,56` → `1234.56`
- Englische Notation: `1,234.56` → `1234.56`

### Automatische Berechnungen

**Netzbezug Kosten**:
```
Wenn nicht manuell angegeben:
Netzbezug Kosten (€) = Netzbezug (kWh) × Netzbezugspreis (Cent/kWh) / 100 + Grundpreis (€)
```

**Einspeisung Ertrag**:
```
Wenn nicht manuell angegeben:
Einspeisung Ertrag (€) = Einspeisung (kWh) × Einspeisevergütung (Cent/kWh) / 100
```

**Vorteile**:
- Weniger Tipparbeit
- Weniger Fehlerquellen
- Konsistente Berechnungen
- Manuelle Eingabe bleibt möglich (z.B. bei Sondertarifen)

### Workflow

```
1. User wählt Datei
   ↓
2. Frontend: Dateityp & Größe prüfen
   ↓
3. User klickt "Vorschau laden"
   ↓
4. API: CSV parsen mit PapaParse
   ↓
5. API: Daten validieren
   ↓
6. Frontend: Preview-Tabelle anzeigen
   ↓
7. User prüft Daten & klickt "Importieren"
   ↓
8. API: Duplikat-Check in DB
   ↓
9. API: Batch-Insert in monatsdaten
   ↓
10. Frontend: Erfolg anzeigen + Reload
```

---

## Verwendung

### Als User

1. **Navigation**: Sidebar → "Daten importieren" (Badge: NEU)

2. **Template herunterladen**:
   - Klick auf "CSV-Vorlage herunterladen"
   - Datei in Excel/LibreOffice öffnen
   - Daten eintragen (mindestens Jahr/Monat)

3. **Upload**:
   - Drag & Drop oder "Datei auswählen"
   - "Vorschau laden" klicken
   - Daten prüfen
   - "Daten importieren" bestätigen

4. **Erfolgsmeldung**:
   - "Import erfolgreich!"
   - Seite lädt automatisch neu
   - Bestehende Datensätze-Zähler wird aktualisiert

### Als Developer

**Upload-Komponente einbinden**:
```tsx
import MonatsdatenUpload from '@/components/MonatsdatenUpload'

<MonatsdatenUpload
  anlageId={anlageId}
  onSuccess={() => {
    // Nach erfolgreichem Import
    router.refresh()
  }}
/>
```

**Eigene API-Calls**:
```typescript
const formData = new FormData()
formData.append('file', fileObject)
formData.append('anlageId', uuid)
formData.append('preview', 'true')

const response = await fetch('/api/upload-monatsdaten', {
  method: 'POST',
  body: formData
})

const result = await response.json()
```

---

## Icons

**Neue Icons in `SimpleIcon.tsx`**:
- `upload` - Upload-Symbol
- `download` - Download-Symbol
- `eye` - Vorschau-Auge
- `close` - Schließen-Kreuz
- `check` - Häkchen

---

## Dateien

### Neu erstellt
```
components/
  ├── MonatsdatenUpload.tsx                (Upload-Komponente, 430 Zeilen)
  └── MonatsdatenUploadWrapper.tsx         (Wrapper mit Anlagen-Auswahl, 120 Zeilen)

app/
  ├── daten-import/
  │   └── page.tsx                         (Upload-Seite mit Auth, 200 Zeilen)
  └── api/
      ├── upload-monatsdaten/
      │   └── route.ts                     (Upload-API mit Auth, 300 Zeilen)
      └── csv-template/
          └── route.ts                     (Dynamisches Template, 140 Zeilen)

lib/
  └── auth.ts                              (Auth Helper Functions, 70 Zeilen)

public/templates/
  └── monatsdaten_import_vorlage.csv       (Statisches Template - deprecated)
```

### Modifiziert
```
components/
  ├── SimpleIcon.tsx                       (+5 Icons)
  └── Sidebar.tsx                          (+1 Nav-Item mit Badge)

package.json                               (+papaparse)
```

---

## Fehlerbehandlung

### Client-seitig
- ❌ Falscher Dateityp → Fehlermeldung
- ❌ Datei zu groß (> 5 MB) → Fehlermeldung
- ⚠️ Warnungen → Gelbe Box
- ❌ Validierungsfehler → Rote Box mit Details

### Server-seitig
- ❌ Keine Datei → HTTP 400
- ❌ Fehlende Anlage-ID → HTTP 400
- ❌ Nicht authentifiziert → HTTP 401
- ❌ Anlage nicht gefunden → HTTP 404
- ❌ Duplikate → HTTP 409 mit Liste
- ❌ DB-Fehler → HTTP 500 mit Message

### Benutzerfreundlich
- Zeilen-Nummer bei Fehlern
- Feld-Name bei Fehlern
- Klare Fehlerbeschreibung in Deutsch
- "Neue Datei auswählen" Button bei Fehler

---

## Performance

**Optimierungen**:
- Streaming-Upload (kein kompletter Load in Memory)
- Batch-Insert (alle Datensätze auf einmal)
- Preview limitiert auf 10 Zeilen (volle Daten serverseitig)
- Duplikat-Check optimiert (parallel Promises)

**Limits**:
- Max. Dateigröße: 5 MB
- Empfohlene Zeilen: < 1.000 (Performance-Gründe)

---

## Sicherheit

**Authentifizierung**:
- ✅ Supabase Auth Check
- ✅ User-Session erforderlich

**Autorisierung**:
- ✅ Nur eigene Anlagen
- ✅ Anlage-Ownership-Check

**Input-Validierung**:
- ✅ Dateityp-Whitelist
- ✅ Dateigröße-Limit
- ✅ SQL-Injection-Schutz (Supabase Prepared Statements)
- ✅ XSS-Schutz (React Escaping)

**Duplikat-Schutz**:
- ✅ Verhindert versehentliche Mehrfach-Uploads

---

## Zukünftige Erweiterungen

**Geplant**:
- [ ] Multi-Anlagen-Auswahl (Dropdown)
- [ ] Update-Modus (bestehende Daten überschreiben)
- [ ] Export-Funktion (DB → CSV)
- [ ] Automatisches Mapping (intelligentes Erkennen von Spalten)
- [ ] Excel-Support für komplexere Formate (.xlsx direkt)
- [ ] Bulk-Import für mehrere Anlagen
- [ ] Import-Historie (wer, wann, was importiert)
- [ ] Rollback-Funktion

**Nice-to-have**:
- [ ] Live-Vorschau während Drag & Drop
- [ ] Fortschrittsbalken bei großen Importen
- [ ] Import-Templates für verschiedene Solarsysteme
- [ ] API-Import von Smart-Meter-Daten

---

## Testing

**Testfälle**:

1. ✅ Korrekter CSV-Upload
2. ✅ Fehlerhafte Datei (falsches Format)
3. ✅ Leere Datei
4. ✅ Datei mit Duplikaten
5. ✅ Datei mit ungültigen Werten
6. ✅ Sehr große Datei (> 5 MB)
7. ✅ Deutsche Zahlenformate (Komma)
8. ✅ Fehlende Pflichtfelder
9. ✅ Anlage ohne Berechtigung

**Test-CSV**:
```csv
Jahr,Monat,PV-Erzeugung (kWh)
2024,1,450.5
2024,2,520.3
```

---

## Commit-Info

**Branch**: main
**Commit**: TBD
**Message**: "Feature: CSV/Excel-Import für Monatsdaten"

**Änderungen**:
- ✅ Upload-Komponente mit Drag & Drop
- ✅ API-Route für Parsing & Validierung
- ✅ Upload-Seite mit Anleitung
- ✅ CSV-Template
- ✅ Navigation-Integration
- ✅ 5 neue Icons

---

## Support

**Bei Problemen**:
1. Browser-Konsole prüfen (F12)
2. Network-Tab für API-Fehler
3. CSV-Format mit Template abgleichen
4. Duplikate in DB prüfen (gleiche Jahr/Monat)

**Häufige Fehler**:
- "Duplikat": Jahr/Monat bereits vorhanden → Zeile löschen oder anderen Monat wählen
- "Validierungsfehler": Pflichtfelder fehlen → Jahr/Monat eintragen
- "Anlage nicht gefunden": Zuerst Anlage unter `/anlage` anlegen

---

**Viel Erfolg beim Daten-Import! 🚀**
