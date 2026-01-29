-- Prüfe alle Daten für Hugo

-- 1. Mitglied
SELECT 'MITGLIED:' as check_type, id, email, vorname, nachname FROM mitglieder WHERE email = 'hugo@tester.de';

-- 2. Anlagen
SELECT 'ANLAGEN:' as check_type, id, anlagenname, mitglied_id FROM anlagen WHERE mitglied_id IN (SELECT id FROM mitglieder WHERE email = 'hugo@tester.de');

-- 3. Freigaben
SELECT 'FREIGABEN:' as check_type, * FROM anlagen_freigaben WHERE anlage_id IN (SELECT id FROM anlagen WHERE mitglied_id IN (SELECT id FROM mitglieder WHERE email = 'hugo@tester.de'));

-- 4. Monatsdaten
SELECT 'MONATSDATEN:' as check_type, COUNT(*) as anzahl FROM monatsdaten WHERE anlage_id IN (SELECT id FROM anlagen WHERE mitglied_id IN (SELECT id FROM mitglieder WHERE email = 'hugo@tester.de'));

-- 5. Investitionen
SELECT 'INVESTITIONEN:' as check_type, COUNT(*) as anzahl FROM investitionen WHERE anlage_id IN (SELECT id FROM anlagen WHERE mitglied_id IN (SELECT id FROM mitglieder WHERE email = 'hugo@tester.de'));

-- 6. Alternative Investitionen
SELECT 'ALT_INVESTITIONEN:' as check_type, COUNT(*) as anzahl FROM alternative_investitionen WHERE mitglied_id IN (SELECT id FROM mitglieder WHERE email = 'hugo@tester.de');
