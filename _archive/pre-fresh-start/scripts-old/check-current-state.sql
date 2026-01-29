-- Aktuellen Zustand prüfen
-- Führen Sie dieses Script in Supabase SQL Editor aus

-- 1. Alle Mitglieder anzeigen
SELECT
  id,
  email,
  vorname,
  nachname,
  erstellt_am
FROM mitglieder
WHERE aktiv = true
ORDER BY erstellt_am;

-- 2. Alle Anlagen mit Owner anzeigen
SELECT
  a.id as anlage_id,
  a.anlagenname,
  a.mitglied_id,
  m.email as owner_email,
  m.vorname,
  m.nachname,
  a.erstellt_am
FROM anlagen a
LEFT JOIN mitglieder m ON a.mitglied_id = m.id
WHERE a.aktiv = true
ORDER BY a.erstellt_am;

-- 3. Anlagen pro Mitglied zählen
SELECT
  m.email,
  m.vorname,
  m.nachname,
  COUNT(a.id) as anzahl_anlagen
FROM mitglieder m
LEFT JOIN anlagen a ON m.id = a.mitglied_id AND a.aktiv = true
WHERE m.aktiv = true
GROUP BY m.id, m.email, m.vorname, m.nachname
ORDER BY m.erstellt_am;
