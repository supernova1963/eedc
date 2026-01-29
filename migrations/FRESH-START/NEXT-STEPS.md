# FRESH-START: Nächste Schritte

## ✅ Was bereits erledigt ist:

1. ✅ **FRESH-START Schema deployed** in Supabase
   - Alle Tabellen mit Freigaben-Spalten in `anlagen`
   - RLS Policies aktiv
   - Community Functions erstellt

2. ✅ **Code angepasst**
   - lib/freigabe-actions.ts
   - lib/anlage-actions.ts
   - app/api/anlagen/route.ts
   - app/anlage/page.tsx
   - lib/community.ts

3. ✅ **Committed** (Commit: 1d56d04)

## 📋 Was jetzt zu tun ist:

### 1. TypeScript Types generieren

Die Supabase CLI kann automatisch TypeScript-Typen aus deinem Schema generieren.

**Option A: Mit Supabase CLI (empfohlen)**

```bash
# Falls noch nicht installiert:
npm install -g supabase

# Project ID aus Supabase Dashboard holen
# Settings → General → Reference ID

# Types generieren
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

**Option B: Manuell aus Supabase Dashboard**

1. Öffne Supabase Dashboard
2. Gehe zu **API Docs** → **Types**
3. Kopiere die generierten TypeScript-Typen
4. Erstelle Datei `types/database.ts`
5. Füge die Typen ein

**Nach der Generierung:**

Die neue `types/database.ts` enthält alle Tabellen-Definitionen:
- `Database['public']['Tables']['anlagen']['Row']` - mit Freigaben-Spalten
- `Database['public']['Functions']['get_public_anlagen']` - Return Types
- etc.

### 2. Types in Code verwenden

Aktualisiere `lib/database.ts` (falls vorhanden) oder erstelle es:

```typescript
// lib/database.ts
import { Database } from '@/types/database'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Anlage = Tables<'anlagen'>
export type Mitglied = Tables<'mitglieder'>
export type Monatsdaten = Tables<'monatsdaten'>
export type AnlagenKomponente = Tables<'anlagen_komponenten'>
export type HaushaltKomponente = Tables<'haushalt_komponenten'>
```

### 3. Manuelles Testing

**Test-Checklist:**

#### A. Anlage erstellen
- [ ] Navigiere zu `/meine-anlage`
- [ ] Klicke auf "Neue Anlage erstellen"
- [ ] Fülle alle Felder aus
- [ ] Speichern
- [ ] **Erwartung:** Anlage wird erstellt mit `oeffentlich = false`

#### B. Freigaben ändern
- [ ] Öffne Anlage-Profil
- [ ] Wechsel zu Tab "Freigaben"
- [ ] Aktiviere "Profil öffentlich" (= `oeffentlich = true`)
- [ ] Aktiviere "Monatsdaten öffentlich"
- [ ] Speichern
- [ ] **Erwartung:** Update in `anlagen` Tabelle, keine Fehler

#### C. Community-Ansicht
- [ ] Öffne `/community` (oder öffentliche Ansicht)
- [ ] **Erwartung:** Deine öffentliche Anlage erscheint
- [ ] Klicke auf die Anlage
- [ ] **Erwartung:** Details werden angezeigt

#### D. Datenbank-Verifizierung
Öffne Supabase SQL Editor und führe aus:

```sql
-- Prüfe ob anlagen Freigaben-Spalten hat
SELECT
  anlagenname,
  oeffentlich,
  kennzahlen_oeffentlich,
  monatsdaten_oeffentlich,
  komponenten_oeffentlich,
  standort_genau_anzeigen
FROM anlagen
LIMIT 5;
```

**Erwartung:** Alle Spalten existieren mit boolean-Werten

```sql
-- Prüfe ob alte Tabelle weg ist
SELECT * FROM anlagen_freigaben LIMIT 1;
```

**Erwartung:** Fehler "relation anlagen_freigaben does not exist"

```sql
-- Teste Community Function
SELECT * FROM get_public_anlagen();
```

**Erwartung:** Gibt öffentliche Anlagen zurück (wenn `oeffentlich = true`)

#### E. RLS-Verifizierung

```sql
-- Als Anonymous User
SET ROLE anon;
SELECT * FROM anlagen WHERE oeffentlich = false;
-- Erwartung: 0 rows (private Anlagen unsichtbar)

SELECT * FROM anlagen WHERE oeffentlich = true;
-- Erwartung: Öffentliche Anlagen sichtbar

RESET ROLE;
```

### 4. Bekannte Probleme / Edge Cases

**Problem 1: Alte Komponente `AnlagenFreigabeForm` erwartet altes Format**
- **Status:** Gelöst durch Mapping in `getAnlageFreigaben()`
- **Später:** Form-Komponente auf neue Spalten-Namen umstellen

**Problem 2: `investitionen_oeffentlich` → `komponenten_oeffentlich`**
- **Status:** Mapping in Code vorhanden
- **Später:** Forms und Interfaces auf neue Namen umstellen

**Problem 3: TypeScript-Fehler wegen fehlender Types**
- **Lösung:** Types generieren (Schritt 1)

### 5. Nächste Iterationen (später)

#### Phase 3: UI-Komponenten anpassen
- [ ] `AnlagenFreigabeForm` auf neue Spalten-Namen umstellen
- [ ] `AnlagenProfilForm` prüfen
- [ ] Community-Seiten testen

#### Phase 4: Alte Migration-Skripte aufräumen
- [ ] `migrations/FRESH-START/04_community_functions.sql` (alte Version) entfernen
- [ ] `migrations/FRESH-START/04_community_functions_CURRENT_SCHEMA.sql` entfernen
- [ ] `migrations/FRESH-START/04_community_functions_DROP_FIRST.sql` entfernen

#### Phase 5: Dokumentation
- [ ] ARCHITECTURE_AUTH_SYSTEM.md aktualisieren
- [ ] API Docs aktualisieren

---

## 🐛 Troubleshooting

### Fehler: "column anlagen.oeffentlich does not exist"
**Ursache:** Schema nicht deployed
**Lösung:** `01_core_schema.sql` nochmal ausführen

### Fehler: "relation anlagen_freigaben does not exist"
**Ursache:** Code referenziert noch alte Tabelle
**Lösung:** Prüfe ob alle Code-Anpassungen committed sind

### Fehler: "function get_public_anlagen() does not exist"
**Ursache:** Community Functions nicht deployed
**Lösung:** `04_community_functions_FRESH_START.sql` ausführen

### Community-Seite zeigt keine Anlagen
**Mögliche Ursachen:**
1. Keine Anlage hat `oeffentlich = true`
2. RLS Policy blockiert Zugriff
3. Community Function fehlt

**Debug:**
```sql
-- Prüfe ob öffentliche Anlagen existieren
SELECT COUNT(*) FROM anlagen WHERE oeffentlich = true;

-- Teste Function direkt
SELECT * FROM get_public_anlagen();
```

---

**Erstellt:** 2026-01-29
**Letztes Update:** Nach FRESH-START Deployment
**Status:** 🟢 READY FOR TESTING
