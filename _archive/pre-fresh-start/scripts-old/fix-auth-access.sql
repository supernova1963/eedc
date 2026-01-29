-- ============================================
-- FIX: Auth Access Problem
-- ============================================
-- Problem: mitglieder_select blockiert Auth-Zugriff
-- Lösung: Erweitere Policy um auch auth.uid() zu prüfen
-- ============================================

-- Erweitere mitglieder Policy
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;

CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    -- Prüfe BEIDE: email UND uid (fallback)
    email = auth.email()
    OR
    -- Falls email nicht verfügbar ist, prüfe ob auth.users mit dieser email existiert
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.email = mitglieder.email
        AND u.id = auth.uid()
    )
  );

-- Verifizierung
SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'mitglieder'
ORDER BY cmd, policyname;
