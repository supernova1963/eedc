-- ============================================
-- Feature: Community-Profil Erweiterung
-- ============================================
-- Zweck: Fügt zusätzliche Felder für öffentliche Profile hinzu
-- Issue: #1
-- ============================================

-- Erweitere anlagen Tabelle um Community-Profil Felder
ALTER TABLE anlagen
ADD COLUMN IF NOT EXISTS profilbeschreibung TEXT,
ADD COLUMN IF NOT EXISTS motivation TEXT,
ADD COLUMN IF NOT EXISTS erfahrungen TEXT,
ADD COLUMN IF NOT EXISTS tipps_fuer_andere TEXT,
ADD COLUMN IF NOT EXISTS lieblings_feature TEXT,
ADD COLUMN IF NOT EXISTS kontakt_erwuenscht BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profilbild_url TEXT;

-- Kommentare
COMMENT ON COLUMN anlagen.profilbeschreibung IS 'Kurze Beschreibung der Anlage für die Community (max 500 Zeichen empfohlen)';
COMMENT ON COLUMN anlagen.motivation IS 'Warum hast du dich für PV entschieden? (freiwillig, öffentlich)';
COMMENT ON COLUMN anlagen.erfahrungen IS 'Deine Erfahrungen mit der Anlage (freiwillig, öffentlich)';
COMMENT ON COLUMN anlagen.tipps_fuer_andere IS 'Tipps für andere PV-Interessierte (freiwillig, öffentlich)';
COMMENT ON COLUMN anlagen.lieblings_feature IS 'Dein Lieblings-Feature/Aspekt der Anlage (freiwillig, öffentlich)';
COMMENT ON COLUMN anlagen.kontakt_erwuenscht IS 'Möchte ich von anderen Community-Mitgliedern kontaktiert werden?';
COMMENT ON COLUMN anlagen.profilbild_url IS 'URL zum Profilbild der Anlage (z.B. Foto der Installation)';

-- Verifizierung
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'anlagen'
  AND column_name IN (
    'profilbeschreibung',
    'motivation',
    'erfahrungen',
    'tipps_fuer_andere',
    'lieblings_feature',
    'kontakt_erwuenscht',
    'profilbild_url'
  )
ORDER BY ordinal_position;

-- Success Message
DO $$
BEGIN
  RAISE NOTICE '✅ Community-Profil Felder erfolgreich hinzugefügt!';
  RAISE NOTICE '';
  RAISE NOTICE 'Neue Felder in anlagen Tabelle:';
  RAISE NOTICE '  - profilbeschreibung (TEXT)';
  RAISE NOTICE '  - motivation (TEXT)';
  RAISE NOTICE '  - erfahrungen (TEXT)';
  RAISE NOTICE '  - tipps_fuer_andere (TEXT)';
  RAISE NOTICE '  - lieblings_feature (TEXT)';
  RAISE NOTICE '  - kontakt_erwuenscht (BOOLEAN)';
  RAISE NOTICE '  - profilbild_url (TEXT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Nächste Schritte:';
  RAISE NOTICE '1. UI-Komponente zum Bearbeiten des Profils erstellen';
  RAISE NOTICE '2. Profilanzeige in Community-Detail-Seite integrieren';
  RAISE NOTICE '3. Datenschutz-Hinweise beim Bearbeiten einblenden';
END $$;
