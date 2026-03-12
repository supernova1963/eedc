#!/bin/bash
# =============================================================================
# release.sh – Release im eedc-Repo (Source of Truth) vorbereiten
#
# Verwendung:
#   cd /home/gernot/claude/eedc
#   ./scripts/release.sh 2.8.6
#
# Was passiert:
#   1. Prüft ob Working Directory clean ist
#   2. Bumpt Version in config.py + version.ts
#   3. Zeigt Diff zur Kontrolle
#   4. Committed + taggt (aber pusht NICHT!)
#
# Danach MANUELL:
#   git push && git push origin v2.8.6
#
# =============================================================================

set -euo pipefail

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Argumente prüfen ---
if [ $# -ne 1 ]; then
    echo -e "${RED}Verwendung: $0 <version>${NC}"
    echo "  Beispiel: $0 2.8.6"
    exit 1
fi

VERSION="$1"

# Validierung: Semver-Format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Ungültiges Versionsformat: $VERSION${NC}"
    echo "  Erwartet: X.Y.Z (z.B. 2.8.6)"
    exit 1
fi

# --- Voraussetzungen prüfen ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
cd "$REPO_DIR"

# Richtiges Repo?
if [ ! -f "backend/core/config.py" ]; then
    echo -e "${RED}Fehler: Muss im eedc-Repo ausgeführt werden!${NC}"
    exit 1
fi

# Working Directory clean?
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${RED}Fehler: Working Directory ist nicht clean!${NC}"
    echo "Bitte zuerst alle Änderungen committen oder stashen."
    git status --short
    exit 1
fi

# Auf main?
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo -e "${RED}Fehler: Nicht auf main-Branch! (aktuell: $BRANCH)${NC}"
    exit 1
fi

# Tag existiert schon?
if git tag -l "v$VERSION" | grep -q .; then
    echo -e "${RED}Fehler: Tag v$VERSION existiert bereits!${NC}"
    exit 1
fi

# Aktuelle Version lesen
CURRENT=$(grep 'APP_VERSION' backend/core/config.py | head -1 | sed 's/.*"\(.*\)"/\1/')
echo -e "${CYAN}=== EEDC Release ===${NC}"
echo -e "  Aktuell: ${YELLOW}$CURRENT${NC}"
echo -e "  Neu:     ${GREEN}$VERSION${NC}"
echo ""

# --- Version bumpen ---
echo -e "${CYAN}[1/3] Versionsnummern aktualisieren...${NC}"

# backend/core/config.py
sed -i "s/^APP_VERSION = \".*\"/APP_VERSION = \"$VERSION\"/" backend/core/config.py

# frontend/src/config/version.ts
sed -i "s/^export const APP_VERSION = '.*'/export const APP_VERSION = '$VERSION'/" frontend/src/config/version.ts

echo "  backend/core/config.py         → $VERSION"
echo "  frontend/src/config/version.ts  → $VERSION"

# --- Diff anzeigen ---
echo ""
echo -e "${CYAN}[2/3] Änderungen:${NC}"
git diff --stat
echo ""
git diff

# --- Commit + Tag ---
echo ""
echo -e "${CYAN}[3/3] Commit + Tag erstellen...${NC}"
git add backend/core/config.py frontend/src/config/version.ts
git commit -m "release: v$VERSION"
git tag -a "v$VERSION" -m "Version $VERSION"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Release v$VERSION vorbereitet!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Nächste Schritte (${YELLOW}MANUELL${NC}):"
echo ""
echo -e "  ${CYAN}1. Push:${NC}"
echo "     git push && git push origin v$VERSION"
echo ""
echo -e "  ${CYAN}2. Sync in eedc-homeassistant:${NC}"
echo "     cd /home/gernot/claude/eedc-homeassistant"
echo "     ./scripts/sync-and-release.sh $VERSION"
echo ""
