# 🔄 Datenbank Reset - Kompletter Neustart

## Wann verwenden?

- **Entwicklung:** Komplett neu anfangen mit sauberen Daten
- **Testing:** Vor jedem Test-Durchlauf alles zurücksetzen
- **Vor Go-Live:** Alle Test-Daten entfernen

## ⚠️ WARNUNG

**ALLE DATEN WERDEN GELÖSCHT!**
- Mitglieder
- Anlagen
- Monatsdaten
- Investitionen
- Auth Users

**NIEMALS in Production verwenden ohne Backup!**

---

## 📋 Schritt-für-Schritt Anleitung

### Schritt 0: Schema prüfen (WICHTIG!)

Bevor Sie Daten löschen, prüfen Sie ob alle Tabellen existieren:

1. **Öffne Supabase Dashboard**
2. **Gehe zu SQL Editor**
3. **Führe aus:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Falls Tabellen fehlen (z.B. investitionstypen):**
- **STOP!** Führen Sie erst [scripts/create-schema.sql](scripts/create-schema.sql) aus
- Dann weiter mit Schritt 1

### Schritt 1: SQL-Script ausführen

1. **Öffne Supabase Dashboard**
2. **Gehe zu SQL Editor**
3. **Führe aus:** [scripts/reset-all-data.sql](scripts/reset-all-data.sql)

**Erwartetes Ergebnis:**
```
monatsdaten: 0
investitionen: 0
anlagen_freigaben: 0
anlagen: 0
mitglieder: 0
```

### Schritt 2: Auth Users löschen

**WICHTIG:** SQL kann keine Auth Users löschen, das muss manuell passieren!

1. **Gehe zu:** Authentication → Users
2. **Wähle ALLE Users aus** (Checkbox oben)
3. **Klicke:** Delete Users (Papierkorb Icon)
4. **Bestätige** die Löschung

**Verifizierung:**
- Unter "Users" sollte jetzt "No users found" stehen

### Schritt 3: Browser-Cache leeren

**Wichtig:** Alte Sessions können im Browser gecacht sein!

1. **Drücke:** `Ctrl + Shift + Del` (Windows/Linux) oder `Cmd + Shift + Del` (Mac)
2. **Wähle:** "Cached Images and Files" + "Cookies"
3. **Zeit:** "All time"
4. **Clear Data**

**Oder einfacher:**
- Öffne ein **Inkognito/Private Fenster** für Tests

### Schritt 4: Dev Server neu starten

```bash
# Terminal
cd /home/gernot/claude/eedc-webapp

# Server stoppen (Ctrl+C)

# Server neu starten
npm run dev
```

### Schritt 5: Erste Schritte nach Reset

1. **Navigiere zu:** http://localhost:3000
2. **Du wirst zu /login weitergeleitet** ✅
3. **Klicke:** "Jetzt registrieren"
4. **Erstelle ersten User:**
   ```
   Vorname:     Gernot
   Nachname:    Rau
   Email:       gernot.rau@t-online.de
   Passwort:    IhrSicheresPasswort
   ```
5. **Nach Login:** Solltest du den "Empty State" sehen
6. **Klicke:** "Erste Anlage erstellen"

---

## 🎯 Für Production/Staging

### Neue Umgebung vorbereiten

Statt alles zu löschen, bereiten Sie eine frische Datenbank vor:

1. **Erstelle neue Supabase Instanz** (Production/Staging)
2. **Führe Schema-Migration aus** (CREATE TABLE statements)
3. **Führe aus:** [scripts/production-setup.sql](scripts/production-setup.sql)

Das Production-Setup Script:
- ✅ Erstellt Standard-Investitionstypen
- ✅ Erstellt Standard-Strompreise
- ✅ Aktiviert Row Level Security (RLS)
- ✅ Erstellt alle notwendigen Policies

### Production Checklist

- [ ] Backup der aktuellen Daten erstellt
- [ ] Migration-Scripts getestet
- [ ] RLS Policies aktiv
- [ ] Email-Bestätigung aktiviert (in Auth Settings)
- [ ] Rate Limiting konfiguriert
- [ ] Environment Variables gesetzt (.env.production)
- [ ] NEXT_PUBLIC_SUPABASE_URL auf Production zeigend
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY korrekt

---

## 🔧 Häufige Probleme nach Reset

### "Nicht authentifiziert" beim Login

**Ursache:** Auth User existiert, aber kein Mitglied-Eintrag
**Lösung:** Komplett neu registrieren (nicht über Auth Users erstellen!)

### "Server Error 500" bei Anlage erstellen

**Ursache:** RLS Policies fehlen oder zu restriktiv
**Lösung:** [scripts/production-setup.sql](scripts/production-setup.sql) ausführen

### Alte Daten erscheinen immer noch

**Ursache:** Browser-Cache
**Lösung:**
- `Ctrl + Shift + R` (Hard Reload)
- Oder: Inkognito-Fenster verwenden

### "Permission denied" Fehler

**Ursache:** RLS ist aktiv, aber Policies fehlen
**Lösung:**
```sql
-- Temporär RLS deaktivieren zum Testen
ALTER TABLE anlagen DISABLE ROW LEVEL SECURITY;

-- WICHTIG: In Production IMMER RLS aktiviert lassen!
```

---

## 📊 Verifizierung nach Reset

### SQL-Checks ausführen

```sql
-- Alle Tabellen sollten leer sein
SELECT 'mitglieder' as tabelle, COUNT(*) FROM mitglieder
UNION ALL
SELECT 'anlagen', COUNT(*) FROM anlagen
UNION ALL
SELECT 'monatsdaten', COUNT(*) FROM monatsdaten
UNION ALL
SELECT 'investitionen', COUNT(*) FROM investitionen;
```

**Erwartung:** Alle Counts = 0

### Auth Check

1. Gehe zu: Authentication → Users
2. **Erwartung:** "No users found"

### Browser Check

1. Öffne: http://localhost:3000
2. **Erwartung:** Redirect zu /login
3. Versuche alte Credentials
4. **Erwartung:** "Invalid login credentials"

---

## 💾 Backup vor Reset (empfohlen)

```sql
-- Export all data to CSV (in Supabase Dashboard)
-- Oder: pg_dump verwenden

-- Beispiel für lokales Backup
COPY (SELECT * FROM mitglieder) TO '/tmp/mitglieder_backup.csv' CSV HEADER;
COPY (SELECT * FROM anlagen) TO '/tmp/anlagen_backup.csv' CSV HEADER;
COPY (SELECT * FROM monatsdaten) TO '/tmp/monatsdaten_backup.csv' CSV HEADER;
```

---

## 🎓 Best Practices

### Entwicklung

- **Regelmäßige Resets** während Feature-Entwicklung
- **Seed-Data Script** für schnelles Setup nach Reset
- **Test-Accounts** mit bekannten Credentials

### Testing

- **Vor jedem Test:** Kompletter Reset
- **Seed-Script:** Konsistente Test-Daten
- **Automatisiert:** Reset als Teil der Test-Suite

### Production

- **NIEMALS Reset!** (außer bei komplettem Neustart)
- **Backups:** Täglich automatisch
- **Staging:** Separate Umgebung für Tests
- **Migration:** Nur Forward-Migrations, keine Data-Loss

---

## ✅ Fertig!

Nach erfolgreichem Reset haben Sie:
- ✅ Leere, saubere Datenbank
- ✅ Keine Auth Users
- ✅ Bereit für frische Registrierung
- ✅ Sauberer Start für Tests oder Production

**Nächste Schritte:**
1. Erste Registrierung
2. Erste Anlage erstellen
3. Test-Daten importieren (optional)
4. Testing nach [TEST_PLAN_AKTUELL.md](TEST_PLAN_AKTUELL.md)
