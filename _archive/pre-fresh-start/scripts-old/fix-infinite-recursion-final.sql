-- ============================================
-- FIX: Infinite Recursion - FINALE LÖSUNG
-- ============================================
-- Problem: Zirkelbezug zwischen mitglieder und anlagen Policies
-- Lösung: Security Definer Function für öffentliche Daten
-- ============================================

-- SCHRITT 1: Vereinfache ALLE Policies (entferne Zirkelbezüge)

-- 1.1 Mitglieder: NUR eigene Daten
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;

CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (email = auth.email());

-- 1.2 Anlagen: Eigene + Öffentliche (ohne mitglieder-Subquery!)
DROP POLICY IF EXISTS "anlagen_select" ON anlagen;

CREATE POLICY "anlagen_select" ON anlagen
  FOR SELECT
  USING (
    -- Öffentlich freigegebene Anlagen (für alle, auch anonymous)
    id IN (
      SELECT anlage_id
      FROM anlagen_freigaben
      WHERE profil_oeffentlich = true
    )
    OR
    -- ODER: User ist authentifiziert UND anlage gehört zu einem Mitglied mit gleicher Email
    -- Wichtig: Subquery auf mitglieder, aber mitglieder hat KEINE Subquery auf anlagen!
    (auth.uid() IS NOT NULL AND mitglied_id IN (
      SELECT id FROM mitglieder WHERE email = auth.email()
    ))
  );

-- SCHRITT 2: Erstelle Security Definer Function für öffentliche Community-Daten
-- Diese Function umgeht RLS und gibt direkt öffentliche Mitgliederdaten zurück

CREATE OR REPLACE FUNCTION get_public_anlagen_with_members()
RETURNS TABLE (
  anlage_id uuid,
  anlagenname text,
  anlagentyp text,
  installationsdatum date,
  leistung_kwp numeric,
  standort_ort text,
  standort_plz text,
  mitglied_vorname text,
  mitglied_nachname text,
  mitglied_ort text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    a.id as anlage_id,
    a.anlagenname,
    a.anlagentyp,
    a.installationsdatum,
    a.leistung_kwp,
    a.standort_ort,
    a.standort_plz,
    m.vorname as mitglied_vorname,
    m.nachname as mitglied_nachname,
    m.ort as mitglied_ort
  FROM anlagen a
  INNER JOIN anlagen_freigaben af ON af.anlage_id = a.id
  INNER JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.aktiv = true
    AND af.profil_oeffentlich = true
  ORDER BY a.erstellt_am DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_public_anlagen_with_members() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_anlagen_with_members() TO anon;

-- SCHRITT 3: Verifizierung

-- 3.1 Zeige Policies
SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename IN ('mitglieder', 'anlagen', 'anlagen_freigaben')
ORDER BY tablename, cmd, policyname;

-- 3.2 Teste Function (sollte öffentliche Anlagen zurückgeben)
SELECT * FROM get_public_anlagen_with_members() LIMIT 5;

-- ============================================
-- HINWEISE FÜR DIE ANWENDUNG
-- ============================================
--
-- Für PRIVATE Queries (eigene Daten):
--   → Nutze normale Supabase Queries (RLS aktiv)
--   → Beispiel: supabase.from('mitglieder').select('*').eq('email', user.email)
--
-- Für ÖFFENTLICHE Community-Queries:
--   → Nutze die Security Definer Function
--   → Beispiel: supabase.rpc('get_public_anlagen_with_members')
--
-- Das vermeidet Zirkelbezüge und ist performanter!
