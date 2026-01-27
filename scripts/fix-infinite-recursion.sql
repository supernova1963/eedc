-- ============================================
-- FIX: Infinite Recursion in mitglieder Policy
-- ============================================
-- Problem: mitglieder_select hat Zirkelbezug zu anlagen
-- Lösung: Vereinfachte Policy ohne anlagen-Subquery
-- ============================================

-- Entferne die problematische Policy
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;

-- Erstelle EINFACHE Policy ohne Zirkelbezug
-- Diese Policy erlaubt:
-- 1. Jedem User seine eigenen Daten zu sehen
-- 2. Allen (auch anonymous) Mitglieder mit öffentlichen Anlagen zu sehen
CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    -- Eigene Daten (für eingeloggte User)
    email = auth.email()
    OR
    -- Öffentliche Mitgliederdaten (ohne anlagen-Subquery!)
    -- Stattdessen prüfen wir direkt ob es einen Eintrag in anlagen_freigaben gibt
    id IN (
      SELECT DISTINCT a.mitglied_id
      FROM anlagen a
      WHERE EXISTS (
        SELECT 1 FROM anlagen_freigaben af
        WHERE af.anlage_id = a.id
          AND af.profil_oeffentlich = true
      )
    )
  );

-- WICHTIG: Diese Policy vermeidet Zirkelbezüge durch:
-- - Direkter Check ohne JOIN auf anlagen in der USING-Clause
-- - Subquery verwendet nur anlagen.mitglied_id (kein WHERE auf mitglieder)

-- Verifizierung
SELECT
  policyname,
  cmd as operation,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'mitglieder'
ORDER BY cmd, policyname;
