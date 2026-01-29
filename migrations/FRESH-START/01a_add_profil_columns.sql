-- ============================================
-- MIGRATION 01a: Community-Profil Spalten für anlagen
-- ============================================
-- Datum: 2026-01-29
-- Beschreibung: Fügt Spalten für öffentliches Community-Profil hinzu
-- ============================================

-- Komponenten-Bezeichnungen (für öffentliche Anzeige)
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS batterie_bezeichnung text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS wechselrichter_bezeichnung text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS pv_module_bezeichnung text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS ekfz_bezeichnung text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS waermepumpe_bezeichnung text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS solarteur_name text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS sonstiges text;

-- Community-Profil Felder
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS profilbeschreibung text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS motivation text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS erfahrungen text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS tipps_fuer_andere text;
ALTER TABLE anlagen ADD COLUMN IF NOT EXISTS kontakt_erwuenscht boolean DEFAULT false;

-- Kommentare
COMMENT ON COLUMN anlagen.batterie_bezeichnung IS 'Öffentliche Bezeichnung des Batteriespeichers';
COMMENT ON COLUMN anlagen.wechselrichter_bezeichnung IS 'Öffentliche Bezeichnung des Wechselrichters';
COMMENT ON COLUMN anlagen.pv_module_bezeichnung IS 'Öffentliche Bezeichnung der PV-Module';
COMMENT ON COLUMN anlagen.ekfz_bezeichnung IS 'Öffentliche Bezeichnung des E-Fahrzeugs';
COMMENT ON COLUMN anlagen.waermepumpe_bezeichnung IS 'Öffentliche Bezeichnung der Wärmepumpe';
COMMENT ON COLUMN anlagen.solarteur_name IS 'Name des Installateurs/Solarteurs';
COMMENT ON COLUMN anlagen.sonstiges IS 'Sonstige Komponenten oder Anmerkungen';
COMMENT ON COLUMN anlagen.profilbeschreibung IS 'Kurzbeschreibung der Anlage (öffentlich)';
COMMENT ON COLUMN anlagen.motivation IS 'Motivation für PV (Community-Profil)';
COMMENT ON COLUMN anlagen.erfahrungen IS 'Erfahrungen mit der Anlage (Community-Profil)';
COMMENT ON COLUMN anlagen.tipps_fuer_andere IS 'Tipps für andere PV-Interessierte (Community-Profil)';
COMMENT ON COLUMN anlagen.kontakt_erwuenscht IS 'Mitglied ist offen für Kontakt von anderen';

-- Verifizierung
DO $$
BEGIN
  RAISE NOTICE '✅ Community-Profil Spalten erfolgreich hinzugefügt';
END $$;
