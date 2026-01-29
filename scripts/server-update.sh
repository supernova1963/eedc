#!/bin/bash
# ============================================
# EEDC Server Update Script
# ============================================
# Nutzung:
#   ./server-update.sh           # Update auf neuesten main
#   ./server-update.sh v1.0.0    # Update auf spezifisches Tag/Version
#   ./server-update.sh abc1234   # Update auf spezifischen Commit
#   ./server-update.sh --rollback # Zurück zum vorherigen Stand
# ============================================

set -e  # Bei Fehler abbrechen

# Konfiguration - ANPASSEN!
APP_DIR="/var/www/eedc"
PM2_NAME="eedc"
BACKUP_DIR="/var/www/eedc-backups"

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== EEDC Update Script ===${NC}"
echo "Datum: $(date)"
echo "Ziel: $1"
echo ""

cd "$APP_DIR" || { echo -e "${RED}Fehler: Verzeichnis $APP_DIR nicht gefunden${NC}"; exit 1; }

# Aktuelle Version speichern
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git branch --show-current)
echo "Aktueller Stand: $CURRENT_COMMIT ($CURRENT_BRANCH)"

# Rollback-Funktion
if [ "$1" == "--rollback" ]; then
    if [ -f "$BACKUP_DIR/last-commit.txt" ]; then
        LAST_COMMIT=$(cat "$BACKUP_DIR/last-commit.txt")
        echo -e "${YELLOW}Rollback zu: $LAST_COMMIT${NC}"
        git checkout "$LAST_COMMIT"
        npm install --production
        npm run build
        pm2 restart "$PM2_NAME"
        echo -e "${GREEN}Rollback abgeschlossen${NC}"
        exit 0
    else
        echo -e "${RED}Keine Rollback-Information gefunden${NC}"
        exit 1
    fi
fi

# Backup erstellen
mkdir -p "$BACKUP_DIR"
echo "$CURRENT_COMMIT" > "$BACKUP_DIR/last-commit.txt"
cp .env.local "$BACKUP_DIR/.env.local.backup" 2>/dev/null || true

# Git Updates holen
echo ""
echo -e "${YELLOW}Hole Updates von GitHub...${NC}"
git fetch origin
git fetch --tags

# Ziel bestimmen
TARGET="${1:-main}"

if [ "$TARGET" == "main" ]; then
    echo "Update auf neuesten main Branch..."
    git checkout main
    git pull origin main
elif git tag -l | grep -q "^$TARGET$"; then
    echo "Wechsle zu Tag: $TARGET"
    git checkout "$TARGET"
elif git rev-parse --verify "$TARGET" >/dev/null 2>&1; then
    echo "Wechsle zu Commit: $TARGET"
    git checkout "$TARGET"
else
    echo -e "${RED}Fehler: '$TARGET' ist kein gültiger Branch, Tag oder Commit${NC}"
    exit 1
fi

# Dependencies installieren
echo ""
echo -e "${YELLOW}Installiere Dependencies...${NC}"
npm install --production

# Build
echo ""
echo -e "${YELLOW}Baue Anwendung...${NC}"
npm run build

# Restart
echo ""
echo -e "${YELLOW}Starte Server neu...${NC}"
pm2 restart "$PM2_NAME"

# Status
echo ""
echo -e "${GREEN}=== Update abgeschlossen ===${NC}"
echo ""
pm2 status "$PM2_NAME"
echo ""
echo "Neuer Stand: $(git rev-parse HEAD)"
echo ""
echo -e "${YELLOW}Hinweis: Bei Problemen: ./server-update.sh --rollback${NC}"
