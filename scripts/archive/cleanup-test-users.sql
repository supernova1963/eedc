-- Cleanup aller Test-User

-- Zeige alle Test-User
SELECT id, email, vorname, nachname, erstellt_am
FROM mitglieder
WHERE email LIKE '%@tester.com' OR email LIKE 'mmax@%'
ORDER BY erstellt_am DESC;

-- Lösche alle Test-User
DELETE FROM mitglieder
WHERE email LIKE '%@tester.com' OR email LIKE 'mmax@%';

-- Verifiziere
SELECT COUNT(*) as remaining_test_users
FROM mitglieder
WHERE email LIKE '%@tester.com' OR email LIKE 'mmax@%';
