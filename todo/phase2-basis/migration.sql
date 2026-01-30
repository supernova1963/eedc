-- Migration: Wechselrichter & PV-Module als Investitionen
-- Datum: 2026-01-21

-- 1. Parent-Verknüpfung hinzufügen
ALTER TABLE alternative_investitionen
ADD COLUMN IF NOT EXISTS parent_investition_id uuid REFERENCES alternative_investitionen(id) ON DELETE SET NULL;

COMMENT ON COLUMN alternative_investitionen.parent_investition_id IS 'Verknüpfung zu übergeordneter Investition (z.B. PV-Module → Wechselrichter)';

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_alternative_investitionen_parent 
ON alternative_investitionen(parent_investition_id) 
WHERE parent_investition_id IS NOT NULL;

-- 2. Typ-Constraint erweitern (falls vorhanden)
-- Hinweis: Falls es einen CHECK constraint gibt, muss dieser erweitert werden
-- Ansonsten einfach die neuen Typen verwenden

-- Beispiel falls CHECK existiert:
-- ALTER TABLE alternative_investitionen DROP CONSTRAINT IF EXISTS alternative_investitionen_typ_check;
-- ALTER TABLE alternative_investitionen ADD CONSTRAINT alternative_investitionen_typ_check 
-- CHECK (typ IN ('e-auto', 'waermepumpe', 'speicher', 'balkonkraftwerk', 'wallbox', 'sonstiges', 'wechselrichter', 'pv-module'));

-- 3. Kommentare für neue Typen
COMMENT ON TABLE alternative_investitionen IS 'Energie-Investitionen: E-Auto, Wärmepumpe, Speicher, Balkonkraftwerk, Wallbox, Wechselrichter, PV-Module, Sonstiges';

-- Fertig!
-- Neue Typen können jetzt verwendet werden:
-- - 'wechselrichter': Wechselrichter/Inverter
-- - 'pv-module': PV-Module (Erweiterung, Balkonkraftwerk)
