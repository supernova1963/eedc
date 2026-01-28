# Quick Start: Fresh Database Setup

**WICHTIG:** Die vollständigen SQL-Skripte für Schritte 03-06 finden Sie im **[MASTER-REFACTORING-PLAN.md](../../MASTER-REFACTORING-PLAN.md)** (Abschnitt 2.3 & 2.4).

## Status

✅ Fertig:
- `00_drop_old_schema.sql` - Drop alte Tabellen
- `01_core_schema.sql` - Neue Tabellen
- `02_helper_functions.sql` - Helper Functions

📝 Zu erstellen (aus Master-Plan kopieren):
- `03_rls_policies.sql` - Alle RLS Policies (siehe MASTER-REFACTORING-PLAN.md Abschnitt 2.3)
- `04_community_functions.sql` - Security Definer Functions (siehe Abschnitt 2.4)
- `05_seed_data.sql` - Komponenten-Typen Seed Data
- `verify.sql` - Verifizierungs-Queries

## Schnellstart (wenn alle Skripte fertig)

```bash
# 1. Backup
pg_dump $DATABASE_URL > backup.sql

# 2. Alle Migrations ausführen
cd migrations/FRESH-START
for file in 0*.sql; do
  echo "Executing $file..."
  psql $DATABASE_URL -f $file
done

# 3. Seed Data
psql $DATABASE_URL -f 05_seed_data.sql

# 4. Verify
psql $DATABASE_URL -f verify.sql
```

## Nächste Schritte nach DB-Migration

1. **Code Anpassungen:**
   - Types generieren: `npx supabase gen types typescript > types/database.ts`
   - Helper Functions aus MASTER-REFACTORING-PLAN.md Abschnitt 4.2 übernehmen
   - AnlagenSelector Component aus Abschnitt 4.3 erstellen

2. **Testing:**
   - Siehe [TESTING-CHECKLIST.md](../../TESTING-CHECKLIST.md)
   - RLS Tests durchführen
   - UI Tests manuell

3. **Dokumentation:**
   - Alle Details in [MASTER-REFACTORING-PLAN.md](../../MASTER-REFACTORING-PLAN.md)

## Support

Bei Fragen oder Problemen:
- Siehe MASTER-REFACTORING-PLAN.md Abschnitt 6 (Troubleshooting)
- Prüfe Supabase Logs
- Check verify.sql Output
