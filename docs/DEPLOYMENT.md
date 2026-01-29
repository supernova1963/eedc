# EEDC Deployment & Synchronisation

**Stand:** 2026-01-29

Diese Dokumentation beschreibt verschiedene Wege zur Aktualisierung des Produktionsservers und zur Synchronisation zwischen Entwicklungsrechnern.

---

## Inhaltsverzeichnis

1. [Entwicklungsrechner synchronisieren](#1-entwicklungsrechner-synchronisieren)
2. [Produktionsserver aktualisieren](#2-produktionsserver-aktualisieren)
3. [Problembehandlung](#3-problembehandlung)
4. [Release-Management (Optional)](#4-release-management-optional)

---

## 1. Entwicklungsrechner synchronisieren

### 1.1 Erstmaliges Klonen (neuer Rechner)

```bash
# Repository klonen
cd ~/projekte  # oder anderer Ordner
git clone https://github.com/supernova1963/eedc.git
cd eedc

# Dependencies installieren
npm install

# Lokale Umgebungsvariablen einrichten
cp .env.example .env.local
# Dann .env.local bearbeiten mit Supabase-Credentials

# Entwicklungsserver starten
npm run dev
```

### 1.2 Bestehenden Rechner aktualisieren

**Einfachste Methode (empfohlen):**
```bash
cd ~/pfad/zu/eedc

# Lokale Änderungen prüfen
git status

# Wenn keine lokalen Änderungen:
git pull origin main
npm install  # Falls neue Dependencies

# Entwicklungsserver starten
npm run dev
```

**Bei lokalen Änderungen die NICHT behalten werden sollen:**
```bash
# ACHTUNG: Verwirft alle lokalen Änderungen!
git fetch origin
git reset --hard origin/main
npm install
```

**Bei lokalen Änderungen die BEHALTEN werden sollen:**
```bash
# Option A: Stashen (temporär beiseite legen)
git stash
git pull origin main
git stash pop  # Änderungen wieder anwenden
npm install

# Option B: Committen vor Pull
git add .
git commit -m "Lokale Änderungen"
git pull origin main  # Ggf. Merge-Konflikte lösen
npm install
```

### 1.3 Typische Probleme beim Synchronisieren

**Problem: "npm install" schlägt fehl**
```bash
# Node modules komplett neu installieren
rm -rf node_modules
rm package-lock.json
npm install
```

**Problem: Build-Fehler nach Pull**
```bash
# .next Cache löschen
rm -rf .next
npm run build
```

**Problem: TypeScript-Fehler**
```bash
# TypeScript Cache löschen
rm -rf node_modules/.cache
npm run build
```

---

## 2. Produktionsserver aktualisieren

### 2.1 Methode A: Einfacher Git Pull (Standard)

**Voraussetzungen:**
- SSH-Zugang zum Server
- Git ist auf dem Server installiert
- pm2 oder systemd für Prozess-Management

**Schritt-für-Schritt:**
```bash
# 1. Auf Server einloggen
ssh user@server

# 2. Zum Projektverzeichnis wechseln
cd /var/www/eedc  # oder Ihr Pfad

# 3. Aktuellen Stand sichern (optional aber empfohlen)
git stash  # Falls lokale Änderungen
cp .env.local .env.local.backup

# 4. Updates holen
git fetch origin
git pull origin main

# 5. Dependencies aktualisieren
npm install --production

# 6. Neu bauen
npm run build

# 7. Server neu starten
pm2 restart eedc
# ODER bei systemd:
sudo systemctl restart eedc
```

**Als Script (update.sh):**
```bash
#!/bin/bash
# /var/www/eedc/update.sh

set -e  # Bei Fehler abbrechen

echo "=== EEDC Update ==="
echo "Datum: $(date)"

cd /var/www/eedc

# Backup der Umgebungsvariablen
cp .env.local .env.local.backup 2>/dev/null || true

# Git Update
echo "Git Pull..."
git fetch origin
git pull origin main

# Dependencies
echo "npm install..."
npm install --production

# Build
echo "npm build..."
npm run build

# Restart
echo "Neustart..."
pm2 restart eedc

echo "=== Update abgeschlossen ==="
pm2 status
```

**Ausführbar machen und nutzen:**
```bash
chmod +x /var/www/eedc/update.sh
./update.sh
```

### 2.2 Methode B: Spezifischen Commit deployen

Wenn Sie einen bestimmten (funktionierenden) Stand deployen möchten:

```bash
# Auf dem Server:
cd /var/www/eedc

# Verfügbare Commits anzeigen
git log --oneline -20

# Zu spezifischem Commit wechseln
git checkout abc1234  # Commit-Hash

# ODER zu einem Tag (wenn vorhanden)
git checkout v1.0.0

npm install --production
npm run build
pm2 restart eedc
```

**Zurück zum neuesten Stand:**
```bash
git checkout main
git pull origin main
npm install --production
npm run build
pm2 restart eedc
```

### 2.3 Methode C: Manueller Datei-Upload (Notfall)

Wenn Git-Probleme bestehen oder Sie schnell eine Datei ändern müssen:

```bash
# Lokal: Dateien vorbereiten
npm run build
tar -czvf eedc-build.tar.gz .next package.json package-lock.json

# Upload via SCP
scp eedc-build.tar.gz user@server:/tmp/

# Auf Server:
cd /var/www/eedc
tar -xzvf /tmp/eedc-build.tar.gz
npm install --production
pm2 restart eedc
```

### 2.4 Methode D: Komplettes Neu-Deployment

Bei größeren Problemen oder Schema-Änderungen:

```bash
# Auf Server:
cd /var/www

# Altes Verzeichnis sichern
mv eedc eedc-backup-$(date +%Y%m%d)

# Neu klonen
git clone https://github.com/supernova1963/eedc.git
cd eedc

# Umgebungsvariablen vom Backup kopieren
cp ../eedc-backup-*/\.env.local .env.local

# Installieren und bauen
npm install --production
npm run build

# pm2 neu registrieren (falls nötig)
pm2 delete eedc 2>/dev/null || true
pm2 start npm --name "eedc" -- start
pm2 save
```

---

## 3. Problembehandlung

### 3.1 Server startet nicht nach Update

**Logs prüfen:**
```bash
pm2 logs eedc --lines 50
# ODER
journalctl -u eedc -n 50
```

**Häufige Ursachen:**

1. **Fehlende Umgebungsvariablen**
   ```bash
   cat .env.local  # Prüfen ob vorhanden
   ```

2. **Build-Fehler**
   ```bash
   npm run build 2>&1 | tee build.log
   # Log analysieren
   ```

3. **Port bereits belegt**
   ```bash
   lsof -i :3000
   kill -9 <PID>  # Falls nötig
   ```

### 3.2 Rollback zu vorherigem Stand

```bash
cd /var/www/eedc

# Letzte funktionierende Commits finden
git log --oneline -10

# Zu funktionierendem Commit zurück
git checkout <commit-hash>
npm install --production
npm run build
pm2 restart eedc
```

### 3.3 Datenbank-Migrationen

Bei Schema-Änderungen müssen SQL-Migrationen in Supabase ausgeführt werden:

```bash
# Migrationen finden
ls -la migrations/FRESH-START/

# In Supabase SQL Editor ausführen (manuell)
# Reihenfolge beachten: 01, 02, 03, etc.
```

### 3.4 Cache-Probleme

```bash
# Auf Server:
cd /var/www/eedc
rm -rf .next
rm -rf node_modules/.cache
npm run build
pm2 restart eedc
```

---

## 4. Release-Management (Optional)

### 4.1 Wann Releases sinnvoll sind

- Bei stabilen Meilensteinen
- Vor größeren Änderungen (als Fallback-Punkt)
- Für Dokumentationszwecke

### 4.2 Manuelles Release erstellen

```bash
# Lokal auf Entwicklungsrechner:

# 1. Sicherstellen dass alles committed ist
git status

# 2. Tag erstellen
git tag -a v1.0.0 -m "Release 1.0.0: FRESH-START Schema implementiert"

# 3. Tag pushen
git push origin v1.0.0

# 4. Optional: GitHub Release erstellen
# Über GitHub Web UI: Releases → Create new release
# Oder via gh CLI:
gh release create v1.0.0 --title "v1.0.0" --notes "Release Notes hier"
```

### 4.3 Release auf Server deployen

```bash
# Auf Server:
cd /var/www/eedc

# Alle Tags holen
git fetch --tags

# Verfügbare Releases anzeigen
git tag -l

# Zu Release wechseln
git checkout v1.0.0

npm install --production
npm run build
pm2 restart eedc
```

### 4.4 Versions-Übersicht

| Version | Datum | Beschreibung |
|---------|-------|--------------|
| v1.0.0 | TBD | FRESH-START Schema, Community-Features |
| - | 2026-01-29 | Community-Seiten, Übersicht-Bearbeitung |

---

## 5. Checkliste für Updates

### Vor dem Update:
- [ ] Backup der .env.local Datei
- [ ] Aktuelle Version notieren (git log -1)
- [ ] Prüfen ob Datenbank-Migrationen nötig sind

### Nach dem Update:
- [ ] Build erfolgreich?
- [ ] Server gestartet? (pm2 status)
- [ ] Webseite erreichbar?
- [ ] Login funktioniert?
- [ ] Kritische Funktionen testen

### Bei Problemen:
- [ ] Logs prüfen (pm2 logs)
- [ ] Rollback zu vorherigem Stand
- [ ] Issue dokumentieren

---

## 6. Kontakt & Hilfe

Bei Problemen:
1. Logs sichern: `pm2 logs eedc > ~/eedc-error.log 2>&1`
2. Git-Status: `git status && git log -5 --oneline`
3. Mit diesen Infos Support kontaktieren
