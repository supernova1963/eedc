# 🚀 Server Deployment - FRESH-START Migration

## Aktuelle Version: FRESH-START Schema (2026-01-29)

Diese Anleitung beschreibt das Deployment der FRESH-START Schema-Migration auf deinem Produktions-Server.

## ⚠️ WICHTIG: Schema-Migration erforderlich!

**Diese Version enthält Breaking Changes!** Das Datenbankschema wurde umfangreich überarbeitet (FRESH-START).
Bitte folge den Schritten **exakt in dieser Reihenfolge**.

---

## 📋 Voraussetzungen

- [x] Git Repository Zugriff
- [x] SSH Zugriff auf Produktions-Server
- [x] Supabase Projekt mit Admin-Zugriff
- [x] Backup der aktuellen Datenbank (empfohlen!)

---

## 🗄️ Schritt 1: Datenbank-Migration (Supabase)

### 1.1 Backup erstellen (WICHTIG!)

Im Supabase Dashboard:
1. Gehe zu **Database** → **Backups**
2. Erstelle ein manuelles Backup
3. Warte bis Backup abgeschlossen ist

### 1.2 FRESH-START Schema deployen

Öffne **Supabase SQL Editor** und führe die folgenden Dateien **in dieser Reihenfolge** aus:

```sql
-- 1. Schema & Tabellen (mit DROP CASCADE für Clean Start)
migrations/FRESH-START/01_schema_tables.sql

-- 2. Helper Functions
migrations/FRESH-START/02_helper_functions.sql

-- 3. RLS Policies
migrations/FRESH-START/03_rls_policies.sql

-- 4. Community Functions (DROP alte Version zuerst)
migrations/FRESH-START/04_community_functions_DROP_FIRST.sql

-- 5. Community Functions (neue Version)
migrations/FRESH-START/04_community_functions_CURRENT_SCHEMA.sql
```

### 1.3 Migration verifizieren

Prüfe ob alle Tabellen korrekt angelegt wurden:

```sql
-- Alle Tabellen anzeigen
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- RLS Policies prüfen
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Erwartetes Ergebnis: >= 25 Policies

-- Freigaben-Spalten prüfen
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'anlagen'
  AND column_name LIKE '%oeffentlich%';
-- Erwartetes Ergebnis: oeffentlich, kennzahlen_oeffentlich,
-- monatsdaten_oeffentlich, komponenten_oeffentlich
```

---

## 💻 Schritt 2: Code-Deployment auf Server

### 2.1 Auf Server einloggen

```bash
ssh user@dein-server.de
cd /pfad/zu/eedc-webapp
```

### 2.2 Aktuelle Version pullen

```bash
# Änderungen vom Main-Branch holen
git pull origin main

# Erwartete Commits:
# - 0fe9168: 🐛 Fix: Build-Errors nach FRESH-START Migration behoben
# - 8396505: 🔧 Chore: TypeScript Types für FRESH-START Schema generiert
# - 1d56d04: 🔄 Refactor: FRESH-START Schema - Code-Anpassungen
```

### 2.3 Dependencies installieren

```bash
# Node Modules aktualisieren
npm install

# Prüfen ob alle Packages korrekt installiert sind
npm list --depth=0
```

### 2.4 TypeScript Types generieren

```bash
# Supabase CLI Login (falls noch nicht eingeloggt)
npx supabase login

# Types generieren (ersetze PROJECT_ID mit deiner Supabase Project ID)
npx supabase gen types typescript \
  --project-id DEINE_SUPABASE_PROJECT_ID \
  > types/database.ts

# PROJECT_ID findest du in deiner .env.local:
# NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
```

### 2.5 Build durchführen

```bash
# Production Build erstellen
npm run build

# Bei Erfolg siehst du:
# ✓ Compiled successfully
# ✓ Generating static pages (24/24)
# ✓ Finalizing page optimization
```

### 2.6 Anwendung neu starten

```bash
# Je nach Setup:

# Option 1: PM2
pm2 restart eedc-webapp
pm2 logs eedc-webapp --lines 50

# Option 2: Systemd
sudo systemctl restart eedc-webapp
sudo systemctl status eedc-webapp

# Option 3: Docker
docker-compose down
docker-compose up -d --build

# Option 4: npm start (Development)
npm start
```

---

## ✅ Schritt 3: Testing & Verifikation

### 3.1 Health Check

```bash
# App erreichbar?
curl https://deine-domain.de/

# API erreichbar?
curl https://deine-domain.de/api/test-auth
```

### 3.2 Manuelle Tests

Öffne die App im Browser und teste:

- [ ] **Login funktioniert**
  - Navigiere zu `/login`
  - Melde dich mit existierendem Account an

- [ ] **Dashboard lädt**
  - Navigiere zu `/meine-anlage`
  - Dashboard zeigt Kennzahlen an

- [ ] **Anlage erstellen**
  - Navigiere zu `/anlage/neu`
  - Erstelle Test-Anlage
  - Prüfe ob Freigaben-Defaults gesetzt sind

- [ ] **Freigaben bearbeiten**
  - Navigiere zu `/anlage`
  - Öffne Freigaben-Formular
  - Ändere Privacy-Settings
  - Speichere → sollte in `anlagen` Tabelle landen (nicht `anlagen_freigaben`)

- [ ] **Community Features**
  - Navigiere zu `/` (Public Homepage)
  - Prüfe ob öffentliche Anlagen angezeigt werden
  - Öffne eine öffentliche Anlage

- [ ] **Investitionen**
  - Navigiere zu `/investitionen/neu`
  - Erstelle Test-Investition
  - Bearbeite Investition unter `/investitionen/bearbeiten/[id]`

### 3.3 Logs prüfen

```bash
# PM2 Logs
pm2 logs eedc-webapp --lines 100

# Systemd Logs
journalctl -u eedc-webapp -n 100 -f

# Nach Fehlern suchen:
grep -i "error" /var/log/eedc-webapp/error.log
```

---

## 🔧 Wichtige Änderungen im FRESH-START Schema

### Strukturelle Änderungen

#### 1. Freigaben-Spalten in `anlagen` Tabelle
**Vorher:**
- Separate Tabelle `anlagen_freigaben` mit Foreign Key

**Jetzt:**
- Spalten direkt in `anlagen` Tabelle:
  - `oeffentlich` (war: `profil_oeffentlich`)
  - `standort_genau_anzeigen` (war: `standort_genau`)
  - `kennzahlen_oeffentlich`
  - `monatsdaten_oeffentlich`
  - `komponenten_oeffentlich` (war: `investitionen_oeffentlich`)

#### 2. Umbenennung `investitionen_oeffentlich` → `komponenten_oeffentlich`
Semantisch korrekter Name für die Sichtbarkeit von Komponenten (Speicher, Wallbox, etc.)

#### 3. RLS Policies aktualisiert
- Neue Policies für Community-Zugriff
- Public Access via `anon` Role
- Security Definer Functions für komplexe Queries

### Code-Anpassungen

#### Betroffene Dateien:
1. `lib/freigabe-actions.ts` - UPDATE statt UPSERT
2. `lib/anlage-actions.ts` - Freigaben-Defaults beim INSERT
3. `app/api/anlagen/route.ts` - Freigaben-Defaults
4. `app/anlage/page.tsx` - Liest von `anlagen` statt `anlagen_freigaben`
5. `lib/community.ts` - Interface angepasst
6. `app/api/community/*` - Verwendet `getPublicAnlageDetails()`

---

## 🐛 Troubleshooting

### Build Fehler: "Module not found: @/components/ui/select"

**Lösung:** Bereits behoben in Commit `0fe9168`
```bash
# Falls Fehler auftritt, prüfe ob Datei existiert:
ls -la components/ui/select.tsx
```

### TypeScript Fehler: "Property 'id' does not exist on type..."

**Lösung:** Bereits behoben - `mitglied.data.id` statt `mitglied.id`

### Supabase RPC Functions nicht gefunden

**Problem:** Community Functions noch nicht deployed

**Lösung:**
```sql
-- In Supabase SQL Editor:
-- 1. Alte Functions löschen
migrations/FRESH-START/04_community_functions_DROP_FIRST.sql

-- 2. Neue Functions erstellen
migrations/FRESH-START/04_community_functions_CURRENT_SCHEMA.sql
```

### RLS blockiert Zugriff

**Problem:** Policies nicht korrekt deployed

**Lösung:**
```sql
-- Alle Policies neu erstellen
migrations/FRESH-START/03_rls_policies.sql

-- Prüfen:
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public';
```

---

## 📊 Rollback (Falls notwendig)

Falls die Migration fehlschlägt:

### 1. Code Rollback
```bash
git reset --hard HEAD~3  # Zurück vor FRESH-START Migration
npm install
npm run build
pm2 restart eedc-webapp
```

### 2. Datenbank Rollback
Im Supabase Dashboard:
1. **Database** → **Backups**
2. Wähle Backup vor Migration
3. **Restore**
4. Warte auf Completion

---

## 📝 Commit History (Relevante Änderungen)

```
0fe9168 - 🐛 Fix: Build-Errors nach FRESH-START Migration behoben
8396505 - 🔧 Chore: TypeScript Types für FRESH-START Schema generiert
1d56d04 - 🔄 Refactor: FRESH-START Schema - Code-Anpassungen
16a2105 - ✨ Feature: Community Functions & Testing Infrastructure
```

---

## ✅ Deployment Checklist

Vor dem Go-Live:

- [ ] Backup der Datenbank erstellt
- [ ] Alle 5 SQL Migrations-Dateien ausgeführt
- [ ] Migration in Supabase verifiziert (RLS Policies, Spalten)
- [ ] Code auf Server gepullt (git pull origin main)
- [ ] Dependencies installiert (npm install)
- [ ] TypeScript Types generiert
- [ ] Build erfolgreich (npm run build)
- [ ] Anwendung neu gestartet
- [ ] Health Checks erfolgreich
- [ ] Login funktioniert
- [ ] Dashboard lädt korrekt
- [ ] Neue Anlage erstellen funktioniert
- [ ] Freigaben speichern funktioniert
- [ ] Community Features funktionieren
- [ ] Logs geprüft (keine Errors)

---

## 📞 Support

Bei Problemen:
1. Prüfe Logs: `pm2 logs eedc-webapp`
2. Prüfe Supabase Dashboard → Logs
3. Prüfe Browser Console (F12)
4. Erstelle GitHub Issue mit Error Details

---

**Deployment Date:** 2026-01-29
**Schema Version:** FRESH-START
**Breaking Changes:** Ja (Datenbank-Migration erforderlich)
