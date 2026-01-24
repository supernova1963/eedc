// scripts/migrate-schema.js
// Schema-Migration: Ergänzungen für Stammdaten und Wirtschaftlichkeits-Auswertungen

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Fehlende Supabase Credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Migration Steps
const migrations = [
  {
    name: '01_add_anlage_id_to_investitionen',
    description: 'Fügt anlage_id Spalte zu alternative_investitionen hinzu',
    sql: `
      ALTER TABLE public.alternative_investitionen
      ADD COLUMN IF NOT EXISTS anlage_id uuid;

      ALTER TABLE public.alternative_investitionen
      DROP CONSTRAINT IF EXISTS alternative_investitionen_anlage_id_fkey;

      ALTER TABLE public.alternative_investitionen
      ADD CONSTRAINT alternative_investitionen_anlage_id_fkey
      FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id);

      CREATE INDEX IF NOT EXISTS idx_alternative_investitionen_anlage
      ON public.alternative_investitionen(anlage_id);
    `
  },
  {
    name: '02_create_strompreise_table',
    description: 'Erstellt Tabelle für Strompreis-Stammdaten',
    sql: `
      CREATE TABLE IF NOT EXISTS public.strompreise (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        mitglied_id uuid NOT NULL,
        anlage_id uuid,
        gueltig_ab date NOT NULL,
        gueltig_bis date,

        netzbezug_arbeitspreis_cent_kwh numeric NOT NULL CHECK (netzbezug_arbeitspreis_cent_kwh >= 0),
        netzbezug_grundpreis_euro_monat numeric DEFAULT 0 CHECK (netzbezug_grundpreis_euro_monat >= 0),
        einspeiseverguetung_cent_kwh numeric NOT NULL CHECK (einspeiseverguetung_cent_kwh >= 0),

        anbieter_name text,
        vertragsart text,
        notizen text,
        erstellt_am timestamp with time zone DEFAULT now(),
        aktualisiert_am timestamp with time zone DEFAULT now(),

        CONSTRAINT strompreise_pkey PRIMARY KEY (id),
        CONSTRAINT strompreise_mitglied_id_fkey FOREIGN KEY (mitglied_id) REFERENCES public.mitglieder(id),
        CONSTRAINT strompreise_anlage_id_fkey FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id),
        CONSTRAINT strompreise_zeitraum_check CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab)
      );

      CREATE INDEX IF NOT EXISTS idx_strompreise_gueltig
      ON public.strompreise(mitglied_id, gueltig_ab, gueltig_bis);
    `
  },
  {
    name: '03_create_investitionstyp_config',
    description: 'Erstellt Konfigurationstabelle für Investitionstypen',
    sql: `
      CREATE TABLE IF NOT EXISTS public.investitionstyp_config (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        typ character varying NOT NULL UNIQUE,
        standardlebensdauer_jahre integer DEFAULT 20 CHECK (standardlebensdauer_jahre > 0),
        abschreibungsdauer_jahre integer DEFAULT 20 CHECK (abschreibungsdauer_jahre > 0),
        wartungskosten_prozent_pa numeric DEFAULT 1.0,
        co2_faktor_kg_kwh numeric DEFAULT 0.38,
        bezeichnung text NOT NULL,
        beschreibung text,
        aktiv boolean DEFAULT true,
        erstellt_am timestamp with time zone DEFAULT now(),

        CONSTRAINT investitionstyp_config_pkey PRIMARY KEY (id)
      );

      -- Basis-Daten einfügen (nur wenn Tabelle leer ist)
      INSERT INTO public.investitionstyp_config (typ, bezeichnung, standardlebensdauer_jahre, co2_faktor_kg_kwh)
      SELECT * FROM (VALUES
        ('pv-module', 'PV-Module', 25, 0.38),
        ('wechselrichter', 'Wechselrichter', 15, 0.38),
        ('speicher', 'Batteriespeicher', 15, 0.38),
        ('waermepumpe', 'Wärmepumpe', 20, 0.20),
        ('e-auto', 'E-Auto', 12, 0.15),
        ('balkonkraftwerk', 'Balkonkraftwerk', 20, 0.38),
        ('wallbox', 'Wallbox', 15, 0.00),
        ('sonstiges', 'Sonstiges', 20, 0.00)
      ) AS v(typ, bezeichnung, standardlebensdauer_jahre, co2_faktor_kg_kwh)
      WHERE NOT EXISTS (SELECT 1 FROM public.investitionstyp_config LIMIT 1);
    `
  },
  {
    name: '04_create_investition_kennzahlen',
    description: 'Erstellt Cache-Tabelle für Wirtschaftlichkeitskennzahlen',
    sql: `
      CREATE TABLE IF NOT EXISTS public.investition_kennzahlen (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        investition_id uuid NOT NULL UNIQUE,

        berechnet_am timestamp with time zone DEFAULT now(),
        bis_jahr integer NOT NULL,
        bis_monat integer NOT NULL,

        einsparung_kumuliert_euro numeric DEFAULT 0,
        kosten_kumuliert_euro numeric DEFAULT 0,
        bilanz_kumuliert_euro numeric DEFAULT 0,

        amortisationszeit_monate numeric,
        roi_prozent numeric,

        co2_einsparung_kumuliert_kg numeric DEFAULT 0,
        baeume_aequivalent integer DEFAULT 0,

        amortisiert_voraussichtlich_am date,

        CONSTRAINT investition_kennzahlen_pkey PRIMARY KEY (id),
        CONSTRAINT investition_kennzahlen_investition_id_fkey
          FOREIGN KEY (investition_id) REFERENCES public.alternative_investitionen(id) ON DELETE CASCADE
      );
    `
  },
  {
    name: '05_create_anlagen_kennzahlen',
    description: 'Erstellt Cache-Tabelle für Anlagen-Gesamtkennzahlen',
    sql: `
      CREATE TABLE IF NOT EXISTS public.anlagen_kennzahlen (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        anlage_id uuid NOT NULL UNIQUE,

        berechnet_am timestamp with time zone DEFAULT now(),
        bis_jahr integer NOT NULL,
        bis_monat integer NOT NULL,

        pv_erzeugung_gesamt_kwh numeric DEFAULT 0,
        eigenverbrauch_gesamt_kwh numeric DEFAULT 0,
        einspeisung_gesamt_kwh numeric DEFAULT 0,
        netzbezug_gesamt_kwh numeric DEFAULT 0,

        autarkiegrad_durchschnitt_prozent numeric,
        eigenverbrauchsquote_durchschnitt_prozent numeric,

        einspeiseerloese_gesamt_euro numeric DEFAULT 0,
        netzbezugskosten_gesamt_euro numeric DEFAULT 0,
        betriebsausgaben_gesamt_euro numeric DEFAULT 0,

        investitionskosten_gesamt_euro numeric DEFAULT 0,
        einsparungen_gesamt_euro numeric DEFAULT 0,
        bilanz_gesamt_euro numeric DEFAULT 0,

        co2_einsparung_gesamt_kg numeric DEFAULT 0,

        CONSTRAINT anlagen_kennzahlen_pkey PRIMARY KEY (id),
        CONSTRAINT anlagen_kennzahlen_anlage_id_fkey
          FOREIGN KEY (anlage_id) REFERENCES public.anlagen(id) ON DELETE CASCADE
      );
    `
  },
  {
    name: '06_add_unique_constraints',
    description: 'Fügt Unique Constraints für Monatsdaten hinzu',
    sql: `
      ALTER TABLE public.monatsdaten
      DROP CONSTRAINT IF EXISTS monatsdaten_anlage_jahr_monat_unique;

      ALTER TABLE public.monatsdaten
      ADD CONSTRAINT monatsdaten_anlage_jahr_monat_unique
      UNIQUE (anlage_id, jahr, monat);

      ALTER TABLE public.investition_monatsdaten
      DROP CONSTRAINT IF EXISTS investition_monatsdaten_unique;

      ALTER TABLE public.investition_monatsdaten
      ADD CONSTRAINT investition_monatsdaten_unique
      UNIQUE (investition_id, jahr, monat);

      CREATE INDEX IF NOT EXISTS idx_monatsdaten_zeitraum
      ON public.monatsdaten(anlage_id, jahr, monat);

      CREATE INDEX IF NOT EXISTS idx_investition_monatsdaten_zeitraum
      ON public.investition_monatsdaten(investition_id, jahr, monat);

      CREATE INDEX IF NOT EXISTS idx_alternative_investitionen_mitglied_aktiv
      ON public.alternative_investitionen(mitglied_id, aktiv);
    `
  },
  {
    name: '07_create_views',
    description: 'Erstellt Views für vereinfachte Abfragen',
    sql: `
      DROP VIEW IF EXISTS public.strompreise_aktuell;
      CREATE VIEW public.strompreise_aktuell AS
      SELECT DISTINCT ON (mitglied_id, COALESCE(anlage_id, '00000000-0000-0000-0000-000000000000'::uuid))
        *
      FROM public.strompreise
      WHERE gueltig_ab <= CURRENT_DATE
        AND (gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE)
      ORDER BY mitglied_id, COALESCE(anlage_id, '00000000-0000-0000-0000-000000000000'::uuid), gueltig_ab DESC;

      DROP VIEW IF EXISTS public.anlagen_komplett;
      CREATE VIEW public.anlagen_komplett AS
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
      GROUP BY a.id, m.id, m.vorname, m.nachname, m.email;
    `
  },
  {
    name: '08_create_functions',
    description: 'Erstellt Hilfsfunktionen für Berechnungen',
    sql: `
      DROP FUNCTION IF EXISTS get_strompreis(uuid, uuid, date, text);
      CREATE OR REPLACE FUNCTION get_strompreis(
        p_mitglied_id uuid,
        p_anlage_id uuid,
        p_datum date,
        p_typ text
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
          CASE WHEN anlage_id = p_anlage_id THEN 1 ELSE 2 END,
          gueltig_ab DESC
        LIMIT 1;

        RETURN v_preis;
      END;
      $$ LANGUAGE plpgsql;
    `
  }
]

async function runMigrations() {
  console.log('🚀 Starte Schema-Migration...\n')

  for (const migration of migrations) {
    console.log(`📝 ${migration.name}`)
    console.log(`   ${migration.description}`)

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: migration.sql })

      if (error) {
        // Versuche direkt über SQL auszuführen
        const { error: directError } = await supabase
          .from('_migrations')
          .insert({ name: migration.name, sql: migration.sql })

        if (directError) {
          console.error(`   ❌ Fehler: ${error.message}`)
          console.log(`   ⚠️  Bitte SQL manuell in Supabase SQL Editor ausführen\n`)
        }
      } else {
        console.log(`   ✅ Erfolgreich\n`)
      }
    } catch (err) {
      console.error(`   ❌ Exception: ${err.message}`)
      console.log(`   ℹ️  Migration kann nicht automatisch ausgeführt werden`)
      console.log(`   ℹ️  Bitte schema_ergaenzungen.sql manuell in Supabase ausführen\n`)
    }
  }

  console.log('✨ Migration abgeschlossen!')
  console.log('\n📖 Nächste Schritte:')
  console.log('   1. Überprüfe die Ausführung in Supabase Dashboard > SQL Editor')
  console.log('   2. Falls Fehler: Führe schema_ergaenzungen.sql manuell aus')
  console.log('   3. Teste die neuen Tabellen mit SELECT-Abfragen\n')
}

runMigrations().catch(console.error)
