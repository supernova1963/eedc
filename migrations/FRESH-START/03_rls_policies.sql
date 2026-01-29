-- ============================================
-- MIGRATION 03: RLS Policies
-- ============================================
-- Datum: 2026-01-29
-- Beschreibung: Aktiviert RLS und erstellt Policies für alle Tabellen
-- Basiert auf MASTER-REFACTORING-PLAN.md
-- ============================================

-- ============================================
-- RLS ACTIVATION
-- ============================================
ALTER TABLE mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen_komponenten ENABLE ROW LEVEL SECURITY;
ALTER TABLE haushalt_komponenten ENABLE ROW LEVEL SECURITY;
ALTER TABLE monatsdaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE komponenten_monatsdaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen_kennzahlen ENABLE ROW LEVEL SECURITY;
ALTER TABLE strompreise ENABLE ROW LEVEL SECURITY;

-- komponenten_typen hat kein RLS (Master Data, public readable)

-- ============================================
-- POLICIES: mitglieder
-- ============================================

-- SELECT: User sieht nur eigene Daten + öffentliche Profile
CREATE POLICY "mitglieder_select_own" ON mitglieder
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "mitglieder_select_public" ON mitglieder
  FOR SELECT
  TO anon
  USING (profil_oeffentlich = true);

-- UPDATE: User kann nur eigene Daten ändern
CREATE POLICY "mitglieder_update" ON mitglieder
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- INSERT: Nur bei Registrierung (via Service Role)
-- Keine Policy für authenticated → Registrierung erfolgt via API

-- DELETE: Deaktiviert (soft delete via aktiv flag)

-- ============================================
-- POLICIES: anlagen
-- ============================================

-- SELECT: Eigene Anlagen + Öffentliche
CREATE POLICY "anlagen_select_own" ON anlagen
  FOR SELECT
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

CREATE POLICY "anlagen_select_public" ON anlagen
  FOR SELECT
  TO anon, authenticated
  USING (oeffentlich = true AND aktiv = true);

-- INSERT: User kann Anlagen für sich erstellen
CREATE POLICY "anlagen_insert" ON anlagen
  FOR INSERT
  TO authenticated
  WITH CHECK (mitglied_id = current_mitglied_id());

-- UPDATE: Nur eigene Anlagen
CREATE POLICY "anlagen_update" ON anlagen
  FOR UPDATE
  TO authenticated
  USING (mitglied_id = current_mitglied_id())
  WITH CHECK (mitglied_id = current_mitglied_id());

-- DELETE: Nur eigene Anlagen
CREATE POLICY "anlagen_delete" ON anlagen
  FOR DELETE
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

-- ============================================
-- POLICIES: anlagen_komponenten
-- ============================================

-- SELECT: Eigene + Öffentliche (wenn Anlage öffentlich + komponenten_oeffentlich)
CREATE POLICY "anlagen_komponenten_select_own" ON anlagen_komponenten
  FOR SELECT
  TO authenticated
  USING (user_owns_anlage(anlage_id));

CREATE POLICY "anlagen_komponenten_select_public" ON anlagen_komponenten
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anlagen
      WHERE anlagen.id = anlage_id
        AND anlagen.oeffentlich = true
        AND anlagen.komponenten_oeffentlich = true
        AND anlagen.aktiv = true
    )
  );

-- INSERT/UPDATE/DELETE: Nur für eigene Anlagen
CREATE POLICY "anlagen_komponenten_insert" ON anlagen_komponenten
  FOR INSERT
  TO authenticated
  WITH CHECK (user_owns_anlage(anlage_id));

CREATE POLICY "anlagen_komponenten_update" ON anlagen_komponenten
  FOR UPDATE
  TO authenticated
  USING (user_owns_anlage(anlage_id))
  WITH CHECK (user_owns_anlage(anlage_id));

CREATE POLICY "anlagen_komponenten_delete" ON anlagen_komponenten
  FOR DELETE
  TO authenticated
  USING (user_owns_anlage(anlage_id));

-- ============================================
-- POLICIES: haushalt_komponenten
-- ============================================

-- SELECT: Eigene + Öffentliche
CREATE POLICY "haushalt_komponenten_select_own" ON haushalt_komponenten
  FOR SELECT
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

CREATE POLICY "haushalt_komponenten_select_public" ON haushalt_komponenten
  FOR SELECT
  TO anon, authenticated
  USING (oeffentlich = true AND aktiv = true);

-- INSERT/UPDATE/DELETE: Nur eigene
CREATE POLICY "haushalt_komponenten_insert" ON haushalt_komponenten
  FOR INSERT
  TO authenticated
  WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "haushalt_komponenten_update" ON haushalt_komponenten
  FOR UPDATE
  TO authenticated
  USING (mitglied_id = current_mitglied_id())
  WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "haushalt_komponenten_delete" ON haushalt_komponenten
  FOR DELETE
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

-- ============================================
-- POLICIES: monatsdaten
-- ============================================

-- SELECT: Eigene + Öffentliche (wenn Anlage monatsdaten_oeffentlich)
CREATE POLICY "monatsdaten_select_own" ON monatsdaten
  FOR SELECT
  TO authenticated
  USING (user_owns_anlage(anlage_id));

CREATE POLICY "monatsdaten_select_public" ON monatsdaten
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anlagen
      WHERE anlagen.id = anlage_id
        AND anlagen.oeffentlich = true
        AND anlagen.monatsdaten_oeffentlich = true
        AND anlagen.aktiv = true
    )
  );

-- INSERT/UPDATE/DELETE: Nur für eigene Anlagen
CREATE POLICY "monatsdaten_insert" ON monatsdaten
  FOR INSERT
  TO authenticated
  WITH CHECK (user_owns_anlage(anlage_id));

CREATE POLICY "monatsdaten_update" ON monatsdaten
  FOR UPDATE
  TO authenticated
  USING (user_owns_anlage(anlage_id))
  WITH CHECK (user_owns_anlage(anlage_id));

CREATE POLICY "monatsdaten_delete" ON monatsdaten
  FOR DELETE
  TO authenticated
  USING (user_owns_anlage(anlage_id));

-- ============================================
-- POLICIES: komponenten_monatsdaten
-- ============================================

-- SELECT: Eigene + Öffentliche (wenn Komponente öffentlich)
CREATE POLICY "komponenten_monatsdaten_select_own" ON komponenten_monatsdaten
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  );

CREATE POLICY "komponenten_monatsdaten_select_public" ON komponenten_monatsdaten
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.oeffentlich = true
        AND hk.aktiv = true
    )
  );

-- INSERT/UPDATE/DELETE: Nur für eigene Komponenten
CREATE POLICY "komponenten_monatsdaten_insert" ON komponenten_monatsdaten
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  );

CREATE POLICY "komponenten_monatsdaten_update" ON komponenten_monatsdaten
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  );

CREATE POLICY "komponenten_monatsdaten_delete" ON komponenten_monatsdaten
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  );

-- ============================================
-- POLICIES: anlagen_kennzahlen
-- ============================================

-- SELECT: Eigene + Öffentliche (wenn Anlage kennzahlen_oeffentlich)
CREATE POLICY "anlagen_kennzahlen_select_own" ON anlagen_kennzahlen
  FOR SELECT
  TO authenticated
  USING (user_owns_anlage(anlage_id));

CREATE POLICY "anlagen_kennzahlen_select_public" ON anlagen_kennzahlen
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anlagen
      WHERE anlagen.id = anlage_id
        AND anlagen.oeffentlich = true
        AND anlagen.kennzahlen_oeffentlich = true
        AND anlagen.aktiv = true
    )
  );

-- INSERT/UPDATE/DELETE: Nur System (via Service Role) oder Owner
CREATE POLICY "anlagen_kennzahlen_update" ON anlagen_kennzahlen
  FOR UPDATE
  TO authenticated
  USING (user_owns_anlage(anlage_id))
  WITH CHECK (user_owns_anlage(anlage_id));

-- ============================================
-- POLICIES: strompreise
-- ============================================

-- SELECT: Eigene + Globale (mitglied_id IS NULL)
CREATE POLICY "strompreise_select_own" ON strompreise
  FOR SELECT
  TO authenticated
  USING (
    mitglied_id IS NULL -- Global
    OR mitglied_id = current_mitglied_id() -- Eigene
  );

CREATE POLICY "strompreise_select_global" ON strompreise
  FOR SELECT
  TO anon
  USING (mitglied_id IS NULL); -- Nur globale für Anonymous

-- INSERT/UPDATE/DELETE: Nur eigene
CREATE POLICY "strompreise_insert" ON strompreise
  FOR INSERT
  TO authenticated
  WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "strompreise_update" ON strompreise
  FOR UPDATE
  TO authenticated
  USING (mitglied_id = current_mitglied_id())
  WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "strompreise_delete" ON strompreise
  FOR DELETE
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

-- ============================================
-- VERIFIZIERUNG
-- ============================================
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '✅ RLS Policies created successfully. Total policies: %', policy_count;

  IF policy_count < 25 THEN
    RAISE WARNING '⚠️ Expected at least 25 policies, but found %', policy_count;
  END IF;
END $$;
