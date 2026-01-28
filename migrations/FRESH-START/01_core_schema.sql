-- ============================================
-- MIGRATION 01: Core Schema
-- ============================================
-- Datum: 2026-01-28
-- Beschreibung: Erstellt neue Tabellen-Struktur
-- Community-First Design mit Multi-Anlage Support
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. mitglieder (User Profile)
-- ============================================
CREATE TABLE mitglieder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Auth Verknüpfung (SINGLE SOURCE OF TRUTH!)
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,

  -- Profil
  vorname text NOT NULL,
  nachname text NOT NULL,
  display_name text, -- Optional: öffentlicher Anzeigename (z.B. Pseudonym)

  -- Adresse (optional, für Haushalt)
  strasse text,
  plz text,
  ort text,
  land text DEFAULT 'Deutschland',

  -- Community
  profil_oeffentlich boolean DEFAULT false,
  bio text,
  website text,

  -- System
  aktiv boolean DEFAULT true,
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

CREATE INDEX idx_mitglieder_email ON mitglieder(email);
CREATE INDEX idx_mitglieder_auth_user_id ON mitglieder(auth_user_id);
CREATE INDEX idx_mitglieder_profil_oeffentlich ON mitglieder(profil_oeffentlich) WHERE profil_oeffentlich = true;

COMMENT ON TABLE mitglieder IS 'User-Profile mit Auth-Verknüpfung - Community-First';
COMMENT ON COLUMN mitglieder.auth_user_id IS 'Verknüpfung zu auth.users - SINGLE SOURCE OF TRUTH für Auth';
COMMENT ON COLUMN mitglieder.display_name IS 'Öffentlicher Anzeigename (optional, sonst Vorname + Nachname)';

-- ============================================
-- 2. anlagen (PV-Anlagen)
-- ============================================
CREATE TABLE anlagen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitglied_id uuid NOT NULL REFERENCES mitglieder(id) ON DELETE CASCADE,

  -- Basis-Info
  anlagenname text NOT NULL,
  beschreibung text,
  anlagentyp text DEFAULT 'Solar', -- Solar, Wind, Hybrid

  -- Technische Daten
  leistung_kwp numeric NOT NULL CHECK (leistung_kwp > 0),
  installationsdatum date NOT NULL,
  inbetriebnahme_datum date, -- Kann abweichen von Installation

  -- Standort
  standort_strasse text,
  standort_plz text,
  standort_ort text,
  standort_land text DEFAULT 'Deutschland',
  standort_latitude numeric,
  standort_longitude numeric,

  -- PV-Spezifisch
  hersteller_module text,
  anzahl_module integer,
  ausrichtung text, -- Süd, Süd-West, Ost-West, etc.
  neigungswinkel_grad integer,

  -- Finanziell
  anschaffungskosten_euro numeric,
  einspeiseverguetung_cent_kwh numeric,
  foerderung_euro numeric,

  -- Community & Privacy (alle in einer Tabelle statt separate anlagen_freigaben!)
  oeffentlich boolean DEFAULT false, -- Master-Switch
  standort_genau_anzeigen boolean DEFAULT false, -- Genaue Koordinaten oder nur PLZ-Bereich
  kennzahlen_oeffentlich boolean DEFAULT false,
  monatsdaten_oeffentlich boolean DEFAULT false,
  komponenten_oeffentlich boolean DEFAULT false,

  -- System
  aktiv boolean DEFAULT true,
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

CREATE INDEX idx_anlagen_mitglied ON anlagen(mitglied_id);
CREATE INDEX idx_anlagen_oeffentlich ON anlagen(oeffentlich) WHERE oeffentlich = true;
CREATE INDEX idx_anlagen_plz ON anlagen(standort_plz) WHERE oeffentlich = true;
CREATE INDEX idx_anlagen_installationsdatum ON anlagen(installationsdatum DESC);

COMMENT ON TABLE anlagen IS 'PV-Anlagen - User kann mehrere haben (Multi-Anlage)';
COMMENT ON COLUMN anlagen.oeffentlich IS 'Master-Switch: Anlage im Community-Bereich sichtbar';

-- ============================================
-- 3. anlagen_komponenten (Speicher, Wechselrichter, etc.)
-- ============================================
CREATE TABLE anlagen_komponenten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anlage_id uuid NOT NULL REFERENCES anlagen(id) ON DELETE CASCADE,

  -- Typ & Basis
  typ text NOT NULL, -- speicher, wechselrichter, optimizer, wallbox, modul
  bezeichnung text NOT NULL,
  beschreibung text,

  -- Technische Daten (JSON für Flexibilität)
  technische_daten jsonb DEFAULT '{}'::jsonb,
  -- Beispiele:
  -- Speicher: { "kapazitaet_kwh": 10, "max_ladeleistung_kw": 5 }
  -- Wechselrichter: { "nennleistung_kw": 8, "wirkungsgrad": 0.97 }
  -- Wallbox: { "ladeleistung_kw": 11, "phasen": 3 }

  -- Finanziell
  anschaffungsdatum date NOT NULL,
  anschaffungskosten_euro numeric,
  foerderung_euro numeric,

  -- Hersteller
  hersteller text,
  modell text,
  seriennummer text,

  -- System
  aktiv boolean DEFAULT true,
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

CREATE INDEX idx_anlagen_komponenten_anlage ON anlagen_komponenten(anlage_id);
CREATE INDEX idx_anlagen_komponenten_typ ON anlagen_komponenten(typ);

COMMENT ON TABLE anlagen_komponenten IS 'Komponenten die zur PV-Anlage gehören (Speicher, WR, Wallbox, etc.)';
COMMENT ON COLUMN anlagen_komponenten.technische_daten IS 'JSON mit typ-spezifischen Daten';

-- ============================================
-- 4. haushalt_komponenten (E-Auto, Wärmepumpe, etc.)
-- ============================================
CREATE TABLE haushalt_komponenten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitglied_id uuid NOT NULL REFERENCES mitglieder(id) ON DELETE CASCADE,

  -- Optional: Verknüpfung zu Anlage (für Energie-Herkunft)
  hauptanlage_id uuid REFERENCES anlagen(id) ON DELETE SET NULL,

  -- Typ & Basis
  typ text NOT NULL, -- e-auto, waermepumpe, klimaanlage, pool
  bezeichnung text NOT NULL,
  beschreibung text,

  -- Technische Daten (JSON)
  technische_daten jsonb DEFAULT '{}'::jsonb,
  -- Beispiele:
  -- E-Auto: { "batteriekapazitaet_kwh": 60, "verbrauch_kwh_100km": 18 }
  -- Wärmepumpe: { "heizleistung_kw": 8, "cop": 4.5, "typ": "luft-wasser" }

  -- Alternative (was wurde ersetzt?)
  ersetzt_technologie text, -- z.B. "Verbrenner-PKW", "Gas-Heizung"
  alternative_kosten_jahr jsonb, -- Kosten der alten Technologie

  -- Finanziell
  anschaffungsdatum date NOT NULL,
  anschaffungskosten_euro numeric,
  foerderung_euro numeric,

  -- Hersteller
  hersteller text,
  modell text,

  -- Community
  oeffentlich boolean DEFAULT false,

  -- System
  aktiv boolean DEFAULT true,
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now()
);

CREATE INDEX idx_haushalt_komponenten_mitglied ON haushalt_komponenten(mitglied_id);
CREATE INDEX idx_haushalt_komponenten_typ ON haushalt_komponenten(typ);
CREATE INDEX idx_haushalt_komponenten_oeffentlich ON haushalt_komponenten(oeffentlich) WHERE oeffentlich = true;

COMMENT ON TABLE haushalt_komponenten IS 'Komponenten die zum Haushalt gehören (E-Auto, WP, etc.) - NICHT zur Anlage!';
COMMENT ON COLUMN haushalt_komponenten.hauptanlage_id IS 'Optional: Welche Anlage versorgt primär diese Komponente';

-- ============================================
-- 5. monatsdaten (PV-Anlage Monatsdaten)
-- ============================================
CREATE TABLE monatsdaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anlage_id uuid NOT NULL REFERENCES anlagen(id) ON DELETE CASCADE,

  -- Zeitraum
  jahr integer NOT NULL CHECK (jahr >= 2000 AND jahr <= 2100),
  monat integer NOT NULL CHECK (monat >= 1 AND monat <= 12),

  -- Energie-Flüsse (kWh)
  pv_erzeugung_kwh numeric DEFAULT 0 CHECK (pv_erzeugung_kwh >= 0),
  direktverbrauch_kwh numeric DEFAULT 0 CHECK (direktverbrauch_kwh >= 0),
  batterieladung_kwh numeric DEFAULT 0 CHECK (batterieladung_kwh >= 0),
  batterieentladung_kwh numeric DEFAULT 0 CHECK (batterieentladung_kwh >= 0),
  einspeisung_kwh numeric DEFAULT 0 CHECK (einspeisung_kwh >= 0),
  netzbezug_kwh numeric DEFAULT 0 CHECK (netzbezug_kwh >= 0),
  gesamtverbrauch_kwh numeric DEFAULT 0 CHECK (gesamtverbrauch_kwh >= 0),

  -- Finanzen (EUR)
  einspeisung_ertrag_euro numeric DEFAULT 0,
  netzbezug_kosten_euro numeric DEFAULT 0,
  betriebsausgaben_monat_euro numeric DEFAULT 0,

  -- Strompreis (für historische Auswertungen)
  netzbezug_preis_cent_kwh numeric,
  einspeisung_preis_cent_kwh numeric,

  -- Wetter (optional)
  sonnenstunden numeric,
  globalstrahlung_kwh_m2 numeric,

  -- Metadaten
  notizen text,
  datenquelle text, -- manuell, csv-import, api, etc.
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),

  UNIQUE(anlage_id, jahr, monat)
);

CREATE INDEX idx_monatsdaten_anlage_zeit ON monatsdaten(anlage_id, jahr DESC, monat DESC);

COMMENT ON TABLE monatsdaten IS 'Monatliche Energie- und Finanzdaten pro Anlage';

-- ============================================
-- 6. komponenten_monatsdaten (E-Auto, WP Monatsdaten)
-- ============================================
CREATE TABLE komponenten_monatsdaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  komponente_id uuid NOT NULL REFERENCES haushalt_komponenten(id) ON DELETE CASCADE,

  -- Zeitraum
  jahr integer NOT NULL CHECK (jahr >= 2000 AND jahr <= 2100),
  monat integer NOT NULL CHECK (monat >= 1 AND monat <= 12),

  -- Verbrauch & Daten (JSON für Flexibilität je Typ)
  verbrauch_daten jsonb DEFAULT '{}'::jsonb,
  -- E-Auto: { "km_gefahren": 1500, "verbrauch_kwh": 270, "ladekosten_euro": 45 }
  -- WP: { "heizenergie_kwh": 600, "warmwasser_kwh": 150, "betriebsstunden": 720 }

  -- Kosten
  energiekosten_euro numeric DEFAULT 0,
  wartungskosten_euro numeric DEFAULT 0,

  -- Alternative Kosten (wenn Component alte Technologie ersetzt)
  alternative_kosten_euro numeric, -- Was hätte alte Technologie gekostet?
  einsparung_euro numeric, -- Differenz

  -- CO2
  co2_einsparung_kg numeric,

  -- Metadaten
  notizen text,
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),

  UNIQUE(komponente_id, jahr, monat)
);

CREATE INDEX idx_komponenten_monatsdaten_komponente_zeit
  ON komponenten_monatsdaten(komponente_id, jahr DESC, monat DESC);

COMMENT ON TABLE komponenten_monatsdaten IS 'Monatsdaten für Haushalts-Komponenten (E-Auto, WP, etc.)';

-- ============================================
-- 7. anlagen_kennzahlen (Aggregierte Kennzahlen - Cache)
-- ============================================
CREATE TABLE anlagen_kennzahlen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anlage_id uuid NOT NULL UNIQUE REFERENCES anlagen(id) ON DELETE CASCADE,

  -- Berechnungsstand
  berechnet_am timestamptz DEFAULT now(),
  bis_jahr integer NOT NULL,
  bis_monat integer NOT NULL,

  -- Lebenszeitdaten
  pv_erzeugung_gesamt_kwh numeric DEFAULT 0,
  eigenverbrauch_gesamt_kwh numeric DEFAULT 0,
  einspeisung_gesamt_kwh numeric DEFAULT 0,
  netzbezug_gesamt_kwh numeric DEFAULT 0,

  -- Durchschnittswerte
  autarkiegrad_prozent numeric,
  eigenverbrauchsquote_prozent numeric,

  -- Finanzen
  einspeiseerloese_gesamt_euro numeric DEFAULT 0,
  netzbezugskosten_gesamt_euro numeric DEFAULT 0,
  betriebskosten_gesamt_euro numeric DEFAULT 0,
  investitionskosten_gesamt_euro numeric DEFAULT 0,
  gesamtbilanz_euro numeric DEFAULT 0,

  -- ROI
  amortisationszeit_monate numeric,
  roi_prozent numeric,

  -- CO2
  co2_einsparung_gesamt_kg numeric DEFAULT 0,
  co2_vermeidungskosten_euro_tonne numeric, -- Kosten pro Tonne vermiedenes CO2

  -- Anzahl Monate mit Daten
  anzahl_monate_mit_daten integer DEFAULT 0
);

COMMENT ON TABLE anlagen_kennzahlen IS 'Aggregierte Kennzahlen pro Anlage (Cache für Performance)';

-- ============================================
-- 8. komponenten_typen (Master Data)
-- ============================================
CREATE TABLE komponenten_typen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  typ_code text NOT NULL UNIQUE, -- speicher, wechselrichter, e-auto, etc.
  kategorie text NOT NULL, -- 'anlage' oder 'haushalt'

  -- Anzeige
  bezeichnung text NOT NULL,
  beschreibung text,
  icon text, -- Icon-Name für UI

  -- Berechnungs-Parameter
  standardlebensdauer_jahre integer DEFAULT 20,
  co2_faktor_kg_kwh numeric DEFAULT 0.38,
  wartungskosten_prozent_pa numeric DEFAULT 1.0,

  -- Technische Felder (JSON Schema für Validierung)
  technische_felder_schema jsonb,

  -- System
  aktiv boolean DEFAULT true,
  sortierung integer DEFAULT 0,
  erstellt_am timestamptz DEFAULT now()
);

CREATE INDEX idx_komponenten_typen_kategorie ON komponenten_typen(kategorie);
CREATE INDEX idx_komponenten_typen_aktiv ON komponenten_typen(aktiv) WHERE aktiv = true;

COMMENT ON TABLE komponenten_typen IS 'Master Data für Komponenten-Typen mit Berechnungsparametern';

-- ============================================
-- 9. strompreise (Master Data / User Data)
-- ============================================
CREATE TABLE strompreise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: global oder user-spezifisch
  mitglied_id uuid REFERENCES mitglieder(id) ON DELETE CASCADE,
  -- NULL = globaler Preis (z.B. durchschnittlicher Marktpreis)
  -- NOT NULL = user-spezifischer Preis

  -- Optional: Anlagen-spezifisch
  anlage_id uuid REFERENCES anlagen(id) ON DELETE CASCADE,

  -- Gültigkeit
  gueltig_ab date NOT NULL,
  gueltig_bis date, -- NULL = aktuell gültig

  -- Preise
  netzbezug_arbeitspreis_cent_kwh numeric NOT NULL CHECK (netzbezug_arbeitspreis_cent_kwh >= 0),
  netzbezug_grundpreis_euro_monat numeric DEFAULT 0 CHECK (netzbezug_grundpreis_euro_monat >= 0),
  einspeiseverguetung_cent_kwh numeric NOT NULL CHECK (einspeiseverguetung_cent_kwh >= 0),

  -- Anbieter-Info
  anbieter_name text,
  tarifname text,
  vertragsart text, -- Grundversorgung, Sondervertrag, Dynamisch

  -- Metadaten
  notizen text,
  erstellt_am timestamptz DEFAULT now(),
  aktualisiert_am timestamptz DEFAULT now(),

  CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab)
);

CREATE INDEX idx_strompreise_mitglied ON strompreise(mitglied_id);
CREATE INDEX idx_strompreise_anlage ON strompreise(anlage_id);
CREATE INDEX idx_strompreise_gueltig ON strompreise(gueltig_ab, gueltig_bis);

COMMENT ON TABLE strompreise IS 'Strompreise - global oder user-spezifisch';
COMMENT ON COLUMN strompreise.mitglied_id IS 'NULL = globaler Preis, NOT NULL = user-spezifisch';

-- ============================================
-- VERIFIZIERUNG
-- ============================================
DO $$
DECLARE
  table_count integer;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

  RAISE NOTICE 'Core schema created successfully. Tables created: %', table_count;
END $$;
