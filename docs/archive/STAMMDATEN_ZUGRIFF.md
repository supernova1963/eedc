# Zugriff auf die Stammdaten-Formulare

## 🚀 Schnellzugriff

### Hauptseite Stammdaten
```
http://localhost:3000/stammdaten
```
Zentrale Übersichtsseite mit allen Stammdaten-Funktionen

---

## ⚡ Strompreise

### Übersicht aller Strompreise
```
http://localhost:3000/stammdaten/strompreise
```
- Liste aller erfassten Strompreise
- Anzeige aktuell gültiger Preise (grün markiert)
- Bearbeiten & Löschen von Einträgen

### Neuen Strompreis erfassen
```
http://localhost:3000/stammdaten/strompreise/neu
```
**Formular-Felder:**
- Gültigkeitszeitraum (ab/bis)
- Anlage (optional - für anlagenspezifische Preise)
- Netzbezug: Arbeitspreis (ct/kWh) + Grundpreis (€/Monat)
- Einspeisevergütung (ct/kWh)
- Anbieter & Vertragsart
- Notizen

**Features:**
- Live-Berechnung: "Eigenverbrauch lohnt sich um X ct/kWh mehr"
- Plausibilitätsprüfung der Zeiträume
- Automatische Zuordnung zu Mitglied

### Strompreis bearbeiten
```
http://localhost:3000/stammdaten/strompreise/[id]/bearbeiten
```
(ID wird automatisch aus der Übersicht übernommen)

---

## 🔗 Investitions-Zuordnung

### Investitionen zu Anlagen zuordnen
```
http://localhost:3000/stammdaten/zuordnung
```

**Funktionen:**
- Statistik: Zugeordnet vs. Nicht zugeordnet
- Nicht zugeordnete Investitionen auf einen Blick
- Gruppierung nach Anlage
- Schnelle Zuordnung per Dropdown
- Icons pro Investitionstyp (☀️ PV, 🔋 Speicher, 🚗 E-Auto, etc.)

**Empfohlene Zuordnungen:**
- ✅ **Immer zuordnen:** PV-Module, Wechselrichter, Speicher
- ⚠️ **Optional:** E-Auto, Wärmepumpe (wenn PV-Strom genutzt)
- ℹ️ **Nicht nötig:** Balkonkraftwerk (eigene "Anlage")

---

## 📋 Workflow: Erste Schritte

### 1. Migration durchführen
Falls noch nicht geschehen:
```bash
# In Supabase SQL Editor:
# Kopiere migrations/_all_migrations.sql
# Führe aus mit "Run"
```

### 2. Ersten Strompreis erfassen
1. Gehe zu `/stammdaten/strompreise/neu`
2. Fülle Formular aus:
   - Gültig ab: z.B. `2024-01-01`
   - Netzbezug: z.B. `32.50 ct/kWh`
   - Einspeisung: z.B. `8.20 ct/kWh`
3. Optional: Grundpreis und Anbieter
4. Speichern

### 3. Investitionen zuordnen
1. Gehe zu `/stammdaten/zuordnung`
2. Siehst du "Nicht zugeordnete Investitionen"?
3. Wähle für jeden Eintrag die passende Anlage aus Dropdown
4. Automatisches Speichern bei Änderung

### 4. Monatsdaten erfassen (wie gewohnt)
Jetzt kannst du Monatsdaten erfassen, und die Einsparungen werden automatisch korrekt berechnet!

---

## 🎨 UI-Features

### Strompreis-Liste
- **Grüne Markierung:** Aktuell gültiger Preis
- **Graue Hintergrund:** Abgelaufene/zukünftige Preise
- **Berechnung:** Zeigt automatisch "Eigenverbrauch lohnt sich um X ct/kWh"
- **Anlagen-Zuordnung:** Anlagenspezifisch oder "Alle Anlagen (Standard)"

### Zuordnungs-UI
- **Statistik-Karten:** Gesamt, Zugeordnet, Nicht zugeordnet
- **Farbcodierung:**
  - 🟨 Gelb: Nicht zugeordnet (noch offen)
  - 🟢 Grün: Zugeordnet (pro Anlage gruppiert)
- **Icons:** Visuell unterscheidbar nach Typ

---

## 🔧 Navigation in der App

### Aus Hauptmenü (wenn vorhanden):
```
Navigation → Stammdaten
```

### Direkte Links:
```html
<!-- In deiner Navigation oder Sidebar -->
<Link href="/stammdaten">Stammdaten</Link>
<Link href="/stammdaten/strompreise">Strompreise</Link>
<Link href="/stammdaten/zuordnung">Zuordnung</Link>
```

---

## 💡 Tipps

### Strompreise
- **Bei Preisänderung:** Neuen Eintrag anlegen (mit neuem Gültig-Ab-Datum)
- **Alten Preis:** Gültig-Bis setzen oder leer lassen
- **Anlagenspezifisch:** Nur nutzen, wenn eine Anlage anderen Tarif hat
- **Standard:** Feld "Anlage" leer lassen = gilt für alle

### Zuordnung
- **Hierarchie nutzen:** PV-Module können als "Child" von Wechselrichter angelegt werden (parent_investition_id)
- **Mehrere Anlagen:** Jede Investition kann nur EINER Anlage zugeordnet werden
- **Community:** E-Auto ohne Anlage = reine Mobilitätsinvestition (OK!)

---

## 📱 Responsive Design

Alle Formulare sind responsive:
- **Desktop:** 2-4 Spalten Grid
- **Tablet:** 2 Spalten
- **Mobile:** 1 Spalte

---

## 🐛 Bekannte Einschränkungen

1. **Auth:** Aktuell wird das erste Mitglied aus DB genutzt
   - In Produktion: Mit echtem Auth-System ersetzen

2. **Client Components:** Formulare sind Client Components (`'use client'`)
   - Benötigt JavaScript im Browser

3. **Validierung:** Nur Frontend-Validierung
   - In Produktion: Backend-Validierung in Supabase RLS hinzufügen

---

## 🎯 Nächste Schritte nach Stammdaten-Erfassung

1. ✅ Strompreise erfasst
2. ✅ Investitionen zugeordnet
3. ✅ Monatsdaten vorhanden

**→ Jetzt bereit für:**
- Dashboard mit Kennzahlen
- Wirtschaftlichkeits-Auswertungen
- ROI-Berechnungen
- Community-Vergleiche

---

## 📞 Bei Problemen

**Fehler beim Laden:**
- Prüfe, ob Migration durchgeführt wurde
- Prüfe, ob Mitglied in DB existiert

**Formular speichert nicht:**
- Öffne Browser Console (F12)
- Sieh nach Fehlermeldungen
- Prüfe Supabase-Verbindung

**Zuordnung funktioniert nicht:**
- Prüfe, ob Spalte `anlage_id` in `alternative_investitionen` existiert
- Führe Migration 01 erneut aus

---

**Status:** Formulare sind einsatzbereit! 🎉

Viel Erfolg beim Erfassen der Stammdaten!
