# Datenbank-Migrationen

Ergänzungen zum bestehenden Schema für vollständige Auswertungen der EEDC-WebApp.

## Übersicht

Diese Migrationen fügen folgende Funktionalitäten hinzu:

1. **Anlagen-Investitionen-Verknüpfung** - Zuordnung von Investitionen zu Anlagen
2. **Strompreis-Stammdaten** - Historische Strompreise mit Gültigkeitszeiträumen
3. **Investitionstyp-Konfiguration** - Zentrale Berechnungsparameter
4. **Kennzahlen-Cache** - Vorberechnete Wirtschaftlichkeitskennzahlen
5. **Constraints & Indizes** - Datenintegrität und Performance
6. **Views** - Vereinfachte Abfragen
7. **Functions** - Wiederverwendbare Berechnungslogik

## Ausführungsreihenfolge

Die Migrationen müssen in folgender Reihenfolge ausgeführt werden:

```bash
# Wichtig: In Supabase SQL Editor ausführen!

1. 01_add_anlage_id.sql
2. 02_strompreise.sql
3. 03_investitionstyp_config.sql
4. 04_kennzahlen_tables.sql
5. 05_constraints_and_indexes.sql
6. 06_views.sql
7. 07_functions.sql
```

## Anleitung zur Ausführung

### In Supabase Dashboard:

1. Öffne [Supabase Dashboard](https://app.supabase.com)
2. Wähle dein Projekt: `vwrvnkcmaifjvffqhfeg`
3. Gehe zu **SQL Editor** im Menü
4. Erstelle eine neue Query
5. Kopiere den Inhalt von `01_add_anlage_id.sql`
6. Klicke auf **Run**
7. Wiederhole für alle weiteren Migrations-Dateien in der richtigen Reihenfolge

### Oder: Alle auf einmal ausführen

Kopiere den Inhalt von `_all_migrations.sql` (wird gleich erstellt) und führe ihn in einem Durchgang aus.

## Was wird erstellt?

### Neue Tabellen:
- `strompreise` - Strompreis-Stammdaten
- `investitionstyp_config` - Konfiguration pro Investitionstyp
- `investition_kennzahlen` - Cache für Wirtschaftlichkeits-KPIs
- `anlagen_kennzahlen` - Cache für Anlagen-KPIs

### Neue Spalten:
- `alternative_investitionen.anlage_id` - Verknüpfung zu Anlagen

### Neue Views:
- `strompreise_aktuell` - Aktuell gültige Strompreise
- `anlagen_komplett` - Anlagen mit Investitionen
- `investitionen_uebersicht` - Komplette Investitionsübersicht
- `monatsdaten_erweitert` - Monatsdaten mit Kennzahlen

### Neue Functions:
- `get_strompreis()` - Strompreis für ein Datum ermitteln
- `berechne_monatliche_einsparung()` - Detaillierte Einsparungsberechnung
- `co2_zu_baeume()` - CO2 in Bäume-Äquivalent umrechnen
- `aktualisiere_investition_kennzahlen()` - Kennzahlen-Cache aktualisieren

## Rollback

Falls du die Änderungen rückgängig machen möchtest:

```sql
-- ACHTUNG: Löscht Daten!
DROP VIEW IF EXISTS monatsdaten_erweitert CASCADE;
DROP VIEW IF EXISTS investitionen_uebersicht CASCADE;
DROP VIEW IF EXISTS anlagen_komplett CASCADE;
DROP VIEW IF EXISTS strompreise_aktuell CASCADE;

DROP FUNCTION IF EXISTS aktualisiere_investition_kennzahlen(uuid);
DROP FUNCTION IF EXISTS co2_zu_baeume(numeric);
DROP FUNCTION IF EXISTS berechne_monatliche_einsparung(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_strompreis(uuid, uuid, date, text);

DROP TABLE IF EXISTS anlagen_kennzahlen CASCADE;
DROP TABLE IF EXISTS investition_kennzahlen CASCADE;
DROP TABLE IF EXISTS investitionstyp_config CASCADE;
DROP TABLE IF EXISTS strompreise CASCADE;

ALTER TABLE alternative_investitionen DROP COLUMN IF EXISTS anlage_id;
```

## Nach der Migration

1. Überprüfe, ob alle Tabellen erstellt wurden:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('strompreise', 'investitionstyp_config', 'investition_kennzahlen', 'anlagen_kennzahlen');
```

2. Überprüfe die Views:
```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public';
```

3. Teste eine Function:
```sql
SELECT co2_zu_baeume(1000);  -- Sollte 100 zurückgeben
```

## Nächste Schritte

Nach erfolgreicher Migration:

1. ✅ Formulare für Strompreis-Erfassung erstellen
2. ✅ Anlage-Investition-Zuordnung in UI implementieren
3. ✅ Kennzahlen-Berechnung triggern
4. ✅ Dashboard mit neuen Kennzahlen erstellen
