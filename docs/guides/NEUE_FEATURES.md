# Neue Features - Erweiterte Auswertungen

## Übersicht

**Status**: ✅ 4 von 5 Features implementiert
**Zugriff**: `/auswertung` → Verschiedene Tabs
**Commit**: 9ca29ed

---

## ✅ 1. Prognose vs. IST-Vergleich

**Tab**: `/auswertung?tab=prognose`
**Komponente**: `components/PrognoseVsIstDashboard.tsx`

### Features
- **Intelligente Prognose-Berechnung**
  - 70% historischer Durchschnitt (gleicher Monat in Vorjahren)
  - 30% Anlagenleistung × saisonale Faktoren
  - Monatsfaktoren: Jan=0.4, Jun/Jul=1.5 (peak), Dez=0.3

- **Visualisierungen**
  - Combined Chart: IST vs. Prognose
  - Abweichungs-Chart (grün/rot Balken)
  - Genauigkeits-Trend über Zeit

- **KPIs**
  - Gesamt-Abweichung in % und kWh
  - Durchschnittliche Prognose-Genauigkeit
  - Beste Übererfüllung/Untererfüllung (Monate)

- **Export**
  - CSV-Export mit allen Monatsdaten

### Berechnungslogik
```typescript
// Prognose = 70% Historie + 30% Leistung
prognose = durchschnittGleicherMonat * 0.7 +
           (jahresdurchschnittProKwp / 12) * monatsfaktor * leistungKwp * 0.3
```

---

## ✅ 2. Monatsdetail-Ansicht mit Drill-down

**Tab**: `/auswertung?tab=monatsdetail`
**Komponente**: `components/MonatsDetailView.tsx`

### Features
- **Monatsselektor**
  - Button-Grid für alle verfügbaren Monate
  - Highlight aktuell ausgewählter Monat

- **Haupt-KPIs pro Monat**
  - PV-Erzeugung (+ spezifischer Ertrag kWh/kWp)
  - Eigenverbrauch mit Quote
  - Autarkiegrad
  - Netto-Ertrag
  - Vergleich zum Vormonat

- **Visualisierungen**
  - **Pie Chart 1**: PV-Energie Verwendung
    - Direktverbrauch
    - Batterieladung
    - Einspeisung
  - **Pie Chart 2**: Verbrauchsdeckung
    - Direktverbrauch PV
    - Aus Batterie
    - Netzbezug
  - **Bar Chart**: Wirtschaftliche Aufschlüsselung
    - Erlöse (grün)
    - Netzbezugskosten (rot)
    - Betriebsausgaben (orange)

- **Detailtabellen**
  - Energiedaten (kWh)
  - Finanzdaten & Kennzahlen
  - Batterie-Effizienz

- **Insights-Box**
  - Performance-Bewertung
  - Wirtschaftlichkeits-Check
  - Speicher-Effizienz

---

## ✅ 3. PDF-Export

**Komponente**: `components/PDFExportButton.tsx`
**Library**: jsPDF + jspdf-autotable

### Features
- **PDF-Generierung**
  - Titel & Erstellungsdatum
  - Zusammenfassung-Sektion (KPIs)
  - Formatierte Tabelle mit Daten
  - Seitennummerierung im Footer
  - Responsive Spaltenbreiten

- **Integration**
  - ✅ ROI-Dashboard
  - Weitere Dashboards können einfach ergänzt werden

- **Design**
  - Roter Button (vs. grüner CSV-Button)
  - Spinner während Export

### Verwendung
```typescript
<PDFExportButton
  data={yearlyStats}
  filename="ROI_Analyse_2026-01-24"
  title="ROI-Analyse & Wirtschaftlichkeit"
  headers={['Jahr', 'Erzeugung (kWh)', ...]}
  mapDataToRow={(year) => [year.jahr.toString(), ...]}
  summary={[
    { label: 'Gesamtertrag', value: '15.234 €' },
    ...
  ]}
/>
```

---

## ✅ 4. KI-gestützte Optimierungsvorschläge

**Tab**: `/auswertung?tab=optimierung`
**Komponente**: `components/OptimierungsvorschlaegeDashboard.tsx`

### Analyse-Kategorien

#### 1️⃣ Eigenverbrauch-Optimierung
**Trigger**:
- Quote < 40%: ⚠️ Hoch-Priorität
- Quote 40-60%: 🟡 Mittel-Priorität
- Quote > 70%: ✅ Niedrig-Priorität (Lob)

**Vorschläge**:
- Lastverschiebung (Waschmaschine tagsüber)
- Smart Home Integration
- Batteriespeicher
- Warmwasser-Bereitung mit PV-Überschuss

#### 2️⃣ Speicher-Analyse
**Checks**:
- **Effizienz < 75%**: Technische Probleme
- **Dimensionierung**:
  - Speicher/Tageserzeugung < 0.3: Zu klein
  - Speicher/Tageserzeugung > 0.8: Überdimensioniert
- **Kein Speicher**: Empfehlung bei Quote < 50%

**Vorschläge**:
- Batteriezustand prüfen
- Ladestrategie optimieren
- Speichererweiterung (mit Wirtschaftlichkeitsrechnung)
- Optimale Dimensionierung

#### 3️⃣ Wirtschaftlichkeit
**Checks**:
- Betriebsausgaben > 200 €/Jahr
- Negativer Netto-Ertrag

**Vorschläge**:
- Versicherungen vergleichen
- Wartungsverträge prüfen
- Stromtarif wechseln
- Eigenverbrauch erhöhen (Priorität)

#### 4️⃣ Technische Performance
**Benchmark**: 850-1100 kWh/kWp/Jahr (Deutschland)

**Checks**:
- < 700 kWh/kWp: ⚠️ Unterperformance
- > 1000 kWh/kWp: ✅ Exzellent

**Vorschläge**:
- Module reinigen (Verschmutzung)
- Verschattung prüfen
- Wechselrichter-Diagnose
- String-Monitoring installieren

#### 5️⃣ Verhaltenstipps
**Seasonal Optimization**:
- **Sommer**: PV-Überschuss nutzen
  - Pool-Pumpe, Klimaanlage
  - E-Auto vollständig mit PV laden
  - Große Wäschen
- **Winter**: Autarkie erhöhen
  - Heizung tagsüber
  - Warmwasser-Bereitung bei Sonne
  - Realistische Erwartungen

### Darstellung
- **Prioritäts-Badges**: 🔴 Hoch | 🟡 Mittel | 🟢 Niedrig
- **Kategorie-Icons**: Bulb, Battery, Money, Settings, Home
- **Einsparpotenzial**: Konkrete €-Beträge
- **Maßnahmen-Liste**: Konkrete Handlungsschritte
- **Disclaimer**: Hinweis auf Fachberatung

### Beispiel-Vorschlag
```
🔴 HOCH: Eigenverbrauch stark verbesserbar

Deine Eigenverbrauchsquote liegt bei nur 35%. Das bedeutet,
dass du einen Großteil deiner selbst erzeugten Energie ins
Netz einspeist, anstatt sie selbst zu nutzen.

💰 Potenzial: Bis zu 450 € pro Jahr durch höheren Eigenverbrauch

Maßnahmen:
▸ Verbrauchszeiten in sonnenreiche Stunden verschieben
▸ Smarte Steuerung für Großverbraucher installieren
▸ Batteriespeicher installieren oder erweitern
▸ Warmwasser-Bereitung mit PV-Überschuss
```

---

## ❌ 5. Benchmarking (Nicht implementiert)

**Grund**: Benötigt externe Datenbank mit Vergleichsanlagen

**Konzept**:
- Vergleich mit ähnlichen Anlagen (Leistung, Region, Ausrichtung)
- Perzentil-Ranking
- Benchmark-KPIs

**Alternative**: Interne Benchmarks (Monat-zu-Monat, Jahr-zu-Jahr) sind bereits in anderen Dashboards integriert.

---

## Navigation

Alle Features sind über **Auswertungen** (`/auswertung`) zugänglich:

```
/auswertung?tab=pv            → PV-Anlage (Standard)
/auswertung?tab=roi           → ROI-Analyse
/auswertung?tab=co2           → CO₂-Impact
/auswertung?tab=prognose      → Prognose vs. IST ✨ NEU
/auswertung?tab=monatsdetail  → Monats-Details ✨ NEU
/auswertung?tab=optimierung   → Optimierung ✨ NEU
```

---

## Neue Icons

**SimpleIcon.tsx** erweitert mit:
- `target` - Prognose
- `trend-up`, `trend-down` - Trends
- `trophy` - Erfolge
- `alert` - Warnungen
- `bulb` - Optimierung
- `calendar` - Monatsauswahl
- `shield` - Autarkie

---

## Technische Details

### Dependencies
```json
{
  "jspdf": "^2.x",
  "jspdf-autotable": "^3.x"
}
```

### Komponenten-Struktur
```
components/
├── PrognoseVsIstDashboard.tsx      (350 Zeilen)
├── MonatsDetailView.tsx            (550 Zeilen)
├── PDFExportButton.tsx             (110 Zeilen)
├── OptimierungsvorschlaegeDashboard.tsx (620 Zeilen)
└── SimpleIcon.tsx                  (erweitert)
```

### Performance
- Alle Berechnungen clientseitig
- Keine zusätzlichen API-Calls
- Charts lazy-loaded via Recharts
- PDF-Generierung dynamisch importiert

---

## Zusammenfassung

**Implementiert**: 4/5 Features
**Code-Zeilen**: ~1630 neue Zeilen
**Commits**: 2
- `a0b3ea2`: Prognose, Monatsdetails & PDF-Export
- `9ca29ed`: Optimierungsvorschläge

**Status**: ✅ Produktionsbereit
**Testing**: Empfohlen auf `/auswertung`

**Nächste Schritte**:
1. Features testen mit echten Daten
2. Optional: Benchmarking-Feature (benötigt Datenbank-Erweiterung)
3. Weitere PDF-Exports in anderen Dashboards
4. Mobile Responsiveness optimieren
