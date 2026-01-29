-- ============================================
-- COMPLETE DATABASE SCHEMA CREATION
-- ============================================
-- Dieses Script erstellt alle notwendigen Tabellen
-- basierend auf dem aktuellen Production-Schema
-- ============================================

-- ⚠️ WARNUNG: Dieses Script löscht alle existierenden Tabellen!
-- Verwenden Sie reset-all-data.sql wenn Sie nur Daten löschen wollen

-- ============================================
-- SCHRITT 0: Alte Tabellen löschen (in richtiger Reihenfolge)
-- ============================================
DROP TABLE IF EXISTS wetterdaten CASCADE;
DROP TABLE IF EXISTS investition_monatsdaten CASCADE;
DROP TABLE IF EXISTS investition_kennzahlen CASCADE;
DROP TABLE IF EXISTS anlagen_kennzahlen CASCADE;
DROP TABLE IF EXISTS monatsdaten CASCADE;
DROP TABLE IF EXISTS investitionen CASCADE;
DROP TABLE IF EXISTS alternative_investitionen CASCADE;
DROP TABLE IF EXISTS anlagen_freigaben CASCADE;
DROP TABLE IF EXISTS anlagen CASCADE;
DROP TABLE IF EXISTS mitglieder CASCADE;
DROP TABLE IF EXISTS strompreise CASCADE;
DROP TABLE IF EXISTS investitionstyp_config CASCADE;
DROP TABLE IF EXISTS investitionstypen CASCADE;

-- ============================================
-- 1. INVESTITIONSTYPEN (Master Data)
-- ============================================
CREATE TABLE investitionstypen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typ TEXT NOT NULL UNIQUE,
  beschreibung TEXT,
  aktiv BOOLEAN DEFAULT true,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. INVESTITIONSTYP_CONFIG (Configuration)
-- ============================================
CREATE TABLE investitionstyp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  typ VARCHAR NOT NULL UNIQUE,
  standardlebensdauer_jahre INTEGER DEFAULT 20 CHECK (standardlebensdauer_jahre > 0),
  abschreibungsdauer_jahre INTEGER DEFAULT 20 CHECK (abschreibungsdauer_jahre > 0),
  wartungskosten_prozent_pa NUMERIC DEFAULT 1.0,
  co2_faktor_kg_kwh NUMERIC DEFAULT 0.38,
  bezeichnung TEXT NOT NULL,
  beschreibung TEXT,
  aktiv BOOLEAN DEFAULT true,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. STROMPREISE (Master Data)
-- ============================================
CREATE TABLE strompreise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gueltig_ab DATE NOT NULL,
  preis_cent_kwh NUMERIC NOT NULL,
  anbieter TEXT,
  tarif TEXT,
  grundgebuehr_euro NUMERIC,
  notizen TEXT,
  aktiv BOOLEAN DEFAULT true,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. MITGLIEDER (Core Data)
-- ============================================
CREATE TABLE mitglieder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  telefon TEXT,
  aktiv BOOLEAN DEFAULT true,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für Email-Suche
CREATE INDEX idx_mitglieder_email ON mitglieder(email);

-- ============================================
-- 5. ANLAGEN (Core Data)
-- ============================================
CREATE TABLE anlagen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitglied_id UUID NOT NULL REFERENCES mitglieder(id),
  anlagenname TEXT NOT NULL,
  anlagentyp TEXT,
  leistung_kwp NUMERIC,
  installationsdatum DATE,
  standort_plz TEXT,
  standort_ort TEXT,
  standort_strasse TEXT,
  standort_land TEXT DEFAULT 'Deutschland',
  standort_latitude NUMERIC,
  standort_longitude NUMERIC,
  standort_genau BOOLEAN DEFAULT false,
  nennleistung_kwp NUMERIC,
  inbetriebnahme_datum DATE,
  hersteller_module TEXT,
  hersteller_wechselrichter TEXT,
  anzahl_module INTEGER,
  ausrichtung TEXT,
  neigungswinkel INTEGER,
  einspeiseverguetung_kwh NUMERIC,
  batteriespeicher_vorhanden BOOLEAN DEFAULT false,
  batteriekapazitaet_kwh NUMERIC,
  notizen TEXT,
  aktiv BOOLEAN DEFAULT true,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für Mitglied-Suche
CREATE INDEX idx_anlagen_mitglied_id ON anlagen(mitglied_id);

-- ============================================
-- 6. ANLAGEN_FREIGABEN (Privacy Settings)
-- ============================================
CREATE TABLE anlagen_freigaben (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anlage_id UUID NOT NULL UNIQUE REFERENCES anlagen(id),
  profil_oeffentlich BOOLEAN DEFAULT false,
  kennzahlen_oeffentlich BOOLEAN DEFAULT false,
  auswertungen_oeffentlich BOOLEAN DEFAULT false,
  investitionen_oeffentlich BOOLEAN DEFAULT false,
  monatsdaten_oeffentlich BOOLEAN DEFAULT false,
  standort_genau BOOLEAN DEFAULT false,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für Anlagen-Freigaben
CREATE INDEX idx_anlagen_freigaben_anlage_id ON anlagen_freigaben(anlage_id);

-- ============================================
-- 7. ANLAGEN_KENNZAHLEN (Performance Metrics)
-- ============================================
CREATE TABLE anlagen_kennzahlen (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anlage_id UUID NOT NULL UNIQUE,
  berechnet_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  bis_jahr INTEGER NOT NULL,
  bis_monat INTEGER NOT NULL,
  pv_erzeugung_gesamt_kwh NUMERIC DEFAULT 0,
  eigenverbrauch_gesamt_kwh NUMERIC DEFAULT 0,
  einspeisung_gesamt_kwh NUMERIC DEFAULT 0,
  netzbezug_gesamt_kwh NUMERIC DEFAULT 0,
  autarkiegrad_durchschnitt_prozent NUMERIC,
  eigenverbrauchsquote_durchschnitt_prozent NUMERIC,
  einspeiseerloese_gesamt_euro NUMERIC DEFAULT 0,
  netzbezugskosten_gesamt_euro NUMERIC DEFAULT 0,
  betriebsausgaben_gesamt_euro NUMERIC DEFAULT 0,
  investitionskosten_gesamt_euro NUMERIC DEFAULT 0,
  einsparungen_gesamt_euro NUMERIC DEFAULT 0,
  bilanz_gesamt_euro NUMERIC DEFAULT 0,
  co2_einsparung_gesamt_kg NUMERIC DEFAULT 0
);

-- ============================================
-- 8. MONATSDATEN (Performance Data)
-- ============================================
CREATE TABLE monatsdaten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anlage_id UUID NOT NULL REFERENCES anlagen(id),
  jahr INTEGER NOT NULL,
  monat INTEGER NOT NULL CHECK (monat >= 1 AND monat <= 12),
  erzeugung_kwh NUMERIC,
  einspeisung_kwh NUMERIC,
  eigenverbrauch_kwh NUMERIC,
  netzbezug_kwh NUMERIC,
  autarkie_prozent NUMERIC,
  eigenverbrauch_prozent NUMERIC,
  ertrag_euro NUMERIC,
  kosten_netzbezug_euro NUMERIC,
  notizen TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(anlage_id, jahr, monat)
);

-- Index für zeitbasierte Abfragen
CREATE INDEX idx_monatsdaten_anlage_jahr_monat ON monatsdaten(anlage_id, jahr, monat);

-- ============================================
-- 9. INVESTITIONEN (PV Investment Data)
-- ============================================
CREATE TABLE investitionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anlage_id UUID NOT NULL REFERENCES anlagen(id),
  typ_id UUID REFERENCES investitionstypen(id),
  bezeichnung TEXT NOT NULL,
  beschreibung TEXT,
  betrag_euro NUMERIC NOT NULL,
  datum DATE NOT NULL,
  kategorie TEXT,
  notizen TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für Anlagen-Investitionen
CREATE INDEX idx_investitionen_anlage_id ON investitionen(anlage_id);
CREATE INDEX idx_investitionen_typ_id ON investitionen(typ_id);

-- ============================================
-- 10. ALTERNATIVE_INVESTITIONEN (Other Investments)
-- ============================================
CREATE TABLE alternative_investitionen (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mitglied_id UUID NOT NULL REFERENCES mitglieder(id),
  anlage_id UUID REFERENCES anlagen(id),
  parent_investition_id UUID REFERENCES alternative_investitionen(id),
  typ VARCHAR NOT NULL,
  bezeichnung VARCHAR NOT NULL,
  anschaffungsdatum DATE NOT NULL,
  anschaffungskosten_gesamt NUMERIC NOT NULL,
  anschaffungskosten_alternativ NUMERIC,
  anschaffungskosten_relevant NUMERIC,
  alternativ_beschreibung VARCHAR,
  kosten_jahr_aktuell JSONB DEFAULT '{}'::jsonb,
  kosten_jahr_alternativ JSONB DEFAULT '{}'::jsonb,
  einsparungen_jahr JSONB DEFAULT '{}'::jsonb,
  einsparung_gesamt_jahr NUMERIC,
  parameter JSONB DEFAULT '{}'::jsonb,
  co2_einsparung_kg_jahr NUMERIC,
  aktiv BOOLEAN DEFAULT true,
  notizen TEXT,
  erstellt_am TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Indizes für alternative_investitionen
CREATE INDEX idx_alternative_investitionen_mitglied_id ON alternative_investitionen(mitglied_id);
CREATE INDEX idx_alternative_investitionen_anlage_id ON alternative_investitionen(anlage_id);

-- ============================================
-- 11. INVESTITION_KENNZAHLEN (Investment Metrics)
-- ============================================
CREATE TABLE investition_kennzahlen (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investition_id UUID NOT NULL UNIQUE REFERENCES alternative_investitionen(id),
  berechnet_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  bis_jahr INTEGER NOT NULL,
  bis_monat INTEGER NOT NULL,
  einsparung_kumuliert_euro NUMERIC DEFAULT 0,
  kosten_kumuliert_euro NUMERIC DEFAULT 0,
  bilanz_kumuliert_euro NUMERIC DEFAULT 0,
  amortisationszeit_monate NUMERIC,
  roi_prozent NUMERIC,
  co2_einsparung_kumuliert_kg NUMERIC DEFAULT 0,
  baeume_aequivalent INTEGER DEFAULT 0,
  amortisiert_voraussichtlich_am DATE
);

-- ============================================
-- 12. INVESTITION_MONATSDATEN (Investment Monthly Data)
-- ============================================
CREATE TABLE investition_monatsdaten (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investition_id UUID NOT NULL REFERENCES alternative_investitionen(id),
  jahr INTEGER NOT NULL,
  monat INTEGER NOT NULL CHECK (monat >= 1 AND monat <= 12),
  verbrauch_daten JSONB DEFAULT '{}'::jsonb,
  kosten_daten JSONB DEFAULT '{}'::jsonb,
  einsparung_monat_euro NUMERIC,
  betriebsausgaben_monat_euro NUMERIC DEFAULT 0,
  co2_einsparung_kg NUMERIC,
  notizen TEXT,
  erstellt_am TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  aktualisiert_am TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  UNIQUE(investition_id, jahr, monat)
);

-- Index für zeitbasierte Abfragen
CREATE INDEX idx_investition_monatsdaten_inv_jahr_monat ON investition_monatsdaten(investition_id, jahr, monat);

-- ============================================
-- 13. WETTERDATEN (Weather Data)
-- ============================================
CREATE TABLE wetterdaten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plz TEXT NOT NULL,
  datum DATE NOT NULL,
  jahr INTEGER NOT NULL CHECK (jahr >= 2000 AND jahr <= 2100),
  monat INTEGER NOT NULL CHECK (monat >= 1 AND monat <= 12),
  sonnenstunden NUMERIC CHECK (sonnenstunden >= 0),
  globalstrahlung_kwh_m2 NUMERIC CHECK (globalstrahlung_kwh_m2 >= 0),
  temperatur_durchschnitt_c NUMERIC,
  datenquelle TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plz, datum)
);

-- Index für PLZ und Datum
CREATE INDEX idx_wetterdaten_plz_datum ON wetterdaten(plz, datum);
CREATE INDEX idx_wetterdaten_jahr_monat ON wetterdaten(jahr, monat);

-- ============================================
-- 14. ROW LEVEL SECURITY (RLS) aktivieren
-- ============================================
ALTER TABLE mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen_freigaben ENABLE ROW LEVEL SECURITY;
ALTER TABLE monatsdaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE investitionen ENABLE ROW LEVEL SECURITY;

-- Alternative Investitionen, Kennzahlen und Wetterdaten haben aktuell keine RLS
-- Diese können später bei Bedarf aktiviert werden

-- ============================================
-- 15. STANDARD-DATEN einfügen
-- ============================================

-- Standard-Investitionstypen
INSERT INTO investitionstypen (typ, beschreibung, aktiv)
VALUES
  ('PV-Module', 'Photovoltaik-Module', true),
  ('Wechselrichter', 'Wechselrichter für PV-Anlagen', true),
  ('Batteriespeicher', 'Stromspeicher/Batteriesystem', true),
  ('Montagesystem', 'Befestigungssystem für Module', true),
  ('Wallbox', 'Ladestation für Elektrofahrzeuge', true),
  ('Optimierer', 'Leistungsoptimierer für Module', true),
  ('Sonstiges', 'Sonstige Investitionen', true)
ON CONFLICT (typ) DO NOTHING;

-- Standard-Investitionstyp-Konfigurationen
INSERT INTO investitionstyp_config (typ, standardlebensdauer_jahre, abschreibungsdauer_jahre, wartungskosten_prozent_pa, co2_faktor_kg_kwh, bezeichnung, beschreibung, aktiv)
VALUES
  ('pv-anlage', 25, 20, 1.0, 0.38, 'PV-Anlage', 'Photovoltaik-Anlage komplett', true),
  ('batteriespeicher', 15, 10, 0.5, 0.38, 'Batteriespeicher', 'Stromspeicher für PV-Anlage', true),
  ('wallbox', 10, 10, 0.2, 0.38, 'Wallbox', 'Ladestation für E-Fahrzeuge', true),
  ('waermepumpe', 20, 15, 2.0, 0.20, 'Wärmepumpe', 'Elektrische Wärmepumpe', true),
  ('sonstiges', 15, 10, 1.0, 0.38, 'Sonstiges', 'Sonstige alternative Investition', true)
ON CONFLICT (typ) DO NOTHING;

-- Standard-Strompreis (Beispiel)
INSERT INTO strompreise (gueltig_ab, preis_cent_kwh, anbieter, tarif, grundgebuehr_euro, aktiv)
VALUES
  ('2024-01-01', 35.00, 'Standard', 'Grundversorgung', 120.00, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 16. VERIFIZIERUNG
-- ============================================
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- FERTIG!
-- ============================================
-- Die Datenbank ist jetzt bereit für die Verwendung
-- Nächste Schritte:
-- 1. RLS Policies erstellen (production-setup.sql)
-- 2. Erste Benutzer registrieren
-- ============================================
