// lib/auth.ts
// Authentication Helper Functions

import { createClient } from './supabase-server'

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
 * Holt den aktuell authentifizierten User und dessen Mitgliedsdaten
 * Verwendet echte Supabase Auth mit Session-Management
 */
export async function getCurrentUser(): Promise<Mitglied | null> {
  const supabase = await createClient()

  // Hole aktuelle Auth Session
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  // Hole Mitgliedsdaten basierend auf Auth User Email
  const { data, error } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('email', user.email)
    .eq('aktiv', true)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Holt nur die Auth Session (ohne Mitgliedsdaten)
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user || !user.email) {
    return null
  }

  return {
    id: user.id,
    email: user.email
  }
}

/**
 * Prüft ob User Zugriff auf eine Anlage hat
 */
export async function hasAnlageAccess(userId: string, anlageId: string): Promise<boolean> {
  const supabase = await createClient()

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
  const supabase = await createClient()

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
