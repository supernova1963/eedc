-- ============================================
-- FIX: Community öffentliche Anlagen Zugriff
-- ============================================
-- Problem: Öffentliche Anlagen sind nicht für alle Benutzer sichtbar
-- Lösung: Zusätzliche RLS-Policies für öffentlichen Lesezugriff
-- ============================================

-- 1. Policy für öffentliche Anlagen (alle können öffentliche lesen)
-- Entferne alte restriktive Policies
DROP POLICY IF EXISTS "Users can view own anlagen" ON anlagen;
DROP POLICY IF EXISTS "anlagen_select" ON anlagen;
DROP POLICY IF EXISTS "anlagen_public_select" ON anlagen;

-- Erstelle neue flexible Policy
CREATE POLICY "anlagen_select" ON anlagen
  FOR SELECT
  USING (
    -- Eigene Anlagen (für eingeloggte User)
    (auth.uid() IS NOT NULL AND mitglied_id IN (SELECT id FROM mitglieder WHERE email = auth.email()))
    OR
    -- Öffentlich freigegebene Anlagen (für alle, auch anonyme Benutzer)
    id IN (
      SELECT anlage_id
      FROM anlagen_freigaben
      WHERE profil_oeffentlich = true
    )
  );

-- 2. Policy für öffentliche Freigaben (alle können öffentliche lesen)
-- Entferne alte restriktive Policies
DROP POLICY IF EXISTS "Users can view own anlagen_freigaben" ON anlagen_freigaben;
DROP POLICY IF EXISTS "anlagen_freigaben_select" ON anlagen_freigaben;
DROP POLICY IF EXISTS "anlagen_freigaben_public_select" ON anlagen_freigaben;

-- Erstelle neue flexible Policy
CREATE POLICY "anlagen_freigaben_select" ON anlagen_freigaben
  FOR SELECT
  USING (
    -- Eigene Freigaben (für eingeloggte User)
    (auth.uid() IS NOT NULL AND anlage_id IN (
      SELECT a.id FROM anlagen a
      JOIN mitglieder m ON m.id = a.mitglied_id
      WHERE m.email = auth.email()
    ))
    OR
    -- Öffentliche Freigaben (für alle)
    profil_oeffentlich = true
  );

-- 3. Policy für Mitgliederdaten (nur öffentlich sichtbar wenn Anlage öffentlich)
-- Entferne alte restriktive Policies
DROP POLICY IF EXISTS "Users can view own data" ON mitglieder;
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;
DROP POLICY IF EXISTS "mitglieder_public_select" ON mitglieder;

-- Erstelle neue flexible Policy
CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    -- Eigene Daten (für eingeloggte User)
    (auth.uid() IS NOT NULL AND email = auth.email())
    OR
    -- Mitgliederdaten wenn mindestens eine Anlage öffentlich ist
    EXISTS (
      SELECT 1
      FROM anlagen a
      JOIN anlagen_freigaben af ON af.anlage_id = a.id
      WHERE a.mitglied_id = mitglieder.id
        AND af.profil_oeffentlich = true
    )
  );

-- Verifizierung: Zeige alle Policies
SELECT
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN roles = '{}'::name[] THEN 'all roles'
    ELSE roles::text
  END as applies_to
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('anlagen', 'anlagen_freigaben', 'mitglieder')
ORDER BY tablename, cmd, policyname;

-- Test: Öffentliche Anlagen ohne Login abrufen
-- (Diese Query sollte funktionieren auch wenn nicht eingeloggt)
SELECT
  a.id,
  a.anlagenname,
  a.leistung_kwp,
  af.profil_oeffentlich,
  m.vorname,
  m.ort
FROM anlagen a
INNER JOIN anlagen_freigaben af ON af.anlage_id = a.id
INNER JOIN mitglieder m ON m.id = a.mitglied_id
WHERE a.aktiv = true
  AND af.profil_oeffentlich = true
LIMIT 5;
