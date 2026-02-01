#!/bin/bash
# ============================================
# EEDC Deployment Script
# ============================================
# Aktualisiert den Server auf den neuesten GitHub-Stand
#
# Verwendung: ./scripts/deploy.sh
# ============================================

set -e  # Bei Fehler abbrechen

echo "============================================"
echo "EEDC Deployment - $(date)"
echo "============================================"

# Ins Projektverzeichnis wechseln
cd ~/eedc

echo ""
echo "📥 1. Git-Updates holen..."
git fetch origin

echo ""
echo "🔄 2. Auf neuesten Stand zurücksetzen..."
git reset --hard origin/main

echo ""
echo "📦 3. Dependencies installieren..."
npm install --silent

echo ""
echo "🔨 4. Produktions-Build erstellen..."
npm run build

echo ""
echo "🔄 5. Service neu starten..."
sudo systemctl restart eedc

echo ""
echo "⏳ Warte 3 Sekunden auf Service-Start..."
sleep 3

echo ""
echo "✅ 6. Service-Status:"
sudo systemctl status eedc --no-pager -l | head -20

echo ""
echo "============================================"
echo "✅ Deployment abgeschlossen!"
echo "============================================"
