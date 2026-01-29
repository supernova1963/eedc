-- Finalisierung: RLS aktivieren und Views erstellen

-- 1. RLS für mitglieder wieder aktivieren
ALTER TABLE mitglieder ENABLE ROW LEVEL SECURITY;

-- 2. Verifiziere RLS Policies
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'mitglieder'
ORDER BY cmd, policyname;

-- 3. Erstelle investitionen_uebersicht View
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
  -- ROI Berechnung
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

-- 4. Verifiziere die View
SELECT COUNT(*) as total_investitionen FROM investitionen_uebersicht;

-- 5. Zeige Beispieldaten
SELECT id, typ, bezeichnung, vorname, nachname, roi_prozent, amortisation_jahre
FROM investitionen_uebersicht
LIMIT 5;
