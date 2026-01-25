# 🧪 EEDC Test-Plan: Authentication & Community-Features

Dieser Test-Plan führt Sie Schritt für Schritt durch das Testen aller neuen Features.

---

## ⚙️ Phase 1: Vorbereitung (5-10 Minuten)

### 1.1 Supabase Dashboard konfigurieren

**Wichtig: Dies muss zuerst erfolgen!**

1. Öffne [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt
3. Gehe zu **Authentication** → **Providers** → **Email**
4. **Deaktiviere** "Confirm email" (für lokale Entwicklung)
   ```
   ☐ Confirm email  ← MUSS DEAKTIVIERT SEIN
   ```
5. Klicke **Save**

6. Gehe zu **Authentication** → **URL Configuration**
7. Füge folgende URLs hinzu:
   - Site URL: `http://localhost:3000`
   - Redirect URLs:
     - `http://localhost:3000`
     - `http://localhost:3000/login`
     - `http://localhost:3000/register`
8. Klicke **Save**

### 1.2 Projekt starten

```bash
# Terminal öffnen
cd /home/gernot/claude/eedc-webapp

# Sicherstellen dass Dependencies installiert sind
npm install

# Dev-Server starten
npm run dev
```

**Erwartetes Ergebnis:**
```
✓ Ready in 2.3s
○ Local:   http://localhost:3000
```

### 1.3 Browser öffnen

- Öffne **http://localhost:3000**
- Du wirst automatisch zu `/login` weitergeleitet ✅

---

## 🔐 Phase 2: Authentication testen (15 Minuten)

### 2.1 Erster Benutzer: Registrierung

1. **Login-Seite prüfen:**
   - ✅ Schönes Gradient-Design mit Sonnen-Icon?
   - ✅ "EEDC Login" Header sichtbar?
   - ✅ Email + Passwort Felder vorhanden?

2. **Klicke auf "Jetzt registrieren"**
   - Du wirst zu `/register` weitergeleitet

3. **Registrierungs-Formular ausfüllen:**
   ```
   Vorname:     Max
   Nachname:    Mustermann
   Email:       max@example.com
   PLZ:         80331 (optional)
   Ort:         München (optional)
   Passwort:    test123456
   Bestätigen:  test123456
   ```

4. **Klicke "Konto erstellen"**

**Erwartetes Ergebnis:**
- ✅ Automatischer Login
- ✅ Redirect zu `/` (Dashboard)
- ✅ Sidebar ist sichtbar mit "Abmelden" Button unten

**Falls Fehler auftreten:**
- "Email-Bestätigung erforderlich" → Prüfe Schritt 1.1 (Email Confirm deaktiviert?)
- "Mitglied konnte nicht erstellt werden" → Prüfe Supabase Logs

### 2.2 Logout testen

1. **Scrolle in der Sidebar nach unten**
2. **Klicke "Abmelden"**

**Erwartetes Ergebnis:**
- ✅ Redirect zu `/login`
- ✅ Du bist ausgeloggt

### 2.3 Login testen

1. **Gib Credentials ein:**
   ```
   Email:     max@example.com
   Passwort:  test123456
   ```

2. **Klicke "Anmelden"**

**Erwartetes Ergebnis:**
- ✅ Erfolgreicher Login
- ✅ Redirect zu `/` (Dashboard)

### 2.4 Zweiter Benutzer erstellen

**Warum?** Um Community-Features zu testen (2 Anlagen von verschiedenen Benutzern)

1. **Klicke "Abmelden"**
2. **Klicke "Jetzt registrieren"**
3. **Registriere zweiten Benutzer:**
   ```
   Vorname:     Anna
   Nachname:    Schmidt
   Email:       anna@example.com
   PLZ:         10115
   Ort:         Berlin
   Passwort:    test123456
   Bestätigen:  test123456
   ```
4. **Klicke "Konto erstellen"**

**Erwartetes Ergebnis:**
- ✅ Eingeloggt als Anna
- ✅ Dashboard ist sichtbar

### 2.5 Middleware & Route Protection testen

1. **Logge dich aus**
2. **Versuche direkt `/eingabe` aufzurufen:**
   - In der URL-Leiste: `http://localhost:3000/eingabe`

**Erwartetes Ergebnis:**
- ✅ Automatischer Redirect zu `/login`

3. **Logge dich wieder ein**
4. **Versuche `/login` aufzurufen:**
   - In der URL-Leiste: `http://localhost:3000/login`

**Erwartetes Ergebnis:**
- ✅ Automatischer Redirect zu `/` (Dashboard)

---

## 📊 Phase 3: Bestehende Features prüfen (10 Minuten)

**Ziel:** Sicherstellen, dass Auth-Änderungen nichts kaputt gemacht haben

### 3.1 Als Max einloggen

```
Email: max@example.com
Passwort: test123456
```

### 3.2 Anlage erstellen

1. **Navigiere zu "Anlagen"** (Sidebar)
2. **Klicke "Neue Anlage erstellen"**
3. **Fülle Formular aus:**
   ```
   Anlagenname:        PV Max München
   Leistung:           9.8 kWp
   Installationsdatum: 01.01.2022
   Standort PLZ:       80331
   Standort Ort:       München
   Batteriekapazität:  10 kWh
   E-Fahrzeug:         ✅ Ja
   E-Fahrzeug Bez.:    Tesla Model 3
   Wärmepumpe:         ✅ Ja
   Wärmepumpe Bez.:    Viessmann Vitocal
   ```
4. **Klicke "Anlage speichern"**

**Erwartetes Ergebnis:**
- ✅ Anlage wurde erstellt
- ✅ Erfolgsmeldung erscheint

### 3.3 Monatsdaten erfassen

1. **Navigiere zu "Daten erfassen"**
2. **Wähle die Anlage "PV Max München"**
3. **Erfasse Monatsdaten:**
   ```
   Jahr:           2024
   Monat:          Januar
   PV-Erzeugung:   650 kWh
   Gesamtverbrauch: 520 kWh
   Eigenverbrauch: 320 kWh
   Netzbezug:      200 kWh
   Einspeisung:    330 kWh
   ```
4. **Klicke "Speichern"**

**Erwartetes Ergebnis:**
- ✅ Daten gespeichert
- ✅ Kann weitere Monate erfassen

5. **Erfasse 2-3 weitere Monate** (variiere die Werte)

---

## 🌍 Phase 4: Community-Features testen (20 Minuten)

### 4.1 Freigaben konfigurieren (als Max)

1. **Navigiere zu "Anlagen"** (Sidebar)
2. **Klicke auf Tab "Freigabe"**

**Erwartetes Ergebnis:**
- ✅ 6 Checkboxen für Freigaben sichtbar
- ✅ Alle sind standardmäßig deaktiviert
- ✅ Datenschutz-Info-Box vorhanden

3. **Aktiviere folgende Freigaben:**
   ```
   ✅ Profil öffentlich
   ✅ Kennzahlen öffentlich
   ✅ Monatsdaten öffentlich
   ☐ Investitionen öffentlich (optional)
   ☐ Auswertungen öffentlich (optional)
   ☐ Standort genau (lasse deaktiviert für Test)
   ```

4. **Klicke "Freigabe speichern"**

**Erwartetes Ergebnis:**
- ✅ Erfolgsmeldung
- ✅ Freigaben gespeichert

### 4.2 Profilbeschreibung hinzufügen

1. **Wechsle zurück zu Tab "Profil"**
2. **Scrolle zu "Profilbeschreibung"**
3. **Füge Text hinzu:**
   ```
   Meine erste PV-Anlage mit Speicher und E-Auto.
   Super Erfahrungen, vor allem im Sommer erreiche ich
   über 90% Autarkie. Kann ich nur empfehlen!
   ```
4. **Klicke "Speichern"**

### 4.3 Community-Seite öffnen

1. **Navigiere zu "Community"** in der Sidebar
   - ✅ "NEU" Badge sichtbar?

2. **Community-Übersichtsseite prüfen:**
   - ✅ Statistiken sichtbar (Anzahl Anlagen, Gesamtleistung)?
   - ✅ Deine Anlage "PV Max München" wird angezeigt?
   - ✅ Standort zeigt "München (80XXX)" (anonymisiert)?
   - ✅ Badges für Batterie, E-Auto, Wärmepumpe sichtbar?
   - ✅ "von Max aus München" wird angezeigt?

### 4.4 Anlagen-Detailseite testen

1. **Klicke auf die Anlage "PV Max München"**

**Erwartetes Ergebnis:**
- ✅ Schöner blauer Gradient-Header
- ✅ Anlagenname, Leistung, Standort sichtbar
- ✅ "Geteilt von Max aus München"
- ✅ Kennzahlen-Karten angezeigt (Gesamterzeugung, Autarkiegrad, CO₂)
- ✅ Beschreibung wird angezeigt
- ✅ Technische Daten sichtbar
- ✅ Komponenten-Box zeigt Batterie, E-Auto, Wärmepumpe
- ✅ Datenschutz-Hinweis vorhanden

2. **Klicke "Zurück zur Community"**

### 4.5 Filter testen

1. **Zurück auf Community-Übersicht**
2. **Teste Ort-Filter:**
   - Gib "München" ein
   - Klicke "Filter anwenden"
   - ✅ Deine Anlage wird angezeigt

3. **Teste Feature-Filter:**
   - Aktiviere "Mit Batteriespeicher"
   - Aktiviere "Mit E-Auto"
   - Klicke "Filter anwenden"
   - ✅ Deine Anlage wird angezeigt (hat beide Features)

4. **Klicke "Zurücksetzen"**
   - ✅ Filter werden zurückgesetzt

### 4.6 Zweite Anlage erstellen (als Anna)

1. **Klicke "Abmelden"**
2. **Login als Anna:**
   ```
   Email: anna@example.com
   Passwort: test123456
   ```

3. **Navigiere zu "Anlagen"**
4. **Erstelle neue Anlage:**
   ```
   Anlagenname:        Solar Berlin Mitte
   Leistung:           12.5 kWp
   Installationsdatum: 01.06.2023
   Standort PLZ:       10115
   Standort Ort:       Berlin
   Batteriekapazität:  0 (keine)
   E-Fahrzeug:         ☐ Nein
   Wärmepumpe:         ☐ Nein
   ```
5. **Klicke "Anlage speichern"**

6. **Erfasse 2-3 Monatsdaten** (siehe Phase 3.3)

7. **Gehe zu "Anlagen" → Tab "Freigabe"**
8. **Aktiviere Freigaben:**
   ```
   ✅ Profil öffentlich
   ✅ Kennzahlen öffentlich
   ✅ Standort genau (AKTIVIERT für Test!)
   ```
9. **Klicke "Freigabe speichern"**

10. **Tab "Profil"** → Profilbeschreibung:
    ```
    Kleine Anlage ohne Speicher, aber sehr effizient.
    Wohne in Berlin Mitte und speise viel ein.
    ```
11. **Klicke "Speichern"**

### 4.7 Beide Anlagen in Community prüfen

1. **Navigiere zu "Community"**

**Erwartetes Ergebnis:**
- ✅ Statistik zeigt "2 Anlagen"
- ✅ Beide Anlagen werden angezeigt
- ✅ "PV Max München" zeigt "80XXX" (anonymisiert)
- ✅ "Solar Berlin Mitte" zeigt "10115" (genau, weil aktiviert)
- ✅ "PV Max München" hat Batterie/E-Auto/Wärmepumpe Badges
- ✅ "Solar Berlin Mitte" hat KEINE Badges

2. **Teste Filter:**
   - Aktiviere "Mit Batteriespeicher"
   - Klicke "Filter anwenden"
   - ✅ Nur "PV Max München" wird angezeigt
   - Klicke "Zurücksetzen"

3. **Klicke auf "Solar Berlin Mitte"**
   - ✅ Detailseite öffnet sich
   - ✅ Profilbeschreibung sichtbar
   - ✅ PLZ wird genau angezeigt (10115)
   - ✅ Komponenten-Box zeigt "Keine zusätzlichen Komponenten"

### 4.8 Freigabe widerrufen testen

1. **Navigiere zu "Anlagen" → Tab "Freigabe"**
2. **Deaktiviere "Profil öffentlich"**
3. **Klicke "Freigabe speichern"**

4. **Navigiere zu "Community"**

**Erwartetes Ergebnis:**
- ✅ Nur noch "PV Max München" wird angezeigt (1 Anlage)
- ✅ "Solar Berlin Mitte" ist verschwunden

5. **Reaktiviere Freigabe:**
   - "Anlagen" → "Freigabe" → "Profil öffentlich" ✅
   - "Freigabe speichern"
   - Prüfe Community → ✅ Wieder 2 Anlagen sichtbar

---

## 📄 Phase 5: Datenschutz-Seite testen (5 Minuten)

### 5.1 Datenschutz-Seite öffnen

1. **In der URL-Leiste:** `http://localhost:3000/datenschutz`

**Erwartetes Ergebnis:**
- ✅ Umfassende Datenschutzerklärung sichtbar
- ✅ Shield-Icon im Header
- ✅ Alle 12 Abschnitte vorhanden:
  1. Übersicht
  2. Verantwortlicher
  3. Welche Daten werden erfasst?
  4. Zweck der Datenverarbeitung
  5. Community-Funktion
  6. Rechtsgrundlage
  7. Datenspeicherung
  8. Ihre Rechte
  9. Datenlöschung
  10. Cookies
  11. Änderungen
  12. Kontakt
- ✅ Freigabe-Optionen-Box sichtbar
- ✅ "Zurück zum Dashboard" Button funktioniert

---

## 🔧 Phase 6: Edge Cases & Error Handling (10 Minuten)

### 6.1 Falsches Passwort

1. **Logout**
2. **Login-Versuch mit falschem Passwort:**
   ```
   Email: max@example.com
   Passwort: falsches_passwort
   ```
3. **Klicke "Anmelden"**

**Erwartetes Ergebnis:**
- ✅ Fehlermeldung erscheint (rot)
- ✅ "Invalid login credentials" oder ähnlich
- ✅ Kein Redirect

### 6.2 Nicht-existierender Benutzer

1. **Login-Versuch:**
   ```
   Email: nicht@existent.com
   Passwort: test123456
   ```
2. **Klicke "Anmelden"**

**Erwartetes Ergebnis:**
- ✅ Fehlermeldung erscheint

### 6.3 Registrierung mit bereits verwendeter Email

1. **Klicke "Jetzt registrieren"**
2. **Registrierung mit:**
   ```
   Email: max@example.com  ← Bereits vergeben
   ...
   ```
3. **Klicke "Konto erstellen"**

**Erwartetes Ergebnis:**
- ✅ Fehlermeldung "User already registered" o.ä.

### 6.4 Passwort-Validierung

1. **Registrierung mit kurzem Passwort:**
   ```
   Email: test@test.com
   Passwort: 12345  ← Zu kurz
   ```
2. **Klicke "Konto erstellen"**

**Erwartetes Ergebnis:**
- ✅ Fehlermeldung "Passwort muss mindestens 6 Zeichen lang sein"

3. **Passwort-Bestätigung falsch:**
   ```
   Passwort: test123456
   Bestätigen: test654321  ← Nicht identisch
   ```
4. **Klicke "Konto erstellen"**

**Erwartetes Ergebnis:**
- ✅ Fehlermeldung "Passwörter stimmen nicht überein"

### 6.5 Nicht-öffentliche Anlage direkt aufrufen

1. **Login als Max**
2. **Hole Anlagen-ID:**
   - "Anlagen" → URL-Leiste → `?anlageId=XXXX-XXX...`
   - Kopiere die UUID

3. **Deaktiviere Freigabe:**
   - "Anlagen" → "Freigabe" → Deaktiviere "Profil öffentlich"
   - "Freigabe speichern"

4. **Logout**

5. **Login als Anna**

6. **Versuche direkt auf Max's Anlage zuzugreifen:**
   - URL: `http://localhost:3000/community/[KOPIERTE-UUID]`

**Erwartetes Ergebnis:**
- ✅ Fehlerseite: "Anlage nicht gefunden oder nicht öffentlich"
- ✅ "Zurück zur Community" Button funktioniert

---

## 📱 Phase 7: Responsive Design testen (5 Minuten)

### 7.1 Browser DevTools öffnen

1. **Drücke F12** (oder Rechtsklick → Untersuchen)
2. **Aktiviere Device Toolbar** (Strg+Shift+M)

### 7.2 Mobile Ansicht testen

1. **Wähle "iPhone 12 Pro"**
2. **Teste folgende Seiten:**
   - ✅ `/login` - Formular gut lesbar?
   - ✅ `/register` - Zweispalten-Layout wird einspaltig?
   - ✅ `/` (Dashboard) - Sidebar als Overlay?
   - ✅ `/community` - Karten werden einspaltig?
   - ✅ `/community/[id]` - Detailseite gut lesbar?

### 7.3 Tablet Ansicht

1. **Wähle "iPad Air"**
2. **Prüfe Community-Seite:**
   - ✅ 2-spaltig bei Anlagen-Karten?
   - ✅ Filter gut bedienbar?

---

## ✅ Phase 8: Finale Checkliste

### Authentication
- ✅ Registrierung funktioniert
- ✅ Login funktioniert
- ✅ Logout funktioniert
- ✅ Middleware schützt Routen
- ✅ Session bleibt nach Reload erhalten
- ✅ Fehlerbehandlung funktioniert

### Community-Features
- ✅ Freigaben können aktiviert/deaktiviert werden
- ✅ Öffentliche Anlagen werden angezeigt
- ✅ Nicht-öffentliche Anlagen sind versteckt
- ✅ Filter funktionieren
- ✅ Detailseite zeigt nur freigegebene Daten
- ✅ Standort-Anonymisierung funktioniert
- ✅ Statistiken sind korrekt

### Bestehende Features
- ✅ Anlagen erstellen/bearbeiten funktioniert
- ✅ Monatsdaten erfassen funktioniert
- ✅ Dashboard zeigt Daten des eingeloggten Users

### Datenschutz
- ✅ Privacy by Default (alles deaktiviert)
- ✅ Datenschutzerklärung vollständig
- ✅ Datenschutz-Hinweise auf Community-Seiten

### UI/UX
- ✅ Responsive Design funktioniert
- ✅ Icons werden korrekt angezeigt
- ✅ Gradient-Designs sehen gut aus
- ✅ Navigation ist intuitiv

---

## 🐛 Bekannte Probleme & Lösungen

### Problem: "Not authenticated" nach Registrierung
**Lösung:**
1. Supabase Dashboard → Authentication → Providers → Email
2. Deaktiviere "Confirm email"
3. Klicke Save

### Problem: Session verloren nach Reload
**Lösung:**
1. Prüfe ob `.env.local` korrekt konfiguriert ist
2. Prüfe Browser Console auf Fehler
3. Lösche Cookies und versuche erneut

### Problem: "Anlage nicht gefunden" in Community
**Lösung:**
1. Prüfe ob "Profil öffentlich" aktiviert ist
2. Prüfe Supabase → Table Editor → `anlagen_freigaben`
3. Stelle sicher dass `profil_oeffentlich = true`

### Problem: Middleware Loop
**Lösung:**
1. Prüfe ob `/login` und `/register` in der Middleware ausgeschlossen sind
2. Hard Reload (Strg+Shift+R)

---

## 📊 Erwartete Testergebnisse

Nach vollständigem Durchlauf sollten Sie:

- ✅ **2 Benutzer-Accounts** (Max & Anna)
- ✅ **2 Anlagen** (beide öffentlich)
- ✅ **Community mit 2 Anlagen**
- ✅ **Funktionierende Filter**
- ✅ **Funktionierende Authentication**
- ✅ **Vollständigen Datenschutz**

**Geschätzte Testdauer:** ~60-70 Minuten

---

## 🎉 Erfolgreicher Test!

Wenn alle Phasen erfolgreich durchlaufen wurden:

1. **Gratulation!** 🎉 Alle Features funktionieren
2. **Nächste Schritte:**
   - Produktiv-Deployment vorbereiten
   - Email-Bestätigung aktivieren
   - Row Level Security (RLS) in Supabase aktivieren
   - Weitere Anlagen hinzufügen

3. **Optional: Weitere Features**
   - Anlagen-Vergleich implementieren
   - Karte mit Standorten hinzufügen
   - Export-Funktionen erweitern

---

## 📝 Test-Protokoll

Nutze diese Checkliste während des Tests:

```
[ ] Phase 1: Vorbereitung
    [ ] 1.1 Supabase konfiguriert
    [ ] 1.2 Projekt gestartet
    [ ] 1.3 Browser geöffnet

[ ] Phase 2: Authentication
    [ ] 2.1 Max registriert
    [ ] 2.2 Logout funktioniert
    [ ] 2.3 Login funktioniert
    [ ] 2.4 Anna registriert
    [ ] 2.5 Route Protection funktioniert

[ ] Phase 3: Bestehende Features
    [ ] 3.1 Als Max eingeloggt
    [ ] 3.2 Anlage erstellt
    [ ] 3.3 Monatsdaten erfasst

[ ] Phase 4: Community
    [ ] 4.1 Freigaben konfiguriert
    [ ] 4.2 Profilbeschreibung hinzugefügt
    [ ] 4.3 Community-Seite funktioniert
    [ ] 4.4 Detailseite funktioniert
    [ ] 4.5 Filter funktionieren
    [ ] 4.6 Anna's Anlage erstellt
    [ ] 4.7 Beide Anlagen sichtbar
    [ ] 4.8 Freigabe-Widerruf funktioniert

[ ] Phase 5: Datenschutz
    [ ] 5.1 Datenschutz-Seite vollständig

[ ] Phase 6: Edge Cases
    [ ] 6.1 Falsches Passwort
    [ ] 6.2 Nicht-existierender User
    [ ] 6.3 Doppelte Email
    [ ] 6.4 Passwort-Validierung
    [ ] 6.5 Nicht-öffentliche Anlage

[ ] Phase 7: Responsive
    [ ] 7.1 DevTools geöffnet
    [ ] 7.2 Mobile funktioniert
    [ ] 7.3 Tablet funktioniert

[ ] Phase 8: Finale Checkliste
    [Alle Punkte durchgegangen]
```

---

Bei Fragen oder Problemen: Siehe `AUTHENTICATION_SETUP.md` und `COMMUNITY_FEATURES.md`
