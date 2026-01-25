# 🧹 Demo-Anlage bereinigen

## Problem
Die alte Demo-Anlage (erstellt vor dem Community-Feature) wird möglicherweise neuen Benutzern angezeigt, weil:
- Sie keine gültige `mitglied_id` hat ODER
- Die `mitglied_id` auf einen nicht-existierenden Benutzer zeigt

## Lösung: Manuell in Supabase bereinigen

### Schritt 1: Demo-Anlagen identifizieren

1. **Öffne Supabase Dashboard**
2. **Gehe zu SQL Editor**
3. **Führe folgendes Query aus:**

```sql
-- Finde alle Anlagen ohne gültigen Owner
SELECT
  a.id,
  a.anlagenname,
  a.mitglied_id,
  a.erstellt_am,
  m.email as mitglied_email
FROM anlagen a
LEFT JOIN mitglieder m ON a.mitglied_id = m.id
WHERE a.mitglied_id IS NULL
   OR m.id IS NULL
ORDER BY a.erstellt_am;
```

**Erwartetes Ergebnis:**
- Eine Liste aller "verwaisten" Anlagen
- Diese sollten gelöscht werden

### Schritt 2: Zugehörige Daten löschen

**WICHTIG:** Führen Sie diese Schritte in der richtigen Reihenfolge aus!

```sql
-- 1. Monatsdaten löschen
DELETE FROM monatsdaten
WHERE anlage_id IN (
  SELECT a.id FROM anlagen a
  LEFT JOIN mitglieder m ON a.mitglied_id = m.id
  WHERE a.mitglied_id IS NULL OR m.id IS NULL
);

-- 2. Investitionen löschen
DELETE FROM investitionen
WHERE anlage_id IN (
  SELECT a.id FROM anlagen a
  LEFT JOIN mitglieder m ON a.mitglied_id = m.id
  WHERE a.mitglied_id IS NULL OR m.id IS NULL
);

-- 3. Freigaben löschen
DELETE FROM anlagen_freigaben
WHERE anlage_id IN (
  SELECT a.id FROM anlagen a
  LEFT JOIN mitglieder m ON a.mitglied_id = m.id
  WHERE a.mitglied_id IS NULL OR m.id IS NULL
);

-- 4. Anlagen löschen
DELETE FROM anlagen
WHERE id IN (
  SELECT a.id FROM anlagen a
  LEFT JOIN mitglieder m ON a.mitglied_id = m.id
  WHERE a.mitglied_id IS NULL OR m.id IS NULL
);
```

### Schritt 3: Verifizieren

```sql
-- Sollte 0 zurückgeben
SELECT COUNT(*) as anzahl_verwaiste_anlagen
FROM anlagen a
LEFT JOIN mitglieder m ON a.mitglied_id = m.id
WHERE a.mitglied_id IS NULL OR m.id IS NULL;
```

## Alternative: Demo-Anlage einem User zuordnen

Falls Sie die Demo-Anlage behalten möchten:

```sql
-- 1. Finde die ID eines echten Users
SELECT id, email, vorname, nachname
FROM mitglieder
WHERE aktiv = true
ORDER BY erstellt_am
LIMIT 1;

-- 2. Aktualisiere die Demo-Anlage
UPDATE anlagen
SET mitglied_id = '<USER_ID_HIER_EINFÜGEN>'
WHERE mitglied_id IS NULL
   OR mitglied_id NOT IN (SELECT id FROM mitglieder);
```

## Nach der Bereinigung

**Browser neu laden:**
- Alle eingeloggten User sollten jetzt nur noch ihre eigenen Anlagen sehen
- Neue User sehen den "Empty State"

**Falls immer noch Probleme:**
1. Browser-Cache leeren (Ctrl+Shift+R)
2. Aus- und wieder einloggen
3. Debug-Seite aufrufen: http://localhost:3000/debug
