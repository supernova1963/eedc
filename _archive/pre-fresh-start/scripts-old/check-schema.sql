-- Prüfe welche Spalten in der anlagen Tabelle existieren
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'anlagen'
ORDER BY ordinal_position;
