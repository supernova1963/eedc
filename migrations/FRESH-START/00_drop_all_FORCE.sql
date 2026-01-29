-- ============================================
-- MIGRATION 00: Drop ALL - FORCE VERSION
-- ============================================
-- Datum: 2026-01-29
-- Beschreibung: Löscht ALLE Tabellen mit CASCADE - sehr aggressiv!
-- WARNUNG: Alle Daten werden gelöscht!
-- ============================================

-- Deaktiviere RLS auf allen Tabellen zuerst
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'ALTER TABLE IF EXISTS ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- Lösche alle Policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) ||
            ' ON ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

-- Lösche alle Views
DROP VIEW IF EXISTS monatsdaten_erweitert CASCADE;
DROP VIEW IF EXISTS investitionen_uebersicht CASCADE;
DROP VIEW IF EXISTS anlagen_komplett CASCADE;
DROP VIEW IF EXISTS strompreise_aktuell CASCADE;

-- Lösche alle Functions
DROP FUNCTION IF EXISTS get_public_anlagen() CASCADE;
DROP FUNCTION IF EXISTS get_community_stats() CASCADE;
DROP FUNCTION IF EXISTS get_public_anlage_details(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_public_monatsdaten(uuid) CASCADE;
DROP FUNCTION IF EXISTS search_public_anlagen(text, text, numeric, numeric, boolean, boolean) CASCADE;
DROP FUNCTION IF EXISTS get_public_anlagen_with_members() CASCADE;
DROP FUNCTION IF EXISTS get_strompreis(uuid, uuid, date, text) CASCADE;
DROP FUNCTION IF EXISTS berechne_monatliche_einsparung(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS co2_zu_baeume(numeric) CASCADE;
DROP FUNCTION IF EXISTS aktualisiere_investition_kennzahlen(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS current_mitglied_id() CASCADE;
DROP FUNCTION IF EXISTS user_owns_anlage(uuid) CASCADE;
DROP FUNCTION IF EXISTS anlage_is_public(uuid) CASCADE;

-- Lösche alle Tabellen mit CASCADE (automatisch in richtiger Reihenfolge)
DROP TABLE IF EXISTS wetterdaten CASCADE;
DROP TABLE IF EXISTS investition_monatsdaten CASCADE;
DROP TABLE IF EXISTS investition_kennzahlen CASCADE;
DROP TABLE IF EXISTS anlagen_kennzahlen CASCADE;
DROP TABLE IF EXISTS komponenten_monatsdaten CASCADE;
DROP TABLE IF EXISTS investitionen CASCADE;
DROP TABLE IF EXISTS alternative_investitionen CASCADE;
DROP TABLE IF EXISTS monatsdaten CASCADE;
DROP TABLE IF EXISTS anlagen_freigaben CASCADE;
DROP TABLE IF EXISTS anlagen_komponenten CASCADE;
DROP TABLE IF EXISTS haushalt_komponenten CASCADE;
DROP TABLE IF EXISTS anlagen CASCADE;
DROP TABLE IF EXISTS strompreise CASCADE;
DROP TABLE IF EXISTS investitionstyp_config CASCADE;
DROP TABLE IF EXISTS investitionstypen CASCADE;
DROP TABLE IF EXISTS komponenten_typen CASCADE;
DROP TABLE IF EXISTS mitglieder CASCADE;

-- Lösche Types
DROP TYPE IF EXISTS anlage_typ CASCADE;
DROP TYPE IF EXISTS investitionstyp CASCADE;

-- Finale Verifizierung: Lösche wirklich ALLE Tabellen im public Schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
  ) LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    RAISE NOTICE 'Dropped table: %', r.tablename;
  END LOOP;
END $$;

-- Verifizierung
DO $$
DECLARE
  table_count integer;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

  IF table_count = 0 THEN
    RAISE NOTICE '✅ ALL tables dropped successfully. Database is clean. Tables remaining: 0';
  ELSE
    RAISE WARNING '⚠️ Some tables still exist. Count: %', table_count;
  END IF;
END $$;
