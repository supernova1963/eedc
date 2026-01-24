# Schema-Migration Anleitung

## Schritt-für-Schritt Anleitung zur Ausführung der Datenbank-Migrationen

### Voraussetzungen

- Zugriff auf Supabase Dashboard
- Projekt-ID: `vwrvnkcmaifjvffqhfeg`

---

## Option 1: Alle Migrationen auf einmal (Empfohlen)

### Schritt 1: Supabase SQL Editor öffnen

1. Gehe zu [https://app.supabase.com](https://app.supabase.com)
2. Melde dich an
3. Wähle dein Projekt: `vwrvnkcmaifjvffqhfeg`
4. Klicke im Menü auf **SQL Editor**

### Schritt 2: Migrations-Datei laden

1. Klicke auf **New query**
2. Öffne die Datei `/migrations/_all_migrations.sql` in deinem Editor
3. Kopiere den gesamten Inhalt
4. Füge ihn in den SQL Editor ein

### Schritt 3: Ausführen

1. Klicke auf **Run** (oder Strg+Enter)
2. Warte, bis alle Statements ausgeführt wurden
3. Bei Erfolg siehst du: "Success. No rows returned"

### Schritt 4: Verifizierung

Führe folgende Abfragen aus, um zu prüfen, ob alles geklappt hat:

```sql
-- Prüfe neue Tabellen
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('strompreise', 'investitionstyp_config', 'investition_kennzahlen', 'anlagen_kennzahlen');
-- Sollte 4 Zeilen zurückgeben

-- Prüfe neue Spalte
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'alternative_investitionen'
  AND column_name = 'anlage_id';
-- Sollte 1 Zeile zurückgeben

-- Prüfe Views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('strompreise_aktuell', 'anlagen_komplett', 'investitionen_uebersicht', 'monatsdaten_erweitert');
-- Sollte 4 Zeilen zurückgeben

-- Prüfe Funktionen
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_strompreis', 'berechne_monatliche_einsparung', 'co2_zu_baeume', 'aktualisiere_investition_kennzahlen');
-- Sollte 4 Zeilen zurückgeben

-- Teste eine Funktion
SELECT co2_zu_baeume(1000);
-- Sollte 100 zurückgeben
```

---

## Option 2: Einzelne Migrationen (Schritt für Schritt)

Falls du lieber Schritt für Schritt vorgehen möchtest:

### Migration 1: anlage_id hinzufügen

```sql
-- Datei: 01_add_anlage_id.sql
ALTER TABLE public.alternative_investitionen
ADD COLUMN IF NOT EXISTS anlage_id uuid;

ALTER TABLE public.alternative_investitionen
DROP CONSTRAINT IF EXISTS alternative_investitionen_anlage_id_fkey;

ALTER TABLE public.alternative_investitionen
ADD CONSTRAINT alternative_investitionen_anlage_id_fkey
FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id);

CREATE INDEX IF NOT EXISTS idx_alternative_investitionen_anlage
ON public.alternative_investitionen(anlage_id);
```

**Verifizierung:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'alternative_investitionen'
  AND column_name = 'anlage_id';
```

---

### Migration 2: Strompreise-Tabelle

```sql
-- Datei: 02_strompreise.sql
-- (Siehe Datei für vollständigen Code)
```

**Verifizierung:**
```sql
SELECT * FROM strompreise LIMIT 1;
-- Sollte leere Tabelle zeigen (kein Fehler)
```

---

### Migration 3: Investitionstyp-Config

```sql
-- Datei: 03_investitionstyp_config.sql
-- (Siehe Datei für vollständigen Code)
```

**Verifizierung:**
```sql
SELECT typ, bezeichnung, standardlebensdauer_jahre
FROM investitionstyp_config;
-- Sollte 8 Zeilen zeigen
```

---

### Migration 4-7: Weitere Tabellen, Constraints, Views, Functions

Führe nacheinander aus:
1. `04_kennzahlen_tables.sql`
2. `05_constraints_and_indexes.sql`
3. `06_views.sql`
4. `07_functions.sql`

---

## Nach der Migration

### 1. Erste Daten erfassen

#### Strompreis anlegen

```sql
-- Beispiel: Strompreis erfassen
INSERT INTO strompreise (
  mitglied_id,
  gueltig_ab,
  netzbezug_arbeitspreis_cent_kwh,
  netzbezug_grundpreis_euro_monat,
  einspeiseverguetung_cent_kwh,
  anbieter_name,
  vertragsart
)
SELECT
  id,
  '2024-01-01',
  32.50,
  12.00,
  8.20,
  'Stadtwerke',
  'Sondervertrag'
FROM mitglieder
LIMIT 1;
```

#### Investition einer Anlage zuordnen

```sql
-- Beispiel: Wechselrichter der ersten Anlage zuordnen
UPDATE alternative_investitionen
SET anlage_id = (SELECT id FROM anlagen ORDER BY erstellt_am LIMIT 1)
WHERE id = (
  SELECT id
  FROM alternative_investitionen
  WHERE typ = 'wechselrichter'
    AND anlage_id IS NULL
  ORDER BY anschaffungsdatum
  LIMIT 1
);
```

### 2. Kennzahlen berechnen

```sql
-- Kennzahlen für eine Investition aktualisieren
SELECT aktualisiere_investition_kennzahlen(
  (SELECT id FROM alternative_investitionen LIMIT 1)
);

-- Ergebnis anzeigen
SELECT *
FROM investition_kennzahlen
LIMIT 1;
```

### 3. Views testen

```sql
-- Aktuell gültige Strompreise
SELECT * FROM strompreise_aktuell;

-- Anlagen mit Investitionen
SELECT * FROM anlagen_komplett;

-- Investitionen mit Kennzahlen
SELECT * FROM investitionen_uebersicht LIMIT 5;

-- Monatsdaten mit Kennzahlen
SELECT * FROM monatsdaten_erweitert LIMIT 5;
```

---

## Troubleshooting

### Fehler: "permission denied"

**Lösung:** Du benötigst Admin-Rechte. Wechsle in Supabase zu einem Admin-User oder nutze den Service-Role-Key.

### Fehler: "relation already exists"

**Lösung:** Die Tabelle existiert bereits. Überspringe diese Migration oder nutze `IF NOT EXISTS`.

### Fehler: "foreign key constraint"

**Lösung:** Stelle sicher, dass die referenzierten Tabellen existieren. Führe Migrationen in der richtigen Reihenfolge aus.

### Fehler: "syntax error"

**Lösung:** Kopiere den SQL-Code exakt. Achte auf vollständige Statements (mit Semikolon).

---

## Rollback (Falls nötig)

**ACHTUNG:** Dies löscht alle Daten in den neuen Tabellen!

```sql
-- Views löschen
DROP VIEW IF EXISTS monatsdaten_erweitert CASCADE;
DROP VIEW IF EXISTS investitionen_uebersicht CASCADE;
DROP VIEW IF EXISTS anlagen_komplett CASCADE;
DROP VIEW IF EXISTS strompreise_aktuell CASCADE;

-- Funktionen löschen
DROP FUNCTION IF EXISTS aktualisiere_investition_kennzahlen(uuid);
DROP FUNCTION IF EXISTS co2_zu_baeume(numeric);
DROP FUNCTION IF EXISTS berechne_monatliche_einsparung(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_strompreis(uuid, uuid, date, text);

-- Tabellen löschen
DROP TABLE IF EXISTS anlagen_kennzahlen CASCADE;
DROP TABLE IF EXISTS investition_kennzahlen CASCADE;
DROP TABLE IF EXISTS investitionstyp_config CASCADE;
DROP TABLE IF EXISTS strompreise CASCADE;

-- Spalte entfernen
ALTER TABLE alternative_investitionen DROP COLUMN IF EXISTS anlage_id;

-- Constraints entfernen
ALTER TABLE monatsdaten DROP CONSTRAINT IF EXISTS monatsdaten_anlage_jahr_monat_unique;
ALTER TABLE investition_monatsdaten DROP CONSTRAINT IF EXISTS investition_monatsdaten_unique;
```

---

## Backup vor Migration (Optional, aber empfohlen)

Supabase erstellt automatisch Backups. Für zusätzliche Sicherheit:

1. Gehe zu **Database** → **Backups**
2. Klicke auf **Create backup**
3. Warte auf Bestätigung
4. Führe dann die Migration durch

---

## Support

Bei Problemen:
1. Überprüfe die Supabase Logs (Database → Logs)
2. Konsultiere die [Supabase Dokumentation](https://supabase.com/docs)
3. Öffne ein Issue im GitHub Repository

---

## Checkliste

- [ ] Supabase Dashboard geöffnet
- [ ] Projekt ausgewählt
- [ ] SQL Editor geöffnet
- [ ] (Optional) Backup erstellt
- [ ] Migration ausgeführt
- [ ] Verifizierung durchgeführt
- [ ] Erste Testdaten angelegt
- [ ] Views und Funktionen getestet
- [ ] Dokumentation gelesen

**Status:** Bereit für Auswertungen! 🎉
