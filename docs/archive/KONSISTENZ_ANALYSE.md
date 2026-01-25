# Konsistenz-Analyse: Dashboard vs. Auswertungen

## Datum: 2026-01-24

## Identifizierte Inkonsistenzen

### 1. ❌ KRITISCH: Betriebsausgaben fehlen im Dashboard

**Problem:**
- **Dashboard** (`app/page.tsx`): `nettoErtrag = gesamtErloese - gesamtNetzbezugKosten`
- **ROI-Dashboard** (`components/ROIDashboard.tsx`): `nettoErtrag = erloese - kosten - betriebsausgaben` ✓ KORREKT
- **WirtschaftlichkeitStats** (`components/WirtschaftlichkeitStats.tsx`): `nettoErtrag = gesamtErloese - gesamtNetzbezugKosten` ❌ FEHLT

**Impact:**
- Dashboard zeigt zu hohe Netto-Erträge
- Falsche KPIs für Nutzer
- Inkonsistenz zwischen Dashboard und detaillierten Auswertungen

**Lösung:** Betriebsausgaben in beiden Komponenten berücksichtigen

---

### 2. ⚠️ Speicher-Daten im Dashboard

**Problem:**
- Dashboard zeigt nur PV-Monatsdaten (aus `monatsdaten` Tabelle)
- Keine Integration von Speicher-Daten aus `investition_monatsdaten`
- Speicher-Impact (Batterieentladung, Eigenverbrauchsquote) nicht sichtbar

**Aktuell:**
- Eigenverbrauch = `direktverbrauch_kwh + batterieentladung_kwh` ✓ KORREKT
- Aber: `batterieentladung_kwh` ist in `monatsdaten` enthalten

**Status:** ✓ OK - Speicher-Daten werden bereits über `monatsdaten.batterieentladung_kwh` erfasst

---

### 3. ⚠️ CO₂-Berechnung unterschiedlich

**Problem:**
- **Dashboard**: Keine CO₂-Anzeige
- **CO2ImpactDashboard**: Vollständige CO₂-Analyse mit PV + Investitionen
- **GesamtHaushaltBilanz**: CO₂ nur aus Investitionen

**Status:** Unterschiedliche Zwecke, aber konsistent

---

### 4. ⚠️ Feldnamen-Inkonsistenz

**Problem in verschiedenen Dateien:**
- `einspeisung_ertrag_euro` (Dashboard, WirtschaftlichkeitStats)
- `einspeisung_erloese_euro` (GesamtHaushaltBilanz)

**Prüfung erforderlich:** Welches Feld ist in DB korrekt?

---

## Datenmodell-Überblick

### monatsdaten Tabelle (PV-Hauptdaten)
```
- pv_erzeugung_kwh
- direktverbrauch_kwh
- batterieentladung_kwh
- batterieladung_kwh
- einspeisung_kwh
- netzbezug_kwh
- gesamtverbrauch_kwh
- netzbezug_kosten_euro
- einspeisung_ertrag_euro
- betriebsausgaben_monat_euro ← FEHLT in Dashboard!
```

### investition_monatsdaten (E-Auto, Wärmepumpe, Speicher)
```
- verbrauch_daten (JSONB)
- kosten_daten (JSONB)
- einsparung_monat_euro
- co2_einsparung_kg
- betriebsausgaben_monat_euro
```

---

## Zu korrigierende Dateien

### 1. app/page.tsx
```typescript
// ALT:
const nettoErtrag = gesamtErloese - gesamtNetzbezugKosten

// NEU:
const gesamtBetriebsausgaben = monatsdaten.reduce((sum, m) =>
  sum + toNum(m.betriebsausgaben_monat_euro), 0
)
const nettoErtrag = gesamtErloese - gesamtNetzbezugKosten - gesamtBetriebsausgaben
```

### 2. components/WirtschaftlichkeitStats.tsx
```typescript
// ALT:
const nettoErtrag = gesamtErloese - gesamtNetzbezugKosten

// NEU:
const gesamtBetriebsausgaben = monatsdaten.reduce((sum, m) =>
  sum + toNum(m.betriebsausgaben_monat_euro), 0
)
const nettoErtrag = gesamtErloese - gesamtNetzbezugKosten - gesamtBetriebsausgaben
```

---

## Validierung nach Korrektur

**Testfall:**
1. Monatsdaten mit `betriebsausgaben_monat_euro = 50€`
2. Dashboard sollte zeigen: Netto-Ertrag = Erlöse - Netzbezug - 50€
3. ROI-Dashboard sollte identischen Wert zeigen
4. Alle drei Darstellungen müssen übereinstimmen

**Erwartete Konsistenz:**
- Dashboard KPI = WirtschaftlichkeitStats KPI = ROI-Dashboard KPI

---

## Nächste Schritte

1. ✅ Feldname `einspeisung_ertrag_euro` vs. `einspeisung_erloese_euro` klären
2. ✅ Betriebsausgaben in Dashboard & WirtschaftlichkeitStats integrieren
3. ✅ Build & Test
4. ✅ Git Commit
