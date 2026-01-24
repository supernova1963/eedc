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
