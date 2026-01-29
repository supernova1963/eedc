# EEDC WebApp - Optimierungsplan

**Stand:** 2026-01-29
**Status:** FRESH-START Schema implementiert, Community-Features aktiv

---

## 1. UI/UX Verbesserungen

### 1.1 Dashboard "Meine Anlage"
- [ ] **Monatsübersicht-Widget** - Aktuelle Monat-Daten prominent anzeigen
- [ ] **Trend-Anzeige** - Vergleich zum Vormonat/Vorjahr mit Pfeilen
- [ ] **Quick-Actions** - Schnellzugriff auf häufige Aktionen
- [ ] **Wetter-Integration** - Aktuelle Sonnenstunden aus API (optional)
- [ ] **Dark Mode** - System-weite Unterstützung

### 1.2 Community Dashboard
- [ ] **Kartenansicht** - Anlagen auf OpenStreetMap anzeigen (wenn Koordinaten freigegeben)
- [ ] **Suchfunktion** - Volltextsuche über Anlagen
- [ ] **Sortierung** - Nach verschiedenen Kriterien sortieren
- [ ] **Pagination** - Bei vielen Anlagen seitenweise laden

### 1.3 Mobile Optimierung
- [ ] **Responsive Tables** - Bessere Darstellung auf kleinen Bildschirmen
- [ ] **Touch-Gesten** - Swipe zum Bearbeiten/Löschen
- [ ] **PWA Support** - Als App installierbar machen

---

## 2. Auswertungen & Grafiken

### 2.1 Neue Auswertungen
- [ ] **Jahresvergleich** - Mehrere Jahre nebeneinander
- [ ] **Monatsvergleich** - Gleicher Monat über Jahre
- [ ] **Prognose vs. IST** - Erwartete vs. tatsächliche Erzeugung
- [ ] **Wirtschaftlichkeit** - ROI-Berechnung mit Amortisation
- [ ] **CO₂-Bilanz** - Detaillierte Einsparungsrechnung

### 2.2 Grafik-Typen
- [ ] **Balkendiagramme** - Für Monatsvergleiche
- [ ] **Liniendiagramme** - Für Trends über Zeit
- [ ] **Sankey-Diagramm** - Energiefluss visualisieren
- [ ] **Heatmap** - Tageszeiten-Analyse (wenn Stundendaten vorhanden)

### 2.3 Chart-Bibliothek
- [ ] **Recharts** oder **Chart.js** integrieren
- [ ] **Export-Funktion** - Grafiken als PNG/PDF speichern
- [ ] **Interaktive Tooltips** - Details beim Hover

---

## 3. Kennzahlen & Berechnungen

### 3.1 Basis-Kennzahlen (implementiert)
- [x] Eigenverbrauchsquote
- [x] Autarkiegrad
- [x] Einspeisevergütung
- [x] Netzbezugskosten

### 3.2 Erweiterte Kennzahlen
- [ ] **Spezifischer Ertrag** - kWh pro kWp
- [ ] **Performance Ratio** - Tatsächlicher vs. theoretischer Ertrag
- [ ] **Volllaststunden** - Berechnung und Vergleich
- [ ] **Degradation** - Leistungsabnahme über Jahre
- [ ] **Break-Even-Punkt** - Wann amortisiert sich die Anlage?

### 3.3 Vergleichswerte
- [ ] **Benchmark** - Vergleich mit ähnlichen Anlagen
- [ ] **Regionale Durchschnitte** - PLZ-basiert
- [ ] **Nationale Statistiken** - Vergleich mit Bundesdurchschnitt

---

## 4. Daten-Import & Export

### 4.1 Import-Formate
- [x] CSV (implementiert)
- [ ] **Excel (.xlsx)** - Direkter Import
- [ ] **API-Anbindung** - Fronius, SolarEdge, SMA, etc.
- [ ] **JSON** - Für Entwickler/Backup

### 4.2 Export-Formate
- [ ] **CSV** - Alle Monatsdaten exportieren
- [ ] **PDF Report** - Jahresbericht generieren
- [ ] **Excel** - Mit Formatierung und Grafiken

---

## 5. Investitions-Tracking

### 5.1 Erweiterte Investitions-Typen
- [ ] **Netzwerk-Speicher** - Gemeinschaftsspeicher
- [ ] **Balkonkraftwerk** - Als separate Anlage
- [ ] **Erweiterungen** - Modul-Zukäufe tracken

### 5.2 Wartung & Service
- [ ] **Wartungstermine** - Erinnerungen
- [ ] **Garantie-Tracking** - Ablaufdaten verwalten
- [ ] **Service-Historie** - Reparaturen dokumentieren

---

## 6. Community-Features

### 6.1 Soziale Features
- [ ] **Kommentare** - Bei öffentlichen Anlagen
- [ ] **Bewertungen** - Erfahrungsberichte
- [ ] **Fragen & Antworten** - Direkter Austausch
- [ ] **Benachrichtigungen** - Bei neuen Anlagen in der Region

### 6.2 Gamification
- [ ] **Badges/Achievements** - Für Meilensteine
- [ ] **Monatliche Challenges** - Wettbewerbe
- [ ] **Ranglisten** - Verschiedene Kategorien

---

## 7. Technische Optimierungen

### 7.1 Performance
- [ ] **Caching** - Redis oder Memory-Cache
- [ ] **Lazy Loading** - Daten erst bei Bedarf laden
- [ ] **Image Optimization** - Next.js Image Component

### 7.2 Sicherheit
- [ ] **Rate Limiting** - API-Schutz
- [ ] **Input Validation** - Zod für alle Formulare
- [ ] **CSRF Protection** - Token-basiert

### 7.3 Testing
- [ ] **Unit Tests** - Für Berechnungen
- [ ] **E2E Tests** - Playwright für kritische Flows
- [ ] **API Tests** - Für alle Endpoints

---

## 8. DevOps & Deployment

### 8.1 Release-Management
- [ ] **Semantic Versioning** - v1.0.0, v1.1.0, etc.
- [ ] **Changelog** - Automatisch generieren
- [ ] **Git Tags** - Für Releases
- [ ] **GitHub Releases** - Mit Release Notes

### 8.2 CI/CD Pipeline
- [ ] **GitHub Actions** - Build & Test bei Push
- [ ] **Preview Deployments** - Für Pull Requests
- [ ] **Production Deployment** - Automatisch bei Release

### 8.3 Monitoring
- [ ] **Error Tracking** - Sentry oder ähnlich
- [ ] **Analytics** - Nutzungsstatistiken
- [ ] **Health Checks** - Uptime Monitoring

---

## Priorisierung

### Phase 1 (Nächste Woche)
1. Auswertungen mit Grafiken (Chart.js/Recharts)
2. Jahresvergleich implementieren
3. Spezifischer Ertrag Kennzahl

### Phase 2 (Folgemonat)
1. Mobile Optimierung
2. PDF-Export für Jahresbericht
3. Performance Ratio Berechnung

### Phase 3 (Langfristig)
1. API-Anbindungen (Wechselrichter)
2. Community-Features (Kommentare)
3. PWA Support

---

## Release-Strategie für Produktionsserver

### Option A: Git Pull (Aktuell)
```bash
cd /var/www/eedc
git pull origin main
npm install
npm run build
pm2 restart eedc
```

### Option B: GitHub Releases (Empfohlen)
1. **Releases erstellen** mit Git Tags (v1.0.0)
2. **Download Script** das spezifische Version holt
3. **Rollback möglich** zu vorheriger Version
4. **Changelog** automatisch aus Commits

### Option C: Docker (Fortgeschritten)
1. **Docker Image** bei jedem Release bauen
2. **Container** auf Server deployen
3. **Zero-Downtime** Deployments möglich

**Empfehlung:** Option B (GitHub Releases) - Guter Kompromiss zwischen Einfachheit und Kontrolle.

---

## Nächste Schritte

1. ✅ Plan committen und pushen
2. Release-Workflow einrichten (GitHub Actions)
3. Mit Phase 1 beginnen (Auswertungen)
