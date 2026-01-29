-- Zeige alle Policies für anlagen Tabelle
SELECT
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename = 'anlagen'
ORDER BY cmd, policyname;
