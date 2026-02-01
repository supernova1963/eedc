-- ============================================
-- MIGRATION: Umbenennung alternative_investitionen → investitionen
-- ============================================
-- Datum: 2026-01-31
-- Beschreibung: Bereinigung des Tabellennamens + Entfernung von Legacy-Tabellen
--
-- WICHTIG: Dieses Skript führt folgende Änderungen durch:
-- 1. Umbenennung alternative_investitionen → investitionen
-- 2. Aktualisierung aller abhängigen Views
-- 3. Aktualisierung der Helper-Funktion user_owns_investition()
-- 4. Aktualisierung aller Community-Functions
-- 5. Entfernung der Legacy-Tabellen (haushalt_komponenten, anlagen_komponenten, komponenten_monatsdaten)
-- ============================================

-- ============================================
-- SCHRITT 1: Views löschen (da sie von der Tabelle abhängen)
-- ============================================
DROP VIEW IF EXISTS investitionen_uebersicht CASCADE;
DROP VIEW IF EXISTS investition_monatsdaten_detail CASCADE;
DROP VIEW IF EXISTS investition_prognose_ist_vergleich CASCADE;
DROP VIEW IF EXISTS investition_jahres_zusammenfassung CASCADE;

-- ============================================
-- SCHRITT 2: RLS Policies auf alter Tabelle löschen
-- ============================================
DROP POLICY IF EXISTS "Users can view own investitionen" ON alternative_investitionen;
DROP POLICY IF EXISTS "Users can insert own investitionen" ON alternative_investitionen;
DROP POLICY IF EXISTS "Users can update own investitionen" ON alternative_investitionen;
DROP POLICY IF EXISTS "Users can delete own investitionen" ON alternative_investitionen;

-- ============================================
-- SCHRITT 3: Indizes löschen (werden mit neuen Namen neu erstellt)
-- ============================================
DROP INDEX IF EXISTS idx_alt_inv_mitglied;
DROP INDEX IF EXISTS idx_alt_inv_anlage;
DROP INDEX IF EXISTS idx_alt_inv_typ;
DROP INDEX IF EXISTS idx_alt_inv_parent;

-- ============================================
-- SCHRITT 4: Tabelle umbenennen
-- ============================================
ALTER TABLE alternative_investitionen RENAME TO investitionen;

-- ============================================
-- SCHRITT 5: Neue Indizes erstellen
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inv_mitglied ON investitionen(mitglied_id);
CREATE INDEX IF NOT EXISTS idx_inv_anlage ON investitionen(anlage_id);
CREATE INDEX IF NOT EXISTS idx_inv_typ ON investitionen(typ);
CREATE INDEX IF NOT EXISTS idx_inv_parent ON investitionen(parent_investition_id);

-- ============================================
-- SCHRITT 6: Kommentare aktualisieren
-- ============================================
COMMENT ON TABLE investitionen IS 'Investitionen wie E-Auto, Wärmepumpe, Speicher, PV-Module, Wechselrichter mit ROI-Berechnung';
COMMENT ON COLUMN investitionen.typ IS 'Investitionstyp: e-auto, waermepumpe, speicher, wechselrichter, pv-module, wallbox, sonstiges';
COMMENT ON COLUMN investitionen.anschaffungskosten_alternativ IS 'Kosten der Alternative (z.B. Verbrenner statt E-Auto)';
COMMENT ON COLUMN investitionen.anschaffungskosten_relevant IS 'Mehrkosten = Gesamt - Alternativ (für ROI)';
COMMENT ON COLUMN investitionen.parameter IS 'Typ-spezifische Parameter als JSON';

-- ============================================
-- SCHRITT 7: RLS Policies neu erstellen
-- ============================================
-- RLS ist bereits aktiviert, nur Policies neu erstellen

CREATE POLICY "Users can view own investitionen" ON investitionen
  FOR SELECT USING (mitglied_id = current_mitglied_id());

CREATE POLICY "Users can insert own investitionen" ON investitionen
  FOR INSERT WITH CHECK (mitglied_id = current_mitglied_id());

CREATE POLICY "Users can update own investitionen" ON investitionen
  FOR UPDATE USING (mitglied_id = current_mitglied_id());

CREATE POLICY "Users can delete own investitionen" ON investitionen
  FOR DELETE USING (mitglied_id = current_mitglied_id());

-- ============================================
-- SCHRITT 8: Helper-Funktion aktualisieren
-- ============================================
CREATE OR REPLACE FUNCTION user_owns_investition(p_investition_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM investitionen
    WHERE id = p_investition_id
      AND mitglied_id = current_mitglied_id()
  );
$$;

-- ============================================
-- SCHRITT 9: Views neu erstellen (mit neuem Tabellennamen)
-- ============================================

-- 9.1 investitionen_uebersicht
CREATE OR REPLACE VIEW investitionen_uebersicht AS
SELECT
  i.id,
  i.mitglied_id,
  i.anlage_id,
  i.parent_investition_id,
  i.typ,
  i.bezeichnung,
  i.anschaffungsdatum,
  i.anschaffungskosten_gesamt,
  i.anschaffungskosten_alternativ,
  i.anschaffungskosten_relevant,
  i.alternativ_beschreibung,
  i.kosten_jahr_aktuell,
  i.kosten_jahr_alternativ,
  i.einsparungen_jahr,
  i.einsparung_gesamt_jahr,
  i.parameter,
  i.co2_einsparung_kg_jahr,
  i.aktiv,
  i.notizen,
  i.erstellt_am,
  i.aktualisiert_am,
  -- ROI Berechnung (Prozent pro Jahr)
  CASE
    WHEN i.einsparung_gesamt_jahr > 0 AND i.anschaffungskosten_relevant > 0 THEN
      ROUND((i.einsparung_gesamt_jahr::numeric / i.anschaffungskosten_relevant::numeric * 100), 2)
    ELSE NULL
  END as roi_prozent,
  -- Amortisationszeit in Jahren
  CASE
    WHEN i.einsparung_gesamt_jahr > 0 AND i.anschaffungskosten_relevant > 0 THEN
      ROUND((i.anschaffungskosten_relevant::numeric / i.einsparung_gesamt_jahr::numeric), 2)
    ELSE NULL
  END as amortisation_jahre,
  -- Mitglied Info
  m.vorname,
  m.nachname
FROM investitionen i
LEFT JOIN mitglieder m ON m.id = i.mitglied_id
WHERE i.aktiv = true;

COMMENT ON VIEW investitionen_uebersicht IS 'Übersicht aller aktiven Investitionen mit ROI-Berechnung';

-- 9.2 investition_monatsdaten_detail
CREATE OR REPLACE VIEW investition_monatsdaten_detail AS
SELECT
  imd.id,
  imd.investition_id,
  imd.jahr,
  imd.monat,
  imd.verbrauch_daten,
  imd.kosten_daten,
  imd.einsparung_monat_euro,
  imd.co2_einsparung_kg,
  imd.notizen,
  imd.erstellt_am,
  imd.aktualisiert_am,
  -- Investitions-Info
  inv.typ,
  inv.bezeichnung,
  inv.mitglied_id,
  inv.anschaffungsdatum,
  inv.parameter,
  -- Prognose-Werte zum Vergleich
  inv.einsparung_gesamt_jahr as prognose_jahr_euro,
  ROUND(inv.einsparung_gesamt_jahr / 12.0, 2) as prognose_monat_euro,
  -- Differenz Ist vs. Prognose (in Prozent)
  CASE
    WHEN imd.einsparung_monat_euro IS NOT NULL AND inv.einsparung_gesamt_jahr > 0
    THEN ROUND(
      ((imd.einsparung_monat_euro - (inv.einsparung_gesamt_jahr / 12.0)) / (inv.einsparung_gesamt_jahr / 12.0) * 100)::numeric,
      1
    )
    ELSE NULL
  END as abweichung_prozent,
  -- Mitglieder-Info
  m.vorname,
  m.nachname
FROM investition_monatsdaten imd
JOIN investitionen inv ON imd.investition_id = inv.id
JOIN mitglieder m ON inv.mitglied_id = m.id;

COMMENT ON VIEW investition_monatsdaten_detail IS 'Monatsdaten mit Investitions- und Mitglieder-Infos, inkl. Prognose-Vergleich';

-- 9.3 investition_prognose_ist_vergleich
CREATE OR REPLACE VIEW investition_prognose_ist_vergleich AS
SELECT
  inv.id as investition_id,
  inv.typ,
  inv.bezeichnung,
  inv.mitglied_id,
  inv.anschaffungsdatum,
  inv.anschaffungskosten_relevant,
  inv.einsparung_gesamt_jahr as prognose_jahr_euro,
  -- Ist-Werte aus Monatsdaten
  COALESCE(SUM(imd.einsparung_monat_euro), 0) as ist_gesamt_euro,
  COUNT(imd.id) as anzahl_monate_erfasst,
  -- Hochrechnung auf 12 Monate (wenn min. 3 Monate erfasst)
  CASE
    WHEN COUNT(imd.id) >= 3 THEN
      ROUND((SUM(imd.einsparung_monat_euro) / COUNT(imd.id) * 12)::numeric, 2)
    ELSE NULL
  END as ist_hochrechnung_jahr_euro,
  -- Abweichung Prognose vs. Hochrechnung
  CASE
    WHEN COUNT(imd.id) >= 3 AND inv.einsparung_gesamt_jahr > 0 THEN
      ROUND(
        (((SUM(imd.einsparung_monat_euro) / COUNT(imd.id) * 12) - inv.einsparung_gesamt_jahr) / inv.einsparung_gesamt_jahr * 100)::numeric,
        1
      )
    ELSE NULL
  END as abweichung_prozent,
  -- CO2 kumuliert
  COALESCE(SUM(imd.co2_einsparung_kg), 0) as co2_ist_gesamt_kg,
  -- Mitglieder-Info
  m.vorname,
  m.nachname
FROM investitionen inv
LEFT JOIN investition_monatsdaten imd ON imd.investition_id = inv.id
JOIN mitglieder m ON inv.mitglied_id = m.id
WHERE inv.aktiv = true
GROUP BY
  inv.id,
  inv.typ,
  inv.bezeichnung,
  inv.mitglied_id,
  inv.anschaffungsdatum,
  inv.anschaffungskosten_relevant,
  inv.einsparung_gesamt_jahr,
  m.vorname,
  m.nachname;

COMMENT ON VIEW investition_prognose_ist_vergleich IS 'Vergleich Prognose vs. Ist-Werte mit Hochrechnung';

-- 9.4 investition_jahres_zusammenfassung
CREATE OR REPLACE VIEW investition_jahres_zusammenfassung AS
SELECT
  imd.investition_id,
  imd.jahr,
  -- Anzahl erfasste Monate
  COUNT(*) as anzahl_monate,
  -- Summen
  SUM(imd.einsparung_monat_euro) as einsparung_ist_jahr_euro,
  SUM(imd.co2_einsparung_kg) as co2_einsparung_ist_kg,
  -- Durchschnitte
  ROUND(AVG(imd.einsparung_monat_euro)::numeric, 2) as durchschnitt_monat_euro,
  -- Hochrechnung auf 12 Monate
  CASE
    WHEN COUNT(*) >= 3 THEN
      ROUND((SUM(imd.einsparung_monat_euro) / COUNT(*) * 12)::numeric, 2)
    ELSE NULL
  END as hochrechnung_jahr_euro,
  -- Investitions-Info
  inv.typ,
  inv.bezeichnung,
  inv.mitglied_id,
  inv.einsparung_gesamt_jahr as prognose_jahr_euro
FROM investition_monatsdaten imd
JOIN investitionen inv ON imd.investition_id = inv.id
GROUP BY
  imd.investition_id,
  imd.jahr,
  inv.typ,
  inv.bezeichnung,
  inv.mitglied_id,
  inv.einsparung_gesamt_jahr
ORDER BY imd.investition_id, imd.jahr;

COMMENT ON VIEW investition_jahres_zusammenfassung IS 'Jahres-Zusammenfassung der Ist-Daten pro Investition';

-- ============================================
-- SCHRITT 10: Community-Functions aktualisieren
-- ============================================

-- 10.1 get_public_anlagen
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
    (SELECT COUNT(*) FROM investitionen i WHERE i.anlage_id = a.id AND i.aktiv = true) as anzahl_komponenten,
    EXISTS(SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND i.typ = 'speicher' AND i.aktiv = true) as hat_speicher,
    EXISTS(SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND i.typ = 'e-auto' AND i.aktiv = true) as hat_wallbox,
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

-- 10.2 get_community_stats
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
     WHERE i.typ = 'e-auto' AND i.aktiv = true AND a2.oeffentlich = true) as anzahl_mit_wallbox,
    MAX(a.installationsdatum) as neueste_anlage_datum,
    MIN(a.installationsdatum) as aelteste_anlage_datum
  FROM anlagen a
  JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.oeffentlich = true
    AND a.aktiv = true
    AND m.aktiv = true;
$$;

-- 10.3 search_public_anlagen
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
    EXISTS(SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND i.typ = 'e-auto' AND i.aktiv = true) as hat_wallbox,
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
      SELECT 1 FROM investitionen i WHERE i.anlage_id = a.id AND i.typ = 'e-auto' AND i.aktiv = true
    ))
  ORDER BY a.installationsdatum DESC;
$$;

-- 10.4 get_public_komponenten
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
-- SCHRITT 11: Legacy-Tabellen entfernen
-- ============================================
-- Diese Tabellen sind leer und werden nicht mehr benötigt

DROP TABLE IF EXISTS komponenten_monatsdaten CASCADE;
DROP TABLE IF EXISTS haushalt_komponenten CASCADE;
DROP TABLE IF EXISTS anlagen_komponenten CASCADE;

-- ============================================
-- SCHRITT 12: Verifizierung
-- ============================================
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Prüfe ob Tabelle existiert
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
  WHERE table_name = 'investitionen' AND table_schema = 'public';

  IF v_count = 1 THEN
    RAISE NOTICE '✅ Tabelle "investitionen" existiert';
  ELSE
    RAISE EXCEPTION '❌ Tabelle "investitionen" nicht gefunden!';
  END IF;

  -- Prüfe ob alte Tabelle weg ist
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
  WHERE table_name = 'alternative_investitionen' AND table_schema = 'public';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ Alte Tabelle "alternative_investitionen" wurde umbenannt';
  ELSE
    RAISE EXCEPTION '❌ Alte Tabelle "alternative_investitionen" existiert noch!';
  END IF;

  -- Prüfe Views
  SELECT COUNT(*) INTO v_count FROM information_schema.views
  WHERE table_schema = 'public' AND table_name IN (
    'investitionen_uebersicht',
    'investition_monatsdaten_detail',
    'investition_prognose_ist_vergleich',
    'investition_jahres_zusammenfassung'
  );

  RAISE NOTICE '✅ % von 4 Views erstellt', v_count;

  -- Prüfe ob Legacy-Tabellen weg sind
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
  WHERE table_name IN ('haushalt_komponenten', 'anlagen_komponenten', 'komponenten_monatsdaten')
  AND table_schema = 'public';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ Legacy-Tabellen wurden entfernt';
  ELSE
    RAISE NOTICE '⚠️  Noch % Legacy-Tabellen vorhanden', v_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🎉 Migration erfolgreich abgeschlossen!';
  RAISE NOTICE '📌 Nächster Schritt: TypeScript-Code anpassen (database.types.ts neu generieren)';
END $$;
