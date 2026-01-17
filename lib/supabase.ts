// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export interface Anlage {
  id: string
  mitglied_id: string
  bezeichnung: string
  leistung_kwp: number
  inbetriebnahme: string
  anschaffungskosten: number
  erstellt_am: string
  aktualisiert_am: string
}

export interface Monatsdaten {
  id: string
  anlage_id: string
  jahr: number
  monat: number
  pv_erzeugung_kwh: number
  eigenverbrauch_kwh: number
  einspeisung_kwh: number
  netzbezug_kwh: number
  verbrauch_gesamt_kwh: number
  einspeisung_erloese_euro: number
  netzbezug_kosten_euro: number
  erstellt_am: string
  aktualisiert_am: string
}

export interface MonatsdatenKennzahlen extends Monatsdaten {
  eigenverbrauchsquote: number
  autarkiegrad: number
  netto_ertrag_euro: number
}

export interface AlternativeInvestition {
  id: string
  mitglied_id: string
  typ: string
  bezeichnung: string
  anschaffungsdatum: string
  anschaffungskosten_gesamt: number
  anschaffungskosten_alternativ?: number
  alternativ_beschreibung?: string
  kosten_jahr_aktuell: any
  kosten_jahr_alternativ: any
  einsparungen_jahr: any
  einsparung_gesamt_jahr?: number
  parameter: any
  co2_einsparung_kg_jahr?: number
  aktiv: boolean
  notizen?: string
  erstellt_am: string
  aktualisiert_am: string
}

export interface InvestitionUebersicht extends AlternativeInvestition {
  anschaffungskosten_relevant: number
  roi_prozent?: number
  amortisation_jahre?: number
  vorname: string
  nachname: string
}

export interface InvestitionMonatsdaten {
  id: string
  investition_id: string
  jahr: number
  monat: number
  verbrauch_daten: any
  kosten_daten: any
  einsparung_monat_euro?: number
  co2_einsparung_kg?: number
  notizen?: string
  erstellt_am: string
  aktualisiert_am: string
}

export interface InvestitionMonatsdatenDetail extends InvestitionMonatsdaten {
  typ: string
  bezeichnung: string
  mitglied_id: string
  anschaffungsdatum: string
  parameter: any
  prognose_jahr_euro?: number
  prognose_monat_euro?: number
  vorname: string
  nachname: string
}

export interface InvestitionPrognoseIstVergleich {
  investition_id: string
  typ: string
  bezeichnung: string
  mitglied_id: string
  jahr?: number
  prognose_jahr_euro?: number
  prognose_co2_kg_jahr?: number
  anzahl_monate?: number
  einsparung_ist_jahr_euro?: number
  hochrechnung_jahr_euro?: number
  co2_einsparung_ist_kg?: number
  abweichung_hochrechnung_prozent?: number
  bewertung?: string
}
