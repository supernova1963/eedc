-- Fix ALLE RLS-Policies für Multi-User-Support
-- Entfernt auth.users Subqueries und verwendet mitglieder als Zwischentabelle

-- ============================================
-- 1. MITGLIEDER (bereits gefixt)
-- ============================================
-- Policies sind bereits korrekt

-- ============================================
-- 2. ANLAGEN
-- ============================================
DROP POLICY IF EXISTS "Users can view own anlagen" ON anlagen;
DROP POLICY IF EXISTS "Users can insert own anlagen" ON anlagen;
DROP POLICY IF EXISTS "Users can update own anlagen" ON anlagen;
DROP POLICY IF EXISTS "Users can delete own anlagen" ON anlagen;
DROP POLICY IF EXISTS "anlagen_select" ON anlagen;
DROP POLICY IF EXISTS "anlagen_insert" ON anlagen;
DROP POLICY IF EXISTS "anlagen_update" ON anlagen;
DROP POLICY IF EXISTS "anlagen_delete" ON anlagen;

CREATE POLICY "anlagen_select" ON anlagen FOR SELECT TO authenticated
USING (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()));

CREATE POLICY "anlagen_insert" ON anlagen FOR INSERT TO authenticated
WITH CHECK (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()));

CREATE POLICY "anlagen_update" ON anlagen FOR UPDATE TO authenticated
USING (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()))
WITH CHECK (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()));

CREATE POLICY "anlagen_delete" ON anlagen FOR DELETE TO authenticated
USING (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()));

-- ============================================
-- 3. ANLAGEN_FREIGABEN
-- ============================================
DROP POLICY IF EXISTS "Users can view own anlagen_freigaben" ON anlagen_freigaben;
DROP POLICY IF EXISTS "Users can insert own anlagen_freigaben" ON anlagen_freigaben;
DROP POLICY IF EXISTS "Users can update own anlagen_freigaben" ON anlagen_freigaben;
DROP POLICY IF EXISTS "Users can delete own anlagen_freigaben" ON anlagen_freigaben;

CREATE POLICY "anlagen_freigaben_select" ON anlagen_freigaben FOR SELECT TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "anlagen_freigaben_insert" ON anlagen_freigaben FOR INSERT TO authenticated
WITH CHECK (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "anlagen_freigaben_update" ON anlagen_freigaben FOR UPDATE TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "anlagen_freigaben_delete" ON anlagen_freigaben FOR DELETE TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

-- ============================================
-- 4. MONATSDATEN
-- ============================================
DROP POLICY IF EXISTS "Users can view own monatsdaten" ON monatsdaten;
DROP POLICY IF EXISTS "Users can insert own monatsdaten" ON monatsdaten;
DROP POLICY IF EXISTS "Users can update own monatsdaten" ON monatsdaten;
DROP POLICY IF EXISTS "Users can delete own monatsdaten" ON monatsdaten;

CREATE POLICY "monatsdaten_select" ON monatsdaten FOR SELECT TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "monatsdaten_insert" ON monatsdaten FOR INSERT TO authenticated
WITH CHECK (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "monatsdaten_update" ON monatsdaten FOR UPDATE TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "monatsdaten_delete" ON monatsdaten FOR DELETE TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

-- ============================================
-- 5. INVESTITIONEN
-- ============================================
DROP POLICY IF EXISTS "Users can view own investitionen" ON investitionen;
DROP POLICY IF EXISTS "Users can insert own investitionen" ON investitionen;
DROP POLICY IF EXISTS "Users can update own investitionen" ON investitionen;
DROP POLICY IF EXISTS "Users can delete own investitionen" ON investitionen;

CREATE POLICY "investitionen_select" ON investitionen FOR SELECT TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "investitionen_insert" ON investitionen FOR INSERT TO authenticated
WITH CHECK (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "investitionen_update" ON investitionen FOR UPDATE TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "investitionen_delete" ON investitionen FOR DELETE TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

-- ============================================
-- 6. ALTERNATIVE_INVESTITIONEN
-- ============================================
DROP POLICY IF EXISTS "Users can view own alternative_investitionen" ON alternative_investitionen;
DROP POLICY IF EXISTS "Users can insert own alternative_investitionen" ON alternative_investitionen;
DROP POLICY IF EXISTS "Users can update own alternative_investitionen" ON alternative_investitionen;
DROP POLICY IF EXISTS "Users can delete own alternative_investitionen" ON alternative_investitionen;

CREATE POLICY "alternative_investitionen_select" ON alternative_investitionen FOR SELECT TO authenticated
USING (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()));

CREATE POLICY "alternative_investitionen_insert" ON alternative_investitionen FOR INSERT TO authenticated
WITH CHECK (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()));

CREATE POLICY "alternative_investitionen_update" ON alternative_investitionen FOR UPDATE TO authenticated
USING (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()))
WITH CHECK (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()));

CREATE POLICY "alternative_investitionen_delete" ON alternative_investitionen FOR DELETE TO authenticated
USING (mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()));

-- ============================================
-- 7. INVESTITION_MONATSDATEN
-- ============================================
DROP POLICY IF EXISTS "Users can view own investition_monatsdaten" ON investition_monatsdaten;
DROP POLICY IF EXISTS "Users can insert own investition_monatsdaten" ON investition_monatsdaten;
DROP POLICY IF EXISTS "Users can update own investition_monatsdaten" ON investition_monatsdaten;
DROP POLICY IF EXISTS "Users can delete own investition_monatsdaten" ON investition_monatsdaten;

CREATE POLICY "investition_monatsdaten_select" ON investition_monatsdaten FOR SELECT TO authenticated
USING (investition_id IN (
  SELECT ai.id FROM alternative_investitionen ai
  JOIN mitglieder m ON m.id = ai.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "investition_monatsdaten_insert" ON investition_monatsdaten FOR INSERT TO authenticated
WITH CHECK (investition_id IN (
  SELECT ai.id FROM alternative_investitionen ai
  JOIN mitglieder m ON m.id = ai.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "investition_monatsdaten_update" ON investition_monatsdaten FOR UPDATE TO authenticated
USING (investition_id IN (
  SELECT ai.id FROM alternative_investitionen ai
  JOIN mitglieder m ON m.id = ai.mitglied_id
  WHERE m.email = auth.email()
));

CREATE POLICY "investition_monatsdaten_delete" ON investition_monatsdaten FOR DELETE TO authenticated
USING (investition_id IN (
  SELECT ai.id FROM alternative_investitionen ai
  JOIN mitglieder m ON m.id = ai.mitglied_id
  WHERE m.email = auth.email()
));

-- ============================================
-- VERIFIZIERUNG
-- ============================================
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Zeige alle Policies
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
