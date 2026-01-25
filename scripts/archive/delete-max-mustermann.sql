-- Lösche Max Mustermann komplett aus der Datenbank

-- 1. Prüfe ob er existiert
SELECT
  'mitglieder' as table_name,
  id,
  email,
  vorname,
  nachname
FROM mitglieder
WHERE email = 'max.mustermann@tester.com';

-- 2. Lösche aus mitglieder
DELETE FROM mitglieder WHERE email = 'max.mustermann@tester.com';

-- 3. Prüfe auth.users (benötigt Admin-Rechte, kann fehlschlagen)
SELECT id, email FROM auth.users WHERE email = 'max.mustermann@tester.com';

-- 4. Verifiziere dass er weg ist
SELECT COUNT(*) as count FROM mitglieder WHERE email = 'max.mustermann@tester.com';
