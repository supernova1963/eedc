-- ============================================
-- PRODUCTION SETUP SCRIPT
-- ============================================
-- Dieses Script bereitet eine frische Produktions-Datenbank vor
-- Verwenden Sie es für neue Umgebungen (Staging, Production)
-- ============================================

-- ============================================
-- SCHRITT 1: Standard-Investitionstypen erstellen
-- ============================================

-- Falls leer, Standard-Typen einfügen:
INSERT INTO investitionstypen (typ, beschreibung, aktiv)
VALUES
  ('PV-Module', 'Photovoltaik-Module', true),
  ('Wechselrichter', 'Wechselrichter für PV-Anlagen', true),
  ('Batteriespeicher', 'Stromspeicher/Batteriesystem', true),
  ('Montagesystem', 'Befestigungssystem für Module', true),
  ('Wallbox', 'Ladestation für Elektrofahrzeuge', true),
  ('Optimierer', 'Leistungsoptimierer für Module', true),
  ('Sonstiges', 'Sonstige Investitionen', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- SCHRITT 2: Standard-Strompreise erstellen (optional)
-- ============================================

-- Beispiel: Aktuelle durchschnittliche Strompreise Deutschland
INSERT INTO strompreise (gueltig_ab, preis_cent_kwh, anbieter, tarif, grundgebuehr_euro, aktiv)
VALUES
  ('2024-01-01', 35.00, 'Standard', 'Grundversorgung', 120.00, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- SCHRITT 3: RLS Policies prüfen
-- ============================================

-- Stelle sicher, dass Row Level Security aktiviert ist
ALTER TABLE mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen ENABLE ROW LEVEL SECURITY;
ALTER TABLE monatsdaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE investitionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen_freigaben ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SCHRITT 4: Policies erstellen (falls noch nicht vorhanden)
-- ============================================

-- MITGLIEDER: User kann nur eigene Daten sehen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mitglieder' AND policyname = 'Users can view own data'
  ) THEN
    CREATE POLICY "Users can view own data" ON mitglieder
      FOR SELECT
      USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = mitglieder.email));
  END IF;
END $$;

-- MITGLIEDER: User kann sich selbst registrieren (INSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mitglieder' AND policyname = 'Users can insert own data'
  ) THEN
    CREATE POLICY "Users can insert own data" ON mitglieder
      FOR INSERT
      WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE email = mitglieder.email));
  END IF;
END $$;

-- MITGLIEDER: User kann eigene Daten aktualisieren
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mitglieder' AND policyname = 'Users can update own data'
  ) THEN
    CREATE POLICY "Users can update own data" ON mitglieder
      FOR UPDATE
      USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = mitglieder.email));
  END IF;
END $$;

-- ANLAGEN: User kann nur eigene Anlagen sehen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anlagen' AND policyname = 'Users can view own anlagen'
  ) THEN
    CREATE POLICY "Users can view own anlagen" ON anlagen
      FOR SELECT
      USING (
        mitglied_id IN (
          SELECT id FROM mitglieder
          WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      );
  END IF;
END $$;

-- ANLAGEN: User kann nur eigene Anlagen erstellen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anlagen' AND policyname = 'Users can insert own anlagen'
  ) THEN
    CREATE POLICY "Users can insert own anlagen" ON anlagen
      FOR INSERT
      WITH CHECK (
        mitglied_id IN (
          SELECT id FROM mitglieder
          WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      );
  END IF;
END $$;

-- ANLAGEN: User kann nur eigene Anlagen bearbeiten
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anlagen' AND policyname = 'Users can update own anlagen'
  ) THEN
    CREATE POLICY "Users can update own anlagen" ON anlagen
      FOR UPDATE
      USING (
        mitglied_id IN (
          SELECT id FROM mitglieder
          WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      );
  END IF;
END $$;

-- ANLAGEN_FREIGABEN: User kann Freigaben eigener Anlagen sehen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anlagen_freigaben' AND policyname = 'Users can view own anlagen_freigaben'
  ) THEN
    CREATE POLICY "Users can view own anlagen_freigaben" ON anlagen_freigaben
      FOR SELECT
      USING (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- ANLAGEN_FREIGABEN: User kann Freigaben für eigene Anlagen erstellen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anlagen_freigaben' AND policyname = 'Users can insert own anlagen_freigaben'
  ) THEN
    CREATE POLICY "Users can insert own anlagen_freigaben" ON anlagen_freigaben
      FOR INSERT
      WITH CHECK (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- ANLAGEN_FREIGABEN: User kann Freigaben eigener Anlagen aktualisieren
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anlagen_freigaben' AND policyname = 'Users can update own anlagen_freigaben'
  ) THEN
    CREATE POLICY "Users can update own anlagen_freigaben" ON anlagen_freigaben
      FOR UPDATE
      USING (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- MONATSDATEN: User kann nur Daten eigener Anlagen sehen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'monatsdaten' AND policyname = 'Users can view own monatsdaten'
  ) THEN
    CREATE POLICY "Users can view own monatsdaten" ON monatsdaten
      FOR SELECT
      USING (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- MONATSDATEN: User kann Monatsdaten für eigene Anlagen erstellen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'monatsdaten' AND policyname = 'Users can insert own monatsdaten'
  ) THEN
    CREATE POLICY "Users can insert own monatsdaten" ON monatsdaten
      FOR INSERT
      WITH CHECK (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- MONATSDATEN: User kann Monatsdaten eigener Anlagen aktualisieren
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'monatsdaten' AND policyname = 'Users can update own monatsdaten'
  ) THEN
    CREATE POLICY "Users can update own monatsdaten" ON monatsdaten
      FOR UPDATE
      USING (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- MONATSDATEN: User kann Monatsdaten eigener Anlagen löschen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'monatsdaten' AND policyname = 'Users can delete own monatsdaten'
  ) THEN
    CREATE POLICY "Users can delete own monatsdaten" ON monatsdaten
      FOR DELETE
      USING (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- INVESTITIONEN: User kann nur Investitionen eigener Anlagen sehen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'investitionen' AND policyname = 'Users can view own investitionen'
  ) THEN
    CREATE POLICY "Users can view own investitionen" ON investitionen
      FOR SELECT
      USING (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- INVESTITIONEN: User kann Investitionen für eigene Anlagen erstellen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'investitionen' AND policyname = 'Users can insert own investitionen'
  ) THEN
    CREATE POLICY "Users can insert own investitionen" ON investitionen
      FOR INSERT
      WITH CHECK (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- INVESTITIONEN: User kann Investitionen eigener Anlagen aktualisieren
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'investitionen' AND policyname = 'Users can update own investitionen'
  ) THEN
    CREATE POLICY "Users can update own investitionen" ON investitionen
      FOR UPDATE
      USING (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- INVESTITIONEN: User kann Investitionen eigener Anlagen löschen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'investitionen' AND policyname = 'Users can delete own investitionen'
  ) THEN
    CREATE POLICY "Users can delete own investitionen" ON investitionen
      FOR DELETE
      USING (
        anlage_id IN (
          SELECT id FROM anlagen WHERE mitglied_id IN (
            SELECT id FROM mitglieder
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
  END IF;
END $$;

-- ============================================
-- SCHRITT 5: Verifizierung
-- ============================================

-- Zeige alle aktivierten RLS Tabellen
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;

-- Zeige alle Policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- FERTIG!
-- ============================================
-- Die Datenbank ist jetzt bereit für Produktionsdaten
-- ============================================
