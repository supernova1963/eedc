-- ============================================
-- FIX: Infinite Recursion - SICHERE LÖSUNG
-- ============================================
-- Problem: Zirkelbezug zwischen mitglieder und anlagen
-- Lösung: RLS AUSSCHALTEN für öffentliche Community-Queries
-- ============================================

-- SCHRITT 1: Vereinfache mitglieder Policy (NUR eigene Daten)
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;

CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    -- NUR eigene Daten
    email = auth.email()
  );

-- SCHRITT 2: Vereinfache anlagen Policy (entferne mitglieder-Subquery)
DROP POLICY IF EXISTS "anlagen_select" ON anlagen;

CREATE POLICY "anlagen_select" ON anlagen
  FOR SELECT
  USING (
    -- Eigene Anlagen: Prüfe direkt auth.email() gegen die email in der mitglieder-Tabelle
    -- ABER: Nutze eine direkte Abfrage ohne Subquery
    EXISTS (
      SELECT 1 FROM mitglieder m
      WHERE m.id = anlagen.mitglied_id
        AND m.email = auth.email()
    )
    OR
    -- Öffentlich freigegebene Anlagen (für alle)
    id IN (
      SELECT anlage_id
      FROM anlagen_freigaben
      WHERE profil_oeffentlich = true
    )
  );

-- HINWEIS: Das Problem war:
-- - anlagen Policy hatte: mitglied_id IN (SELECT id FROM mitglieder WHERE ...)
-- - mitglieder Policy hatte: EXISTS (SELECT FROM anlagen WHERE ...)
-- → Zirkelbezug!
--
-- Neue Lösung:
-- - anlagen Policy: EXISTS (SELECT FROM mitglieder WHERE ...) - OK, einseitig
-- - mitglieder Policy: Nur email = auth.email() - Kein Bezug zu anlagen!
-- → KEIN Zirkelbezug mehr!

-- Verifizierung
SELECT
  'mitglieder' as tabelle,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'mitglieder'

UNION ALL

SELECT
  'anlagen' as tabelle,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'anlagen'
ORDER BY tabelle, operation, policyname;
