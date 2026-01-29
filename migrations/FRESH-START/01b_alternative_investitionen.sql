-- ============================================
-- MIGRATION 01b: Alternative Investitionen
-- ============================================
-- Datum: 2026-01-29
-- Beschreibung: Tabelle für Investitionen (E-Auto, Wärmepumpe, Speicher, etc.)
-- ============================================

-- Haupt-Tabelle für alle Investitionstypen
CREATE TABLE IF NOT EXISTS alternative_investitionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitglied_id uuid NOT NULL REFERENCES mitglieder(id) ON DELETE CASCADE,
  anlage_id uuid REFERENCES anlagen(id) ON DELETE SET NULL,
  parent_investition_id uuid REFERENCES alternative_investitionen(id) ON DELETE SET NULL,

  -- Basis-Info
  typ text NOT NULL, -- e-auto, waermepumpe, speicher, wechselrichter, pv-module, wallbox, sonstiges
  bezeichnung text NOT NULL,
  anschaffungsdatum date NOT NULL,

  -- Kosten
  anschaffungskosten_gesamt numeric NOT NULL,
  anschaffungskosten_alternativ numeric,
  anschaffungskosten_relevant numeric GENERATED ALWAYS AS (anschaffungskosten_gesamt - COALESCE(anschaffungskosten_alternativ, 0)) STORED,
  alternativ_beschreibung text,

  -- Laufende Kosten & Einsparungen (JSONB für Flexibilität)
  kosten_jahr_aktuell jsonb DEFAULT '{}'::jsonb,
  kosten_jahr_alternativ jsonb DEFAULT '{}'::jsonb,
  einsparungen_jahr jsonb DEFAULT '{}'::jsonb,
  einsparung_gesamt_jahr numeric,

  -- Typ-spezifische Parameter (JSONB)
  parameter jsonb DEFAULT '{}'::jsonb,
  -- Beispiele:
  -- E-Auto: {"km_jahr": 15000, "verbrauch_kwh_100km": 18, "pv_anteil": 0.7}
  -- Wärmepumpe: {"heizlast_kw": 8, "jaz": 4.0, "verbrauch_kwh_jahr": 3500}
  -- Speicher: {"kapazitaet_kwh": 10, "zyklen_jahr": 300}
  -- Wechselrichter: {"ac_leistung_kw": 10, "dc_leistung_kw": 12, "wirkungsgrad": 0.97}
  -- PV-Module: {"leistung_wp": 400, "anzahl": 24, "ausrichtung": "Süd", "neigung": 30}

  -- CO2
  co2_einsparung_kg_jahr numeric,

  -- System
  aktiv boolean DEFAULT true,
  notizen text,
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_alt_inv_mitglied ON alternative_investitionen(mitglied_id);
CREATE INDEX IF NOT EXISTS idx_alt_inv_anlage ON alternative_investitionen(anlage_id);
CREATE INDEX IF NOT EXISTS idx_alt_inv_typ ON alternative_investitionen(typ);
CREATE INDEX IF NOT EXISTS idx_alt_inv_parent ON alternative_investitionen(parent_investition_id);

-- Kommentare
COMMENT ON TABLE alternative_investitionen IS 'Investitionen wie E-Auto, Wärmepumpe, Speicher mit ROI-Berechnung';
COMMENT ON COLUMN alternative_investitionen.typ IS 'Investitionstyp: e-auto, waermepumpe, speicher, wechselrichter, pv-module, wallbox, sonstiges';
COMMENT ON COLUMN alternative_investitionen.anschaffungskosten_alternativ IS 'Kosten der Alternative (z.B. Verbrenner statt E-Auto)';
COMMENT ON COLUMN alternative_investitionen.anschaffungskosten_relevant IS 'Mehrkosten = Gesamt - Alternativ (für ROI)';
COMMENT ON COLUMN alternative_investitionen.parameter IS 'Typ-spezifische Parameter als JSON';

-- RLS aktivieren
ALTER TABLE alternative_investitionen ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own investitionen" ON alternative_investitionen;
CREATE POLICY "Users can view own investitionen" ON alternative_investitionen
  FOR SELECT USING (mitglied_id = current_mitglied_id());

DROP POLICY IF EXISTS "Users can insert own investitionen" ON alternative_investitionen;
CREATE POLICY "Users can insert own investitionen" ON alternative_investitionen
  FOR INSERT WITH CHECK (mitglied_id = current_mitglied_id());

DROP POLICY IF EXISTS "Users can update own investitionen" ON alternative_investitionen;
CREATE POLICY "Users can update own investitionen" ON alternative_investitionen
  FOR UPDATE USING (mitglied_id = current_mitglied_id());

DROP POLICY IF EXISTS "Users can delete own investitionen" ON alternative_investitionen;
CREATE POLICY "Users can delete own investitionen" ON alternative_investitionen
  FOR DELETE USING (mitglied_id = current_mitglied_id());

-- Verifizierung
DO $$
BEGIN
  RAISE NOTICE '✅ alternative_investitionen Tabelle erfolgreich erstellt';
END $$;
