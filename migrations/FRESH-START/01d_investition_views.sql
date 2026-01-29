-- ============================================
-- MIGRATION 01d: Investition Views
-- ============================================
-- Datum: 2026-01-29
-- Beschreibung: Views für Investitions-Übersicht und Auswertungen
-- WICHTIG: Muss NACH 01c_investition_monatsdaten.sql ausgeführt werden!
-- ============================================

-- ============================================
-- 1. investitionen_uebersicht - Hauptübersicht
-- ============================================
-- Benutzt von: /investitionen, /auswertung

CREATE OR REPLACE VIEW investitionen_uebersicht AS
SELECT
  ai.id,
  ai.mitglied_id,
  ai.anlage_id,
  ai.parent_investition_id,
  ai.typ,
  ai.bezeichnung,
  ai.anschaffungsdatum,
  ai.anschaffungskosten_gesamt,
  ai.anschaffungskosten_alternativ,
  ai.anschaffungskosten_relevant,
  ai.alternativ_beschreibung,
  ai.kosten_jahr_aktuell,
  ai.kosten_jahr_alternativ,
  ai.einsparungen_jahr,
  ai.einsparung_gesamt_jahr,
  ai.parameter,
  ai.co2_einsparung_kg_jahr,
  ai.aktiv,
  ai.notizen,
  ai.erstellt_am,
  ai.aktualisiert_am,

  -- ROI Berechnung (Prozent pro Jahr)
  CASE
    WHEN ai.einsparung_gesamt_jahr > 0 AND ai.anschaffungskosten_relevant > 0 THEN
      ROUND((ai.einsparung_gesamt_jahr::numeric / ai.anschaffungskosten_relevant::numeric * 100), 2)
    ELSE NULL
  END as roi_prozent,

  -- Amortisationszeit in Jahren
  CASE
    WHEN ai.einsparung_gesamt_jahr > 0 AND ai.anschaffungskosten_relevant > 0 THEN
      ROUND((ai.anschaffungskosten_relevant::numeric / ai.einsparung_gesamt_jahr::numeric), 2)
    ELSE NULL
  END as amortisation_jahre,

  -- Mitglied Info
  m.vorname,
  m.nachname

FROM alternative_investitionen ai
LEFT JOIN mitglieder m ON m.id = ai.mitglied_id
WHERE ai.aktiv = true;

COMMENT ON VIEW investitionen_uebersicht IS 'Übersicht aller aktiven Investitionen mit ROI-Berechnung';

-- ============================================
-- 2. investition_monatsdaten_detail - Detailansicht
-- ============================================
-- Benutzt von: /auswertung (Monatsdaten-Tabellen)

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
JOIN alternative_investitionen inv ON imd.investition_id = inv.id
JOIN mitglieder m ON inv.mitglied_id = m.id;

COMMENT ON VIEW investition_monatsdaten_detail IS 'Monatsdaten mit Investitions- und Mitglieder-Infos, inkl. Prognose-Vergleich';

-- ============================================
-- 3. investition_prognose_ist_vergleich - Jahresübersicht
-- ============================================
-- Benutzt von: /auswertung (Prognose vs. Ist Vergleich)

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

FROM alternative_investitionen inv
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

-- ============================================
-- 4. investition_jahres_zusammenfassung - Jahres-Aggregat
-- ============================================
-- Benutzt von: /auswertung (Jahresübersichten)

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
JOIN alternative_investitionen inv ON imd.investition_id = inv.id
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
-- 5. Verifizierung
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ investitionen_uebersicht View erstellt';
  RAISE NOTICE '✅ investition_monatsdaten_detail View erstellt';
  RAISE NOTICE '✅ investition_prognose_ist_vergleich View erstellt';
  RAISE NOTICE '✅ investition_jahres_zusammenfassung View erstellt';
END $$;
