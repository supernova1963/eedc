# Analyse: Authentifizierung & Berechtigungen

**Status:** 2026-01-28
**Problem:** Benutzername und E-Mail werden nicht mehr oben links in der Sidebar angezeigt

---

## 1. AKTUELLER AUFBAU

### 1.1 Authentifizierungs-Flow

#### Client-Side (Browser)
- **ConditionalLayout.tsx** (Zeile 30-56):
  - Lädt Benutzerdaten beim Mount via `useEffect`
  - Verwendet `createBrowserClient()` aus `@/lib/supabase-browser`
  - Holt Auth-User via `supabase.auth.getUser()`
  - **KRITISCHER PUNKT:** Query auf `mitglieder` Tabelle mit `.eq('email', user.email)`

```typescript
const { data: mitglied, error } = await supabase
  .from('mitglieder')
  .select('vorname, nachname')
  .eq('email', user.email)
  .single()
```

#### Server-Side
- **lib/auth.ts** - `getCurrentUser()`:
  - Verwendet `createClient()` aus `@/lib/supabase-server`
  - Holt Auth-User via `supabase.auth.getUser()`
  - Query auf `mitglieder` mit `.eq('email', user.email).eq('aktiv', true)`

### 1.2 Datenbank-Struktur

#### Tabellen-Beziehungen
```
auth.users (Supabase Auth)
    ↓ (email)
mitglieder (id, email, vorname, nachname, aktiv, ...)
    ↓ (mitglied_id → mitglieder.id)
anlagen (id, mitglied_id, ...)
    ↓ (anlage_id → anlagen.id)
anlagen_freigaben (anlage_id, profil_oeffentlich, ...)
monatsdaten (anlage_id, ...)
alternative_investitionen (mitglied_id, anlage_id, ...)
```

#### Wichtige Felder
- `mitglieder.email` - Verknüpfung zu `auth.users.email`
- `mitglieder.aktiv` - Boolean für aktive Mitglieder
- `anlagen.mitglied_id` - Foreign Key zu `mitglieder.id`
- `anlagen_freigaben.profil_oeffentlich` - Boolean für Community-Sichtbarkeit

---

## 2. RLS POLICIES - AKTUELLE SITUATION

### 2.1 Problem: Infinite Recursion & Zirkelbezüge

Basierend auf den SQL-Skripten in `/scripts/`:

#### Ursprüngliche Policy (PROBLEMATISCH):
```sql
-- mitglieder_select: Kann eigene Daten sehen
CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    -- User kann eigene Daten sehen
    email = auth.email()
    OR
    -- ODER: User kann Mitglieder sehen, deren Anlagen öffentlich sind
    id IN (
      SELECT mitglied_id FROM anlagen  -- ← ZIRKELBEZUG!
      WHERE id IN (
        SELECT anlage_id FROM anlagen_freigaben
        WHERE profil_oeffentlich = true
      )
    )
  );

-- anlagen_select: Kann eigene + öffentliche Anlagen sehen
CREATE POLICY "anlagen_select" ON anlagen
  FOR SELECT
  USING (
    -- Öffentliche Anlagen
    id IN (
      SELECT anlage_id FROM anlagen_freigaben
      WHERE profil_oeffentlich = true
    )
    OR
    -- ODER: Eigene Anlagen
    mitglied_id IN (
      SELECT id FROM mitglieder  -- ← ZIRKELBEZUG!
      WHERE email = auth.email()
    )
  );
```

**Problem:**
- `mitglieder_select` macht Subquery auf `anlagen`
- `anlagen_select` macht Subquery auf `mitglieder`
- → **Infinite Recursion Loop!**

### 2.2 Fix-Versuche (chronologisch)

Die Skripte zeigen mehrere Iterationen:

1. **fix-infinite-recursion.sql**: Vereinfachte `mitglieder_select` auf nur `email = auth.email()`
2. **fix-infinite-recursion-v2.sql**: Weitere Anpassungen
3. **fix-infinite-recursion-final.sql**:
   - **Finale Policy:** `mitglieder_select` → nur `email = auth.email()`
   - **Neue Security Definer Function:** `get_public_anlagen_with_members()` für Community-Daten
4. **fix-auth-access-v3.sql**: Erweiterte Policy um Service Role Access:
   ```sql
   USING (
     auth.jwt() IS NULL  -- ← Service Role
     OR
     (auth.uid() IS NOT NULL AND email = auth.email())
   )
   ```

### 2.3 Aktuelle Policies (basierend auf letzten Fixes)

#### mitglieder
```sql
CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    auth.jwt() IS NULL  -- Service Role (Server-side)
    OR
    (auth.uid() IS NOT NULL AND email = auth.email())  -- Authenticated User
  );
```

**→ HIER IST DAS PROBLEM!**
- Die Policy erlaubt Service Role (`auth.jwt() IS NULL`)
- **ABER:** Client-Side Queries (ConditionalLayout.tsx) nutzen NICHT Service Role!
- Client-Side nutzt `SUPABASE_ANON_KEY` → `auth.jwt()` ist NICHT NULL!
- Die Query schlägt fehl, weil `email = auth.email()` nicht matched (warum?)

#### anlagen
```sql
CREATE POLICY "anlagen_select" ON anlagen
  FOR SELECT
  USING (
    id IN (
      SELECT anlage_id FROM anlagen_freigaben
      WHERE profil_oeffentlich = true
    )
    OR
    (auth.uid() IS NOT NULL AND mitglied_id IN (
      SELECT id FROM mitglieder WHERE email = auth.email()
    ))
  );
```

---

## 3. DATENABFRAGEN IM CODE

### 3.1 Queries auf `mitglieder` Tabelle

Gefunden in 13 Dateien:

1. **components/ConditionalLayout.tsx** (Zeile 39-43) ← **HIER FEHLT ES!**
   - Browser Client
   - Query: `.from('mitglieder').select('vorname, nachname').eq('email', user.email).single()`

2. **lib/auth.ts** (Zeile 34-39)
   - Server Client
   - Query: `.from('mitglieder').select('*').eq('email', user.email).eq('aktiv', true).single()`

3. **lib/auth-actions.ts** - Login/Register Actions
4. **components/MonatsdatenForm.tsx** - Dropdown für Mitgliederauswahl
5. **app/stammdaten/...** - Verschiedene Stammdaten-Seiten
6. **app/investitionen/...** - Investitions-Management
7. **app/anlage/page.tsx** - Anlagenübersicht

### 3.2 Queries auf `anlagen` Tabelle

Ebenfalls in vielen Dateien - teilweise mit Joins auf `mitglieder`:
- Dashboard-Seiten
- Auswertungs-Seiten
- Stammdaten-Verwaltung

### 3.3 Community-Queries (öffentlich)

Basierend auf `fix-infinite-recursion-final.sql` sollten diese die Security Definer Function nutzen:
```typescript
supabase.rpc('get_public_anlagen_with_members')
```

---

## 4. ROOT CAUSE ANALYSE

### 4.1 Warum funktioniert die Anzeige nicht mehr?

**Vermutung #1: RLS Policy blockiert Client-Side Query**
```
ConditionalLayout.tsx → Browser Client → ANON_KEY
  ↓
Query: mitglieder WHERE email = auth.email()
  ↓
RLS Policy: auth.jwt() IS NULL OR (auth.uid() IS NOT NULL AND email = auth.email())
  ↓
Problem: auth.email() liefert möglicherweise andere Email als user.email?
  oder: RLS blockiert grundsätzlich?
```

**Vermutung #2: Auth Session Problem**
- `supabase.auth.getUser()` gibt User zurück
- ABER: `auth.email()` in RLS Policy gibt anderen/keinen Wert zurück
- Mögliche Ursache: Cookie/Session nicht korrekt gesetzt

**Vermutung #3: Timing Problem**
- User ist noch nicht vollständig authentifiziert wenn Query ausgeführt wird
- `useEffect` läuft zu früh

### 4.2 Warum hat es mal funktioniert?

Wahrscheinlich hatten Sie früher eine "zu permissive" Policy, z.B.:
```sql
-- Alte, unsichere aber funktionierende Policy
CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT TO authenticated
  USING (true);  -- ← Alles erlaubt!
```

Beim Versuch, die Policies sicherer zu machen, wurde der Zugriff zu restriktiv.

---

## 5. WEITERE PROBLEME IN DER ARCHITEKTUR

### 5.1 Inkonsistente Datenabfrage

**Problem:** Verschiedene Patterns für gleiche Daten
- ConditionalLayout: Browser Client, direkter Query
- lib/auth: Server Client, getCurrentUser() Helper
- Andere Seiten: Mix aus beiden

**Empfehlung:** Einheitliches Pattern!

### 5.2 Fehlende Typisierung

- Keine zentrale `types/database.ts` mit Supabase Generated Types
- Queries sind nicht type-safe
- Fehler fallen erst zur Runtime auf

### 5.3 User-Daten mehrfach geladen

- ConditionalLayout lädt Mitgliedsdaten
- AppLayout bekommt Props
- ModernSidebar bekommt Props
- → Keine zentrale State-Management Lösung (kein Context)

### 5.4 Community Features vermischt

**Aktuell:**
- Community-Routen sind PUBLIC (ohne Auth)
- Private Routen sind AUTH REQUIRED
- ABER: Gleiche Komponenten, verschiedene Data Queries

**Problem:**
- Wenn User eingeloggt ist UND Community besucht, funktioniert beides?
- Security Definer Function wird nicht genutzt

### 5.5 RLS zu komplex

**Probleme:**
1. Zirkelbezüge zwischen Tabellen
2. Subqueries in Subqueries
3. Policies ändern sich häufig (siehe 10+ fix-*.sql Skripte)
4. Keine klare Trennung: "Private Auth" vs "Public Community"

---

## 6. LÖSUNGSVORSCHLAG

### 6.1 Sofort-Fix: Benutzername/E-Mail Anzeige

**Option A: Policy lockern (TEMPORÄR)**
```sql
-- Temporäre permissive Policy für mitglieder
DROP POLICY IF EXISTS "mitglieder_select" ON mitglieder;

CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT TO authenticated
  USING (
    -- Eigene Daten
    email = auth.email()
  );

-- Explizite Policy für anonymous (Community)
CREATE POLICY "mitglieder_select_anon" ON mitglieder
  FOR SELECT TO anon
  USING (
    -- Nur öffentliche Profile (via anlagen_freigaben)
    id IN (
      SELECT DISTINCT a.mitglied_id
      FROM anlagen a
      INNER JOIN anlagen_freigaben af ON af.anlage_id = a.id
      WHERE af.profil_oeffentlich = true
    )
  );
```

**Option B: Debug Query in ConditionalLayout**
```typescript
// In ConditionalLayout.tsx nach Zeile 33
console.log('Auth User:', user.id, user.email)

const { data: mitglied, error } = await supabase
  .from('mitglieder')
  .select('vorname, nachname')
  .eq('email', user.email)
  .single()

console.log('Mitglied Query:', { mitglied, error })

// Prüfe auch: Ist Mitglied aktiv?
// Prüfe: Stimmt Email genau überein? (case-sensitive!)
```

**Option C: Server-Side laden** (EMPFOHLEN)
```typescript
// ConditionalLayout.tsx als Server Component
// ODER: Lade Daten via Server Action
import { getCurrentUser } from '@/lib/auth'

export default async function ConditionalLayout({ children }) {
  const mitglied = await getCurrentUser()

  return (
    <ConditionalLayoutClient
      userName={mitglied ? `${mitglied.vorname} ${mitglied.nachname}` : undefined}
      userEmail={mitglied?.email}
    >
      {children}
    </ConditionalLayoutClient>
  )
}
```

### 6.2 Strukturelle Verbesserungen

#### A) Saubere Trennung: Auth vs Public

**Neue Policy-Struktur:**
```sql
-- PRIVATE: Nur eigene Daten für authentifizierte User
CREATE POLICY "mitglieder_private" ON mitglieder
  FOR SELECT TO authenticated
  USING (email = auth.email());

-- PUBLIC: Community-Daten für alle (auch anonymous)
CREATE POLICY "mitglieder_public" ON mitglieder
  FOR SELECT TO anon
  USING (
    -- Nutze Security Definer Function für Performance
    -- ODER: Simple Join ohne Zirkelbezug
    id IN (
      SELECT DISTINCT mitglied_id
      FROM anlagen a
      WHERE EXISTS (
        SELECT 1 FROM anlagen_freigaben af
        WHERE af.anlage_id = a.id
          AND af.profil_oeffentlich = true
      )
    )
  );
```

#### B) Zentrale User Context

```typescript
// context/UserContext.tsx
'use client'

export const UserProvider = ({ children, initialUser }) => {
  const [user, setUser] = useState(initialUser)

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}

// In Root Layout
export default async function RootLayout({ children }) {
  const mitglied = await getCurrentUser()

  return (
    <html>
      <body>
        <UserProvider initialUser={mitglied}>
          <ConditionalLayout>{children}</ConditionalLayout>
        </UserProvider>
      </body>
    </html>
  )
}
```

#### C) Typisierung mit Supabase CLI

```bash
# Generiere Types aus Datenbank
npx supabase gen types typescript --project-id "$PROJECT_REF" > types/database.ts
```

```typescript
import { Database } from '@/types/database'

type Mitglied = Database['public']['Tables']['mitglieder']['Row']
```

#### D) Vereinfachte RLS

**Prinzipien:**
1. **KEINE Zirkelbezüge** zwischen Tabellen
2. **KEINE Subqueries in Policies** wo möglich
3. **Security Definer Functions** für komplexe Queries
4. **Separate Policies** für `authenticated` vs `anon`

**Beispiel:**
```sql
-- Einfache Policy ohne Subquery
CREATE POLICY "anlagen_private" ON anlagen
  FOR SELECT TO authenticated
  USING (
    -- Nutze helper function
    mitglied_id = get_current_mitglied_id()
  );

-- Helper Function
CREATE OR REPLACE FUNCTION get_current_mitglied_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id FROM mitglieder WHERE email = auth.email() LIMIT 1;
$$;
```

---

## 7. EMPFOHLENES VORGEHEN

### Phase 1: Diagnose & Sofort-Fix (JETZT)
1. ✅ Debug-Logging in ConditionalLayout.tsx hinzufügen
2. ✅ Prüfe: Kommt `mitglied` zurück? Was ist `error`?
3. ✅ Prüfe: Ist User authentifiziert? (`user.id`, `user.email`)
4. ✅ Temporäre Policy-Lockerung für `mitglieder_select`
5. ✅ Teste: Erscheint Name/E-Mail wieder?

### Phase 2: Strukturelle Fixes (NÄCHSTE SCHRITTE)
1. ⬜ Migration zu Server-Side User Loading (Root Layout)
2. ⬜ User Context implementieren
3. ⬜ Policies vereinfachen (siehe 6.2D)
4. ⬜ Security Definer Functions für Community
5. ⬜ Tests schreiben für Auth-Flow

### Phase 3: Langfristig (SPÄTER)
1. ⬜ Supabase Type Generation einrichten
2. ⬜ Zentrales Data Loading Pattern (tRPC/Server Actions)
3. ⬜ Monitoring & Error Tracking für Auth
4. ⬜ Performance Optimierung (Caching)

---

## 8. KRITISCHE PUNKTE - NICHT ÜBERSEHEN!

### ⚠️ RLS Bypass für Service Role
Die `auth.jwt() IS NULL` Prüfung ist GEFÄHRLICH wenn:
- Sie Service Role Key im Frontend nutzen (NIEMALS!)
- Policies zu permissiv werden

### ⚠️ E-Mail Case Sensitivity
- PostgreSQL: E-Mail Vergleiche sind case-sensitive
- Supabase Auth: E-Mails werden normalisiert
- → Prüfen: `LOWER(email) = LOWER(auth.email())`?

### ⚠️ aktiv Flag
- Viele Queries prüfen `.eq('aktiv', true)`
- Wenn Mitglied auf `aktiv = false` gesetzt → kein Zugriff!
- Prüfe in DB: `SELECT email, aktiv FROM mitglieder;`

### ⚠️ Community Features = Security Risk
- Öffentliche Anlagen müssen sorgfältig gefiltert werden
- Nicht versehentlich private Daten leaken!
- Policies für `anon` strikt halten

---

## 9. DEBUGGING CHECKLISTE

Wenn Benutzername/E-Mail nicht angezeigt wird:

```typescript
// In ConditionalLayout.tsx
useEffect(() => {
  const loadUser = async () => {
    const supabase = createBrowserClient()

    // 1. Prüfe Auth Session
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Session:', session)

    // 2. Prüfe Auth User
    const { data: { user } } = await supabase.auth.getUser()
    console.log('User:', user)

    if (!user) {
      console.error('Kein User - nicht eingeloggt!')
      return
    }

    // 3. Prüfe Mitglied Query
    const { data: mitglied, error } = await supabase
      .from('mitglieder')
      .select('id, vorname, nachname, email, aktiv')
      .eq('email', user.email)
      .single()

    console.log('Mitglied Query Result:', { mitglied, error })

    // 4. Prüfe RLS (mit explizitem User)
    const { data: mitgliedAlt, error: errorAlt } = await supabase
      .from('mitglieder')
      .select('*')
      .eq('email', user.email)

    console.log('Mitglied ohne .single():', { mitgliedAlt, errorAlt })

    // 5. Test: Alle Mitglieder (funktioniert nur wenn Policy zu offen)
    const { data: alle, error: alleError } = await supabase
      .from('mitglieder')
      .select('id, email')

    console.log('Alle Mitglieder:', { alle, alleError })
  }

  loadUser()
}, [])
```

**Erwartete Console Outputs:**
- ✅ Session: `{ access_token: "...", user: {...} }`
- ✅ User: `{ id: "...", email: "user@example.com" }`
- ✅ Mitglied Query Result: `{ mitglied: { vorname: "...", nachname: "..." }, error: null }`

**Fehlerfall:**
- ❌ `error: { code: "PGRST116", message: "The result contains 0 rows" }` → User existiert nicht in `mitglieder`
- ❌ `error: { code: "42501", message: "permission denied" }` → RLS blockiert Query
- ❌ `mitglied: null, error: null` → Query erfolgreich aber leer (E-Mail stimmt nicht überein?)

---

## 10. NÄCHSTE SCHRITTE

**Jetzt sofort:**
1. Debug-Logging in ConditionalLayout einbauen
2. Console Output prüfen
3. Basierend auf Output: Entweder Policy anpassen ODER User-Daten in DB prüfen

**Danach:**
1. Dokumentation finalisieren
2. Optimierte RLS Policies ausrollen
3. Tests für Auth-Flow schreiben

---

**Erstellt:** 2026-01-28
**Autor:** Claude Code Analyse
**Status:** Vorläufig - Benötigt Console Output für finale Diagnose
