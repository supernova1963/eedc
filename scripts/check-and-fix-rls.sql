-- Check current policies
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

-- Drop ALL old policies
DROP POLICY IF EXISTS "Users can insert own data" ON mitglieder;
DROP POLICY IF EXISTS "Enable insert for authenticated users during registration" ON mitglieder;

-- Create simple policy that works
CREATE POLICY "allow_authenticated_insert"
ON mitglieder
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'mitglieder';
