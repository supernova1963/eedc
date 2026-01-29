-- ============================================
-- DEBUG: Authentication Problem diagnostizieren
-- ============================================

-- 1. Zeige ALLE Policies für mitglieder
SELECT
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression,
  roles
FROM pg_policies
WHERE tablename = 'mitglieder'
ORDER BY cmd, policyname;

-- 2. Teste auth.email() Funktion
SELECT auth.email() as current_user_email;

-- 3. Teste auth.uid() Funktion
SELECT auth.uid() as current_user_id;

-- 4. Zeige alle Mitglieder (nur für Debug, wird durch RLS gefiltert)
SELECT id, email, vorname, nachname, aktiv
FROM mitglieder
ORDER BY email;

-- 5. Prüfe ob RLS aktiviert ist
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'mitglieder';

-- 6. Zeige alle Policies für anlagen (zur Kontrolle)
SELECT
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'anlagen'
ORDER BY cmd, policyname;

-- 7. Zeige alle Policies für anlagen_freigaben (zur Kontrolle)
SELECT
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'anlagen_freigaben'
ORDER BY cmd, policyname;
