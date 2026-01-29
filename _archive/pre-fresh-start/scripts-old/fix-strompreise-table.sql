-- ============================================
-- FIX: Strompreise Tabelle Migration
-- ============================================
-- Zweck: Aktualisiert die Strompreise-Tabelle auf das neue Schema
--        und fügt RLS Policies hinzu
-- ============================================
-- Issues: #6, #7
-- ============================================

-- Alte Tabelle sichern (falls Daten vorhanden)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'strompreise') THEN
    -- Nur sichern wenn Daten vorhanden
    IF EXISTS (SELECT 1 FROM strompreise LIMIT 1) THEN
      CREATE TABLE IF NOT EXISTS strompreise_backup AS SELECT * FROM strompreise;
      RAISE NOTICE 'Alte Daten in strompreise_backup gesichert';
    END IF;
  END IF;
END $$;

-- Tabelle neu erstellen mit korrektem Schema
DROP TABLE IF EXISTS strompreise CASCADE;

CREATE TABLE strompreise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitglied_id UUID NOT NULL,
  anlage_id UUID,
  gueltig_ab DATE NOT NULL,
  gueltig_bis DATE,

  -- Netzbezug
  netzbezug_arbeitspreis_cent_kwh NUMERIC NOT NULL CHECK (netzbezug_arbeitspreis_cent_kwh >= 0),
  netzbezug_grundpreis_euro_monat NUMERIC DEFAULT 0 CHECK (netzbezug_grundpreis_euro_monat >= 0),

  -- Einspeisung
  einspeiseverguetung_cent_kwh NUMERIC NOT NULL CHECK (einspeiseverguetung_cent_kwh >= 0),

  -- Metadaten
  anbieter_name TEXT,
  vertragsart TEXT,  -- z.B. 'Grundversorgung', 'Sondervertrag', 'Dynamisch'
  notizen TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT strompreise_mitglied_id_fkey FOREIGN KEY (mitglied_id) REFERENCES public.mitglieder(id) ON DELETE CASCADE,
  CONSTRAINT strompreise_anlage_id_fkey FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id) ON DELETE CASCADE,
  CONSTRAINT strompreise_zeitraum_check CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab)
);

-- Indizes für Performance
CREATE INDEX idx_strompreise_mitglied ON strompreise(mitglied_id);
CREATE INDEX idx_strompreise_anlage ON strompreise(anlage_id);
CREATE INDEX idx_strompreise_gueltig ON strompreise(mitglied_id, gueltig_ab, gueltig_bis);

-- Kommentare
COMMENT ON TABLE strompreise IS 'Strompreis-Stammdaten mit Gültigkeitszeiträumen für historische Auswertungen';
COMMENT ON COLUMN strompreise.anlage_id IS 'Optional: Anlagenspezifischer Preis, NULL = gilt für alle Anlagen des Mitglieds';
COMMENT ON COLUMN strompreise.gueltig_bis IS 'NULL = aktuell gültig, sonst Ende der Gültigkeit';

-- ============================================
-- RLS POLICIES
-- ============================================

-- RLS aktivieren
ALTER TABLE strompreise ENABLE ROW LEVEL SECURITY;

-- Policy: User kann nur eigene Strompreise sehen
CREATE POLICY "strompreise_select" ON strompreise
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mitglieder
      WHERE mitglieder.id = strompreise.mitglied_id
        AND mitglieder.email = auth.email()
    )
  );

-- Policy: User kann Strompreise für sich selbst erstellen
CREATE POLICY "strompreise_insert" ON strompreise
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mitglieder
      WHERE mitglieder.id = mitglied_id
        AND mitglieder.email = auth.email()
    )
  );

-- Policy: User kann nur eigene Strompreise aktualisieren
CREATE POLICY "strompreise_update" ON strompreise
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mitglieder
      WHERE mitglieder.id = mitglied_id
        AND mitglieder.email = auth.email()
    )
  );

-- Policy: User kann nur eigene Strompreise löschen
CREATE POLICY "strompreise_delete" ON strompreise
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM mitglieder
      WHERE mitglieder.id = mitglied_id
        AND mitglieder.email = auth.email()
    )
  );

-- ============================================
-- HELPER FUNCTION: Aktuellen Strompreis ermitteln
-- ============================================

CREATE OR REPLACE FUNCTION get_aktueller_strompreis(
  p_mitglied_id UUID,
  p_anlage_id UUID DEFAULT NULL,
  p_stichtag DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  netzbezug_cent_kwh NUMERIC,
  einspeiseverguetung_cent_kwh NUMERIC,
  grundpreis_euro_monat NUMERIC
) AS $$
BEGIN
  -- Versuche zuerst anlagenspezifischen Preis zu finden
  IF p_anlage_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      s.netzbezug_arbeitspreis_cent_kwh,
      s.einspeiseverguetung_cent_kwh,
      s.netzbezug_grundpreis_euro_monat
    FROM strompreise s
    WHERE s.mitglied_id = p_mitglied_id
      AND s.anlage_id = p_anlage_id
      AND s.gueltig_ab <= p_stichtag
      AND (s.gueltig_bis IS NULL OR s.gueltig_bis >= p_stichtag)
    ORDER BY s.gueltig_ab DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Fallback: Allgemeiner Strompreis (anlage_id IS NULL)
  RETURN QUERY
  SELECT
    s.netzbezug_arbeitspreis_cent_kwh,
    s.einspeiseverguetung_cent_kwh,
    s.netzbezug_grundpreis_euro_monat
  FROM strompreise s
  WHERE s.mitglied_id = p_mitglied_id
    AND s.anlage_id IS NULL
    AND s.gueltig_ab <= p_stichtag
    AND (s.gueltig_bis IS NULL OR s.gueltig_bis >= p_stichtag)
  ORDER BY s.gueltig_ab DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_aktueller_strompreis IS 'Ermittelt den aktuellen Strompreis für ein Mitglied (optional anlagenspezifisch)';

-- ============================================
-- VERIFIZIERUNG
-- ============================================

-- Zeige alle Policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'strompreise'
ORDER BY cmd, policyname;

-- Zeige Tabellen-Info
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'strompreise'
ORDER BY ordinal_position;

-- Success Message
DO $$
BEGIN
  RAISE NOTICE '✅ Strompreise-Tabelle erfolgreich migriert!';
  RAISE NOTICE '✅ RLS Policies aktiviert';
  RAISE NOTICE '✅ Helper Function erstellt: get_aktueller_strompreis()';
  RAISE NOTICE '';
  RAISE NOTICE 'Nächste Schritte:';
  RAISE NOTICE '1. In der App Strompreise unter /stammdaten/strompreise erfassen';
  RAISE NOTICE '2. Für jede Anlage oder als allgemeinen Standard-Preis';
  RAISE NOTICE '3. Mit Gültigkeitszeiträumen für historische Auswertungen';
END $$;
