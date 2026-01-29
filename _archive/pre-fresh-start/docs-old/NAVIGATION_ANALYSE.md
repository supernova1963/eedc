# Navigation & Menü - Analyse und Verbesserungsvorschläge

## 📊 Aktuelle Situation

### ❌ Probleme der aktuellen Navigation

1. **Kein einheitliches Layout**
   - Keine globale Navigation/Sidebar
   - Jede Seite hat eigene Button-Leiste
   - Inkonsistente Navigation zwischen Seiten

2. **Fehlende Struktur**
   - Keine Hauptnavigation
   - Kein visueller Hinweis auf aktuelle Seite
   - Schwer zu erkennen: "Wo bin ich?"

3. **Stammdaten nicht sichtbar**
   - Neue Stammdaten-Sektion nirgends verlinkt
   - Nutzer finden `/stammdaten` nicht
   - Keine Integration in bestehende Navigation

4. **Inkonsistente Schnellzugriffe**
   - Dashboard (/) hat eigene Buttons
   - Andere Seiten haben "Zurück"-Links
   - Keine einheitliche UX

5. **Mobile Navigation fehlt**
   - Keine responsive Hamburger-Menü
   - Buttons brechen auf kleinen Screens

---

## ✅ Vorgeschlagene Verbesserungen

### 1. Globale Navigation mit Sidebar

**Vorteile:**
- ✅ Immer sichtbar auf allen Seiten
- ✅ Klare Hierarchie
- ✅ Aktive Seite hervorgehoben
- ✅ Platz für zukünftige Features

**Struktur:**
```
┌─────────────────┬──────────────────────────────┐
│                 │                              │
│  🌞 EEDC        │         Seiteninhalt         │
│                 │                              │
│  ━━━━━━━━━━━    │                              │
│  📊 Dashboard   │                              │
│  📥 Eingabe     │                              │
│  💼 Investition │                              │
│  📋 Stammdaten  │  ◄─── NEU!                   │
│  📈 Auswertung  │                              │
│  ⚙️  Anlage     │                              │
│                 │                              │
│  ━━━━━━━━━━━    │                              │
│  👤 Profil      │                              │
│                 │                              │
└─────────────────┴──────────────────────────────┘
```

---

### 2. Vorgeschlagene Menü-Struktur

#### **Hauptnavigation (1. Ebene)**

```
📊 Dashboard        → /
📥 Daten erfassen   → /eingabe
💼 Investitionen    → /investitionen
📋 Stammdaten       → /stammdaten          ◄─── NEU!
📈 Auswertungen     → /auswertung
⚙️  Anlagen         → /anlage
```

#### **Stammdaten-Untermenü (2. Ebene)**

```
📋 Stammdaten
   ├─ 📄 Übersicht             → /stammdaten
   ├─ ⚡ Strompreise            → /stammdaten/strompreise
   ├─ 🔗 Investitions-Zuordnung → /stammdaten/zuordnung
   └─ ⚙️  Investitionstypen     → /stammdaten/investitionstypen
```

#### **Zukünftige Erweiterungen (vorbereitet)**

```
📈 Auswertungen
   ├─ 📊 Dashboard              → /auswertung
   ├─ 💰 Wirtschaftlichkeit     → /auswertung/wirtschaftlichkeit
   ├─ 🌱 CO₂-Bilanz             → /auswertung/co2
   ├─ 📊 Vergleiche             → /auswertung/vergleiche
   └─ 📁 Berichte               → /auswertung/berichte

💼 Investitionen
   ├─ 📄 Übersicht              → /investitionen
   ├─ ➕ Neue Investition       → /investitionen/neu
   ├─ 🚗 E-Auto                 → /investitionen?typ=e-auto
   ├─ ♨️  Wärmepumpe            → /investitionen?typ=waermepumpe
   └─ 🔋 Speicher               → /investitionen?typ=speicher
```

---

## 🎨 Design-Vorschlag

### Variante A: Sidebar (Desktop-First)

**Desktop:**
```
┌────────────┬──────────────────────────────────────┐
│ Sidebar    │ Content Area                         │
│ 250px      │ flex-1                               │
│            │                                      │
│ Logo       │ Breadcrumb: Dashboard > Stammdaten   │
│            │                                      │
│ Navigation │ ┌─────────────────────────────────┐ │
│            │ │                                 │ │
│            │ │     Seiteninhalt                │ │
│            │ │                                 │ │
│            │ └─────────────────────────────────┘ │
└────────────┴──────────────────────────────────────┘
```

**Mobile:**
```
┌──────────────────────────────────────┐
│ ☰ EEDC                        👤     │ ← Top Bar
├──────────────────────────────────────┤
│                                      │
│                                      │
│         Seiteninhalt                 │
│                                      │
│                                      │
└──────────────────────────────────────┘

☰ = Hamburger Menu (öffnet Sidebar)
```

---

### Variante B: Top Navigation (Horizontal)

**Desktop:**
```
┌──────────────────────────────────────────────────┐
│ 🌞 EEDC  │ Dashboard │ Eingabe │ Stammdaten │... │
├──────────────────────────────────────────────────┤
│                                                  │
│  Breadcrumb: Stammdaten > Strompreise            │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │                                            │ │
│  │         Seiteninhalt                       │ │
│  │                                            │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 💡 Empfehlung: Hybrid-Ansatz

### Desktop: Sidebar
- Mehr Platz für Navigation
- Untermenüs möglich
- Professioneller Look

### Mobile: Top Bar + Hamburger
- Platzsparend
- Standard-UX
- Alle Features zugänglich

---

## 🔧 Implementierungs-Komponenten

### 1. Shared Layout Component

```typescript
// components/AppLayout.tsx
interface NavItem {
  icon: string
  label: string
  href: string
  children?: NavItem[]
  badge?: string  // z.B. "NEU" für Stammdaten
}

const navigation: NavItem[] = [
  { icon: '📊', label: 'Dashboard', href: '/' },
  { icon: '📥', label: 'Daten erfassen', href: '/eingabe' },
  { icon: '💼', label: 'Investitionen', href: '/investitionen' },
  {
    icon: '📋',
    label: 'Stammdaten',
    href: '/stammdaten',
    badge: 'NEU',
    children: [
      { icon: '⚡', label: 'Strompreise', href: '/stammdaten/strompreise' },
      { icon: '🔗', label: 'Zuordnung', href: '/stammdaten/zuordnung' },
    ]
  },
  { icon: '📈', label: 'Auswertungen', href: '/auswertung' },
  { icon: '⚙️', label: 'Anlagen', href: '/anlage' },
]
```

### 2. Sidebar Component

```typescript
// components/Sidebar.tsx
- Logo
- Haupt-Navigation (1. Ebene)
- Untermenü (2. Ebene, ausklappbar)
- Aktive Seite hervorheben
- Badge für neue Features
- Responsive (ausblendbar)
```

### 3. Breadcrumb Component

```typescript
// components/Breadcrumb.tsx
Dashboard > Stammdaten > Strompreise > Neu
```

### 4. Mobile Header

```typescript
// components/MobileHeader.tsx
- Hamburger Button
- Logo
- Profil/Settings
```

---

## 📱 Responsive Verhalten

### Desktop (> 1024px)
- Sidebar permanent sichtbar (250px)
- Content Area flex

### Tablet (768px - 1024px)
- Sidebar ausklappbar
- Icon-only Sidebar möglich
- Top Navigation Alternative

### Mobile (< 768px)
- Top Bar mit Hamburger
- Sidebar als Overlay
- Touch-optimierte Buttons

---

## 🎯 Breadcrumb-Beispiele

```
/                           → Dashboard
/stammdaten                 → Dashboard > Stammdaten
/stammdaten/strompreise     → Dashboard > Stammdaten > Strompreise
/stammdaten/strompreise/neu → Dashboard > Stammdaten > Strompreise > Neu erfassen
/investitionen              → Dashboard > Investitionen
/investitionen/neu          → Dashboard > Investitionen > Neue Investition
/auswertung                 → Dashboard > Auswertungen
```

---

## ✨ Zusätzliche Features

### 1. Suchfunktion (Zukunft)
```
🔍 Suche...
```
- Globale Suche in Navigation
- Investitionen durchsuchen
- Monatsdaten filtern

### 2. Benachrichtigungen
```
🔔 (3)
```
- Fehlende Monatsdaten
- Wartungserinnerungen
- System-Updates

### 3. Hilfe & Dokumentation
```
❓ Hilfe
```
- Inline-Hilfe
- Dokumentation
- Video-Tutorials

### 4. Schnellzugriffe (Favoriten)
```
⭐ Favoriten
```
- Oft genutzte Seiten
- Anpassbar

---

## 🚀 Migrations-Plan

### Phase 1: Basis-Layout (Woche 1)
- [x] Shared Layout Component
- [x] Sidebar Component
- [x] Navigation-Items definiert
- [x] Mobile Header

### Phase 2: Integration (Woche 2)
- [x] Alle Seiten nutzen Layout
- [x] Breadcrumbs implementiert
- [x] Stammdaten-Menü integriert
- [x] Responsive getestet

### Phase 3: Verfeinerung (Woche 3)
- [x] Untermenüs (Stammdaten, Auswertung)
- [x] Icons optimiert
- [x] Transitions & Animationen
- [x] Dark Mode (optional)

### Phase 4: Features (Woche 4+)
- [ ] Suchfunktion
- [ ] Benachrichtigungen
- [ ] Favoriten
- [ ] Keyboard Shortcuts

---

## 📋 Checkliste für Navigation

### Must-Have (Priorität 1)
- [ ] Globales Layout mit Sidebar
- [ ] Hauptnavigation (6 Punkte)
- [ ] Stammdaten im Menü
- [ ] Mobile Hamburger-Menü
- [ ] Aktive Seite hervorheben
- [ ] Breadcrumbs

### Nice-to-Have (Priorität 2)
- [ ] Untermenü für Stammdaten
- [ ] Untermenü für Auswertungen
- [ ] Badge für neue Features ("NEU")
- [ ] Smooth Transitions
- [ ] Icon-only Sidebar Modus

### Future (Priorität 3)
- [ ] Suchfunktion
- [ ] Benachrichtigungen
- [ ] Favoriten/Bookmarks
- [ ] Keyboard Shortcuts (/, Ctrl+K)
- [ ] Dark Mode Toggle

---

## 🎨 Farb-Schema

### Navigations-Elemente
- **Inaktiv:** `text-gray-600`
- **Hover:** `bg-gray-100 text-gray-900`
- **Aktiv:** `bg-blue-100 text-blue-700` + fetter Font
- **Badge "NEU":** `bg-green-500 text-white text-xs`

### Sidebar
- **Background:** `bg-white border-r border-gray-200`
- **Mobile Overlay:** `bg-white shadow-2xl`

---

## 🔄 Workflow mit neuer Navigation

### Szenario: Strompreis erfassen

**Alt (aktuell):**
```
1. / (Dashboard)
2. URL manuell eingeben: /stammdaten/strompreise/neu
```

**Neu (vorgeschlagen):**
```
1. / (Dashboard)
2. Klick: Stammdaten (Sidebar)
3. Untermenü erscheint
4. Klick: Strompreise
5. Button: + Neuer Strompreis
```

oder noch besser:

```
1. / (Dashboard)
2. Schnellzugriff-Karte: "Stammdaten verwalten"
3. Direkt zu /stammdaten
4. Klick: Strompreise-Karte
5. Button: + Neuer Strompreis
```

---

## 💬 Zusammenfassung

### Aktuelle Probleme:
1. ❌ Keine globale Navigation
2. ❌ Stammdaten nicht auffindbar
3. ❌ Inkonsistente UX
4. ❌ Keine Mobile-Navigation

### Vorgeschlagene Lösung:
1. ✅ Sidebar mit Hauptnavigation
2. ✅ Stammdaten prominent platziert
3. ✅ Einheitliches Layout
4. ✅ Responsive mit Hamburger
5. ✅ Breadcrumbs für Orientierung
6. ✅ Ausbaufähig für Features

### Nächste Schritte:
1. **Shared Layout** erstellen
2. **Sidebar Component** bauen
3. **Alle Seiten** auf Layout umstellen
4. **Stammdaten-Menü** integrieren
5. **Mobile testen**

---

**Status:** Bereit für Implementierung 🚀

Soll ich mit der Implementierung des neuen Layouts beginnen?
