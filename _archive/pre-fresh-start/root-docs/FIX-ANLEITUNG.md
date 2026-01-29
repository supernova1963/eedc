# Fix-Anleitung: Benutzername/E-Mail Anzeige

**Problem:** Benutzername und E-Mail werden nicht oben links in der Sidebar angezeigt.

---

## Sofort-Maßnahmen (JETZT)

### Schritt 1: Code mit Debug-Logging deployen

Der Code in [components/ConditionalLayout.tsx](components/ConditionalLayout.tsx) wurde bereits mit Debug-Logging erweitert.

**Aktion:**
1. App neu starten: `npm run dev`
2. Browser öffnen und zu einer privaten Seite navigieren (z.B. `/meine-anlage`)
3. Browser-Console öffnen (F12 → Console Tab)

**Erwartete Console-Ausgabe:**
```
🔍 [ConditionalLayout] Session: Vorhanden
🔍 [ConditionalLayout] User: { id: "...", email: "user@example.com" }
🔍 [ConditionalLayout] Mitglied Query: { success: true, mitglied: { ... }, error: null }
✅ Mitglied geladen: Max Mustermann
```

**Mögliche Fehler:**
- ❌ `Session: Keine Session` → User ist nicht eingeloggt
- ❌ `User: Kein User` → Auth-Problem
- ❌ `error: { code: "42501", message: "permission denied" }` → **RLS Policy blockiert!** → Weiter zu Schritt 2
- ❌ `error: { code: "PGRST116", message: "The result contains 0 rows" }` → User existiert nicht in `mitglieder` Tabelle

### Schritt 2: Datenbank-Policy Fix

**Wenn Console zeigt: "permission denied" oder "The result contains 0 rows"**

1. Öffne Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Kopiere komplettes Skript: [scripts/diagnose-and-fix-mitglieder-policy.sql](scripts/diagnose-and-fix-mitglieder-policy.sql)
3. Führe das Skript aus (Run Button)
4. Prüfe Output - sollte neue Policies zeigen
5. Starte App neu
6. Teste erneut

### Schritt 3: Manuelle Verifikation

**Falls es immer noch nicht funktioniert:**

1. Prüfe ob User in `mitglieder` Tabelle existiert:
   ```sql
   SELECT id, email, vorname, nachname, aktiv
   FROM mitglieder
   WHERE aktiv = true;
   ```

2. Prüfe ob E-Mail EXAKT übereinstimmt:
   ```sql
   SELECT
     m.email as mitglieder_email,
     u.email as auth_email,
     m.email = u.email as match
   FROM mitglieder m
   CROSS JOIN auth.users u
   WHERE m.aktiv = true;
   ```

3. Falls `aktiv = false`: Setze auf `true`:
   ```sql
   UPDATE mitglieder
   SET aktiv = true
   WHERE email = 'ihre-email@example.com';
   ```

4. Falls E-Mail nicht übereinstimmt: Korrigiere:
   ```sql
   UPDATE mitglieder
   SET email = 'korrekte-email@example.com'
   WHERE id = 'ihre-mitglied-id';
   ```

---

## Strukturelle Verbesserungen (DANACH)

Nach dem Sofort-Fix sollten folgende strukturelle Verbesserungen umgesetzt werden:

### 1. Server-Side User Loading

**Problem:** Client-Side Queries auf `mitglieder` sind anfällig für RLS-Probleme.

**Lösung:** Lade User-Daten server-side im Root Layout.

**Implementierung:**
1. Erstelle neue Datei: [components/ConditionalLayoutClient.tsx](components/ConditionalLayoutClient.tsx)
   ```typescript
   'use client'
   // Nur noch das Client-Side Routing, kein Data Loading
   ```

2. Ändere [app/layout.tsx](app/layout.tsx):
   ```typescript
   import { getCurrentUser } from '@/lib/auth'

   export default async function RootLayout({ children }) {
     const mitglied = await getCurrentUser()

     return (
       <html lang="de">
         <body>
           <ConditionalLayoutClient
             userName={mitglied ? `${mitglied.vorname} ${mitglied.nachname}` : undefined}
             userEmail={mitglied?.email}
           >
             {children}
           </ConditionalLayoutClient>
         </body>
       </html>
     )
   }
   ```

**Vorteile:**
- ✅ Server-Side nutzt Service Role (keine RLS-Probleme)
- ✅ Schneller (keine Client-Side Query beim Mount)
- ✅ SEO-freundlich
- ✅ Weniger Race Conditions

### 2. User Context Provider

**Problem:** User-Daten werden an mehrere Komponenten weitergereicht (Props Drilling).

**Lösung:** Zentraler Context für User-Daten.

**Implementierung:**
1. Erstelle [context/UserContext.tsx](context/UserContext.tsx)
2. Wrapper in Root Layout
3. `useUser()` Hook in Komponenten

### 3. Vereinfachte RLS Policies

**Problem:** Komplexe Policies mit Zirkelbezügen.

**Lösung:** Simple Policies + Security Definer Functions.

**Siehe:** [ANALYSE-AUTHENTIFIZIERUNG-BERECHTIGUNGEN.md](ANALYSE-AUTHENTIFIZIERUNG-BERECHTIGUNGEN.md) Abschnitt 6.2D

### 4. Type Safety

**Problem:** Keine Type-Safety für Datenbank-Queries.

**Lösung:** Supabase Type Generation.

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

---

## Langfristige Optimierungen

1. **Performance Monitoring**
   - Sentry für Error Tracking
   - Analytics für Auth-Erfolgsrate

2. **Testing**
   - Unit Tests für Auth-Helpers
   - E2E Tests für Login-Flow

3. **Security Review**
   - RLS Policies regelmäßig prüfen
   - Security Audit für Community-Features

4. **Documentation**
   - API Docs für Auth-Functions
   - Onboarding Guide für neue Developer

---

## Wichtige Dateien

- 📊 **Analyse:** [ANALYSE-AUTHENTIFIZIERUNG-BERECHTIGUNGEN.md](ANALYSE-AUTHENTIFIZIERUNG-BERECHTIGUNGEN.md)
- 🔧 **SQL Fix:** [scripts/diagnose-and-fix-mitglieder-policy.sql](scripts/diagnose-and-fix-mitglieder-policy.sql)
- 💻 **Code:** [components/ConditionalLayout.tsx](components/ConditionalLayout.tsx)
- 🔐 **Auth Helper:** [lib/auth.ts](lib/auth.ts)

---

## Checkliste

### Sofort-Fix
- [ ] Code mit Debug-Logging deployen
- [ ] Console Output prüfen
- [ ] SQL-Skript ausführen (falls RLS-Problem)
- [ ] Mitglieder-Daten in DB verifizieren
- [ ] Testen: Erscheint Name/E-Mail?

### Strukturelle Fixes
- [ ] Server-Side User Loading implementieren
- [ ] User Context Provider erstellen
- [ ] RLS Policies vereinfachen
- [ ] Type Generation einrichten
- [ ] Tests schreiben

### Dokumentation
- [ ] Analyse-Dokument aktualisieren mit Findings
- [ ] Code Comments hinzufügen
- [ ] README für Auth-System schreiben

---

## Support

Bei Problemen:
1. Prüfe Console Output und teile relevante Logs
2. Führe SQL-Diagnose aus (Teil 5 im SQL-Skript)
3. Prüfe Supabase Dashboard → Authentication → Users
4. Prüfe Supabase Dashboard → Table Editor → mitglieder

---

**Erstellt:** 2026-01-28
**Status:** Ready for Implementation
