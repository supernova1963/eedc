-- ============================================
-- FIX: Anlagen Policy - Infinite Recursion
-- ============================================
-- Problem: anlagen_select hat infinite recursion
-- Lösung: Simplere Policy ohne Subqueries
-- ============================================

-- Entferne alte Policy
DROP POLICY IF EXISTS "anlagen_select" ON anlagen;

-- Neue simplere Policy: User sieht nur EIGENE Anlagen
CREATE POLICY "anlagen_select" ON anlagen
  FOR SELECT
  USING (
    -- Prüfe ob mitglied_id zum aktuellen User gehört
    -- OHNE Subquery auf mitglieder Tabelle (das verursacht Recursion!)
    mitglied_id IN (
      SELECT id FROM mitglieder WHERE email = auth.email()
    )
  );

-- Verifizierung
SELECT
  policyname,
  cmd as operation,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'anlagen'
ORDER BY policyname;
