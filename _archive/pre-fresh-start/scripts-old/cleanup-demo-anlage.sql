-- Cleanup Script: Demo-Anlage entfernen oder zuordnen
-- Führen Sie dieses Script in Supabase SQL Editor aus

-- Schritt 1: Finde die Demo-Anlage (ohne mitglied_id oder mit ungültiger mitglied_id)
SELECT
  id,
  anlagenname,
  mitglied_id,
  erstellt_am,
  (SELECT email FROM mitglieder WHERE id = anlagen.mitglied_id) as mitglied_email
FROM anlagen
WHERE mitglied_id IS NULL
   OR mitglied_id NOT IN (SELECT id FROM mitglieder)
ORDER BY erstellt_am;

-- Schritt 2: Lösche die Demo-Anlage(n)
-- WICHTIG: Prüfen Sie zuerst die Ergebnisse von Schritt 1!
-- Entfernen Sie das -- vor DELETE um auszuführen

-- DELETE FROM monatsdaten WHERE anlage_id IN (
--   SELECT id FROM anlagen
--   WHERE mitglied_id IS NULL
--      OR mitglied_id NOT IN (SELECT id FROM mitglieder)
-- );

-- DELETE FROM investitionen WHERE anlage_id IN (
--   SELECT id FROM anlagen
--   WHERE mitglied_id IS NULL
--      OR mitglied_id NOT IN (SELECT id FROM mitglieder)
-- );

-- DELETE FROM anlagen_freigaben WHERE anlage_id IN (
--   SELECT id FROM anlagen
--   WHERE mitglied_id IS NULL
--      OR mitglied_id NOT IN (SELECT id FROM mitglieder)
-- );

-- DELETE FROM anlagen
-- WHERE mitglied_id IS NULL
--    OR mitglied_id NOT IN (SELECT id FROM mitglieder);

-- Schritt 3: Verifizieren
SELECT COUNT(*) as anzahl_anlagen_ohne_owner
FROM anlagen
WHERE mitglied_id IS NULL
   OR mitglied_id NOT IN (SELECT id FROM mitglieder);
