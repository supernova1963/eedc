# Migrations Status

**Datum:** 2026-01-28
**Stand:** DB-Migration KOMPLETT ✅ | Code-Anpassung TEILWEISE ⚠️

---

## ✅ Fertige Skripte

| # | Datei | Status | Beschreibung |
|---|-------|--------|--------------|
| 00 | `00_drop_old_schema.sql` | ✅ AUSGEFÜHRT | Löscht alte Tabellen |
| 01 | `01_core_schema.sql` | ✅ AUSGEFÜHRT | Erstellt 9 neue Tabellen |
| 02 | `02_helper_functions.sql` | ✅ AUSGEFÜHRT | 4 Helper Functions |
| 03 | `03_rls_policies.sql` | ✅ AUSGEFÜHRT | RLS Policies (alle Tests PASSED) |
| 04 | `04_community_functions.sql` | ✅ AUSGEFÜHRT | Community Functions |
| 05 | `05_seed_data.sql` | ✅ AUSGEFÜHRT | Komponenten-Typen + Strompreise |
| 06 | `06_test_users_simple.sql` | ✅ AUSGEFÜHRT | 2 Test-User + 3 Anlagen |
| - | `verify.sql` | ✅ PASSED | Alle Verifizierungen erfolgreich |

---

## 📝 TODO: Skripte 03 & 04 erstellen

### 03_rls_policies.sql

Dieses Skript enthält ALLE RLS Policies. Kopieren Sie den Code aus:

**[MASTER-REFACTORING-PLAN.md](../../MASTER-REFACTORING-PLAN.md)**
- Abschnitt 2.2: "Helper Functions" (optional, bereits in 02 enthalten)
- Abschnitt 2.3: "RLS Policies" - **HAUPTTEIL**

Das Skript sollte enthalten:
```sql
-- ============================================
-- MIGRATION 03: RLS Policies
-- ============================================

-- RLS Activation
ALTER TABLE mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE anlagen ENABLE ROW LEVEL SECURITY;
-- ... (alle Tabellen)

-- Policies für mitglieder
CREATE POLICY "mitglieder_select_own" ON mitglieder ...
CREATE POLICY "mitglieder_select_public" ON mitglieder ...
-- ...

-- Policies für anlagen
CREATE POLICY "anlagen_select_own" ON anlagen ...
-- ...

-- (etc. für alle Tabellen)
```

**Geschätzte Länge:** ~500 Zeilen

### 04_community_functions.sql

Dieses Skript enthält die Security Definer Functions für Community-Features.

**[MASTER-REFACTORING-PLAN.md](../../MASTER-REFACTORING-PLAN.md)**
- Abschnitt 2.4: "Security Definer Functions für Community"

Das Skript sollte enthalten:
```sql
-- ============================================
-- MIGRATION 04: Community Functions
-- ============================================

-- 1. get_public_anlagen()
CREATE OR REPLACE FUNCTION get_public_anlagen() ...

-- 2. get_community_stats()
CREATE OR REPLACE FUNCTION get_community_stats() ...

-- 3. get_public_anlage_details(uuid)
CREATE OR REPLACE FUNCTION get_public_anlage_details(p_anlage_id uuid) ...

-- Grant Permissions
GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;
```

**Geschätzte Länge:** ~300 Zeilen

---

## 🚀 Ausführen der Migrations

### Option A: Manuell via Supabase SQL Editor (EMPFOHLEN für erstes Mal)

1. Öffne https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. **WICHTIG:** Backup erstellen!
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```
3. Kopiere und führe aus (in Reihenfolge):
   - ✅ `00_drop_old_schema.sql`
   - ✅ `01_core_schema.sql`
   - ✅ `02_helper_functions.sql`
   - ⚠️ `03_rls_policies.sql` (aus Master-Plan kopieren)
   - ⚠️ `04_community_functions.sql` (aus Master-Plan kopieren)
   - ✅ `05_seed_data.sql`
4. Verifizierung:
   - ✅ `verify.sql`

### Option B: Via psql (wenn alle Skripte fertig)

```bash
cd migrations/FRESH-START

# Backup
pg_dump $DATABASE_URL > ../../backup.sql

# Migrations
psql $DATABASE_URL -f 00_drop_old_schema.sql
psql $DATABASE_URL -f 01_core_schema.sql
psql $DATABASE_URL -f 02_helper_functions.sql
psql $DATABASE_URL -f 03_rls_policies.sql
psql $DATABASE_URL -f 04_community_functions.sql
psql $DATABASE_URL -f 05_seed_data.sql

# Verify
psql $DATABASE_URL -f verify.sql
```

---

## 📋 Nach der Migration

### 1. Verifizierung
- [ ] `verify.sql` erfolgreich ausgeführt
- [ ] Alle Checks PASSED
- [ ] Keine Errors in Supabase Logs

### 2. Test-User erstellen
- [ ] Via Supabase Auth UI registrieren
- [ ] Mitglied-Eintrag manuell erstellen (bis Code angepasst ist)
- [ ] Login funktioniert

### 3. Test-Anlage erstellen
- [ ] Via UI: `/anlage` → "Neue Anlage"
- [ ] Anlage erscheint in Dropdown (wenn Code angepasst)

### 4. Code-Anpassungen (siehe MASTER-REFACTORING-PLAN.md Abschnitt 4)
- [ ] Types generieren
- [ ] Helper Functions anpassen
- [ ] AnlagenSelector Component
- [ ] Seiten anpassen

---

## 🆘 Troubleshooting

### Problem: Skript 03/04 fehlt
**Lösung:** Kopieren Sie Code aus MASTER-REFACTORING-PLAN.md

### Problem: "relation already exists"
**Lösung:** `00_drop_old_schema.sql` erneut ausführen

### Problem: "function does not exist"
**Lösung:** Sicherstellen dass Skripte in Reihenfolge ausgeführt wurden

### Problem: RLS blockiert Queries
**Lösung:**
1. Prüfe: `SELECT * FROM mitglieder WHERE email = 'deine@email.com';`
2. Prüfe: `auth_user_id` ist gesetzt
3. Debug mit `SET ROLE authenticated; SET request.jwt.claims = ...`

---

## 📚 Weitere Dokumentation

- **Vollständiger Plan:** [MASTER-REFACTORING-PLAN.md](../../MASTER-REFACTORING-PLAN.md)
- **Testing:** [TESTING-CHECKLIST.md](../../TESTING-CHECKLIST.md)
- **Architektur-Analyse:** [STRUKTUR-ANALYSE-SINGLE-VS-MULTI-USER.md](../../STRUKTUR-ANALYSE-SINGLE-VS-MULTI-USER.md)

---

## 📊 Code-Anpassungen Status

| Komponente | Status | Beschreibung |
|------------|--------|--------------|
| `lib/anlagen-helpers.ts` | ✅ NEU | Multi-Anlage Helper Functions |
| `components/AnlagenSelector.tsx` | ✅ NEU | Dropdown für Anlagenwechsel |
| `app/meine-anlage/page.tsx` | ✅ ANGEPASST | Dashboard mit Multi-Anlage Support |
| `app/eingabe/page.tsx` | ⚠️ TODO | Nutzt noch alte Tabellen |
| Weitere Seiten | ⚠️ TODO | Siehe SESSION-SUMMARY.md |

---

**Status:** 🟢 DB KOMPLETT | 🟡 CODE 60% FERTIG
**Nächster Schritt:** Eingabe-Seite umbauen + weitere Code-Anpassungen
**Siehe:** [SESSION-SUMMARY.md](SESSION-SUMMARY.md) für Details
