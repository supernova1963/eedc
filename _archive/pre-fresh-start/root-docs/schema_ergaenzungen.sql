-- Ergänzungen zum bestehenden Schema für vollständige Auswertungen
-- Diese Tabellen fehlen aktuell und sollten ergänzt werden

-- ========================================
-- 1. STROMPREIS-STAMMDATEN
-- ========================================
-- Zentrale Verwaltung von Strompreisen mit Gültigkeitszeiträumen
CREATE TABLE public.strompreise (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  mitglied_id uuid NOT NULL,
  anlage_id uuid,  -- Optional: spezifisch für eine Anlage
  gueltig_ab date NOT NULL,
  gueltig_bis date,  -- NULL = aktuell gültig

  -- Netzbezug
  netzbezug_arbeitspreis_cent_kwh numeric NOT NULL CHECK (netzbezug_arbeitspreis_cent_kwh >= 0),
  netzbezug_grundpreis_euro_monat numeric DEFAULT 0 CHECK (netzbezug_grundpreis_euro_monat >= 0),

  -- Einspeisung
  einspeiseverguetung_cent_kwh numeric NOT NULL CHECK (einspeiseverguetung_cent_kwh >= 0),

  -- Metadaten
  anbieter_name text,
  vertragsart text,  -- z.B. 'Grundversorgung', 'Sondervertrag', 'Dynamisch'
  notizen text,
  erstellt_am timestamp with time zone DEFAULT now(),
  aktualisiert_am timestamp with time zone DEFAULT now(),

  CONSTRAINT strompreise_pkey PRIMARY KEY (id),
  CONSTRAINT strompreise_mitglied_id_fkey FOREIGN KEY (mitglied_id) REFERENCES public.mitglieder(id),
  CONSTRAINT strompreise_anlage_id_fkey FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id),
  CONSTRAINT strompreise_zeitraum_check CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab)
);

-- Index für effiziente Abfragen nach gültigem Preis zu einem bestimmten Datum
CREATE INDEX idx_strompreise_gueltig ON public.strompreise(mitglied_id, gueltig_ab, gueltig_bis);


-- ========================================
-- 2. VERKNÜPFUNG ANLAGE <-> INVESTITION
-- ========================================
-- Fehlende Spalte in alternative_investitionen ergänzen
ALTER TABLE public.alternative_investitionen
  ADD COLUMN anlage_id uuid,
  ADD CONSTRAINT alternative_investitionen_anlage_id_fkey
    FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id);

-- Index für effiziente Abfragen
CREATE INDEX idx_alternative_investitionen_anlage ON public.alternative_investitionen(anlage_id);


-- ========================================
-- 3. INVESTITIONSTYP-KONFIGURATION
-- ========================================
-- Zentrale Konfiguration für Berechnungsparameter je Investitionstyp
CREATE TABLE public.investitionstyp_config (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  typ character varying NOT NULL UNIQUE,  -- 'e-auto', 'waermepumpe', etc.

  -- Wirtschaftlichkeits-Parameter
  standardlebensdauer_jahre integer DEFAULT 20 CHECK (standardlebensdauer_jahre > 0),
  abschreibungsdauer_jahre integer DEFAULT 20 CHECK (abschreibungsdauer_jahre > 0),
  wartungskosten_prozent_pa numeric DEFAULT 1.0,  -- % der Anschaffungskosten p.a.

  -- CO2-Berechnungsparameter
  co2_faktor_kg_kwh numeric DEFAULT 0.38,  -- kg CO2 pro kWh Netzstrom vermieden

  -- Metadaten
  bezeichnung text NOT NULL,
  beschreibung text,
  aktiv boolean DEFAULT true,
  erstellt_am timestamp with time zone DEFAULT now(),

  CONSTRAINT investitionstyp_config_pkey PRIMARY KEY (id)
);

-- Basis-Daten einfügen
INSERT INTO public.investitionstyp_config (typ, bezeichnung, standardlebensdauer_jahre, co2_faktor_kg_kwh) VALUES
  ('pv-module', 'PV-Module', 25, 0.38),
  ('wechselrichter', 'Wechselrichter', 15, 0.38),
  ('speicher', 'Batteriespeicher', 15, 0.38),
  ('waermepumpe', 'Wärmepumpe', 20, 0.20),  -- Gas/Öl vermieden
  ('e-auto', 'E-Auto', 12, 0.15),  -- Benzin/Diesel vermieden
  ('balkonkraftwerk', 'Balkonkraftwerk', 20, 0.38),
  ('wallbox', 'Wallbox', 15, 0.00),
  ('sonstiges', 'Sonstiges', 20, 0.00);


-- ========================================
-- 4. WIRTSCHAFTLICHKEITS-BERECHNUNGEN
-- ========================================
-- Cache-Tabelle für berechnete Wirtschaftlichkeitskennzahlen
CREATE TABLE public.investition_kennzahlen (
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
-- 5. ANLAGEN-GESAMTBILANZ (Cache)
-- ========================================
-- Aggregierte Kennzahlen pro Anlage für schnellen Zugriff
CREATE TABLE public.anlagen_kennzahlen (
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


-- ========================================
-- 6. UNIQUE CONSTRAINTS & INDIZES
-- ========================================

-- Verhindere doppelte Monatsdaten
ALTER TABLE public.monatsdaten
  ADD CONSTRAINT monatsdaten_anlage_jahr_monat_unique
  UNIQUE (anlage_id, jahr, monat);

ALTER TABLE public.investition_monatsdaten
  ADD CONSTRAINT investition_monatsdaten_unique
  UNIQUE (investition_id, jahr, monat);

-- Performance-Indizes
CREATE INDEX idx_monatsdaten_zeitraum ON public.monatsdaten(anlage_id, jahr, monat);
CREATE INDEX idx_investition_monatsdaten_zeitraum ON public.investition_monatsdaten(investition_id, jahr, monat);
CREATE INDEX idx_alternative_investitionen_mitglied_aktiv ON public.alternative_investitionen(mitglied_id, aktiv);


-- ========================================
-- 7. VIEWS FÜR VEREINFACHTE ABFRAGEN
-- ========================================

-- Aktuell gültiger Strompreis pro Anlage
CREATE OR REPLACE VIEW public.strompreise_aktuell AS
SELECT DISTINCT ON (mitglied_id, anlage_id)
  *
FROM public.strompreise
WHERE gueltig_ab <= CURRENT_DATE
  AND (gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE)
ORDER BY mitglied_id, anlage_id, gueltig_ab DESC;


-- Gesamtübersicht Anlage mit allen Investitionen
CREATE OR REPLACE VIEW public.anlagen_komplett AS
SELECT
  a.*,
  m.vorname,
  m.nachname,
  m.email,
  COUNT(DISTINCT ai.id) as anzahl_investitionen,
  COALESCE(SUM(ai.anschaffungskosten_gesamt), 0) as investitionen_gesamt_euro
FROM public.anlagen a
LEFT JOIN public.mitglieder m ON a.mitglied_id = m.id
LEFT JOIN public.alternative_investitionen ai ON ai.anlage_id = a.id AND ai.aktiv = true
GROUP BY a.id, m.id;


-- ========================================
-- 8. FUNKTIONEN FÜR BERECHNUNGEN
-- ========================================

-- Funktion: Strompreis zu einem bestimmten Datum ermitteln
CREATE OR REPLACE FUNCTION get_strompreis(
  p_mitglied_id uuid,
  p_anlage_id uuid,
  p_datum date,
  p_typ text  -- 'netzbezug' oder 'einspeisung'
)
RETURNS numeric AS $$
DECLARE
  v_preis numeric;
BEGIN
  SELECT
    CASE
      WHEN p_typ = 'netzbezug' THEN netzbezug_arbeitspreis_cent_kwh
      WHEN p_typ = 'einspeisung' THEN einspeiseverguetung_cent_kwh
      ELSE NULL
    END INTO v_preis
  FROM public.strompreise
  WHERE mitglied_id = p_mitglied_id
    AND (anlage_id = p_anlage_id OR anlage_id IS NULL)
    AND gueltig_ab <= p_datum
    AND (gueltig_bis IS NULL OR gueltig_bis >= p_datum)
  ORDER BY
    CASE WHEN anlage_id = p_anlage_id THEN 1 ELSE 2 END,  -- Anlagenspezifisch vor global
    gueltig_ab DESC
  LIMIT 1;

  RETURN v_preis;
END;
$$ LANGUAGE plpgsql;


-- ========================================
-- KOMMENTARE
-- ========================================

COMMENT ON TABLE public.strompreise IS 'Strompreis-Stammdaten mit Gültigkeitszeiträumen für historische Auswertungen';
COMMENT ON TABLE public.investitionstyp_config IS 'Zentrale Konfiguration der Berechnungsparameter je Investitionstyp';
COMMENT ON TABLE public.investition_kennzahlen IS 'Cache für berechnete Wirtschaftlichkeitskennzahlen (wird regelmäßig aktualisiert)';
COMMENT ON TABLE public.anlagen_kennzahlen IS 'Aggregierte Kennzahlen pro Anlage für Dashboard-Anzeige';
COMMENT ON FUNCTION get_strompreis IS 'Ermittelt den gültigen Strompreis für ein bestimmtes Datum';
