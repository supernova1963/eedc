# Fresh Start Migrations

**Datum:** 2026-01-28
**Ziel:** Sauberer Neuaufbau der Datenbank mit Community-First Architektur

---

## ⚠️ WICHTIG: VOR DER MIGRATION

1. **Backup erstellen:**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test-Daten prüfen:**
   - Alle aktuellen Daten sind Test-Daten
   - Daten werden GELÖSCHT und neu angelegt

3. **Migrations-Reihenfolge einhalten:**
   - Skripte MÜSSEN in Reihenfolge ausgeführt werden (00 → 01 → 02 → ...)

---

## Migrations-Übersicht

| Datei | Beschreibung | Dauer | Risiko |
|-------|--------------|-------|--------|
| `00_drop_old_schema.sql` | Löscht alle alten Tabellen | 10s | 🟢 LOW |
| `01_core_schema.sql` | Erstellt neue Tabellen | 30s | 🟢 LOW |
| `02_helper_functions.sql` | Erstellt Helper Functions | 10s | 🟢 LOW |
| `03_rls_policies.sql` | Aktiviert RLS + Policies | 60s | 🟢 LOW |
| `04_community_functions.sql` | Security Definer Functions | 20s | 🟢 LOW |
| `05_seed_data.sql` | Komponenten-Typen, Test-Daten | 10s | 🟢 LOW |
| `verify.sql` | Verifiziert Migration | 5s | 🟢 LOW |

**Gesamt:** ~2-3 Minuten

---

## Ausführen der Migrations

### Option A: Manuell (empfohlen für erstes Mal)

```bash
# 1. Backup
pg_dump $DATABASE_URL > backup.sql

# 2. Supabase SQL Editor öffnen
# https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

# 3. Jedes Skript einzeln kopieren und ausführen
# - 00_drop_old_schema.sql
# - 01_core_schema.sql
# - ...

# 4. Verifizierung
# - verify.sql ausführen
```

### Option B: Via psql

```bash
# Setze DATABASE_URL
export DATABASE_URL="postgresql://..."

# Ausführen
cd migrations/FRESH-START
for file in *.sql; do
  echo "Executing $file..."
  psql $DATABASE_URL -f $file
  if [ $? -ne 0 ]; then
    echo "ERROR in $file - STOP"
    exit 1
  fi
done
```

### Option C: Supabase CLI (wenn eingerichtet)

```bash
supabase db push
```

---

## Nach der Migration

### 1. Test-User anlegen

Via Supabase Auth UI oder:
```sql
-- In Supabase SQL Editor
-- Wird automatisch auth.users Eintrag + mitglieder Eintrag erstellt
```

### 2. Test-Anlage anlegen

Via UI: `/anlage` → "Neue Anlage"

### 3. Smoke Tests

- [ ] Login funktioniert
- [ ] Dashboard zeigt leere Anlage
- [ ] Anlage erstellen funktioniert
- [ ] Monatsdaten erfassen funktioniert
- [ ] Community-Dashboard zeigt keine Anlagen (noch keine öffentlichen)

### 4. Öffentliche Test-Anlage

- Anlage erstellen
- In Anlage-Einstellungen: "Öffentlich" aktivieren
- Community-Dashboard sollte Anlage zeigen

---

## Rollback

Falls Migration fehlschlägt:

```bash
# Restore Backup
psql $DATABASE_URL < backup.sql
```

---

## Troubleshooting

### Fehler: "relation already exists"
- Lösung: `00_drop_old_schema.sql` erneut ausführen

### Fehler: "function does not exist"
- Lösung: Stelle sicher, dass `02_helper_functions.sql` VOR `03_rls_policies.sql` ausgeführt wurde

### Fehler: "permission denied"
- Lösung: Prüfe, dass DATABASE_URL Service Role Key verwendet (nicht ANON_KEY)

### RLS blockiert Queries
- Lösung: Prüfe, dass User `auth_user_id` in `mitglieder` Tabelle hat
- Debug: `SELECT * FROM mitglieder WHERE email = 'deine@email.com';`

---

## Support

Bei Problemen:
1. Prüfe `verify.sql` Output
2. Check Supabase Logs
3. Siehe [MASTER-REFACTORING-PLAN.md](../../MASTER-REFACTORING-PLAN.md) für Details

---

**Erstellt:** 2026-01-28
**Status:** 🟢 READY
