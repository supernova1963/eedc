-- ============================================
-- MIGRATION: Fix function search_path Security Warning
-- ============================================
-- Datum: 2026-02-02
-- Beschreibung: Behebt Supabase Security Warning "function_search_path_mutable"
--
-- Problem: Funktionen ohne SET search_path können durch Manipulation des
-- search_path ausgenutzt werden, um unbeabsichtigte Tabellen anzusprechen.
--
-- Lösung: Alle SECURITY DEFINER Funktionen erhalten SET search_path = public
-- ============================================

-- ============================================
-- 1. Basis-Funktionen (RLS Helper)
-- ============================================

-- 1.1 auth_user_id - Gibt aktuelle Auth-User-ID zurück
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

COMMENT ON FUNCTION auth_user_id() IS 'Gibt die aktuelle Auth-User-ID zurück (mit search_path fix)';

-- 1.2 current_mitglied_id - Gibt Mitglied-ID des aktuellen Users zurück
CREATE OR REPLACE FUNCTION current_mitglied_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM mitglieder WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION current_mitglied_id() IS 'Gibt die Mitglied-ID des aktuellen Users zurück (mit search_path fix)';

-- 1.3 user_owns_anlage - Prüft ob User Eigentümer einer Anlage ist
CREATE OR REPLACE FUNCTION user_owns_anlage(p_anlage_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM anlagen
    WHERE id = p_anlage_id
      AND mitglied_id = current_mitglied_id()
  );
$$;

COMMENT ON FUNCTION user_owns_anlage(uuid) IS 'Prüft ob User Eigentümer einer Anlage ist (mit search_path fix)';

-- 1.4 anlage_is_public - Prüft ob eine Anlage öffentlich ist
CREATE OR REPLACE FUNCTION anlage_is_public(p_anlage_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM anlagen
    WHERE id = p_anlage_id
      AND oeffentlich = true
      AND aktiv = true
  );
$$;

COMMENT ON FUNCTION anlage_is_public(uuid) IS 'Prüft ob eine Anlage öffentlich ist (mit search_path fix)';

-- 1.5 user_owns_investition - Prüft ob User Eigentümer einer Investition ist
CREATE OR REPLACE FUNCTION user_owns_investition(p_investition_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM investitionen
    WHERE id = p_investition_id
      AND mitglied_id = current_mitglied_id()
  );
$$;

COMMENT ON FUNCTION user_owns_investition(uuid) IS 'Prüft ob User Eigentümer einer Investition ist (mit search_path fix)';

-- ============================================
-- 2. Validierungs-Funktionen
-- ============================================

-- 2.1 validate_investition_monatsdaten - Validiert Monatsdaten für Investitionen
CREATE OR REPLACE FUNCTION validate_investition_monatsdaten()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prüfe ob Investition existiert und dem User gehört
  IF NOT EXISTS (
    SELECT 1 FROM investitionen
    WHERE id = NEW.investition_id
      AND mitglied_id = current_mitglied_id()
  ) THEN
    RAISE EXCEPTION 'Investition nicht gefunden oder nicht berechtigt';
  END IF;

  -- Prüfe auf Duplikate (gleicher Monat/Jahr für gleiche Investition)
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM investition_monatsdaten
    WHERE investition_id = NEW.investition_id
      AND jahr = NEW.jahr
      AND monat = NEW.monat
  ) THEN
    RAISE EXCEPTION 'Monatsdaten für diesen Zeitraum existieren bereits';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_investition_monatsdaten() IS 'Trigger-Funktion zur Validierung von Investitions-Monatsdaten (mit search_path fix)';

-- ============================================
-- 3. Freigabe-Funktionen
-- ============================================

-- 3.1 create_anlage_freigabe - Erstellt Freigabe-Eintrag für Anlage
CREATE OR REPLACE FUNCTION create_anlage_freigabe(p_anlage_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freigabe_id uuid;
BEGIN
  -- Prüfe ob User Eigentümer ist
  IF NOT user_owns_anlage(p_anlage_id) THEN
    RAISE EXCEPTION 'Nicht berechtigt für diese Anlage';
  END IF;

  -- Erstelle oder aktualisiere Freigabe
  INSERT INTO anlagen_freigaben (anlage_id, erstellt_am, aktualisiert_am)
  VALUES (p_anlage_id, now(), now())
  ON CONFLICT (anlage_id) DO UPDATE SET aktualisiert_am = now()
  RETURNING id INTO v_freigabe_id;

  RETURN v_freigabe_id;
END;
$$;

COMMENT ON FUNCTION create_anlage_freigabe(uuid) IS 'Erstellt Freigabe-Eintrag für Anlage (mit search_path fix)';

-- 3.2 update_anlagen_freigaben_timestamp - Aktualisiert Timestamp bei Änderungen
CREATE OR REPLACE FUNCTION update_anlagen_freigaben_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.aktualisiert_am = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_anlagen_freigaben_timestamp() IS 'Trigger-Funktion für Timestamp-Update (mit search_path fix)';

-- ============================================
-- 4. Strompreis-Funktion
-- ============================================

-- 4.1 get_aktueller_strompreis - Gibt aktuellen Strompreis zurück
-- Hinweis: Strompreis wird aktuell aus monatsdaten gelesen, nicht aus mitglieder
-- Diese Funktion gibt nur den Default-Wert zurück (30 Cent)
CREATE OR REPLACE FUNCTION get_aktueller_strompreis(p_mitglied_id uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Default-Strompreis: 30 Cent/kWh
  -- (mitglied-spezifische Preise werden über monatsdaten.netzbezug_preis_cent_kwh gepflegt)
  SELECT 30.0::numeric;
$$;

COMMENT ON FUNCTION get_aktueller_strompreis(uuid) IS 'Gibt Default-Strompreis zurück - 30 Cent/kWh (mit search_path fix)';

-- ============================================
-- 5. Community/Public Funktionen
-- ============================================

-- 5.1 get_public_anlagen - Öffentliche Anlagen abrufen
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
SET search_path = public
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
  ORDER BY a.installationsdatum DESC;
$$;

COMMENT ON FUNCTION get_public_anlagen() IS 'Öffentliche Anlagen abrufen (mit search_path fix)';

-- 5.2 get_community_stats - Community-Statistiken
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
SET search_path = public
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

COMMENT ON FUNCTION get_community_stats() IS 'Community-Statistiken (mit search_path fix)';

-- 5.3 search_public_anlagen - Öffentliche Anlagen suchen
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
SET search_path = public
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

COMMENT ON FUNCTION search_public_anlagen(text, text, numeric, numeric, boolean, boolean) IS 'Öffentliche Anlagen suchen (mit search_path fix)';

-- 5.4 get_public_anlage_details - Details einer öffentlichen Anlage
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
SET search_path = public
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

COMMENT ON FUNCTION get_public_anlage_details(uuid) IS 'Details einer öffentlichen Anlage (mit search_path fix)';

-- 5.5 get_public_komponenten - Komponenten einer öffentlichen Anlage
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
SET search_path = public
AS $$
  SELECT
    i.id,
    i.typ,
    i.bezeichnung,
    i.anschaffungsdatum,
    i.parameter
  FROM investitionen i
  JOIN anlagen a ON a.id = i.anlage_id
  WHERE i.anlage_id = p_anlage_id
    AND i.aktiv = true
    AND a.oeffentlich = true
    AND a.komponenten_oeffentlich = true
  ORDER BY i.typ, i.anschaffungsdatum;
$$;

COMMENT ON FUNCTION get_public_komponenten(uuid) IS 'Komponenten einer öffentlichen Anlage (mit search_path fix)';

-- 5.6 get_public_auswertung - Aggregierte Auswertungsdaten
CREATE OR REPLACE FUNCTION get_public_auswertung(p_anlage_id uuid)
RETURNS TABLE (
  anlage_id uuid,
  gesamt_erzeugung_kwh numeric,
  gesamt_einspeisung_kwh numeric,
  gesamt_eigenverbrauch_kwh numeric,
  gesamt_netzbezug_kwh numeric,
  durchschnitt_autarkie_prozent numeric,
  durchschnitt_eigenverbrauchsquote_prozent numeric,
  durchschnitt_erzeugung_monat_kwh numeric,
  spezifischer_ertrag_kwh_kwp numeric,
  anzahl_monate integer,
  erster_monat date,
  letzter_monat date,
  gesamt_einspeisung_ertrag_euro numeric,
  gesamt_ev_einsparung_euro numeric,
  durchschnitt_netto_ertrag_monat_euro numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH monatsdaten_agg AS (
    SELECT
      md.anlage_id,
      COUNT(*) as anzahl_monate,
      MIN(make_date(md.jahr, md.monat, 1)) as erster_monat,
      MAX(make_date(md.jahr, md.monat, 1)) as letzter_monat,
      COALESCE(SUM(md.pv_erzeugung_kwh), 0) as gesamt_erzeugung,
      COALESCE(SUM(md.einspeisung_kwh), 0) as gesamt_einspeisung,
      COALESCE(SUM(md.direktverbrauch_kwh), 0) + COALESCE(SUM(md.batterieentladung_kwh), 0) as gesamt_eigenverbrauch,
      COALESCE(SUM(md.netzbezug_kwh), 0) as gesamt_netzbezug,
      COALESCE(SUM(md.gesamtverbrauch_kwh), 0) as gesamt_verbrauch,
      COALESCE(SUM(md.einspeisung_ertrag_euro), 0) as gesamt_einspeisung_ertrag,
      COALESCE(AVG(md.netzbezug_preis_cent_kwh), 30) / 100.0 as avg_strompreis_euro
    FROM monatsdaten md
    WHERE md.anlage_id = p_anlage_id
    GROUP BY md.anlage_id
  )
  SELECT
    a.id as anlage_id,
    ROUND(ma.gesamt_erzeugung, 1) as gesamt_erzeugung_kwh,
    ROUND(ma.gesamt_einspeisung, 1) as gesamt_einspeisung_kwh,
    ROUND(ma.gesamt_eigenverbrauch, 1) as gesamt_eigenverbrauch_kwh,
    ROUND(ma.gesamt_netzbezug, 1) as gesamt_netzbezug_kwh,
    CASE WHEN ma.gesamt_verbrauch > 0
      THEN ROUND(ma.gesamt_eigenverbrauch / ma.gesamt_verbrauch * 100, 1)
      ELSE 0
    END as durchschnitt_autarkie_prozent,
    CASE WHEN ma.gesamt_erzeugung > 0
      THEN ROUND(ma.gesamt_eigenverbrauch / ma.gesamt_erzeugung * 100, 1)
      ELSE 0
    END as durchschnitt_eigenverbrauchsquote_prozent,
    ROUND(ma.gesamt_erzeugung / NULLIF(ma.anzahl_monate, 0), 1) as durchschnitt_erzeugung_monat_kwh,
    CASE WHEN a.leistung_kwp > 0
      THEN ROUND(ma.gesamt_erzeugung / a.leistung_kwp, 1)
      ELSE 0
    END as spezifischer_ertrag_kwh_kwp,
    ma.anzahl_monate::integer,
    ma.erster_monat,
    ma.letzter_monat,
    ROUND(ma.gesamt_einspeisung_ertrag, 2) as gesamt_einspeisung_ertrag_euro,
    ROUND(ma.gesamt_eigenverbrauch * ma.avg_strompreis_euro, 2) as gesamt_ev_einsparung_euro,
    ROUND((ma.gesamt_eigenverbrauch * ma.avg_strompreis_euro + ma.gesamt_einspeisung_ertrag) / NULLIF(ma.anzahl_monate, 0), 2) as durchschnitt_netto_ertrag_monat_euro
  FROM anlagen a
  LEFT JOIN monatsdaten_agg ma ON ma.anlage_id = a.id
  WHERE a.id = p_anlage_id
    AND a.oeffentlich = true
    AND a.auswertungen_oeffentlich = true
    AND a.aktiv = true;
$$;

COMMENT ON FUNCTION get_public_auswertung(uuid) IS 'Aggregierte Auswertungsdaten für öffentliche Anlagen (mit search_path fix)';

-- 5.7 get_public_jahresvergleich - Jahresweise Daten
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
SET search_path = public
AS $$
  SELECT
    md.jahr,
    COUNT(*)::integer as anzahl_monate,
    ROUND(SUM(COALESCE(md.pv_erzeugung_kwh, 0)), 1) as erzeugung_kwh,
    ROUND(SUM(COALESCE(md.direktverbrauch_kwh, 0)) + SUM(COALESCE(md.batterieentladung_kwh, 0)), 1) as eigenverbrauch_kwh,
    ROUND(SUM(COALESCE(md.einspeisung_kwh, 0)), 1) as einspeisung_kwh,
    ROUND(SUM(COALESCE(md.netzbezug_kwh, 0)), 1) as netzbezug_kwh,
    CASE WHEN SUM(COALESCE(md.gesamtverbrauch_kwh, 0)) > 0
      THEN ROUND((SUM(COALESCE(md.direktverbrauch_kwh, 0)) + SUM(COALESCE(md.batterieentladung_kwh, 0))) / SUM(md.gesamtverbrauch_kwh) * 100, 1)
      ELSE 0
    END as autarkie_prozent,
    CASE WHEN SUM(COALESCE(md.pv_erzeugung_kwh, 0)) > 0
      THEN ROUND((SUM(COALESCE(md.direktverbrauch_kwh, 0)) + SUM(COALESCE(md.batterieentladung_kwh, 0))) / SUM(md.pv_erzeugung_kwh) * 100, 1)
      ELSE 0
    END as eigenverbrauchsquote_prozent,
    CASE WHEN a.leistung_kwp > 0
      THEN ROUND(SUM(COALESCE(md.pv_erzeugung_kwh, 0)) / a.leistung_kwp, 1)
      ELSE 0
    END as spezifischer_ertrag_kwh_kwp
  FROM monatsdaten md
  JOIN anlagen a ON a.id = md.anlage_id
  WHERE md.anlage_id = p_anlage_id
    AND a.oeffentlich = true
    AND a.auswertungen_oeffentlich = true
    AND a.aktiv = true
  GROUP BY md.jahr, a.leistung_kwp
  ORDER BY md.jahr DESC;
$$;

COMMENT ON FUNCTION get_public_jahresvergleich(uuid) IS 'Jahresweise aggregierte Daten für öffentliche Anlagen (mit search_path fix)';

-- 5.8 get_public_monatsdaten - Öffentliche Monatsdaten
CREATE OR REPLACE FUNCTION get_public_monatsdaten(p_anlage_id uuid)
RETURNS TABLE (
  jahr integer,
  monat integer,
  pv_erzeugung_kwh numeric,
  direktverbrauch_kwh numeric,
  einspeisung_kwh numeric,
  netzbezug_kwh numeric,
  gesamtverbrauch_kwh numeric,
  batterieladung_kwh numeric,
  batterieentladung_kwh numeric,
  einspeisung_ertrag_euro numeric,
  netzbezug_kosten_euro numeric,
  betriebsausgaben_monat_euro numeric,
  eigenverbrauch_kwh numeric,
  autarkiegrad_prozent numeric,
  eigenverbrauchsquote_prozent numeric,
  strompreis_cent_kwh numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    md.jahr,
    md.monat,
    COALESCE(md.pv_erzeugung_kwh, 0) as pv_erzeugung_kwh,
    COALESCE(md.direktverbrauch_kwh, 0) as direktverbrauch_kwh,
    COALESCE(md.einspeisung_kwh, 0) as einspeisung_kwh,
    COALESCE(md.netzbezug_kwh, 0) as netzbezug_kwh,
    COALESCE(md.gesamtverbrauch_kwh, 0) as gesamtverbrauch_kwh,
    COALESCE(md.batterieladung_kwh, 0) as batterieladung_kwh,
    COALESCE(md.batterieentladung_kwh, 0) as batterieentladung_kwh,
    COALESCE(md.einspeisung_ertrag_euro, 0) as einspeisung_ertrag_euro,
    COALESCE(md.netzbezug_kosten_euro, 0) as netzbezug_kosten_euro,
    COALESCE(md.betriebsausgaben_monat_euro, 0) as betriebsausgaben_monat_euro,
    COALESCE(md.direktverbrauch_kwh, 0) + COALESCE(md.batterieentladung_kwh, 0) as eigenverbrauch_kwh,
    CASE
      WHEN COALESCE(md.gesamtverbrauch_kwh, 0) > 0
      THEN ROUND((COALESCE(md.direktverbrauch_kwh, 0) + COALESCE(md.batterieentladung_kwh, 0)) / md.gesamtverbrauch_kwh * 100, 1)
      ELSE 0
    END as autarkiegrad_prozent,
    CASE
      WHEN COALESCE(md.pv_erzeugung_kwh, 0) > 0
      THEN ROUND((COALESCE(md.direktverbrauch_kwh, 0) + COALESCE(md.batterieentladung_kwh, 0)) / md.pv_erzeugung_kwh * 100, 1)
      ELSE 0
    END as eigenverbrauchsquote_prozent,
    COALESCE(md.netzbezug_preis_cent_kwh, 30) as strompreis_cent_kwh
  FROM monatsdaten md
  JOIN anlagen a ON a.id = md.anlage_id
  WHERE md.anlage_id = p_anlage_id
    AND a.oeffentlich = true
    AND a.auswertungen_oeffentlich = true
    AND a.aktiv = true
  ORDER BY md.jahr DESC, md.monat DESC;
$$;

COMMENT ON FUNCTION get_public_monatsdaten(uuid) IS 'Öffentliche Monatsdaten für Monatsdetail-Ansicht (mit search_path fix)';

-- ============================================
-- Verifizierung
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 17 Funktionen mit SET search_path = public aktualisiert:';
  RAISE NOTICE '   - auth_user_id()';
  RAISE NOTICE '   - current_mitglied_id()';
  RAISE NOTICE '   - user_owns_anlage(uuid)';
  RAISE NOTICE '   - anlage_is_public(uuid)';
  RAISE NOTICE '   - user_owns_investition(uuid)';
  RAISE NOTICE '   - validate_investition_monatsdaten()';
  RAISE NOTICE '   - create_anlage_freigabe(uuid)';
  RAISE NOTICE '   - update_anlagen_freigaben_timestamp()';
  RAISE NOTICE '   - get_aktueller_strompreis(uuid)';
  RAISE NOTICE '   - get_public_anlagen()';
  RAISE NOTICE '   - get_community_stats()';
  RAISE NOTICE '   - search_public_anlagen(...)';
  RAISE NOTICE '   - get_public_anlage_details(uuid)';
  RAISE NOTICE '   - get_public_komponenten(uuid)';
  RAISE NOTICE '   - get_public_auswertung(uuid)';
  RAISE NOTICE '   - get_public_jahresvergleich(uuid)';
  RAISE NOTICE '   - get_public_monatsdaten(uuid)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security Warning "function_search_path_mutable" sollte damit behoben sein.';
END $$;
