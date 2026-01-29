-- ============================================
-- MIGRATION 01c: Investition Monatsdaten & Kennzahlen
-- ============================================
-- Datum: 2026-01-29
-- Beschreibung: Tabellen für monatliche Ist-Daten und aggregierte Kennzahlen
-- ============================================

-- ============================================
-- 1. investition_monatsdaten - Monatliche Ist-Daten
-- ============================================
CREATE TABLE IF NOT EXISTS investition_monatsdaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investition_id uuid NOT NULL REFERENCES alternative_investitionen(id) ON DELETE CASCADE,

  -- Zeitraum
  jahr integer NOT NULL,
  monat integer NOT NULL CHECK (monat BETWEEN 1 AND 12),

  -- Flexible Daten (typ-spezifisch als JSON)
  verbrauch_daten jsonb DEFAULT '{}'::jsonb,
  -- Beispiele:
  -- E-Auto: {"km_gefahren": 1200, "strom_kwh": 240, "strom_pv_kwh": 168, "strom_netz_kwh": 72}
  -- Wärmepumpe: {"waerme_kwh": 1800, "strom_kwh": 514, "strom_pv_kwh": 206, "jaz": 3.5}
  -- Speicher: {"gespeichert_kwh": 450, "entladen_kwh": 428, "zyklen": 28}

  kosten_daten jsonb DEFAULT '{}'::jsonb,
  -- Beispiele:
  -- E-Auto: {"strom": 23.04, "wartung": 0, "reparatur": 0}
  -- Wärmepumpe: {"strom": 98.56, "wartung": 0}

  -- Berechnete/Zusammengefasste Werte
  einsparung_monat_euro numeric,
  co2_einsparung_kg numeric,

  -- Optional
  notizen text,

  -- Zeitstempel
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),

  -- Unique Constraint
  UNIQUE(investition_id, jahr, monat)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_inv_monatsdaten_investition ON investition_monatsdaten(investition_id);
CREATE INDEX IF NOT EXISTS idx_inv_monatsdaten_jahr_monat ON investition_monatsdaten(jahr, monat);

-- Kommentare
COMMENT ON TABLE investition_monatsdaten IS 'Monatliche Ist-Daten für alle Investitionstypen (E-Auto, WP, Speicher, etc.)';
COMMENT ON COLUMN investition_monatsdaten.verbrauch_daten IS 'Typ-spezifische Verbrauchsdaten als JSON';
COMMENT ON COLUMN investition_monatsdaten.kosten_daten IS 'Typ-spezifische Kostendaten als JSON';
COMMENT ON COLUMN investition_monatsdaten.einsparung_monat_euro IS 'Tatsächliche Einsparung diesen Monat vs. Alternative';

-- ============================================
-- 2. investition_kennzahlen - Aggregierte Kennzahlen (Cache)
-- ============================================
CREATE TABLE IF NOT EXISTS investition_kennzahlen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investition_id uuid NOT NULL UNIQUE REFERENCES alternative_investitionen(id) ON DELETE CASCADE,

  -- Berechnungsstand
  berechnet_am timestamptz DEFAULT now(),
  bis_jahr integer NOT NULL,
  bis_monat integer NOT NULL,

  -- Wirtschaftlichkeit kumuliert
  einsparung_kumuliert_euro numeric DEFAULT 0,
  kosten_kumuliert_euro numeric DEFAULT 0,
  bilanz_kumuliert_euro numeric DEFAULT 0,

  -- ROI
  amortisationszeit_monate numeric,
  roi_prozent numeric,

  -- CO2
  co2_einsparung_kumuliert_kg numeric DEFAULT 0,
  baeume_aequivalent integer DEFAULT 0,

  -- Prognose
  amortisiert_voraussichtlich_am date
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_inv_kennzahlen_investition ON investition_kennzahlen(investition_id);

-- Kommentare
COMMENT ON TABLE investition_kennzahlen IS 'Aggregierte Kennzahlen für Investitionen (Cache für schnelle Abfragen)';
COMMENT ON COLUMN investition_kennzahlen.bilanz_kumuliert_euro IS 'Einsparung minus Kosten kumuliert';
COMMENT ON COLUMN investition_kennzahlen.baeume_aequivalent IS 'CO2-Einsparung umgerechnet in gepflanzte Bäume';

-- ============================================
-- 3. RLS Policies für investition_monatsdaten
-- ============================================
ALTER TABLE investition_monatsdaten ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktion: Prüft ob User Zugriff auf Investition hat
CREATE OR REPLACE FUNCTION user_owns_investition(p_investition_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM alternative_investitionen
    WHERE id = p_investition_id
      AND mitglied_id = current_mitglied_id()
  );
$$;

GRANT EXECUTE ON FUNCTION user_owns_investition(uuid) TO authenticated;

-- SELECT Policy
DROP POLICY IF EXISTS "Users can view own investition_monatsdaten" ON investition_monatsdaten;
CREATE POLICY "Users can view own investition_monatsdaten" ON investition_monatsdaten
  FOR SELECT USING (user_owns_investition(investition_id));

-- INSERT Policy
DROP POLICY IF EXISTS "Users can insert own investition_monatsdaten" ON investition_monatsdaten;
CREATE POLICY "Users can insert own investition_monatsdaten" ON investition_monatsdaten
  FOR INSERT WITH CHECK (user_owns_investition(investition_id));

-- UPDATE Policy
DROP POLICY IF EXISTS "Users can update own investition_monatsdaten" ON investition_monatsdaten;
CREATE POLICY "Users can update own investition_monatsdaten" ON investition_monatsdaten
  FOR UPDATE USING (user_owns_investition(investition_id));

-- DELETE Policy
DROP POLICY IF EXISTS "Users can delete own investition_monatsdaten" ON investition_monatsdaten;
CREATE POLICY "Users can delete own investition_monatsdaten" ON investition_monatsdaten
  FOR DELETE USING (user_owns_investition(investition_id));

-- ============================================
-- 4. RLS Policies für investition_kennzahlen
-- ============================================
ALTER TABLE investition_kennzahlen ENABLE ROW LEVEL SECURITY;

-- SELECT Policy
DROP POLICY IF EXISTS "Users can view own investition_kennzahlen" ON investition_kennzahlen;
CREATE POLICY "Users can view own investition_kennzahlen" ON investition_kennzahlen
  FOR SELECT USING (user_owns_investition(investition_id));

-- INSERT Policy
DROP POLICY IF EXISTS "Users can insert own investition_kennzahlen" ON investition_kennzahlen;
CREATE POLICY "Users can insert own investition_kennzahlen" ON investition_kennzahlen
  FOR INSERT WITH CHECK (user_owns_investition(investition_id));

-- UPDATE Policy
DROP POLICY IF EXISTS "Users can update own investition_kennzahlen" ON investition_kennzahlen;
CREATE POLICY "Users can update own investition_kennzahlen" ON investition_kennzahlen
  FOR UPDATE USING (user_owns_investition(investition_id));

-- DELETE Policy
DROP POLICY IF EXISTS "Users can delete own investition_kennzahlen" ON investition_kennzahlen;
CREATE POLICY "Users can delete own investition_kennzahlen" ON investition_kennzahlen
  FOR DELETE USING (user_owns_investition(investition_id));

-- ============================================
-- 5. Verifizierung
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ investition_monatsdaten Tabelle erstellt';
  RAISE NOTICE '✅ investition_kennzahlen Tabelle erstellt';
  RAISE NOTICE '✅ RLS Policies aktiviert';
END $$;
