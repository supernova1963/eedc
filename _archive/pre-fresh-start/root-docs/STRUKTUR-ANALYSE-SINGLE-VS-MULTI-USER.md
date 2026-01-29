# Struktur-Analyse: Single-User vs Multi-User Architektur

**Datum:** 2026-01-28
**Status:** Vollständige Codebase-Analyse
**Kontext:** Nach Implementierung von Community-Features

---

## Executive Summary

Die EEDC-Webapp wurde ursprünglich für **Single-User mit Single-Anlage** entwickelt und später um **Multi-User** und **Community-Features** erweitert. Diese Analyse zeigt:

### ✅ Was gut funktioniert:
- Grundlegende Multi-User-Unterstützung via `mitglied_id` Filter
- Community-Features mit Security Definer Functions (umgeht RLS-Zirkelbezüge)
- Trennung von Auth-User (`auth.users`) und App-User (`mitglieder`)

### ⚠️ Kritische Probleme:
- **Keine Multi-Anlage Unterstützung:** User mit mehreren Anlagen sehen nur die "erste"
- **Unvollständiges RLS:** `alternative_investitionen` und andere Tabellen haben kein/fehlerhaftes RLS
- **RLS-Zirkelbezüge:** Policies mit JOINs auf RLS-aktivierte Tabellen

### 🎯 Hauptrisiko:
Ein User mit 2+ PV-Anlagen kann **nicht zwischen Anlagen wechseln** und sieht nur Daten der ersten.

---

## 1. SINGLE-ANLAGE ANTIPATTERN

### 1.1 Das `.limit(1).single()` Problem

**Pattern:**
```typescript
const { data: anlage } = await supabase
  .from('anlagen')
  .select('*')
  .eq('mitglied_id', userId)
  .eq('aktiv', true)
  .order('erstellt_am', { ascending: false })
  .limit(1)     // ← Ignoriert alle weiteren Anlagen
  .single()     // ← Erwartet genau eine Zeile
```

**Konsequenz:** User mit 2 Anlagen sieht nur Daten der ersten (nach Erstellungsdatum sortiert).

### 1.2 Betroffene Seiten (KRITISCH)

| Seite | Pfad | Zeilen | Severity | Beschreibung |
|-------|------|--------|----------|--------------|
| **Dashboard** | [app/meine-anlage/page.tsx](app/meine-anlage/page.tsx) | 13-21 | 🔴 KRITISCH | Zeigt nur Dashboard für erste Anlage |
| **Datenerfassung** | [app/eingabe/page.tsx](app/eingabe/page.tsx) | 18-25 | 🔴 KRITISCH | Monatsdaten können nur für erste Anlage erfasst werden |
| **Übersicht** | [app/uebersicht/page.tsx](app/uebersicht/page.tsx) | 13-20 | 🟠 HOCH | Monatsdaten-Tabelle nur für erste Anlage |
| **Auswertungen** | [app/auswertung/page.tsx](app/auswertung/page.tsx) | 23-30 | 🔴 KRITISCH | ROI, Charts, Prognosen nur für erste Anlage |

### 1.3 Kommentare, die das Problem zeigen

```typescript
// app/meine-anlage/page.tsx:13
// Erste Anlage des Users holen

// app/uebersicht/page.tsx:12
// Erste Anlage des Users holen

// app/eingabe/page.tsx:17
// Erste Anlage des Users
```

Diese Kommentare zeigen, dass die Entwicklung bewusst Single-Anlage war.

### 1.4 Ausnahme: Anlagen-Verwaltung ✓

**[app/anlage/page.tsx](app/anlage/page.tsx)** macht es richtig:
- Zeile 87-93: Dropdown mit allen Anlagen
- Zeile 117: URL-Parameter `?anlageId=` für Anlagenwechsel
- Zeile 52-77: Fallback-Logik für "keine Anlage" vs "erste Anlage"

**Empfehlung:** Dieses Pattern auf alle Seiten übertragen!

---

## 2. FEHLENDE MULTI-ANLAGE UI-KOMPONENTEN

### 2.1 Benötigte Komponenten

Folgende Seiten brauchen einen **Anlagen-Selector** (Dropdown/Tabs):

1. **Dashboard** ([app/meine-anlage/page.tsx](app/meine-anlage/page.tsx))
   - Dropdown oben rechts: "Meine Anlagen: [Dropdown]"
   - URL-Parameter: `/meine-anlage?anlageId=xxx`

2. **Datenerfassung** ([app/eingabe/page.tsx](app/eingabe/page.tsx))
   - Dropdown vor Monatsdaten-Formularen
   - URL-Parameter: `/eingabe?anlageId=xxx`

3. **Übersicht** ([app/uebersicht/page.tsx](app/uebersicht/page.tsx))
   - Tabs: "Anlage 1 | Anlage 2 | Anlage 3"
   - URL-Parameter: `/uebersicht?anlageId=xxx`

4. **Auswertungen** ([app/auswertung/page.tsx](app/auswertung/page.tsx))
   - Dropdown: "Anlage auswählen"
   - URL-Parameter: `/auswertung?anlageId=xxx&tab=gesamt`

### 2.2 Component Blueprint

```typescript
// components/AnlagenSelector.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

interface AnlagenSelectorProps {
  currentAnlageId?: string
  onChange?: (anlageId: string) => void
}

export default function AnlagenSelector({ currentAnlageId, onChange }: AnlagenSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [anlagen, setAnlagen] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState(currentAnlageId || searchParams.get('anlageId'))

  useEffect(() => {
    const loadAnlagen = async () => {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const { data: mitglied } = await supabase
        .from('mitglieder')
        .select('id')
        .eq('email', user.email)
        .single()

      if (!mitglied) return

      const { data } = await supabase
        .from('anlagen')
        .select('id, anlagenname, leistung_kwp')
        .eq('mitglied_id', mitglied.id)
        .eq('aktiv', true)
        .order('erstellt_am', { ascending: false })

      setAnlagen(data || [])

      // Wenn keine Anlage ausgewählt, wähle erste
      if (!selectedId && data && data.length > 0) {
        setSelectedId(data[0].id)
      }
    }

    loadAnlagen()
  }, [])

  const handleChange = (anlageId: string) => {
    setSelectedId(anlageId)
    onChange?.(anlageId)

    // Update URL
    const params = new URLSearchParams(searchParams.toString())
    params.set('anlageId', anlageId)
    router.push(`?${params.toString()}`)
  }

  if (anlagen.length <= 1) {
    // Wenn nur eine Anlage, zeige keinen Selector
    return null
  }

  return (
    <select
      value={selectedId || ''}
      onChange={(e) => handleChange(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-md"
    >
      {anlagen.map((a) => (
        <key={a.id} value={a.id}>
          {a.anlagenname} ({a.leistung_kwp} kWp)
        </option>
      ))}
    </select>
  )
}
```

### 2.3 Integration in Seiten

```typescript
// app/meine-anlage/page.tsx
import AnlagenSelector from '@/components/AnlagenSelector'

export default async function DashboardPage({ searchParams }: { searchParams: { anlageId?: string } }) {
  const user = await getCurrentUser()
  if (!user) return <NotAuthenticated />

  // Hole Anlage basierend auf URL-Parameter oder erste Anlage
  const anlageId = searchParams.anlageId
  const anlage = anlageId
    ? await getAnlageById(anlageId, user.id)
    : await getFirstAnlage(user.id)

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1>Dashboard</h1>
        <AnlagenSelector currentAnlageId={anlage?.id} />
      </div>
      {/* Rest der Seite */}
    </div>
  )
}
```

---

## 3. RLS (ROW LEVEL SECURITY) PROBLEME

### 3.1 Unvollständige RLS-Aktivierung

**Quelle:** [scripts/create-schema.sql](scripts/create-schema.sql) Zeilen 312-319

#### ✅ RLS ist aktiviert für:
- `mitglieder`
- `anlagen`
- `anlagen_freigaben`
- `monatsdaten`
- `investitionen`

#### ❌ RLS fehlt für:
- `alternative_investitionen` 🔴 **KRITISCH**
- `investition_monatsdaten` 🔴 **KRITISCH**
- `investitionstyp_config` 🟢 OK (Master Data)
- `strompreise` 🟠 **TEILWEISE** (nachträglich hinzugefügt)
- `wetterdaten` 🟢 OK (Master Data)
- `anlagen_kennzahlen` ❌
- `investition_kennzahlen` ❌

#### Kommentar im Code (Zeile 318):
```sql
-- Alternative Investitionen, Kennzahlen und Wetterdaten haben aktuell keine RLS
-- Diese können später bei Bedarf aktiviert werden
```

**Problem:** "Später" ist JETZT! E-Autos, Wärmepumpen, Speicher sind **private User-Daten**.

### 3.2 Nachträgliche RLS-Aktivierung (inkonsistent)

In [scripts/fix-all-rls-policies.sql](scripts/fix-all-rls-policies.sql) wurden Policies nachträglich hinzugefügt:

```sql
-- Zeile 165-176
DROP POLICY IF EXISTS "Users can view own alternative_investitionen" ON alternative_investitionen;

CREATE POLICY "alternative_investitionen_select" ON alternative_investitionen
  FOR SELECT TO authenticated
  USING (mitglied_id IN (
    SELECT id FROM mitglieder WHERE email = auth.email()
  ));
```

**Probleme:**
1. RLS ist im Haupt-Schema nicht aktiviert (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` fehlt!)
2. Policy nutzt Subquery auf `mitglieder` → potenzieller RLS-Zirkelbezug
3. Keine Policies für `INSERT`, `UPDATE`, `DELETE`

### 3.3 RLS-Zirkelbezüge

**Problem:** Policies auf Tabelle A machen Subquery auf Tabelle B, die wiederum RLS hat mit Subquery auf Tabelle A.

#### Beispiel: anlagen_freigaben ↔ anlagen

**Policy 1:** [scripts/fix-all-rls-policies.sql](scripts/fix-all-rls-policies.sql) Zeile 42-47
```sql
CREATE POLICY "anlagen_freigaben_select" ON anlagen_freigaben
  FOR SELECT TO authenticated
  USING (anlage_id IN (
    SELECT a.id FROM anlagen a        -- ← Query auf anlagen (hat RLS!)
    JOIN mitglieder m ON m.id = a.mitglied_id
    WHERE m.email = auth.email()
  ));
```

**Policy 2:** [scripts/fix-anlagen-rls-final.sql](scripts/fix-anlagen-rls-final.sql) Zeile 16-27
```sql
CREATE POLICY "anlagen_select" ON anlagen
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mitglieder       -- ← Query auf mitglieder (hat RLS!)
      WHERE mitglieder.id = anlagen.mitglied_id
        AND mitglieder.email = auth.email()
    )
  );
```

**Zirkelbezug:**
1. User fragt `anlagen_freigaben` ab
2. Policy macht Subquery auf `anlagen`
3. `anlagen` Policy macht Subquery auf `mitglieder`
4. `mitglieder` Policy macht (in älteren Versionen) Subquery auf `anlagen` 💥

**Lösung:** [scripts/fix-infinite-recursion-final.sql](scripts/fix-infinite-recursion-final.sql) hat dies mit Security Definer Functions behoben:

```sql
-- Zeile 40-74
CREATE OR REPLACE FUNCTION get_public_anlagen_with_members()
RETURNS TABLE (...)
SECURITY DEFINER  -- ← Umgeht RLS!
SET search_path = public
LANGUAGE sql
AS $$
  SELECT ...
  FROM anlagen a
  INNER JOIN anlagen_freigaben af ON af.anlage_id = a.id
  INNER JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.aktiv = true
    AND af.profil_oeffentlich = true
  ORDER BY a.erstellt_am DESC;
$$;
```

**Status:** Community-Features nutzen die RPC-Function ✓
**Aber:** Private Auth-Queries nutzen immer noch Policies mit Subqueries ⚠️

### 3.4 RLS Policy Matrix

| Tabelle | RLS aktiv | SELECT | INSERT | UPDATE | DELETE | Notizen |
|---------|-----------|--------|--------|--------|--------|---------|
| `mitglieder` | ✅ | ✅ | ❌ | ✅ | ❌ | Nur eigene Daten |
| `anlagen` | ✅ | ✅ | ✅ | ✅ | ✅ | Nutzt EXISTS auf mitglieder |
| `anlagen_freigaben` | ✅ | ✅ | ✅ | ✅ | ✅ | JOIN auf anlagen (Zirkelbezug?) |
| `monatsdaten` | ✅ | ✅ | ✅ | ✅ | ✅ | JOIN via anlage_id |
| `investitionen` | ✅ | ✅ | ✅ | ✅ | ✅ | JOIN via anlage_id |
| `alternative_investitionen` | ❌ | ⚠️ | ❌ | ❌ | ❌ | Policy ohne RLS-Aktivierung! |
| `investition_monatsdaten` | ❌ | ⚠️ | ❌ | ❌ | ❌ | Policy ohne RLS-Aktivierung! |
| `anlagen_kennzahlen` | ❌ | ❌ | ❌ | ❌ | ❌ | Cache-Tabelle |
| `investition_kennzahlen` | ❌ | ❌ | ❌ | ❌ | ❌ | Cache-Tabelle |
| `strompreise` | ⚠️ | ✅ | ✅ | ✅ | ✅ | Nachträglich aktiviert |

**Legende:**
- ✅ = Implementiert und funktioniert
- ⚠️ = Teilweise/Problematisch
- ❌ = Fehlt komplett

---

## 4. COMMUNITY vs PRIVATE SEPARATION

### 4.1 Architektur-Überblick

**Public Routes (kein Auth erforderlich):**
- `/` - Community Dashboard
- `/community` - Alle öffentlichen Anlagen
- `/community/vergleich` - Anlagen-Vergleich
- `/community/regional` - Regional-Ansicht
- `/community/bestenliste` - Top-Anlagen

**Private Routes (Auth erforderlich):**
- `/meine-anlage` - Persönliches Dashboard
- `/eingabe` - Datenerfassung
- `/uebersicht` - Monatsdaten-Übersicht
- `/auswertung` - ROI, Charts, Prognosen
- `/anlage` - Anlagen-Verwaltung
- `/investitionen` - Investitionen-Verwaltung
- `/stammdaten` - Strompreise, Zuordnungen

**Definition:** [components/ConditionalLayout.tsx](components/ConditionalLayout.tsx) Zeile 16-22
```typescript
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/test-register',
  '/community',
]
```

### 4.2 Community Data Access Pattern

**Richtig:** [lib/community.ts](lib/community.ts) nutzt Security Definer Function

```typescript
// Zeile 52
const { data: basicData, error } = await supabase.rpc('get_public_anlagen_with_members')
```

**Vorteile:**
- ✅ Umgeht RLS-Zirkelbezüge
- ✅ Performance (eine Query statt mehrere JOINs)
- ✅ Sicherheit (Function ist SECURITY DEFINER, kontrolliert Zugriff explizit)

**Nachteil:**
- ⚠️ Wenn RPC-Function fehlschlägt, gibt es keinen Fallback
- ⚠️ `getPublicAnlage()` lädt ALLE public anlagen und filtert clientseitig (ineffizient)

### 4.3 Problem: Ineffiziente Public Anlage-Abfrage

**Code:** [lib/community.ts](lib/community.ts) Zeile 147-162
```typescript
export async function getPublicAnlage(anlageId: string): Promise<PublicAnlage | null> {
  const supabase = await createClient()

  // Nutze die Security Definer Function und filtere clientseitig
  const { data: allPublic, error } = await supabase.rpc('get_public_anlagen_with_members')

  if (error || !allPublic) {
    console.error('Error fetching public anlagen:', error)
    return null
  }

  // Finde die gesuchte Anlage
  const basicData = allPublic.find((a: any) => a.anlage_id === anlageId)
  if (!basicData) {
    return null  // ← Keine Info ob Anlage nicht existiert oder nicht öffentlich ist
  }
```

**Probleme:**
1. Lädt **alle** öffentlichen Anlagen (kann bei vielen Anlagen langsam sein)
2. Filtert clientseitig statt in der Datenbank
3. Keine Unterscheidung: "Anlage existiert nicht" vs "Anlage ist nicht öffentlich"

**Besserer Weg:**
```sql
-- Neue RPC-Function
CREATE OR REPLACE FUNCTION get_public_anlage_by_id(p_anlage_id uuid)
RETURNS TABLE (...)
SECURITY DEFINER
AS $$
  SELECT ...
  FROM anlagen a
  INNER JOIN anlagen_freigaben af ON af.anlage_id = a.id
  INNER JOIN mitglieder m ON m.id = a.mitglied_id
  WHERE a.id = p_anlage_id
    AND a.aktiv = true
    AND af.profil_oeffentlich = true;
$$;
```

### 4.4 Problem: Community Stats leakt Gesamtanzahl Anlagen

**Code:** [lib/community.ts](lib/community.ts) Zeile 300-319
```typescript
export async function getCommunityStats() {
  const supabase = await createClient()

  const { count: anlagenCount } = await supabase
    .from('anlagen')
    .select('*', { count: 'exact', head: true })
    .eq('aktiv', true)  // ← ALLE aktiven Anlagen aller User!

  const { data: publicAnlagen } = await supabase.rpc('get_public_anlagen_with_members')
  const publicCount = publicAnlagen?.length || 0

  return {
    gesamtAnlagen: anlagenCount || 0,        // ← Leak!
    oeffentlicheAnlagen: publicCount,
    gesamtleistungKwp: ...,
  }
}
```

**Problem:**
- `gesamtAnlagen` zählt **alle** Anlagen in der Datenbank (auch private)
- Dies leakt Information: "Es gibt X Solar-Installationen im System"

**Frage:** Ist das gewollt oder ein Leak?
- **Wenn gewollt:** Dokumentieren und klarstellen
- **Wenn nicht gewollt:** Nur `oeffentlicheAnlagen` zurückgeben

### 4.5 Freigabe-Checks (Consistency)

| Function | Prüft Freigabe | Zeitpunkt | Status |
|----------|----------------|-----------|--------|
| `getPublicAnlagen()` | `profil_oeffentlich` | Direkt in RPC-Function | ✅ |
| `getPublicAnlage()` | `profil_oeffentlich` | Nach Datenabruf (Zeile 201) | ⚠️ |
| `getPublicKennzahlen()` | `kennzahlen_oeffentlich` | **VOR** Datenabruf (Zeile 238) | ✅ |
| `getPublicMonatsdaten()` | `monatsdaten_oeffentlich` | **VOR** Datenabruf (Zeile 267) | ✅ |

**Inkonsistenz:** `getPublicAnlage()` lädt erst alle Daten, dann prüft Freigabe.

---

## 5. ALTERNATIVE INVESTITIONEN: ANLAGE vs MITGLIED

### 5.1 Datenmodell-Problem

**Schema:** [scripts/create-schema.sql](scripts/create-schema.sql) Zeile 219-241
```sql
CREATE TABLE alternative_investitionen (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mitglied_id UUID NOT NULL REFERENCES mitglieder(id),  -- ← Verknüpft mit Mitglied
  anlage_id UUID REFERENCES anlagen(id),                 -- ← Optional: Verknüpft mit Anlage
  parent_investition_id UUID REFERENCES alternative_investitionen(id),
  typ VARCHAR NOT NULL,  -- e-auto, waermepumpe, speicher, etc.
  ...
);
```

**Semantik:**
- `mitglied_id` ist **required** - Investition gehört zu einem Mitglied
- `anlage_id` ist **optional** - Investition KANN mit einer Anlage verknüpft sein

**Problem:** Die App behandelt Investitionen oft so, als würden sie immer zu "der einen Anlage" gehören.

### 5.2 Beispiele für die Verwirrung

#### Beispiel 1: Datenerfassungs-Seite
**[app/eingabe/page.tsx](app/eingabe/page.tsx)** Zeile 28-47:

```typescript
// Zeile 13: Lädt ERSTE Anlage
const { data: anlage } = await supabase
  .from('anlagen')
  .select('*')
  .eq('mitglied_id', userId)
  .eq('aktiv', true)
  .order('erstellt_am', { ascending: false })
  .limit(1)
  .single()

// Zeile 28-47: Lädt E-Autos, Wärmepumpen, Wechselrichter für User
const { data: eAutos } = await supabase
  .from('alternative_investitionen')
  .select('id, bezeichnung, parameter')
  .eq('mitglied_id', userId)  // ← Alle Investitionen des Users
  .eq('typ', 'e-auto')
  .eq('aktiv', true)
```

**Verwirrung:** Die Seite zeigt:
- Monatsdaten-Formular für **erste Anlage**
- E-Auto/WP Formulare für **alle Investitionen des Users**

Was passiert, wenn der User 2 Anlagen hat:
- Anlage 1: PV + Speicher
- Anlage 2: PV + Wärmepumpe + E-Auto

Die Seite zeigt:
- Monatsdaten für Anlage 1 ✓
- Formulare für WP + E-Auto (gehören zu Anlage 2!) ❌

#### Beispiel 2: Investition-Formular

**[hooks/useInvestitionForm.ts](hooks/useInvestitionForm.ts)** Zeile 65-70:
```typescript
// Wenn keine Anlage ausgewählt, kopiere Geokoordinaten von erster Anlage
const { data: anlage } = await supabase
  .from('anlagen')
  .select('standort_latitude, standort_longitude')
  .eq('mitglied_id', mitgliedId)
  .limit(1)
  .single()

if (anlage) {
  setFormData(prev => ({
    ...prev,
    geo_latitude: anlage.standort_latitude,
    geo_longitude: anlage.standort_longitude,
  }))
}
```

**Problem:** Wenn User 2 Anlagen hat (eine in München, eine in Berlin), werden immer die Koordinaten der ersten Anlage verwendet - auch wenn die neue Investition zur zweiten gehört.

### 5.3 Empfohlene Lösung

**Option A: Anlage-Auswahl Pflichtfeld**
- Beim Erstellen von E-Auto/WP/Speicher: "Zu welcher Anlage gehört dies?"
- Setze `anlage_id` als **required** statt optional
- Migration: Bestehende Investitionen ohne `anlage_id` → Erste Anlage zuordnen

**Option B: Investitionen unabhängig von Anlagen**
- Investitionen gehören nur zum Mitglied (wie aktuell)
- **Aber:** Formulare nicht auf "Erste Anlage" Seiten mischen
- Eigene Seite: `/investitionen/e-autos`, `/investitionen/waermepumpen`

**Empfehlung:** Option A ist konsistenter und verständlicher für User.

---

## 6. MIGRATIONS-HISTORIE: CHAOS DOKUMENTIERT

### 6.1 Timeline der RLS-Fixes

Die Vielzahl der `fix-*.sql` Skripte zeigt das iterative Debugging:

| Skript | Datum | Problem | Lösung |
|--------|-------|---------|--------|
| [create-schema.sql](scripts/create-schema.sql) | Basis | RLS nur für 5 Tabellen | Unvollständig |
| [fix-all-rls-policies.sql](scripts/fix-all-rls-policies.sql) | ? | Policies fehlen für viele Tabellen | Policies hinzugefügt mit JOINs |
| [fix-community-public-access.sql](scripts/fix-community-public-access.sql) | ? | Community kann Anlagen nicht sehen | Public Policies hinzugefügt |
| [fix-infinite-recursion.sql](scripts/fix-infinite-recursion.sql) | ? | Infinite recursion in mitglieder Policy | Vereinfachte Policy |
| [fix-infinite-recursion-v2.sql](scripts/fix-infinite-recursion-v2.sql) | ? | Recursion noch nicht behoben | Weitere Anpassungen |
| [fix-infinite-recursion-final.sql](scripts/fix-infinite-recursion-final.sql) | ? | Recursion immer noch da | **Security Definer Function** |
| [fix-auth-access.sql](scripts/fix-auth-access.sql) | ? | Auth blockiert User-Daten | Policy gelockert |
| [fix-auth-access-v2.sql](scripts/fix-auth-access-v2.sql) | ? | Immer noch blockiert | Weitere Anpassungen |
| [fix-auth-access-v3.sql](scripts/fix-auth-access-v3.sql) | ? | Service Role blockiert | `auth.jwt() IS NULL` Prüfung |
| [fix-anlagen-rls-final.sql](scripts/fix-anlagen-rls-final.sql) | ? | Anlagen RLS defekt | Simplere Policy |
| [fix-anlagen-policy.sql](scripts/fix-anlagen-policy.sql) | ? | Noch Probleme | Weitere Iteration |
| [fix-strompreise-table.sql](scripts/fix-strompreise-table.sql) | ? | Strompreise RLS fehlt | Nachträglich aktiviert |
| [diagnose-and-fix-mitglieder-policy.sql](scripts/diagnose-and-fix-mitglieder-policy.sql) | 2026-01-28 | Benutzername nicht sichtbar | **Aktuelle Analyse** |

**Beobachtung:** 12+ Fix-Skripte für RLS-Probleme!

### 6.2 Erkenntnisse aus der Timeline

1. **RLS wurde unterschätzt:** Basis-Schema aktiviert RLS nur für 5 Tabellen
2. **Zirkelbezüge sind schwer zu debuggen:** 3 Iterationen für `fix-infinite-recursion`
3. **Keine Tests:** Sonst wäre Recursion sofort aufgefallen
4. **Migration zu Multi-User war chaotisch:** Community-Features wurden nachträglich reingebaut
5. **Security Definer Functions sind die Rettung:** Final fix für Recursion

### 6.3 Aktuelle Datenbank-Status (vermutlich)

**Problem:** Wir wissen nicht genau, welche Skripte tatsächlich in Production laufen!

**Mögliche Szenarien:**
- Szenario A: Nur [create-schema.sql](scripts/create-schema.sql) → RLS unvollständig
- Szenario B: [create-schema.sql](scripts/create-schema.sql) + einige Fix-Skripte → inkonsistent
- Szenario C: [create-schema.sql](scripts/create-schema.sql) + ALLE Fix-Skripte → überlappend

**Empfehlung:** Migrations-System einführen (siehe Abschnitt 8.2)

---

## 7. CODE QUALITY ISSUES

### 7.1 Fehlende Type-Safety

**Problem:** Queries sind nicht type-safe, Fehler fallen erst zur Runtime auf.

**Beispiel:**
```typescript
const { data: anlage } = await supabase
  .from('anlagen')
  .select('*')
  .single()

// TypeScript weiß nicht, dass 'anlage' diese Felder hat:
const kwp = anlage.leistung_kwp  // ← Kein IntelliSense, keine Validierung
```

**Lösung:** Supabase Type Generation
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

```typescript
import { Database } from '@/types/database'

type Anlage = Database['public']['Tables']['anlagen']['Row']

const { data: anlage } = await supabase
  .from('anlagen')
  .select('*')
  .single() as { data: Anlage | null }

const kwp = anlage?.leistung_kwp  // ← Type-safe! ✓
```

### 7.2 Fehlende Error Handling

Viele Queries haben keine oder minimale Error-Behandlung:

```typescript
// app/meine-anlage/page.tsx:14-21
const { data: anlage } = await supabase
  .from('anlagen')
  .select('*')
  .eq('mitglied_id', userId)
  .eq('aktiv', true)
  .order('erstellt_am', { ascending: false })
  .limit(1)
  .single()

if (!anlage) {
  return { anlage: null, monatsdaten: [] }  // ← Was wenn error !== null?
}
```

**Problem:** Unterscheidet nicht zwischen:
- Kein Ergebnis (legitim)
- Query-Fehler (RLS blockiert, Netzwerk-Fehler, etc.)

**Besserer Weg:**
```typescript
const { data: anlage, error } = await supabase
  .from('anlagen')
  .select('*')
  .eq('mitglied_id', userId)
  .eq('aktiv', true)
  .order('erstellt_am', { ascending: false })
  .limit(1)
  .single()

if (error) {
  console.error('Fehler beim Laden der Anlage:', error)
  // Logging, Monitoring, User-Feedback
  if (error.code === '42501') {
    // RLS Permission Denied
    return { error: 'Zugriff verweigert' }
  }
  return { error: 'Datenbankfehler' }
}

if (!anlage) {
  return { anlage: null, monatsdaten: [] }
}
```

### 7.3 Fehlende Tests

**Keine Tests gefunden für:**
- Auth-Flow (Login, Session, User-Daten laden)
- RLS Policies (werden nur manuell getestet)
- Multi-Anlage Szenarien
- Community Public Access

**Empfehlung:**
- Unit Tests für Helper-Functions ([lib/auth.ts](lib/auth.ts), [lib/community.ts](lib/community.ts))
- Integration Tests für API-Routes
- E2E Tests für kritische User-Flows

---

## 8. REFACTORING-PLAN

### 8.1 Kurzfristig (SOFORT)

#### Prio 1: RLS für alternative_investitionen aktivieren 🔴
```sql
-- Neue Migration: 08_fix_alternative_investitionen_rls.sql
ALTER TABLE alternative_investitionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alternative_investitionen_select" ON alternative_investitionen
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (mitglied_id = get_current_mitglied_id());

CREATE POLICY "alternative_investitionen_insert" ON alternative_investitionen
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (mitglied_id = get_current_mitglied_id());

CREATE POLICY "alternative_investitionen_update" ON alternative_investitionen
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (mitglied_id = get_current_mitglied_id());

CREATE POLICY "alternative_investitionen_delete" ON alternative_investitionen
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (mitglied_id = get_current_mitglied_id());

-- Helper Function (if not exists)
CREATE OR REPLACE FUNCTION get_current_mitglied_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM mitglieder WHERE email = auth.email() LIMIT 1;
$$;
```

#### Prio 2: RLS für investition_monatsdaten aktivieren 🔴
```sql
ALTER TABLE investition_monatsdaten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "investition_monatsdaten_select" ON investition_monatsdaten
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    investition_id IN (
      SELECT id FROM alternative_investitionen
      WHERE mitglied_id = get_current_mitglied_id()
    )
  );

-- Analog für INSERT, UPDATE, DELETE
```

#### Prio 3: AnlagenSelector Component erstellen 🟠
- Erstelle [components/AnlagenSelector.tsx](components/AnlagenSelector.tsx)
- Integriere in:
  1. [app/meine-anlage/page.tsx](app/meine-anlage/page.tsx)
  2. [app/eingabe/page.tsx](app/eingabe/page.tsx)
  3. [app/uebersicht/page.tsx](app/uebersicht/page.tsx)
  4. [app/auswertung/page.tsx](app/auswertung/page.tsx)

#### Prio 4: Dokumentation aktualisieren 🟢
- Schreibe README-AUTHENTICATION.md
- Schreibe README-RLS-POLICIES.md
- Dokumentiere Multi-Anlage Pattern

### 8.2 Mittelfristig (NÄCHSTE 2 WOCHEN)

#### 1. Migrations-System einführen
```bash
# Installiere Supabase CLI
npm install -g supabase

# Initialisiere Projekt
supabase init

# Bestehende Skripte zu Migrations konvertieren
mv scripts/create-schema.sql supabase/migrations/20260101000000_initial_schema.sql
mv migrations/01_add_anlage_id.sql supabase/migrations/20260102000000_add_anlage_id.sql
# etc.

# Neue Migrations erstellen
supabase migration new fix_rls_alternative_investitionen

# Migrations ausführen
supabase db push
```

#### 2. Type Generation aktivieren
```bash
# Types generieren
npx supabase gen types typescript --project-id YOUR_PROJECT > types/database.ts

# In package.json
"scripts": {
  "db:types": "npx supabase gen types typescript --project-id YOUR_PROJECT > types/database.ts"
}

# Vor jedem Dev-Start
npm run db:types && npm run dev
```

#### 3. Error Monitoring
```bash
npm install @sentry/nextjs

# sentry.client.config.ts, sentry.server.config.ts
# Logs für RLS-Errors, Auth-Failures, etc.
```

#### 4. Tests schreiben
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom

# tests/lib/auth.test.ts
# tests/lib/community.test.ts
# tests/components/AnlagenSelector.test.tsx
```

### 8.3 Langfristig (ROADMAP)

#### 1. Multi-Anlage Datenmodell verfeinern
- Entscheide: Investitionen **mit** oder **ohne** Anlagen-Zuordnung?
- Wenn MIT: Setze `anlage_id` als required
- Migration: Zuordne bestehende Investitionen

#### 2. Performance-Optimierung
- RLS Policy Performance messen (EXPLAIN ANALYZE)
- Materialized Views für Kennzahlen
- Caching-Strategy (Redis/Upstash)

#### 3. API Layer abstrahieren
- tRPC oder Next.js Server Actions für alle Daten-Zugriffe
- Keine direkten Supabase-Queries in Components

#### 4. Admin-Interface
- Tool zum Verwalten von Policies
- RLS-Testing Interface
- User-Impersonation für Support

---

## 9. ZUSAMMENFASSUNG & NÄCHSTE SCHRITTE

### 9.1 Die 3 Haupt-Probleme

1. **SINGLE-ANLAGE ANTIPATTERN** 🔴
   - User mit 2+ Anlagen sehen nur Daten der ersten
   - Fix: AnlagenSelector Component + URL-Parameter

2. **UNVOLLSTÄNDIGES RLS** 🔴
   - `alternative_investitionen` und andere Tabellen haben kein RLS
   - Fix: RLS aktivieren + Policies erstellen

3. **RLS-ZIRKELBEZÜGE** 🟠
   - Policies mit JOINs verursachen infinite recursion
   - Fix: Security Definer Functions (teilweise behoben)

### 9.2 Quick Wins (können heute umgesetzt werden)

1. ✅ RLS für `alternative_investitionen` aktivieren (30 min)
2. ✅ RLS für `investition_monatsdaten` aktivieren (30 min)
3. ✅ AnlagenSelector Component erstellen (2h)
4. ✅ Type Generation aktivieren (1h)

### 9.3 Priorisierte TODO-Liste

#### KRITISCH (diese Woche)
- [ ] RLS für `alternative_investitionen` aktivieren + testen
- [ ] RLS für `investition_monatsdaten` aktivieren + testen
- [ ] AnlagenSelector Component erstellen
- [ ] AnlagenSelector in 4 Hauptseiten integrieren
- [ ] Tests für Multi-Anlage Szenarien schreiben

#### HOCH (nächste 2 Wochen)
- [ ] Migrations-System einführen (Supabase CLI)
- [ ] Type Generation einrichten
- [ ] Error Monitoring (Sentry)
- [ ] RLS Policy Performance messen
- [ ] Dokumentation vervollständigen

#### MITTEL (nächster Monat)
- [ ] Entscheidung: Investitionen mit/ohne Anlagen-Zuordnung
- [ ] API Layer abstrahieren (tRPC/Server Actions)
- [ ] Admin-Interface für Policy-Management
- [ ] Performance-Optimierungen (Caching, Materialized Views)

#### NIEDRIG (langfristig)
- [ ] E2E Test Suite
- [ ] CI/CD Pipeline
- [ ] Monitoring Dashboard
- [ ] User Onboarding optimieren

### 9.4 Erfolgs-Metriken

**KPIs nach Refactoring:**
1. User mit 2 Anlagen kann zwischen Anlagen wechseln ✓
2. Alle Tabellen mit privaten Daten haben RLS ✓
3. Keine RLS infinite recursion errors ✓
4. Query-Fehlerrate < 0.1% ✓
5. Type-Safe Queries in allen Components ✓

---

## 10. ANHANG

### 10.1 Referenzen

**Dokumente:**
- [ANALYSE-AUTHENTIFIZIERUNG-BERECHTIGUNGEN.md](ANALYSE-AUTHENTIFIZIERUNG-BERECHTIGUNGEN.md) - Auth-System Analyse
- [FIX-ANLEITUNG.md](FIX-ANLEITUNG.md) - Sofort-Fix für Benutzername-Problem

**Kritische Code-Dateien:**
- [lib/auth.ts](lib/auth.ts) - Auth Helper Functions
- [lib/community.ts](lib/community.ts) - Community/Public Data Access
- [components/ConditionalLayout.tsx](components/ConditionalLayout.tsx) - Layout + User Loading
- [app/meine-anlage/page.tsx](app/meine-anlage/page.tsx) - Dashboard (Single-Anlage)
- [app/anlage/page.tsx](app/anlage/page.tsx) - Anlagen-Verwaltung (Multi-Anlage ✓)

**SQL-Skripte:**
- [scripts/create-schema.sql](scripts/create-schema.sql) - Basis-Schema
- [scripts/fix-infinite-recursion-final.sql](scripts/fix-infinite-recursion-final.sql) - Security Definer Functions
- [scripts/fix-all-rls-policies.sql](scripts/fix-all-rls-policies.sql) - RLS Policies (unvollständig)

### 10.2 Supabase RLS Dokumentation

**Offizielle Docs:**
- https://supabase.com/docs/guides/auth/row-level-security
- https://supabase.com/docs/guides/auth/managing-user-data

**Best Practices:**
- Policies so simpel wie möglich
- Keine JOINs auf RLS-aktivierte Tabellen in Policies
- Security Definer Functions für komplexe Queries
- Separate Policies für `authenticated` vs `anon`

### 10.3 Debugging Checkliste

Wenn RLS-Probleme auftreten:

```sql
-- 1. Prüfe RLS Status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 2. Zeige alle Policies
SELECT tablename, policyname, cmd, roles, qual::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 3. Teste als authenticated User
SET ROLE authenticated;
SET request.jwt.claims = '{"email": "user@example.com", "sub": "user-id"}';

SELECT * FROM mitglieder WHERE email = 'user@example.com';

-- 4. Reset
RESET ROLE;

-- 5. Prüfe ob Policy Recursion verursacht
EXPLAIN (ANALYZE, VERBOSE) SELECT * FROM anlagen LIMIT 1;
```

---

**Erstellt:** 2026-01-28
**Version:** 1.0
**Autor:** Claude Code - Struktur-Analyse
**Status:** Ready for Action
