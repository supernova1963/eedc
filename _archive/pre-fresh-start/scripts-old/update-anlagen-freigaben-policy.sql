-- Schnelles Update nur für anlagen_freigaben UPDATE Policy

DROP POLICY IF EXISTS "anlagen_freigaben_update" ON anlagen_freigaben;

CREATE POLICY "anlagen_freigaben_update" ON anlagen_freigaben FOR UPDATE TO authenticated
USING (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
))
WITH CHECK (anlage_id IN (
  SELECT a.id FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE m.email = auth.email()
));

-- Verifizierung
SELECT
  tablename,
  policyname,
  cmd,
  SUBSTRING(qual FROM 1 FOR 100) as using_clause,
  SUBSTRING(with_check FROM 1 FOR 100) as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'anlagen_freigaben'
  AND policyname = 'anlagen_freigaben_update';
