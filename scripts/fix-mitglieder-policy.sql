-- ============================================
-- FIX: Mitglieder INSERT Policy
-- ============================================
-- Problem: Die aktuelle Policy blockiert die Registrierung
-- Lösung: Policy vereinfachen für INSERT
-- ============================================

-- Alte Policy löschen
DROP POLICY IF EXISTS "Users can insert own data" ON mitglieder;

-- Neue, simplere Policy erstellen
-- Diese erlaubt jedem authentifizierten User, sich als Mitglied einzutragen
-- Die Email-Validierung erfolgt in der Anwendungslogik
CREATE POLICY "Users can insert own data" ON mitglieder
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Verifizierung
SELECT
  policyname,
  cmd as operation,
  qual as using_check
FROM pg_policies
WHERE tablename = 'mitglieder' AND policyname = 'Users can insert own data';
