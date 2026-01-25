# Debugging-Anleitung: Anlagen-Erstellung

## Problem
Neue Anlagen werden nicht in der Datenbank gespeichert.

## Schritte zur Fehlerdiagnose

### 1. TypeScript-Fehler behoben ✅
Alle TypeScript-Compilerfehler wurden behoben:
- `lib/community.ts` - Array-Zugriff korrigiert
- `components/SimpleIcon.tsx` - Doppelte `check` Property entfernt
- `components/OptimierungsvorschlaegeDashboard.tsx` - Variablenname korrigiert
- Community-Seiten - Breadcrumb `items` Prop entfernt

### 2. Debug-Seite öffnen

Navigieren Sie zu: **http://localhost:3000/debug**

Diese Seite zeigt Ihnen:
1. ✅ Ob Sie authentifiziert sind (Auth User Daten)
2. ✅ Ob ein Mitglied-Record existiert
3. ✅ Ob Client-seitige Inserts funktionieren (testet RLS Policies)

**Was die Ergebnisse bedeuten:**

#### Szenario A: Auth User fehlt
```
❌ Nicht authentifiziert
```
**Problem:** Session ist abgelaufen oder ungültig
**Lösung:** Neu einloggen unter /login

#### Szenario B: Mitglied-Record fehlt
```
✅ Auth User vorhanden
❌ Kein Mitglied-Record gefunden
```
**Problem:** Auth User existiert, aber kein Eintrag in `mitglieder` Tabelle
**Lösung:** Manuell Mitglied-Record in Supabase erstellen oder neu registrieren

#### Szenario C: Insert schlägt fehl (RLS Policy Problem)
```
✅ Auth User vorhanden
✅ Mitglied vorhanden
❌ Fehler beim Insert: new row violates row-level security policy
```
**Problem:** Row Level Security Policies in Supabase blockieren den Insert
**Lösung:** RLS Policies in Supabase anpassen (siehe unten)

#### Szenario D: Client Insert funktioniert, Server Action nicht
```
✅ Auth User vorhanden
✅ Mitglied vorhanden
✅ Insert erfolgreich (Client-Side)
❌ Aber Anlage-Formular funktioniert nicht
```
**Problem:** Server Action hat ein spezifisches Problem
**Lösung:** Browser-Konsole prüfen (siehe unten)

### 3. Browser-Konsole prüfen

Öffnen Sie die Browser-Konsole (F12) und versuchen Sie, eine Anlage zu erstellen:

1. Navigieren Sie zu: http://localhost:3000/anlage/neu
2. Füllen Sie das Formular aus
3. Klicken Sie auf "Anlage erstellen"
4. Beobachten Sie die Konsolen-Logs

**Erwartete Logs:**
```
📤 Form submitted
🔄 Calling createAnlage...
```

**Auf dem Server (in Ihrem Terminal):**
```
🚀 createAnlage called
👤 User: { id: '...', email: '...', ... }
📝 FormData: { anlagenname: '...', ... }
💾 Inserting anlage: { ... }
✅ Anlage created: { id: '...', ... }
🔄 Redirecting to /anlage?anlageId=...
```

**Fehlersuche nach Logs:**

| Was Sie sehen | Problem | Lösung |
|--------------|---------|--------|
| Nichts | Form wird nicht submitted | JavaScript-Fehler? Browser-Konsole prüfen |
| Nur Client-Logs (📤, 🔄) | Server Action wird nicht aufgerufen | Next.js Neustart? Build-Fehler? |
| ❌ Nicht authentifiziert | getCurrentUser() gibt null zurück | Session-Problem, neu einloggen |
| ❌ Validierung fehlgeschlagen | Pflichtfelder fehlen | FormData wird nicht korrekt übergeben |
| ❌ Anlage creation error | Supabase-Fehler | Details im Error-Objekt, RLS oder Constraints? |

### 4. Supabase RLS Policies prüfen

Falls der Client-seitige Insert auf /debug fehlschlägt, müssen die RLS Policies angepasst werden:

**In Supabase Dashboard:**

1. Navigieren Sie zu: Authentication & API → Policies
2. Wählen Sie die `anlagen` Tabelle
3. Stellen Sie sicher, dass eine INSERT Policy existiert:

```sql
-- Policy: "Mitglieder können ihre eigenen Anlagen erstellen"
CREATE POLICY "Mitglieder können ihre eigenen Anlagen erstellen"
ON anlagen
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM auth.users WHERE email = (
      SELECT email FROM mitglieder WHERE id = mitglied_id
    )
  )
);
```

**Oder vereinfacht (wenn mitglied_id = auth.uid()):**
```sql
CREATE POLICY "Mitglieder können ihre eigenen Anlagen erstellen"
ON anlagen
FOR INSERT
TO authenticated
WITH CHECK (true);  -- Vorübergehend, um zu testen
```

### 5. Datenbank-Schema prüfen

Stellen Sie sicher, dass die `anlagen` Tabelle alle erforderlichen Spalten hat:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'anlagen'
ORDER BY ordinal_position;
```

**Erforderliche Spalten:**
- `id` (uuid, PRIMARY KEY)
- `mitglied_id` (uuid, NOT NULL)
- `anlagenname` (text, NOT NULL)
- `anlagentyp` (text)
- `leistung_kwp` (numeric)
- `installationsdatum` (date)
- `standort_plz` (text)
- `standort_ort` (text)
- `batteriekapazitaet_kwh` (numeric)
- `ekfz_vorhanden` (boolean)
- `ekfz_bezeichnung` (text)
- `waermepumpe_vorhanden` (boolean)
- `waermepumpe_bezeichnung` (text)
- `aktiv` (boolean, DEFAULT true)
- `erstellt_am` (timestamptz, DEFAULT now())

### 6. Server Logs prüfen

In Ihrem Terminal, wo `npm run dev` läuft, sollten die Server-Logs erscheinen.

Falls Sie nichts sehen:
```bash
# Terminal 1: Dev Server stoppen (Ctrl+C) und neu starten
npm run dev

# Terminal 2: Logs in Echtzeit beobachten
tail -f .next/trace
```

## Schnell-Checkliste

- [ ] TypeScript kompiliert ohne Fehler (`npx tsc --noEmit`)
- [ ] Dev Server läuft (`npm run dev`)
- [ ] /debug Seite zeigt Auth User ✅
- [ ] /debug Seite zeigt Mitglied ✅
- [ ] /debug Seite: Client Insert ✅
- [ ] Browser-Konsole zeigt 📤 und 🔄 Logs
- [ ] Server-Terminal zeigt 🚀 Log
- [ ] Server-Terminal zeigt ✅ Anlage created Log
- [ ] Nach Submit: Redirect zur /anlage Seite

## Nächste Schritte nach Erfolg

1. Alte Demo-Anlage aus der Datenbank entfernen:
```sql
DELETE FROM anlagen WHERE mitglied_id IS NULL OR mitglied_id NOT IN (SELECT id FROM mitglieder);
```

2. Empty State testen: Alle Anlagen eines Users löschen und prüfen ob die "Willkommen"-Seite erscheint

3. Test Plan in TEST_PLAN.md fortsetzen
