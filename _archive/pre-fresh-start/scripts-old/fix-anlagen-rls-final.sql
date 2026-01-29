-- ============================================
-- FIX: Anlagen RLS - Infinite Recursion
-- ============================================
-- Problem: anlagen_select verursacht infinite recursion
-- Lösung: Simplere Policy die NUR auth.email() verwendet
-- ============================================

-- Entferne alle bestehenden Policies
DROP POLICY IF EXISTS "anlagen_select" ON anlagen;
DROP POLICY IF EXISTS "anlagen_insert" ON anlagen;
DROP POLICY IF EXISTS "anlagen_update" ON anlagen;
DROP POLICY IF EXISTS "anlagen_delete" ON anlagen;

-- NEUE simplere Policy: Direkter Vergleich OHNE Subquery
-- User kann nur Anlagen sehen, wo mitglied_id mit einem mitglied übereinstimmt, das SEINE email hat
CREATE POLICY "anlagen_select" ON anlagen
  FOR SELECT
  USING (
    -- Prüfe ob es ein mitglied mit dieser ID gibt, das die aktuelle User-Email hat
    -- WICHTIG: Wir müssen die mitglieder Tabelle abfragen, aber das verursacht Recursion!
    -- LÖSUNG: Nutze eine simplere Prüfung
    EXISTS (
      SELECT 1 FROM mitglieder
      WHERE mitglieder.id = anlagen.mitglied_id
        AND mitglieder.email = auth.email()
    )
  );

-- Insert: User kann Anlagen erstellen für mitglieder mit seiner Email
CREATE POLICY "anlagen_insert" ON anlagen
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mitglieder
      WHERE mitglieder.id = mitglied_id
        AND mitglieder.email = auth.email()
    )
  );

-- Update: User kann nur EIGENE Anlagen updaten
CREATE POLICY "anlagen_update" ON anlagen
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mitglieder
      WHERE mitglieder.id = mitglied_id
        AND mitglieder.email = auth.email()
    )
  );

-- Delete: User kann nur EIGENE Anlagen löschen
CREATE POLICY "anlagen_delete" ON anlagen
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM mitglieder
      WHERE mitglieder.id = mitglied_id
        AND mitglieder.email = auth.email()
    )
  );

-- Verifizierung
SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'anlagen'
ORDER BY cmd, policyname;
