# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

---

## [2.5.0] - 2026-03-01

### Hinzugefügt

- **PVGIS Horizontprofil-Support für genauere Ertragsprognosen**
  - Automatisches Geländeprofil (DEM) bei allen PVGIS-Abfragen aktiv (`usehorizon=1`)
  - Eigenes Horizontprofil hochladen (PVGIS-Textformat) oder automatisch von PVGIS abrufen
  - Horizont-Card in PVGIS-Einstellungen mit Status, Statistik und Upload/Abruf
  - Badge "Eigenes Profil" / "DEM" bei gespeicherten Prognosen
  - Horizontprofil im JSON-Export/Import enthalten

- **GitHub Releases & Update-Hinweis**
  - Automatische GitHub Releases mit Docker-Image auf ghcr.io bei Tag-Push
  - Update-Banner im Frontend wenn neuere Version verfügbar
  - Deployment-spezifische Update-Anleitung (Docker, HA Add-on, Git)

### Behoben

- **Community-Vorschau zeigte falsche Ausrichtung und Neigung**: Werte wurden aus leerem Parameter-JSON gelesen statt aus Modelfeldern

---

## [2.4.1] - 2026-02-26

### Hinzugefügt

- Standalone Docker-Support mit docker-compose
- Conditional Loading: HA-Features nur mit SUPERVISOR_TOKEN

### Behoben

- TypeScript-Fehler im Frontend-Build
- useHAAvailable Hook: Relativer API-Pfad für HA Ingress

---

## [2.4.0] - 2026-02-26

Initiales Standalone-Release basierend auf eedc-homeassistant v2.4.0.

### Funktionsumfang

- PV-Anlagen-Management mit Investitionen und Stromtarifen
- Monatsdaten-Erfassung (manuell, CSV-Import, HA-Statistik-Import)
- Cockpit-Dashboard mit KPIs, Amortisation und Finanzübersicht
- Auswertungen: Zeitreihen, Investitions-ROI, Realisierungsquote
- Aussichten: PVGIS-Solarprognose, Wettervorhersage, Ertragsaussichten
- Community-Benchmarking (anonymisierter Datenvergleich)
- Steuerliche Behandlung (Kleinunternehmer/Regelbesteuerung)
- Spezialtarife für Wärmepumpe & Wallbox
- Sonstige Positionen bei Investitionen
- Firmenwagen & dienstliches Laden
- Dark Mode
