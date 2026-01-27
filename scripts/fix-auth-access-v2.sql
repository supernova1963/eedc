-- ============================================
-- FIX: Auth Access Problem - Version 2
-- ============================================
-- Problem: Policy prüft auth.users, was nicht zugänglich ist
-- Lösung: Simplere Policy nur mit auth.email() UND auth.uid()
-- ============================================

-- Erweitere mitglieder Policy (OHNE auth.users Subquery)
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;

CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    -- Prüfe ob user authentifiziert ist (uid nicht null)
    -- UND die Email übereinstimmt
    auth.uid() IS NOT NULL
    AND email = auth.email()
  );

-- Verifizierung
SELECT
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'mitglieder'
  AND policyname = 'mitglieder_select';
