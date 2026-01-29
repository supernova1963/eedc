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
ADD COLUMN IF NOT EXISTS profilbild_url TEXT,
-- Komponenten-Bezeichnungen
ADD COLUMN IF NOT EXISTS batterie_bezeichnung TEXT,
ADD COLUMN IF NOT EXISTS ekfz_bezeichnung TEXT,
ADD COLUMN IF NOT EXISTS waermepumpe_bezeichnung TEXT,
ADD COLUMN IF NOT EXISTS wechselrichter_bezeichnung TEXT,
ADD COLUMN IF NOT EXISTS pv_module_bezeichnung TEXT,
ADD COLUMN IF NOT EXISTS solarteur_name TEXT,
ADD COLUMN IF NOT EXISTS sonstiges TEXT;

-- Kommentare
COMMENT ON COLUMN anlagen.profilbeschreibung IS 'Kurze Beschreibung der Anlage für die Community (max 500 Zeichen empfohlen)';
COMMENT ON COLUMN anlagen.motivation IS 'Warum hast du dich für PV entschieden? (freiwillig, öffentlich)';
COMMENT ON COLUMN anlagen.erfahrungen IS 'Deine Erfahrungen mit der Anlage (freiwillig, öffentlich)';
COMMENT ON COLUMN anlagen.tipps_fuer_andere IS 'Tipps für andere PV-Interessierte (freiwillig, öffentlich)';
COMMENT ON COLUMN anlagen.lieblings_feature IS 'Dein Lieblings-Feature/Aspekt der Anlage (freiwillig, öffentlich)';
COMMENT ON COLUMN anlagen.kontakt_erwuenscht IS 'Möchte ich von anderen Community-Mitgliedern kontaktiert werden?';
COMMENT ON COLUMN anlagen.profilbild_url IS 'URL zum Profilbild der Anlage (z.B. Foto der Installation)';
COMMENT ON COLUMN anlagen.batterie_bezeichnung IS 'Bezeichnung des Batteriespeichers (z.B. Huawei Luna 10 kWh)';
COMMENT ON COLUMN anlagen.ekfz_bezeichnung IS 'Bezeichnung des E-Fahrzeugs (z.B. Tesla Model 3)';
COMMENT ON COLUMN anlagen.waermepumpe_bezeichnung IS 'Bezeichnung der Wärmepumpe (z.B. Vaillant aroTHERM)';
COMMENT ON COLUMN anlagen.wechselrichter_bezeichnung IS 'Bezeichnung des Wechselrichters (z.B. SMA Sunny Tripower)';
COMMENT ON COLUMN anlagen.pv_module_bezeichnung IS 'Bezeichnung der PV-Module (z.B. Trina Solar Vertex 410W)';
COMMENT ON COLUMN anlagen.solarteur_name IS 'Name des Installateurs/Solarteurs';
COMMENT ON COLUMN anlagen.sonstiges IS 'Sonstige Komponenten oder Anmerkungen';

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
    'profilbild_url',
    'batterie_bezeichnung',
    'ekfz_bezeichnung',
    'waermepumpe_bezeichnung',
    'wechselrichter_bezeichnung',
    'pv_module_bezeichnung',
    'solarteur_name',
    'sonstiges'
  )
ORDER BY ordinal_position;

-- Success Message
DO $$
BEGIN
  RAISE NOTICE '✅ Community-Profil Felder erfolgreich hinzugefügt!';
  RAISE NOTICE '';
  RAISE NOTICE 'Neue Felder in anlagen Tabelle:';
  RAISE NOTICE '';
  RAISE NOTICE 'Community-Profil:';
  RAISE NOTICE '  - profilbeschreibung (TEXT)';
  RAISE NOTICE '  - motivation (TEXT)';
  RAISE NOTICE '  - erfahrungen (TEXT)';
  RAISE NOTICE '  - tipps_fuer_andere (TEXT)';
  RAISE NOTICE '  - lieblings_feature (TEXT)';
  RAISE NOTICE '  - kontakt_erwuenscht (BOOLEAN)';
  RAISE NOTICE '  - profilbild_url (TEXT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Komponenten-Bezeichnungen:';
  RAISE NOTICE '  - batterie_bezeichnung (TEXT)';
  RAISE NOTICE '  - ekfz_bezeichnung (TEXT)';
  RAISE NOTICE '  - waermepumpe_bezeichnung (TEXT)';
  RAISE NOTICE '  - wechselrichter_bezeichnung (TEXT)';
  RAISE NOTICE '  - pv_module_bezeichnung (TEXT)';
  RAISE NOTICE '  - solarteur_name (TEXT)';
  RAISE NOTICE '  - sonstiges (TEXT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Nächste Schritte:';
  RAISE NOTICE '1. UI-Komponente zum Bearbeiten des Profils erstellen';
  RAISE NOTICE '2. Profilanzeige in Community-Detail-Seite integrieren';
  RAISE NOTICE '3. Datenschutz-Hinweise beim Bearbeiten einblenden';
END $$;
