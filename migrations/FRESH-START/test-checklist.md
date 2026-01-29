# Testing Checklist - Auth-Refactoring

**Datum:** 2026-01-29
**Session:** Auth-Refactoring Verification
**Ziel:** Sicherstellen dass die neue Auth-Struktur korrekt funktioniert

---

## 🗄️ Datenbank-Tests (SQL)

### 1. RLS Policies testen

**Skript:** `migrations/FRESH-START/test-rls-policies.sql`

**Ausführung:**
1. Öffne Supabase Dashboard → SQL Editor
2. Füge das Skript ein
3. Führe aus
4. Prüfe alle Test-Ergebnisse auf "PASS"

**Erwartete Ergebnisse:**
- [ ] ✅ TEST 1.1: Öffentliche Anlagen sichtbar → PASS
- [ ] ✅ TEST 1.2: Private Anlagen nicht öffentlich → PASS
- [ ] ✅ TEST 2.1: Öffentliche Monatsdaten sichtbar → PASS
- [ ] ✅ TEST 2.2: Private Monatsdaten nicht öffentlich → PASS
- [ ] ✅ TEST 3.1: Öffentliche Anlagen-Komponenten sichtbar → PASS
- [ ] ✅ TEST 3.2: Öffentliche Haushalts-Komponenten sichtbar → PASS
- [ ] ✅ TEST 3.3: Private Haushalts-Komponenten nicht öffentlich → PASS
- [ ] ✅ TEST 4.1: current_mitglied_id() Function existiert → PASS
- [ ] ✅ TEST 4.2: user_owns_anlage() Function existiert → PASS
- [ ] ✅ TEST 5.1: RLS auf allen Core-Tabellen aktiviert → PASS (7/7)
- [ ] ✅ TEST 6.1: mitglieder Policies → PASS
- [ ] ✅ TEST 6.2: anlagen Policies → PASS
- [ ] ✅ TEST 6.3: monatsdaten Policies → PASS
- [ ] ✅ TEST 7.1: Alle aktiven Anlagen haben Freigaben → PASS
- [ ] ✅ TEST 7.2: Mitglieder-Status konsistent → INFO

---

## 🌐 UI Tests (Manuell)

### 2. Login & Auth Flow

**URL:** `/login`

- [ ] Login funktioniert
- [ ] Nach Login: Redirect zu Dashboard
- [ ] Mitglied-Daten werden korrekt geladen
- [ ] Logout funktioniert

### 3. Dashboard (Hauptseite)

**URL:** `/meine-anlage`

**Single-Anlage Szenario:**
- [ ] Dashboard zeigt die eigene Anlage
- [ ] Keine Anlagen-Selector sichtbar (bei nur 1 Anlage)
- [ ] Kennzahlen werden angezeigt
- [ ] Keine Fehler in Console

**Multi-Anlage Szenario:**
- [ ] AnlagenSelector wird angezeigt (bei 2+ Anlagen)
- [ ] Wechsel zwischen Anlagen funktioniert
- [ ] URL-Parameter `?anlageId=...` wird gesetzt
- [ ] Daten werden korrekt für gewählte Anlage geladen
- [ ] Keine Fehler in Console

### 4. Eingabe-Seite

**URL:** `/eingabe`

- [ ] Seite lädt ohne Fehler
- [ ] AnlagenSelector funktioniert (bei Multi-Anlage)
- [ ] Tab-Wechsel (Anlage/Haushalt) funktioniert
- [ ] Tab-Links erhalten `anlageId` Parameter
- [ ] Anlagen-Komponenten werden korrekt geladen:
  - [ ] Speicher
  - [ ] Wechselrichter
  - [ ] Wallbox
- [ ] Haushalts-Komponenten werden korrekt geladen:
  - [ ] E-Auto
  - [ ] Wärmepumpe
- [ ] Keine Fehler in Console

### 5. Auswertung-Seite

**URL:** `/auswertung`

- [ ] Seite lädt ohne Fehler
- [ ] AnlagenSelector funktioniert
- [ ] Monatsdaten werden für richtige Anlage geladen
- [ ] Tab-Wechsel funktioniert
- [ ] E-Auto Auswertung (wenn vorhanden)
- [ ] Wärmepumpe Auswertung (wenn vorhanden)
- [ ] Speicher Auswertung (wenn vorhanden)
- [ ] Keine Fehler in Console

### 6. Investitionen-Seite

**URL:** `/investitionen`

- [ ] Seite lädt ohne Fehler
- [ ] Investitionen werden angezeigt
- [ ] Richtige Tabelle wird verwendet:
  - [ ] E-Auto → haushalt_komponenten
  - [ ] Wärmepumpe → haushalt_komponenten
  - [ ] Speicher → anlagen_komponenten
  - [ ] Wechselrichter → anlagen_komponenten
  - [ ] Wallbox → anlagen_komponenten
- [ ] Löschen funktioniert (aus richtiger Tabelle)
- [ ] Keine Fehler in Console

### 7. Stammdaten-Seite

**URL:** `/stammdaten`

- [ ] Seite lädt ohne Fehler
- [ ] Komponenten-Anzahl wird korrekt gezählt:
  - [ ] Anlagen-Komponenten (aus anlagen_komponenten)
  - [ ] Haushalts-Komponenten (aus haushalt_komponenten)
  - [ ] Gesamt-Summe stimmt
- [ ] Strompreise werden gezählt
- [ ] Keine Fehler in Console

### 8. Anlage-Profil

**URL:** `/anlage`

- [ ] Seite lädt ohne Fehler
- [ ] AnlagenSelector funktioniert
- [ ] Anlage-Daten werden angezeigt
- [ ] Freigaben werden korrekt geladen
- [ ] Keine Fehler in Console

### 9. Daten-Import

**URL:** `/daten-import`

- [ ] Seite lädt ohne Fehler
- [ ] CSV-Template Download funktioniert
- [ ] Template enthält korrekte Spalten für Anlage
- [ ] CSV-Upload funktioniert
- [ ] Daten werden in richtige Anlage importiert
- [ ] Keine Fehler in Console

---

## 🔐 Security Tests

### 10. RLS Permission Tests

**Szenario 1: User kann nur eigene Daten sehen**

1. Login als User A
2. Notiere eine Anlage-ID von User A
3. Logout
4. Login als User B
5. Versuche URL mit Anlage-ID von User A aufzurufen:
   - `/meine-anlage?anlageId=<USER_A_ANLAGE_ID>`
   - **Erwartung:** Fehler oder Fallback auf eigene Anlage

**Ergebnis:**
- [ ] ✅ User B kann keine Daten von User A sehen
- [ ] ✅ RLS blockiert Zugriff korrekt

**Szenario 2: Anonymous User sieht nur öffentliche Daten**

1. Logout (nicht eingeloggt)
2. Versuche private Anlagen abzurufen
   - **Erwartung:** Keine privaten Daten sichtbar

**Ergebnis:**
- [ ] ✅ Nur öffentliche Anlagen sichtbar
- [ ] ✅ Private Daten werden blockiert

---

## 🔧 API Tests

### 11. API-Endpoints testen

**GET /api/auth/user**

```bash
# Eingeloggt
curl -X GET https://YOUR_DOMAIN/api/auth/user \
  -H "Cookie: ..."
# Erwartung: { success: true, user: {...} }
```

- [ ] ✅ Gibt Mitglied-Daten zurück (nicht User-Daten)
- [ ] ✅ Gibt 401 wenn nicht authentifiziert

**POST /api/anlagen**

```bash
curl -X POST https://YOUR_DOMAIN/api/anlagen \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"mitglied_id": "...", "anlagenname": "Test", ...}'
# Erwartung: Anlage erstellt
```

- [ ] ✅ Erstellt Anlage für aktuelles Mitglied
- [ ] ✅ Gibt 403 wenn mitglied_id nicht übereinstimmt
- [ ] ✅ Erstellt automatisch anlagen_freigaben

**POST /api/upload-monatsdaten**

- [ ] ✅ Prüft Berechtigung via RLS (getAnlageById)
- [ ] ✅ Gibt 403 wenn keine Berechtigung
- [ ] ✅ Import funktioniert für eigene Anlage

**GET /api/csv-template?anlageId=...**

- [ ] ✅ Prüft Berechtigung via RLS (getAnlageById)
- [ ] ✅ Gibt 403 wenn keine Berechtigung
- [ ] ✅ Template wird korrekt generiert

---

## 🧹 Code Quality Checks

### 12. Code-Verifizierung

**Keine alten Auth-Importe mehr:**

```bash
grep -r "from.*\/auth'" app/ lib/
# Erwartung: Keine Treffer (außer Kommentare)
```

- [ ] ✅ Kein Import von `lib/auth` mehr

**Keine getCurrentUser() Aufrufe mehr:**

```bash
grep -r "getCurrentUser" app/ lib/
# Erwartung: Keine Treffer
```

- [ ] ✅ Keine getCurrentUser() Aufrufe mehr

**Alle Seiten nutzen getCurrentMitglied():**

```bash
grep -r "getCurrentMitglied" app/
# Erwartung: 15+ Dateien
```

- [ ] ✅ Mindestens 15 Seiten nutzen getCurrentMitglied()

**Korrekte Helper-Function Nutzung:**

- [ ] ✅ `getCurrentMitglied()` für Auth
- [ ] ✅ `getUserAnlagen()` für Anlagen-Liste
- [ ] ✅ `getAnlageById()` für RLS-basierte Berechtigungsprüfung
- [ ] ✅ `resolveAnlageId()` für Multi-Anlage Support

---

## 📊 Performance Tests

### 13. Performance-Checks

**Query Performance:**

```sql
-- Prüfe Index-Nutzung
EXPLAIN ANALYZE
SELECT * FROM anlagen WHERE mitglied_id = '...';

EXPLAIN ANALYZE
SELECT * FROM monatsdaten WHERE anlage_id = '...' ORDER BY jahr DESC, monat DESC;
```

- [ ] Queries nutzen Indizes
- [ ] Keine Sequential Scans auf großen Tabellen
- [ ] Response Time < 100ms

**Browser Console:**

- [ ] Keine übermäßigen Re-Renders
- [ ] Keine Memory Leaks
- [ ] Keine langsamen Queries (> 500ms)

---

## ✅ Finale Checkliste

### Alles bereit für Production?

- [ ] ✅ Alle SQL-Tests bestanden
- [ ] ✅ Alle UI-Tests bestanden
- [ ] ✅ Alle Security-Tests bestanden
- [ ] ✅ Alle API-Tests bestanden
- [ ] ✅ Code Quality Checks bestanden
- [ ] ✅ Performance akzeptabel
- [ ] ✅ Keine Console-Errors
- [ ] ✅ Dokumentation vollständig

---

## 🐛 Fehler-Log

Trage hier gefundene Fehler ein:

| # | Beschreibung | Severity | Status | Fix |
|---|--------------|----------|--------|-----|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

**Test-Datum:** ___________
**Getestet von:** ___________
**Status:** ⬜ BESTANDEN / ⬜ FEHLER GEFUNDEN
