#!/bin/bash
# Installations-Script für EEDC Next.js Projekt

echo "=================================="
echo "📦 EEDC Projekt Setup"
echo "=================================="
echo ""

# Prüfen ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    echo "❌ Fehler: package.json nicht gefunden!"
    echo "   Bitte führe dieses Script im eedc-webapp Verzeichnis aus."
    exit 1
fi

# 1. Abhängigkeiten installieren
echo "📥 Installiere Abhängigkeiten..."
npm install @supabase/supabase-js recharts date-fns

# 2. Ordnerstruktur erstellen
echo "📁 Erstelle Ordnerstruktur..."
mkdir -p lib components

# 3. Prüfen ob Dateien existieren
SCRIPT_DIR="$(dirname "$0")"
if [ ! -f "$SCRIPT_DIR/supabase.ts" ]; then
    echo "❌ Fehler: Quelldateien nicht gefunden!"
    echo "   Stelle sicher, dass alle .ts/.tsx Dateien im gleichen Verzeichnis wie dieses Script sind."
    exit 1
fi

# 4. Dateien kopieren
echo "📄 Kopiere Dateien..."
cp "$SCRIPT_DIR/supabase.ts" lib/supabase.ts
cp "$SCRIPT_DIR/page.tsx" app/page.tsx
cp "$SCRIPT_DIR/DashboardStats.tsx" components/DashboardStats.tsx
cp "$SCRIPT_DIR/MonthlyChart.tsx" components/MonthlyChart.tsx
cp "$SCRIPT_DIR/env.local" .env.local

echo ""
echo "✅ Installation abgeschlossen!"
echo ""
echo "🔧 Nächste Schritte:"
echo "   1. Bearbeite .env.local und füge deinen Supabase ANON_KEY ein"
echo "   2. Starte den Dev-Server mit: npm run dev"
echo "   3. Öffne http://localhost:3000 im Browser"
echo ""
