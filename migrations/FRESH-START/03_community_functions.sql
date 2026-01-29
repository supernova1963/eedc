-- ============================================
-- MIGRATION 03: Community Functions
-- ============================================
-- Datum: 2026-01-29
-- Beschreibung: RPC-Funktionen für Community-Features (öffentliche Anlagen)
-- WICHTIG: Diese Funktionen ermöglichen anonymen Zugriff auf freigegebene Daten
-- ============================================

-- ============================================
-- 0. Alte Funktionen löschen (falls vorhanden mit anderer Signatur)
-- ============================================
DROP FUNCTION IF EXISTS get_public_anlagen();
DROP FUNCTION IF EXISTS get_community_stats();
DROP FUNCTION IF EXISTS get_public_anlage_details(uuid);
DROP FUNCTION IF EXISTS get_public_monatsdaten(uuid);
DROP FUNCTION IF EXISTS search_public_anlagen(text, text, numeric, numeric, boolean, boolean);
DROP FUNCTION IF EXISTS get_public_komponenten(uuid);

-- ============================================
-- 1. get_public_anlagen - Liste öffentlicher Anlagen
-- ============================================
-- Benutzt von: /community (Anlagen-Liste)

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
    -- Standort nur wenn freigegeben
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_plz ELSE LEFT(a.standort_plz, 2) || 'XXX' END as standort_plz,
    a.standort_ort,
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_latitude ELSE NULL END as standort_latitude,
    CASE WHEN a.standort_genau_anzeigen THEN a.standort_longitude ELSE NULL END as standort_longitude,
    m.id as mitglied_id,
    COALESCE(m.display_name, m.vorname) as mitglied_display_name,
    -- Anzahl Investitionen als Komponenten
    (SELECT COUNT(*) FROM alternative_investitionen ai WHERE ai.anlage_id = a.id AND ai.aktiv = true) as anzahl_komponenten,
    -- Prüfe auf Speicher
    EXISTS(SELECT 1 FROM alternative_investitionen ai WHERE ai.anlage_id = a.id AND ai.typ = 'speicher' AND ai.aktiv = true) as hat_speicher,
    -- Prüfe auf Wallbox/E-Auto
    EXISTS(SELECT 1 FROM alternative_investitionen ai WHERE ai.anlage_id = a.id AND ai.typ = 'e-auto' AND ai.aktiv = true) as hat_wallbox,
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

COMMENT ON FUNCTION get_public_anlagen() IS 'Liefert alle öffentlichen Anlagen für Community-Übersicht';

-- ============================================
-- 2. get_community_stats - Community-Statistiken
-- ============================================
-- Benutzt von: /community (Dashboard-Stats)

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
    (SELECT COUNT(DISTINCT ai.anlage_id)
     FROM alternative_investitionen ai
     JOIN anlagen a2 ON a2.id = ai.anlage_id
     WHERE ai.typ = 'speicher' AND ai.aktiv = true AND a2.oeffentlich = true) as anzahl_mit_speicher,
    (SELECT COUNT(DISTINCT ai.anlage_id)
     FROM alternative_investitionen ai
     JOIN anlagen a2 ON a2.id = ai.anlage_id
     WHERE ai.typ = 'e-auto' AND ai.aktiv = true AND a2.oeffentlich = true) as anzahl_mit_wallbox,
    MAX(a.installationsdatum) as neueste_anlage_datum,
    MIN(a.installationsdatum) as aelteste_anlage_datum
  FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.oeffentlich = true
    AND a.aktiv = true
    AND m.aktiv = true;
$$;

COMMENT ON FUNCTION get_community_stats() IS 'Liefert aggregierte Statistiken für Community-Dashboard';

-- ============================================
-- 3. get_public_anlage_details - Einzelne Anlage Details
-- ============================================
-- Benutzt von: /community/[id] (Detailansicht)

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
  kennzahlen_oeffentlich boolean
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
    COALESCE(a.kennzahlen_oeffentlich, false) as kennzahlen_oeffentlich
  FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.id = p_anlage_id
    AND a.oeffentlich = true
    AND a.aktiv = true;
$$;

COMMENT ON FUNCTION get_public_anlage_details(uuid) IS 'Liefert Detailinformationen einer öffentlichen Anlage';

-- ============================================
-- 4. get_public_monatsdaten - Öffentliche Monatsdaten
-- ============================================
-- Benutzt von: /community/[id] (Monatsdaten-Grafiken)

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
    -- Autarkiegrad berechnen
    CASE
      WHEN COALESCE(md.gesamtverbrauch_kwh, 0) > 0
      THEN ROUND((COALESCE(md.direktverbrauch_kwh, 0) + COALESCE(md.batterieentladung_kwh, 0)) / md.gesamtverbrauch_kwh * 100, 1)
      ELSE 0
    END as autarkiegrad_prozent,
    -- Eigenverbrauchsquote berechnen
    CASE
      WHEN COALESCE(md.pv_erzeugung_kwh, 0) > 0
      THEN ROUND(COALESCE(md.direktverbrauch_kwh, 0) / md.pv_erzeugung_kwh * 100, 1)
      ELSE 0
    END as eigenverbrauchsquote_prozent
  FROM monatsdaten md
  JOIN anlagen a ON a.id = md.anlage_id
  WHERE md.anlage_id = p_anlage_id
    AND a.oeffentlich = true
    AND a.monatsdaten_oeffentlich = true
  ORDER BY md.jahr DESC, md.monat DESC;
$$;

COMMENT ON FUNCTION get_public_monatsdaten(uuid) IS 'Liefert öffentliche Monatsdaten einer Anlage';

-- ============================================
-- 5. search_public_anlagen - Suche mit Filtern
-- ============================================
-- Benutzt von: /community (Filter-Funktion)

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
    (SELECT COUNT(*) FROM alternative_investitionen ai WHERE ai.anlage_id = a.id AND ai.aktiv = true) as anzahl_komponenten,
    EXISTS(SELECT 1 FROM alternative_investitionen ai WHERE ai.anlage_id = a.id AND ai.typ = 'speicher' AND ai.aktiv = true) as hat_speicher,
    EXISTS(SELECT 1 FROM alternative_investitionen ai WHERE ai.anlage_id = a.id AND ai.typ = 'e-auto' AND ai.aktiv = true) as hat_wallbox,
    COALESCE(m.profil_oeffentlich, false) as profil_oeffentlich,
    COALESCE(a.kennzahlen_oeffentlich, false) as kennzahlen_oeffentlich,
    COALESCE(a.monatsdaten_oeffentlich, false) as monatsdaten_oeffentlich,
    COALESCE(a.komponenten_oeffentlich, false) as komponenten_oeffentlich
  FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.oeffentlich = true
    AND a.aktiv = true
    AND m.aktiv = true
    -- Filter anwenden
    AND (p_plz_prefix IS NULL OR a.standort_plz LIKE p_plz_prefix || '%')
    AND (p_ort IS NULL OR LOWER(a.standort_ort) LIKE '%' || LOWER(p_ort) || '%')
    AND (p_min_kwp IS NULL OR a.leistung_kwp >= p_min_kwp)
    AND (p_max_kwp IS NULL OR a.leistung_kwp <= p_max_kwp)
    AND (p_hat_speicher IS NULL OR p_hat_speicher = EXISTS(
      SELECT 1 FROM alternative_investitionen ai WHERE ai.anlage_id = a.id AND ai.typ = 'speicher' AND ai.aktiv = true
    ))
    AND (p_hat_wallbox IS NULL OR p_hat_wallbox = EXISTS(
      SELECT 1 FROM alternative_investitionen ai WHERE ai.anlage_id = a.id AND ai.typ = 'e-auto' AND ai.aktiv = true
    ))
  ORDER BY a.installationsdatum DESC;
$$;

COMMENT ON FUNCTION search_public_anlagen(text, text, numeric, numeric, boolean, boolean) IS 'Sucht öffentliche Anlagen mit optionalen Filtern';

-- ============================================
-- 6. get_public_komponenten - Öffentliche Komponenten/Investitionen
-- ============================================
-- Benutzt von: /community/[id] (Komponenten-Liste)

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
    ai.id,
    ai.typ,
    ai.bezeichnung,
    ai.anschaffungsdatum,
    ai.parameter
  FROM alternative_investitionen ai
  JOIN anlagen a ON a.id = ai.anlage_id
  WHERE ai.anlage_id = p_anlage_id
    AND ai.aktiv = true
    AND a.oeffentlich = true
    AND a.komponenten_oeffentlich = true
  ORDER BY ai.typ, ai.anschaffungsdatum;
$$;

COMMENT ON FUNCTION get_public_komponenten(uuid) IS 'Liefert öffentliche Komponenten einer Anlage';

-- ============================================
-- 7. Verifizierung
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ get_public_anlagen() erstellt';
  RAISE NOTICE '✅ get_community_stats() erstellt';
  RAISE NOTICE '✅ get_public_anlage_details() erstellt';
  RAISE NOTICE '✅ get_public_monatsdaten() erstellt';
  RAISE NOTICE '✅ search_public_anlagen() erstellt';
  RAISE NOTICE '✅ get_public_komponenten() erstellt';
  RAISE NOTICE '';
  RAISE NOTICE '📌 WICHTIG: Diese Funktionen müssen in Supabase ausgeführt werden!';
END $$;
