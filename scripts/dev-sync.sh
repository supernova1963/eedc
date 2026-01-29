#!/bin/bash
# ============================================
# EEDC Entwicklungsrechner Synchronisation
# ============================================
# Nutzung:
#   ./dev-sync.sh              # Standard-Sync (stash, pull, pop)
#   ./dev-sync.sh --force      # Alle lokalen Änderungen verwerfen
#   ./dev-sync.sh --status     # Nur Status anzeigen
# ============================================

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== EEDC Dev Sync ===${NC}"
echo "Datum: $(date)"
echo ""

# Zum Projekt-Root wechseln (Script kann von überall aufgerufen werden)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR" || { echo -e "${RED}Fehler: Projekt-Verzeichnis nicht gefunden${NC}"; exit 1; }

echo "Projekt: $PROJECT_DIR"
echo ""

# Status anzeigen
show_status() {
    echo -e "${BLUE}=== Git Status ===${NC}"
    git status --short
    echo ""
    echo -e "${BLUE}=== Lokale Commits (nicht gepusht) ===${NC}"
    git log origin/main..HEAD --oneline 2>/dev/null || echo "Keine"
    echo ""
    echo -e "${BLUE}=== Remote Commits (nicht geholt) ===${NC}"
    git fetch origin --quiet
    git log HEAD..origin/main --oneline 2>/dev/null || echo "Keine"
}

# Nur Status
if [ "$1" == "--status" ]; then
    show_status
    exit 0
fi

# Force-Mode
if [ "$1" == "--force" ]; then
    echo -e "${RED}ACHTUNG: Alle lokalen Änderungen werden verworfen!${NC}"
    read -p "Fortfahren? (j/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Jj]$ ]]; then
        echo "Abgebrochen."
        exit 0
    fi

    echo ""
    echo -e "${YELLOW}Verwerfe lokale Änderungen...${NC}"
    git fetch origin
    git reset --hard origin/main
    git clean -fd

    echo ""
    echo -e "${YELLOW}Installiere Dependencies...${NC}"
    rm -rf node_modules
    npm install

    echo ""
    echo -e "${GREEN}Sync abgeschlossen (force)${NC}"
    exit 0
fi

# Standard-Sync
echo -e "${BLUE}Prüfe lokalen Status...${NC}"
echo ""

# Prüfen ob lokale Änderungen existieren
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}Lokale Änderungen gefunden:${NC}"
    git status --short
    echo ""

    echo "Optionen:"
    echo "  1) Stashen (temporär beiseite legen)"
    echo "  2) Committen"
    echo "  3) Verwerfen"
    echo "  4) Abbrechen"
    read -p "Wahl (1-4): " choice

    case $choice in
        1)
            echo ""
            echo -e "${YELLOW}Stashe Änderungen...${NC}"
            git stash push -m "Auto-stash vor sync $(date +%Y%m%d-%H%M)"
            STASHED=true
            ;;
        2)
            echo ""
            read -p "Commit-Nachricht: " msg
            git add .
            git commit -m "$msg"
            ;;
        3)
            echo ""
            echo -e "${YELLOW}Verwerfe Änderungen...${NC}"
            git checkout -- .
            git clean -fd
            ;;
        4)
            echo "Abgebrochen."
            exit 0
            ;;
        *)
            echo "Ungültige Wahl. Abgebrochen."
            exit 1
            ;;
    esac
fi

# Pull
echo ""
echo -e "${YELLOW}Hole Updates von GitHub...${NC}"
git fetch origin
git pull origin main

# Stash wieder anwenden
if [ "$STASHED" == "true" ]; then
    echo ""
    echo -e "${YELLOW}Wende gestashte Änderungen wieder an...${NC}"
    if git stash pop; then
        echo -e "${GREEN}Änderungen erfolgreich angewendet${NC}"
    else
        echo -e "${RED}Konflikte beim Anwenden des Stash!${NC}"
        echo "Bitte manuell auflösen."
    fi
fi

# Dependencies prüfen
if git diff HEAD@{1} --name-only 2>/dev/null | grep -q "package.json\|package-lock.json"; then
    echo ""
    echo -e "${YELLOW}package.json geändert - installiere Dependencies...${NC}"
    npm install
fi

# .next löschen wenn Build-Dateien geändert
if git diff HEAD@{1} --name-only 2>/dev/null | grep -qE "\.(tsx?|jsx?)$"; then
    echo ""
    echo -e "${YELLOW}Source-Dateien geändert - lösche .next Cache...${NC}"
    rm -rf .next
fi

echo ""
echo -e "${GREEN}=== Sync abgeschlossen ===${NC}"
echo ""
echo "Aktueller Stand: $(git log -1 --oneline)"
echo ""
echo "Nächste Schritte:"
echo "  npm run dev    # Entwicklungsserver starten"
echo "  npm run build  # Produktions-Build testen"
