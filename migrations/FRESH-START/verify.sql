-- ============================================
-- VERIFICATION: Check Migration Success
-- ============================================
-- Datum: 2026-01-28
-- Beschreibung: Verifiziert dass Migration erfolgreich war
-- ============================================

DO $$ BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'VERIFICATION REPORT';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
END $$;

-- 1. Tabellen-Check
DO $$ BEGIN
  RAISE NOTICE '1. TABLES CHECK';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  'Tables created: ' || COUNT(*) as check_result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- Expected: 9 Tabellen

-- Liste alle Tabellen
SELECT
  table_name,
  CASE
    WHEN table_name IN ('mitglieder', 'anlagen', 'anlagen_komponenten', 'haushalt_komponenten', 'monatsdaten', 'komponenten_monatsdaten', 'anlagen_kennzahlen', 'komponenten_typen', 'strompreise')
    THEN '✓ OK'
    ELSE '✗ UNEXPECTED'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Functions-Check
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '2. FUNCTIONS CHECK';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  'Functions created: ' || COUNT(*) as check_result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('auth_user_id', 'current_mitglied_id', 'user_owns_anlage', 'anlage_is_public', 'get_public_anlagen', 'get_community_stats', 'get_public_anlage_details');

-- Expected: 7 Functions (4 helper + 3 community)

-- Liste alle Functions
SELECT
  p.proname as function_name,
  CASE
    WHEN p.proname IN ('auth_user_id', 'current_mitglied_id', 'user_owns_anlage', 'anlage_is_public', 'get_public_anlagen', 'get_community_stats', 'get_public_anlage_details')
    THEN '✓ OK'
    ELSE '✗ UNEXPECTED'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 3. RLS-Check
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '3. RLS (ROW LEVEL SECURITY) CHECK';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✓ ENABLED' ELSE '✗ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected: RLS enabled für alle außer komponenten_typen

-- 4. Policies-Check
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '4. POLICIES CHECK';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  'Total policies: ' || COUNT(*) as check_result
FROM pg_policies
WHERE schemaname = 'public';

-- Expected: ~30+ Policies

-- Policies pro Tabelle
SELECT
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(cmd::text, ', ' ORDER BY cmd) as operations
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 5. Seed Data Check
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '5. SEED DATA CHECK';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  'Komponenten-Typen: ' || COUNT(*) as count
FROM komponenten_typen;

-- Expected: 10

SELECT
  'Globale Strompreise: ' || COUNT(*) as count
FROM strompreise
WHERE mitglied_id IS NULL;

-- Expected: 3

-- 6. Test Data Check
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '6. TEST DATA CHECK';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  'Test-Mitglieder: ' || COUNT(*) as count
FROM mitglieder;

SELECT
  'Test-Anlagen: ' || COUNT(*) as count
FROM anlagen;

SELECT
  'Test-Monatsdaten: ' || COUNT(*) as count
FROM monatsdaten;

-- 7. Foreign Keys Check
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '7. FOREIGN KEYS CHECK';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  COUNT(*) as foreign_key_count
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_type = 'FOREIGN KEY';

-- Expected: ~15+ Foreign Keys

-- 8. Indexes Check
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '8. INDEXES CHECK';
  RAISE NOTICE '----------------------------------------';
END $$;

SELECT
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public';

-- Expected: ~30+ Indexes

-- 9. Sample Queries (Should not error)
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '9. SAMPLE QUERIES TEST';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Testing basic SELECTs...';
END $$;

SELECT 'mitglieder: ' || COUNT(*) FROM mitglieder;
SELECT 'anlagen: ' || COUNT(*) FROM anlagen;
SELECT 'komponenten_typen: ' || COUNT(*) FROM komponenten_typen;

-- 10. RLS Test (Basic)
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '10. RLS BASIC TEST';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Testing as anonymous user...';
END $$;

SET ROLE anon;

SELECT
  'Anonymous can access komponenten_typen: ' ||
  CASE WHEN COUNT(*) > 0 THEN '✓ YES' ELSE '✗ NO' END as test_result
FROM komponenten_typen;

RESET ROLE;

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'VERIFICATION COMPLETE';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Review the checks above';
  RAISE NOTICE '2. All tables should be created (9 expected)';
  RAISE NOTICE '3. All functions should exist (7 expected)';
  RAISE NOTICE '4. RLS should be enabled on most tables';
  RAISE NOTICE '5. Policies should exist (~30+ expected)';
  RAISE NOTICE '6. If test data was created, consider removing for production';
  RAISE NOTICE '';
  RAISE NOTICE 'If any checks failed, review the migration logs.';
  RAISE NOTICE '';
END $$;
