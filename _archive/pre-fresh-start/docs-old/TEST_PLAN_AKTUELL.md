# 🧪 EEDC Test-Plan: Authentication & Community-Features (AKTUALISIERT)

Dieser Test-Plan führt Sie Schritt für Schritt durch das Testen aller neuen Features.

**Status der Implementierung:**
- ✅ Authentication (Login, Register, Logout)
- ✅ Anlage erstellen (Basis-Informationen)
- ✅ Multi-User Support
- ✅ Password-Validierung
- ⏳ Community Features (bereit, müssen getestet werden)

---

## ✅ Phase 1-3: ABGESCHLOSSEN

Sie haben bereits erfolgreich abgeschlossen:
- ✅ Supabase konfiguriert
- ✅ Benutzer registriert (Max)
- ✅ Login/Logout getestet
- ✅ Erste Anlage erstellt ("PV Haus München")

---

## 📊 Phase 4: Weitere Anlagen erstellen (10 Minuten)

**Ziel:** Mehrere Anlagen für Community-Tests vorbereiten

### 4.1 Zweite Anlage für Max erstellen

1. **Navigiere zu "Anlagen"** (Sidebar)
2. **Solltest du die "PV Haus München" Anlage sehen**
   - Falls nicht: Prüfe ob du als Max eingeloggt bist
3. **In der Sidebar unter "Anlagen" → Klicke auf das + Icon oder "Neu"**
4. **Oder navigiere direkt zu:** http://localhost:3000/anlage/neu

5. **Fülle Formular aus:**
   ```
   Anlagenname:        PV Garage
   Leistung:           5.2 kWp
   Installationsdatum: 15.06.2023
   Standort PLZ:       80331
   Standort Ort:       München
   ```

6. **Klicke "Anlage erstellen"**

**Erwartetes Ergebnis:**
- ✅ Redirect zur Anlagen-Seite
- ✅ "PV Garage" wird angezeigt
- ✅ In Supabase: Neue Anlage mit `mitglied_id` von Max

### 4.2 Zweiten Benutzer erstellen und Anlage hinzufügen

1. **Klicke "Abmelden"**
2. **Klicke "Jetzt registrieren"**
3. **Registriere Anna Schmidt:**
   ```
   Vorname:     Anna
   Nachname:    Schmidt
   Email:       anna@example.com
   PLZ:         10115
   Ort:         Berlin
   Passwort:    test123456
   Bestätigen:  test123456
   ```

4. **Nach automatischem Login:**
   - ✅ Du siehst den "Willkommen bei EEDC!" Empty State
   - ✅ Button "Erste Anlage erstellen" ist sichtbar

5. **Klicke "Erste Anlage erstellen"**

6. **Fülle Formular aus:**
   ```
   Anlagenname:        PV Berlin Mitte
   Leistung:           12.4 kWp
   Installationsdatum: 01.03.2023
   Standort PLZ:       10115
   Standort Ort:       Berlin
   ```

7. **Klicke "Anlage erstellen"**

**Erwartetes Ergebnis:**
- ✅ Anna sieht nur ihre eigene Anlage
- ✅ Empty State ist verschwunden

### 4.3 Dritten Benutzer mit Batterie erstellen

1. **Abmelden und registrieren:**
   ```
   Vorname:     Thomas
   Nachname:    Weber
   Email:       thomas@example.com
   PLZ:         50667
   Ort:         Köln
   Passwort:    test123456
   ```

2. **Anlage erstellen:**
   ```
   Anlagenname:        PV Köln Ehrenfeld
   Leistung:           15.6 kWp
   Installationsdatum: 20.08.2021
   Standort PLZ:       50667
   Standort Ort:       Köln
   ```

**Hinweis:** Batteriespeicher wird später als Investition erfasst

---

## 📈 Phase 5: Investitionen erfassen (10 Minuten)

**Ziel:** Batteriespeicher und andere Komponenten als Investitionen erfassen

### 5.1 Investitionstypen prüfen

1. **Als Max eingeloggt**
2. **Navigiere zu "Investitionen" → "Investitionstypen"**
3. **Prüfe vorhandene Typen:**
   - ✅ Batteriespeicher
   - ✅ Wechselrichter
   - ✅ PV-Module
   - ✅ Montagesystem
   - ✅ Sonstiges

**Falls Typen fehlen:** Füge sie hinzu

### 5.2 Batteriespeicher für Max erfassen

1. **Navigiere zu "Investitionen" → "Neu"**
2. **Fülle aus:**
   ```
   Bezeichnung:        Tesla Powerwall 2
   Investitionstyp:    Batteriespeicher
   Anlage:             PV Haus München
   Anschaffungsdatum:  01.01.2022
   Kosten:             12000 €
   Beschreibung:       13.5 kWh Speicherkapazität
   ```

3. **Speichern**

**Erwartetes Ergebnis:**
- ✅ Investition erscheint in der Liste
- ✅ Zugeordnet zu "PV Haus München"

### 5.3 Wechselrichter für Thomas erfassen

1. **Als Thomas einloggen**
2. **Investition erstellen:**
   ```
   Bezeichnung:        SMA Sunny Tripower
   Investitionstyp:    Wechselrichter
   Anlage:             PV Köln Ehrenfeld
   Anschaffungsdatum:  20.08.2021
   Kosten:             3500 €
   ```

---

## 🌍 Phase 6: Community-Features testen (15 Minuten)

**Ziel:** Public Sharing und Privacy Settings testen

### 6.1 Community-Seite als Gast aufrufen

1. **Abmelden**
2. **Navigiere zu:** http://localhost:3000/community

**Erwartetes Ergebnis:**
- ✅ Redirect zu `/login` (Community ist nur für eingeloggte User)

### 6.2 Community als Max erkunden

1. **Als Max einloggen**
2. **Klicke in Sidebar auf "Community"**

**Erwartetes Ergebnis:**
- ✅ Liste aller öffentlichen Anlagen
- ✅ Aktuell leer, da noch nichts freigegeben wurde

### 6.3 Anlage öffentlich machen

**Hinweis:** Die Freigaben-Funktion muss noch in der Anlagen-Detail-Seite implementiert werden.

**Für jetzt:**
1. **Öffne Supabase Dashboard**
2. **Gehe zu Table Editor → `anlagen_freigaben`**
3. **Finde Annas Anlage (PV Berlin Mitte)**
4. **Setze folgende Felder auf `true`:**
   - `profil_oeffentlich`: true
   - `kennzahlen_oeffentlich`: true
   - `standort_genau`: false (PLZ wird anonymisiert)

5. **Speichern**

### 6.4 Community-Seite neu laden

1. **Als Max: http://localhost:3000/community**

**Erwartetes Ergebnis:**
- ✅ Annas Anlage "PV Berlin Mitte" ist sichtbar
- ✅ PLZ ist anonymisiert: "101XX" (statt 10115)
- ✅ Besitzer: "Anna aus Berlin"
- ✅ Leistung: 12.4 kWp
- ✅ Installationsjahr: 2023

### 6.5 Anlage-Details aufrufen

1. **Klicke auf "PV Berlin Mitte"**

**Erwartetes Ergebnis:**
- ✅ Detail-Seite öffnet sich
- ✅ Technische Daten sichtbar (falls freigegeben)
- ✅ Privacy-Notice: "Diese Daten werden mit der Community geteilt"

### 6.6 Filter testen

1. **Zurück zur Community-Übersicht**
2. **Mache Thomas' Anlage öffentlich** (in Supabase)
3. **Teste Filter:**
   - Ort: "Berlin" → Nur Annas Anlage
   - Ort: "Köln" → Nur Thomas' Anlage
   - Min. Leistung: 15 kWp → Nur Thomas' Anlage

---

## 🔒 Phase 7: Privacy & Security testen (10 Minuten)

### 7.1 Datenschutz-Seite prüfen

1. **Navigiere zu:** http://localhost:3000/datenschutz

**Erwartetes Ergebnis:**
- ✅ Vollständige GDPR-konforme Datenschutzerklärung
- ✅ Erklärung aller 6 Privacy-Levels
- ✅ Nutzerrechte dokumentiert

### 7.2 Zugriffskontrolle testen

1. **Als Max eingeloggt**
2. **Versuche Annas Anlage zu bearbeiten:**
   - Finde Annas `anlage_id` in Supabase
   - Navigiere zu: `http://localhost:3000/anlage?anlageId=<annas-id>`

**Erwartetes Ergebnis:**
- ✅ Keine Berechtigung / Zugriff verweigert
- ✅ Oder: Redirect zur eigenen Anlage

### 7.3 RLS Policies prüfen (in Supabase)

1. **Öffne Supabase Dashboard**
2. **Gehe zu: Authentication & API → Policies**
3. **Prüfe Policies für `anlagen` Tabelle:**
   - ✅ SELECT: User kann nur eigene Anlagen sehen
   - ✅ INSERT: User kann nur für sich selbst Anlagen erstellen
   - ✅ UPDATE: User kann nur eigene Anlagen bearbeiten
   - ✅ DELETE: User kann nur eigene Anlagen löschen

---

## 📊 Phase 8: Daten-Import testen (10 Minuten)

### 8.1 CSV-Template herunterladen

1. **Als Max eingeloggt**
2. **Navigiere zu "Daten importieren"**
3. **Wähle Anlage: "PV Haus München"**
4. **Klicke "CSV-Template herunterladen"**

**Erwartetes Ergebnis:**
- ✅ CSV-Datei wird heruntergeladen
- ✅ Template enthält korrekte Spalten für gewählte Anlage

### 8.2 CSV ausfüllen und importieren

1. **Öffne heruntergeladene CSV**
2. **Fülle ein paar Zeilen aus:**
   ```csv
   Jahr,Monat,Erzeugung (kWh),Einspeisung (kWh),Eigenverbrauch (kWh),Netzbezug (kWh),Gesamtverbrauch (kWh)
   2024,1,650,200,450,300,750
   2024,2,720,250,470,280,750
   2024,3,850,300,550,320,870
   ```

3. **Speichere CSV**
4. **Zurück zu "Daten importieren"**
5. **Wähle Datei und klicke "Importieren"**

**Erwartetes Ergebnis:**
- ✅ Erfolgreiche Import-Meldung
- ✅ Zeilen-Anzahl korrekt angezeigt
- ✅ Daten in Datenbank gespeichert

### 8.3 Auswertungen prüfen

1. **Navigiere zu "Auswertungen"**
2. **Wähle Jahr: 2024**

**Erwartetes Ergebnis:**
- ✅ Monatliche Daten werden angezeigt
- ✅ Charts sind sichtbar
- ✅ Kennzahlen berechnet (Autarkiegrad, Eigenverbrauchsquote)

---

## 🎯 Abschluss-Checkliste

**Authentication:**
- [ ] Registrierung funktioniert
- [ ] Login funktioniert
- [ ] Logout funktioniert
- [ ] Route Protection aktiv
- [ ] Password-Validierung zeigt Live-Feedback

**Multi-User:**
- [ ] Mehrere User können sich registrieren
- [ ] Jeder User sieht nur eigene Anlagen
- [ ] User können nicht auf fremde Anlagen zugreifen

**Anlagen:**
- [ ] Anlage erstellen funktioniert
- [ ] Anlagen-Liste zeigt nur eigene Anlagen
- [ ] Empty State für neue User funktioniert

**Investitionen:**
- [ ] Investitionen können erfasst werden
- [ ] Zuordnung zu Anlagen funktioniert
- [ ] Nur eigene Investitionen sichtbar

**Community:**
- [ ] Community-Seite zeigt öffentliche Anlagen
- [ ] Privacy Settings funktionieren
- [ ] Standort-Anonymisierung aktiv (wenn gewünscht)
- [ ] Filter funktionieren

**Daten-Import:**
- [ ] CSV-Template Download funktioniert
- [ ] Import funktioniert
- [ ] Daten werden korrekt gespeichert

**Datenschutz:**
- [ ] Datenschutzerklärung vollständig
- [ ] RLS Policies aktiv
- [ ] Privacy by Default funktioniert

---

## 🐛 Bekannte Probleme & TODOs

### Noch zu implementieren:

1. **Freigaben-UI in Anlagen-Seite:**
   - Aktuell müssen Freigaben manuell in Supabase gesetzt werden
   - TODO: UI-Komponente für Privacy-Settings in Anlagen-Detail-Seite

2. **E-Fahrzeuge und Wärmepumpen:**
   - Datenbank-Spalten fehlen noch
   - SQL-Migration erstellen:
   ```sql
   ALTER TABLE anlagen
   ADD COLUMN ekfz_vorhanden BOOLEAN DEFAULT false,
   ADD COLUMN ekfz_bezeichnung TEXT,
   ADD COLUMN waermepumpe_vorhanden BOOLEAN DEFAULT false,
   ADD COLUMN waermepumpe_bezeichnung TEXT;
   ```

3. **Batteriespeicher-Spalte:**
   - `batteriekapazitaet_kwh` Spalte prüfen ob vorhanden
   - Falls nicht: Wurde entfernt, da Batterie als Investition erfasst wird

4. **Anlagen-Switcher:**
   - Wenn User mehrere Anlagen hat: Dropdown zum Wechseln
   - Aktuell wird immer die neueste Anlage angezeigt

---

## 📞 Support

Bei Problemen:
1. Browser-Konsole prüfen (F12)
2. Server-Logs prüfen (Terminal)
3. Supabase Logs prüfen (Dashboard → Logs)
4. Debug-Seite aufrufen: http://localhost:3000/debug
