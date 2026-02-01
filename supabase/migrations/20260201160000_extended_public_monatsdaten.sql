-- ============================================
-- MIGRATION: Erweiterte öffentliche Monatsdaten
-- ============================================
-- Datum: 2026-02-01
-- Beschreibung: Erweitert get_public_monatsdaten für Monatsdetail-Ansicht
-- ============================================

-- Alte Funktion löschen (Return-Type ändert sich)
DROP FUNCTION IF EXISTS get_public_monatsdaten(uuid);

-- ============================================
-- Erweiterte get_public_monatsdaten - mit allen Feldern für Monatsdetail
-- ============================================
-- Voraussetzung: auswertungen_oeffentlich = true (nicht nur monatsdaten_oeffentlich)

CREATE OR REPLACE FUNCTION get_public_monatsdaten(p_anlage_id uuid)
RETURNS TABLE (
  jahr integer,
  monat integer,
  -- Energie
  pv_erzeugung_kwh numeric,
  direktverbrauch_kwh numeric,
  einspeisung_kwh numeric,
  netzbezug_kwh numeric,
  gesamtverbrauch_kwh numeric,
  -- Batterie
  batterieladung_kwh numeric,
  batterieentladung_kwh numeric,
  -- Finanzen
  einspeisung_ertrag_euro numeric,
  netzbezug_kosten_euro numeric,
  betriebsausgaben_monat_euro numeric,
  -- Berechnete Kennzahlen
  eigenverbrauch_kwh numeric,
  autarkiegrad_prozent numeric,
  eigenverbrauchsquote_prozent numeric,
  -- Strompreis (für Tooltip-Berechnungen)
  strompreis_cent_kwh numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    md.jahr,
    md.monat,
    -- Energie
    COALESCE(md.pv_erzeugung_kwh, 0) as pv_erzeugung_kwh,
    COALESCE(md.direktverbrauch_kwh, 0) as direktverbrauch_kwh,
    COALESCE(md.einspeisung_kwh, 0) as einspeisung_kwh,
    COALESCE(md.netzbezug_kwh, 0) as netzbezug_kwh,
    COALESCE(md.gesamtverbrauch_kwh, 0) as gesamtverbrauch_kwh,
    -- Batterie
    COALESCE(md.batterieladung_kwh, 0) as batterieladung_kwh,
    COALESCE(md.batterieentladung_kwh, 0) as batterieentladung_kwh,
    -- Finanzen
    COALESCE(md.einspeisung_ertrag_euro, 0) as einspeisung_ertrag_euro,
    COALESCE(md.netzbezug_kosten_euro, 0) as netzbezug_kosten_euro,
    COALESCE(md.betriebsausgaben_monat_euro, 0) as betriebsausgaben_monat_euro,
    -- Berechnete Kennzahlen
    COALESCE(md.direktverbrauch_kwh, 0) + COALESCE(md.batterieentladung_kwh, 0) as eigenverbrauch_kwh,
    -- Autarkiegrad
    CASE
      WHEN COALESCE(md.gesamtverbrauch_kwh, 0) > 0
      THEN ROUND((COALESCE(md.direktverbrauch_kwh, 0) + COALESCE(md.batterieentladung_kwh, 0)) / md.gesamtverbrauch_kwh * 100, 1)
      ELSE 0
    END as autarkiegrad_prozent,
    -- Eigenverbrauchsquote
    CASE
      WHEN COALESCE(md.pv_erzeugung_kwh, 0) > 0
      THEN ROUND((COALESCE(md.direktverbrauch_kwh, 0) + COALESCE(md.batterieentladung_kwh, 0)) / md.pv_erzeugung_kwh * 100, 1)
      ELSE 0
    END as eigenverbrauchsquote_prozent,
    -- Strompreis
    COALESCE(md.netzbezug_preis_cent_kwh, 30) as strompreis_cent_kwh
  FROM monatsdaten md
  JOIN anlagen a ON a.id = md.anlage_id
  WHERE md.anlage_id = p_anlage_id
    AND a.oeffentlich = true
    AND a.auswertungen_oeffentlich = true  -- Auswertungen müssen freigegeben sein
    AND a.aktiv = true
  ORDER BY md.jahr DESC, md.monat DESC;
$$;

COMMENT ON FUNCTION get_public_monatsdaten(uuid) IS 'Liefert erweiterte öffentliche Monatsdaten für Monatsdetail-Ansicht (wenn auswertungen_oeffentlich)';

-- ============================================
-- Verifizierung
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ get_public_monatsdaten() erweitert für Monatsdetail-Ansicht';
  RAISE NOTICE '   - Batteriedaten (Ladung/Entladung)';
  RAISE NOTICE '   - Finanzdaten (Erlöse, Kosten)';
  RAISE NOTICE '   - Berechnete Kennzahlen';
  RAISE NOTICE '   - Strompreis für Tooltips';
END $$;
