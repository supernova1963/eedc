-- Verify Max Mustermann data after UPDATE
SELECT 
  id,
  email,
  vorname,
  nachname,
  plz,
  ort,
  aktiv,
  erstellt_am
FROM mitglieder 
WHERE email = 'max.mustermann@tester.com';

-- Check if there are any anlagen for this user
SELECT 
  a.id,
  a.anlagenname,
  a.mitglied_id,
  m.email
FROM anlagen a
JOIN mitglieder m ON a.mitglied_id = m.id
WHERE m.email = 'max.mustermann@tester.com';
