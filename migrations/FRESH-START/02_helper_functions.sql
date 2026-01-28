-- ============================================
-- MIGRATION 02: Helper Functions
-- ============================================
-- Datum: 2026-01-28
-- Beschreibung: Helper Functions für RLS Policies
-- ============================================

-- Aktuellen Auth User ID
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

COMMENT ON FUNCTION auth_user_id IS 'Returns current authenticated user ID from Supabase Auth';

-- Mitglied-ID des aktuellen Users
CREATE OR REPLACE FUNCTION current_mitglied_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM mitglieder WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION current_mitglied_id IS 'Returns mitglied_id of current authenticated user';

-- Prüfe ob User Zugriff auf Anlage hat
CREATE OR REPLACE FUNCTION user_owns_anlage(p_anlage_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM anlagen
    WHERE id = p_anlage_id
      AND mitglied_id = current_mitglied_id()
  );
$$;

COMMENT ON FUNCTION user_owns_anlage IS 'Checks if current user owns the specified anlage';

-- Prüfe ob Anlage öffentlich ist
CREATE OR REPLACE FUNCTION anlage_is_public(p_anlage_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT oeffentlich FROM anlagen WHERE id = p_anlage_id;
$$;

COMMENT ON FUNCTION anlage_is_public IS 'Checks if anlage is public';

-- Grant Permissions
GRANT EXECUTE ON FUNCTION auth_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION current_mitglied_id() TO authenticated;
GRANT EXECUTE ON FUNCTION user_owns_anlage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION anlage_is_public(uuid) TO authenticated, anon;

-- Verifizierung
DO $$
BEGIN
  RAISE NOTICE 'Helper functions created successfully';
END $$;
