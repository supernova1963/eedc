## Testing Checklist: Fresh Start Migration

**Datum:** 2026-01-28
**Ziel:** Systematische Tests nach DB-Migration

---

## 1. PRE-MIGRATION TESTS

### 1.1 Backup Verification
- [ ] Backup erstellt: `pg_dump $DATABASE_URL > backup.sql`
- [ ] Backup-Größe geprüft: `ls -lh backup.sql`
- [ ] Backup ist nicht leer (>1KB)

### 1.2 Current State Documentation
- [ ] Liste aktuelle Tabellen: `\dt` in psql
- [ ] Zähle aktuelle mitglieder: `SELECT COUNT(*) FROM mitglieder;`
- [ ] Zähle aktuelle anlagen: `SELECT COUNT(*) FROM anlagen;`

---

## 2. MIGRATION EXECUTION

### 2.1 Migrations ausführen
- [ ] `00_drop_old_schema.sql` - Keine Errors
- [ ] `01_core_schema.sql` - 9 Tabellen erstellt
- [ ] `02_helper_functions.sql` - 4 Functions erstellt
- [ ] `03_rls_policies.sql` - Policies aktiviert
- [ ] `04_community_functions.sql` - Community Functions erstellt
- [ ] `05_seed_data.sql` - Seed Data inserted

### 2.2 Verification
- [ ] `verify.sql` ausgeführt - alle Checks OK
- [ ] Keine ERROR Messages in Supabase Logs

---

## 3. RLS TESTS (via Supabase SQL Editor)

### Test 3.1: Anonymous kann keine privaten Anlagen sehen
```sql
SET ROLE anon;
SELECT COUNT(*) FROM anlagen WHERE oeffentlich = false;
-- Expected: 0
```
- [ ] PASSED

### Test 3.2: Authenticated User sieht nur eigene mitglieder
```sql
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "test-user-id"}';
SELECT COUNT(*) FROM mitglieder WHERE auth_user_id != 'test-user-id';
-- Expected: 0
```
- [ ] PASSED

### Test 3.3: User kann keine fremden Anlagen sehen
```sql
-- Als User A eingeloggt
SELECT COUNT(*) FROM anlagen WHERE mitglied_id != current_mitglied_id();
-- Expected: Nur öffentliche Anlagen
```
- [ ] PASSED

### Test 3.4: User kann keine fremden Monatsdaten schreiben
```sql
-- Versuche Monatsdaten für fremde Anlage zu schreiben
INSERT INTO monatsdaten (anlage_id, jahr, monat) VALUES ('fremde-anlage-id', 2024, 1);
-- Expected: ERROR oder 0 rows inserted
```
- [ ] PASSED

### Test 3.5: Community Functions funktionieren ohne Auth
```sql
SET ROLE anon;
SELECT COUNT(*) FROM get_public_anlagen();
-- Expected: Anzahl öffentlicher Anlagen
```
- [ ] PASSED

---

## 4. AUTHENTICATION TESTS

### Test 4.1: Registrierung
- [ ] Neue User registrieren via Supabase Auth UI
- [ ] User erscheint in `auth.users`
- [ ] Mitglied-Eintrag wird NICHT automatisch erstellt (muss manuell/via Code)

### Test 4.2: Login
- [ ] Login mit Test-User
- [ ] `auth.getUser()` gibt User zurück
- [ ] `current_mitglied_id()` gibt korrektes mitglied zurück

### Test 4.3: User-Daten laden
```typescript
const { data: { user } } = await supabase.auth.getUser()
const { data: mitglied } = await supabase
  .from('mitglieder')
  .select('*')
  .eq('auth_user_id', user.id)
  .single()
```
- [ ] Mitglied gefunden
- [ ] Vorname, Nachname korrekt

---

## 5. UI TESTS (Manuell)

### Test 5.1: Dashboard (keine Anlage)
- [ ] Login als neuer User
- [ ] Dashboard zeigt "Keine Anlage gefunden"
- [ ] Link "Jetzt Anlage anlegen" vorhanden

### Test 5.2: Anlage erstellen
- [ ] Navigiere zu `/anlage`
- [ ] Formular ausfüllen (Name, kWp, Datum, Standort)
- [ ] "Anlage erstellen" klicken
- [ ] Anlage erscheint in Liste
- [ ] Redirect zu Dashboard

### Test 5.3: Dashboard (1 Anlage)
- [ ] Dashboard zeigt Anlage-Name
- [ ] **KEIN** AnlagenSelector (nur 1 Anlage)
- [ ] KPIs zeigen 0 (keine Monatsdaten)

### Test 5.4: Monatsdaten erfassen
- [ ] Navigiere zu `/eingabe`
- [ ] Korrekte Anlage ausgewählt (erste/einzige)
- [ ] Formular ausfüllen
- [ ] Daten speichern
- [ ] Dashboard aktualisiert KPIs

### Test 5.5: Multi-Anlage (2 Anlagen)
- [ ] Erstelle 2. Anlage
- [ ] Dashboard: AnlagenSelector erscheint
- [ ] Dropdown zeigt beide Anlagen
- [ ] Anlagenwechsel funktioniert
- [ ] URL-Parameter: `?anlageId=...`
- [ ] KPIs stimmen pro Anlage

### Test 5.6: Community (Anonymous)
- [ ] Logout
- [ ] Navigiere zu `/` (Community Dashboard)
- [ ] Keine privaten Anlagen sichtbar
- [ ] Öffentliche Anlage sichtbar (wenn vorhanden)
- [ ] Community Stats korrekt

### Test 5.7: Anlage öffentlich schalten
- [ ] Login
- [ ] Navigiere zu Anlage-Einstellungen
- [ ] "Öffentlich" aktivieren
- [ ] Kennzahlen/Monatsdaten öffentlich aktivieren
- [ ] Speichern
- [ ] Logout
- [ ] Community Dashboard: Anlage erscheint

---

## 6. KOMPONENTEN TESTS

### Test 6.1: Anlagen-Komponente erstellen (Speicher)
- [ ] Navigiere zu Anlage-Details
- [ ] "Komponente hinzufügen"
- [ ] Typ: Speicher
- [ ] Technische Daten eingeben (JSON)
- [ ] Speichern
- [ ] Komponente erscheint in Liste

### Test 6.2: Haushalts-Komponente erstellen (E-Auto)
- [ ] Navigiere zu `/investitionen` (oder neuer Route)
- [ ] "E-Auto hinzufügen"
- [ ] Daten eingeben
- [ ] Speichern
- [ ] E-Auto erscheint in Liste

---

## 7. EDGE CASES

### Test 7.1: User löschen
- [ ] User löschen in Supabase Auth
- [ ] Mitglied-Eintrag wird CASCADE gelöscht
- [ ] Anlagen werden CASCADE gelöscht
- [ ] Monatsdaten werden CASCADE gelöscht

### Test 7.2: Anlage löschen
- [ ] Anlage löschen
- [ ] Komponenten werden CASCADE gelöscht
- [ ] Monatsdaten werden CASCADE gelöscht
- [ ] Kennzahlen werden CASCADE gelöscht

### Test 7.3: Concurrent Access
- [ ] 2 Browser-Tabs, gleicher User
- [ ] Tab 1: Anlage A auswählen
- [ ] Tab 2: Anlage B auswählen
- [ ] Beide Tabs zeigen korrekte Daten

### Test 7.4: Invalid Anlage ID
- [ ] URL: `/meine-anlage?anlageId=invalid-uuid`
- [ ] Redirect zu erster Anlage
- [ ] Keine Crash

---

## 8. PERFORMANCE TESTS

### Test 8.1: Community Dashboard mit vielen Anlagen
- [ ] Erstelle 100 öffentliche Test-Anlagen (via SQL)
- [ ] Community Dashboard lädt in <2s
- [ ] `get_public_anlagen()` performant

### Test 8.2: Multi-Anlage mit vielen Monatsdaten
- [ ] User mit 5 Anlagen
- [ ] Je Anlage 24 Monate Daten
- [ ] Dashboard lädt in <1s
- [ ] Anlagenwechsel reaktiv

---

## 9. ROLLBACK TEST

### Test 9.1: Migration rückgängig machen
- [ ] Backup restore: `psql $DATABASE_URL < backup.sql`
- [ ] Alte Tabellen wieder da
- [ ] Alte Daten wieder da
- [ ] App funktioniert mit altem Schema

---

## 10. FINAL CHECKS

### 10.1 Code Quality
- [ ] Keine TypeScript Errors
- [ ] Keine Console Errors in Browser
- [ ] Supabase Logs clean (keine Errors)

### 10.2 Documentation
- [ ] README aktualisiert
- [ ] API Docs geschrieben
- [ ] Migration Guide dokumentiert

### 10.3 Monitoring
- [ ] Error Tracking aktiv (Sentry?)
- [ ] Query Performance monitoren
- [ ] RLS Policy Errors tracken

---

## SUCCESS CRITERIA

✅ Migration erfolgreich wenn:
1. Alle RLS Tests PASSED
2. Alle UI Tests PASSED
3. Keine Errors in Logs
4. User kann Multi-Anlage nutzen
5. Community Features funktionieren
6. Rollback funktioniert

---

**Status:** 📋 READY FOR TESTING
**Geschätzte Testdauer:** 3-4 Stunden
