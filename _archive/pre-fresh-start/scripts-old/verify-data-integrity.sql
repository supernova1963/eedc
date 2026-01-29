-- Data Integrity Verification Script
-- Führen Sie dieses Script regelmäßig aus, um Datenintegrität zu prüfen

-- ============================================
-- 1. VERWAISTE ANLAGEN
-- ============================================
SELECT
  '❌ Verwaiste Anlagen (ohne gültigen Owner)' as check_name,
  COUNT(*) as anzahl_probleme
FROM anlagen a
LEFT JOIN mitglieder m ON a.mitglied_id = m.id
WHERE a.mitglied_id IS NULL OR m.id IS NULL;

-- Details anzeigen:
SELECT
  a.id,
  a.anlagenname,
  a.mitglied_id,
  a.erstellt_am,
  'Kein gültiger Owner' as problem
FROM anlagen a
LEFT JOIN mitglieder m ON a.mitglied_id = m.id
WHERE a.mitglied_id IS NULL OR m.id IS NULL;

-- ============================================
-- 2. VERWAISTE MONATSDATEN
-- ============================================
SELECT
  '❌ Verwaiste Monatsdaten' as check_name,
  COUNT(*) as anzahl_probleme
FROM monatsdaten md
WHERE md.anlage_id NOT IN (SELECT id FROM anlagen);

-- ============================================
-- 3. VERWAISTE INVESTITIONEN
-- ============================================
SELECT
  '❌ Verwaiste Investitionen' as check_name,
  COUNT(*) as anzahl_probleme
FROM investitionen i
WHERE i.anlage_id NOT IN (SELECT id FROM anlagen);

-- ============================================
-- 4. FREIGABEN OHNE ANLAGE
-- ============================================
SELECT
  '❌ Freigaben ohne Anlage' as check_name,
  COUNT(*) as anzahl_probleme
FROM anlagen_freigaben af
WHERE af.anlage_id NOT IN (SELECT id FROM anlagen);

-- ============================================
-- 5. ANLAGEN OHNE FREIGABEN
-- ============================================
SELECT
  '⚠️ Anlagen ohne Freigaben (sollte automatisch erstellt werden)' as check_name,
  COUNT(*) as anzahl_probleme
FROM anlagen a
WHERE a.id NOT IN (SELECT anlage_id FROM anlagen_freigaben);

-- Details:
SELECT
  a.id,
  a.anlagenname,
  a.mitglied_id,
  a.erstellt_am,
  'Keine Freigaben-Einträge' as problem
FROM anlagen a
WHERE a.id NOT IN (SELECT anlage_id FROM anlagen_freigaben);

-- ============================================
-- 6. DUPLIKATE PRÜFEN
-- ============================================
SELECT
  '⚠️ Mehrfache Freigaben für gleiche Anlage' as check_name,
  COUNT(*) as anzahl_probleme
FROM (
  SELECT anlage_id, COUNT(*) as count
  FROM anlagen_freigaben
  GROUP BY anlage_id
  HAVING COUNT(*) > 1
) duplicates;

-- ============================================
-- 7. STATISTIK
-- ============================================
SELECT
  '📊 Gesamtstatistik' as info,
  (SELECT COUNT(*) FROM mitglieder WHERE aktiv = true) as anzahl_mitglieder,
  (SELECT COUNT(*) FROM anlagen WHERE aktiv = true) as anzahl_anlagen,
  (SELECT COUNT(*) FROM monatsdaten) as anzahl_monatsdaten,
  (SELECT COUNT(*) FROM investitionen) as anzahl_investitionen;

-- ============================================
-- ZUSAMMENFASSUNG
-- ============================================
-- Wenn alle Checks 0 zurückgeben = ✅ Alles OK
-- Wenn Probleme gefunden werden = ❌ Bereinigung nötig
