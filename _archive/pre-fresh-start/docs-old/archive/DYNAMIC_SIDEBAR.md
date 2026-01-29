# Dynamische Sidebar - Investitions-basierte Navigation

**Datum**: 2026-01-24
**Version**: 1.2.1
**Status**: ✅ Implementiert

---

## Problem

Die Sidebar zeigte statisch **alle** Auswertungs-Menüpunkte an, auch wenn keine entsprechenden Investitionen vorhanden waren:
- ❌ "E-Auto" erschien, auch wenn kein E-Auto erfasst
- ❌ "Wärmepumpe" erschien, auch wenn keine Wärmepumpe vorhanden
- ❌ "Speicher" erschien, auch wenn kein Batteriespeicher konfiguriert
- ❌ "Gesamtbilanz" erschien, auch wenn keine Investitionen vorhanden

Dies führte zu:
- Verwirrung beim User (leere Seiten)
- Unnötigen Menüpunkten
- Schlechter UX

---

## Lösung

**Dynamische Sidebar-Navigation** basierend auf tatsächlich vorhandenen Investitionen.

### Implementierung

#### 1. Custom Hook: `useInvestitionsFilter`

**Datei**: `hooks/useInvestitionsFilter.ts`

**Funktion**: Lädt beim Mount die Anzahl vorhandener Investitionen aus der Datenbank

**Returns**:
```typescript
{
  hasEAutos: boolean          // Mind. 1 aktives E-Auto?
  hasWaermepumpen: boolean    // Mind. 1 aktive Wärmepumpe?
  hasSpeicher: boolean        // Mind. 1 aktiver Speicher?
  hasInvestitionen: boolean   // Mind. 1 Investition (für Gesamtbilanz)?
}
```

**Queries**:
- `alternative_investitionen` mit Filter `typ = 'e-auto' AND aktiv = true`
- `alternative_investitionen` mit Filter `typ = 'waermepumpe' AND aktiv = true`
- `alternative_investitionen` mit Filter `typ = 'speicher' AND aktiv = true`
- `investitionen_uebersicht` (alle Investitionen)

**Performance**: Nutzt Supabase `.select('*', { count: 'exact', head: true })` für schnelle Count-Queries (kein Daten-Transfer)

#### 2. Dynamische Navigation-Funktion: `getNavigation()`

**Datei**: `components/Sidebar.tsx`

**Funktion**: Generiert Navigation-Array basierend auf vorhandenen Investitionen

**Logik**:
```typescript
const auswertungenChildren: NavItem[] = [
  // Immer: PV-Anlage
  { icon: 'sun', label: 'PV-Anlage', href: '/auswertung?tab=pv' },
]

// Conditional: Nur wenn vorhanden
if (hasEAutos) {
  auswertungenChildren.push({ icon: 'car', label: 'E-Auto', ... })
}
if (hasWaermepumpen) {
  auswertungenChildren.push({ icon: 'heat', label: 'Wärmepumpe', ... })
}
if (hasSpeicher) {
  auswertungenChildren.push({ icon: 'battery', label: 'Speicher', ... })
}
if (hasInvestitionen) {
  auswertungenChildren.push({ icon: 'gem', label: 'Gesamtbilanz', ... })
}

// Immer: ROI, CO₂, Prognose, Details, Optimierung
auswertungenChildren.push(...)
```

#### 3. Sidebar-Komponente Update

**Hook-Integration**:
```typescript
const { hasEAutos, hasWaermepumpen, hasSpeicher, hasInvestitionen } = useInvestitionsFilter()

const navigation = useMemo(
  () => getNavigation(hasEAutos, hasWaermepumpen, hasSpeicher, hasInvestitionen),
  [hasEAutos, hasWaermepumpen, hasSpeicher, hasInvestitionen]
)
```

**Optimierung**: `useMemo` verhindert unnötige Re-Renders bei gleichen Werten

---

## Verhalten

### Szenario 1: Keine Investitionen
**Sidebar zeigt**:
```
Auswertungen ▼
  ├─ PV-Anlage
  ├─ ROI-Analyse
  ├─ CO₂-Impact
  ├─ Prognose vs. IST
  ├─ Monats-Details
  └─ Optimierung
```

### Szenario 2: Nur E-Auto vorhanden
**Sidebar zeigt**:
```
Auswertungen ▼
  ├─ PV-Anlage
  ├─ E-Auto              ← Neu!
  ├─ ROI-Analyse
  ├─ CO₂-Impact
  ├─ Prognose vs. IST
  ├─ Monats-Details
  └─ Optimierung
```

### Szenario 3: E-Auto + Wärmepumpe + Speicher + Investitionen
**Sidebar zeigt**:
```
Auswertungen ▼
  ├─ PV-Anlage
  ├─ E-Auto              ← Dynamisch
  ├─ Wärmepumpe          ← Dynamisch
  ├─ Speicher            ← Dynamisch
  ├─ Gesamtbilanz        ← Dynamisch
  ├─ ROI-Analyse
  ├─ CO₂-Impact
  ├─ Prognose vs. IST
  ├─ Monats-Details
  └─ Optimierung
```

---

## Datenbankzugriffe

### Beim Mount der Sidebar (einmalig)

**4 Count-Queries**:
1. `SELECT COUNT(*) FROM alternative_investitionen WHERE typ = 'e-auto' AND aktiv = true`
2. `SELECT COUNT(*) FROM alternative_investitionen WHERE typ = 'waermepumpe' AND aktiv = true`
3. `SELECT COUNT(*) FROM alternative_investitionen WHERE typ = 'speicher' AND aktiv = true`
4. `SELECT COUNT(*) FROM investitionen_uebersicht`

**Optimierung**:
- Verwendet `head: true` → keine Datenübertragung, nur Count
- Cached im State → keine Re-Queries bei Re-Renders
- Asynchron → blockiert nicht das UI-Rendering

---

## Reaktivität

### Wann aktualisiert sich die Sidebar?

**Automatisch bei**:
- ✅ Page Reload (useEffect beim Mount)
- ✅ Navigation zu neuer Route (Component Re-Mount)

**NICHT automatisch bei**:
- ❌ Neue Investition hinzugefügt (ohne Reload)

**Lösung für Real-Time Updates** (Optional, nicht implementiert):
```typescript
// Supabase Realtime Subscription
useEffect(() => {
  const subscription = supabase
    .channel('investitionen-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'alternative_investitionen' },
      () => loadCounts()
    )
    .subscribe()

  return () => { subscription.unsubscribe() }
}, [])
```

---

## Performance

### Initial Load
- **4 Count-Queries**: ~50-100ms (parallel)
- **UI**: Rendert sofort mit Standardwerten (alle false)
- **Sichtbar**: Navigation erscheint nach ~100ms mit korrekten Items

### Re-Renders
- **useMemo**: Verhindert unnötige Berechnungen
- **Dependencies**: Nur bei tatsächlichen Änderungen

### Memory
- **Minimaler Overhead**: 4 Boolean-Werte im State

---

## Testing

### Test-Szenarien

**1. Keine Investitionen**:
```sql
DELETE FROM alternative_investitionen;
DELETE FROM investitionen_uebersicht;
```
→ Sidebar zeigt nur: PV-Anlage, ROI, CO₂, Prognose, Details, Optimierung

**2. E-Auto hinzufügen**:
```sql
INSERT INTO alternative_investitionen (typ, aktiv, ...) VALUES ('e-auto', true, ...);
```
→ Nach Reload: "E-Auto" erscheint in Sidebar

**3. Investition deaktivieren**:
```sql
UPDATE alternative_investitionen SET aktiv = false WHERE typ = 'e-auto';
```
→ Nach Reload: "E-Auto" verschwindet aus Sidebar

---

## Dateien

### Neu erstellt
```
hooks/
  └── useInvestitionsFilter.ts    (Custom Hook, 65 Zeilen)

DYNAMIC_SIDEBAR.md                (Dokumentation)
```

### Modifiziert
```
components/
  └── Sidebar.tsx                 (+ Hook, + getNavigation(), ~80 Zeilen geändert)
```

---

## Migration

**Breaking Changes**: Keine

**Bestehender Code**: Funktioniert unverändert

**Neue Investitionen**: Erscheinen automatisch in Sidebar (nach Reload)

---

## Vorteile

### UX
- ✅ **Weniger Verwirrung**: User sieht nur relevante Menüpunkte
- ✅ **Klarere Navigation**: Keine leeren Seiten mehr
- ✅ **Professioneller**: Passt sich an User-Konfiguration an

### Performance
- ✅ **Schnell**: Count-Queries statt Full-Table-Scans
- ✅ **Optimiert**: useMemo verhindert unnötige Berechnungen
- ✅ **Lazy**: Lädt nur beim Mount, nicht bei jedem Render

### Wartbarkeit
- ✅ **Zentral**: Eine Funktion (`getNavigation`) für Logik
- ✅ **Erweiterbar**: Neue Investitions-Typen einfach hinzufügen
- ✅ **Testbar**: Hook isoliert testbar

---

## Zukünftige Erweiterungen

### Neue Investitions-Typen hinzufügen

**1. Hook erweitern**:
```typescript
const { count: solarBatterieCount } = await supabase
  .from('alternative_investitionen')
  .select('*', { count: 'exact', head: true })
  .eq('typ', 'solar-batterie')
  .eq('aktiv', true)

setCounts({
  ...existing,
  hasSolarBatterie: (solarBatterieCount || 0) > 0
})
```

**2. Navigation erweitern**:
```typescript
if (hasSolarBatterie) {
  auswertungenChildren.push({
    icon: 'battery',
    label: 'Solar-Batterie',
    href: '/auswertung?tab=solar-batterie'
  })
}
```

---

## Zusammenfassung

**Problem**: Statische Navigation mit irrelevanten Menüpunkten
**Lösung**: Dynamische Navigation basierend auf tatsächlichen Investitionen
**Implementierung**: Custom Hook + useMemo + conditional rendering
**Performance**: 4 schnelle Count-Queries beim Mount
**UX**: Bessere, personalisierte Navigation
**Status**: Produktionsbereit ✅

---

**Co-Authored-By**: Claude Sonnet 4.5 <noreply@anthropic.com>
