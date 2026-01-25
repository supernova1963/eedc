# 🌞 eedc - Electronic Energy Data Collection

Webanwendung zur Verwaltung und Auswertung von PV-Anlagen, E-Autos und Investitionen.

## 🚀 Schnellstart

### 1. Installation
```bash
npm install
```

### 2. Umgebungsvariablen
```bash
cp .env.local.example .env.local
# Supabase URL und anon key in .env.local eintragen
```

### 3. Datenbank Setup
```bash
# In Supabase Dashboard > SQL Editor:
# 1. scripts/create-schema.sql ausführen
# 2. scripts/fix-all-rls-policies.sql ausführen
# 3. scripts/finalize-setup.sql ausführen
```

### 4. Anwendung starten
```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) im Browser.

## 📁 Projektstruktur

```
eedc-webapp/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth Pages (login, register)
│   ├── dashboard/                # Dashboard & Analytics
│   ├── eingabe/                  # Monatsdaten Erfassung
│   ├── uebersicht/               # Daten Übersichten
│   ├── auswertung/              # Auswertungen & Charts
│   ├── investitionen/            # Investitions-Verwaltung
│   └── stammdaten/               # Stammdaten (Anlagen, Typen)
├── components/                   # React Komponenten
│   ├── AppLayout.tsx            # Haupt-Layout mit Sidebar
│   ├── Sidebar.tsx              # Dynamische Navigation
│   └── ConditionalLayout.tsx    # Layout-Steuerung
├── lib/                          # Core Libraries
│   ├── supabase-*.ts            # Supabase Clients
│   ├── auth-actions.ts          # Server Actions für Auth
│   └── types.ts                 # TypeScript Definitionen
├── hooks/                        # Custom React Hooks
├── scripts/                      # Datenbank Scripts
│   ├── create-schema.sql        # Schema Erstellung
│   ├── fix-all-rls-policies.sql # RLS Policies
│   ├── finalize-setup.sql       # Setup Finalisierung
│   └── archive/                 # Alte Debug Scripts
└── docs/                         # Dokumentation
    ├── setup/                   # Setup Guides
    ├── guides/                  # Feature Guides
    ├── troubleshooting/         # Debugging Docs
    └── release-notes/           # Release Notes
```

## ✨ Features

### 🔐 Authentication & Multi-User
- Benutzerregistrierung und Login
- Multi-Anlagen-Support pro Benutzer
- Row Level Security (RLS) für Datenisolation
- Session Management mit Supabase Auth

### 📊 PV-Anlagen Verwaltung
- Monatsdaten Erfassung (Erzeugung, Verbrauch, Einspeisung)
- Mehrere Anlagen pro Benutzer
- Dynamische Sidebar basierend auf Anlagen
- Auswertungen und Charts

### 🚗 E-Auto Tracking
- Monatsdaten für Fahrzeuge
- Stromverbrauch und Kosten
- Integration mit PV-Anlage

### 💰 Investitions-Verwaltung
- Erfassung von Investitionen (PV, Wärmepumpe, Speicher, etc.)
- ROI-Berechnungen
- Amortisationszeit
- Alternative Investitionen
- CO₂-Einsparungen

### 📈 Auswertungen
- Jahresübersicht Finanzen
- Jahresübersicht Energiedaten
- Investitions-Dashboard
- Individuelle Auswertungen pro Anlage

### 📥 Daten-Import
- CSV-Import für Monatsdaten
- Dynamisches Template basierend auf Anlage
- Bulk-Import Unterstützung

## 🔧 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Charts**: Recharts
- **Deployment**: Vercel-ready

## 📚 Dokumentation

- [Installation & Setup](docs/setup/INSTALLATION.md)
- [Datenbank Setup](docs/setup/DATEN_IMPORT.md)
- [Authentication System](docs/setup/AUTHENTICATION_SETUP.md)
- [Feature Guides](docs/guides/)
- [Troubleshooting](docs/troubleshooting/)
- [Release Notes](docs/release-notes/)

## 🐛 Troubleshooting

Bei Problemen siehe:
- [Debugging Anleitung](docs/troubleshooting/DEBUGGING_ANLEITUNG.md)
- [Reset Anleitung](docs/setup/RESET_ANLEITUNG.md)
- [RLS Fix Guide](docs/troubleshooting/FIX_REGISTRATION_RLS.md)

## 📝 Development

```bash
# Development Server
npm run dev

# TypeScript Check
npm run type-check

# Linting
npm run lint

# Build für Production
npm run build
```

## 🔄 Version

**Current Version**: 1.1.0
Siehe [Release Notes](docs/release-notes/RELEASE_NOTES.md) für Details.

## 📄 Lizenz

Dieses Projekt ist für private Nutzung bestimmt.
