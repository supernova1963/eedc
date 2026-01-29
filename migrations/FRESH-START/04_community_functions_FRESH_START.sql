-- ============================================
-- COMMUNITY FUNCTIONS - FRESH START SCHEMA
-- ============================================
-- Arbeitet mit Freigaben direkt in anlagen Tabelle
-- Gemäß MASTER-REFACTORING-PLAN.md

-- ============================================
-- SCHRITT 1: Alte Functions löschen
-- ============================================

DROP FUNCTION IF EXISTS get_public_anlagen() CASCADE;
DROP FUNCTION IF EXISTS get_community_stats() CASCADE;
DROP FUNCTION IF EXISTS get_public_anlage_details(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_public_monatsdaten(uuid) CASCADE;
DROP FUNCTION IF EXISTS search_public_anlagen(text, text, numeric, numeric, boolean, boolean) CASCADE;
DROP FUNCTION IF EXISTS get_public_anlagen_with_members() CASCADE;

-- ============================================
-- SCHRITT 2: Neue Functions erstellen
-- ============================================

-- 1. get_public_anlagen()
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
    CASE
      WHEN a.standort_genau_anzeigen THEN a.standort_plz
      ELSE COALESCE(LEFT(a.standort_plz, 2) || 'XXX', 'k.A.')
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
    COALESCE(m.display_name, m.vorname || ' ' || LEFT(m.nachname, 1) || '.') as mitglied_display_name,
    (SELECT COUNT(*) FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.aktiv = true) as anzahl_komponenten,
    EXISTS (SELECT 1 FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.typ = 'speicher' AND ak.aktiv = true) as hat_speicher,
    EXISTS (SELECT 1 FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.typ = 'wallbox' AND ak.aktiv = true) as hat_wallbox,
    a.oeffentlich as profil_oeffentlich,
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
COMMENT ON FUNCTION get_public_anlagen() IS 'Liefert alle öffentlichen PV-Anlagen - FRESH START Schema';

-- 2. get_community_stats()
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
    MAX(a.installationsdatum) as neueste_anlage_datum,
    MIN(a.installationsdatum) as aelteste_anlage_datum
  FROM anlagen a
  WHERE a.oeffentlich = true
    AND a.aktiv = true;
$$;

GRANT EXECUTE ON FUNCTION get_community_stats() TO anon, authenticated;
COMMENT ON FUNCTION get_community_stats() IS 'Liefert aggregierte Statistiken - FRESH START Schema';

-- 3. get_public_anlage_details()
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
  monatsdaten_summary jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM anlagen a
    WHERE a.id = p_anlage_id
      AND a.oeffentlich = true
      AND a.aktiv = true
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
      ELSE COALESCE(LEFT(a.standort_plz, 2) || 'XXX', 'k.A.')
    END as standort_plz,
    a.ausrichtung,
    a.neigungswinkel_grad,
    COALESCE(m.display_name, m.vorname || ' ' || LEFT(m.nachname, 1) || '.') as mitglied_display_name,
    CASE WHEN m.profil_oeffentlich THEN m.bio ELSE NULL END as mitglied_bio,
    CASE WHEN a.komponenten_oeffentlich THEN (
      SELECT jsonb_agg(jsonb_build_object(
        'typ', ak.typ,
        'bezeichnung', ak.bezeichnung,
        'hersteller', ak.hersteller,
        'modell', ak.modell,
        'anschaffungsdatum', ak.anschaffungsdatum
      ))
      FROM anlagen_komponenten ak
      WHERE ak.anlage_id = a.id AND ak.aktiv = true
    ) ELSE NULL END as komponenten,
    CASE WHEN a.monatsdaten_oeffentlich THEN (
      SELECT jsonb_build_object(
        'anzahl_monate', COUNT(*),
        'gesamt_erzeugung_kwh', COALESCE(SUM(pv_erzeugung_kwh), 0),
        'gesamt_einspeisung_kwh', COALESCE(SUM(einspeisung_kwh), 0),
        'gesamt_direktverbrauch_kwh', COALESCE(SUM(direktverbrauch_kwh), 0),
        'neuester_monat', MAX(jahr || '-' || LPAD(monat::text, 2, '0')),
        'aeltester_monat', MIN(jahr || '-' || LPAD(monat::text, 2, '0'))
      )
      FROM monatsdaten md
      WHERE md.anlage_id = a.id
    ) ELSE NULL END as monatsdaten_summary
  FROM anlagen a
  INNER JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.id = p_anlage_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_anlage_details(uuid) TO anon, authenticated;
COMMENT ON FUNCTION get_public_anlage_details(uuid) IS 'Liefert Details zu öffentlicher Anlage - FRESH START Schema';

-- 4. get_public_monatsdaten()
CREATE OR REPLACE FUNCTION get_public_monatsdaten(p_anlage_id uuid)
RETURNS TABLE (
  jahr integer,
  monat integer,
  pv_erzeugung_kwh numeric,
  direktverbrauch_kwh numeric,
  einspeisung_kwh numeric,
  netzbezug_kwh numeric,
  gesamtverbrauch_kwh numeric,
  autarkiegrad_prozent numeric,
  eigenverbrauchsquote_prozent numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    md.jahr,
    md.monat,
    md.pv_erzeugung_kwh,
    md.direktverbrauch_kwh,
    md.einspeisung_kwh,
    md.netzbezug_kwh,
    md.gesamtverbrauch_kwh,
    CASE
      WHEN md.gesamtverbrauch_kwh > 0 THEN
        ROUND(((md.direktverbrauch_kwh + COALESCE(md.batterieentladung_kwh, 0)) / md.gesamtverbrauch_kwh * 100)::numeric, 1)
      ELSE 0
    END as autarkiegrad_prozent,
    CASE
      WHEN md.pv_erzeugung_kwh > 0 THEN
        ROUND((md.direktverbrauch_kwh / md.pv_erzeugung_kwh * 100)::numeric, 1)
      ELSE 0
    END as eigenverbrauchsquote_prozent
  FROM monatsdaten md
  INNER JOIN anlagen a ON a.id = md.anlage_id
  WHERE md.anlage_id = p_anlage_id
    AND a.monatsdaten_oeffentlich = true
    AND a.aktiv = true
  ORDER BY md.jahr DESC, md.monat DESC;
$$;

GRANT EXECUTE ON FUNCTION get_public_monatsdaten(uuid) TO anon, authenticated;
COMMENT ON FUNCTION get_public_monatsdaten(uuid) IS 'Liefert öffentliche Monatsdaten - FRESH START Schema';

-- 5. search_public_anlagen()
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
  mitglied_display_name text,
  anzahl_komponenten bigint,
  hat_speicher boolean,
  hat_wallbox boolean
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
      ELSE COALESCE(LEFT(a.standort_plz, 2) || 'XXX', 'k.A.')
    END as standort_plz,
    a.standort_ort,
    COALESCE(m.display_name, m.vorname || ' ' || LEFT(m.nachname, 1) || '.') as mitglied_display_name,
    (SELECT COUNT(*) FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.aktiv = true) as anzahl_komponenten,
    EXISTS (SELECT 1 FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.typ = 'speicher' AND ak.aktiv = true) as hat_speicher,
    EXISTS (SELECT 1 FROM anlagen_komponenten ak WHERE ak.anlage_id = a.id AND ak.typ = 'wallbox' AND ak.aktiv = true) as hat_wallbox
  FROM anlagen a
  INNER JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.oeffentlich = true
    AND a.aktiv = true
    AND (p_plz_prefix IS NULL OR a.standort_plz LIKE p_plz_prefix || '%')
    AND (p_ort IS NULL OR LOWER(a.standort_ort) LIKE '%' || LOWER(p_ort) || '%')
    AND (p_min_kwp IS NULL OR a.leistung_kwp >= p_min_kwp)
    AND (p_max_kwp IS NULL OR a.leistung_kwp <= p_max_kwp)
    AND (p_hat_speicher IS NULL OR p_hat_speicher = EXISTS (
      SELECT 1 FROM anlagen_komponenten ak
      WHERE ak.anlage_id = a.id AND ak.typ = 'speicher' AND ak.aktiv = true
    ))
    AND (p_hat_wallbox IS NULL OR p_hat_wallbox = EXISTS (
      SELECT 1 FROM anlagen_komponenten ak
      WHERE ak.anlage_id = a.id AND ak.typ = 'wallbox' AND ak.aktiv = true
    ))
  ORDER BY a.installationsdatum DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION search_public_anlagen(text, text, numeric, numeric, boolean, boolean) TO anon, authenticated;
COMMENT ON FUNCTION search_public_anlagen IS 'Sucht öffentliche Anlagen - FRESH START Schema';

-- ============================================
-- ERFOLGSMELDUNG
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Community Functions erfolgreich erstellt (FRESH START):';
  RAISE NOTICE '   - get_public_anlagen()';
  RAISE NOTICE '   - get_community_stats()';
  RAISE NOTICE '   - get_public_anlage_details(uuid)';
  RAISE NOTICE '   - get_public_monatsdaten(uuid)';
  RAISE NOTICE '   - search_public_anlagen(...)';
  RAISE NOTICE '';
  RAISE NOTICE 'Schema: Freigaben direkt in anlagen Tabelle';
  RAISE NOTICE '  - oeffentlich (Master-Switch)';
  RAISE NOTICE '  - standort_genau_anzeigen';
  RAISE NOTICE '  - kennzahlen_oeffentlich';
  RAISE NOTICE '  - monatsdaten_oeffentlich';
  RAISE NOTICE '  - komponenten_oeffentlich';
END $$;
