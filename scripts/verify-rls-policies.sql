-- Verifizierung aller RLS Policies

-- 1. Zeige alle Tabellen mit RLS Status
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'mitglieder', 'anlagen', 'anlagen_freigaben', 'monatsdaten',
    'investitionen', 'alternative_investitionen', 'investition_monatsdaten'
  )
ORDER BY tablename;

-- 2. Zähle Policies pro Tabelle
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'mitglieder', 'anlagen', 'anlagen_freigaben', 'monatsdaten',
    'investitionen', 'alternative_investitionen', 'investition_monatsdaten'
  )
GROUP BY tablename
ORDER BY tablename;

-- 3. Zeige alle Policies im Detail
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'mitglieder', 'anlagen', 'anlagen_freigaben', 'monatsdaten',
    'investitionen', 'alternative_investitionen', 'investition_monatsdaten'
  )
ORDER BY tablename, cmd, policyname;

-- 4. Prüfe speziell anlagen_freigaben
SELECT
  tablename,
  policyname,
  cmd,
  SUBSTRING(qual FROM 1 FOR 100) as using_clause,
  SUBSTRING(with_check FROM 1 FOR 100) as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'anlagen_freigaben'
ORDER BY cmd, policyname;
