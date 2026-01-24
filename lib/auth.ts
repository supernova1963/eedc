// lib/auth.ts
// Authentication Helper Functions

import { supabase } from './supabase'

export interface AuthUser {
  id: string
  email: string
}

export interface Mitglied {
  id: string
  email: string
  vorname: string
  nachname: string
  aktiv: boolean
}

/**
 * Holt den aktuell authentifizierten User
 * Vereinfacht: Nimmt erstes aktives Mitglied aus DB
 * TODO: Echte Supabase Auth implementieren
 */
export async function getCurrentUser(): Promise<Mitglied | null> {
  const { data, error } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('aktiv', true)
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Prüft ob User Zugriff auf eine Anlage hat
 */
export async function hasAnlageAccess(userId: string, anlageId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('anlagen')
    .select('mitglied_id')
    .eq('id', anlageId)
    .eq('mitglied_id', userId)
    .single()

  return !error && data !== null
}

/**
 * Holt alle Anlagen eines Users
 */
export async function getUserAnlagen(userId: string) {
  const { data, error } = await supabase
    .from('anlagen')
    .select('*')
    .eq('mitglied_id', userId)
    .eq('aktiv', true)
    .order('erstellt_am', { ascending: false })

  if (error) {
    return []
  }

  return data || []
}
