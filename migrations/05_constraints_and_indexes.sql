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
