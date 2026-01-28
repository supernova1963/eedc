-- ============================================
-- MIGRATION 06: Test Users for RLS Testing (SIMPLE)
-- ============================================
-- Datum: 2026-01-28
-- Beschreibung: Erstellt zusätzliche Test-Mitglieder und Anlagen
--               OHNE Auth-User (die müssen manuell über Supabase Auth UI erstellt werden)
-- ============================================

DO $$
DECLARE
  -- User 2: Anna Schmidt
  user2_mitglied_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  user2_anlage1_id uuid := 'bbbb0001-0001-0001-0001-000000000001';
  user2_anlage2_id uuid := 'bbbb0002-0002-0002-0002-000000000002';

  -- User 3: Peter Müller
  user3_mitglied_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  user3_anlage1_id uuid := 'cccc0001-0001-0001-0001-000000000001';

BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Creating Test Data (Mitglieder + Anlagen)';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'WICHTIG: Auth-User müssen MANUELL über Supabase Auth UI erstellt werden!';
  RAISE NOTICE '';

  -- ============================================
  -- USER 2: Anna Schmidt
  -- ============================================
  RAISE NOTICE 'Creating User 2: Anna Schmidt (Mitglied + Anlagen)...';

  -- Mitglied (OHNE auth_user_id - das wird später manuell verknüpft)
  INSERT INTO mitglieder (
    id,
    auth_user_id,  -- NULL für jetzt
    email,
    vorname,
    nachname,
    display_name,
    ort,
    profil_oeffentlich,
    bio,
    aktiv
  )
  VALUES (
    user2_mitglied_id,
    NULL,  -- Wird später verknüpft!
    'anna.schmidt@example.com',
    'Anna',
    'Schmidt',
    'SolarAnna',
    'Berlin',
    true,
    'Solar-Enthusiastin aus Berlin. Betreibe zwei Anlagen!',
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Anlage 1 (ÖFFENTLICH)
  INSERT INTO anlagen (
    id, mitglied_id, anlagenname, beschreibung,
    leistung_kwp, installationsdatum,
    standort_plz, standort_ort, ausrichtung, neigungswinkel_grad,
    anschaffungskosten_euro, einspeiseverguetung_cent_kwh,
    oeffentlich, standort_genau_anzeigen,
    kennzahlen_oeffentlich, monatsdaten_oeffentlich, komponenten_oeffentlich, aktiv
  ) VALUES (
    user2_anlage1_id,
    user2_mitglied_id,
    'Berlin Hauptanlage',
    '8 kWp Ost-West Anlage mit Speicher',
    8.0,
    '2022-05-10',
    '10115',
    'Berlin',
    'Ost-West',
    25,
    15000,
    7.8,
    true,  -- ÖFFENTLICH
    false,
    true,
    true,
    true,
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Anlage 2 (PRIVAT!)
  INSERT INTO anlagen (
    id, mitglied_id, anlagenname, beschreibung,
    leistung_kwp, installationsdatum,
    standort_plz, standort_ort, ausrichtung, neigungswinkel_grad,
    anschaffungskosten_euro, einspeiseverguetung_cent_kwh,
    oeffentlich, standort_genau_anzeigen,
    kennzahlen_oeffentlich, monatsdaten_oeffentlich, komponenten_oeffentlich, aktiv
  ) VALUES (
    user2_anlage2_id,
    user2_mitglied_id,
    'Berlin Gartenhaus',
    '3 kWp Mini-Anlage am Gartenhaus (privat)',
    3.0,
    '2023-08-15',
    '10115',
    'Berlin',
    'Süd',
    35,
    5000,
    7.8,
    false, -- PRIVAT!
    false,
    false,
    false,
    false,
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Komponenten für Anlage 1
  INSERT INTO anlagen_komponenten (anlage_id, typ, bezeichnung, beschreibung, technische_daten, anschaffungsdatum, anschaffungskosten_euro, hersteller, modell, aktiv)
  VALUES
    (user2_anlage1_id, 'speicher', 'Senec Home V3 Hybrid', '7,5 kWh Speicher', '{"kapazitaet_kwh": 7.5}'::jsonb, '2022-05-10', 7200, 'Senec', 'Home V3 Hybrid', true),
    (user2_anlage1_id, 'wechselrichter', 'SMA Sunny Tripower 8.0', '8 kW Wechselrichter', '{"nennleistung_kw": 8}'::jsonb, '2022-05-10', 1800, 'SMA', 'Sunny Tripower 8.0', true)
  ON CONFLICT DO NOTHING;

  -- Monatsdaten für Anlage 1 (letzten 3 Monate)
  INSERT INTO monatsdaten (anlage_id, jahr, monat, pv_erzeugung_kwh, direktverbrauch_kwh, batterieladung_kwh, batterieentladung_kwh, einspeisung_kwh, netzbezug_kwh, gesamtverbrauch_kwh, einspeisung_ertrag_euro, netzbezug_kosten_euro, betriebsausgaben_monat_euro, netzbezug_preis_cent_kwh, einspeisung_preis_cent_kwh)
  VALUES
    (user2_anlage1_id, 2024, 1, 380, 230, 100, 95, 150, 140, 365, 11.70, 49.00, 4.00, 35.0, 7.8),
    (user2_anlage1_id, 2024, 2, 520, 320, 150, 145, 200, 110, 465, 15.60, 38.50, 4.00, 35.0, 7.8),
    (user2_anlage1_id, 2024, 3, 720, 440, 200, 195, 280, 85, 635, 21.84, 29.75, 4.00, 35.0, 7.8)
  ON CONFLICT (anlage_id, jahr, monat) DO NOTHING;

  RAISE NOTICE '✓ User 2 created: anna.schmidt@example.com (2 Anlagen: 1 öffentlich, 1 privat)';
  RAISE NOTICE '';

  -- ============================================
  -- USER 3: Peter Müller
  -- ============================================
  RAISE NOTICE 'Creating User 3: Peter Müller (Mitglied + Anlage)...';

  -- Mitglied (PRIVATES Profil!)
  INSERT INTO mitglieder (
    id,
    auth_user_id,
    email,
    vorname,
    nachname,
    display_name,
    ort,
    profil_oeffentlich,
    bio,
    aktiv
  )
  VALUES (
    user3_mitglied_id,
    NULL,  -- Wird später verknüpft!
    'peter.mueller@example.com',
    'Peter',
    'Müller',
    'PM-Solar',
    'Hamburg',
    false, -- PRIVATES PROFIL!
    'Privater Nutzer',
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Anlage 1 (PRIVAT)
  INSERT INTO anlagen (
    id, mitglied_id, anlagenname, beschreibung,
    leistung_kwp, installationsdatum,
    standort_plz, standort_ort, ausrichtung, neigungswinkel_grad,
    anschaffungskosten_euro, einspeiseverguetung_cent_kwh,
    oeffentlich, standort_genau_anzeigen,
    kennzahlen_oeffentlich, monatsdaten_oeffentlich, komponenten_oeffentlich, aktiv
  ) VALUES (
    user3_anlage1_id,
    user3_mitglied_id,
    'Hamburg Privat',
    '6,5 kWp Private Anlage (nicht öffentlich)',
    6.5,
    '2023-03-20',
    '20095',
    'Hamburg',
    'Süd-West',
    30,
    12000,
    8.0,
    false, -- PRIVAT!
    false,
    false,
    false,
    false,
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Komponenten für Anlage 1
  INSERT INTO anlagen_komponenten (anlage_id, typ, bezeichnung, beschreibung, technische_daten, anschaffungsdatum, anschaffungskosten_euro, hersteller, modell, aktiv)
  VALUES
    (user3_anlage1_id, 'wechselrichter', 'Kostal Plenticore Plus 7.0', '7 kW Hybrid', '{"nennleistung_kw": 7}'::jsonb, '2023-03-20', 1900, 'Kostal', 'Plenticore Plus 7.0', true)
  ON CONFLICT DO NOTHING;

  -- Monatsdaten für Anlage 1 (letzten 2 Monate)
  INSERT INTO monatsdaten (anlage_id, jahr, monat, pv_erzeugung_kwh, direktverbrauch_kwh, batterieladung_kwh, batterieentladung_kwh, einspeisung_kwh, netzbezug_kwh, gesamtverbrauch_kwh, einspeisung_ertrag_euro, netzbezug_kosten_euro, betriebsausgaben_monat_euro, netzbezug_preis_cent_kwh, einspeisung_preis_cent_kwh)
  VALUES
    (user3_anlage1_id, 2024, 1, 320, 200, 0, 0, 120, 180, 380, 9.60, 63.00, 3.50, 35.0, 8.0),
    (user3_anlage1_id, 2024, 2, 450, 280, 0, 0, 170, 140, 420, 13.60, 49.00, 3.50, 35.0, 8.0)
  ON CONFLICT (anlage_id, jahr, monat) DO NOTHING;

  RAISE NOTICE '✓ User 3 created: peter.mueller@example.com (1 private Anlage)';
  RAISE NOTICE '';

  -- ============================================
  -- SUMMARY
  -- ============================================
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'TEST DATA SUMMARY';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Mitglieder erstellt: 2 (Anna Schmidt, Peter Müller)';
  RAISE NOTICE 'Anlagen erstellt: 3 (Anna: 2, Peter: 1)';
  RAISE NOTICE '';
  RAISE NOTICE 'Anna Schmidt:';
  RAISE NOTICE '  - Mitglied ID: %', user2_mitglied_id;
  RAISE NOTICE '  - Email: anna.schmidt@example.com';
  RAISE NOTICE '  - Anlagen: 2 (1 ÖFFENTLICH, 1 PRIVAT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Peter Müller:';
  RAISE NOTICE '  - Mitglied ID: %', user3_mitglied_id;
  RAISE NOTICE '  - Email: peter.mueller@example.com';
  RAISE NOTICE '  - Anlagen: 1 (PRIVAT)';
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'NEXT STEPS';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. Prüfe mit: SELECT COUNT(*) FROM anlagen;';
  RAISE NOTICE '   Expected: 4 (Max: 1, Anna: 2, Peter: 1)';
  RAISE NOTICE '';
  RAISE NOTICE '2. Prüfe mit: SELECT COUNT(*) FROM mitglieder;';
  RAISE NOTICE '   Expected: 3 (Max, Anna, Peter)';
  RAISE NOTICE '';
  RAISE NOTICE '3. Optional: Verknüpfe auth_user_id später wenn du Auth-User erstellst';
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create test data: %', SQLERRM;
END $$;
