-- ============================================
-- MIGRATION 06: Test Users for RLS Testing
-- ============================================
-- Datum: 2026-01-28
-- Beschreibung: Erstellt mehrere Test-User mit verschiedenen Anlagen
--               zum Testen von RLS und Multi-User Szenarien
-- ============================================

DO $$
DECLARE
  -- User 1: Max Mustermann (bereits existiert aus 05_seed_data.sql)
  user1_auth_id uuid := '11111111-1111-1111-1111-111111111111';
  user1_mitglied_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  user1_anlage1_id uuid := 'aaaa0001-0001-0001-0001-000000000001';

  -- User 2: Anna Schmidt (Neue Test-Userin)
  user2_auth_id uuid := '22222222-2222-2222-2222-222222222222';
  user2_mitglied_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  user2_anlage1_id uuid := 'bbbb0001-0001-0001-0001-000000000001';
  user2_anlage2_id uuid := 'bbbb0002-0002-0002-0002-000000000002';

  -- User 3: Peter Müller (Neuer Test-User)
  user3_auth_id uuid := '33333333-3333-3333-3333-333333333333';
  user3_mitglied_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  user3_anlage1_id uuid := 'cccc0001-0001-0001-0001-000000000001';

BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Creating Test Users for RLS Testing';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';

  -- ============================================
  -- USER 2: Anna Schmidt
  -- ============================================
  RAISE NOTICE 'Creating User 2: Anna Schmidt...';

  -- Auth User
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  VALUES (
    user2_auth_id,
    '00000000-0000-0000-0000-000000000000',
    'anna.schmidt@example.com',
    '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
    now(), now(), now(), 'authenticated', 'authenticated'
  ) ON CONFLICT (id) DO NOTHING;

  -- Mitglied
  INSERT INTO mitglieder (id, auth_user_id, email, vorname, nachname, display_name, ort, profil_oeffentlich, bio, aktiv)
  VALUES (
    user2_mitglied_id,
    user2_auth_id,
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
  RAISE NOTICE 'Creating User 3: Peter Müller...';

  -- Auth User
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  VALUES (
    user3_auth_id,
    '00000000-0000-0000-0000-000000000000',
    'peter.mueller@example.com',
    '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash',
    now(), now(), now(), 'authenticated', 'authenticated'
  ) ON CONFLICT (id) DO NOTHING;

  -- Mitglied (PRIVATES Profil!)
  INSERT INTO mitglieder (id, auth_user_id, email, vorname, nachname, display_name, ort, profil_oeffentlich, bio, aktiv)
  VALUES (
    user3_mitglied_id,
    user3_auth_id,
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
  RAISE NOTICE 'TEST USERS SUMMARY';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'User 1: max.mustermann@example.com';
  RAISE NOTICE '  - Auth ID: %', user1_auth_id;
  RAISE NOTICE '  - Mitglied ID: %', user1_mitglied_id;
  RAISE NOTICE '  - Profil: ÖFFENTLICH';
  RAISE NOTICE '  - Anlagen: 1 (ÖFFENTLICH)';
  RAISE NOTICE '';
  RAISE NOTICE 'User 2: anna.schmidt@example.com';
  RAISE NOTICE '  - Auth ID: %', user2_auth_id;
  RAISE NOTICE '  - Mitglied ID: %', user2_mitglied_id;
  RAISE NOTICE '  - Profil: ÖFFENTLICH';
  RAISE NOTICE '  - Anlagen: 2 (1 ÖFFENTLICH, 1 PRIVAT)';
  RAISE NOTICE '';
  RAISE NOTICE 'User 3: peter.mueller@example.com';
  RAISE NOTICE '  - Auth ID: %', user3_auth_id;
  RAISE NOTICE '  - Mitglied ID: %', user3_mitglied_id;
  RAISE NOTICE '  - Profil: PRIVAT';
  RAISE NOTICE '  - Anlagen: 1 (PRIVAT)';
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'RLS TEST SCENARIOS';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. Anonymous User sollte sehen:';
  RAISE NOTICE '   - 2 öffentliche Anlagen (Max + Anna Hauptanlage)';
  RAISE NOTICE '   - 0 private Anlagen';
  RAISE NOTICE '';
  RAISE NOTICE '2. Max (User 1) sollte sehen:';
  RAISE NOTICE '   - Seine eigene Anlage (privat für ihn)';
  RAISE NOTICE '   - Annas öffentliche Hauptanlage';
  RAISE NOTICE '   - NICHT: Annas private Gartenhaus-Anlage';
  RAISE NOTICE '   - NICHT: Peters private Anlage';
  RAISE NOTICE '';
  RAISE NOTICE '3. Anna (User 2) sollte sehen:';
  RAISE NOTICE '   - Ihre beiden Anlagen (öffentlich + privat)';
  RAISE NOTICE '   - Max öffentliche Anlage';
  RAISE NOTICE '   - NICHT: Peters private Anlage';
  RAISE NOTICE '';
  RAISE NOTICE '4. Peter (User 3) sollte sehen:';
  RAISE NOTICE '   - Seine private Anlage';
  RAISE NOTICE '   - Max + Annas öffentliche Anlagen';
  RAISE NOTICE '   - NICHT: Annas private Gartenhaus-Anlage';
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create test users: %', SQLERRM;
END $$;
