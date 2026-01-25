# Test-Checkliste - Neue Features

## Server gestartet
✅ Development Server läuft auf: http://localhost:3000

---

## 🎯 Test-Reihenfolge

### 1. Prognose vs. IST Dashboard
**URL**: http://localhost:3000/auswertung?tab=prognose

**Zu prüfen**:
- [ ] Dashboard lädt ohne Fehler
- [ ] KPI-Cards zeigen Werte:
  - Gesamt-Abweichung (% und kWh)
  - Prognose-Genauigkeit
  - Beste Übererfüllung (Monat + kWh)
  - Größte Untererfüllung (Monat + kWh)
- [ ] Charts werden angezeigt:
  - IST vs. Prognose (Combined Chart)
  - Abweichungen (Bar Chart mit grün/rot)
  - Genauigkeits-Trend (Line Chart)
- [ ] Detailtabelle zeigt alle Monate
- [ ] CSV-Export funktioniert
- [ ] Insights-Box zeigt Prognose-Methodik

**Erwartete Prognose-Logik**:
- Sollte realistische Werte zeigen
- Genauigkeit idealerweise 80-95%
- Sommer-Monate höhere Erzeugung als Winter

---

### 2. Monatsdetail-Ansicht
**URL**: http://localhost:3000/auswertung?tab=monatsdetail

**Zu prüfen**:
- [ ] Monatsselektor zeigt alle Monate
- [ ] Aktueller Monat ist highlighted (blau)
- [ ] Klick auf Monat wechselt Ansicht
- [ ] KPI-Cards aktualisieren sich:
  - PV-Erzeugung (+ spezifischer Ertrag)
  - Eigenverbrauch (+ Quote)
  - Autarkiegrad
  - Netto-Ertrag
- [ ] Vormonats-Vergleich wird angezeigt
- [ ] Pie Charts rendern:
  - PV-Energie Verwendung
  - Verbrauchsdeckung
- [ ] Bar Chart: Wirtschaftliche Aufschlüsselung
- [ ] Detailtabellen zeigen korrekte Werte
- [ ] Insights-Box bewertet Performance

**Interaktion testen**:
- Zwischen verschiedenen Monaten wechseln
- Prüfen ob Charts sich aktualisieren
- Sommer vs. Winter Monat vergleichen

---

### 3. PDF-Export (ROI Dashboard)
**URL**: http://localhost:3000/auswertung?tab=roi

**Zu prüfen**:
- [ ] Roter "PDF Export" Button sichtbar
- [ ] Neben grünem "CSV Export" Button
- [ ] Klick auf PDF-Button:
  - [ ] Button zeigt Spinner + "Exportiere..."
  - [ ] PDF-Download startet
  - [ ] Button kehrt zu Normalzustand zurück
- [ ] PDF öffnen und prüfen:
  - [ ] Titel: "ROI-Analyse & Wirtschaftlichkeit"
  - [ ] Erstellungsdatum vorhanden
  - [ ] Zusammenfassung-Sektion mit KPIs
  - [ ] Tabelle mit allen Jahren
  - [ ] Seitennummer im Footer
  - [ ] Deutsche Formatierung (Komma statt Punkt)

**PDF-Inhalt sollte enthalten**:
- Jahr, Erzeugung, Erlöse, Kosten, Netto-Ertrag, Kumuliert, Fortschritt

---

### 4. Optimierungsvorschläge
**URL**: http://localhost:3000/auswertung?tab=optimierung

**Zu prüfen**:
- [ ] Dashboard lädt ohne Fehler
- [ ] Header zeigt Anzahl gefundener Vorschläge
- [ ] Kategorie-Übersicht (5 Karten):
  - Eigenverbrauch
  - Batteriespeicher
  - Wirtschaftlichkeit
  - Technische Performance
  - Nutzungsverhalten
- [ ] Vorschläge werden angezeigt
- [ ] Jeder Vorschlag hat:
  - [ ] Icon & Titel
  - [ ] Prioritäts-Badge (🔴/🟡/🟢)
  - [ ] Kategorie-Label
  - [ ] Beschreibung
  - [ ] Einsparpotenzial-Box (blau)
  - [ ] Maßnahmen-Liste
- [ ] Vorschläge nach Priorität sortiert (hoch zuerst)
- [ ] Hover-Effekt auf Karten funktioniert
- [ ] Disclaimer am Ende sichtbar

**Erwartete Vorschläge** (je nach Datenlage):
- Eigenverbrauch-Optimierung (falls Quote < 60%)
- Speicher-Analyse (falls vorhanden oder fehlend)
- Betriebsausgaben (falls > 200 €/Jahr)
- Technische Performance (falls Ertrag < 700 kWh/kWp)
- Saisonale Tipps

---

### 5. Navigation & Integration
**URLs**:
- http://localhost:3000/auswertung

**Zu prüfen**:
- [ ] Alle Tabs werden angezeigt:
  - PV-Anlage
  - ROI-Analyse
  - CO₂-Impact
  - **Prognose vs. IST** (neu)
  - **Monats-Details** (neu)
  - **Optimierung** (neu)
- [ ] Tab-Wechsel funktioniert
- [ ] Aktiver Tab ist highlighted
- [ ] Icons in Tabs korrekt:
  - Prognose: Target 🎯
  - Monats-Details: Calendar 📅
  - Optimierung: Bulb 💡
- [ ] URL aktualisiert sich beim Tab-Wechsel
- [ ] Direkte URLs funktionieren (Bookmark-Test)

---

### 6. Icons-Test
**Alle neuen Icons prüfen**:
- [ ] `target` - Zielscheibe in Prognose-Tab
- [ ] `trend-up` / `trend-down` - Pfeile in KPIs
- [ ] `trophy` - Pokal bei guter Performance
- [ ] `alert` - Warnung bei Problemen
- [ ] `bulb` - Glühbirne in Optimierung-Tab
- [ ] `calendar` - Kalender in Monatsdetail-Tab
- [ ] `shield` - Schild bei Autarkie

**Visuell prüfen**:
- Icons scharf und erkennbar
- Korrekte Farben
- Passende Größe

---

### 7. Responsive Design
**Browser-Fenster verkleinern**:
- [ ] Prognose-Dashboard responsive
- [ ] Monatsdetail-Dashboard responsive
- [ ] Optimierung-Dashboard responsive
- [ ] Monatsselektor-Grid bricht um
- [ ] Charts passen sich an
- [ ] Tabellen scrollbar auf Mobile

---

### 8. Fehlerbehandlung
**Edge Cases testen**:
- [ ] Tab ohne Daten (sollte Fallback zeigen)
- [ ] Sehr alte Anlage (viele Jahre)
- [ ] Anlage ohne Speicher
- [ ] Export bei 0 Daten (Button disabled)
- [ ] Browser-Konsole: Keine Fehler

---

### 9. Performance
**Ladezeiten prüfen**:
- [ ] Initiales Laden < 2s
- [ ] Tab-Wechsel flüssig
- [ ] Monatsselektor-Wechsel instant
- [ ] Chart-Rendering smooth
- [ ] PDF-Export < 3s

---

### 10. Datenqualität
**Berechnungen validieren**:
- [ ] Prognose-Werte plausibel
- [ ] Abweichungen korrekt (IST - Prognose)
- [ ] Genauigkeit % = 100 - |Abweichung %|
- [ ] Monatsdetails summieren korrekt
- [ ] Optimierungsvorschläge sinnvoll
- [ ] Einsparpotenziale realistisch

---

## 🐛 Bekannte Potenzielle Probleme

### PDF-Export
- **Problem**: TypeScript-Fehler bei jsPDF-Import
- **Lösung**: Dynamischer Import wird verwendet
- **Test**: PDF sollte trotzdem funktionieren

### Tailwind-Farben
- **Problem**: Dynamische Farb-Klassen (`text-${color}-600`)
- **Workaround**: Evtl. manuelles Mapping nötig
- **Test**: Alle Icons haben korrekte Farben

### Charts auf Mobile
- **Problem**: Recharts kann auf kleinen Screens unschön sein
- **Test**: X-Achse Labels lesbar?

---

## ✅ Erfolgs-Kriterien

**Alle Features funktionieren, wenn**:
1. Keine Fehler in Browser-Konsole
2. Alle Visualisierungen laden
3. Interaktionen (Klicks, Hover) funktionieren
4. Berechnungen korrekt
5. Export-Funktionen arbeiten
6. Performance akzeptabel (< 2s Ladezeit)
7. Responsive auf Mobile

---

## 📝 Test-Protokoll

**Tester**: _________________
**Datum**: _________________
**Browser**: _________________
**Bildschirmgröße**: _________________

**Gefundene Probleme**:
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

**Verbesserungsvorschläge**:
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

**Gesamteindruck**: ⭐⭐⭐⭐⭐ (Sterne vergeben)

---

## 🔧 Quick Fixes

Falls Probleme auftreten:

```bash
# Cache löschen
rm -rf .next
npm run dev

# TypeScript neu kompilieren
npm run build

# Dependencies neu installieren
rm -rf node_modules
npm install
```

---

## 📞 Support

Bei Problemen:
1. Browser-Konsole (F12) prüfen
2. Network-Tab für API-Fehler
3. React DevTools installieren
4. Terminal-Output des Dev-Servers

**Viel Erfolg beim Testen! 🚀**
