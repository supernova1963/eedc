-- Migration 06: Views für vereinfachte Abfragen
-- Datum: 2026-01-24
-- Beschreibung: Erstellt Views für häufige Abfragen

-- ========================================
-- View: Aktuell gültige Strompreise
-- ========================================
DROP VIEW IF EXISTS public.strompreise_aktuell;

CREATE VIEW public.strompreise_aktuell AS
SELECT DISTINCT ON (mitglied_id, COALESCE(anlage_id, '00000000-0000-0000-0000-000000000000'::uuid))
  *
FROM public.strompreise
WHERE gueltig_ab <= CURRENT_DATE
  AND (gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE)
ORDER BY
  mitglied_id,
  COALESCE(anlage_id, '00000000-0000-0000-0000-000000000000'::uuid),
  gueltig_ab DESC;

COMMENT ON VIEW public.strompreise_aktuell IS 'Zeigt nur die aktuell gültigen Strompreise pro Mitglied/Anlage';

-- ========================================
-- View: Anlagen-Übersicht mit Investitionen
-- ========================================
DROP VIEW IF EXISTS public.anlagen_komplett;

CREATE VIEW public.anlagen_komplett AS
SELECT
  a.id,
  a.mitglied_id,
  a.anlagenname,
  a.anlagentyp,
  a.installationsdatum,
  a.leistung_kwp,
  a.standort_plz,
  a.standort_ort,
  a.aktiv,
  a.erstellt_am,
  m.vorname,
  m.nachname,
  m.email,
  COUNT(DISTINCT ai.id) as anzahl_investitionen,
  COALESCE(SUM(ai.anschaffungskosten_gesamt), 0) as investitionen_gesamt_euro,
  COALESCE(SUM(ai.anschaffungskosten_relevant), 0) as investitionen_relevant_euro
FROM public.anlagen a
LEFT JOIN public.mitglieder m ON a.mitglied_id = m.id
LEFT JOIN public.alternative_investitionen ai ON ai.anlage_id = a.id AND ai.aktiv = true
GROUP BY a.id, m.id, m.vorname, m.nachname, m.email;

COMMENT ON VIEW public.anlagen_komplett IS 'Anlagen-Übersicht mit Mitgliedsdaten und aggregierten Investitionskennzahlen';

-- ========================================
-- View: Investitions-Übersicht
-- ========================================
DROP VIEW IF EXISTS public.investitionen_uebersicht;

CREATE VIEW public.investitionen_uebersicht AS
SELECT
  ai.*,
  m.vorname,
  m.nachname,
  m.email,
  a.anlagenname,
  a.leistung_kwp as anlage_leistung_kwp,
  k.amortisationszeit_monate,
  k.roi_prozent,
  k.bilanz_kumuliert_euro,
  k.co2_einsparung_kumuliert_kg,
  k.berechnet_am as kennzahlen_stand
FROM public.alternative_investitionen ai
LEFT JOIN public.mitglieder m ON ai.mitglied_id = m.id
LEFT JOIN public.anlagen a ON ai.anlage_id = a.id
LEFT JOIN public.investition_kennzahlen k ON ai.id = k.investition_id
WHERE ai.aktiv = true;

COMMENT ON VIEW public.investitionen_uebersicht IS 'Komplette Investitionsübersicht mit Mitglied, Anlage und Kennzahlen';

-- ========================================
-- View: Monatsdaten mit Kennzahlen
-- ========================================
DROP VIEW IF EXISTS public.monatsdaten_erweitert;

CREATE VIEW public.monatsdaten_erweitert AS
SELECT
  md.*,
  a.anlagenname,
  a.leistung_kwp,
  m.vorname,
  m.nachname,
  -- Berechnete Kennzahlen
  CASE
    WHEN md.pv_erzeugung_kwh > 0
    THEN ((md.direktverbrauch_kwh + md.batterieentladung_kwh) / md.pv_erzeugung_kwh * 100)
    ELSE 0
  END as eigenverbrauchsquote_prozent,
  CASE
    WHEN md.gesamtverbrauch_kwh > 0
    THEN ((md.direktverbrauch_kwh + md.batterieentladung_kwh) / md.gesamtverbrauch_kwh * 100)
    ELSE 0
  END as autarkiegrad_prozent,
  (md.einspeisung_ertrag_euro - md.netzbezug_kosten_euro - md.betriebsausgaben_monat_euro) as netto_ertrag_euro
FROM public.monatsdaten md
LEFT JOIN public.anlagen a ON md.anlage_id = a.id
LEFT JOIN public.mitglieder m ON md.mitglied_id = m.id;

COMMENT ON VIEW public.monatsdaten_erweitert IS 'Monatsdaten mit berechneten Kennzahlen und Anlagen-/Mitgliedsinformationen';
