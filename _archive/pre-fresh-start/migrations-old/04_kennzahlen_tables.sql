-- Migration 04: Kennzahlen-Tabellen (Cache)
-- Datum: 2026-01-24
-- Beschreibung: Cache-Tabellen für berechnete Wirtschaftlichkeits- und Anlagenkennzahlen

-- ========================================
-- Investitions-Kennzahlen
-- ========================================
CREATE TABLE IF NOT EXISTS public.investition_kennzahlen (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  investition_id uuid NOT NULL UNIQUE,

  -- Berechnungsstand
  berechnet_am timestamp with time zone DEFAULT now(),
  bis_jahr integer NOT NULL,
  bis_monat integer NOT NULL,

  -- Wirtschaftlichkeit (kumuliert)
  einsparung_kumuliert_euro numeric DEFAULT 0,
  kosten_kumuliert_euro numeric DEFAULT 0,
  bilanz_kumuliert_euro numeric DEFAULT 0,  -- Einsparung - Kosten

  -- ROI-Kennzahlen
  amortisationszeit_monate numeric,  -- NULL = noch nicht amortisiert
  roi_prozent numeric,  -- Return on Investment

  -- CO2
  co2_einsparung_kumuliert_kg numeric DEFAULT 0,
  baeume_aequivalent integer DEFAULT 0,  -- 1 Baum bindet ~10kg CO2/Jahr

  -- Prognose
  amortisiert_voraussichtlich_am date,

  CONSTRAINT investition_kennzahlen_pkey PRIMARY KEY (id),
  CONSTRAINT investition_kennzahlen_investition_id_fkey
    FOREIGN KEY (investition_id) REFERENCES public.alternative_investitionen(id) ON DELETE CASCADE
);

-- ========================================
-- Anlagen-Kennzahlen
-- ========================================
CREATE TABLE IF NOT EXISTS public.anlagen_kennzahlen (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  anlage_id uuid NOT NULL UNIQUE,

  -- Berechnungsstand
  berechnet_am timestamp with time zone DEFAULT now(),
  bis_jahr integer NOT NULL,
  bis_monat integer NOT NULL,

  -- Gesamtkennzahlen (kumuliert seit Inbetriebnahme)
  pv_erzeugung_gesamt_kwh numeric DEFAULT 0,
  eigenverbrauch_gesamt_kwh numeric DEFAULT 0,
  einspeisung_gesamt_kwh numeric DEFAULT 0,
  netzbezug_gesamt_kwh numeric DEFAULT 0,

  -- Durchschnittswerte
  autarkiegrad_durchschnitt_prozent numeric,
  eigenverbrauchsquote_durchschnitt_prozent numeric,

  -- Finanzen (kumuliert)
  einspeiseerloese_gesamt_euro numeric DEFAULT 0,
  netzbezugskosten_gesamt_euro numeric DEFAULT 0,
  betriebsausgaben_gesamt_euro numeric DEFAULT 0,

  -- Investitionen (kumuliert)
  investitionskosten_gesamt_euro numeric DEFAULT 0,
  einsparungen_gesamt_euro numeric DEFAULT 0,
  bilanz_gesamt_euro numeric DEFAULT 0,

  -- CO2
  co2_einsparung_gesamt_kg numeric DEFAULT 0,

  CONSTRAINT anlagen_kennzahlen_pkey PRIMARY KEY (id),
  CONSTRAINT anlagen_kennzahlen_anlage_id_fkey
    FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id) ON DELETE CASCADE
);

-- Kommentare
COMMENT ON TABLE public.investition_kennzahlen IS 'Cache für berechnete Wirtschaftlichkeitskennzahlen (wird regelmäßig aktualisiert)';
COMMENT ON TABLE public.anlagen_kennzahlen IS 'Aggregierte Kennzahlen pro Anlage für Dashboard-Anzeige';
COMMENT ON COLUMN public.investition_kennzahlen.baeume_aequivalent IS 'Anzahl Bäume die 1 Jahr lang CO2 binden müssten (1 Baum ≈ 10kg/Jahr)';
