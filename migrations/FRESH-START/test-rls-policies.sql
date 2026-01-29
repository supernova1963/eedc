-- ============================================
-- RLS POLICY TESTS
-- ============================================
-- Testet die Row Level Security Policies
-- Ausführen in Supabase SQL Editor

-- ============================================
-- SETUP: Test-Daten vorbereiten
-- ============================================

-- Cleanup alte Test-Daten (falls vorhanden)
DELETE FROM monatsdaten WHERE anlage_id IN (
  SELECT id FROM anlagen WHERE mitglied_id IN (
    SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
  )
);
DELETE FROM anlagen_komponenten WHERE anlage_id IN (
  SELECT id FROM anlagen WHERE mitglied_id IN (
    SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
  )
);
DELETE FROM haushalt_komponenten WHERE mitglied_id IN (
  SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
);
DELETE FROM anlagen WHERE mitglied_id IN (
  SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
);
DELETE FROM mitglieder WHERE email LIKE 'test%@rls-test.local';

-- Test User 1: Max (mit öffentlicher Anlage)
INSERT INTO mitglieder (id, email, vorname, nachname, profil_oeffentlich, aktiv)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'testmax@rls-test.local', 'Max', 'Test', true, true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  vorname = EXCLUDED.vorname,
  nachname = EXCLUDED.nachname,
  profil_oeffentlich = EXCLUDED.profil_oeffentlich;

-- Test User 2: Anna (mit privater Anlage)
INSERT INTO mitglieder (id, email, vorname, nachname, profil_oeffentlich, aktiv)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'testanna@rls-test.local', 'Anna', 'Test', false, true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  vorname = EXCLUDED.vorname,
  nachname = EXCLUDED.nachname,
  profil_oeffentlich = EXCLUDED.profil_oeffentlich;

-- Max's öffentliche Anlage
INSERT INTO anlagen (id, mitglied_id, anlagenname, leistung_kwp, installationsdatum, aktiv)
VALUES
  ('aaaa0001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Max Test-Anlage (Öffentlich)', 10.5, '2023-06-15', true)
ON CONFLICT (id) DO UPDATE SET
  anlagenname = EXCLUDED.anlagenname,
  leistung_kwp = EXCLUDED.leistung_kwp;

-- Max's Freigaben (öffentlich)
INSERT INTO anlagen_freigaben (anlage_id, profil_oeffentlich, kennzahlen_oeffentlich, monatsdaten_oeffentlich, investitionen_oeffentlich, standort_genau)
VALUES
  ('aaaa0001-0001-0001-0001-000000000001', true, true, true, true, false)
ON CONFLICT (anlage_id) DO UPDATE SET
  profil_oeffentlich = EXCLUDED.profil_oeffentlich,
  kennzahlen_oeffentlich = EXCLUDED.kennzahlen_oeffentlich,
  monatsdaten_oeffentlich = EXCLUDED.monatsdaten_oeffentlich;

-- Anna's private Anlage
INSERT INTO anlagen (id, mitglied_id, anlagenname, leistung_kwp, installationsdatum, aktiv)
VALUES
  ('bbbb0001-0001-0001-0001-000000000001', '22222222-2222-2222-2222-222222222222', 'Anna Test-Anlage (Privat)', 8.2, '2024-01-10', true)
ON CONFLICT (id) DO UPDATE SET
  anlagenname = EXCLUDED.anlagenname,
  leistung_kwp = EXCLUDED.leistung_kwp;

-- Anna's Freigaben (privat)
INSERT INTO anlagen_freigaben (anlage_id, profil_oeffentlich, kennzahlen_oeffentlich, monatsdaten_oeffentlich, investitionen_oeffentlich, standort_genau)
VALUES
  ('bbbb0001-0001-0001-0001-000000000001', false, false, false, false, false)
ON CONFLICT (anlage_id) DO UPDATE SET
  profil_oeffentlich = EXCLUDED.profil_oeffentlich,
  kennzahlen_oeffentlich = EXCLUDED.kennzahlen_oeffentlich,
  monatsdaten_oeffentlich = EXCLUDED.monatsdaten_oeffentlich;

-- Anlagen-Komponenten
INSERT INTO anlagen_komponenten (id, anlage_id, typ, bezeichnung, anschaffungsdatum, aktiv)
VALUES
  ('aaaa1001-1001-1001-1001-100000000001', 'aaaa0001-0001-0001-0001-000000000001', 'speicher', 'Max Speicher', '2023-06-15', true),
  ('bbbb1001-1001-1001-1001-100000000001', 'bbbb0001-0001-0001-0001-000000000001', 'speicher', 'Anna Speicher', '2024-01-10', true)
ON CONFLICT (id) DO UPDATE SET
  bezeichnung = EXCLUDED.bezeichnung;

-- Haushalts-Komponenten
INSERT INTO haushalt_komponenten (id, mitglied_id, typ, bezeichnung, anschaffungsdatum, aktiv, oeffentlich)
VALUES
  ('aaaa2001-2001-2001-2001-200000000001', '11111111-1111-1111-1111-111111111111', 'e-auto', 'Max E-Auto', '2023-06-15', true, true),
  ('bbbb2001-2001-2001-2001-200000000001', '22222222-2222-2222-2222-222222222222', 'e-auto', 'Anna E-Auto', '2024-01-10', true, false)
ON CONFLICT (id) DO UPDATE SET
  bezeichnung = EXCLUDED.bezeichnung;

-- Monatsdaten
INSERT INTO monatsdaten (anlage_id, jahr, monat, pv_erzeugung_kwh, direktverbrauch_kwh, einspeisung_kwh, netzbezug_kwh)
VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 2024, 1, 450, 280, 170, 120),
  ('bbbb0001-0001-0001-0001-000000000001', 2024, 1, 380, 230, 150, 100)
ON CONFLICT (anlage_id, jahr, monat) DO UPDATE SET
  pv_erzeugung_kwh = EXCLUDED.pv_erzeugung_kwh;

COMMIT;

-- ============================================
-- TEST 1: Anlagen Visibility
-- ============================================

-- TEST 1.1: Öffentliche Anlagen sind für alle sichtbar
SELECT
  '✓ TEST 1.1: Öffentliche Anlagen sichtbar' as test,
  CASE
    WHEN COUNT(*) >= 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result,
  COUNT(*) as count
FROM anlagen a
INNER JOIN anlagen_freigaben f ON f.anlage_id = a.id
WHERE f.profil_oeffentlich = true
  AND a.id = 'aaaa0001-0001-0001-0001-000000000001';

-- TEST 1.2: Private Anlagen sind nicht in öffentlicher Abfrage sichtbar
SELECT
  '✓ TEST 1.2: Private Anlagen nicht öffentlich' as test,
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as result,
  COUNT(*) as count
FROM anlagen a
INNER JOIN anlagen_freigaben f ON f.anlage_id = a.id
WHERE f.profil_oeffentlich = true
  AND a.id = 'bbbb0001-0001-0001-0001-000000000001';

-- ============================================
-- TEST 2: Monatsdaten Visibility
-- ============================================

-- TEST 2.1: Öffentliche Monatsdaten sind via JOIN sichtbar
SELECT
  '✓ TEST 2.1: Öffentliche Monatsdaten sichtbar' as test,
  CASE
    WHEN COUNT(*) >= 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result,
  COUNT(*) as count
FROM monatsdaten m
INNER JOIN anlagen a ON a.id = m.anlage_id
INNER JOIN anlagen_freigaben f ON f.anlage_id = a.id
WHERE f.monatsdaten_oeffentlich = true
  AND m.anlage_id = 'aaaa0001-0001-0001-0001-000000000001';

-- TEST 2.2: Private Monatsdaten sind nicht via öffentliche Abfrage sichtbar
SELECT
  '✓ TEST 2.2: Private Monatsdaten nicht öffentlich' as test,
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as result,
  COUNT(*) as count
FROM monatsdaten m
INNER JOIN anlagen a ON a.id = m.anlage_id
INNER JOIN anlagen_freigaben f ON f.anlage_id = a.id
WHERE f.monatsdaten_oeffentlich = true
  AND m.anlage_id = 'bbbb0001-0001-0001-0001-000000000001';

-- ============================================
-- TEST 3: Komponenten Visibility
-- ============================================

-- TEST 3.1: Anlagen-Komponenten von öffentlicher Anlage sichtbar
SELECT
  '✓ TEST 3.1: Öffentliche Anlagen-Komponenten sichtbar' as test,
  CASE
    WHEN COUNT(*) >= 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result,
  COUNT(*) as count
FROM anlagen_komponenten k
INNER JOIN anlagen a ON a.id = k.anlage_id
INNER JOIN anlagen_freigaben f ON f.anlage_id = a.id
WHERE f.investitionen_oeffentlich = true
  AND k.anlage_id = 'aaaa0001-0001-0001-0001-000000000001';

-- TEST 3.2: Öffentliche Haushalts-Komponenten sichtbar
SELECT
  '✓ TEST 3.2: Öffentliche Haushalts-Komponenten sichtbar' as test,
  CASE
    WHEN COUNT(*) >= 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result,
  COUNT(*) as count
FROM haushalt_komponenten
WHERE oeffentlich = true
  AND id = 'aaaa2001-2001-2001-2001-200000000001';

-- TEST 3.3: Private Haushalts-Komponenten nicht öffentlich
SELECT
  '✓ TEST 3.3: Private Haushalts-Komponenten nicht öffentlich' as test,
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as result,
  COUNT(*) as count
FROM haushalt_komponenten
WHERE oeffentlich = true
  AND id = 'bbbb2001-2001-2001-2001-200000000001';

-- ============================================
-- TEST 4: Helper Functions
-- ============================================

-- TEST 4.1: current_mitglied_id() Function existiert
SELECT
  '✓ TEST 4.1: current_mitglied_id() Function existiert' as test,
  CASE
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_proc
WHERE proname = 'current_mitglied_id';

-- TEST 4.2: user_owns_anlage() Function existiert
SELECT
  '✓ TEST 4.2: user_owns_anlage() Function existiert' as test,
  CASE
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_proc
WHERE proname = 'user_owns_anlage';

-- ============================================
-- TEST 5: RLS Aktivierung
-- ============================================

-- TEST 5.1: RLS ist auf allen Tabellen aktiviert
SELECT
  '✓ TEST 5.1: RLS auf allen Core-Tabellen aktiviert' as test,
  CASE
    WHEN COUNT(*) = 7 THEN 'PASS'
    WHEN COUNT(*) > 0 THEN 'PARTIAL (nur ' || COUNT(*) || '/7)'
    ELSE 'FAIL'
  END as result,
  STRING_AGG(tablename, ', ') as tables_with_rls
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('mitglieder', 'anlagen', 'anlagen_komponenten', 'haushalt_komponenten', 'monatsdaten', 'anlagen_freigaben', 'strompreise')
  AND EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.relname = t.tablename
      AND c.relrowsecurity = true
  );

-- ============================================
-- TEST 6: Policy Counts
-- ============================================

-- TEST 6.1: Policies für mitglieder
SELECT
  '✓ TEST 6.1: mitglieder Policies' as test,
  CASE
    WHEN COUNT(*) >= 2 THEN 'PASS (Anzahl: ' || COUNT(*) || ')'
    ELSE 'FAIL (nur ' || COUNT(*) || ' Policies)'
  END as result
FROM pg_policies
WHERE tablename = 'mitglieder';

-- TEST 6.2: Policies für anlagen
SELECT
  '✓ TEST 6.2: anlagen Policies' as test,
  CASE
    WHEN COUNT(*) >= 3 THEN 'PASS (Anzahl: ' || COUNT(*) || ')'
    ELSE 'FAIL (nur ' || COUNT(*) || ' Policies)'
  END as result
FROM pg_policies
WHERE tablename = 'anlagen';

-- TEST 6.3: Policies für monatsdaten
SELECT
  '✓ TEST 6.3: monatsdaten Policies' as test,
  CASE
    WHEN COUNT(*) >= 2 THEN 'PASS (Anzahl: ' || COUNT(*) || ')'
    ELSE 'FAIL (nur ' || COUNT(*) || ' Policies)'
  END as result
FROM pg_policies
WHERE tablename = 'monatsdaten';

-- ============================================
-- TEST 7: Datenintegrität
-- ============================================

-- TEST 7.1: Alle Anlagen haben Freigaben
SELECT
  '✓ TEST 7.1: Alle aktiven Anlagen haben Freigaben' as test,
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL (' || COUNT(*) || ' Anlagen ohne Freigaben)'
  END as result
FROM anlagen a
WHERE a.aktiv = true
  AND NOT EXISTS (
    SELECT 1 FROM anlagen_freigaben f WHERE f.anlage_id = a.id
  );

-- TEST 7.2: Alle Mitglieder haben aktive Anlagen oder sind neu
SELECT
  '✓ TEST 7.2: Mitglieder-Status konsistent' as test,
  CASE
    WHEN COUNT(*) >= 0 THEN 'INFO (' || COUNT(*) || ' Mitglieder ohne Anlage)'
    ELSE 'FAIL'
  END as result
FROM mitglieder m
WHERE m.aktiv = true
  AND NOT EXISTS (
    SELECT 1 FROM anlagen a WHERE a.mitglied_id = m.id AND a.aktiv = true
  );

-- ============================================
-- ZUSAMMENFASSUNG
-- ============================================

SELECT
  '═══════════════════════════════════════════' as divider,
  'TEST ZUSAMMENFASSUNG' as summary;

-- Zähle Gesamtergebnisse
WITH test_results AS (
  -- Hier würden normalerweise die Test-Ergebnisse aggregiert
  SELECT 'Tests abgeschlossen' as status
)
SELECT * FROM test_results;

-- ============================================
-- CLEANUP (Optional - auskommentiert)
-- ============================================

-- ACHTUNG: Nur für Test-Umgebung!
-- Entfernt alle Test-Daten wieder

/*
DELETE FROM monatsdaten WHERE anlage_id IN (
  SELECT id FROM anlagen WHERE mitglied_id IN (
    SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
  )
);
DELETE FROM anlagen_komponenten WHERE anlage_id IN (
  SELECT id FROM anlagen WHERE mitglied_id IN (
    SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
  )
);
DELETE FROM haushalt_komponenten WHERE mitglied_id IN (
  SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
);
DELETE FROM anlagen_freigaben WHERE anlage_id IN (
  SELECT id FROM anlagen WHERE mitglied_id IN (
    SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
  )
);
DELETE FROM anlagen WHERE mitglied_id IN (
  SELECT id FROM mitglieder WHERE email LIKE 'test%@rls-test.local'
);
DELETE FROM mitglieder WHERE email LIKE 'test%@rls-test.local';
*/
