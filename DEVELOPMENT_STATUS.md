# EEDC-Webapp - Entwicklungsstand 01.02.2026

## Letzte Änderungen (Session 01.02.2026)

### 1. Monatsdaten-Ergebnisansicht überarbeitet
**Datei:** `components/MonatsdatenFormDynamic.tsx`

- Zwei-Spalten-Layout für bessere Übersichtlichkeit
- Header mit 4 Haupt-KPIs: Autarkiegrad, Eigenverbrauch, kWh erzeugt, Ersparnis
- Strukturierte Sektionen: Energiebilanz, Netz, PV-Anlage, Batterie, E-Auto, Wärmepumpe, Wetter

### 2. Wallbox-Unterstützung hinzugefügt
**Datei:** `components/MonatsdatenFormDynamic.tsx`

- Dynamische Wallbox-Felder im Formular
- Berechnung: extern geladene kWh (wenn E-Auto mehr lädt als Wallbox liefert)
- Anzeige in Ergebnisansicht

### 3. Eigenverbrauch-Einsparung berechnen
**Problem:** Es wurde nur Einspeise-Erlös berechnet, nicht die Einsparung durch Eigenverbrauch.

**Lösung:**
- Neue Berechnung: Eigenverbrauch × Netzbezugspreis = Einsparung
- Gesamtersparnis = Eigenverbrauch-Einsparung + Einspeise-Erlös - Netzbezugskosten
- Anzeige in Header und Detail-Bereich

**Dateien:**
- `components/MonatsdatenFormDynamic.tsx`
- `app/uebersicht/MonatsdatenTable.tsx` - neue Spalten EV-Einsparung und Ersparnis

### 4. Monatsdaten-Übersicht erweitert
**Dateien:**
- `app/uebersicht/page.tsx` - lädt jetzt Investitionen und deren Monatsdaten
- `app/uebersicht/MonatsdatenTable.tsx`

**Neue Features:**
- Dynamische Spalten basierend auf vorhandenen Investitionstypen
- Farbkodierte Filter-Buttons (Speicher=blau, E-Auto=grün, Wallbox=lila, Wärmepumpe=orange)
- Spalten für Speicher, E-Auto, Wallbox, Wärmepumpe
- **Sticky Header:** Tabellenkopf bleibt beim Scrollen sichtbar
- **Dynamische Höhe:** `calc(100vh - 280px)` nutzt verfügbaren Platz optimal

### 5. Investitions-Einsparungen automatisch berechnen
**Problem:** `einsparung_monat_euro` wurde nicht beim Speichern berechnet.

**Lösung in `components/MonatsdatenFormDynamic.tsx`:**
- E-Auto: (km × Verbrenner-Verbrauch × Benzinpreis) - (Netz-kWh × Strompreis)
- Wärmepumpe: (Wärmebedarf × alter Preis) - (WP-Strom × Strompreis)
- Speicher: Entladung × Strompreis

**Nachberechnungs-Script:** `scripts/recalculate-investition-einsparungen.ts`
- Berechnet alle bestehenden investition_monatsdaten nach
- Ausführung: `npx tsx scripts/recalculate-investition-einsparungen.ts`

### 6. Prognose-Jahres-Einsparungen automatisch berechnen
**Problem:** Prognosen wurden nur aus manuellen Jahreskosten berechnet, nicht aus Parametern.

**Lösung in `lib/investitionCalculations.ts`:**
- E-Auto: Benzinkosten - E-Auto-Kosten (aus km/Jahr, Verbrauch, Preise)
- Wärmepumpe: Alte Heizkosten - WP-Kosten (aus Wärmebedarf, JAZ, Preise)
- Speicher: Speicherzyklen × (Netzbezugspreis - Einspeisevergütung)

**Nachberechnungs-Script:** `scripts/recalculate-investition-prognosen.ts`
- Berechnet alle bestehenden Investitionen neu
- Ausführung: `npx tsx scripts/recalculate-investition-prognosen.ts`

### 7. Investitionen-Seite: Prognose vs. Ist
**Datei:** `app/investitionen/page.tsx`

**Neue Spalten:**
- Prognose/Jahr - aus Investitions-Parametern berechnet
- Ist/Jahr - aus tatsächlichen Monatsdaten hochgerechnet
- Abweichung - prozentuale Differenz (grün=besser, rot=schlechter)

---

## Script-Ausführung (bei Bedarf)

```bash
# Monatliche Einsparungen nachberechnen
npx tsx scripts/recalculate-investition-einsparungen.ts

# Prognose-Jahreswerte nachberechnen
npx tsx scripts/recalculate-investition-prognosen.ts
```

---

## Datenbank-Struktur

### Tabellen
- `investitionen` - alle Investitionen mit Parametern
- `investition_monatsdaten` - Rohdaten + berechnete Einsparung pro Monat
- `monatsdaten` - Aggregierte Monatsdaten pro Anlage
- `strompreise` - Strompreise für Berechnungen

### Views
- `investitionen_uebersicht` - Investitionen mit ROI, Amortisation
- `investition_prognose_ist_vergleich` - Prognose vs. Ist Vergleich

---

## Offene Punkte / Nächste Schritte
- [ ] Meine Anlage: Auswertungen überarbeiten, korrigieren, strukturiert ausweiten
- [ ] Meine Anlage: Analysieren, Hinweise und Tips ergänzen
- [ ] Community Feature: Kommunikationsfeatures erweitern

---

## Wichtige URLs
- GitHub: https://github.com/supernova1963/eedc.git
- Branch: main
