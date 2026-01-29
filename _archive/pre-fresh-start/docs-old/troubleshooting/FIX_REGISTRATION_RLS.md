# 🔧 Fix: Registration RLS Policy

## Problem

Die Fehlermeldung "permission denied for table users" bedeutet, dass die RLS (Row Level Security) Policy für die `mitglieder` Tabelle zu restriktiv ist.

Die alte Policy erlaubte nur INSERT, wenn der User bereits vollständig in der Datenbank war - aber das ist während der Registrierung nicht der Fall!

## Lösung

Führe das SQL-Skript [scripts/fix-registration-rls.sql](scripts/fix-registration-rls.sql) in Supabase aus:

### Schritt 1: Öffne Supabase SQL Editor

1. Gehe zu: https://supabase.com/dashboard
2. Wähle dein Projekt
3. Navigiere zu: **SQL Editor** (linke Sidebar)

### Schritt 2: Führe das Script aus

Kopiere den Inhalt von `scripts/fix-registration-rls.sql` und führe ihn aus:

```sql
-- Fix RLS Policy für Registrierung
-- Die bisherige INSERT Policy war zu restriktiv

-- 1. Lösche die alte INSERT Policy
DROP POLICY IF EXISTS "Users can insert own data" ON mitglieder;

-- 2. Erstelle neue INSERT Policy die Registrierung erlaubt
-- Während der Registrierung ist der User authentifiziert (via signUp)
-- und darf sich selbst in der mitglieder Tabelle eintragen
CREATE POLICY "Enable insert for authenticated users during registration"
ON mitglieder
FOR INSERT
TO authenticated
WITH CHECK (
  -- User muss authentifiziert sein
  auth.uid() IS NOT NULL
  AND
  -- Email muss mit der Auth-Email übereinstimmen
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
```

### Schritt 3: Verifiziere die Policy

Das Script zeigt am Ende alle Policies für die `mitglieder` Tabelle an. Du solltest sehen:

- ✅ `Enable insert for authenticated users during registration` (INSERT)
- ✅ `Users can view own data` (SELECT)
- ✅ `Users can update own data` (UPDATE)

### Schritt 4: Teste die Registrierung

1. **Lösche den alten Max Mustermann User** (falls vorhanden):
   ```sql
   DELETE FROM mitglieder WHERE email = 'max.mustermann@tester.com';
   ```

2. **Lösche in Auth Users** (Supabase Dashboard):
   - Authentication → Users
   - Suche: max.mustermann@tester.com
   - Delete

3. **Öffne Inkognito-Fenster**
4. **Navigiere zu:** http://localhost:3002/register
5. **Öffne Browser Console** (F12)
6. **Registriere Max Mustermann:**
   - Vorname: Max
   - Nachname: Mustermann
   - Email: max.mustermann@tester.com
   - PLZ: 51588
   - Ort: Nümbrecht
   - Password: test123
   - Confirm: test123

7. **Kopiere ALLE Console-Logs** und schicke sie mir!

## Was wurde geändert?

### Alte Policy (zu restriktiv):
```sql
CREATE POLICY "Users can insert own data" ON mitglieder
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE email = mitglieder.email));
```

Problem: Diese Subquery funktioniert nicht zuverlässig während der Registrierung.

### Neue Policy (korrekt):
```sql
CREATE POLICY "Enable insert for authenticated users during registration"
ON mitglieder
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
```

Vorteile:
- Explizit für `authenticated` Role
- Direkter Vergleich mit Auth-Email
- Funktioniert während und nach der Registrierung

## Nach dem Fix

Nach dem Fix sollte die Registrierung funktionieren und wir können endlich die Debug-Logs sehen, um herauszufinden warum vorname/nachname leer waren!
