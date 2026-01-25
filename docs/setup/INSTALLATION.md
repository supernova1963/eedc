# 🚀 EEDC Installation

## Schritt 1: Projekt in VS Code öffnen

```bash
cd eedc-fresh-projekt
code .
```

## Schritt 2: Dependencies installieren

```bash
npm install
```

## Schritt 3: Supabase konfigurieren

1. Kopiere `.env.local.example` zu `.env.local`:
```bash
cp .env.local.example .env.local
```

2. Öffne `.env.local` und füge deine Supabase Zugangsdaten ein:
```env
NEXT_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
```

## Schritt 4: Datenbank einrichten

1. Gehe zu https://supabase.com/dashboard
2. Öffne dein Projekt
3. Klicke auf "SQL Editor" im Menü
4. Öffne die Datei `sql/investition-monatsdaten.sql`
5. Kopiere den kompletten Inhalt
6. Füge ihn in den SQL Editor ein
7. Klicke "Run"

✅ Datenbank ist fertig!

## Schritt 5: Starten

```bash
npm run dev
```

Öffne: http://localhost:3000

## ✅ Fertig!

Du solltest jetzt sehen:
- Dashboard mit KPIs
- Menü: Auswertung, Übersicht, Daten erfassen
- Monatlicher Verlauf Chart

## 🎯 Erste Schritte

1. **Investition erfassen:**
   - Gehe zu http://localhost:3000/investitionen
   - Klicke "➕ Neue Investition"
   - Wähle "E-Auto"
   - Fülle Formular aus

2. **E-Auto Monatsdaten:**
   - Gehe zu http://localhost:3000/eingabe
   - Tab "🚗 E-Auto"
   - Erfasse Monatsdaten

3. **Auswertung ansehen:**
   - Gehe zu http://localhost:3000/auswertung
   - Tab "🚗 E-Auto Details"

## 📁 Struktur

```
eedc-fresh-projekt/
├── app/                    # Pages
│   ├── page.tsx           # Dashboard
│   ├── eingabe/           # Daten erfassen
│   ├── uebersicht/        # PV-Tabelle
│   ├── auswertung/        # Auswertungen
│   └── investitionen/     # Verwaltung
├── components/            # React Komponenten
├── lib/                   # Supabase Client
└── sql/                   # DB Schema
```

## 🆘 Probleme?

**Port 3000 belegt?**
```bash
npm run dev -- -p 3001
```

**Dependencies fehlen?**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Supabase Fehler?**
- Prüfe .env.local
- Prüfe SQL wurde ausgeführt
- Prüfe Supabase Projekt läuft
