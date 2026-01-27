-- Debug: Warum werden Anlagen nicht angezeigt?

-- 1. Zeige aktuelle anlagen Policy
SELECT
  policyname,
  cmd as operation,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'anlagen'
  AND policyname = 'anlagen_select';

-- 2. Teste ob auth.email() funktioniert
SELECT auth.email() as current_email, auth.uid() as current_uid;

-- 3. Zeige mitglieder mit Email
SELECT id, email, vorname, nachname
FROM mitglieder
WHERE email = auth.email();

-- 4. Teste direkte Anlagen-Query (wird durch RLS gefiltert)
SELECT id, anlagenname, mitglied_id, leistung_kwp
FROM anlagen
WHERE aktiv = true;
