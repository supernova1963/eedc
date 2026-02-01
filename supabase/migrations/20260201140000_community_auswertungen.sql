-- ============================================
-- MIGRATION: Community Auswertungen
-- ============================================
-- Datum: 2026-02-01
-- Beschreibung: Erweitert Community-Funktionen um Auswertungsdaten
-- WICHTIG: Nutzt 'investitionen' statt 'alternative_investitionen'
-- ============================================

-- ============================================
-- 1. Korrigiere get_public_anlagen - nutze investitionen Tabelle
-- ============================================

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
  profil_oeffentlich boolean,
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
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_plz ELSE LEFT(a.standort_plz, 2) || 'XXX' END as standort_plz,
    a.standort_ort,
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_latitude ELSE NULL END as standort_latitude,
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_longitude ELSE NULL END as standort_longitude,
    m.id as mitglied_id,
    COALESCE(m.display_name, m.vorname) as mitglied_display_name,
    -- Anzahl Investitionen als Komponenten (KORRIGIERT: investitionen statt alternative_investitionen)
    (SELECT COUNT(*) FROM investitionen i WHERE i.anlage_id = a.id AND i.aktiv = true) as anzahl_komponenten,
    -- Prüfe auf Speicher
    EXISTS(SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND i.typ = 'speicher' AND i.aktiv = true) as hat_speicher,
    -- Prüfe auf Wallbox/E-Auto
    EXISTS(SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND (i.typ = 'e-auto' OR i.typ = 'wallbox') AND i.aktiv = true) as hat_wallbox,
    -- Freigabe-Flags
    COALESCE(m.profil_oeffentlich, false) as profil_oeffentlich,
    COALESCE(a.kennzahlen_oeffentlich, false) as kennzahlen_oeffentlich,
    COALESCE(a.monatsdaten_oeffentlich, false) as monatsdaten_oeffentlich,
    COALESCE(a.komponenten_oeffentlich, false) as komponenten_oeffentlich
  FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.oeffentlich = true
    AND a.aktiv = true
    AND m.aktiv = true
  ORDER BY a.installationsdatum DESC;
$$;

-- ============================================
-- 2. Korrigiere get_community_stats
-- ============================================

CREATE OR REPLACE FUNCTION get_community_stats()
RETURNS TABLE (
  anzahl_anlagen bigint,
  gesamtleistung_kwp numeric,
  anzahl_mitglieder bigint,
  durchschnitt_leistung_kwp numeric,
  anzahl_mit_speicher bigint,
  anzahl_mit_wallbox bigint,
  neueste_anlage_datum date,
  aelteste_anlage_datum date
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COUNT(DISTINCT a.id) as anzahl_anlagen,
    COALESCE(SUM(a.leistung_kwp), 0) as gesamtleistung_kwp,
    COUNT(DISTINCT m.id) as anzahl_mitglieder,
    COALESCE(ROUND(AVG(a.leistung_kwp), 2), 0) as durchschnitt_leistung_kwp,
    (SELECT COUNT(DISTINCT i.anlage_id)
     FROM investitionen i
     JOIN anlagen a2 ON a2.id = i.anlage_id
     WHERE i.typ = 'speicher' AND i.aktiv = true AND a2.oeffentlich = true) as anzahl_mit_speicher,
    (SELECT COUNT(DISTINCT i.anlage_id)
     FROM investitionen i
     JOIN anlagen a2 ON a2.id = i.anlage_id
     WHERE (i.typ = 'e-auto' OR i.typ = 'wallbox') AND i.aktiv = true AND a2.oeffentlich = true) as anzahl_mit_wallbox,
    MAX(a.installationsdatum) as neueste_anlage_datum,
    MIN(a.installationsdatum) as aelteste_anlage_datum
  FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.oeffentlich = true
    AND a.aktiv = true
    AND m.aktiv = true;
$$;

-- ============================================
-- 3. Korrigiere get_public_komponenten - nutze investitionen
-- ============================================

CREATE OR REPLACE FUNCTION get_public_komponenten(p_anlage_id uuid)
RETURNS TABLE (
  id uuid,
  typ text,
  bezeichnung text,
  anschaffungsdatum date,
  parameter jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    i.id,
    i.typ,
    i.bezeichnung,
    i.anschaffungsdatum,
    -- Parameter direkt aus JSONB-Feld (ohne sensible Kostendaten)
    i.parameter
  FROM investitionen i
  JOIN anlagen a ON a.id = i.anlage_id
  WHERE i.anlage_id = p_anlage_id
    AND i.aktiv = true
    AND a.oeffentlich = true
    AND a.komponenten_oeffentlich = true
  ORDER BY i.typ, i.anschaffungsdatum;
$$;

-- ============================================
-- 4. Korrigiere search_public_anlagen
-- ============================================

CREATE OR REPLACE FUNCTION search_public_anlagen(
  p_plz_prefix text DEFAULT NULL,
  p_ort text DEFAULT NULL,
  p_min_kwp numeric DEFAULT NULL,
  p_max_kwp numeric DEFAULT NULL,
  p_hat_speicher boolean DEFAULT NULL,
  p_hat_wallbox boolean DEFAULT NULL
)
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
  profil_oeffentlich boolean,
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
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_plz ELSE LEFT(a.standort_plz, 2) || 'XXX' END as standort_plz,
    a.standort_ort,
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_latitude ELSE NULL END as standort_latitude,
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_longitude ELSE NULL END as standort_longitude,
    m.id as mitglied_id,
    COALESCE(m.display_name, m.vorname) as mitglied_display_name,
    (SELECT COUNT(*) FROM investitionen i WHERE i.anlage_id = a.id AND i.aktiv = true) as anzahl_komponenten,
    EXISTS(SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND i.typ = 'speicher' AND i.aktiv = true) as hat_speicher,
    EXISTS(SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND (i.typ = 'e-auto' OR i.typ = 'wallbox') AND i.aktiv = true) as hat_wallbox,
    COALESCE(m.profil_oeffentlich, false) as profil_oeffentlich,
    COALESCE(a.kennzahlen_oeffentlich, false) as kennzahlen_oeffentlich,
    COALESCE(a.monatsdaten_oeffentlich, false) as monatsdaten_oeffentlich,
    COALESCE(a.komponenten_oeffentlich, false) as komponenten_oeffentlich
  FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.oeffentlich = true
    AND a.aktiv = true
    AND m.aktiv = true
    AND (p_plz_prefix IS NULL OR a.standort_plz LIKE p_plz_prefix || '%')
    AND (p_ort IS NULL OR LOWER(a.standort_ort) LIKE '%' || LOWER(p_ort) || '%')
    AND (p_min_kwp IS NULL OR a.leistung_kwp >= p_min_kwp)
    AND (p_max_kwp IS NULL OR a.leistung_kwp <= p_max_kwp)
    AND (p_hat_speicher IS NULL OR p_hat_speicher = EXISTS(
      SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND i.typ = 'speicher' AND i.aktiv = true
    ))
    AND (p_hat_wallbox IS NULL OR p_hat_wallbox = EXISTS(
      SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND (i.typ = 'e-auto' OR i.typ = 'wallbox') AND i.aktiv = true
    ))
  ORDER BY a.installationsdatum DESC;
$$;

-- ============================================
-- 5. NEUE FUNKTION: get_public_auswertung - Wirtschaftlichkeitsdaten
-- ============================================
-- Liefert aggregierte Auswertungsdaten für öffentliche Anlagen
-- Voraussetzung: kennzahlen_oeffentlich = true

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
    AND a.kennzahlen_oeffentlich = true
    AND a.aktiv = true;
$$;

COMMENT ON FUNCTION get_public_auswertung(uuid) IS 'Liefert aggregierte Auswertungsdaten für öffentliche Anlagen (wenn kennzahlen_oeffentlich)';

-- ============================================
-- 6. NEUE FUNKTION: get_public_jahresvergleich - Jahresweise Daten
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
    AND a.kennzahlen_oeffentlich = true
    AND a.aktiv = true
  GROUP BY md.jahr, a.leistung_kwp
  ORDER BY md.jahr DESC;
$$;

COMMENT ON FUNCTION get_public_jahresvergleich(uuid) IS 'Liefert jahresweise aggregierte Daten für öffentliche Anlagen';

-- ============================================
-- Verifizierung
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Community Functions korrigiert (investitionen statt alternative_investitionen)';
  RAISE NOTICE '✅ get_public_auswertung() erstellt';
  RAISE NOTICE '✅ get_public_jahresvergleich() erstellt';
END $$;
