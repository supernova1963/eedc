-- ============================================
-- DIAGNOSE & FIX: Mitglieder Policy Problem
-- ============================================
-- Datum: 2026-01-28
-- Problem: Benutzername/E-Mail wird nicht in Sidebar angezeigt
-- Root Cause: RLS Policy blockiert Client-Side Query
-- ============================================

-- TEIL 1: DIAGNOSE
-- ============================================

-- 1.1 Zeige aktuelle Policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename = 'mitglieder'
ORDER BY policyname;

-- 1.2 Prüfe RLS Status
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'mitglieder';

-- 1.3 Zeige alle Mitglieder (zur Verifikation)
SELECT
  id,
  email,
  vorname,
  nachname,
  aktiv,
  erstellt_am
FROM mitglieder
ORDER BY erstellt_am DESC;

-- ============================================
-- TEIL 2: SOFORT-FIX (TEMPORÄR)
-- ============================================

-- Entferne problematische Policy
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;
DROP POLICY IF EXISTS "mitglieder_select_anon" ON mitglieder;
DROP POLICY IF EXISTS "mitglieder_public" ON mitglieder;

-- Erstelle SIMPLE Policy für authenticated Users
-- Diese Policy erlaubt NUR den Zugriff auf eigene Daten
CREATE POLICY "mitglieder_authenticated_select" ON mitglieder
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    -- User kann nur seine eigenen Daten sehen
    -- WICHTIG: Keine Subqueries, keine Joins!
    email = auth.email()
  );

-- Erstelle separate Policy für anonymous (Community)
CREATE POLICY "mitglieder_anonymous_select" ON mitglieder
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (
    -- Anonymous User kann Mitglieder sehen,
    -- deren Anlagen öffentlich freigegeben sind
    -- WICHTIG: Diese Query darf NICHT von anlagen Policy abhängen!
    EXISTS (
      SELECT 1
      FROM anlagen a
      INNER JOIN anlagen_freigaben af ON af.anlage_id = a.id
      WHERE a.mitglied_id = mitglieder.id
        AND af.profil_oeffentlich = true
    )
  );

-- ============================================
-- TEIL 3: WEITERE POLICIES (INSERT, UPDATE, DELETE)
-- ============================================

-- Insert: Nur für admin/system (nicht für normale User)
DROP POLICY IF EXISTS "mitglieder_insert" ON mitglieder;

-- Update: User kann nur eigene Daten ändern
DROP POLICY IF EXISTS "mitglieder_update" ON mitglieder;

CREATE POLICY "mitglieder_authenticated_update" ON mitglieder
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (email = auth.email())
  WITH CHECK (email = auth.email());

-- Delete: Deaktiviert (soft delete über aktiv flag)
DROP POLICY IF EXISTS "mitglieder_delete" ON mitglieder;

-- ============================================
-- TEIL 4: VERIFIZIERUNG
-- ============================================

-- 4.1 Zeige neue Policies
SELECT
  policyname,
  cmd as operation,
  roles,
  qual::text as using_expression
FROM pg_policies
WHERE tablename = 'mitglieder'
ORDER BY roles, cmd;

-- 4.2 Test: Simuliere authenticated User Query
-- HINWEIS: Dieser Test funktioniert nur wenn Sie als authenticated user eingeloggt sind
-- Ersetzen Sie 'your-email@example.com' mit Ihrer echten E-Mail aus auth.users

-- Zeige aktuelle Auth User Email (wenn verfügbar)
SELECT
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST
LIMIT 5;

-- Test Query (als Service Role - sollte alle sehen)
SELECT
  id,
  email,
  vorname,
  nachname,
  aktiv
FROM mitglieder
WHERE aktiv = true;

-- ============================================
-- TEIL 5: ERWEITERTE DIAGNOSE (falls noch nicht funktioniert)
-- ============================================

-- 5.1 Prüfe auf E-Mail Unterschiede (case sensitivity)
SELECT
  m.id,
  m.email as mitglieder_email,
  u.email as auth_email,
  m.email = u.email as exact_match,
  LOWER(m.email) = LOWER(u.email) as case_insensitive_match
FROM mitglieder m
LEFT JOIN auth.users u ON LOWER(m.email) = LOWER(u.email)
WHERE m.aktiv = true;

-- 5.2 Prüfe ob auth.email() Function funktioniert
-- HINWEIS: Diese Query zeigt nur Ergebnisse wenn Sie als authenticated user laufen
SELECT
  current_setting('request.jwt.claims', true)::json->>'email' as jwt_email,
  auth.email() as auth_email_function;

-- 5.3 Zeige Grants auf mitglieder Tabelle
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'mitglieder'
ORDER BY grantee, privilege_type;

-- ============================================
-- KOMMENTARE & ERKLÄRUNGEN
-- ============================================

COMMENT ON POLICY "mitglieder_authenticated_select" ON mitglieder IS
'Authenticated users können ihre eigenen Mitgliedsdaten lesen. Verwendet für Sidebar/Header User-Anzeige.';

COMMENT ON POLICY "mitglieder_anonymous_select" ON mitglieder IS
'Anonymous users können Mitglieder sehen, deren Anlagen öffentlich sind. Verwendet für Community Features.';

-- ============================================
-- NÄCHSTE SCHRITTE NACH DEM FIX
-- ============================================

/*
1. ✅ Führe dieses Skript in Supabase SQL Editor aus
2. ✅ Starte die Next.js App neu (npm run dev)
3. ✅ Öffne Browser Console (F12)
4. ✅ Navigiere zu einer privaten Seite (nicht /, /login, /community)
5. ✅ Prüfe Console Logs:
   - "🔍 [ConditionalLayout] Session: Vorhanden"
   - "🔍 [ConditionalLayout] User: { id: ..., email: ... }"
   - "🔍 [ConditionalLayout] Mitglied Query: { success: true, mitglied: { ... } }"
   - "✅ Mitglied geladen: Vorname Nachname"
6. ✅ Prüfe Sidebar oben links: Erscheint Name/E-Mail?

Falls NEIN:
- Prüfe Console Output und teile ihn zur weiteren Analyse
- Führe die erweiterte Diagnose (Teil 5) aus
- Prüfe ob mitglieder.email EXAKT mit auth.users.email übereinstimmt

Falls JA:
- ✅ Sofort-Fix erfolgreich!
- Nächster Schritt: Strukturelle Verbesserungen aus ANALYSE-AUTHENTIFIZIERUNG-BERECHTIGUNGEN.md
*/
