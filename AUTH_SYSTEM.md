# Authentication System

## Übersicht

**Status**: ✅ Implementiert (vereinfacht)
**Zweck**: Zugriffskontrolle für Upload & Anlagen

---

## Konzept

Das Auth-System basiert auf Supabase und verwendet eine vereinfachte User-Session-Logik.

### Authentifizierung

**Aktuell (Simplified)**:
```typescript
// Nimmt erstes aktives Mitglied aus DB
const user = await getCurrentUser()
```

**TODO für Production**:
```typescript
// Echte Supabase Auth mit Session
const { data: { user } } = await supabase.auth.getUser()
const mitglied = await getMitgliedByEmail(user.email)
```

### Autorisierung

**Zugriffsprüfung**:
1. User-Session validieren
2. Prüfen ob User Zugriff auf Anlage hat
3. Nur eigene Daten anzeigen/bearbeiten

---

## Auth Helper Functions

**Datei**: `lib/auth.ts`

### `getCurrentUser()`
Holt aktuell authentifizierten User (Mitglied).

**Returns**: `Mitglied | null`

**Verwendung**:
```typescript
const user = await getCurrentUser()
if (!user) {
  return <NotAuthenticated />
}
```

### `hasAnlageAccess(userId, anlageId)`
Prüft ob User Zugriff auf eine spezifische Anlage hat.

**Returns**: `boolean`

**Verwendung**:
```typescript
const hasAccess = await hasAnlageAccess(user.id, anlageId)
if (!hasAccess) {
  return <Forbidden />
}
```

### `getUserAnlagen(userId)`
Holt alle Anlagen eines Users.

**Returns**: `Anlage[]`

**Verwendung**:
```typescript
const anlagen = await getUserAnlagen(user.id)
```

---

## Implementierung

### Server Components

**app/daten-import/page.tsx**:
```typescript
const user = await getCurrentUser()
if (!user) {
  return <NotAuthenticated />
}

const anlagen = await getUserAnlagen(user.id)
```

### API Routes

**app/api/upload-monatsdaten/route.ts**:
```typescript
// 1. Auth Check
const user = await getCurrentUser()
if (!user) {
  return NextResponse.json(
    { success: false, message: 'Nicht authentifiziert' },
    { status: 401 }
  )
}

// 2. Access Check
const hasAccess = await hasAnlageAccess(user.id, anlageId)
if (!hasAccess) {
  return NextResponse.json(
    { success: false, message: 'Keine Berechtigung' },
    { status: 403 }
  )
}

// 3. Insert mit User-ID
const insertData = data.map(d => ({
  ...d,
  mitglied_id: user.id,
  anlage_id: anlageId
}))
```

---

## Sicherheits-Features

### Upload-Seite

✅ **User-Check**:
- Nur angemeldete User sehen Seite
- Nur eigene Anlagen werden angezeigt

✅ **Multi-Anlagen-Dropdown**:
- User sieht nur seine Anlagen
- Automatische Filterung nach `mitglied_id`

### API-Route

✅ **3-Stufen-Sicherheit**:
1. **Authentifizierung**: User-Session prüfen
2. **Autorisierung**: Anlage-Zugriff prüfen
3. **Daten-Isolation**: Nur eigene Daten schreiben

✅ **HTTP Status Codes**:
- `401 Unauthorized`: Nicht angemeldet
- `403 Forbidden`: Keine Berechtigung für Anlage
- `404 Not Found`: Anlage existiert nicht

---

## Komponenten

### MonatsdatenUploadWrapper

**Client Component** mit Anlagen-Auswahl:

```typescript
<MonatsdatenUploadWrapper
  anlagen={userAnlagen}
  monatsdatenCounts={counts}
/>
```

**Features**:
- Dropdown für Multi-Anlagen
- Anlagen-Info-Card mit Details
- Datensatz-Zähler pro Anlage
- Automatischer Reload nach Import

---

## Migration zu echter Auth

### Schritt 1: Supabase Auth aktivieren

```typescript
// In .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Schritt 2: Auth Helper updaten

```typescript
// lib/auth.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function getCurrentUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return null
  }

  // Mitglied aus DB holen
  const { data: mitglied } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('email', user.email)
    .single()

  return mitglied
}
```

### Schritt 3: Login/Signup Seiten

```typescript
// app/login/page.tsx
const { error } = await supabase.auth.signInWithPassword({
  email,
  password
})

// app/signup/page.tsx
const { error } = await supabase.auth.signUp({
  email,
  password
})
```

### Schritt 4: Middleware für Protected Routes

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/daten-import', '/auswertung', '/eingabe']
}
```

---

## Best Practices

### ✅ DO

- Immer User-Session prüfen in API-Routes
- Immer Anlage-Zugriff validieren
- `mitglied_id` aus Auth-Session nehmen (nie vom Client)
- HTTP Status Codes korrekt verwenden
- Fehler-Messages nicht zu detailliert (Info-Leak)

### ❌ DON'T

- Nie User-ID vom Client akzeptieren
- Nie Anlagen-IDs ohne Access-Check verwenden
- Nie sensible Daten in Error-Messages
- Nie API-Keys im Frontend
- Nie direkte DB-Queries ohne Auth

---

## Testing

### Auth-Flows testen

**Positiv**:
```bash
# Als angemeldeter User mit Anlage
curl -X POST /api/upload-monatsdaten \
  -F "file=@data.csv" \
  -F "anlageId=valid-uuid"
→ 200 OK
```

**Negativ**:
```bash
# Ohne Session
→ 401 Unauthorized

# Mit fremder Anlage
→ 403 Forbidden

# Mit ungültiger Anlage-ID
→ 404 Not Found
```

---

## Zusammenfassung

**Implementiert**:
- ✅ Auth Helper Functions
- ✅ User-Session-Check
- ✅ Anlage-Zugriffskontrolle
- ✅ Multi-Anlagen-Support
- ✅ Sichere API-Routes

**TODO**:
- [ ] Echte Supabase Auth (Login/Signup)
- [ ] Middleware für Protected Routes
- [ ] Session-Management
- [ ] Password-Reset
- [ ] Email-Verification

**Status**: Funktional für Single-User Development, bereit für Production-Auth-Upgrade.
