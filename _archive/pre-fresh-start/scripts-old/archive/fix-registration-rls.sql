-- Fix RLS Policy für Registrierung
-- Die bisherige INSERT Policy war zu restriktiv

-- 1. Lösche die alte INSERT Policy
DROP POLICY IF EXISTS "Users can insert own data" ON mitglieder;

-- 2. Erstelle neue INSERT Policy die Registrierung erlaubt
-- Während der Registrierung ist der User authentifiziert (via signUp)
-- und darf sich selbst in der mitglieder Tabelle eintragen
CREATE POLICY "Enable insert for authenticated users during registration"
ON mitglieder
FOR INSERT
TO authenticated
WITH CHECK (
  -- User muss authentifiziert sein
  auth.uid() IS NOT NULL
  AND
  -- Email muss mit der Auth-Email übereinstimmen
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Verifizierung
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'mitglieder'
ORDER BY policyname;
