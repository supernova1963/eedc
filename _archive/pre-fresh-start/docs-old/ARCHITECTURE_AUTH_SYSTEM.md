# 🔐 EEDC Authentication System - Vollständige Architektur-Dokumentation

## 📋 Übersicht

Das EEDC Authentication System verwendet **zwei separate ID-Systeme**:
- `auth.users.id` (Supabase Auth UUID)
- `mitglieder.id` (PostgreSQL auto-generierte UUID)

**Verknüpfung erfolgt über EMAIL (unique constraint)**

---

## 🏗️ Architektur-Prinzipien

### Warum zwei verschiedene IDs?

1. **Trennung von Concerns:**
   - `auth.users` = Supabase Auth-System (Login, Sessions, Passwörter)
   - `mitglieder` = Anwendungs-Daten (Vorname, Nachname, Ort, etc.)

2. **Flexibilität:**
   - Auth-Provider könnte theoretisch gewechselt werden
   - Mitgliederdaten bleiben unabhängig von Auth-System

3. **RLS-Policies:**
   - Policies nutzen `email` als Lookup-Key
   - Vermeidet komplexe Subqueries auf `auth.users`

---

## 🔄 Registrierungs-Flow

### Code: `lib/auth-actions.ts`

```typescript
export async function signUp(formData) {
  const supabase = await createClient()

  // 1. Erstelle Auth User in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  })
  // → Erzeugt auth.users Eintrag mit UUID (z.B. 73a09b51-...)

  // 2. Erstelle Mitglied in der Datenbank
  const insertData = {
    // KEIN id-Feld! → PostgreSQL generiert automatisch UUID
    email: formData.email,       // ← Verknüpfung zu auth.users
    vorname: formData.vorname,
    nachname: formData.nachname,
    plz: formData.plz || null,
    ort: formData.ort || null,
    aktiv: true,
  }

  await supabase
    .from('mitglieder')
    .upsert(insertData, {
      onConflict: 'email',  // ← Email ist unique constraint
      ignoreDuplicates: false
    })
}
```

### Ergebnis:

| Tabelle | ID | Email |
|---------|-----|-------|
| `auth.users` | `73a09b51-3d23-4149-bbad-1e2732ef0339` | `user@example.com` |
| `mitglieder` | `a1b2c3d4-5678-90ab-cdef-1234567890ab` | `user@example.com` |

**⚠️ IDs sind unterschiedlich! Verknüpfung über EMAIL!**

---

## 🔍 Lookup-Pattern: User-Daten abrufen

### ✅ RICHTIG: Lookup per EMAIL

```typescript
// lib/auth.ts
export async function getCurrentUser(): Promise<Mitglied | null> {
  const supabase = await createClient()

  // 1. Hole Auth Session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 2. Hole Mitgliedsdaten per EMAIL
  const { data } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('email', user.email)  // ← EMAIL-basierter Lookup
    .eq('aktiv', true)
    .single()

  return data
}
```

### ❌ FALSCH: Lookup per ID

```typescript
// FUNKTIONIERT NICHT!
const { data } = await supabase
  .from('mitglieder')
  .select('*')
  .eq('id', user.id)  // ← user.id ist auth.users.id, nicht mitglieder.id!
  .single()
```

---

## 🛡️ RLS (Row Level Security) Policies

### Problem: Alte Policies blockieren Email-basierten Zugriff

**Alte Policy (FALSCH):**
```sql
CREATE POLICY "Users can view own data" ON mitglieder
  FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE email = mitglieder.email)
  );
```
→ Komplexer Subquery, langsam

**Neue Policy (RICHTIG):**
```sql
CREATE POLICY "mitglieder_select" ON mitglieder
  FOR SELECT
  USING (
    -- Eigene Daten (für eingeloggte User)
    (auth.uid() IS NOT NULL AND email = auth.email())
    OR
    -- Öffentliche Daten (wenn Anlage öffentlich)
    EXISTS (
      SELECT 1
      FROM anlagen a
      JOIN anlagen_freigaben af ON af.anlage_id = a.id
      WHERE a.mitglied_id = mitglieder.id
        AND af.profil_oeffentlich = true
    )
  );
```

### Warum funktioniert `email = auth.email()`?

- `auth.email()` gibt die E-Mail des aktuell eingeloggten Users zurück
- Direkter Vergleich: `mitglieder.email = 'user@example.com'`
- Schnell und einfach!

---

## 📍 Verwendung in der gesamten Codebase

### Server Components (Next.js App Router)

```typescript
// app/*/page.tsx
import { getCurrentUser } from '@/lib/auth'

export default async function SomePage() {
  const user = await getCurrentUser()

  if (!user) {
    return <div>Nicht authentifiziert</div>
  }

  // user.id ist jetzt mitglieder.id (nicht auth.users.id!)
  // user.email, user.vorname, user.nachname sind verfügbar
}
```

### Client Components

```typescript
// components/ConditionalLayout.tsx
'use client'

const { data: { user } } = await supabase.auth.getUser()

if (user) {
  // user.id ist auth.users.id
  // user.email ist verfügbar

  // Lookup per EMAIL
  const { data: mitglied } = await supabase
    .from('mitglieder')
    .select('vorname, nachname')
    .eq('email', user.email)  // ← EMAIL!
    .single()

  setUserName(`${mitglied.vorname} ${mitglied.nachname}`)
}
```

---

## 🗄️ Datenbank-Schema

### auth.users (Supabase Auth)
```sql
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  encrypted_password text,
  -- ... weitere Auth-Felder
);
```

### mitglieder (Anwendungsdaten)
```sql
CREATE TABLE public.mitglieder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,  -- ← Verknüpfung zu auth.users.email
  vorname text NOT NULL,
  nachname text NOT NULL,
  plz text,
  ort text,
  aktiv boolean DEFAULT true,
  erstellt_am timestamptz DEFAULT now()
);

-- Index für schnelle Lookups
CREATE INDEX idx_mitglieder_email ON mitglieder(email);
```

### anlagen (Zuordnung zu Mitgliedern)
```sql
CREATE TABLE public.anlagen (
  id uuid PRIMARY KEY,
  mitglied_id uuid NOT NULL,  -- ← Verweist auf mitglieder.id (NICHT auth.users.id!)
  anlagenname text NOT NULL,
  -- ... weitere Felder
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(id)
);
```

---

## 🔧 Häufige Fehlerquellen

### 1. ❌ Verwendung von `user.id` für Mitglieder-Lookup

**Problem:**
```typescript
const { data: mitglied } = await supabase
  .from('mitglieder')
  .select('*')
  .eq('id', user.id)  // ← FALSCH! user.id ist auth.users.id
  .single()
```

**Lösung:**
```typescript
const { data: mitglied } = await supabase
  .from('mitglieder')
  .select('*')
  .eq('email', user.email)  // ← RICHTIG! Email als Lookup
  .single()
```

### 2. ❌ RLS-Policy blockiert Zugriff

**Symptom:** 500 Error bei Mitglieder-Abfrage

**Ursache:** Alte restriktive RLS-Policy

**Lösung:** Führe `scripts/fix-community-public-access.sql` aus

### 3. ❌ "Nicht authentifiziert" nach Login

**Ursache:** `getCurrentUser()` gibt `null` zurück weil RLS blockiert

**Lösung:** Siehe #2

---

## 📊 Datenfluss-Diagramm

```
┌─────────────────────────────────────────────────────────┐
│                    REGISTRATION                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
            ┌──────────────────────────┐
            │   supabase.auth.signUp   │
            │   Email: user@email.com  │
            │   Password: ********     │
            └──────────────────────────┘
                           │
            ┌──────────────┴───────────────┐
            ↓                              ↓
    ┌──────────────┐              ┌──────────────┐
    │ auth.users   │              │  mitglieder  │
    │              │              │              │
    │ id: UUID-A   │              │ id: UUID-B   │
    │ email: ✓     │←────────────→│ email: ✓     │
    └──────────────┘  (linked by  └──────────────┘
                         email)

┌─────────────────────────────────────────────────────────┐
│                    LOGIN / LOOKUP                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
            ┌──────────────────────────┐
            │   supabase.auth.getUser  │
            │   Returns: auth.users    │
            └──────────────────────────┘
                           │
                           ↓
            ┌──────────────────────────┐
            │  Query mitglieder        │
            │  WHERE email = ?         │
            └──────────────────────────┘
                           │
                           ↓
            ┌──────────────────────────┐
            │  Returns: mitglieder     │
            │  (mit id: UUID-B)        │
            └──────────────────────────┘
```

---

## ✅ Checkliste: Korrekte Implementation

- [ ] Registrierung erstellt **KEIN** `id`-Feld in `mitglieder`
- [ ] Alle Lookups verwenden `.eq('email', user.email)`
- [ ] `getCurrentUser()` sucht per EMAIL
- [ ] RLS-Policies erlauben `email = auth.email()`
- [ ] Foreign Keys in `anlagen` verweisen auf `mitglieder.id` (nicht `auth.users.id`)
- [ ] Client-Components nutzen EMAIL-basierte Lookups

---

## 🚀 Migration: Von ID-basiert zu Email-basiert

Falls bestehende Daten mit falschen IDs existieren:

```sql
-- 1. Prüfe Inkonsistenzen
SELECT
  m.id as mitglied_id,
  m.email,
  u.id as auth_user_id
FROM mitglieder m
LEFT JOIN auth.users u ON u.email = m.email
WHERE m.id != u.id;

-- 2. Falls Daten vorhanden: Lookup muss über EMAIL erfolgen
-- Keine ID-Sync nötig! Das System funktioniert mit EMAIL-Lookup.
```

---

## 📚 Referenzen

- `lib/auth-actions.ts` - Registrierung/Login
- `lib/auth.ts` - getCurrentUser() Helper
- `components/ConditionalLayout.tsx` - Client-seitiger Lookup
- `scripts/fix-community-public-access.sql` - RLS-Policy Fix
- `scripts/debug-auth-problem.sql` - Diagnose-Tool

---

**Erstellt:** 2026-01-27
**Version:** 1.0
**Status:** ✅ Produktionsreif
