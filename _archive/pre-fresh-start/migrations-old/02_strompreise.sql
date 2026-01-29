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
