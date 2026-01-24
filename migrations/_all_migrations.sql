-- Migration 01: Fügt anlage_id zu alternative_investitionen hinzu
-- Datum: 2026-01-24
-- Beschreibung: Verknüpfung zwischen Anlagen und Investitionen herstellen

-- Spalte hinzufügen
ALTER TABLE public.alternative_investitionen
ADD COLUMN IF NOT EXISTS anlage_id uuid;

-- Foreign Key Constraint
ALTER TABLE public.alternative_investitionen
DROP CONSTRAINT IF EXISTS alternative_investitionen_anlage_id_fkey;

ALTER TABLE public.alternative_investitionen
ADD CONSTRAINT alternative_investitionen_anlage_id_fkey
FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id);

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_alternative_investitionen_anlage
ON public.alternative_investitionen(anlage_id);

-- Kommentar
COMMENT ON COLUMN public.alternative_investitionen.anlage_id IS 'Verknüpfung zur zugehörigen PV-Anlage (optional für non-PV Investitionen)';
-- Migration 02: Strompreis-Stammdaten
-- Datum: 2026-01-24
-- Beschreibung: Tabelle für historische Strompreise mit Gültigkeitszeiträumen

CREATE TABLE IF NOT EXISTS public.strompreise (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  mitglied_id uuid NOT NULL,
  anlage_id uuid,
  gueltig_ab date NOT NULL,
  gueltig_bis date,

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

-- Index für effiziente Abfragen
CREATE INDEX IF NOT EXISTS idx_strompreise_gueltig
ON public.strompreise(mitglied_id, gueltig_ab, gueltig_bis);

-- Kommentare
COMMENT ON TABLE public.strompreise IS 'Strompreis-Stammdaten mit Gültigkeitszeiträumen für historische Auswertungen';
COMMENT ON COLUMN public.strompreise.anlage_id IS 'Optional: Anlagenspezifischer Preis, NULL = gilt für alle Anlagen des Mitglieds';
COMMENT ON COLUMN public.strompreise.gueltig_bis IS 'NULL = aktuell gültig, sonst Ende der Gültigkeit';
-- Migration 03: Investitionstyp-Konfiguration
-- Datum: 2026-01-24
-- Beschreibung: Zentrale Konfiguration für Berechnungsparameter je Investitionstyp

CREATE TABLE IF NOT EXISTS public.investitionstyp_config (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  typ character varying NOT NULL UNIQUE,

  -- Wirtschaftlichkeits-Parameter
  standardlebensdauer_jahre integer DEFAULT 20 CHECK (standardlebensdauer_jahre > 0),
  abschreibungsdauer_jahre integer DEFAULT 20 CHECK (abschreibungsdauer_jahre > 0),
  wartungskosten_prozent_pa numeric DEFAULT 1.0,

  -- CO2-Berechnungsparameter
  co2_faktor_kg_kwh numeric DEFAULT 0.38,

  -- Metadaten
  bezeichnung text NOT NULL,
  beschreibung text,
  aktiv boolean DEFAULT true,
  erstellt_am timestamp with time zone DEFAULT now(),

  CONSTRAINT investitionstyp_config_pkey PRIMARY KEY (id)
);

-- Basis-Daten einfügen
INSERT INTO public.investitionstyp_config (typ, bezeichnung, standardlebensdauer_jahre, co2_faktor_kg_kwh, beschreibung)
VALUES
  ('pv-module', 'PV-Module', 25, 0.38, 'Photovoltaik-Module zur Stromerzeugung'),
  ('wechselrichter', 'Wechselrichter', 15, 0.38, 'Wandelt DC-Strom der PV-Module in AC-Strom'),
  ('speicher', 'Batteriespeicher', 15, 0.38, 'Speichert überschüssigen PV-Strom'),
  ('waermepumpe', 'Wärmepumpe', 20, 0.20, 'Heizsystem, ersetzt Gas/Öl'),
  ('e-auto', 'E-Auto', 12, 0.15, 'Elektrofahrzeug, ersetzt Verbrenner'),
  ('balkonkraftwerk', 'Balkonkraftwerk', 20, 0.38, 'Mini-PV-Anlage für Balkon/Terrasse'),
  ('wallbox', 'Wallbox', 15, 0.00, 'Ladestation für E-Auto'),
  ('sonstiges', 'Sonstiges', 20, 0.00, 'Sonstige Investitionen')
ON CONFLICT (typ) DO NOTHING;

-- Kommentare
COMMENT ON TABLE public.investitionstyp_config IS 'Zentrale Konfiguration der Berechnungsparameter je Investitionstyp';
COMMENT ON COLUMN public.investitionstyp_config.co2_faktor_kg_kwh IS 'kg CO2 pro kWh die durch diese Investition eingespart werden';
COMMENT ON COLUMN public.investitionstyp_config.wartungskosten_prozent_pa IS 'Durchschnittliche Wartungskosten pro Jahr in % der Anschaffungskosten';
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
-- Migration 05: Unique Constraints und Performance-Indizes
-- Datum: 2026-01-24
-- Beschreibung: Verhindert doppelte Monatsdaten und verbessert Performance

-- ========================================
-- Unique Constraints
-- ========================================

-- Monatsdaten: Verhindere doppelte Einträge pro Anlage/Jahr/Monat
ALTER TABLE public.monatsdaten
DROP CONSTRAINT IF EXISTS monatsdaten_anlage_jahr_monat_unique;

ALTER TABLE public.monatsdaten
ADD CONSTRAINT monatsdaten_anlage_jahr_monat_unique
UNIQUE (anlage_id, jahr, monat);

-- Investition-Monatsdaten: Verhindere doppelte Einträge
ALTER TABLE public.investition_monatsdaten
DROP CONSTRAINT IF EXISTS investition_monatsdaten_unique;

ALTER TABLE public.investition_monatsdaten
ADD CONSTRAINT investition_monatsdaten_unique
UNIQUE (investition_id, jahr, monat);

-- ========================================
-- Performance-Indizes
-- ========================================

-- Monatsdaten-Abfragen nach Zeitraum
CREATE INDEX IF NOT EXISTS idx_monatsdaten_zeitraum
ON public.monatsdaten(anlage_id, jahr, monat);

-- Investition-Monatsdaten-Abfragen
CREATE INDEX IF NOT EXISTS idx_investition_monatsdaten_zeitraum
ON public.investition_monatsdaten(investition_id, jahr, monat);

-- Aktive Investitionen eines Mitglieds
CREATE INDEX IF NOT EXISTS idx_alternative_investitionen_mitglied_aktiv
ON public.alternative_investitionen(mitglied_id, aktiv);

-- Investitionen nach Typ
CREATE INDEX IF NOT EXISTS idx_alternative_investitionen_typ
ON public.alternative_investitionen(typ) WHERE aktiv = true;

-- Anlagen nach Mitglied
CREATE INDEX IF NOT EXISTS idx_anlagen_mitglied_aktiv
ON public.anlagen(mitglied_id, aktiv);

-- Kommentare
COMMENT ON INDEX public.idx_monatsdaten_zeitraum IS 'Beschleunigt Zeitraum-Abfragen für Monatsdaten';
COMMENT ON INDEX public.idx_investition_monatsdaten_zeitraum IS 'Beschleunigt Zeitraum-Abfragen für Investition-Monatsdaten';
-- Migration 06: Views für vereinfachte Abfragen
-- Datum: 2026-01-24
-- Beschreibung: Erstellt Views für häufige Abfragen

-- ========================================
-- View: Aktuell gültige Strompreise
-- ========================================
DROP VIEW IF EXISTS public.strompreise_aktuell;

CREATE VIEW public.strompreise_aktuell AS
SELECT DISTINCT ON (mitglied_id, COALESCE(anlage_id, '00000000-0000-0000-0000-000000000000'::uuid))
  *
FROM public.strompreise
WHERE gueltig_ab <= CURRENT_DATE
  AND (gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE)
ORDER BY
  mitglied_id,
  COALESCE(anlage_id, '00000000-0000-0000-0000-000000000000'::uuid),
  gueltig_ab DESC;

COMMENT ON VIEW public.strompreise_aktuell IS 'Zeigt nur die aktuell gültigen Strompreise pro Mitglied/Anlage';

-- ========================================
-- View: Anlagen-Übersicht mit Investitionen
-- ========================================
DROP VIEW IF EXISTS public.anlagen_komplett;

CREATE VIEW public.anlagen_komplett AS
SELECT
  a.id,
  a.mitglied_id,
  a.anlagenname,
  a.anlagentyp,
  a.installationsdatum,
  a.leistung_kwp,
  a.standort_plz,
  a.standort_ort,
  a.aktiv,
  a.erstellt_am,
  m.vorname,
  m.nachname,
  m.email,
  COUNT(DISTINCT ai.id) as anzahl_investitionen,
  COALESCE(SUM(ai.anschaffungskosten_gesamt), 0) as investitionen_gesamt_euro,
  COALESCE(SUM(ai.anschaffungskosten_relevant), 0) as investitionen_relevant_euro
FROM public.anlagen a
LEFT JOIN public.mitglieder m ON a.mitglied_id = m.id
LEFT JOIN public.alternative_investitionen ai ON ai.anlage_id = a.id AND ai.aktiv = true
GROUP BY a.id, m.id, m.vorname, m.nachname, m.email;

COMMENT ON VIEW public.anlagen_komplett IS 'Anlagen-Übersicht mit Mitgliedsdaten und aggregierten Investitionskennzahlen';

-- ========================================
-- View: Investitions-Übersicht
-- ========================================
DROP VIEW IF EXISTS public.investitionen_uebersicht;

CREATE VIEW public.investitionen_uebersicht AS
SELECT
  ai.*,
  m.vorname,
  m.nachname,
  m.email,
  a.anlagenname,
  a.leistung_kwp as anlage_leistung_kwp,
  k.amortisationszeit_monate,
  k.roi_prozent,
  k.bilanz_kumuliert_euro,
  k.co2_einsparung_kumuliert_kg,
  k.berechnet_am as kennzahlen_stand
FROM public.alternative_investitionen ai
LEFT JOIN public.mitglieder m ON ai.mitglied_id = m.id
LEFT JOIN public.anlagen a ON ai.anlage_id = a.id
LEFT JOIN public.investition_kennzahlen k ON ai.id = k.investition_id
WHERE ai.aktiv = true;

COMMENT ON VIEW public.investitionen_uebersicht IS 'Komplette Investitionsübersicht mit Mitglied, Anlage und Kennzahlen';

-- ========================================
-- View: Monatsdaten mit Kennzahlen
-- ========================================
DROP VIEW IF EXISTS public.monatsdaten_erweitert;

CREATE VIEW public.monatsdaten_erweitert AS
SELECT
  md.*,
  a.anlagenname,
  a.leistung_kwp,
  m.vorname,
  m.nachname,
  -- Berechnete Kennzahlen
  CASE
    WHEN md.pv_erzeugung_kwh > 0
    THEN ((md.direktverbrauch_kwh + md.batterieentladung_kwh) / md.pv_erzeugung_kwh * 100)
    ELSE 0
  END as eigenverbrauchsquote_prozent,
  CASE
    WHEN md.gesamtverbrauch_kwh > 0
    THEN ((md.direktverbrauch_kwh + md.batterieentladung_kwh) / md.gesamtverbrauch_kwh * 100)
    ELSE 0
  END as autarkiegrad_prozent,
  (md.einspeisung_ertrag_euro - md.netzbezug_kosten_euro - md.betriebsausgaben_monat_euro) as netto_ertrag_euro
FROM public.monatsdaten md
LEFT JOIN public.anlagen a ON md.anlage_id = a.id
LEFT JOIN public.mitglieder m ON md.mitglied_id = m.id;

COMMENT ON VIEW public.monatsdaten_erweitert IS 'Monatsdaten mit berechneten Kennzahlen und Anlagen-/Mitgliedsinformationen';
-- Migration 07: Hilfsfunktionen für Berechnungen
-- Datum: 2026-01-24
-- Beschreibung: Stored Functions für wiederkehrende Berechnungen

-- ========================================
-- Funktion: Strompreis zu einem Datum ermitteln
-- ========================================
DROP FUNCTION IF EXISTS get_strompreis(uuid, uuid, date, text);

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
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_strompreis IS 'Ermittelt den gültigen Strompreis für ein bestimmtes Datum. Priorisiert anlagenspezifische Preise.';


-- ========================================
-- Funktion: Monatliche Einsparung berechnen
-- ========================================
DROP FUNCTION IF EXISTS berechne_monatliche_einsparung(uuid, integer, integer);

CREATE OR REPLACE FUNCTION berechne_monatliche_einsparung(
  p_anlage_id uuid,
  p_jahr integer,
  p_monat integer
)
RETURNS TABLE (
  eigenverbrauch_kwh numeric,
  eigenverbrauch_wert_euro numeric,
  einspeisung_wert_euro numeric,
  netzbezug_kosten_euro numeric,
  einsparung_brutto_euro numeric,
  einsparung_netto_euro numeric
) AS $$
DECLARE
  v_mitglied_id uuid;
  v_datum date;
  v_netzbezug_preis numeric;
  v_einspeisung_preis numeric;
BEGIN
  -- Mitglied und Datum ermitteln
  SELECT mitglied_id INTO v_mitglied_id FROM public.anlagen WHERE id = p_anlage_id;
  v_datum := make_date(p_jahr, p_monat, 1);

  -- Strompreise ermitteln
  v_netzbezug_preis := get_strompreis(v_mitglied_id, p_anlage_id, v_datum, 'netzbezug');
  v_einspeisung_preis := get_strompreis(v_mitglied_id, p_anlage_id, v_datum, 'einspeisung');

  RETURN QUERY
  SELECT
    (md.direktverbrauch_kwh + md.batterieentladung_kwh) as eigenverbrauch_kwh,
    (md.direktverbrauch_kwh + md.batterieentladung_kwh) * COALESCE(v_netzbezug_preis, 0) / 100 as eigenverbrauch_wert_euro,
    md.einspeisung_kwh * COALESCE(v_einspeisung_preis, 0) / 100 as einspeisung_wert_euro,
    md.netzbezug_kwh * COALESCE(v_netzbezug_preis, 0) / 100 as netzbezug_kosten_euro,
    ((md.direktverbrauch_kwh + md.batterieentladung_kwh) * COALESCE(v_netzbezug_preis, 0) / 100 +
     md.einspeisung_kwh * COALESCE(v_einspeisung_preis, 0) / 100) as einsparung_brutto_euro,
    ((md.direktverbrauch_kwh + md.batterieentladung_kwh) * COALESCE(v_netzbezug_preis, 0) / 100 +
     md.einspeisung_kwh * COALESCE(v_einspeisung_preis, 0) / 100 -
     md.netzbezug_kwh * COALESCE(v_netzbezug_preis, 0) / 100 -
     md.betriebsausgaben_monat_euro) as einsparung_netto_euro
  FROM public.monatsdaten md
  WHERE md.anlage_id = p_anlage_id
    AND md.jahr = p_jahr
    AND md.monat = p_monat;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION berechne_monatliche_einsparung IS 'Berechnet detaillierte Einsparungen für einen Monat basierend auf aktuellen Strompreisen';


-- ========================================
-- Funktion: CO2-Einsparung in Bäume umrechnen
-- ========================================
DROP FUNCTION IF EXISTS co2_zu_baeume(numeric);

CREATE OR REPLACE FUNCTION co2_zu_baeume(p_co2_kg numeric)
RETURNS integer AS $$
BEGIN
  -- 1 Baum bindet ca. 10 kg CO2 pro Jahr
  RETURN FLOOR(p_co2_kg / 10)::integer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION co2_zu_baeume IS 'Rechnet CO2-Einsparung in kg in Anzahl Bäume um (1 Baum ≈ 10kg CO2/Jahr)';


-- ========================================
-- Funktion: Aktualisiere Investitions-Kennzahlen
-- ========================================
DROP FUNCTION IF EXISTS aktualisiere_investition_kennzahlen(uuid);

CREATE OR REPLACE FUNCTION aktualisiere_investition_kennzahlen(p_investition_id uuid)
RETURNS void AS $$
DECLARE
  v_einsparung_kumuliert numeric;
  v_kosten_kumuliert numeric;
  v_co2_kumuliert numeric;
  v_anschaffungskosten numeric;
  v_amortisationszeit numeric;
  v_roi numeric;
  v_bis_jahr integer;
  v_bis_monat integer;
BEGIN
  -- Hole Anschaffungskosten
  SELECT anschaffungskosten_relevant INTO v_anschaffungskosten
  FROM public.alternative_investitionen
  WHERE id = p_investition_id;

  -- Aggregiere Monatsdaten
  SELECT
    COALESCE(SUM(einsparung_monat_euro), 0),
    COALESCE(SUM(betriebsausgaben_monat_euro), 0),
    COALESCE(SUM(co2_einsparung_kg), 0),
    MAX(jahr),
    MAX(monat)
  INTO v_einsparung_kumuliert, v_kosten_kumuliert, v_co2_kumuliert, v_bis_jahr, v_bis_monat
  FROM public.investition_monatsdaten
  WHERE investition_id = p_investition_id;

  -- Berechne Amortisation
  IF v_einsparung_kumuliert >= v_anschaffungskosten THEN
    -- Bereits amortisiert - ermittle wann
    SELECT COUNT(*) INTO v_amortisationszeit
    FROM (
      SELECT
        SUM(einsparung_monat_euro) OVER (ORDER BY jahr, monat) as kumuliert
      FROM public.investition_monatsdaten
      WHERE investition_id = p_investition_id
    ) sub
    WHERE kumuliert < v_anschaffungskosten;
  ELSE
    v_amortisationszeit := NULL;
  END IF;

  -- Berechne ROI
  IF v_anschaffungskosten > 0 THEN
    v_roi := (v_einsparung_kumuliert - v_kosten_kumuliert - v_anschaffungskosten) / v_anschaffungskosten * 100;
  ELSE
    v_roi := NULL;
  END IF;

  -- Upsert Kennzahlen
  INSERT INTO public.investition_kennzahlen (
    investition_id,
    bis_jahr,
    bis_monat,
    einsparung_kumuliert_euro,
    kosten_kumuliert_euro,
    bilanz_kumuliert_euro,
    amortisationszeit_monate,
    roi_prozent,
    co2_einsparung_kumuliert_kg,
    baeume_aequivalent,
    berechnet_am
  )
  VALUES (
    p_investition_id,
    COALESCE(v_bis_jahr, EXTRACT(YEAR FROM CURRENT_DATE)::integer),
    COALESCE(v_bis_monat, EXTRACT(MONTH FROM CURRENT_DATE)::integer),
    v_einsparung_kumuliert,
    v_kosten_kumuliert,
    v_einsparung_kumuliert - v_kosten_kumuliert - v_anschaffungskosten,
    v_amortisationszeit,
    v_roi,
    v_co2_kumuliert,
    co2_zu_baeume(v_co2_kumuliert),
    now()
  )
  ON CONFLICT (investition_id)
  DO UPDATE SET
    bis_jahr = EXCLUDED.bis_jahr,
    bis_monat = EXCLUDED.bis_monat,
    einsparung_kumuliert_euro = EXCLUDED.einsparung_kumuliert_euro,
    kosten_kumuliert_euro = EXCLUDED.kosten_kumuliert_euro,
    bilanz_kumuliert_euro = EXCLUDED.bilanz_kumuliert_euro,
    amortisationszeit_monate = EXCLUDED.amortisationszeit_monate,
    roi_prozent = EXCLUDED.roi_prozent,
    co2_einsparung_kumuliert_kg = EXCLUDED.co2_einsparung_kumuliert_kg,
    baeume_aequivalent = EXCLUDED.baeume_aequivalent,
    berechnet_am = EXCLUDED.berechnet_am;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aktualisiere_investition_kennzahlen IS 'Berechnet und speichert alle Wirtschaftlichkeitskennzahlen für eine Investition';
