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
