-- ============================================
-- COMPLETE DATABASE RESET
-- ============================================
-- WARNUNG: Dieses Script löscht ALLE Daten!
-- Verwenden Sie es nur in Entwicklungsumgebungen
-- oder für einen kompletten Neustart
-- ============================================

-- ============================================
-- SCHRITT 1: Alle Daten in der richtigen Reihenfolge löschen
-- (wegen Foreign Key Constraints)
-- ============================================

-- 1. Monatsdaten löschen (hängt von anlagen ab)
DELETE FROM monatsdaten;

-- 2. Investitionen löschen (hängt von anlagen ab)
DELETE FROM investitionen;

-- 3. Anlagen-Freigaben löschen (hängt von anlagen ab)
DELETE FROM anlagen_freigaben;

-- 4. Anlagen löschen (hängt von mitglieder ab)
DELETE FROM anlagen;

-- 5. Mitglieder löschen
DELETE FROM mitglieder;

-- 6. Investitionstypen löschen (optional - diese könnten Sie behalten)
-- DELETE FROM investitionstypen;

-- 7. Strompreise löschen (optional - diese könnten Sie behalten)
-- DELETE FROM strompreise;

-- ============================================
-- SCHRITT 2: Verifizierung
-- ============================================

-- Zähle verbleibende Einträge
SELECT
  'monatsdaten' as tabelle, COUNT(*) as anzahl FROM monatsdaten
UNION ALL
SELECT 'investitionen', COUNT(*) FROM investitionen
UNION ALL
SELECT 'anlagen_freigaben', COUNT(*) FROM anlagen_freigaben
UNION ALL
SELECT 'anlagen', COUNT(*) FROM anlagen
UNION ALL
SELECT 'mitglieder', COUNT(*) FROM mitglieder;

-- Sollte alles 0 sein!

-- ============================================
-- SCHRITT 3: Auth Users löschen
-- ============================================
-- WICHTIG: Dies muss MANUELL in der Supabase UI gemacht werden!
--
-- Gehe zu: Authentication → Users
-- Wähle alle Users aus
-- Klicke auf "Delete Users"
--
-- ODER verwende die Supabase Management API (fortgeschritten)
-- ============================================

-- ============================================
-- HINWEISE FÜR PRODUKTIONS-UMGEBUNG
-- ============================================
--
-- Für Live/Production:
-- 1. BACKUP erstellen VORHER!
-- 2. Nur bestimmte Test-Daten löschen
-- 3. Produktiv-Daten NIEMALS löschen
-- 4. Stattdessen: Separate Test-Datenbank verwenden
--
-- ============================================
