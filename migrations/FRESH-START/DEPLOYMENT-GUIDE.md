# FRESH-START Deployment Guide

## ⚠️ WICHTIG: Alle Daten werden gelöscht!

Dieser Guide führt dich durch den kompletten FRESH-START des Schemas.

## Deployment-Reihenfolge

### 1️⃣ Drop Old Schema
**Datei:** `00_drop_old_schema.sql`

Löscht alle bestehenden Tabellen, Views, Functions und Types.

**In Supabase SQL Editor:**
1. Öffne SQL Editor
2. Kopiere Inhalt von `00_drop_old_schema.sql`
3. Führe aus
4. Erwartete Ausgabe: `Old schema dropped successfully. Ready for fresh start.`

---

### 2️⃣ Core Schema
**Datei:** `01_core_schema.sql`

Erstellt alle Tabellen mit dem neuen Schema:
- `mitglieder` (User Profile)
- `anlagen` (mit Freigaben-Spalten!)
- `anlagen_komponenten` (Speicher, Wechselrichter, etc.)
- `haushalt_komponenten` (E-Auto, Wärmepumpe, etc.)
- `monatsdaten`
- `komponenten_monatsdaten`
- `anlagen_kennzahlen`
- `komponenten_typen`
- `strompreise`

**In Supabase SQL Editor:**
1. Kopiere Inhalt von `01_core_schema.sql`
2. Führe aus
3. Erwartete Ausgabe: `Core schema created successfully. Tables created: 9`

**WICHTIG:** Die `anlagen` Tabelle hat jetzt diese Freigaben-Spalten:
```sql
oeffentlich boolean DEFAULT false,
standort_genau_anzeigen boolean DEFAULT false,
kennzahlen_oeffentlich boolean DEFAULT false,
monatsdaten_oeffentlich boolean DEFAULT false,
komponenten_oeffentlich boolean DEFAULT false,
```

---

### 3️⃣ Helper Functions
**Datei:** `02_helper_functions.sql`

Erstellt Helper Functions für RLS und Auth:
- `auth_user_id()` - Holt aktuelle User ID
- `current_mitglied_id()` - Holt aktuelle Mitglied ID
- `user_owns_anlage(uuid)` - Prüft Besitz einer Anlage
- `anlage_is_public(uuid)` - Prüft ob Anlage öffentlich ist

**In Supabase SQL Editor:**
1. Kopiere Inhalt von `02_helper_functions.sql`
2. Führe aus
3. Erwartete Ausgabe: `Helper functions created successfully`

---

### 4️⃣ RLS Policies
**Datei:** `03_rls_policies.sql`

Aktiviert RLS und erstellt Policies für alle Tabellen.

**In Supabase SQL Editor:**
1. Kopiere Inhalt von `03_rls_policies.sql`
2. Führe aus
3. Erwartete Ausgabe: `RLS policies created successfully`

---

### 5️⃣ Community Functions
**Datei:** `04_community_functions_FRESH_START.sql`

Erstellt Security Definer Functions für Community-Features:
- `get_public_anlagen()` - Liefert alle öffentlichen Anlagen
- `get_community_stats()` - Aggregierte Statistiken
- `get_public_anlage_details(uuid)` - Detailansicht
- `get_public_monatsdaten(uuid)` - Monatsdaten
- `search_public_anlagen(...)` - Suchfunktion

**In Supabase SQL Editor:**
1. Kopiere Inhalt von `04_community_functions_FRESH_START.sql`
2. Führe aus
3. Erwartete Ausgabe: `Community Functions erfolgreich erstellt (FRESH START)`

---

## Verifizierung

Nach dem Deployment kannst du folgende Checks ausführen:

### 1. Tabellen-Check
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Erwartete Tabellen (9):
- anlagen
- anlagen_kennzahlen
- anlagen_komponenten
- haushalt_komponenten
- komponenten_monatsdaten
- komponenten_typen
- mitglieder
- monatsdaten
- strompreise

### 2. Freigaben-Spalten Check
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'anlagen'
  AND column_name LIKE '%oeffentlich%' OR column_name LIKE '%genau%'
ORDER BY ordinal_position;
```

Erwartete Spalten:
- oeffentlich (boolean)
- standort_genau_anzeigen (boolean)
- kennzahlen_oeffentlich (boolean)
- monatsdaten_oeffentlich (boolean)
- komponenten_oeffentlich (boolean)

### 3. Functions Check
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%public%' OR routine_name LIKE 'community%'
ORDER BY routine_name;
```

Erwartete Functions:
- get_community_stats
- get_public_anlage_details
- get_public_anlagen
- get_public_monatsdaten
- search_public_anlagen

### 4. RLS Check
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Sollte Policies für alle Tabellen anzeigen.

---

## Nächste Schritte nach Deployment

### 1. Test-Daten einfügen (optional)
Erstelle Test-Mitglied und Test-Anlagen um das System zu testen.

### 2. RLS-Tests ausführen
```bash
psql -f migrations/FRESH-START/test-rls-policies.sql
```

### 3. TypeScript Types generieren
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

### 4. Code-Anpassungen
Überprüfe und aktualisiere:
- `lib/anlage-actions.ts` - Freigaben in anlagen-Spalten setzen
- `app/api/anlagen/route.ts` - Freigaben-Spalten verwenden
- Alle Queries die `anlagen_freigaben` referenzieren

---

## Troubleshooting

### "relation anlagen_freigaben does not exist"
✅ Das ist korrekt! Die Tabelle existiert nicht mehr.
➡️ Code muss auf Freigaben-Spalten in `anlagen` Tabelle umgestellt werden.

### "function already exists"
Nutze `04_community_functions_FRESH_START.sql` - es hat bereits `DROP FUNCTION IF EXISTS` Statements.

### "permission denied"
Prüfe ob du als Admin eingeloggt bist in Supabase Dashboard.

---

## Rollback

Falls du zurück zum alten Schema willst:
1. Deploye `00_drop_old_schema.sql`
2. Deploye das alte Schema aus Backup
3. Restore Daten aus Backup

⚠️ **Daher: Backup vor FRESH-START erstellen!**

---

## Status Tracking

- [ ] 00_drop_old_schema.sql deployed
- [ ] 01_core_schema.sql deployed
- [ ] 02_helper_functions.sql deployed
- [ ] 03_rls_policies.sql deployed
- [ ] 04_community_functions_FRESH_START.sql deployed
- [ ] Verifizierung durchgeführt
- [ ] TypeScript Types generiert
- [ ] Code angepasst
- [ ] Tests ausgeführt

---

Erstellt: 2026-01-29
Schema Version: FRESH-START v1.0
