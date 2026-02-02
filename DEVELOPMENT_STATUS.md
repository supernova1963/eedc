# EEDC-Webapp - Entwicklungsstand 02.02.2026

## Letzte Änderungen (Session 02.02.2026)

### 27. Supabase Security: search_path für alle Funktionen fixiert
**Neue Datei:** `supabase/migrations/20260202100000_fix_function_search_path.sql`

**Problem:** Supabase Security Warning "function_search_path_mutable" für 17 Funktionen.

**Lösung:** Alle SECURITY DEFINER Funktionen erhalten `SET search_path = public`.

**Betroffene Funktionen:**
- `auth_user_id()`, `current_mitglied_id()`, `user_owns_anlage(uuid)`, `anlage_is_public(uuid)`
- `user_owns_investition(uuid)`, `validate_investition_monatsdaten()`
- `create_anlage_freigabe(uuid)`, `update_anlagen_freigaben_timestamp()`
- `get_aktueller_strompreis(uuid)`, `get_public_anlagen()`, `get_community_stats()`
- `search_public_anlagen(...)`, `get_public_anlage_details(uuid)`
- `get_public_komponenten(uuid)`, `get_public_auswertung(uuid)`
- `get_public_jahresvergleich(uuid)`, `get_public_monatsdaten(uuid)`

**Hinweis:** Falls nach der Migration noch Warnungen für `create_anlage_freigabe` oder `get_aktueller_strompreis` erscheinen, existieren möglicherweise alte Funktionsversionen mit anderen Signaturen. Diese können über das Supabase Dashboard (Database → Functions) manuell gelöscht werden.

---

### 28. Supabase Security: Leaked Password Protection aktivieren (manuell)
**Status:** Manuelle Aktivierung erforderlich

**Was ist das?**
- Integration mit HaveIBeenPwned (HIBP)
- Prüft Passwörter gegen bekannte Datenlecks (Milliarden kompromittierter Passwörter)
- Datenschutzkonform über k-Anonymity (nur Hash-Präfix wird gesendet)

**Auswirkungen:**
- Benutzer können keine Passwörter verwenden, die in Datenlecks vorkommen
- Erhöht Schutz gegen Credential-Stuffing-Angriffe
- Benutzer mit schwachen/kompromittierten Passwörtern müssen ein neues wählen

**Aktivierung:**
1. Supabase Dashboard öffnen
2. **Authentication** → **Settings** → **Security**
3. **Leaked Password Protection** aktivieren

---

### 26. Arbitrage & V2H in Auswertungen anzeigen
**Dateien geändert:**
- `components/SpeicherAuswertung.tsx` - Arbitrage-KPI und Tabellenspalten
- `components/EAutoAuswertung.tsx` - V2H-Info-Box und Tabellenspalte
- `components/MonatsDetailView.tsx` - Arbitrage/V2H Info-Boxen
- `app/auswertung/page.tsx` - Investitionen an MonatsDetailView übergeben

**Features:**
- **SpeicherAuswertung:** Neue KPI-Box "Arbitrage-Ertrag" mit Gesamt-Netzladung, Tabellenspalten für monatliche Netzladung und Arbitrage-Ertrag
- **EAutoAuswertung:** V2H-Info-Box mit Rückspeisung, Ersparnis und Entladepreis, V2H-Spalte in Monatstabelle
- **MonatsDetailView:** Info-Boxen für Arbitrage und V2H mit Monatswerten oder Hinweistext wenn keine Daten erfasst
- Alle Anzeigen nur sichtbar wenn entsprechendes Feature (nutzt_arbitrage / nutzt_v2h) aktiviert

---

### 25. Vehicle-to-Home (V2H) Unterstützung für E-Autos
**Dateien geändert:**
- `lib/investitionTypes.ts` - Neue Parameter für E-Auto (`nutzt_v2h`, `v2h_entlade_preis_cent`)
- `components/investitionen/EAutoFields.tsx` - Checkbox + bedingtes Feld für V2H
- `components/MonatsdatenFormDynamic.tsx` - V2H-Entladung in Monatseingabe + Berechnungen
- `app/api/csv-template/route.ts` - V2H-Spalte in CSV-Vorlage
- `app/api/upload-monatsdaten/route.ts` - V2H-Import und Berechnungslogik

**Features:**
- **Neuer Parameter `nutzt_v2h`:** Opt-in für bidirektionales Laden (Vehicle-to-Home)
- **Entladepreis-Feld:** Typischer vermiedener Strompreis bei V2H-Entladung (ct/kWh)
- **Monatsdaten-Erfassung:** Neues Feld "V2H-Entladung ins Haus (kWh)"
- **Berechnungslogik:** Eigenverbrauch = Direktverbrauch + Batterieentladung + **V2H-Entladung**
- **Einsparungsberechnung:** V2H-Entladung × Entladepreis = vermiedener Netzbezug
- **CSV-Template:** Neue Spalte bei aktiviertem V2H

**Konzept analog zu Speicher-Arbitrage:**
Bei dynamischen Tarifen wird das E-Auto günstig geladen (z.B. 12 ct nachts) und kann bei teuren Zeiten (z.B. 35 ct abends) Strom zurück ins Haus speisen. Das E-Auto dient so als mobiler Speicher.

**Keine Datenbankänderung nötig** - alle Parameter werden im bestehenden JSONB-Feld `parameter` gespeichert.

---

### 24. Manuelle Netzladung für Arbitrage-Speicher
**Dateien geändert:**
- `components/MonatsdatenFormDynamic.tsx` - Neues Eingabefeld "davon aus Netz (kWh)" für Arbitrage-Speicher
- `app/api/upload-monatsdaten/route.ts` - Import-Logik angepasst
- `app/api/csv-template/route.ts` - Arbitrage-Spalten (Ladung Netz, Ladepreis) in Vorlage

**Hintergrund:**
Die automatische Berechnung (Ladung > PV → Netzladung) ist ungenau bei Arbitrage, da auch bei verfügbarer PV aus dem Netz geladen werden kann. Die manuelle Eingabe ermöglicht eine präzisere Erfassung.

---

### 23. Arbitrage-Unterstützung für Speicher mit dynamischen Stromtarifen
**Dateien geändert:**
- `lib/investitionTypes.ts` - Neue Parameter für Speicher (nutzt_arbitrage, lade_durchschnittspreis_cent, entlade_vermiedener_preis_cent)
- `lib/investitionCalculations.ts` - Erweiterte Speicher-Einsparungsberechnung für Arbitrage-Modus
- `components/investitionen/SpeicherFields.tsx` - Checkbox + bedingte Felder für Arbitrage
- `components/MonatsdatenFormDynamic.tsx` - Arbitrage-Logik, Eingabefeld für Ladepreis, Anzeige der Arbitrage-Bilanz
- `hooks/useInvestitionForm.ts` - Boolean-Handling für Checkbox

**Features:**
- **Neuer Parameter `nutzt_arbitrage`:** Opt-in für Speicher mit dynamischen Tarifen (Tibber, aWATTar)
- **Optionale Felder:** Typischer Ladepreis (ct/kWh), typischer Entladepreis (ct/kWh)
- **Monatsdaten-Erfassung:** Bei erkannter Netzladung erscheint Eingabefeld für Ø Ladepreis des Monats
- **Arbitrage-Bilanz:** Anzeige von Ladekosten, vermiedenen Kosten und Arbitrage-Gewinn
- **Erweiterte Berechnung:** 30% Arbitrage-Anteil / 70% PV-Überschuss für Jahresprognose

**Hintergrund:**
Bei dynamischen Tarifen wird günstig aus dem Netz geladen (z.B. 12 ct nachts) und teuer entladen (z.B. 35 ct abends). Der Monatsdurchschnitt würde diese Ersparnis verfälschen. Mit den neuen Feldern wird die wirtschaftliche Betrachtung korrekt abgebildet.

**Keine Datenbankänderung nötig** - alle Parameter werden im bestehenden JSONB-Feld `parameter` gespeichert.

---

## Frühere Änderungen (Session 01.02.2026 - Spät-Abend)

### 20. Community: Öffentliche Auswertungen & Monatsdetails
**Neue Dateien:**
- `components/CommunityMonatsDetailView.tsx` - Detaillierte Monatsansicht für Community
- `app/api/community/anlagen/[id]/auswertung/route.ts` - API für öffentliche Auswertungen
- `supabase/migrations/20260201140000_community_auswertungen.sql` - Community-Funktionen
- `supabase/migrations/20260201150000_add_auswertungen_oeffentlich.sql` - Auswertungen-Freigabe
- `supabase/migrations/20260201160000_extended_public_monatsdaten.sql` - Erweiterte Monatsdaten

**Features:**
- **Neues Freigabe-Feld `auswertungen_oeffentlich`:** Separate Freigabe für Auswertungen (war vorher nicht persistiert!)
- **Community-Monatsdetails:** Komplette Monatsansicht mit PieCharts, FormelTooltips, Insights
- **RPC-Funktionen:**
  - `get_public_auswertung(uuid)` - Gesamt-Auswertung inkl. Wirtschaftlichkeit
  - `get_public_jahresvergleich(uuid)` - Jahresvergleich
  - `get_public_monatsdaten(uuid)` - Erweiterte Monatsdaten mit Batterie- & Finanzdaten

**Bug-Fixes:**
- `auswertungen_oeffentlich` wurde nicht gespeichert/geladen (hardcoded false)
- Strompreis kommt aus `monatsdaten.netzbezug_preis_cent_kwh` (nicht aus anlagen)
- DROP FUNCTION vor Signaturänderung erforderlich

**Dateien geändert:**
- `lib/freigabe-actions.ts` - Speichert jetzt `auswertungen_oeffentlich`
- `app/anlage/page.tsx` - Lädt jetzt `auswertungen_oeffentlich`
- `app/community/[id]/page.tsx` - Zeigt Auswertungen & Monatsdetails

### 21. Alpha-Tester Kurzanleitung
**Datei:** `README.md`

**Features:**
- Schnellstart-Anleitung für Alpha-Tester
- Schritt-für-Schritt Beschreibung
- Link zur ausführlichen Dokumentation

### 22. Sicherheit: .env.local aus Git entfernt
- `.env.local` aus Git-Tracking entfernt (enthielt Credentials)
- Bereits in `.gitignore` eingetragen

---

## Änderungen vom Abend (Session 01.02.2026)

### 12. KI-Insights Dashboard
**Neue Datei:** `components/KIInsightsDashboard.tsx`

**Features:**
- Automatische regelbasierte Analyse der PV-Anlage
- **Erfolge erkennen:** Hohe EV-Quote (≥50%), gute Autarkie (≥50%), überdurchschnittlicher Ertrag (≥1000 kWh/kWp)
- **Warnungen:** Niedrige EV-Quote (<30%), Ertrag unter Erwartung (<800 kWh/kWp), Batterie-Effizienz (<85%), saisonale Schwankungen
- **Optimierungsvorschläge:** Konkrete Handlungsempfehlungen mit geschätztem €-Potenzial
- **Erweiterungsempfehlungen:** Batteriespeicher, Wallbox/E-Auto, Wärmepumpe (basierend auf vorhandenen Investitionen)
- **Preis-Info:** Bezugs- vs. Einspeisepreis mit Spread-Berechnung

**Navigation:** Auswertungen → KI-Analyse (`/auswertung?tab=insights`)

### 13. Formel-Tooltips für berechnete Werte
**Neue Datei:** `components/FormelTooltip.tsx`

**Features:**
- `SimpleTooltip` Komponente mit `position: fixed` für Portal-ähnliches Verhalten
- Dynamische Positionierung (auto/top/bottom)
- Tooltips zeigen Berechnungsformeln für alle berechneten Felder

**Implementiert in:**
- `app/uebersicht/MonatsdatenTable.tsx` - Tooltips für Header-Spalten
- `components/ROIDashboard.tsx` - KPI-Tooltips
- `components/WirtschaftlichkeitStats.tsx` - KPI-Tooltips
- `components/GesamtHaushaltBilanz.tsx` - KPI-Tooltips
- `components/MonatsDetailView.tsx` - KPI-Tooltips (kWh/kWp, EV, Autarkie, Netto-Ertrag, Batterie-Effizienz)

### 14. Übersichtsseite Layout-Fix
**Dateien:** `app/uebersicht/page.tsx`, `app/uebersicht/MonatsdatenTable.tsx`

**Fixes:**
- Dynamische Tabellenhöhe mit Flexbox (`h-full`, `flex-1`, `min-h-0`)
- Nur ein vertikaler Scrollbalken (vorher zwei)
- Calc-basierte Höhe für optimale Platznutzung

### 15. ROI-Berechnung korrigiert
**Datei:** `components/ROIDashboard.tsx`

**Fixes:**
- Feldname korrigiert: `anschaffungskosten_euro` statt `anschaffungskosten_gesamt`
- Korrekte Netto-Ertrag Formel: EV-Einsparung + Einspeise-Erlöse − Betriebsausgaben (OHNE Netzbezugskosten)
- Monatsbasierte Durchschnittsberechnung für Unterjährigkeit

### 16. Prognose vs. IST - Installationsmonat-Handling
**Datei:** `components/PrognoseVsIstDashboard.tsx`

**Features:**
- Toggle zum Ein-/Ausblenden des Installationsmonats (Standard: ausgeblendet)
- Orange Info-Box mit erkanntem Installationsmonat und IST vs. Prognose-Werten
- Sternchen-Markierung (*) im Monatsnamen für Installationsmonat
- Alle KPIs und Charts berücksichtigen die Filterung

### 17. GesamtHaushaltBilanz erweitert
**Datei:** `components/GesamtHaushaltBilanz.tsx`

**Features:**
- PV-Erträge werden jetzt aus Monatsdaten berechnet (nicht nur aus investitionen-Tabelle)
- PV-Anlage als erste Zeile mit gelber Hinterlegung
- Investitionen gruppiert nach Anlage (gelbe Hervorhebung, Einrückung)

### 18. Sidebar aufgeräumt
- `components/Sidebar.tsx` entfernt (war nicht mehr in Verwendung)
- `components/ModernSidebar.tsx` ist die aktive Sidebar
- Fehlende Menüpunkte hinzugefügt: Monats-Details, Optimierung, KI-Analyse

### 19. Dashboard KPIs Refactoring
**Neue Dateien:**
- `components/DashboardKPIs.tsx` - Wiederverwendbare KPI-Komponente
- `components/DashboardKPICard.tsx` - Einzelne KPI-Karte

---

## Änderungen vom Nachmittag (Session 01.02.2026)

### 8. Auswertungsseite komplett überarbeitet
**Problem:** Auswertungsseite nutzte alte Tabellen (`haushalt_komponenten`, `anlagen_komponenten`) die durch Migration entfernt wurden.

**Lösung in `app/auswertung/page.tsx`:**
- Datenquelle korrigiert: Alle Investitions-Daten kommen jetzt aus `investitionen` Tabelle
- Abfragen für Views korrigiert (`investition_prognose_ist_vergleich` hat kein `jahr` Feld)
- Wallbox-Tab und Details-Laden hinzugefügt

### 9. Auswertungs-Komponenten Feldnamen korrigiert
**Dateien:**
- `components/EAutoAuswertung.tsx` - Neue View-Feldnamen (anzahl_monate_erfasst, ist_gesamt_euro, etc.)
- `components/WaermepumpeAuswertung.tsx` - Angepasste Feldnamen mit Fallback
- `lib/supabase-browser.ts` - TypeScript Interface `InvestitionPrognoseIstVergleich` erweitert

**Feldname-Mapping (Alt → Neu):**
- `anzahl_monate` → `anzahl_monate_erfasst`
- `einsparung_ist_jahr_euro` → `ist_gesamt_euro`
- `hochrechnung_jahr_euro` → `ist_hochrechnung_jahr_euro`
- `abweichung_hochrechnung_prozent` → `abweichung_prozent`

### 10. Wallbox-Auswertung hinzugefügt
**Neue Datei:** `components/WallboxAuswertung.tsx`

**Features:**
- KPIs: Gesamt geladen, PV-Anteil, Ladevorgänge, Ø pro Ladevorgang
- Stacked Bar Chart: PV-Strom vs. Netzstrom pro Monat
- Pie Chart: Stromquellen-Verteilung
- Monatsdaten-Tabelle mit PV-Anteil-Badges

### 11. Neue Auswertungs-Komponenten-Bibliothek
**Neue Dateien:**
- `components/auswertungen/AuswertungLayout.tsx` - Gemeinsame Layout-Komponenten
- `components/auswertungen/EAutoAuswertungV2.tsx` - Überarbeitete E-Auto Auswertung mit Hints & Tips

**Gemeinsame Komponenten:**
- `HeaderKPIs` - 4er Grid für Haupt-Kennzahlen
- `KPICard` - Einzelne KPI-Karte
- `BewertungsBox` - Farbkodierte Bewertungsanzeige
- `HintBox` - Hinweise und Tipps (info/success/warning/tip)
- `EmptyState` - Anzeige wenn keine Daten vorhanden

---

## Änderungen vom Vormittag (Session 01.02.2026)

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
- `investition_monatsdaten_detail` - Monatsdaten mit Investitions-Info
- `investition_prognose_ist_vergleich` - Prognose vs. Ist Vergleich
- `investition_jahres_zusammenfassung` - Jahres-Aggregat pro Investition

---

## Offene Punkte / Nächste Schritte
- [x] Auswertungsseite: Datenquellen korrigieren
- [x] Wallbox-Auswertung hinzufügen
- [x] KI-Insights Dashboard mit Analyse & Empfehlungen
- [x] Formel-Tooltips für berechnete Werte
- [x] Installationsmonat-Handling in Prognose
- [x] Community: Auswertungen öffentlich freigeben
- [x] Community: Monatsdetails mit Charts & Tooltips
- [x] Speicher: Arbitrage-Unterstützung für dynamische Tarife
- [x] Speicher: Manuelle Netzladung-Eingabe
- [x] E-Auto: Vehicle-to-Home (V2H) Unterstützung
- [x] Auswertungen: Arbitrage & V2H anzeigen (Phase 1)
- [ ] Community Feature: Kommunikationsfeatures erweitern
- [ ] KI-Insights: Community-Durchschnittswerte einbinden

### Produktionssystem: Sicherheitseinstellungen
- [ ] **Leaked Password Protection aktivieren** (Supabase Dashboard → Authentication → Settings → Security)
  - Prüft Passwörter gegen HaveIBeenPwned-Datenbank
  - Verhindert Verwendung kompromittierter Passwörter
  - Empfohlen für Produktionsumgebungen

### Optional: Arbitrage/V2H Erweiterungen (Phase 2)
- [ ] ROIDashboard: Arbitrage & V2H in Amortisations-Hochrechnung einbeziehen
- [ ] OptimierungsvorschlaegeDashboard: Neue Kategorien für Arbitrage & V2H Empfehlungen
- [ ] WirtschaftlichkeitStats: Arbitrage/V2H Erlöse separat ausweisen
- [ ] CO2ImpactDashboard: V2H zusätzliche CO₂-Einsparung berücksichtigen

## Ausstehende Migrationen
Keine ausstehenden Migrationen - alle V2H- und Arbitrage-Daten werden im bestehenden JSONB-Feld `parameter` gespeichert.

---

## Wichtige URLs
- GitHub: https://github.com/supernova1963/eedc.git
- Branch: main

## Letzte Commits
```
4f6bc1d 🔒 Fix: Supabase Security Warning search_path für alle Funktionen
e95d55f 📚 DEVELOPMENT_STATUS: Auswertungs-Features und Phase 2 dokumentiert
31b1549 ✨ Feature: Arbitrage & V2H in Auswertungen anzeigen
d961825 🐛 Fix: V2H-Parameter werden jetzt in Datenbank gespeichert
a702990 🐛 Fix: Checkbox-Parameter (V2H, Arbitrage) werden jetzt gespeichert
6173e96 📚 DEVELOPMENT_STATUS: V2H-Feature dokumentiert
a31e406 ✨ Feature: Vehicle-to-Home (V2H) Unterstützung für E-Autos
fc468a2 ✨ CSV-Vorlage: Arbitrage-Spalten für Speicher
f78c39e ✨ Feature: Manuelle Eingabe der Netzladung für Arbitrage-Speicher
```
