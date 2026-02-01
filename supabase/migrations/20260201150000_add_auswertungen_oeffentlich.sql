-- ============================================
-- MIGRATION: auswertungen_oeffentlich Feld hinzufügen
-- ============================================
-- Datum: 2026-02-01
-- Beschreibung: Separates Feld für Auswertungen-Freigabe (unterscheidet sich von Kennzahlen)
-- ============================================

-- ============================================
-- 1. Feld zur anlagen-Tabelle hinzufügen
-- ============================================

ALTER TABLE anlagen
ADD COLUMN IF NOT EXISTS auswertungen_oeffentlich boolean DEFAULT false;

COMMENT ON COLUMN anlagen.auswertungen_oeffentlich IS 'Auswertungen öffentlich teilen (Wirtschaftlichkeit, ROI, Jahresvergleich)';

-- ============================================
-- 2. get_public_anlage_details aktualisieren - auswertungen_oeffentlich hinzufügen
-- ============================================

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
  profilbeschreibung text,
  motivation text,
  erfahrungen text,
  tipps_fuer_andere text,
  kontakt_erwuenscht boolean,
  komponenten_oeffentlich boolean,
  monatsdaten_oeffentlich boolean,
  kennzahlen_oeffentlich boolean,
  auswertungen_oeffentlich boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    a.id as anlage_id,
    a.anlagenname,
    a.beschreibung,
    a.leistung_kwp,
    a.installationsdatum,
    a.standort_ort,
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_plz ELSE LEFT(a.standort_plz, 2) || 'XXX' END as standort_plz,
    a.ausrichtung,
    a.neigungswinkel_grad,
    COALESCE(m.display_name, m.vorname) as mitglied_display_name,
    CASE WHEN m.profil_oeffentlich THEN m.bio ELSE NULL END as mitglied_bio,
    a.profilbeschreibung,
    a.motivation,
    a.erfahrungen,
    a.tipps_fuer_andere,
    a.kontakt_erwuenscht,
    COALESCE(a.komponenten_oeffentlich, false) as komponenten_oeffentlich,
    COALESCE(a.monatsdaten_oeffentlich, false) as monatsdaten_oeffentlich,
    COALESCE(a.kennzahlen_oeffentlich, false) as kennzahlen_oeffentlich,
    COALESCE(a.auswertungen_oeffentlich, false) as auswertungen_oeffentlich
  FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.id = p_anlage_id
    AND a.oeffentlich = true
    AND a.aktiv = true;
$$;

COMMENT ON FUNCTION get_public_anlage_details(uuid) IS 'Liefert Detailinformationen einer öffentlichen Anlage (inkl. auswertungen_oeffentlich)';

-- ============================================
-- 3. get_public_auswertung aktualisieren - nutzt auswertungen_oeffentlich
-- ============================================

CREATE OR REPLACE FUNCTION get_public_auswertung(p_anlage_id uuid)
RETURNS TABLE (
  anlage_id uuid,
  -- Energie-Kennzahlen (gesamt)
  gesamt_erzeugung_kwh numeric,
  gesamt_einspeisung_kwh numeric,
  gesamt_eigenverbrauch_kwh numeric,
  gesamt_netzbezug_kwh numeric,
  -- Durchschnittswerte
  durchschnitt_autarkie_prozent numeric,
  durchschnitt_eigenverbrauchsquote_prozent numeric,
  durchschnitt_erzeugung_monat_kwh numeric,
  -- Spezifische Werte
  spezifischer_ertrag_kwh_kwp numeric,
  -- Zeitraum
  anzahl_monate integer,
  erster_monat date,
  letzter_monat date,
  -- Wirtschaftlich (wenn freigegeben)
  gesamt_einspeisung_ertrag_euro numeric,
  gesamt_ev_einsparung_euro numeric,
  durchschnitt_netto_ertrag_monat_euro numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH monatsdaten_agg AS (
    SELECT
      md.anlage_id,
      COUNT(*) as anzahl_monate,
      MIN(make_date(md.jahr, md.monat, 1)) as erster_monat,
      MAX(make_date(md.jahr, md.monat, 1)) as letzter_monat,
      -- Summen
      COALESCE(SUM(md.pv_erzeugung_kwh), 0) as gesamt_erzeugung,
      COALESCE(SUM(md.einspeisung_kwh), 0) as gesamt_einspeisung,
      COALESCE(SUM(md.direktverbrauch_kwh), 0) + COALESCE(SUM(md.batterieentladung_kwh), 0) as gesamt_eigenverbrauch,
      COALESCE(SUM(md.netzbezug_kwh), 0) as gesamt_netzbezug,
      COALESCE(SUM(md.gesamtverbrauch_kwh), 0) as gesamt_verbrauch,
      -- Finanzen
      COALESCE(SUM(md.einspeisung_ertrag_euro), 0) as gesamt_einspeisung_ertrag,
      -- Durchschnittlicher Strompreis aus Monatsdaten (in ct -> /100 für Euro)
      COALESCE(AVG(md.netzbezug_preis_cent_kwh), 30) / 100.0 as avg_strompreis_euro
    FROM monatsdaten md
    WHERE md.anlage_id = p_anlage_id
    GROUP BY md.anlage_id
  )
  SELECT
    a.id as anlage_id,
    -- Energie
    ROUND(ma.gesamt_erzeugung, 1) as gesamt_erzeugung_kwh,
    ROUND(ma.gesamt_einspeisung, 1) as gesamt_einspeisung_kwh,
    ROUND(ma.gesamt_eigenverbrauch, 1) as gesamt_eigenverbrauch_kwh,
    ROUND(ma.gesamt_netzbezug, 1) as gesamt_netzbezug_kwh,
    -- Durchschnitte
    CASE WHEN ma.gesamt_verbrauch > 0
      THEN ROUND(ma.gesamt_eigenverbrauch / ma.gesamt_verbrauch * 100, 1)
      ELSE 0
    END as durchschnitt_autarkie_prozent,
    CASE WHEN ma.gesamt_erzeugung > 0
      THEN ROUND(ma.gesamt_eigenverbrauch / ma.gesamt_erzeugung * 100, 1)
      ELSE 0
    END as durchschnitt_eigenverbrauchsquote_prozent,
    ROUND(ma.gesamt_erzeugung / NULLIF(ma.anzahl_monate, 0), 1) as durchschnitt_erzeugung_monat_kwh,
    -- Spezifisch
    CASE WHEN a.leistung_kwp > 0
      THEN ROUND(ma.gesamt_erzeugung / a.leistung_kwp, 1)
      ELSE 0
    END as spezifischer_ertrag_kwh_kwp,
    -- Zeitraum
    ma.anzahl_monate::integer,
    ma.erster_monat,
    ma.letzter_monat,
    -- Wirtschaftlich (Strompreis aus Monatsdaten, Fallback 0.30 €/kWh)
    ROUND(ma.gesamt_einspeisung_ertrag, 2) as gesamt_einspeisung_ertrag_euro,
    ROUND(ma.gesamt_eigenverbrauch * ma.avg_strompreis_euro, 2) as gesamt_ev_einsparung_euro,
    ROUND((ma.gesamt_eigenverbrauch * ma.avg_strompreis_euro + ma.gesamt_einspeisung_ertrag) / NULLIF(ma.anzahl_monate, 0), 2) as durchschnitt_netto_ertrag_monat_euro
  FROM anlagen a
  LEFT JOIN monatsdaten_agg ma ON ma.anlage_id = a.id
  WHERE a.id = p_anlage_id
    AND a.oeffentlich = true
    AND a.auswertungen_oeffentlich = true  -- GEÄNDERT: auswertungen statt kennzahlen
    AND a.aktiv = true;
$$;

COMMENT ON FUNCTION get_public_auswertung(uuid) IS 'Liefert aggregierte Auswertungsdaten für öffentliche Anlagen (wenn auswertungen_oeffentlich)';

-- ============================================
-- 4. get_public_jahresvergleich aktualisieren - nutzt auswertungen_oeffentlich
-- ============================================

CREATE OR REPLACE FUNCTION get_public_jahresvergleich(p_anlage_id uuid)
RETURNS TABLE (
  jahr integer,
  anzahl_monate integer,
  erzeugung_kwh numeric,
  eigenverbrauch_kwh numeric,
  einspeisung_kwh numeric,
  netzbezug_kwh numeric,
  autarkie_prozent numeric,
  eigenverbrauchsquote_prozent numeric,
  spezifischer_ertrag_kwh_kwp numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    md.jahr,
    COUNT(*)::integer as anzahl_monate,
    ROUND(SUM(COALESCE(md.pv_erzeugung_kwh, 0)), 1) as erzeugung_kwh,
    ROUND(SUM(COALESCE(md.direktverbrauch_kwh, 0)) + SUM(COALESCE(md.batterieentladung_kwh, 0)), 1) as eigenverbrauch_kwh,
    ROUND(SUM(COALESCE(md.einspeisung_kwh, 0)), 1) as einspeisung_kwh,
    ROUND(SUM(COALESCE(md.netzbezug_kwh, 0)), 1) as netzbezug_kwh,
    -- Autarkie
    CASE WHEN SUM(COALESCE(md.gesamtverbrauch_kwh, 0)) > 0
      THEN ROUND((SUM(COALESCE(md.direktverbrauch_kwh, 0)) + SUM(COALESCE(md.batterieentladung_kwh, 0))) / SUM(md.gesamtverbrauch_kwh) * 100, 1)
      ELSE 0
    END as autarkie_prozent,
    -- Eigenverbrauchsquote
    CASE WHEN SUM(COALESCE(md.pv_erzeugung_kwh, 0)) > 0
      THEN ROUND((SUM(COALESCE(md.direktverbrauch_kwh, 0)) + SUM(COALESCE(md.batterieentladung_kwh, 0))) / SUM(md.pv_erzeugung_kwh) * 100, 1)
      ELSE 0
    END as eigenverbrauchsquote_prozent,
    -- Spezifischer Ertrag
    CASE WHEN a.leistung_kwp > 0
      THEN ROUND(SUM(COALESCE(md.pv_erzeugung_kwh, 0)) / a.leistung_kwp, 1)
      ELSE 0
    END as spezifischer_ertrag_kwh_kwp
  FROM monatsdaten md
  JOIN anlagen a ON a.id = md.anlage_id
  WHERE md.anlage_id = p_anlage_id
    AND a.oeffentlich = true
    AND a.auswertungen_oeffentlich = true  -- GEÄNDERT: auswertungen statt kennzahlen
    AND a.aktiv = true
  GROUP BY md.jahr, a.leistung_kwp
  ORDER BY md.jahr DESC;
$$;

COMMENT ON FUNCTION get_public_jahresvergleich(uuid) IS 'Liefert jahresweise aggregierte Daten für öffentliche Anlagen (wenn auswertungen_oeffentlich)';

-- ============================================
-- Verifizierung
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Feld auswertungen_oeffentlich zur anlagen-Tabelle hinzugefügt';
  RAISE NOTICE '✅ get_public_anlage_details() aktualisiert';
  RAISE NOTICE '✅ get_public_auswertung() nutzt jetzt auswertungen_oeffentlich';
  RAISE NOTICE '✅ get_public_jahresvergleich() nutzt jetzt auswertungen_oeffentlich';
END $$;
