// lib/community.ts
// Helper Functions für Community-Features (öffentliche Anlagen)

import { createClient } from './supabase-server'

// ============================================
// TYPES
// ============================================

export interface PublicAnlage {
  anlage_id: string
  anlagenname: string
  leistung_kwp: number
  installationsdatum: string
  standort_plz: string | null
  standort_ort: string | null
  standort_latitude: number | null
  standort_longitude: number | null
  mitglied_id: string
  mitglied_display_name: string
  anzahl_komponenten: number
  hat_speicher: boolean
  hat_wallbox: boolean
  profil_oeffentlich: boolean
  kennzahlen_oeffentlich: boolean
  monatsdaten_oeffentlich: boolean
  komponenten_oeffentlich: boolean
}

export interface CommunityStats {
  anzahl_anlagen: number
  gesamtleistung_kwp: number
  anzahl_mitglieder: number
  durchschnitt_leistung_kwp: number
  anzahl_mit_speicher: number
  anzahl_mit_wallbox: number
  neueste_anlage_datum: string | null
  aelteste_anlage_datum: string | null
}

export interface PublicAnlageDetails {
  anlage_id: string
  anlagenname: string
  beschreibung: string | null
  leistung_kwp: number
  installationsdatum: string
  standort_ort: string | null
  standort_plz: string | null
  ausrichtung: string | null
  neigungswinkel_grad: number | null
  mitglied_display_name: string
  mitglied_bio: string | null
  komponenten: any[] | null
  monatsdaten_summary: {
    anzahl_monate: number
    gesamt_erzeugung_kwh: number
    gesamt_einspeisung_kwh: number
    gesamt_direktverbrauch_kwh: number
    neuester_monat: string
    aeltester_monat: string
  } | null
}

export interface PublicMonatsdaten {
  jahr: number
  monat: number
  pv_erzeugung_kwh: number
  direktverbrauch_kwh: number
  einspeisung_kwh: number
  netzbezug_kwh: number
  gesamtverbrauch_kwh: number
  autarkiegrad_prozent: number
  eigenverbrauchsquote_prozent: number
}

export interface SearchFilters {
  plz_prefix?: string
  ort?: string
  min_kwp?: number
  max_kwp?: number
  hat_speicher?: boolean
  hat_wallbox?: boolean
}

// ============================================
// COMMUNITY FUNCTIONS
// ============================================

/**
 * Liefert alle öffentlichen Anlagen
 * Nutzt Security Definer Function für korrekten RLS-Zugriff
 */
export async function getPublicAnlagen(): Promise<PublicAnlage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_public_anlagen')

  if (error) {
    console.error('Error fetching public anlagen:', error)
    return []
  }

  return data || []
}

/**
 * Liefert Community-Statistiken
 */
export async function getCommunityStats(): Promise<CommunityStats | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_community_stats')

  if (error) {
    console.error('Error fetching community stats:', error)
    return null
  }

  return data?.[0] || null
}

/**
 * Liefert detaillierte Informationen zu einer öffentlichen Anlage
 */
export async function getPublicAnlageDetails(
  anlageId: string
): Promise<PublicAnlageDetails | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_public_anlage_details', {
    p_anlage_id: anlageId,
  })

  if (error) {
    console.error('Error fetching public anlage details:', error)
    return null
  }

  return data?.[0] || null
}

/**
 * Liefert öffentliche Monatsdaten einer Anlage
 */
export async function getPublicMonatsdaten(
  anlageId: string
): Promise<PublicMonatsdaten[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_public_monatsdaten', {
    p_anlage_id: anlageId,
  })

  if (error) {
    console.error('Error fetching public monatsdaten:', error)
    return []
  }

  return data || []
}

/**
 * Sucht öffentliche Anlagen mit Filtern
 */
export async function searchPublicAnlagen(
  filters: SearchFilters = {}
): Promise<PublicAnlage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('search_public_anlagen', {
    p_plz_prefix: filters.plz_prefix || null,
    p_ort: filters.ort || null,
    p_min_kwp: filters.min_kwp || null,
    p_max_kwp: filters.max_kwp || null,
    p_hat_speicher: filters.hat_speicher ?? null,
    p_hat_wallbox: filters.hat_wallbox ?? null,
  })

  if (error) {
    console.error('Error searching public anlagen:', error)
    return []
  }

  return data || []
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Formatiert PLZ für Anzeige (mit Anonymisierung wenn nötig)
 */
export function formatPLZ(plz: string | null, genau: boolean): string {
  if (!plz) return 'k.A.'
  if (genau) return plz
  // Zeige nur erste 2 Ziffern + XXX
  return plz.substring(0, 2) + 'XXX'
}

/**
 * Berechnet Autarkiegrad aus Monatsdaten
 */
export function calculateAutarkiegrad(
  direktverbrauch: number,
  batterieentladung: number,
  gesamtverbrauch: number
): number {
  if (gesamtverbrauch === 0) return 0
  return Math.round(
    ((direktverbrauch + batterieentladung) / gesamtverbrauch) * 100
  )
}

/**
 * Berechnet Eigenverbrauchsquote aus Monatsdaten
 */
export function calculateEigenverbrauchsquote(
  direktverbrauch: number,
  pvErzeugung: number
): number {
  if (pvErzeugung === 0) return 0
  return Math.round((direktverbrauch / pvErzeugung) * 100)
}

/**
 * Formatiert Datum für Anzeige
 */
export function formatInstallationsdatum(datum: string): string {
  const date = new Date(datum)
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
  })
}

/**
 * Gruppiert Anlagen nach PLZ-Bereich (erste 2 Ziffern)
 */
export function groupByPLZBereich(
  anlagen: PublicAnlage[]
): Map<string, PublicAnlage[]> {
  const grouped = new Map<string, PublicAnlage[]>()

  anlagen.forEach((anlage) => {
    if (!anlage.standort_plz) return

    const bereich = anlage.standort_plz.substring(0, 2)
    if (!grouped.has(bereich)) {
      grouped.set(bereich, [])
    }
    grouped.get(bereich)!.push(anlage)
  })

  return grouped
}

/**
 * Berechnet Durchschnittswerte für eine Gruppe von Anlagen
 */
export function calculateGroupStats(anlagen: PublicAnlage[]): {
  anzahl: number
  durchschnitt_kwp: number
  gesamt_kwp: number
  prozent_mit_speicher: number
  prozent_mit_wallbox: number
} {
  if (anlagen.length === 0) {
    return {
      anzahl: 0,
      durchschnitt_kwp: 0,
      gesamt_kwp: 0,
      prozent_mit_speicher: 0,
      prozent_mit_wallbox: 0,
    }
  }

  const gesamt_kwp = anlagen.reduce((sum, a) => sum + a.leistung_kwp, 0)
  const anzahl_mit_speicher = anlagen.filter((a) => a.hat_speicher).length
  const anzahl_mit_wallbox = anlagen.filter((a) => a.hat_wallbox).length

  return {
    anzahl: anlagen.length,
    durchschnitt_kwp: Math.round((gesamt_kwp / anlagen.length) * 10) / 10,
    gesamt_kwp: Math.round(gesamt_kwp * 10) / 10,
    prozent_mit_speicher: Math.round(
      (anzahl_mit_speicher / anlagen.length) * 100
    ),
    prozent_mit_wallbox: Math.round(
      (anzahl_mit_wallbox / anlagen.length) * 100
    ),
  }
}
