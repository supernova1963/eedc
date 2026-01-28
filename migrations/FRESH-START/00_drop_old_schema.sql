-- ============================================
-- MIGRATION 00: Drop Old Schema
-- ============================================
-- Datum: 2026-01-28
-- Beschreibung: Löscht alle alten Tabellen für sauberen Neustart
-- WARNUNG: Alle Daten werden gelöscht!
-- ============================================

-- Drop in umgekehrter Reihenfolge (wegen Foreign Keys)

-- Views
DROP VIEW IF EXISTS monatsdaten_erweitert CASCADE;
DROP VIEW IF EXISTS investitionen_uebersicht CASCADE;
DROP VIEW IF EXISTS anlagen_komplett CASCADE;
DROP VIEW IF EXISTS strompreise_aktuell CASCADE;

-- Functions
DROP FUNCTION IF EXISTS get_public_anlagen_with_members() CASCADE;
DROP FUNCTION IF EXISTS get_strompreis(uuid, uuid, date, text) CASCADE;
DROP FUNCTION IF EXISTS berechne_monatliche_einsparung(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS co2_zu_baeume(numeric) CASCADE;
DROP FUNCTION IF EXISTS aktualisiere_investition_kennzahlen(uuid) CASCADE;

-- Data Tables
DROP TABLE IF EXISTS wetterdaten CASCADE;
DROP TABLE IF EXISTS investition_monatsdaten CASCADE;
DROP TABLE IF EXISTS investition_kennzahlen CASCADE;
DROP TABLE IF EXISTS anlagen_kennzahlen CASCADE;
DROP TABLE IF EXISTS investitionen CASCADE;
DROP TABLE IF EXISTS alternative_investitionen CASCADE;
DROP TABLE IF EXISTS monatsdaten CASCADE;
DROP TABLE IF EXISTS anlagen_freigaben CASCADE;
DROP TABLE IF EXISTS anlagen CASCADE;
DROP TABLE IF EXISTS strompreise CASCADE;
DROP TABLE IF EXISTS investitionstyp_config CASCADE;
DROP TABLE IF EXISTS investitionstypen CASCADE;
DROP TABLE IF EXISTS mitglieder CASCADE;

-- Types
DROP TYPE IF EXISTS anlage_typ CASCADE;
DROP TYPE IF EXISTS investitionstyp CASCADE;

-- Alte Functions (falls vorhanden)
DROP FUNCTION IF EXISTS auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS current_mitglied_id() CASCADE;
DROP FUNCTION IF EXISTS user_owns_anlage(uuid) CASCADE;
DROP FUNCTION IF EXISTS anlage_is_public(uuid) CASCADE;

COMMENT ON SCHEMA public IS 'Old schema dropped - ready for fresh start';

-- Verifizierung
DO $$
BEGIN
  RAISE NOTICE 'Old schema dropped successfully. Ready for fresh start.';
END $$;
