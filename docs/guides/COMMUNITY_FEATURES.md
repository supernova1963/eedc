# Community-Features Dokumentation

## Übersicht

Die EEDC-Plattform verfügt jetzt über vollständige Community-Features, mit denen Benutzer ihre PV-Anlagen öffentlich teilen können. Das System bietet granulare Datenschutz-Kontrollen mit 6 verschiedenen Freigabe-Stufen.

## Implementierte Features

### 1. Freigabe-System

Jede Anlage kann individuell mit unterschiedlichen Freigabe-Stufen konfiguriert werden:

| Freigabe-Option | Beschreibung | Daten |
|----------------|--------------|-------|
| **Profil öffentlich** | Basis-Anlageninfo | Name, Standort, Komponenten, Leistung |
| **Kennzahlen öffentlich** | Aggregierte Kennzahlen | Autarkiegrad, Eigenverbrauch, CO₂-Einsparung |
| **Monatsdaten öffentlich** | Detaillierte Monatsdaten | Erzeugung, Verbrauch, Einspeisung (pro Monat) |
| **Investitionen öffentlich** | Investitions-Details | Kosten, Einsparungen, ROI |
| **Auswertungen öffentlich** | Berechnete Auswertungen | ROI-Analyse, Amortisation |
| **Standort genau** | Präziser vs. anonymisierter Standort | Exakte Koordinaten vs. PLZ-Bereich (XX000) |

### 2. Architektur

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 + React 19)                   │
├─────────────────────────────────────────────────────┤
│  Pages:                                             │
│  • /community          → Übersichtsseite            │
│  • /community/[id]     → Detailansicht              │
│  • /anlage             → Freigabe-Verwaltung        │
│  • /datenschutz        → Datenschutzerklärung       │
├─────────────────────────────────────────────────────┤
│  API Routes:                                        │
│  • GET /api/community/anlagen                       │
│  • GET /api/community/anlagen/[id]                  │
│  • GET /api/community/stats                         │
├─────────────────────────────────────────────────────┤
│  Helper Functions (lib/community.ts):               │
│  • getPublicAnlagen()                               │
│  • getPublicAnlage(id)                              │
│  • getPublicKennzahlen(id)                          │
│  • getPublicMonatsdaten(id, jahr?)                  │
│  • getCommunityStats()                              │
├─────────────────────────────────────────────────────┤
│  Database (Supabase PostgreSQL)                     │
│  • anlagen_freigaben (6 boolean Felder)             │
│  • anlagen (mit profilbeschreibung)                 │
│  • monatsdaten, anlagen_kennzahlen (Views)          │
└─────────────────────────────────────────────────────┘
```

### 3. Datenschutz-Konzept

**Privacy by Default:**
- Alle Freigaben sind standardmäßig **deaktiviert**
- User müssen **aktiv zustimmen**, um Daten zu teilen
- Freigaben können **jederzeit widerrufen** werden
- Standort kann **anonymisiert** werden (PLZ-Bereich statt exakter Koordinaten)

**Datensparsamkeit:**
- Nur **explizit freigegebene** Daten werden angezeigt
- Keine automatischen Freigaben
- Keine Weitergabe an Dritte
- Keine Tracking-Cookies

**Transparenz:**
- Klare Kennzeichnung öffentlicher Profile
- Datenschutz-Hinweise auf allen Seiten
- Vollständige Datenschutzerklärung verfügbar

## Verwendung

### Als Anlagen-Besitzer

#### 1. Freigaben konfigurieren

1. Navigiere zu **Anlagen** in der Sidebar
2. Wechsle zum Tab **"Freigabe"**
3. Aktiviere gewünschte Freigaben:
   - ✅ Profil öffentlich (Pflicht für Community-Teilnahme)
   - ✅ Kennzahlen öffentlich (optional)
   - ✅ Monatsdaten öffentlich (optional)
   - ✅ Investitionen öffentlich (optional)
   - ✅ Auswertungen öffentlich (optional)
   - ✅ Standort genau (optional, sonst anonymisiert)
4. Klicke **"Freigabe speichern"**

#### 2. Profil-Beschreibung hinzufügen

1. Im Tab **"Profil"** (Anlagen-Seite)
2. Füge eine **Profilbeschreibung** hinzu
3. Beschreibe deine Anlage, Erfahrungen, Learnings
4. Klicke **"Speichern"**

### Als Community-Nutzer

#### 1. Anlagen durchsuchen

1. Navigiere zu **Community** in der Sidebar
2. Nutze Filter:
   - Ort eingeben
   - Batterie, E-Auto, Wärmepumpe filtern
   - Leistungsbereich wählen
3. Klicke auf eine Anlage für Details

#### 2. Anlagen-Details ansehen

- **Profil:** Name, Standort, Komponenten
- **Kennzahlen:** Autarkiegrad, CO₂-Einsparung (wenn freigegeben)
- **Technische Daten:** Hersteller, Modell, Module
- **Beschreibung:** Erfahrungen des Eigentümers

## API-Dokumentation

### GET /api/community/anlagen

Holt alle öffentlichen Anlagen.

**Query-Parameter:**
- `ort` (string): Filter nach Ort
- `plz` (string): Filter nach PLZ
- `minLeistung` (number): Min. Leistung in kWp
- `maxLeistung` (number): Max. Leistung in kWp
- `hatBatterie` (boolean): Nur mit Speicher
- `hatEAuto` (boolean): Nur mit E-Auto
- `hatWaermepumpe` (boolean): Nur mit Wärmepumpe

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "anlagenname": "Meine PV-Anlage",
      "leistung_kwp": 10.5,
      "standort_ort": "München",
      "standort_plz": "80XXX",
      "batteriekapazitaet_kwh": 10,
      "ekfz_vorhanden": true,
      "freigaben": {
        "profil_oeffentlich": true,
        "kennzahlen_oeffentlich": true,
        "standort_genau": false
      },
      "mitglied_vorname": "Max",
      "mitglied_ort": "München"
    }
  ],
  "count": 42
}
```

### GET /api/community/anlagen/[id]

Holt eine einzelne öffentliche Anlage.

**Query-Parameter:**
- `kennzahlen` (boolean): Kennzahlen einbeziehen
- `monatsdaten` (boolean): Monatsdaten einbeziehen
- `jahr` (number): Jahr für Monatsdaten

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "anlagenname": "Meine PV-Anlage",
    "leistung_kwp": 10.5,
    "profilbeschreibung": "Tolle Anlage mit...",
    "hersteller": "SunPower",
    "modell": "SPR-X22-370",
    // ...
  },
  "kennzahlen": {
    "gesamterzeugung_kwh": 125000,
    "autarkiegrad_prozent": 78.5,
    "co2_einsparung_kg": 50000
  }
}
```

### GET /api/community/stats

Holt Community-Statistiken.

**Response:**
```json
{
  "success": true,
  "data": {
    "gesamtAnlagen": 150,
    "oeffentlicheAnlagen": 42,
    "gesamtleistungKwp": 1250.5
  }
}
```

## Datenbankschema

### anlagen_freigaben

```sql
CREATE TABLE public.anlagen_freigaben (
  anlage_id uuid NOT NULL PRIMARY KEY,
  profil_oeffentlich boolean DEFAULT false,
  kennzahlen_oeffentlich boolean DEFAULT false,
  auswertungen_oeffentlich boolean DEFAULT false,
  investitionen_oeffentlich boolean DEFAULT false,
  monatsdaten_oeffentlich boolean DEFAULT false,
  standort_genau boolean DEFAULT false,
  erstellt_am timestamp DEFAULT now(),
  aktualisiert_am timestamp DEFAULT now(),
  FOREIGN KEY (anlage_id) REFERENCES anlagen(id) ON DELETE CASCADE
);
```

## Sicherheit

### Row Level Security (RLS)

Empfohlene RLS-Policies für Supabase:

```sql
-- Öffentliche Anlagen: Jeder kann lesen
CREATE POLICY "Öffentliche Anlagen für alle sichtbar"
  ON anlagen
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM anlagen_freigaben
      WHERE anlagen_freigaben.anlage_id = anlagen.id
      AND anlagen_freigaben.profil_oeffentlich = true
    )
  );

-- Eigene Anlagen: Nur Eigentümer kann bearbeiten
CREATE POLICY "Nutzer können eigene Anlagen bearbeiten"
  ON anlagen
  FOR ALL
  USING (
    mitglied_id IN (
      SELECT id FROM mitglieder
      WHERE email = auth.jwt() ->> 'email'
    )
  );
```

### Datenschutz-Maßnahmen

1. **Standort-Anonymisierung:**
   - Wenn `standort_genau = false`, wird PLZ auf XX000 gekürzt
   - Koordinaten werden null gesetzt

2. **Bedingte Daten-Rückgabe:**
   - Kennzahlen nur wenn `kennzahlen_oeffentlich = true`
   - Monatsdaten nur wenn `monatsdaten_oeffentlich = true`

3. **Kein Reverse-Lookup:**
   - Mitglied-ID wird nicht exponiert
   - Nur Vorname und Ort werden angezeigt

## Testing

### Testfälle

1. **Freigabe aktivieren:**
   - Gehe zu Anlagen → Freigabe
   - Aktiviere "Profil öffentlich"
   - Prüfe in Community, ob Anlage erscheint

2. **Freigabe widerrufen:**
   - Deaktiviere "Profil öffentlich"
   - Prüfe, dass Anlage aus Community verschwindet

3. **Filter testen:**
   - Erstelle Anlagen mit verschiedenen Features
   - Teste Filter (Batterie, E-Auto, etc.)

4. **Anonymisierung testen:**
   - Deaktiviere "Standort genau"
   - Prüfe, dass PLZ anonymisiert wird (XX000)

## Bekannte Limitierungen

1. **Keine Bewertungen:** Community-Anlagen können nicht bewertet werden (kann zukünftig ergänzt werden)
2. **Keine Nachrichten:** Keine direkte Kommunikation zwischen Nutzern (Datenschutz)
3. **Keine Vergleichs-Funktion:** Noch keine Side-by-Side Vergleiche (geplant)

## Roadmap

### Geplante Features

- [ ] Anlagen-Vergleich (Side-by-Side)
- [ ] Karte mit öffentlichen Anlagen
- [ ] Erweiterte Filter (Installationsjahr, Hersteller)
- [ ] Export öffentlicher Statistiken
- [ ] Kommentare / Erfahrungsberichte
- [ ] Leaderboard (höchster Autarkiegrad, etc.)

### Zukunft

- [ ] Community-Forum
- [ ] Best Practice Guides
- [ ] Hersteller-Bewertungen
- [ ] Installateur-Empfehlungen

## Support

Bei Fragen oder Problemen:
1. Prüfe die [Datenschutzerklärung](/datenschutz)
2. Lies die [Authentication-Setup-Anleitung](./AUTHENTICATION_SETUP.md)
3. Erstelle ein Issue auf GitHub

## Fazit

Die Community-Features erweitern EEDC um eine soziale Komponente, ohne die Datenschutz-Standards zu kompromittieren. Benutzer behalten die volle Kontrolle und können selbst entscheiden, was sie teilen möchten.
