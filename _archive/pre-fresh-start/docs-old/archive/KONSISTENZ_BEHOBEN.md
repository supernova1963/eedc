# Konsistenz-Korrekturen: Dashboard vs. Auswertungen

## Datum: 2026-01-24

## ✅ Behobene Probleme

### 1. ✅ KRITISCH: Betriebsausgaben jetzt überall berücksichtigt

**Korrigiert in:**
- ✅ `app/page.tsx` (Dashboard)
- ✅ `components/WirtschaftlichkeitStats.tsx`
- ✅ `components/ROIDashboard.tsx` (war bereits korrekt)

**Vorher:**
```typescript
const nettoErtrag = gesamtErloese - gesamtNetzbezugKosten
```

**Nachher:**
```typescript
const gesamtBetriebsausgaben = monatsdaten.reduce((sum, m) =>
  sum + toNum(m.betriebsausgaben_monat_euro), 0
)
const nettoErtrag = gesamtErloese - gesamtNetzbezugKosten - gesamtBetriebsausgaben
```

**Impact:**
- ✅ Korrekte Netto-Ertrag-Berechnung im Dashboard
- ✅ Übereinstimmung zwischen allen Ansichten
- ✅ Realistische KPIs für Nutzer

---

### 2. ✅ Feldname-Korrektur: einspeisung_erloese → einspeisung_ertrag

**Korrigiert in:**
- ✅ `components/GesamtHaushaltBilanz.tsx`

**Schema-Validierung:**
```sql
einspeisung_ertrag_euro numeric CHECK (einspeisung_ertrag_euro >= 0::numeric)
```

**Vorher:**
```typescript
const gesamtErloese = monatsdaten.reduce((sum, m) =>
  sum + (m.einspeisung_erloese_euro || 0), 0)  // FALSCHER FELDNAME
```

**Nachher:**
```typescript
const gesamtErloese = monatsdaten.reduce((sum, m) =>
  sum + (m.einspeisung_ertrag_euro || 0), 0)  // KORREKT
```

---

## 📊 Konsistenz-Matrix (Nach Korrektur)

| Komponente | Netto-Ertrag Berechnung | Feldname | Status |
|------------|------------------------|----------|--------|
| Dashboard | Erlöse - Kosten - Betriebsausgaben | `einspeisung_ertrag_euro` | ✅ |
| WirtschaftlichkeitStats | Erlöse - Kosten - Betriebsausgaben | `einspeisung_ertrag_euro` | ✅ |
| ROIDashboard | Erlöse - Kosten - Betriebsausgaben | `einspeisung_ertrag_euro` | ✅ |
| GesamtHaushaltBilanz | - | `einspeisung_ertrag_euro` | ✅ |

---

## 🧪 Test-Szenario

**Gegeben:**
- PV-Erzeugung: 500 kWh
- Einspeisung: 200 kWh × 0,08 €/kWh = 16 €
- Netzbezug: 100 kWh × 0,30 €/kWh = 30 €
- Betriebsausgaben: 5 € (Versicherung anteilig)

**Erwartete Berechnung (ALLE Komponenten):**
```
Netto-Ertrag = 16 € - 30 € - 5 € = -19 €
```

**Vorher (Dashboard/WirtschaftlichkeitStats):**
```
Netto-Ertrag = 16 € - 30 € = -14 €  ❌ FALSCH (5 € zu viel)
```

**Nachher (ALLE Komponenten):**
```
Netto-Ertrag = 16 € - 30 € - 5 € = -19 €  ✅ KORREKT
```

---

## 📝 Datenmodell-Bestätigung

### Vorhandene Felder (monatsdaten)
```typescript
interface Monatsdaten {
  pv_erzeugung_kwh: number
  direktverbrauch_kwh: number
  batterieentladung_kwh: number  // ← Speicher-Impact bereits vorhanden!
  batterieladung_kwh: number
  einspeisung_kwh: number
  netzbezug_kwh: number
  gesamtverbrauch_kwh: number
  netzbezug_kosten_euro: number
  einspeisung_ertrag_euro: number  // ← KORREKTER NAME
  betriebsausgaben_monat_euro: number  // ← Jetzt berücksichtigt!
}
```

### Speicher-Integration
✅ **Bereits korrekt implementiert:**
- Dashboard berechnet: `gesamtEigenverbrauch = direktverbrauch_kwh + batterieentladung_kwh`
- Speicher-Entladung wird bereits in PV-Monatsdaten erfasst
- Keine zusätzliche Integration aus `investition_monatsdaten` erforderlich

---

## 🚀 Build-Status

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (9/9)

Route (app)                      Size       First Load JS
┌ ƒ /                           515 B      209 kB
├ ƒ /auswertung                 15.3 kB    224 kB
└ ... (alle anderen Routen)
```

---

## 📦 Geänderte Dateien

1. `app/page.tsx` - Betriebsausgaben hinzugefügt
2. `components/WirtschaftlichkeitStats.tsx` - Betriebsausgaben hinzugefügt
3. `components/GesamtHaushaltBilanz.tsx` - Feldname korrigiert

---

## ✅ Validierung

- [x] Build erfolgreich
- [x] Keine TypeScript-Fehler
- [x] Alle Komponenten verwenden identische Berechnungslogik
- [x] Feldnamen konsistent mit DB-Schema
- [x] Speicher-Daten bereits integriert
