-- ============================================
-- MIGRATION 05: Seed Data
-- ============================================
-- Datum: 2026-01-28
-- Beschreibung: Fügt Master Data und Test-Daten ein
-- ============================================

-- ============================================
-- 1. KOMPONENTEN-TYPEN (Master Data)
-- ============================================

INSERT INTO komponenten_typen (typ_code, kategorie, bezeichnung, beschreibung, standardlebensdauer_jahre, co2_faktor_kg_kwh, wartungskosten_prozent_pa, sortierung) VALUES
  -- Anlagen-Komponenten
  ('speicher', 'anlage', 'Batteriespeicher', 'Speichert überschüssigen PV-Strom für späteren Verbrauch', 15, 0.38, 0.5, 10),
  ('wechselrichter', 'anlage', 'Wechselrichter', 'Wandelt DC-Strom der Module in AC-Strom', 15, 0.00, 0.2, 20),
  ('wallbox', 'anlage', 'Wallbox', 'Ladestation für Elektrofahrzeuge', 15, 0.00, 0.1, 30),
  ('optimizer', 'anlage', 'Leistungsoptimierer', 'Optimiert die Leistung einzelner PV-Module', 20, 0.00, 0.1, 40),
  ('modul', 'anlage', 'PV-Modul', 'Photovoltaik-Modul zur Stromerzeugung', 25, 0.38, 0.1, 5),

  -- Haushalts-Komponenten
  ('e-auto', 'haushalt', 'Elektroauto', 'Elektrisches Fahrzeug (ersetzt Verbrenner)', 12, 0.15, 2.0, 50),
  ('waermepumpe', 'haushalt', 'Wärmepumpe', 'Elektrische Heizung (ersetzt Gas/Öl)', 20, 0.20, 2.5, 60),
  ('klimaanlage', 'haushalt', 'Klimaanlage', 'Elektrische Klimaanlage', 15, 0.38, 1.5, 70),
  ('pool', 'haushalt', 'Pool-Pumpe', 'Pool-Heizung/Pumpe mit PV-Betrieb', 10, 0.38, 2.0, 80),
  ('sonstiges', 'haushalt', 'Sonstiges', 'Sonstige elektrische Verbraucher', 15, 0.38, 1.0, 90)
ON CONFLICT (typ_code) DO NOTHING;

COMMENT ON TABLE komponenten_typen IS 'Master Data für Komponenten-Typen - vordefiniert, nicht vom User änderbar';

-- ============================================
-- 2. GLOBALE STROMPREISE (Master Data)
-- ============================================

-- Durchschnittliche deutsche Strompreise 2024
INSERT INTO strompreise (
  mitglied_id,
  anlage_id,
  gueltig_ab,
  gueltig_bis,
  netzbezug_arbeitspreis_cent_kwh,
  netzbezug_grundpreis_euro_monat,
  einspeiseverguetung_cent_kwh,
  anbieter_name,
  tarifname,
  vertragsart,
  notizen
) VALUES
  -- Globaler Durchschnittspreis 2024
  (NULL, NULL, '2024-01-01', NULL, 35.0, 12.0, 8.2, 'Durchschnitt Deutschland', 'Marktdurchschnitt', 'Referenz', 'Durchschnittlicher deutscher Strompreis 2024'),

  -- Globaler Durchschnittspreis 2023
  (NULL, NULL, '2023-01-01', '2023-12-31', 42.0, 12.0, 8.0, 'Durchschnitt Deutschland', 'Marktdurchschnitt', 'Referenz', 'Durchschnittlicher deutscher Strompreis 2023 (Energiekrise)'),

  -- Globaler Durchschnittspreis 2022
  (NULL, NULL, '2022-01-01', '2022-12-31', 38.0, 10.0, 7.5, 'Durchschnitt Deutschland', 'Marktdurchschnitt', 'Referenz', 'Durchschnittlicher deutscher Strompreis 2022')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE strompreise IS 'Globale Durchschnittspreise + user-spezifische Preise';

-- ============================================
-- 3. TEST-DATEN (Optional - nur für Development)
-- ============================================

-- HINWEIS: Diese Test-Daten sollten nur in Development/Staging eingefügt werden
-- In Production: Kommentieren Sie diesen Block aus!

-- Test User 1: Max Mustermann (Öffentliche Anlage)
DO $$
DECLARE
  test_auth_id uuid := '11111111-1111-1111-1111-111111111111';
  test_mitglied_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  test_anlage_id uuid := 'aaaa0001-0001-0001-0001-000000000001';
BEGIN
  -- Prüfe ob in Development (anhand Datenbank-Name oder ENV var)
  -- Für Production: Überspringe diesen Block komplett

  -- Erstelle Test Auth User (nur wenn nicht existiert)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  VALUES (
    test_auth_id,
    '00000000-0000-0000-0000-000000000000',
    'max.mustermann@example.com',
    '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash', -- Dummy hash
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Erstelle Test Mitglied
  INSERT INTO mitglieder (id, auth_user_id, email, vorname, nachname, display_name, ort, profil_oeffentlich, bio, aktiv)
  VALUES (
    test_mitglied_id,
    test_auth_id,
    'max.mustermann@example.com',
    'Max',
    'Mustermann',
    'SolarMax',
    'München',
    true,
    'Hobbybastler mit Leidenschaft für erneuerbare Energien. Teile gerne meine Erfahrungen!',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Erstelle Test Anlage (Öffentlich)
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
    test_anlage_id,
    test_mitglied_id,
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
    true, -- Öffentlich
    false, -- Standort nicht genau anzeigen
    true, -- Kennzahlen öffentlich
    true, -- Monatsdaten öffentlich
    true, -- Komponenten öffentlich
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Erstelle Test Komponenten
  INSERT INTO anlagen_komponenten (anlage_id, typ, bezeichnung, beschreibung, technische_daten, anschaffungsdatum, anschaffungskosten_euro, hersteller, modell, aktiv)
  VALUES
    (test_anlage_id, 'speicher', 'BYD Battery-Box Premium HVS 10.2', 'Hochvolt-Speicher 10,2 kWh', '{"kapazitaet_kwh": 10.2, "max_ladeleistung_kw": 5, "max_entladeleistung_kw": 5}'::jsonb, '2023-06-15', 8500, 'BYD', 'Battery-Box Premium HVS 10.2', true),
    (test_anlage_id, 'wechselrichter', 'Fronius Symo 10.0-3-M', 'Dreiphasiger Wechselrichter 10 kW', '{"nennleistung_kw": 10, "wirkungsgrad": 0.98, "phasen": 3}'::jsonb, '2023-06-15', 2100, 'Fronius', 'Symo 10.0-3-M', true),
    (test_anlage_id, 'wallbox', 'Wallbox Pulsar Plus', '11 kW Ladestation', '{"ladeleistung_kw": 11, "phasen": 3, "stecker": "Typ 2"}'::jsonb, '2023-07-01', 850, 'Wallbox', 'Pulsar Plus', true)
  ON CONFLICT DO NOTHING;

  -- Erstelle Test Monatsdaten (letzten 6 Monate)
  INSERT INTO monatsdaten (anlage_id, jahr, monat, pv_erzeugung_kwh, direktverbrauch_kwh, batterieladung_kwh, batterieentladung_kwh, einspeisung_kwh, netzbezug_kwh, gesamtverbrauch_kwh, einspeisung_ertrag_euro, netzbezug_kosten_euro, betriebsausgaben_monat_euro, netzbezug_preis_cent_kwh, einspeisung_preis_cent_kwh)
  VALUES
    (test_anlage_id, 2024, 1, 450, 280, 120, 110, 170, 130, 400, 13.94, 45.50, 5.00, 35.0, 8.2),
    (test_anlage_id, 2024, 2, 620, 380, 180, 170, 240, 95, 470, 19.68, 33.25, 5.00, 35.0, 8.2),
    (test_anlage_id, 2024, 3, 850, 520, 250, 240, 330, 75, 595, 27.06, 26.25, 5.00, 35.0, 8.2),
    (test_anlage_id, 2024, 4, 1100, 680, 320, 310, 420, 50, 730, 34.44, 17.50, 5.00, 35.0, 8.2),
    (test_anlage_id, 2024, 5, 1250, 770, 360, 350, 480, 35, 820, 39.36, 12.25, 5.00, 35.0, 8.2),
    (test_anlage_id, 2024, 6, 1180, 730, 340, 330, 450, 42, 772, 36.90, 14.70, 5.00, 35.0, 8.2)
  ON CONFLICT (anlage_id, jahr, monat) DO NOTHING;

  RAISE NOTICE 'Test data for Max Mustermann created successfully';

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create test data: %', SQLERRM;
END $$;

-- ============================================
-- VERIFIZIERUNG
-- ============================================

DO $$
DECLARE
  komponenten_count integer;
  strompreise_count integer;
  test_mitglieder_count integer;
BEGIN
  SELECT COUNT(*) INTO komponenten_count FROM komponenten_typen;
  SELECT COUNT(*) INTO strompreise_count FROM strompreise;
  SELECT COUNT(*) INTO test_mitglieder_count FROM mitglieder;

  RAISE NOTICE 'Seed data inserted successfully:';
  RAISE NOTICE '  - Komponenten-Typen: %', komponenten_count;
  RAISE NOTICE '  - Globale Strompreise: %', strompreise_count;
  RAISE NOTICE '  - Test-Mitglieder: %', test_mitglieder_count;

  IF test_mitglieder_count > 0 THEN
    RAISE WARNING '  - Test data is active! Remove for production.';
  END IF;
END $$;
