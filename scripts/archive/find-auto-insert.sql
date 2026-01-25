-- Suche nach allem was automatisch mitglieder anlegen könnte

-- 1. Suche nach Triggers auf auth.users
SELECT
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
   OR action_statement ILIKE '%mitglieder%';

-- 2. Suche nach Functions die mitglieder erwähnen
SELECT
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_definition ILIKE '%mitglieder%'
   OR routine_name ILIKE '%mitglied%';

-- 3. Suche nach Foreign Key Constraints mit CASCADE
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'mitglieder';

-- 4. Zeige alle Triggers auf mitglieder
SELECT
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'mitglieder';
