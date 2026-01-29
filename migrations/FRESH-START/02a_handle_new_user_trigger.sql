-- ============================================
-- MIGRATION 02a: Handle New User Trigger
-- ============================================
-- Datum: 2026-01-29
-- Beschreibung: Erstellt automatisch Mitglied-Eintrag wenn Auth User erstellt wird
-- ============================================

-- Funktion: Erstellt Mitglied-Eintrag bei neuem Auth User
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mitglieder (
    auth_user_id,
    email,
    vorname,
    nachname
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'vorname', 'Neuer'),
    COALESCE(NEW.raw_user_meta_data->>'nachname', 'Benutzer')
  );

  RETURN NEW;
END;
$$;

-- Trigger: Feuert bei INSERT auf auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Kommentare
COMMENT ON FUNCTION public.handle_new_user() IS 'Erstellt automatisch Mitglied-Eintrag wenn ein neuer Auth User registriert wird';

-- Verifizierung
DO $$
BEGIN
  RAISE NOTICE '✅ handle_new_user Trigger erfolgreich erstellt';
END $$;
