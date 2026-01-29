export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alternative_investitionen: {
        Row: {
          aktiv: boolean | null
          aktualisiert_am: string | null
          alternativ_beschreibung: string | null
          anlage_id: string | null
          anschaffungsdatum: string
          anschaffungskosten_alternativ: number | null
          anschaffungskosten_gesamt: number
          anschaffungskosten_relevant: number | null
          bezeichnung: string
          co2_einsparung_kg_jahr: number | null
          einsparung_gesamt_jahr: number | null
          einsparungen_jahr: Json | null
          erstellt_am: string | null
          id: string
          kosten_jahr_aktuell: Json | null
          kosten_jahr_alternativ: Json | null
          mitglied_id: string
          notizen: string | null
          parameter: Json | null
          parent_investition_id: string | null
          typ: string
        }
        Insert: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          alternativ_beschreibung?: string | null
          anlage_id?: string | null
          anschaffungsdatum: string
          anschaffungskosten_alternativ?: number | null
          anschaffungskosten_gesamt: number
          anschaffungskosten_relevant?: number | null
          bezeichnung: string
          co2_einsparung_kg_jahr?: number | null
          einsparung_gesamt_jahr?: number | null
          einsparungen_jahr?: Json | null
          erstellt_am?: string | null
          id?: string
          kosten_jahr_aktuell?: Json | null
          kosten_jahr_alternativ?: Json | null
          mitglied_id: string
          notizen?: string | null
          parameter?: Json | null
          parent_investition_id?: string | null
          typ: string
        }
        Update: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          alternativ_beschreibung?: string | null
          anlage_id?: string | null
          anschaffungsdatum?: string
          anschaffungskosten_alternativ?: number | null
          anschaffungskosten_gesamt?: number
          anschaffungskosten_relevant?: number | null
          bezeichnung?: string
          co2_einsparung_kg_jahr?: number | null
          einsparung_gesamt_jahr?: number | null
          einsparungen_jahr?: Json | null
          erstellt_am?: string | null
          id?: string
          kosten_jahr_aktuell?: Json | null
          kosten_jahr_alternativ?: Json | null
          mitglied_id?: string
          notizen?: string | null
          parameter?: Json | null
          parent_investition_id?: string | null
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "alternative_investitionen_anlage_id_fkey"
            columns: ["anlage_id"]
            isOneToOne: false
            referencedRelation: "anlagen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alternative_investitionen_mitglied_id_fkey"
            columns: ["mitglied_id"]
            isOneToOne: false
            referencedRelation: "mitglieder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alternative_investitionen_parent_investition_id_fkey"
            columns: ["parent_investition_id"]
            isOneToOne: false
            referencedRelation: "alternative_investitionen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alternative_investitionen_parent_investition_id_fkey"
            columns: ["parent_investition_id"]
            isOneToOne: false
            referencedRelation: "investition_prognose_ist_vergleich"
            referencedColumns: ["investition_id"]
          },
          {
            foreignKeyName: "alternative_investitionen_parent_investition_id_fkey"
            columns: ["parent_investition_id"]
            isOneToOne: false
            referencedRelation: "investitionen_uebersicht"
            referencedColumns: ["id"]
          },
        ]
      }
      anlagen: {
        Row: {
          aktiv: boolean | null
          aktualisiert_am: string | null
          anlagenname: string
          anlagentyp: string | null
          anschaffungskosten_euro: number | null
          anzahl_module: number | null
          ausrichtung: string | null
          batterie_bezeichnung: string | null
          beschreibung: string | null
          einspeiseverguetung_cent_kwh: number | null
          ekfz_bezeichnung: string | null
          erfahrungen: string | null
          erstellt_am: string | null
          foerderung_euro: number | null
          hersteller_module: string | null
          id: string
          inbetriebnahme_datum: string | null
          installationsdatum: string
          kennzahlen_oeffentlich: boolean | null
          komponenten_oeffentlich: boolean | null
          kontakt_erwuenscht: boolean | null
          leistung_kwp: number
          mitglied_id: string
          monatsdaten_oeffentlich: boolean | null
          motivation: string | null
          neigungswinkel_grad: number | null
          oeffentlich: boolean | null
          profilbeschreibung: string | null
          pv_module_bezeichnung: string | null
          solarteur_name: string | null
          sonstiges: string | null
          standort_genau_anzeigen: boolean | null
          standort_land: string | null
          standort_latitude: number | null
          standort_longitude: number | null
          standort_ort: string | null
          standort_plz: string | null
          standort_strasse: string | null
          tipps_fuer_andere: string | null
          waermepumpe_bezeichnung: string | null
          wechselrichter_bezeichnung: string | null
        }
        Insert: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          anlagenname: string
          anlagentyp?: string | null
          anschaffungskosten_euro?: number | null
          anzahl_module?: number | null
          ausrichtung?: string | null
          batterie_bezeichnung?: string | null
          beschreibung?: string | null
          einspeiseverguetung_cent_kwh?: number | null
          ekfz_bezeichnung?: string | null
          erfahrungen?: string | null
          erstellt_am?: string | null
          foerderung_euro?: number | null
          hersteller_module?: string | null
          id?: string
          inbetriebnahme_datum?: string | null
          installationsdatum: string
          kennzahlen_oeffentlich?: boolean | null
          komponenten_oeffentlich?: boolean | null
          kontakt_erwuenscht?: boolean | null
          leistung_kwp: number
          mitglied_id: string
          monatsdaten_oeffentlich?: boolean | null
          motivation?: string | null
          neigungswinkel_grad?: number | null
          oeffentlich?: boolean | null
          profilbeschreibung?: string | null
          pv_module_bezeichnung?: string | null
          solarteur_name?: string | null
          sonstiges?: string | null
          standort_genau_anzeigen?: boolean | null
          standort_land?: string | null
          standort_latitude?: number | null
          standort_longitude?: number | null
          standort_ort?: string | null
          standort_plz?: string | null
          standort_strasse?: string | null
          tipps_fuer_andere?: string | null
          waermepumpe_bezeichnung?: string | null
          wechselrichter_bezeichnung?: string | null
        }
        Update: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          anlagenname?: string
          anlagentyp?: string | null
          anschaffungskosten_euro?: number | null
          anzahl_module?: number | null
          ausrichtung?: string | null
          batterie_bezeichnung?: string | null
          beschreibung?: string | null
          einspeiseverguetung_cent_kwh?: number | null
          ekfz_bezeichnung?: string | null
          erfahrungen?: string | null
          erstellt_am?: string | null
          foerderung_euro?: number | null
          hersteller_module?: string | null
          id?: string
          inbetriebnahme_datum?: string | null
          installationsdatum?: string
          kennzahlen_oeffentlich?: boolean | null
          komponenten_oeffentlich?: boolean | null
          kontakt_erwuenscht?: boolean | null
          leistung_kwp?: number
          mitglied_id?: string
          monatsdaten_oeffentlich?: boolean | null
          motivation?: string | null
          neigungswinkel_grad?: number | null
          oeffentlich?: boolean | null
          profilbeschreibung?: string | null
          pv_module_bezeichnung?: string | null
          solarteur_name?: string | null
          sonstiges?: string | null
          standort_genau_anzeigen?: boolean | null
          standort_land?: string | null
          standort_latitude?: number | null
          standort_longitude?: number | null
          standort_ort?: string | null
          standort_plz?: string | null
          standort_strasse?: string | null
          tipps_fuer_andere?: string | null
          waermepumpe_bezeichnung?: string | null
          wechselrichter_bezeichnung?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anlagen_mitglied_id_fkey"
            columns: ["mitglied_id"]
            isOneToOne: false
            referencedRelation: "mitglieder"
            referencedColumns: ["id"]
          },
        ]
      }
      anlagen_kennzahlen: {
        Row: {
          amortisationszeit_monate: number | null
          anlage_id: string
          anzahl_monate_mit_daten: number | null
          autarkiegrad_prozent: number | null
          berechnet_am: string | null
          betriebskosten_gesamt_euro: number | null
          bis_jahr: number
          bis_monat: number
          co2_einsparung_gesamt_kg: number | null
          co2_vermeidungskosten_euro_tonne: number | null
          eigenverbrauch_gesamt_kwh: number | null
          eigenverbrauchsquote_prozent: number | null
          einspeiseerloese_gesamt_euro: number | null
          einspeisung_gesamt_kwh: number | null
          gesamtbilanz_euro: number | null
          id: string
          investitionskosten_gesamt_euro: number | null
          netzbezug_gesamt_kwh: number | null
          netzbezugskosten_gesamt_euro: number | null
          pv_erzeugung_gesamt_kwh: number | null
          roi_prozent: number | null
        }
        Insert: {
          amortisationszeit_monate?: number | null
          anlage_id: string
          anzahl_monate_mit_daten?: number | null
          autarkiegrad_prozent?: number | null
          berechnet_am?: string | null
          betriebskosten_gesamt_euro?: number | null
          bis_jahr: number
          bis_monat: number
          co2_einsparung_gesamt_kg?: number | null
          co2_vermeidungskosten_euro_tonne?: number | null
          eigenverbrauch_gesamt_kwh?: number | null
          eigenverbrauchsquote_prozent?: number | null
          einspeiseerloese_gesamt_euro?: number | null
          einspeisung_gesamt_kwh?: number | null
          gesamtbilanz_euro?: number | null
          id?: string
          investitionskosten_gesamt_euro?: number | null
          netzbezug_gesamt_kwh?: number | null
          netzbezugskosten_gesamt_euro?: number | null
          pv_erzeugung_gesamt_kwh?: number | null
          roi_prozent?: number | null
        }
        Update: {
          amortisationszeit_monate?: number | null
          anlage_id?: string
          anzahl_monate_mit_daten?: number | null
          autarkiegrad_prozent?: number | null
          berechnet_am?: string | null
          betriebskosten_gesamt_euro?: number | null
          bis_jahr?: number
          bis_monat?: number
          co2_einsparung_gesamt_kg?: number | null
          co2_vermeidungskosten_euro_tonne?: number | null
          eigenverbrauch_gesamt_kwh?: number | null
          eigenverbrauchsquote_prozent?: number | null
          einspeiseerloese_gesamt_euro?: number | null
          einspeisung_gesamt_kwh?: number | null
          gesamtbilanz_euro?: number | null
          id?: string
          investitionskosten_gesamt_euro?: number | null
          netzbezug_gesamt_kwh?: number | null
          netzbezugskosten_gesamt_euro?: number | null
          pv_erzeugung_gesamt_kwh?: number | null
          roi_prozent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anlagen_kennzahlen_anlage_id_fkey"
            columns: ["anlage_id"]
            isOneToOne: true
            referencedRelation: "anlagen"
            referencedColumns: ["id"]
          },
        ]
      }
      anlagen_komponenten: {
        Row: {
          aktiv: boolean | null
          aktualisiert_am: string | null
          anlage_id: string
          anschaffungsdatum: string
          anschaffungskosten_euro: number | null
          beschreibung: string | null
          bezeichnung: string
          erstellt_am: string | null
          foerderung_euro: number | null
          hersteller: string | null
          id: string
          modell: string | null
          seriennummer: string | null
          technische_daten: Json | null
          typ: string
        }
        Insert: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          anlage_id: string
          anschaffungsdatum: string
          anschaffungskosten_euro?: number | null
          beschreibung?: string | null
          bezeichnung: string
          erstellt_am?: string | null
          foerderung_euro?: number | null
          hersteller?: string | null
          id?: string
          modell?: string | null
          seriennummer?: string | null
          technische_daten?: Json | null
          typ: string
        }
        Update: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          anlage_id?: string
          anschaffungsdatum?: string
          anschaffungskosten_euro?: number | null
          beschreibung?: string | null
          bezeichnung?: string
          erstellt_am?: string | null
          foerderung_euro?: number | null
          hersteller?: string | null
          id?: string
          modell?: string | null
          seriennummer?: string | null
          technische_daten?: Json | null
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "anlagen_komponenten_anlage_id_fkey"
            columns: ["anlage_id"]
            isOneToOne: false
            referencedRelation: "anlagen"
            referencedColumns: ["id"]
          },
        ]
      }
      haushalt_komponenten: {
        Row: {
          aktiv: boolean | null
          aktualisiert_am: string | null
          alternative_kosten_jahr: Json | null
          anschaffungsdatum: string
          anschaffungskosten_euro: number | null
          beschreibung: string | null
          bezeichnung: string
          ersetzt_technologie: string | null
          erstellt_am: string | null
          foerderung_euro: number | null
          hauptanlage_id: string | null
          hersteller: string | null
          id: string
          mitglied_id: string
          modell: string | null
          oeffentlich: boolean | null
          technische_daten: Json | null
          typ: string
        }
        Insert: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          alternative_kosten_jahr?: Json | null
          anschaffungsdatum: string
          anschaffungskosten_euro?: number | null
          beschreibung?: string | null
          bezeichnung: string
          ersetzt_technologie?: string | null
          erstellt_am?: string | null
          foerderung_euro?: number | null
          hauptanlage_id?: string | null
          hersteller?: string | null
          id?: string
          mitglied_id: string
          modell?: string | null
          oeffentlich?: boolean | null
          technische_daten?: Json | null
          typ: string
        }
        Update: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          alternative_kosten_jahr?: Json | null
          anschaffungsdatum?: string
          anschaffungskosten_euro?: number | null
          beschreibung?: string | null
          bezeichnung?: string
          ersetzt_technologie?: string | null
          erstellt_am?: string | null
          foerderung_euro?: number | null
          hauptanlage_id?: string | null
          hersteller?: string | null
          id?: string
          mitglied_id?: string
          modell?: string | null
          oeffentlich?: boolean | null
          technische_daten?: Json | null
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "haushalt_komponenten_hauptanlage_id_fkey"
            columns: ["hauptanlage_id"]
            isOneToOne: false
            referencedRelation: "anlagen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haushalt_komponenten_mitglied_id_fkey"
            columns: ["mitglied_id"]
            isOneToOne: false
            referencedRelation: "mitglieder"
            referencedColumns: ["id"]
          },
        ]
      }
      investition_kennzahlen: {
        Row: {
          amortisationszeit_monate: number | null
          amortisiert_voraussichtlich_am: string | null
          baeume_aequivalent: number | null
          berechnet_am: string | null
          bilanz_kumuliert_euro: number | null
          bis_jahr: number
          bis_monat: number
          co2_einsparung_kumuliert_kg: number | null
          einsparung_kumuliert_euro: number | null
          id: string
          investition_id: string
          kosten_kumuliert_euro: number | null
          roi_prozent: number | null
        }
        Insert: {
          amortisationszeit_monate?: number | null
          amortisiert_voraussichtlich_am?: string | null
          baeume_aequivalent?: number | null
          berechnet_am?: string | null
          bilanz_kumuliert_euro?: number | null
          bis_jahr: number
          bis_monat: number
          co2_einsparung_kumuliert_kg?: number | null
          einsparung_kumuliert_euro?: number | null
          id?: string
          investition_id: string
          kosten_kumuliert_euro?: number | null
          roi_prozent?: number | null
        }
        Update: {
          amortisationszeit_monate?: number | null
          amortisiert_voraussichtlich_am?: string | null
          baeume_aequivalent?: number | null
          berechnet_am?: string | null
          bilanz_kumuliert_euro?: number | null
          bis_jahr?: number
          bis_monat?: number
          co2_einsparung_kumuliert_kg?: number | null
          einsparung_kumuliert_euro?: number | null
          id?: string
          investition_id?: string
          kosten_kumuliert_euro?: number | null
          roi_prozent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investition_kennzahlen_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: true
            referencedRelation: "alternative_investitionen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investition_kennzahlen_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: true
            referencedRelation: "investition_prognose_ist_vergleich"
            referencedColumns: ["investition_id"]
          },
          {
            foreignKeyName: "investition_kennzahlen_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: true
            referencedRelation: "investitionen_uebersicht"
            referencedColumns: ["id"]
          },
        ]
      }
      investition_monatsdaten: {
        Row: {
          aktualisiert_am: string | null
          co2_einsparung_kg: number | null
          einsparung_monat_euro: number | null
          erstellt_am: string | null
          id: string
          investition_id: string
          jahr: number
          kosten_daten: Json | null
          monat: number
          notizen: string | null
          verbrauch_daten: Json | null
        }
        Insert: {
          aktualisiert_am?: string | null
          co2_einsparung_kg?: number | null
          einsparung_monat_euro?: number | null
          erstellt_am?: string | null
          id?: string
          investition_id: string
          jahr: number
          kosten_daten?: Json | null
          monat: number
          notizen?: string | null
          verbrauch_daten?: Json | null
        }
        Update: {
          aktualisiert_am?: string | null
          co2_einsparung_kg?: number | null
          einsparung_monat_euro?: number | null
          erstellt_am?: string | null
          id?: string
          investition_id?: string
          jahr?: number
          kosten_daten?: Json | null
          monat?: number
          notizen?: string | null
          verbrauch_daten?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "alternative_investitionen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "investition_prognose_ist_vergleich"
            referencedColumns: ["investition_id"]
          },
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "investitionen_uebersicht"
            referencedColumns: ["id"]
          },
        ]
      }
      komponenten_monatsdaten: {
        Row: {
          aktualisiert_am: string | null
          alternative_kosten_euro: number | null
          co2_einsparung_kg: number | null
          einsparung_euro: number | null
          energiekosten_euro: number | null
          erstellt_am: string | null
          id: string
          jahr: number
          komponente_id: string
          monat: number
          notizen: string | null
          verbrauch_daten: Json | null
          wartungskosten_euro: number | null
        }
        Insert: {
          aktualisiert_am?: string | null
          alternative_kosten_euro?: number | null
          co2_einsparung_kg?: number | null
          einsparung_euro?: number | null
          energiekosten_euro?: number | null
          erstellt_am?: string | null
          id?: string
          jahr: number
          komponente_id: string
          monat: number
          notizen?: string | null
          verbrauch_daten?: Json | null
          wartungskosten_euro?: number | null
        }
        Update: {
          aktualisiert_am?: string | null
          alternative_kosten_euro?: number | null
          co2_einsparung_kg?: number | null
          einsparung_euro?: number | null
          energiekosten_euro?: number | null
          erstellt_am?: string | null
          id?: string
          jahr?: number
          komponente_id?: string
          monat?: number
          notizen?: string | null
          verbrauch_daten?: Json | null
          wartungskosten_euro?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "komponenten_monatsdaten_komponente_id_fkey"
            columns: ["komponente_id"]
            isOneToOne: false
            referencedRelation: "haushalt_komponenten"
            referencedColumns: ["id"]
          },
        ]
      }
      komponenten_typen: {
        Row: {
          aktiv: boolean | null
          beschreibung: string | null
          bezeichnung: string
          co2_faktor_kg_kwh: number | null
          erstellt_am: string | null
          icon: string | null
          id: string
          kategorie: string
          sortierung: number | null
          standardlebensdauer_jahre: number | null
          technische_felder_schema: Json | null
          typ_code: string
          wartungskosten_prozent_pa: number | null
        }
        Insert: {
          aktiv?: boolean | null
          beschreibung?: string | null
          bezeichnung: string
          co2_faktor_kg_kwh?: number | null
          erstellt_am?: string | null
          icon?: string | null
          id?: string
          kategorie: string
          sortierung?: number | null
          standardlebensdauer_jahre?: number | null
          technische_felder_schema?: Json | null
          typ_code: string
          wartungskosten_prozent_pa?: number | null
        }
        Update: {
          aktiv?: boolean | null
          beschreibung?: string | null
          bezeichnung?: string
          co2_faktor_kg_kwh?: number | null
          erstellt_am?: string | null
          icon?: string | null
          id?: string
          kategorie?: string
          sortierung?: number | null
          standardlebensdauer_jahre?: number | null
          technische_felder_schema?: Json | null
          typ_code?: string
          wartungskosten_prozent_pa?: number | null
        }
        Relationships: []
      }
      mitglieder: {
        Row: {
          aktiv: boolean | null
          aktualisiert_am: string | null
          auth_user_id: string | null
          bio: string | null
          display_name: string | null
          email: string
          erstellt_am: string | null
          id: string
          land: string | null
          nachname: string
          ort: string | null
          plz: string | null
          profil_oeffentlich: boolean | null
          strasse: string | null
          vorname: string
          website: string | null
        }
        Insert: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          auth_user_id?: string | null
          bio?: string | null
          display_name?: string | null
          email: string
          erstellt_am?: string | null
          id?: string
          land?: string | null
          nachname: string
          ort?: string | null
          plz?: string | null
          profil_oeffentlich?: boolean | null
          strasse?: string | null
          vorname: string
          website?: string | null
        }
        Update: {
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          auth_user_id?: string | null
          bio?: string | null
          display_name?: string | null
          email?: string
          erstellt_am?: string | null
          id?: string
          land?: string | null
          nachname?: string
          ort?: string | null
          plz?: string | null
          profil_oeffentlich?: boolean | null
          strasse?: string | null
          vorname?: string
          website?: string | null
        }
        Relationships: []
      }
      monatsdaten: {
        Row: {
          aktualisiert_am: string | null
          anlage_id: string
          batterieentladung_kwh: number | null
          batterieladung_kwh: number | null
          betriebsausgaben_monat_euro: number | null
          datenquelle: string | null
          direktverbrauch_kwh: number | null
          einspeisung_ertrag_euro: number | null
          einspeisung_kwh: number | null
          einspeisung_preis_cent_kwh: number | null
          erstellt_am: string | null
          gesamtverbrauch_kwh: number | null
          globalstrahlung_kwh_m2: number | null
          id: string
          jahr: number
          monat: number
          netzbezug_kosten_euro: number | null
          netzbezug_kwh: number | null
          netzbezug_preis_cent_kwh: number | null
          notizen: string | null
          pv_erzeugung_kwh: number | null
          sonnenstunden: number | null
        }
        Insert: {
          aktualisiert_am?: string | null
          anlage_id: string
          batterieentladung_kwh?: number | null
          batterieladung_kwh?: number | null
          betriebsausgaben_monat_euro?: number | null
          datenquelle?: string | null
          direktverbrauch_kwh?: number | null
          einspeisung_ertrag_euro?: number | null
          einspeisung_kwh?: number | null
          einspeisung_preis_cent_kwh?: number | null
          erstellt_am?: string | null
          gesamtverbrauch_kwh?: number | null
          globalstrahlung_kwh_m2?: number | null
          id?: string
          jahr: number
          monat: number
          netzbezug_kosten_euro?: number | null
          netzbezug_kwh?: number | null
          netzbezug_preis_cent_kwh?: number | null
          notizen?: string | null
          pv_erzeugung_kwh?: number | null
          sonnenstunden?: number | null
        }
        Update: {
          aktualisiert_am?: string | null
          anlage_id?: string
          batterieentladung_kwh?: number | null
          batterieladung_kwh?: number | null
          betriebsausgaben_monat_euro?: number | null
          datenquelle?: string | null
          direktverbrauch_kwh?: number | null
          einspeisung_ertrag_euro?: number | null
          einspeisung_kwh?: number | null
          einspeisung_preis_cent_kwh?: number | null
          erstellt_am?: string | null
          gesamtverbrauch_kwh?: number | null
          globalstrahlung_kwh_m2?: number | null
          id?: string
          jahr?: number
          monat?: number
          netzbezug_kosten_euro?: number | null
          netzbezug_kwh?: number | null
          netzbezug_preis_cent_kwh?: number | null
          notizen?: string | null
          pv_erzeugung_kwh?: number | null
          sonnenstunden?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monatsdaten_anlage_id_fkey"
            columns: ["anlage_id"]
            isOneToOne: false
            referencedRelation: "anlagen"
            referencedColumns: ["id"]
          },
        ]
      }
      strompreise: {
        Row: {
          aktualisiert_am: string | null
          anbieter_name: string | null
          anlage_id: string | null
          einspeiseverguetung_cent_kwh: number
          erstellt_am: string | null
          gueltig_ab: string
          gueltig_bis: string | null
          id: string
          mitglied_id: string | null
          netzbezug_arbeitspreis_cent_kwh: number
          netzbezug_grundpreis_euro_monat: number | null
          notizen: string | null
          tarifname: string | null
          vertragsart: string | null
        }
        Insert: {
          aktualisiert_am?: string | null
          anbieter_name?: string | null
          anlage_id?: string | null
          einspeiseverguetung_cent_kwh: number
          erstellt_am?: string | null
          gueltig_ab: string
          gueltig_bis?: string | null
          id?: string
          mitglied_id?: string | null
          netzbezug_arbeitspreis_cent_kwh: number
          netzbezug_grundpreis_euro_monat?: number | null
          notizen?: string | null
          tarifname?: string | null
          vertragsart?: string | null
        }
        Update: {
          aktualisiert_am?: string | null
          anbieter_name?: string | null
          anlage_id?: string | null
          einspeiseverguetung_cent_kwh?: number
          erstellt_am?: string | null
          gueltig_ab?: string
          gueltig_bis?: string | null
          id?: string
          mitglied_id?: string | null
          netzbezug_arbeitspreis_cent_kwh?: number
          netzbezug_grundpreis_euro_monat?: number | null
          notizen?: string | null
          tarifname?: string | null
          vertragsart?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strompreise_anlage_id_fkey"
            columns: ["anlage_id"]
            isOneToOne: false
            referencedRelation: "anlagen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strompreise_mitglied_id_fkey"
            columns: ["mitglied_id"]
            isOneToOne: false
            referencedRelation: "mitglieder"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      investition_jahres_zusammenfassung: {
        Row: {
          anzahl_monate: number | null
          bezeichnung: string | null
          co2_einsparung_ist_kg: number | null
          durchschnitt_monat_euro: number | null
          einsparung_ist_jahr_euro: number | null
          hochrechnung_jahr_euro: number | null
          investition_id: string | null
          jahr: number | null
          mitglied_id: string | null
          prognose_jahr_euro: number | null
          typ: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alternative_investitionen_mitglied_id_fkey"
            columns: ["mitglied_id"]
            isOneToOne: false
            referencedRelation: "mitglieder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "alternative_investitionen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "investition_prognose_ist_vergleich"
            referencedColumns: ["investition_id"]
          },
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "investitionen_uebersicht"
            referencedColumns: ["id"]
          },
        ]
      }
      investition_monatsdaten_detail: {
        Row: {
          abweichung_prozent: number | null
          aktualisiert_am: string | null
          anschaffungsdatum: string | null
          bezeichnung: string | null
          co2_einsparung_kg: number | null
          einsparung_monat_euro: number | null
          erstellt_am: string | null
          id: string | null
          investition_id: string | null
          jahr: number | null
          kosten_daten: Json | null
          mitglied_id: string | null
          monat: number | null
          nachname: string | null
          notizen: string | null
          parameter: Json | null
          prognose_jahr_euro: number | null
          prognose_monat_euro: number | null
          typ: string | null
          verbrauch_daten: Json | null
          vorname: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alternative_investitionen_mitglied_id_fkey"
            columns: ["mitglied_id"]
            isOneToOne: false
            referencedRelation: "mitglieder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "alternative_investitionen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "investition_prognose_ist_vergleich"
            referencedColumns: ["investition_id"]
          },
          {
            foreignKeyName: "investition_monatsdaten_investition_id_fkey"
            columns: ["investition_id"]
            isOneToOne: false
            referencedRelation: "investitionen_uebersicht"
            referencedColumns: ["id"]
          },
        ]
      }
      investition_prognose_ist_vergleich: {
        Row: {
          abweichung_prozent: number | null
          anschaffungsdatum: string | null
          anschaffungskosten_relevant: number | null
          anzahl_monate_erfasst: number | null
          bezeichnung: string | null
          co2_ist_gesamt_kg: number | null
          investition_id: string | null
          ist_gesamt_euro: number | null
          ist_hochrechnung_jahr_euro: number | null
          mitglied_id: string | null
          nachname: string | null
          prognose_jahr_euro: number | null
          typ: string | null
          vorname: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alternative_investitionen_mitglied_id_fkey"
            columns: ["mitglied_id"]
            isOneToOne: false
            referencedRelation: "mitglieder"
            referencedColumns: ["id"]
          },
        ]
      }
      investitionen_uebersicht: {
        Row: {
          aktiv: boolean | null
          aktualisiert_am: string | null
          alternativ_beschreibung: string | null
          amortisation_jahre: number | null
          anlage_id: string | null
          anschaffungsdatum: string | null
          anschaffungskosten_alternativ: number | null
          anschaffungskosten_gesamt: number | null
          anschaffungskosten_relevant: number | null
          bezeichnung: string | null
          co2_einsparung_kg_jahr: number | null
          einsparung_gesamt_jahr: number | null
          einsparungen_jahr: Json | null
          erstellt_am: string | null
          id: string | null
          kosten_jahr_aktuell: Json | null
          kosten_jahr_alternativ: Json | null
          mitglied_id: string | null
          nachname: string | null
          notizen: string | null
          parameter: Json | null
          parent_investition_id: string | null
          roi_prozent: number | null
          typ: string | null
          vorname: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alternative_investitionen_anlage_id_fkey"
            columns: ["anlage_id"]
            isOneToOne: false
            referencedRelation: "anlagen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alternative_investitionen_mitglied_id_fkey"
            columns: ["mitglied_id"]
            isOneToOne: false
            referencedRelation: "mitglieder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alternative_investitionen_parent_investition_id_fkey"
            columns: ["parent_investition_id"]
            isOneToOne: false
            referencedRelation: "alternative_investitionen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alternative_investitionen_parent_investition_id_fkey"
            columns: ["parent_investition_id"]
            isOneToOne: false
            referencedRelation: "investition_prognose_ist_vergleich"
            referencedColumns: ["investition_id"]
          },
          {
            foreignKeyName: "alternative_investitionen_parent_investition_id_fkey"
            columns: ["parent_investition_id"]
            isOneToOne: false
            referencedRelation: "investitionen_uebersicht"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anlage_is_public: { Args: { p_anlage_id: string }; Returns: boolean }
      auth_user_id: { Args: never; Returns: string }
      current_mitglied_id: { Args: never; Returns: string }
      get_aktueller_strompreis: {
        Args: {
          p_anlage_id?: string
          p_mitglied_id: string
          p_stichtag?: string
        }
        Returns: {
          einspeiseverguetung_cent_kwh: number
          grundpreis_euro_monat: number
          netzbezug_cent_kwh: number
        }[]
      }
      get_community_stats: {
        Args: never
        Returns: {
          aelteste_anlage_datum: string
          anzahl_anlagen: number
          anzahl_mit_speicher: number
          anzahl_mit_wallbox: number
          anzahl_mitglieder: number
          durchschnitt_leistung_kwp: number
          gesamtleistung_kwp: number
          neueste_anlage_datum: string
        }[]
      }
      get_public_anlage_details: {
        Args: { p_anlage_id: string }
        Returns: {
          anlage_id: string
          anlagenname: string
          ausrichtung: string
          beschreibung: string
          installationsdatum: string
          komponenten: Json
          leistung_kwp: number
          mitglied_bio: string
          mitglied_display_name: string
          monatsdaten_summary: Json
          neigungswinkel_grad: number
          standort_ort: string
          standort_plz: string
        }[]
      }
      get_public_anlagen: {
        Args: never
        Returns: {
          anlage_id: string
          anlagenname: string
          anzahl_komponenten: number
          hat_speicher: boolean
          hat_wallbox: boolean
          installationsdatum: string
          kennzahlen_oeffentlich: boolean
          komponenten_oeffentlich: boolean
          leistung_kwp: number
          mitglied_display_name: string
          mitglied_id: string
          monatsdaten_oeffentlich: boolean
          profil_oeffentlich: boolean
          standort_latitude: number
          standort_longitude: number
          standort_ort: string
          standort_plz: string
        }[]
      }
      get_public_monatsdaten: {
        Args: { p_anlage_id: string }
        Returns: {
          autarkiegrad_prozent: number
          direktverbrauch_kwh: number
          eigenverbrauchsquote_prozent: number
          einspeisung_kwh: number
          gesamtverbrauch_kwh: number
          jahr: number
          monat: number
          netzbezug_kwh: number
          pv_erzeugung_kwh: number
        }[]
      }
      search_public_anlagen: {
        Args: {
          p_hat_speicher?: boolean
          p_hat_wallbox?: boolean
          p_max_kwp?: number
          p_min_kwp?: number
          p_ort?: string
          p_plz_prefix?: string
        }
        Returns: {
          anlage_id: string
          anlagenname: string
          anzahl_komponenten: number
          hat_speicher: boolean
          hat_wallbox: boolean
          installationsdatum: string
          leistung_kwp: number
          mitglied_display_name: string
          standort_ort: string
          standort_plz: string
        }[]
      }
      user_owns_anlage: { Args: { p_anlage_id: string }; Returns: boolean }
      user_owns_investition: {
        Args: { p_investition_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
