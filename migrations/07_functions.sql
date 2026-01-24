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
