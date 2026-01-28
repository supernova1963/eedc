# Master Refactoring Plan: Clean Slate Neuaufbau

**Datum:** 2026-01-28
**Ziel:** Sauberer, Community-First Neuaufbau ohne Legacy-Probleme
**Status:** 🟢 READY TO EXECUTE

---

## Executive Summary

### Vision
Eine **Community-First PV-Daten-Plattform**, wo User ihre Anlagen öffentlich teilen und im Gegenzug hochwertige Auswertungen ihrer eigenen Daten erhalten.

### Kernprinzipien
1. **Community First** - Öffentliche Daten sind der Standard, nicht die Ausnahme
2. **Multi-Anlage** - Jeder User kann mehrere PV-Anlagen verwalten
3. **Klare Trennung** - Anlagen-Komponenten vs Haushalts-Komponenten
4. **Keine RLS-Zirkelbezüge** - Simple Policies + Security Definer Functions
5. **Type-Safe** - Supabase Generated Types überall

### Architektur-Entscheidungen

| Aspekt | Alte Architektur | Neue Architektur |
|--------|------------------|------------------|
| Anlagen pro User | Implizit 1 (`.limit(1)`) | Explizit N (Dropdown) |
| Community | Nachträglich hinzugefügt | Von Anfang an integriert |
| Speicher | Zu User (alternative_investitionen) | Zu Anlage (anlagen_komponenten) |
| E-Auto/WP | Zu User (alternative_investitionen) | Zu Haushalt (haushalt_komponenten) |
| RLS | Komplex mit Zirkelbezügen | Simple + Functions |
| Freigaben | Boolean Flags | Granular + Default Public |

---

## 1. NEUE DATENBANK-ARCHITEKTUR

### 1.1 Konzeptionelles Modell

```
┌─────────────────────────────────────────────────────────────┐
│                        COMMUNITY LAYER                       │
│  (Öffentlich zugänglich, keine Auth erforderlich)           │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                    Security Definer Functions
                              │
┌─────────────────────────────────────────────────────────────┐
│                         USER LAYER                           │
│                   (Auth erforderlich)                        │
├─────────────────────────────────────────────────────────────┤
│  mitglieder (1)                                             │
│      ├─── anlagen (N)                                       │
│      │      ├─── anlagen_komponenten (N)                    │
│      │      │       └─── [Speicher, Wechselrichter, ...]    │
│      │      └─── monatsdaten (N)                            │
│      │                                                        │
│      └─── haushalt_komponenten (N)                          │
│             └─── [E-Auto, Wärmepumpe, ...]                  │
│                   └─── komponenten_monatsdaten (N)          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Neue Tabellenstruktur

#### CORE: User & Anlagen

```sql
-- ============================================
-- 1. mitglieder (User Profile)
-- ============================================
CREATE TABLE mitglieder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Auth Verknüpfung (UNIQUE!)
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,

  -- Profil
  vorname text NOT NULL,
  nachname text NOT NULL,
  display_name text, -- Optional: öffentlicher Anzeigename

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

COMMENT ON TABLE mitglieder IS 'User-Profile mit Auth-Verknüpfung';
COMMENT ON COLUMN mitglieder.auth_user_id IS 'Verknüpfung zu auth.users - SINGLE SOURCE OF TRUTH';

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
  ausrichtung text, -- Süd, Süd-West, etc.
  neigungswinkel_grad integer,

  -- Finanziell
  anschaffungskosten_euro numeric,
  einspeiseverguetung_cent_kwh numeric,
  foerderung_euro numeric,

  -- Community & Privacy
  oeffentlich boolean DEFAULT false,
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

COMMENT ON TABLE anlagen IS 'PV-Anlagen - User kann mehrere haben';
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

COMMENT ON TABLE anlagen_komponenten IS 'Komponenten die zur PV-Anlage gehören (Speicher, WR, etc.)';

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

COMMENT ON TABLE haushalt_komponenten IS 'Komponenten die zum Haushalt gehören (E-Auto, WP, etc.)';
```

#### DATEN: Monatsdaten & Kennzahlen

```sql
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
```

#### MASTER DATA: Konfiguration

```sql
-- ============================================
-- 8. komponenten_typen (Master Data)
-- ============================================
CREATE TABLE komponenten_typen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  typ_code text NOT NULL UNIQUE, -- speicher, wechselrichter, e-auto, etc.
  kategorie text NOT NULL, -- anlage, haushalt

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
  -- Beispiel: { "required": ["kapazitaet_kwh"], "properties": { "kapazitaet_kwh": { "type": "number", "min": 0 } } }

  -- System
  aktiv boolean DEFAULT true,
  sortierung integer DEFAULT 0,
  erstellt_am timestamptz DEFAULT now()
);

CREATE INDEX idx_komponenten_typen_kategorie ON komponenten_typen(kategorie);

-- Seed Data
INSERT INTO komponenten_typen (typ_code, kategorie, bezeichnung, beschreibung, standardlebensdauer_jahre, co2_faktor_kg_kwh) VALUES
  ('speicher', 'anlage', 'Batteriespeicher', 'Speichert überschüssigen PV-Strom', 15, 0.38),
  ('wechselrichter', 'anlage', 'Wechselrichter', 'Wandelt DC in AC Strom', 15, 0.00),
  ('wallbox', 'anlage', 'Wallbox', 'Ladestation für E-Fahrzeuge', 15, 0.00),
  ('optimizer', 'anlage', 'Leistungsoptimierer', 'Optimiert Modul-Leistung', 20, 0.00),
  ('e-auto', 'haushalt', 'Elektroauto', 'Elektrisches Fahrzeug', 12, 0.15),
  ('waermepumpe', 'haushalt', 'Wärmepumpe', 'Elektrische Heizung', 20, 0.20),
  ('klimaanlage', 'haushalt', 'Klimaanlage', 'Elektrische Kühlung', 15, 0.38),
  ('pool', 'haushalt', 'Pool-Pumpe', 'Pool-Heizung/Pumpe', 10, 0.38)
ON CONFLICT (typ_code) DO NOTHING;

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
CREATE INDEX idx_strompreise_gueltig ON strompreise(gueltig_ab, gueltig_bis);

COMMENT ON TABLE strompreise IS 'Strompreise - global oder user-spezifisch';
COMMENT ON COLUMN strompreise.mitglied_id IS 'NULL = globaler Preis, NOT NULL = user-spezifisch';
```

---

## 2. RLS POLICIES (OHNE ZIRKELBEZÜGE!)

### 2.1 Prinzipien

1. **Simple Policies** - Keine JOINs in USING/WITH CHECK
2. **Helper Functions** - Für komplexe Checks
3. **Security Definer** - Für Community-Queries
4. **Separate Roles** - `authenticated` vs `anon`

### 2.2 Helper Functions

```sql
-- ============================================
-- HELPER FUNCTIONS (Security Definer)
-- ============================================

-- Aktuellen User aus auth.users holen
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

-- Mitglied-ID des aktuellen Users
CREATE OR REPLACE FUNCTION current_mitglied_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM mitglieder WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Prüfe ob User Zugriff auf Anlage hat
CREATE OR REPLACE FUNCTION user_owns_anlage(p_anlage_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM anlagen
    WHERE id = p_anlage_id
      AND mitglied_id = current_mitglied_id()
  );
$$;

-- Prüfe ob Anlage öffentlich ist
CREATE OR REPLACE FUNCTION anlage_is_public(p_anlage_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT oeffentlich FROM anlagen WHERE id = p_anlage_id;
$$;
```

### 2.3 RLS Policies

```sql
-- ============================================
-- RLS ACTIVATION
-- ============================================
ALTER TABLE mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen_komponenten ENABLE ROW LEVEL SECURITY;
ALTER TABLE haushalt_komponenten ENABLE ROW LEVEL SECURITY;
ALTER TABLE monatsdaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE komponenten_monatsdaten ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen_kennzahlen ENABLE ROW LEVEL SECURITY;
ALTER TABLE strompreise ENABLE ROW LEVEL SECURITY;

-- komponenten_typen hat kein RLS (Master Data, public readable)

-- ============================================
-- POLICIES: mitglieder
-- ============================================

-- SELECT: User sieht nur eigene Daten + öffentliche Profile
CREATE POLICY "mitglieder_select_own" ON mitglieder
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "mitglieder_select_public" ON mitglieder
  FOR SELECT
  TO anon
  USING (profil_oeffentlich = true);

-- UPDATE: User kann nur eigene Daten ändern
CREATE POLICY "mitglieder_update" ON mitglieder
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- INSERT: Nur bei Registrierung (via Service Role)
-- Keine Policy für authenticated → Registrierung erfolgt via API

-- DELETE: Deaktiviert (soft delete via aktiv flag)

-- ============================================
-- POLICIES: anlagen
-- ============================================

-- SELECT: Eigene Anlagen + Öffentliche
CREATE POLICY "anlagen_select_own" ON anlagen
  FOR SELECT
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

CREATE POLICY "anlagen_select_public" ON anlagen
  FOR SELECT
  TO anon, authenticated
  USING (oeffentlich = true AND aktiv = true);

-- INSERT: User kann Anlagen für sich erstellen
CREATE POLICY "anlagen_insert" ON anlagen
  FOR INSERT
  TO authenticated
  WITH CHECK (mitglied_id = current_mitglied_id());

-- UPDATE: Nur eigene Anlagen
CREATE POLICY "anlagen_update" ON anlagen
  FOR UPDATE
  TO authenticated
  USING (mitglied_id = current_mitglied_id())
  WITH CHECK (mitglied_id = current_mitglied_id());

-- DELETE: Nur eigene Anlagen
CREATE POLICY "anlagen_delete" ON anlagen
  FOR DELETE
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

-- ============================================
-- POLICIES: anlagen_komponenten
-- ============================================

-- SELECT: Eigene + Öffentliche (wenn Anlage öffentlich + komponenten_oeffentlich)
CREATE POLICY "anlagen_komponenten_select_own" ON anlagen_komponenten
  FOR SELECT
  TO authenticated
  USING (user_owns_anlage(anlage_id));

CREATE POLICY "anlagen_komponenten_select_public" ON anlagen_komponenten
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anlagen
      WHERE anlagen.id = anlage_id
        AND anlagen.oeffentlich = true
        AND anlagen.komponenten_oeffentlich = true
        AND anlagen.aktiv = true
    )
  );

-- INSERT/UPDATE/DELETE: Nur für eigene Anlagen
CREATE POLICY "anlagen_komponenten_insert" ON anlagen_komponenten
  FOR INSERT
  TO authenticated
  WITH CHECK (user_owns_anlage(anlage_id));

CREATE POLICY "anlagen_komponenten_update" ON anlagen_komponenten
  FOR UPDATE
  TO authenticated
  USING (user_owns_anlage(anlage_id))
  WITH CHECK (user_owns_anlage(anlage_id));

CREATE POLICY "anlagen_komponenten_delete" ON anlagen_komponenten
  FOR DELETE
  TO authenticated
  USING (user_owns_anlage(anlage_id));

-- ============================================
-- POLICIES: haushalt_komponenten
-- ============================================

-- SELECT: Eigene + Öffentliche
CREATE POLICY "haushalt_komponenten_select_own" ON haushalt_komponenten
  FOR SELECT
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

CREATE POLICY "haushalt_komponenten_select_public" ON haushalt_komponenten
  FOR SELECT
  TO anon, authenticated
  USING (oeffentlich = true AND aktiv = true);

-- INSERT/UPDATE/DELETE: Nur eigene
CREATE POLICY "haushalt_komponenten_insert" ON haushalt_komponenten
  FOR INSERT
  TO authenticated
  WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "haushalt_komponenten_update" ON haushalt_komponenten
  FOR UPDATE
  TO authenticated
  USING (mitglied_id = current_mitglied_id())
  WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "haushalt_komponenten_delete" ON haushalt_komponenten
  FOR DELETE
  TO authenticated
  USING (mitglied_id = current_mitglied_id());

-- ============================================
-- POLICIES: monatsdaten
-- ============================================

-- SELECT: Eigene + Öffentliche (wenn Anlage monatsdaten_oeffentlich)
CREATE POLICY "monatsdaten_select_own" ON monatsdaten
  FOR SELECT
  TO authenticated
  USING (user_owns_anlage(anlage_id));

CREATE POLICY "monatsdaten_select_public" ON monatsdaten
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anlagen
      WHERE anlagen.id = anlage_id
        AND anlagen.oeffentlich = true
        AND anlagen.monatsdaten_oeffentlich = true
        AND anlagen.aktiv = true
    )
  );

-- INSERT/UPDATE/DELETE: Nur für eigene Anlagen
CREATE POLICY "monatsdaten_insert" ON monatsdaten
  FOR INSERT
  TO authenticated
  WITH CHECK (user_owns_anlage(anlage_id));

CREATE POLICY "monatsdaten_update" ON monatsdaten
  FOR UPDATE
  TO authenticated
  USING (user_owns_anlage(anlage_id))
  WITH CHECK (user_owns_anlage(anlage_id));

CREATE POLICY "monatsdaten_delete" ON monatsdaten
  FOR DELETE
  TO authenticated
  USING (user_owns_anlage(anlage_id));

-- ============================================
-- POLICIES: komponenten_monatsdaten
-- ============================================

-- SELECT: Eigene + Öffentliche (wenn Komponente öffentlich)
CREATE POLICY "komponenten_monatsdaten_select_own" ON komponenten_monatsdaten
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  );

CREATE POLICY "komponenten_monatsdaten_select_public" ON komponenten_monatsdaten
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.oeffentlich = true
        AND hk.aktiv = true
    )
  );

-- INSERT/UPDATE/DELETE: Nur für eigene Komponenten
CREATE POLICY "komponenten_monatsdaten_insert" ON komponenten_monatsdaten
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  );

CREATE POLICY "komponenten_monatsdaten_update" ON komponenten_monatsdaten
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  );

CREATE POLICY "komponenten_monatsdaten_delete" ON komponenten_monatsdaten
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM haushalt_komponenten hk
      WHERE hk.id = komponente_id
        AND hk.mitglied_id = current_mitglied_id()
    )
  );

-- ============================================
-- POLICIES: anlagen_kennzahlen
-- ============================================

-- SELECT: Eigene + Öffentliche (wenn Anlage kennzahlen_oeffentlich)
CREATE POLICY "anlagen_kennzahlen_select_own" ON anlagen_kennzahlen
  FOR SELECT
  TO authenticated
  USING (user_owns_anlage(anlage_id));

CREATE POLICY "anlagen_kennzahlen_select_public" ON anlagen_kennzahlen
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM anlagen
      WHERE anlagen.id = anlage_id
        AND anlagen.oeffentlich = true
        AND anlagen.kennzahlen_oeffentlich = true
        AND anlagen.aktiv = true
    )
  );

-- INSERT/UPDATE/DELETE: Nur System (via Service Role) oder Owner
CREATE POLICY "anlagen_kennzahlen_update" ON anlagen_kennzahlen
  FOR UPDATE
  TO authenticated
  USING (user_owns_anlage(anlage_id))
  WITH CHECK (user_owns_anlage(anlage_id));

-- ============================================
-- POLICIES: strompreise
-- ============================================

-- SELECT: Eigene + Globale (mitglied_id IS NULL)
CREATE POLICY "strompreise_select_own" ON strompreise
  FOR SELECT
  TO authenticated
  USING (
    mitglied_id IS NULL -- Global
    OR mitglied_id = current_mitglied_id() -- Eigene
  );

CREATE POLICY "strompreise_select_global" ON strompreise
  FOR SELECT
  TO anon
  USING (mitglied_id IS NULL); -- Nur globale für Anonymous

-- INSERT/UPDATE/DELETE: Nur eigene
CREATE POLICY "strompreise_insert" ON strompreise
  FOR INSERT
  TO authenticated
  WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "strompreise_update" ON strompreise
  FOR UPDATE
  TO authenticated
  USING (mitglied_id = current_mitglied_id())
  WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "strompreise_delete" ON strompreise
  FOR DELETE
  TO authenticated
  USING (mitglied_id = current_mitglied_id());
```

### 2.4 Security Definer Functions für Community

```sql
-- ============================================
-- COMMUNITY FUNCTIONS (Security Definer)
-- ============================================

-- Alle öffentlichen Anlagen mit Basis-Info
CREATE OR REPLACE FUNCTION get_public_anlagen()
RETURNS TABLE (
  anlage_id uuid,
  anlagenname text,
  leistung_kwp numeric,
  installationsdatum date,
  standort_plz text,
  standort_ort text,
  standort_latitude numeric,
  standort_longitude numeric,
  mitglied_id uuid,
  mitglied_display_name text,
  anzahl_komponenten bigint,
  hat_speicher boolean,
  hat_wallbox boolean,
  kennzahlen_oeffentlich boolean,
  monatsdaten_oeffentlich boolean,
  komponenten_oeffentlich boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    a.id as anlage_id,
    a.anlagenname,
    a.leistung_kwp,
    a.installationsdatum,
    CASE
      WHEN a.standort_genau_anzeigen THEN a.standort_plz
      ELSE LEFT(a.standort_plz, 2) || 'XXX'
    END as standort_plz,
    a.standort_ort,
    CASE
      WHEN a.standort_genau_anzeigen THEN a.standort_latitude
      ELSE NULL
    END as standort_latitude,
    CASE
      WHEN a.standort_genau_anzeigen THEN a.standort_longitude
      ELSE NULL
    END as standort_longitude,
    m.id as mitglied_id,
    COALESCE(m.display_name, m.vorname || ' ' || m.nachname) as mitglied_display_name,
    (SELECT COUNT(*) FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.aktiv = true) as anzahl_komponenten,
    EXISTS (SELECT 1 FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.typ = 'speicher' AND ak.aktiv = true) as hat_speicher,
    EXISTS (SELECT 1 FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.typ = 'wallbox' AND ak.aktiv = true) as hat_wallbox,
    a.kennzahlen_oeffentlich,
    a.monatsdaten_oeffentlich,
    a.komponenten_oeffentlich
  FROM anlagen a
  INNER JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.oeffentlich = true
    AND a.aktiv = true
  ORDER BY a.installationsdatum DESC;
$$;

GRANT EXECUTE ON FUNCTION get_public_anlagen() TO anon, authenticated;

-- Community Stats
CREATE OR REPLACE FUNCTION get_community_stats()
RETURNS TABLE (
  anzahl_anlagen bigint,
  gesamtleistung_kwp numeric,
  anzahl_mitglieder bigint,
  durchschnitt_leistung_kwp numeric,
  anzahl_mit_speicher bigint,
  anzahl_mit_wallbox bigint,
  neueste_anlage_datum date
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COUNT(a.id) as anzahl_anlagen,
    COALESCE(SUM(a.leistung_kwp), 0) as gesamtleistung_kwp,
    COUNT(DISTINCT a.mitglied_id) as anzahl_mitglieder,
    COALESCE(AVG(a.leistung_kwp), 0) as durchschnitt_leistung_kwp,
    COUNT(DISTINCT CASE WHEN EXISTS (
      SELECT 1 FROM anlagen_komponenten ak
      WHERE ak.anlage_id = a.id AND ak.typ = 'speicher' AND ak.aktiv = true
    ) THEN a.id END) as anzahl_mit_speicher,
    COUNT(DISTINCT CASE WHEN EXISTS (
      SELECT 1 FROM anlagen_komponenten ak
      WHERE ak.anlage_id = a.id AND ak.typ = 'wallbox' AND ak.aktiv = true
    ) THEN a.id END) as anzahl_mit_wallbox,
    MAX(a.installationsdatum) as neueste_anlage_datum
  FROM anlagen a
  WHERE a.oeffentlich = true
    AND a.aktiv = true;
$$;

GRANT EXECUTE ON FUNCTION get_community_stats() TO anon, authenticated;

-- Einzelne öffentliche Anlage mit Details
CREATE OR REPLACE FUNCTION get_public_anlage_details(p_anlage_id uuid)
RETURNS TABLE (
  anlage_id uuid,
  anlagenname text,
  beschreibung text,
  leistung_kwp numeric,
  installationsdatum date,
  standort_ort text,
  standort_plz text,
  ausrichtung text,
  neigungswinkel_grad integer,
  mitglied_display_name text,
  mitglied_bio text,
  komponenten jsonb,
  kennzahlen jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Prüfe ob Anlage öffentlich ist
  IF NOT EXISTS (
    SELECT 1 FROM anlagen
    WHERE id = p_anlage_id
      AND oeffentlich = true
      AND aktiv = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id as anlage_id,
    a.anlagenname,
    a.beschreibung,
    a.leistung_kwp,
    a.installationsdatum,
    a.standort_ort,
    CASE
      WHEN a.standort_genau_anzeigen THEN a.standort_plz
      ELSE LEFT(a.standort_plz, 2) || 'XXX'
    END as standort_plz,
    a.ausrichtung,
    a.neigungswinkel_grad,
    COALESCE(m.display_name, m.vorname || ' ' || m.nachname) as mitglied_display_name,
    CASE WHEN m.profil_oeffentlich THEN m.bio ELSE NULL END as mitglied_bio,
    CASE WHEN a.komponenten_oeffentlich THEN (
      SELECT jsonb_agg(jsonb_build_object(
        'typ', ak.typ,
        'bezeichnung', ak.bezeichnung,
        'hersteller', ak.hersteller,
        'modell', ak.modell,
        'technische_daten', ak.technische_daten
      ))
      FROM anlagen_komponenten ak
      WHERE ak.anlage_id = a.id AND ak.aktiv = true
    ) ELSE NULL END as komponenten,
    CASE WHEN a.kennzahlen_oeffentlich THEN (
      SELECT to_jsonb(k.*) FROM anlagen_kennzahlen k WHERE k.anlage_id = a.id
    ) ELSE NULL END as kennzahlen
  FROM anlagen a
  INNER JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.id = p_anlage_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_anlage_details(uuid) TO anon, authenticated;
```

---

## 3. MIGRATIONS-STRATEGIE

### 3.1 Migration Files

```
migrations/FRESH-START/
├── 00_drop_old_schema.sql       # Drop alte Tabellen
├── 01_core_schema.sql           # Neue Tabellen erstellen
├── 02_helper_functions.sql      # Helper Functions
├── 03_rls_policies.sql          # Alle RLS Policies
├── 04_community_functions.sql   # Security Definer Functions
├── 05_views.sql                 # Optional: Materialized Views
├── 06_seed_data.sql             # Komponenten-Typen, globale Strompreise
├── 07_migrate_old_data.sql      # OPTIONAL: Alte Daten migrieren
└── README.md                    # Anleitung
```

### 3.2 Migrations-Reihenfolge

```bash
# 1. Backup erstellen
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Migrations ausführen (in Reihenfolge)
psql $DATABASE_URL -f migrations/FRESH-START/00_drop_old_schema.sql
psql $DATABASE_URL -f migrations/FRESH-START/01_core_schema.sql
psql $DATABASE_URL -f migrations/FRESH-START/02_helper_functions.sql
psql $DATABASE_URL -f migrations/FRESH-START/03_rls_policies.sql
psql $DATABASE_URL -f migrations/FRESH-START/04_community_functions.sql
psql $DATABASE_URL -f migrations/FRESH-START/05_views.sql
psql $DATABASE_URL -f migrations/FRESH-START/06_seed_data.sql

# 3. Optional: Alte Daten migrieren
# psql $DATABASE_URL -f migrations/FRESH-START/07_migrate_old_data.sql

# 4. Verifizierung
psql $DATABASE_URL -f migrations/FRESH-START/verify.sql
```

---

## 4. CODE-ANPASSUNGEN

### 4.1 Type Generation

```bash
# Supabase Types generieren
npx supabase gen types typescript --project-id YOUR_PROJECT > types/database.ts
```

```typescript
// types/database.ts wird generiert mit:
export type Database = {
  public: {
    Tables: {
      mitglieder: { Row: {...}, Insert: {...}, Update: {...} }
      anlagen: { Row: {...}, Insert: {...}, Update: {...} }
      // etc.
    }
    Functions: {
      get_public_anlagen: { Args: {}, Returns: {...} }
      // etc.
    }
  }
}
```

### 4.2 Neue Helper Functions

```typescript
// lib/database.ts - Type-safe Supabase Client
import { Database } from '@/types/database'
import { createServerClient, createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Anlage = Tables<'anlagen'>
export type Mitglied = Tables<'mitglieder'>
export type Monatsdaten = Tables<'monatsdaten'>
// etc.

// lib/auth-new.ts - Neue Auth Helpers
export async function getCurrentMitglied(): Promise<Mitglied | null> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data, error } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !data) return null
  return data
}

// lib/anlagen.ts - Anlagen Helpers
export async function getUserAnlagen(mitgliedId: string): Promise<Anlage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('anlagen')
    .select('*')
    .eq('mitglied_id', mitgliedId)
    .eq('aktiv', true)
    .order('installationsdatum', { ascending: false })

  return data || []
}

export async function getAnlageById(anlageId: string, mitgliedId: string): Promise<Anlage | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('anlagen')
    .select('*')
    .eq('id', anlageId)
    .eq('mitglied_id', mitgliedId)
    .single()

  return data || null
}

// lib/community.ts - Community Helpers (neu)
export async function getPublicAnlagen() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_public_anlagen')
  if (error) {
    console.error('Error fetching public anlagen:', error)
    return []
  }

  return data || []
}

export async function getCommunityStats() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_community_stats')
  if (error) {
    console.error('Error fetching community stats:', error)
    return null
  }

  return data?.[0] || null
}
```

### 4.3 Neue Komponenten

```typescript
// components/AnlagenSelector.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getUserAnlagen } from '@/lib/anlagen'
import type { Anlage } from '@/lib/database'

interface AnlagenSelectorProps {
  mitgliedId: string
  currentAnlageId?: string
}

export default function AnlagenSelector({ mitgliedId, currentAnlageId }: AnlagenSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [anlagen, setAnlagen] = useState<Anlage[]>([])
  const [loading, setLoading] = useState(true)

  const selectedId = currentAnlageId || searchParams.get('anlageId') || anlagen[0]?.id

  useEffect(() => {
    async function loadAnlagen() {
      const data = await getUserAnlagen(mitgliedId)
      setAnlagen(data)
      setLoading(false)
    }
    loadAnlagen()
  }, [mitgliedId])

  if (loading) return <div>Lade Anlagen...</div>
  if (anlagen.length === 0) return null
  if (anlagen.length === 1) return <div className="text-sm text-gray-600">{anlagen[0].anlagenname}</div>

  return (
    <select
      value={selectedId}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('anlageId', e.target.value)
        router.push(`?${params.toString()}`)
      }}
      className="px-4 py-2 border border-gray-300 rounded-md bg-white"
    >
      {anlagen.map((anlage) => (
        <option key={anlage.id} value={anlage.id}>
          {anlage.anlagenname} ({anlage.leistung_kwp} kWp)
        </option>
      ))}
    </select>
  )
}
```

### 4.4 Seiten-Anpassungen

```typescript
// app/meine-anlage/page.tsx - NEUE VERSION
import { getCurrentMitglied } from '@/lib/auth-new'
import { getAnlageById, getUserAnlagen } from '@/lib/anlagen'
import AnlagenSelector from '@/components/AnlagenSelector'
import { redirect } from 'next/navigation'

export default async function DashboardPage({
  searchParams
}: {
  searchParams: { anlageId?: string }
}) {
  const mitglied = await getCurrentMitglied()
  if (!mitglied) redirect('/login')

  // Hole alle Anlagen
  const anlagen = await getUserAnlagen(mitglied.id)
  if (anlagen.length === 0) {
    return <KeineAnlageGefunden />
  }

  // Hole ausgewählte Anlage oder erste
  const anlageId = searchParams.anlageId || anlagen[0].id
  const anlage = await getAnlageById(anlageId, mitglied.id)

  if (!anlage) {
    // Fallback: Erste Anlage
    return redirect(`/meine-anlage?anlageId=${anlagen[0].id}`)
  }

  // Lade Monatsdaten für diese Anlage
  const monatsdaten = await getMonatsdaten(anlage.id)

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <AnlagenSelector mitgliedId={mitglied.id} currentAnlageId={anlage.id} />
      </div>

      {/* Dashboard Content für diese Anlage */}
      <DashboardContent anlage={anlage} monatsdaten={monatsdaten} />
    </div>
  )
}
```

---

## 5. TESTING-STRATEGIE

### 5.1 Test-Szenarien

**Szenario 1: Single-User, Single-Anlage**
- User registriert sich
- Erstellt 1 Anlage
- Erfasst Monatsdaten
- Sieht Dashboard
- ✅ Keine Anlagen-Auswahl nötig

**Szenario 2: Single-User, Multi-Anlage**
- User erstellt 2 Anlagen (Haus + Garage)
- Anlagen-Selector erscheint
- Wechsel zwischen Anlagen funktioniert
- Monatsdaten pro Anlage korrekt
- ✅ URL-Parameter bleiben bei Navigation

**Szenario 3: Community (Anonymous User)**
- Nicht eingeloggt
- Sieht Community-Dashboard
- Sieht öffentliche Anlagen
- Kann keine privaten Daten sehen
- ✅ RLS blockiert private Daten

**Szenario 4: Community (Auth User mit privater Anlage)**
- Eingeloggt
- Eigene Anlage ist privat
- Sieht Community-Anlagen anderer
- Sieht eigene Anlage nicht in Community
- ✅ Privacy funktioniert

**Szenario 5: RLS Edge Cases**
- User A versucht Anlage von User B zu lesen
- User A versucht Monatsdaten von User B zu schreiben
- Anonymous versucht private Kennzahlen zu lesen
- ✅ Alle blockiert mit 403/empty result

### 5.2 Test-Daten

```sql
-- migrations/FRESH-START/test-data.sql

-- Test User 1: Public Anlage
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'max@example.com');

INSERT INTO mitglieder (id, auth_user_id, email, vorname, nachname, profil_oeffentlich) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'max@example.com', 'Max', 'Mustermann', true);

INSERT INTO anlagen (id, mitglied_id, anlagenname, leistung_kwp, installationsdatum, oeffentlich, kennzahlen_oeffentlich, monatsdaten_oeffentlich) VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dach-PV Haus', 10.5, '2023-06-15', true, true, true);

-- Test User 2: Private Anlage + Multi-Anlage
INSERT INTO auth.users (id, email) VALUES
  ('22222222-2222-2222-2222-222222222222', 'anna@example.com');

INSERT INTO mitglieder (id, auth_user_id, email, vorname, nachname, profil_oeffentlich) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'anna@example.com', 'Anna', 'Schmidt', false);

INSERT INTO anlagen (id, mitglied_id, anlagenname, leistung_kwp, installationsdatum, oeffentlich) VALUES
  ('bbbb0001-0001-0001-0001-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Wohnhaus PV', 8.2, '2024-01-10', false),
  ('bbbb0002-0002-0002-0002-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Garage PV', 3.5, '2024-03-20', false);

-- Komponenten
INSERT INTO anlagen_komponenten (anlage_id, typ, bezeichnung, technische_daten, anschaffungsdatum, anschaffungskosten_euro) VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 'speicher', 'BYD Battery-Box Premium HVS 10.2', '{"kapazitaet_kwh": 10.2, "max_ladeleistung_kw": 5}', '2023-06-15', 8500),
  ('aaaa0001-0001-0001-0001-000000000001', 'wallbox', 'Wallbox Pulsar Plus 11kW', '{"ladeleistung_kw": 11, "phasen": 3}', '2023-06-15', 850);

-- Monatsdaten
INSERT INTO monatsdaten (anlage_id, jahr, monat, pv_erzeugung_kwh, direktverbrauch_kwh, einspeisung_kwh, netzbezug_kwh, gesamtverbrauch_kwh) VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 2024, 1, 450, 280, 170, 120, 400),
  ('aaaa0001-0001-0001-0001-000000000001', 2024, 2, 620, 380, 240, 90, 470);
```

### 5.3 Test-Checklist

```markdown
# Testing Checklist

## RLS Tests (via Supabase SQL Editor)

### Test 1: Anonymous kann keine privaten Anlagen sehen
```sql
SET ROLE anon;
SELECT * FROM anlagen WHERE oeffentlich = false;
-- Expected: 0 rows
```

### Test 2: User sieht nur eigene Anlagen
```sql
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
SELECT * FROM anlagen;
-- Expected: Nur Anlagen von Max Mustermann
```

### Test 3: User kann keine fremden Monatsdaten ändern
```sql
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
UPDATE monatsdaten SET pv_erzeugung_kwh = 9999 WHERE anlage_id = 'bbbb0001-0001-0001-0001-000000000001';
-- Expected: 0 rows updated (belongs to Anna)
```

### Test 4: Community Functions funktionieren
```sql
SET ROLE anon;
SELECT * FROM get_public_anlagen();
-- Expected: Nur Max's öffentliche Anlage, nicht Anna's private
```

## UI Tests (Manuell)

- [ ] Registrierung funktioniert
- [ ] Login funktioniert
- [ ] Dashboard zeigt eigene Anlage
- [ ] Anlage erstellen funktioniert
- [ ] Monatsdaten erfassen funktioniert
- [ ] Bei 1 Anlage: Kein Selector
- [ ] Bei 2+ Anlagen: Selector erscheint
- [ ] Anlagenwechsel funktioniert (URL-Parameter)
- [ ] Community-Dashboard zeigt öffentliche Anlagen
- [ ] Community-Dashboard zeigt keine privaten Anlagen
- [ ] Eigene private Anlage nicht in Community sichtbar
```

---

## 6. ROLLOUT-PLAN

### Phase 1: Vorbereitung (1-2 Tage)
1. ✅ Migrations-Skripte schreiben
2. ✅ Test-Daten erstellen
3. ✅ Lokales Testing (Supabase CLI)

### Phase 2: Code-Anpassungen (2-3 Tage)
1. Types generieren
2. Helper Functions schreiben
3. AnlagenSelector Component
4. Seiten anpassen (Dashboard, Eingabe, Übersicht, Auswertung)
5. Community-Seiten anpassen

### Phase 3: Testing (1-2 Tage)
1. RLS Tests (SQL)
2. UI Tests (Manuell)
3. Edge Cases testen

### Phase 4: Production Migration (1 Tag)
1. Backup erstellen
2. Migrations ausführen
3. Smoke Tests
4. Monitor Errors

### Phase 5: Dokumentation (ongoing)
1. API Docs
2. Component Docs
3. Migration Guide

---

## 7. NÄCHSTE SCHRITTE

### Jetzt sofort:
1. Erstelle Migrations-Verzeichnis
2. Schreibe SQL-Skripte
3. Lokales Testing Setup

### Danach:
1. Code-Anpassungen
2. Testing
3. Production Deployment

---

**Erstellt:** 2026-01-28
**Version:** 1.0
**Status:** 🟢 READY TO EXECUTE
**Geschätzte Umsetzungszeit:** 5-8 Tage
**Risiko:** 🟢 LOW (Test-Daten, sauberer Neuaufbau)
