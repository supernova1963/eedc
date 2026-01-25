# Authentication Setup Guide

## Übersicht

Das EEDC WebApp Projekt verwendet jetzt **echte Supabase Authentication** mit Session-Management.

## Was wurde implementiert

### 1. Server & Client Components

- **`lib/supabase-server.ts`**: Server-side Supabase Client mit Cookie-basierter Auth
- **`lib/supabase-browser.ts`**: Browser-side Supabase Client
- **`lib/auth.ts`**: Aktualisiert mit echter Supabase Auth (getCurrentUser, getAuthUser)
- **`lib/auth-actions.ts`**: Server Actions für Login, Logout, Registrierung

### 2. UI-Komponenten

- **`app/login/page.tsx`**: Login-Seite mit E-Mail & Passwort
- **`app/register/page.tsx`**: Registrierungs-Seite mit Mitgliedsdaten
- **`middleware.ts`**: Route Protection (alle Seiten außer /login und /register sind geschützt)
- **`components/Sidebar.tsx`**: Logout-Button hinzugefügt

### 3. Routing & Security

- Alle Routen sind standardmäßig **geschützt** (außer `/login` und `/register`)
- Automatischer Redirect zu `/login` wenn nicht authentifiziert
- Automatischer Redirect zu `/` (Dashboard) wenn bereits eingeloggt

## Supabase Konfiguration

### Schritt 1: Email-Bestätigung deaktivieren (für Entwicklung)

1. Gehe zu [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt
3. Gehe zu **Authentication** → **Providers** → **Email**
4. Deaktiviere **"Confirm email"**
5. Speichern

**Wichtig:** In Produktion sollte die Email-Bestätigung aktiviert sein!

### Schritt 2: Redirect URLs konfigurieren

1. Gehe zu **Authentication** → **URL Configuration**
2. Füge folgende URLs hinzu:
   - Site URL: `http://localhost:3000`
   - Redirect URLs:
     - `http://localhost:3000`
     - `http://localhost:3000/login`
     - `http://localhost:3000/register`

### Schritt 3: Database Trigger für Mitglieder (Optional aber empfohlen)

Dieser Trigger erstellt automatisch einen Mitglieder-Eintrag, wenn ein neuer Auth-User registriert wird:

```sql
-- Function: Erstelle Mitglied bei Auth-User-Erstellung
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prüfe ob bereits ein Mitglied mit dieser Email existiert
  IF NOT EXISTS (SELECT 1 FROM public.mitglieder WHERE email = new.email) THEN
    INSERT INTO public.mitglieder (email, vorname, nachname, aktiv)
    VALUES (new.email, '', '', true);
  END IF;
  RETURN new;
END;
$$;

-- Trigger: Rufe Function bei neuer User-Registrierung auf
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

**Hinweis:** Dies ist optional, da die Registrierungs-Seite bereits Mitglieder-Einträge erstellt.

## Testing

### 1. Ersten Benutzer erstellen

```bash
# Starte die Entwicklungsumgebung
npm run dev
```

1. Öffne http://localhost:3000
2. Du wirst automatisch zu `/login` weitergeleitet
3. Klicke auf "Jetzt registrieren"
4. Fülle das Formular aus:
   - Vorname: Test
   - Nachname: User
   - Email: test@example.com
   - PLZ: 12345 (optional)
   - Ort: Teststadt (optional)
   - Passwort: test123
   - Passwort bestätigen: test123
5. Klicke "Konto erstellen"
6. Du wirst automatisch eingeloggt und zum Dashboard weitergeleitet

### 2. Logout & erneuter Login

1. Klicke auf "Abmelden" in der Sidebar (unten)
2. Du wirst zu `/login` weitergeleitet
3. Logge dich mit deinen Credentials ein

### 3. Geschützte Routen testen

- Versuche ohne Login auf geschützte Seiten zuzugreifen → Redirect zu `/login`
- Versuche als eingeloggter User auf `/login` zuzugreifen → Redirect zu `/`

## Datenbankschema

Die `mitglieder` Tabelle muss mit der Supabase Auth synchron sein:

```sql
CREATE TABLE public.mitglieder (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,  -- Wichtig: UNIQUE für Auth-Sync
  vorname text NOT NULL,
  nachname text NOT NULL,
  plz text,
  ort text,
  latitude numeric,
  longitude numeric,
  telefon text,
  beitrittsdatum date DEFAULT CURRENT_DATE,
  erstellt_am timestamp with time zone DEFAULT now(),
  aktiv boolean DEFAULT true,
  CONSTRAINT mitglieder_pkey PRIMARY KEY (id)
);
```

## Bekannte Probleme & Lösungen

### Problem: "Not authenticated" nach Registrierung

**Lösung:** Stelle sicher, dass die Email-Bestätigung in Supabase deaktiviert ist (siehe Schritt 1).

### Problem: Redirect Loop

**Lösung:** Prüfe die Middleware-Konfiguration. Stelle sicher, dass `/login` und `/register` nicht geschützt sind.

### Problem: "Mitglied nicht gefunden" trotz erfolgreicher Registrierung

**Lösung:**
1. Prüfe ob ein Mitglieds-Eintrag in der Datenbank erstellt wurde
2. Stelle sicher, dass die Email in beiden Tabellen (`auth.users` und `public.mitglieder`) identisch ist
3. Aktiviere den Database Trigger (siehe Schritt 3)

## Migration bestehender Benutzer

Wenn du bereits Mitglieder in der Datenbank hast, kannst du für diese Auth-Accounts erstellen:

```sql
-- Option 1: Manuell in Supabase Dashboard
-- Gehe zu Authentication → Users → Add User

-- Option 2: Via SQL (NICHT empfohlen für Produktion)
-- Nutze das Supabase Dashboard, um Passwörter sicher zu setzen
```

## Nächste Schritte

Nach erfolgreicher Auth-Implementierung:

1. ✅ Authentication ist aktiv
2. ⏭️ Community-Features implementieren
   - Public API Endpoints (`/api/anlagen/public`)
   - Community-Übersichtsseite (`/community`)
   - Öffentliche Anlagenprofile
3. ⏭️ Datenschutzerklärung erstellen
4. ⏭️ Email-Bestätigung in Produktion aktivieren
5. ⏭️ Password-Reset-Funktionalität hinzufügen

## Sicherheit

### Produktions-Checkliste

- [ ] Email-Bestätigung aktivieren
- [ ] Sichere Redirect URLs konfigurieren
- [ ] Rate Limiting für Login/Register implementieren
- [ ] 2FA (Two-Factor Authentication) erwägen
- [ ] Session-Timeout konfigurieren
- [ ] HTTPS erzwingen
- [ ] CORS richtig konfigurieren
- [ ] Row Level Security (RLS) in Supabase aktivieren

### Row Level Security (RLS) Beispiele

```sql
-- RLS für anlagen: Nur eigene Anlagen sichtbar
ALTER TABLE public.anlagen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benutzer sehen nur eigene Anlagen"
  ON public.anlagen
  FOR SELECT
  USING (
    mitglied_id IN (
      SELECT id FROM public.mitglieder
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Ähnliche Policies für monatsdaten, investitionen, etc.
```

## Support

Bei Problemen:
1. Prüfe die Browser Console auf Fehlermeldungen
2. Prüfe die Supabase Dashboard Logs (Authentication → Logs)
3. Stelle sicher, dass `.env.local` die richtigen Credentials enthält
