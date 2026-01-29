# EEDC Deployment & Synchronisation

**Stand:** 2026-01-29

Diese Dokumentation beschreibt verschiedene Wege zur Aktualisierung des Produktionsservers und zur Synchronisation zwischen Entwicklungsrechnern.

---

## Inhaltsverzeichnis

1. [Entwicklungsrechner synchronisieren](#1-entwicklungsrechner-synchronisieren)
2. [Produktionsserver aktualisieren](#2-produktionsserver-aktualisieren)
3. [Server Autostart einrichten](#3-server-autostart-einrichten)
4. [Problembehandlung](#4-problembehandlung)
5. [Release-Management (Optional)](#5-release-management-optional)
6. [Checkliste für Updates](#6-checkliste-für-updates)
7. [Kontakt & Hilfe](#7-kontakt--hilfe)

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

## 3. Server Autostart einrichten

Die WebApp soll automatisch starten wenn der Server hochfährt. Es gibt zwei gängige Methoden: **pm2** (empfohlen, einfacher) oder **systemd** (Linux-nativ).

### 3.1 Methode A: pm2 (Empfohlen)

pm2 ist ein Prozess-Manager für Node.js mit eingebauter Autostart-Funktion.

#### Installation von pm2

```bash
# Als root oder mit sudo
npm install -g pm2
```

#### App mit pm2 starten

```bash
cd /var/www/eedc

# App starten (Production Mode)
pm2 start npm --name "eedc" -- start

# Alternativer Start mit mehr Optionen
pm2 start npm --name "eedc" -- start -- -p 3000

# Status prüfen
pm2 status

# Logs anzeigen
pm2 logs eedc
```

#### Autostart aktivieren

```bash
# Startup-Script generieren (einmalig)
pm2 startup

# Dieser Befehl gibt einen Befehl aus, den Sie als root ausführen müssen!
# Beispiel-Ausgabe:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u www-data --hp /home/www-data

# Diesen ausgegebenen Befehl kopieren und ausführen:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u IHRUSER --hp /home/IHRUSER

# Aktuelle Prozess-Liste speichern
pm2 save
```

#### pm2 Befehle Übersicht

```bash
pm2 status              # Status aller Apps
pm2 logs eedc           # Logs anzeigen
pm2 logs eedc --lines 100  # Letzte 100 Zeilen
pm2 restart eedc        # Neustart
pm2 stop eedc           # Stoppen
pm2 delete eedc         # Entfernen
pm2 monit               # Echtzeit-Monitor

# Nach Server-Neustart prüfen
pm2 resurrect           # Gespeicherte Apps wiederherstellen (normalerweise automatisch)
```

#### pm2 Konfigurationsdatei (Optional)

Für mehr Kontrolle können Sie eine `ecosystem.config.js` erstellen:

```bash
# /var/www/eedc/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'eedc',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/eedc',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/eedc/error.log',
    out_file: '/var/log/eedc/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
```

```bash
# Log-Verzeichnis erstellen
sudo mkdir -p /var/log/eedc
sudo chown $USER:$USER /var/log/eedc

# Mit Konfigurationsdatei starten
pm2 start ecosystem.config.js
pm2 save
```

### 3.2 Methode B: systemd (Linux-nativ)

systemd ist der Standard-Service-Manager auf modernen Linux-Systemen.

#### Service-Datei erstellen

```bash
sudo nano /etc/systemd/system/eedc.service
```

Inhalt der Datei:

```ini
[Unit]
Description=EEDC PV-Anlagen WebApp
Documentation=https://github.com/supernova1963/eedc
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/eedc

# Node.js Pfad - anpassen falls nötig!
# Finden mit: which node
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start

# Neustart bei Absturz
Restart=on-failure
RestartSec=10

# Logging
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=eedc

[Install]
WantedBy=multi-user.target
```

#### Service aktivieren und starten

```bash
# systemd neu laden
sudo systemctl daemon-reload

# Service aktivieren (Autostart)
sudo systemctl enable eedc

# Service starten
sudo systemctl start eedc

# Status prüfen
sudo systemctl status eedc
```

#### systemd Befehle Übersicht

```bash
sudo systemctl status eedc    # Status anzeigen
sudo systemctl start eedc     # Starten
sudo systemctl stop eedc      # Stoppen
sudo systemctl restart eedc   # Neustarten
sudo systemctl enable eedc    # Autostart aktivieren
sudo systemctl disable eedc   # Autostart deaktivieren

# Logs anzeigen
sudo journalctl -u eedc -f              # Live-Logs
sudo journalctl -u eedc -n 100          # Letzte 100 Zeilen
sudo journalctl -u eedc --since today   # Logs von heute
```

### 3.3 Nginx als Reverse Proxy (Optional aber empfohlen)

Für Produktionsumgebungen empfiehlt sich Nginx vor der Node.js App:

#### Nginx installieren

```bash
sudo apt update
sudo apt install nginx
```

#### Nginx Konfiguration

```bash
sudo nano /etc/nginx/sites-available/eedc
```

Inhalt:

```nginx
server {
    listen 80;
    server_name ihre-domain.de www.ihre-domain.de;

    # Weiterleitung zu HTTPS (wenn SSL eingerichtet)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Statische Dateien cachen
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 60m;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Nginx aktivieren

```bash
# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/eedc /etc/nginx/sites-enabled/

# Konfiguration testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx
```

#### SSL mit Let's Encrypt (Optional)

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx

# Zertifikat holen (interaktiv)
sudo certbot --nginx -d ihre-domain.de -d www.ihre-domain.de

# Auto-Renewal testen
sudo certbot renew --dry-run
```

### 3.4 Autostart prüfen

Nach der Einrichtung sollten Sie einen Neustart testen:

```bash
# Server neu starten
sudo reboot

# Nach Neustart prüfen:
# Bei pm2:
pm2 status

# Bei systemd:
sudo systemctl status eedc

# Webseite im Browser aufrufen
curl http://localhost:3000
# oder
curl http://ihre-domain.de
```

### 3.5 Vergleich pm2 vs systemd

| Aspekt | pm2 | systemd |
|--------|-----|---------|
| Installation | npm install -g pm2 | Bereits vorhanden |
| Komplexität | Einfacher | Mehr Konfiguration |
| Monitoring | Eingebaut (pm2 monit) | Separat (journalctl) |
| Cluster-Mode | Ja (pm2 -i max) | Manuell |
| Log-Rotation | Eingebaut | Über journald |
| Empfehlung | Für Einsteiger | Für erfahrene Admins |

**Empfehlung:** Starten Sie mit **pm2** - es ist einfacher einzurichten und bietet gute Monitoring-Funktionen.

---

## 4. Problembehandlung

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

## 5. Release-Management (Optional)

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

## 6. Checkliste für Updates

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

## 7. Kontakt & Hilfe

Bei Problemen:
1. Logs sichern: `pm2 logs eedc > ~/eedc-error.log 2>&1`
2. Git-Status: `git status && git log -5 --oneline`
3. Mit diesen Infos Support kontaktieren
