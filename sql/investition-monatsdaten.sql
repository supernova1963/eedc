-- ============================================================================
-- Tabelle: investition_monatsdaten
-- Monatliche Ist-Daten für alle Investitionstypen (E-Auto, WP, etc.)
-- ============================================================================

CREATE TABLE investition_monatsdaten (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investition_id UUID NOT NULL REFERENCES alternative_investitionen(id) ON DELETE CASCADE,
  
  -- Zeitraum
  jahr INTEGER NOT NULL,
  monat INTEGER NOT NULL CHECK (monat BETWEEN 1 AND 12),
  
  -- Flexible Daten (typ-spezifisch als JSON)
  verbrauch_daten JSONB DEFAULT '{}',
  -- Beispiele:
  -- E-Auto: {"km_gefahren": 1200, "strom_kwh": 240, "strom_pv_kwh": 168, "strom_netz_kwh": 72}
  -- Wärmepumpe: {"waerme_kwh": 1800, "strom_kwh": 514, "strom_pv_kwh": 206, "jaz": 3.5}
  -- Speicher: {"gespeichert_kwh": 450, "entladen_kwh": 428, "zyklen": 28}
  
  kosten_daten JSONB DEFAULT '{}',
  -- Beispiele:
  -- E-Auto: {"strom": 23.04, "wartung": 0, "reparatur": 0}
  -- Wärmepumpe: {"strom": 98.56, "wartung": 0}
  -- Speicher: {"wartung": 0}
  
  -- Berechnete/Zusammengefasste Werte
  einsparung_monat_euro DECIMAL(10,2),
  -- Tatsächliche Einsparung diesen Monat vs. Alternative
  
  co2_einsparung_kg DECIMAL(10,2),
  -- CO2-Einsparung diesen Monat
  
  -- Optional
  notizen TEXT,
  
  -- Zeitstempel
  erstellt_am TIMESTAMP DEFAULT NOW(),
  aktualisiert_am TIMESTAMP DEFAULT NOW(),
  
  -- Unique: Pro Investition nur ein Eintrag pro Monat
  CONSTRAINT uq_investition_monat UNIQUE (investition_id, jahr, monat)
);

-- Indizes
CREATE INDEX idx_inv_monatsdaten_investition ON investition_monatsdaten(investition_id);
CREATE INDEX idx_inv_monatsdaten_zeitraum ON investition_monatsdaten(jahr, monat);

-- Trigger für aktualisiert_am
CREATE TRIGGER trigger_inv_monatsdaten_aktualisiert
    BEFORE UPDATE ON investition_monatsdaten
    FOR EACH ROW
    EXECUTE FUNCTION update_aktualisiert_am();

-- Kommentare
COMMENT ON TABLE investition_monatsdaten IS 
'Monatliche Ist-Daten für alle Investitionstypen (E-Auto, Wärmepumpe, Speicher, etc.)';

COMMENT ON COLUMN investition_monatsdaten.verbrauch_daten IS
'Typ-spezifische Verbrauchsdaten als JSON (km, kWh, JAZ, etc.)';

COMMENT ON COLUMN investition_monatsdaten.kosten_daten IS
'Typ-spezifische Kostendaten als JSON (Strom, Wartung, Reparatur, etc.)';

-- ============================================================================
-- View: Investitions-Monatsdaten mit erweiterten Infos
-- ============================================================================

CREATE VIEW investition_monatsdaten_detail AS
SELECT 
  imd.*,
  
  -- Investitions-Info
  inv.typ,
  inv.bezeichnung,
  inv.mitglied_id,
  inv.anschaffungsdatum,
  inv.parameter,
  
  -- Prognose-Werte zum Vergleich
  inv.einsparung_gesamt_jahr as prognose_jahr_euro,
  ROUND(inv.einsparung_gesamt_jahr / 12.0, 2) as prognose_monat_euro,
  
  -- Differenz Ist vs. Prognose
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

COMMENT ON VIEW investition_monatsdaten_detail IS 
'Monatsdaten mit Investitions- und Mitglieder-Infos, inkl. Prognose-Vergleich';

-- ============================================================================
-- View: Jahres-Zusammenfassung pro Investition
-- ============================================================================

CREATE VIEW investition_jahres_zusammenfassung AS
SELECT 
  investition_id,
  jahr,
  
  -- Anzahl erfasste Monate
  COUNT(*) as anzahl_monate,
  
  -- Summen
  SUM(einsparung_monat_euro) as einsparung_ist_jahr_euro,
  SUM(co2_einsparung_kg) as co2_einsparung_ist_kg,
  
  -- Durchschnitte
  ROUND(AVG(einsparung_monat_euro)::numeric, 2) as durchschnitt_monat_euro,
  
  -- Hochrechnung auf 12 Monate
  CASE 
    WHEN COUNT(*) >= 3  -- Mindestens 3 Monate für Hochrechnung
    THEN ROUND((SUM(einsparung_monat_euro) / COUNT(*) * 12)::numeric, 2)
    ELSE NULL
  END as hochrechnung_jahr_euro,
  
  -- Min/Max Monat
  MIN(einsparung_monat_euro) as min_einsparung_monat,
  MAX(einsparung_monat_euro) as max_einsparung_monat

FROM investition_monatsdaten
GROUP BY investition_id, jahr;

COMMENT ON VIEW investition_jahres_zusammenfassung IS 
'Jahres-Statistiken pro Investition mit Hochrechnung';

-- ============================================================================
-- View: Vergleich Prognose vs. Ist
-- ============================================================================

CREATE VIEW investition_prognose_ist_vergleich AS
SELECT 
  inv.id as investition_id,
  inv.typ,
  inv.bezeichnung,
  inv.mitglied_id,
  jz.jahr,
  
  -- Prognose
  inv.einsparung_gesamt_jahr as prognose_jahr_euro,
  inv.co2_einsparung_kg_jahr as prognose_co2_kg_jahr,
  
  -- Ist-Werte
  jz.anzahl_monate,
  jz.einsparung_ist_jahr_euro,
  jz.hochrechnung_jahr_euro,
  jz.co2_einsparung_ist_kg,
  
  -- Abweichungen
  CASE 
    WHEN jz.hochrechnung_jahr_euro IS NOT NULL AND inv.einsparung_gesamt_jahr > 0
    THEN ROUND(
      ((jz.hochrechnung_jahr_euro - inv.einsparung_gesamt_jahr) / inv.einsparung_gesamt_jahr * 100)::numeric,
      1
    )
    ELSE NULL
  END as abweichung_hochrechnung_prozent,
  
  -- Bewertung
  CASE 
    WHEN jz.hochrechnung_jahr_euro IS NULL THEN 'Zu wenig Daten'
    WHEN jz.hochrechnung_jahr_euro > inv.einsparung_gesamt_jahr * 1.1 THEN 'Besser als Prognose'
    WHEN jz.hochrechnung_jahr_euro < inv.einsparung_gesamt_jahr * 0.9 THEN 'Schlechter als Prognose'
    ELSE 'Im Rahmen der Prognose'
  END as bewertung

FROM alternative_investitionen inv
LEFT JOIN investition_jahres_zusammenfassung jz ON inv.id = jz.investition_id;

COMMENT ON VIEW investition_prognose_ist_vergleich IS 
'Vergleich Prognose vs. Ist-Werte mit Abweichungsanalyse';

-- ============================================================================
-- Beispiel-Daten: E-Auto Monatsdaten
-- ============================================================================

-- Nur einfügen, wenn bereits eine E-Auto Investition existiert
INSERT INTO investition_monatsdaten (
  investition_id,
  jahr,
  monat,
  verbrauch_daten,
  kosten_daten,
  einsparung_monat_euro,
  co2_einsparung_kg,
  notizen
)
SELECT 
  inv.id,
  2024,
  11,  -- November
  jsonb_build_object(
    'km_gefahren', 1200,
    'strom_kwh', 240,
    'strom_pv_kwh', 168,
    'strom_netz_kwh', 72,
    'verbrauch_kwh_100km', 20.0
  ),
  jsonb_build_object(
    'strom', 23.04,
    'wartung', 0,
    'reparatur', 0,
    'sonstiges', 0
  ),
  177.00,  -- Beispiel: 200€ (Benzin) - 23€ (Strom) = 177€ Einsparung
  175.00,  -- Beispiel CO2
  'Beispieldaten November - bitte anpassen oder löschen'
FROM alternative_investitionen inv
WHERE inv.typ = 'e-auto'
LIMIT 1
ON CONFLICT (investition_id, jahr, monat) DO NOTHING;

-- ============================================================================
-- Hilfsfunktion: Monatsdaten validieren
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_investition_monatsdaten()
RETURNS TRIGGER AS $$
BEGIN
  -- Jahr nicht in der Zukunft
  IF NEW.jahr > EXTRACT(YEAR FROM NOW()) THEN
    RAISE EXCEPTION 'Jahr darf nicht in der Zukunft liegen';
  END IF;
  
  -- Monat nicht in der Zukunft
  IF NEW.jahr = EXTRACT(YEAR FROM NOW()) 
     AND NEW.monat > EXTRACT(MONTH FROM NOW()) THEN
    RAISE EXCEPTION 'Monat darf nicht in der Zukunft liegen';
  END IF;
  
  -- Einsparung nicht negativ (Warnung in notizen)
  IF NEW.einsparung_monat_euro < 0 THEN
    NEW.notizen = COALESCE(NEW.notizen || E'\n', '') || 
                   'WARNUNG: Negative Einsparung diesen Monat';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_monatsdaten
  BEFORE INSERT OR UPDATE ON investition_monatsdaten
  FOR EACH ROW
  EXECUTE FUNCTION validate_investition_monatsdaten();

-- ============================================================================
-- FERTIG!
-- ============================================================================

SELECT 'Tabelle investition_monatsdaten und Views erstellt!' as status;

-- Teste die Views
SELECT * FROM investition_monatsdaten_detail LIMIT 5;
SELECT * FROM investition_prognose_ist_vergleich;
