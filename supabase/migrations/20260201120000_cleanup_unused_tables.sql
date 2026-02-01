-- Migration: Cleanup unused tables and views + RLS für Views
-- Date: 2026-02-01
-- Description: Entfernt nicht mehr benötigte Tabellen/Views und sichert bestehende Views

-- ============================================================================
-- TABELLEN ENTFERNEN
-- ============================================================================

-- 1. komponenten_typen - wird im Code nicht verwendet
DROP TABLE IF EXISTS komponenten_typen CASCADE;

-- 2. Alte Tabellen die durch investitionen ersetzt wurden (falls noch vorhanden)
DROP TABLE IF EXISTS haushalt_komponenten CASCADE;
DROP TABLE IF EXISTS anlagen_komponenten CASCADE;
DROP TABLE IF EXISTS alternative_investitionen CASCADE;

-- ============================================================================
-- VIEWS ENTFERNEN (nicht verwendet)
-- ============================================================================

-- investition_jahres_zusammenfassung wird im Code nicht verwendet
DROP VIEW IF EXISTS investition_jahres_zusammenfassung CASCADE;

-- ============================================================================
-- VIEWS MIT SECURITY INVOKER NEU ERSTELLEN
-- Damit die RLS-Policies der Basistabellen greifen
-- ============================================================================

-- 1. investitionen_uebersicht
DROP VIEW IF EXISTS investitionen_uebersicht;
CREATE VIEW investitionen_uebersicht
WITH (security_invoker = true)
AS
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
  -- ROI Berechnung
  CASE
    WHEN i.einsparung_gesamt_jahr > 0 AND i.anschaffungskosten_relevant > 0 THEN
      ROUND((i.einsparung_gesamt_jahr::numeric / i.anschaffungskosten_relevant::numeric * 100), 2)
    ELSE NULL
  END as roi_prozent,
  -- Amortisationszeit
  CASE
    WHEN i.einsparung_gesamt_jahr > 0 AND i.anschaffungskosten_relevant > 0 THEN
      ROUND((i.anschaffungskosten_relevant::numeric / i.einsparung_gesamt_jahr::numeric), 2)
    ELSE NULL
  END as amortisation_jahre,
  m.vorname,
  m.nachname
FROM investitionen i
LEFT JOIN mitglieder m ON m.id = i.mitglied_id
WHERE i.aktiv = true;

-- 2. investition_monatsdaten_detail
DROP VIEW IF EXISTS investition_monatsdaten_detail;
CREATE VIEW investition_monatsdaten_detail
WITH (security_invoker = true)
AS
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
  inv.mitglied_id,
  inv.anlage_id,
  inv.typ as investition_typ,
  inv.bezeichnung as investition_bezeichnung,
  inv.anschaffungskosten_relevant
FROM investition_monatsdaten imd
JOIN investitionen inv ON inv.id = imd.investition_id;

-- 3. investition_prognose_ist_vergleich
DROP VIEW IF EXISTS investition_prognose_ist_vergleich;
CREATE VIEW investition_prognose_ist_vergleich
WITH (security_invoker = true)
AS
SELECT
  inv.id as investition_id,
  inv.mitglied_id,
  inv.anlage_id,
  inv.typ,
  inv.bezeichnung,
  inv.anschaffungsdatum,
  inv.anschaffungskosten_relevant,
  inv.einsparung_gesamt_jahr as prognose_jahr_euro,
  COALESCE(agg.anzahl_monate, 0) as anzahl_monate_erfasst,
  COALESCE(agg.ist_gesamt, 0) as ist_gesamt_euro,
  CASE
    WHEN COALESCE(agg.anzahl_monate, 0) > 0 THEN
      ROUND((COALESCE(agg.ist_gesamt, 0) / agg.anzahl_monate * 12)::numeric, 2)
    ELSE 0
  END as ist_hochrechnung_jahr_euro,
  CASE
    WHEN inv.einsparung_gesamt_jahr > 0 AND COALESCE(agg.anzahl_monate, 0) > 0 THEN
      ROUND((((COALESCE(agg.ist_gesamt, 0) / agg.anzahl_monate * 12) - inv.einsparung_gesamt_jahr)
        / inv.einsparung_gesamt_jahr * 100)::numeric, 2)
    ELSE NULL
  END as abweichung_prozent
FROM investitionen inv
LEFT JOIN (
  SELECT
    investition_id,
    COUNT(*) as anzahl_monate,
    SUM(einsparung_monat_euro) as ist_gesamt
  FROM investition_monatsdaten
  GROUP BY investition_id
) agg ON agg.investition_id = inv.id
WHERE inv.aktiv = true;

-- ============================================================================
-- INFO: Views sind jetzt mit security_invoker = true geschützt.
-- Das bedeutet: RLS-Policies der Basistabellen (investitionen,
-- investition_monatsdaten) werden angewendet.
-- ============================================================================
