# Phase 2.1 - Wechselrichter & PV-Module (Basis)

## Was ist neu?

1. **DB-Migration**: parent_investition_id Spalte
2. **Neue Typen**: wechselrichter, pv-module
3. **Parameter-Formulare**: Detaillierte Eingabefelder
4. **Verknüpfung**: PV-Module → Wechselrichter
5. **Geokoordinaten**: Automatisch aus Anlagen-Standort vorgeschlagen

## OHNE (kommt später):
- ❌ PVGIS-API
- ❌ Monatsdaten pro Wechselrichter
- ❌ SOLL/IST-Auswertung

## Installation

### Schritt 1: DB-Migration
```sql
-- In Supabase SQL Editor:
```
Führe `migration.sql` aus!

### Schritt 2: InvestitionFormSimple.tsx aktualisieren

Die Datei ist zu groß für vollständigen Ersatz.
Folge stattdessen der Anleitung in:
**INVESTITION_FORM_UPDATES.md**

Dort findest du ALLE nötigen Änderungen mit Zeilenangaben!

Die Formular-JSX-Blöcke findest du in:
**PARAMETER_FORMS.tsx**

### Schritt 3: Testen
```bash
npm run dev

# 1. Wechselrichter anlegen
# 2. PV-Module anlegen (Wechselrichter auswählen)
```

### Schritt 4: Git
```bash
git add .
git commit -m "Phase 2.1: Wechselrichter & PV-Module als Investitionen

- parent_investition_id für Verknüpfungen
- Neue Typen: wechselrichter, pv-module
- Parameter-Formulare
- Geokoordinaten aus Anlage vorschlagen"

git push origin main
```

## Workflow

1. **Wechselrichter anlegen**
   - Typ: Wechselrichter
   - AC/DC Leistung
   - Hersteller/Modell

2. **PV-Module anlegen**
   - Typ: PV-Module
   - Wechselrichter auswählen (Dropdown)
   - kWp, Ausrichtung, Neigung
   - Geokoordinaten (auto-vorgeschlagen)
   - Jahresertrag (manuell, später PVGIS)

3. **Später (Phase 2.2)**
   - PVGIS-API Integration
   - Automatische Jahresertrag-Prognose

4. **Später (Phase 2.3)**
   - Monatsdaten pro Wechselrichter
   - SOLL/IST-Vergleich

Fertig! 🎉
