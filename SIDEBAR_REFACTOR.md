# Sidebar Refactor - Auswertungen als Untermenü

**Datum**: 2026-01-24
**Version**: 1.2.0
**Status**: ✅ Implementiert

---

## Änderungen

### Problem
Die Auswertungs-Seite hatte eine horizontale Tab-Navigation mit 10 verschiedenen Ansichten. Dies führte zu:
- Überfüllter Tab-Leiste
- Schlechter Übersicht
- Umständlicher Navigation (erst zur Auswertungs-Seite, dann Tab wählen)
- Schwieriger Orientierung bei vielen Tabs

### Lösung
Verschiebung der Tab-Navigation in die linke Sidebar als Untermenü-Struktur unter "Auswertungen".

---

## Implementierung

### 1. Sidebar.tsx
**Änderungen**:
- `navigation` Array erweitert um `children` für "Auswertungen"
- 10 Untermenü-Punkte hinzugefügt (mit Query-Parametern)
- `expandedItems` State um `/auswertung` erweitert (standardmäßig aufgeklappt)
- `isActive()` Funktion angepasst für Query-Parameter-Support

**Neue Untermenü-Punkte**:
1. PV-Anlage (`/auswertung?tab=pv`)
2. E-Auto (`/auswertung?tab=e-auto`)
3. Wärmepumpe (`/auswertung?tab=waermepumpe`)
4. Speicher (`/auswertung?tab=speicher`)
5. Gesamtbilanz (`/auswertung?tab=gesamt`)
6. ROI-Analyse (`/auswertung?tab=roi`)
7. CO₂-Impact (`/auswertung?tab=co2`)
8. Prognose vs. IST (`/auswertung?tab=prognose`)
9. Monats-Details (`/auswertung?tab=monatsdetail`)
10. Optimierung (`/auswertung?tab=optimierung`)

### 2. app/auswertung/page.tsx
**Änderungen**:
- Tab-Navigation entfernt (gesamter `<nav>` Block mit allen Links)
- Header vereinfacht mit dynamischen Titeln und Beschreibungen basierend auf `activeTab`
- Funktionalität bleibt unverändert (alle Tabs funktionieren weiterhin)

**Neuer Header**:
```typescript
<h1>
  {activeTab === 'pv' && 'PV-Anlage Auswertung'}
  {activeTab === 'roi' && 'ROI-Analyse'}
  // ... für alle Tabs
</h1>
<p className="text-sm text-gray-600">
  {activeTab === 'pv' && 'Wirtschaftlichkeit und Ertrag deiner PV-Anlage'}
  // ... passende Beschreibung für jeden Tab
</p>
```

---

## Vorteile

### Benutzerfreundlichkeit
- ✅ **Direktere Navigation**: Ein Klick zum Ziel (statt Seite → Tab)
- ✅ **Bessere Übersicht**: Alle Auswertungen in einer hierarchischen Struktur
- ✅ **Persistente Navigation**: Sidebar immer sichtbar
- ✅ **Mehr Platz**: Content-Bereich größer ohne Tab-Leiste

### Technisch
- ✅ **Konsistente Navigation**: Alle Bereiche nutzen dieselbe Sidebar-Struktur
- ✅ **Expandierbar**: Einfach weitere Auswertungen hinzufügen
- ✅ **Standardmäßig aufgeklappt**: Auswertungen-Untermenü beim Start geöffnet
- ✅ **Query-Parameter-Support**: `isActive()` erkennt aktive Untermenü-Links

---

## Dateien geändert

```
components/
  └── Sidebar.tsx                    (Untermenü hinzugefügt, ~30 Zeilen)

app/
  └── auswertung/
      └── page.tsx                   (Tab-Navigation entfernt, Header angepasst, ~150 Zeilen weniger)

SIDEBAR_REFACTOR.md                  (Neu, Dokumentation)
```

---

## Breaking Changes

**Keine**. Die URLs und Query-Parameter bleiben identisch:
- `/auswertung?tab=pv` → funktioniert wie vorher
- `/auswertung?tab=roi` → funktioniert wie vorher
- Alle Links und Bookmarks bleiben gültig

---

## Navigation-Struktur (Neu)

```
Sidebar
├── Dashboard (/)
├── Daten erfassen (/eingabe)
├── Daten importieren (/daten-import) [NEU Badge]
├── Investitionen (/investitionen)
├── Stammdaten (/stammdaten) [Expandierbar]
│   ├── Übersicht
│   ├── Strompreise
│   └── Zuordnung
├── Auswertungen (/auswertung) [Expandierbar, Standard: aufgeklappt]
│   ├── PV-Anlage
│   ├── E-Auto
│   ├── Wärmepumpe
│   ├── Speicher
│   ├── Gesamtbilanz
│   ├── ROI-Analyse
│   ├── CO₂-Impact
│   ├── Prognose vs. IST
│   ├── Monats-Details
│   └── Optimierung
└── Anlagen (/anlage)
```

---

## UX Flow

**Vorher**:
1. User klickt "Auswertungen" in Sidebar
2. Seite lädt mit PV-Anlage Tab
3. User sieht 10 Tabs horizontal
4. User klickt gewünschten Tab
5. Content wechselt

**Nachher**:
1. User sieht "Auswertungen" bereits aufgeklappt in Sidebar
2. User klickt direkt auf gewünschte Auswertung (z.B. "ROI-Analyse")
3. Seite lädt direkt mit dem gewählten Content
4. Sidebar zeigt aktiven Zustand

→ **1 Klick weniger, direktere Navigation**

---

## Zukünftige Erweiterungen

Einfach neue Auswertungen hinzufügen in `navigation` Array:
```typescript
{
  icon: 'trend',
  label: 'Auswertungen',
  href: '/auswertung',
  children: [
    // ... bestehende Einträge
    { icon: 'chart', label: 'Benchmarking', href: '/auswertung?tab=benchmark' },
  ]
}
```

---

## Testing

**Getestet**:
- ✅ Alle 10 Auswertungs-Tabs laden korrekt
- ✅ Sidebar zeigt aktiven Zustand richtig an
- ✅ Expandieren/Kollabieren funktioniert
- ✅ Mobile-Ansicht: Sidebar schließt nach Klick
- ✅ Keine Konsolen-Fehler
- ✅ Keine Breaking Changes für bestehende URLs

**Browser**:
- Chrome/Edge
- Firefox
- Safari

**Devices**:
- Desktop (>1024px)
- Tablet (768-1024px)
- Mobile (<768px)

---

## Zusammenfassung

**Code-Änderungen**: Minimal (~180 Zeilen geändert)
**UX-Verbesserung**: Signifikant (1 Klick weniger, bessere Übersicht)
**Breaking Changes**: Keine
**Status**: Produktionsbereit ✅

---

**Co-Authored-By**: Claude Sonnet 4.5 <noreply@anthropic.com>
