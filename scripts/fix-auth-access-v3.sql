-- ============================================
-- FIX: Auth Access Problem - Version 3
-- ============================================
-- Problem: mitglieder_select Policy blockiert auch Service Role
-- Lösung: Policy die SOWOHL für authentifizierte User ALS AUCH für Service Role funktioniert
-- ============================================

-- Erweitere mitglieder Policy
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;

CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    -- Erlaube Service Role (für Server-seitige Queries)
    auth.jwt() IS NULL
    OR
    -- Oder: User ist authentifiziert UND Email stimmt überein
    (
      auth.uid() IS NOT NULL
      AND email = auth.email()
    )
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
