-- ============================================
-- MIGRATION 05a: Max Mustermann (SIMPLE)
-- ============================================
-- Datum: 2026-01-28
-- Beschreibung: Erstellt Max Mustermann als ersten Test-User
--               OHNE Auth-User (nur Mitglied + Anlage)
-- ============================================

DO $$
DECLARE
  user1_mitglied_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  user1_anlage1_id uuid := 'aaaa0001-0001-0001-0001-000000000001';

BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Creating Max Mustermann Test User';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';

  -- Mitglied
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
    user1_mitglied_id,
    NULL,
    'max.mustermann@example.com',
    'Max',
    'Mustermann',
    'SolarMax',
    'München',
    true,
    'Hobbybastler mit Leidenschaft für erneuerbare Energien. Teile gerne meine Erfahrungen!',
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Anlage (ÖFFENTLICH)
  INSERT INTO anlagen (
    id,
    mitglied_id,
    anlagenname,
    beschreibung,
    leistung_kwp,
    installationsdatum,
    standort_plz,
    standort_ort,
    ausrichtung,
    neigungswinkel_grad,
    anschaffungskosten_euro,
    einspeiseverguetung_cent_kwh,
    oeffentlich,
    standort_genau_anzeigen,
    kennzahlen_oeffentlich,
    monatsdaten_oeffentlich,
    komponenten_oeffentlich,
    aktiv
  ) VALUES (
    user1_anlage1_id,
    user1_mitglied_id,
    'Dach-PV Einfamilienhaus',
    '10,5 kWp Süd-Ausrichtung mit Speicher',
    10.5,
    '2023-06-15',
    '80331',
    'München',
    'Süd',
    30,
    18500,
    8.2,
    true,
    false,
    true,
    true,
    true,
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- Komponenten
  INSERT INTO anlagen_komponenten (anlage_id, typ, bezeichnung, beschreibung, technische_daten, anschaffungsdatum, anschaffungskosten_euro, hersteller, modell, aktiv)
  VALUES
    (user1_anlage1_id, 'speicher', 'BYD Battery-Box Premium HVS 10.2', 'Hochvolt-Speicher 10,2 kWh', '{"kapazitaet_kwh": 10.2, "max_ladeleistung_kw": 5, "max_entladeleistung_kw": 5}'::jsonb, '2023-06-15', 8500, 'BYD', 'Battery-Box Premium HVS 10.2', true),
    (user1_anlage1_id, 'wechselrichter', 'Fronius Symo 10.0-3-M', 'Dreiphasiger Wechselrichter 10 kW', '{"nennleistung_kw": 10, "wirkungsgrad": 0.98, "phasen": 3}'::jsonb, '2023-06-15', 2100, 'Fronius', 'Symo 10.0-3-M', true),
    (user1_anlage1_id, 'wallbox', 'Wallbox Pulsar Plus', '11 kW Ladestation', '{"ladeleistung_kw": 11, "phasen": 3, "stecker": "Typ 2"}'::jsonb, '2023-07-01', 850, 'Wallbox', 'Pulsar Plus', true)
  ON CONFLICT DO NOTHING;

  -- Monatsdaten (letzten 6 Monate)
  INSERT INTO monatsdaten (anlage_id, jahr, monat, pv_erzeugung_kwh, direktverbrauch_kwh, batterieladung_kwh, batterieentladung_kwh, einspeisung_kwh, netzbezug_kwh, gesamtverbrauch_kwh, einspeisung_ertrag_euro, netzbezug_kosten_euro, betriebsausgaben_monat_euro, netzbezug_preis_cent_kwh, einspeisung_preis_cent_kwh)
  VALUES
    (user1_anlage1_id, 2024, 1, 450, 280, 120, 110, 170, 130, 400, 13.94, 45.50, 5.00, 35.0, 8.2),
    (user1_anlage1_id, 2024, 2, 620, 380, 180, 170, 240, 95, 470, 19.68, 33.25, 5.00, 35.0, 8.2),
    (user1_anlage1_id, 2024, 3, 850, 520, 250, 240, 330, 75, 595, 27.06, 26.25, 5.00, 35.0, 8.2),
    (user1_anlage1_id, 2024, 4, 1100, 680, 320, 310, 420, 50, 730, 34.44, 17.50, 5.00, 35.0, 8.2),
    (user1_anlage1_id, 2024, 5, 1250, 770, 360, 350, 480, 35, 820, 39.36, 12.25, 5.00, 35.0, 8.2),
    (user1_anlage1_id, 2024, 6, 1180, 730, 340, 330, 450, 42, 772, 36.90, 14.70, 5.00, 35.0, 8.2)
  ON CONFLICT (anlage_id, jahr, monat) DO NOTHING;

  RAISE NOTICE '✓ Max Mustermann created';
  RAISE NOTICE '  - Mitglied ID: %', user1_mitglied_id;
  RAISE NOTICE '  - 1 öffentliche Anlage';
  RAISE NOTICE '  - 3 Komponenten';
  RAISE NOTICE '  - 6 Monate Daten';
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create Max Mustermann: %', SQLERRM;
END $$;
