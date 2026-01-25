-- ============================================
-- ALLE AUTH USERS LÖSCHEN
-- ============================================
-- WARNUNG: Löscht ALLE Auth Users aus der Datenbank!
-- Nur in Entwicklungsumgebungen verwenden!
-- ============================================

-- Alle Auth Users löschen
-- HINWEIS: Dies muss über die Supabase Dashboard UI gemacht werden,
-- da auth.users nur über die Admin API zugänglich ist

-- Stattdessen: Löschen Sie alle Mitglieder, die keine Auth Users mehr haben
DELETE FROM mitglieder
WHERE email NOT IN (
  SELECT email FROM auth.users WHERE email IS NOT NULL
);

-- Oder: Alle Mitglieder löschen (wenn Sie sicher sind)
DELETE FROM mitglieder;

SELECT 'Auth users müssen manuell im Supabase Dashboard gelöscht werden!' as hinweis,
       'Authentication -> Users -> Alle auswählen -> Delete' as anleitung;
