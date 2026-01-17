# 🌞 EEDC - Electronic Energy Data Collection

Komplettes Fresh Start Projekt - Sofort einsatzbereit!

## 🚀 Installation

### 1. Projekt öffnen
```bash
cd eedc-fresh-projekt
code .
```

### 2. Dependencies installieren
```bash
npm install
```

### 3. Supabase konfigurieren
```bash
# .env.local erstellen
cp .env.local.example .env.local

# Füge deine Supabase Zugangsdaten ein
```

### 4. Datenbank einrichten
```bash
# Gehe zu: https://supabase.com/dashboard
# SQL Editor öffnen
# Führe aus: sql/schema.sql
```

### 5. Starten
```bash
npm run dev
```

## 📁 Struktur

```
eedc-fresh-projekt/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard
│   ├── eingabe/           # Monatsdaten erfassen
│   ├── uebersicht/        # PV-Daten Tabelle
│   ├── auswertung/        # Auswertungen
│   └── investitionen/     # Investitions-Verwaltung
├── components/            # React Komponenten
├── lib/                   # Supabase Client + Types
└── sql/                   # Datenbank Schema
```

## ✅ Features

- PV-Anlage Monatsdaten
- Investitions-Verwaltung
- E-Auto Monatsdaten
- Auswertungen & Charts
- ROI-Berechnungen

## 🔧 Tech Stack

- Next.js 15
- React 19
- Supabase
- TypeScript
- Tailwind CSS
- Recharts
