# 🌞 eedc - Electronic Energy Data Collection
---

**DEPRECATED:** Dieses Projekt wird nicht mehr gepflegt.

---

Webanwendung zur Verwaltung und Auswertung von PV-Anlagen, E-Autos, Wärmepumpen, Speicher und Wallboxen.

---

## 🧪 Alpha-Tester Kurzanleitung

> **Ziel:** Schnell loslegen und erste Ergebnisse sehen!

### 1. Registrieren & Einloggen
- Öffne die App und registriere dich mit E-Mail
- Nach Login landest du auf dem Dashboard

### 2. Anlage anlegen (2 Min.)
**Menü → Anlagendaten** oder direkt `/anlage`
- Anlagenname eingeben (z.B. "Meine PV")
- **Leistung (kWp)** - wichtig für Kennzahlen!
- Einspeisevergütung (ct/kWh)
- Netzbezugspreis (€/kWh)
- **Speichern**

### 3. Investitionen erfassen (optional, für ROI)
**Menü → Investitionen → Neue Investition**
- **PV-Anlage**: Anschaffungskosten, Inbetriebnahme
- **Speicher**: Kapazität, Kosten
- **E-Auto**: km/Jahr, Verbrauch
- **Wärmepumpe**: JAZ, Wärmebedarf
- **Wallbox**: Kosten

### 4. Monatsdaten erfassen (5 Min.)
**Menü → Daten erfassen** oder `/eingabe`

**Wichtigste Felder:**
| Feld | Quelle | Hinweis |
|------|--------|---------|
| PV-Erzeugung (kWh) | Wechselrichter-App | Monatswert |
| Einspeisung (kWh) | Zähler/App | Was ins Netz ging |
| Netzbezug (kWh) | Stromzähler | Was aus dem Netz kam |
| Direktverbrauch (kWh) | Erzeugung - Einspeisung - Batterieladung | Wird oft berechnet |

**Mit Speicher zusätzlich:**
- Batterieladung (kWh)
- Batterieentladung (kWh)

**Tipp:** Die App berechnet Gesamtverbrauch, Eigenverbrauchsquote und Autarkiegrad automatisch!

### 5. Auswertungen ansehen
**Menü → Auswertungen** - verschiedene Tabs:
- **PV-Anlage**: Wirtschaftlichkeit, Charts
- **Monats-Details**: Detailanalyse mit Tooltips (Formeln!)
- **ROI-Analyse**: Return on Investment
- **Prognose vs. IST**: Vergleich mit Erwartung
- **KI-Analyse**: Automatische Empfehlungen

### 💡 Tipps für schnelle Ergebnisse

1. **Mindestens 3 Monate** erfassen für aussagekräftige Trends
2. **Hover über Werte** → Tooltips zeigen Berechnungsformeln
3. **Investitionen anlegen** → ROI und Amortisation werden berechnet
4. **CSV-Import** unter `/daten-import` für Bulk-Erfassung

### 🐛 Feedback & Bugs

Bitte melden unter: https://github.com/supernova1963/eedc/issues

---

## 🚀 Entwickler-Schnellstart

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
