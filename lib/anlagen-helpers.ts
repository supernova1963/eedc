// lib/anlagen-helpers.ts
// Helper Functions für Multi-Anlage Support

import { createClient } from '@/lib/supabase-server'

/**
 * Holt alle Anlagen des aktuellen Users
 */
export async function getUserAnlagen() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  // Hole mitglied_id via auth_user_id
  const { data: mitglied } = await supabase
    .from('mitglieder')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!mitglied) {
    return { data: null, error: 'Mitglied not found' }
  }

  // Hole alle Anlagen des Mitglieds
  const { data, error } = await supabase
    .from('anlagen')
    .select('*')
    .eq('mitglied_id', mitglied.id)
    .eq('aktiv', true)
    .order('anlagenname')

  return { data, error }
}

/**
 * Holt eine spezifische Anlage (mit Ownership-Check via RLS)
 */
export async function getAnlageById(anlageId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('anlagen')
    .select('*')
    .eq('id', anlageId)
    .single()

  return { data, error }
}

/**
 * Holt die erste Anlage des Users (Fallback für Single-Anlage)
 */
export async function getFirstAnlage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data: mitglied } = await supabase
    .from('mitglieder')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!mitglied) {
    return { data: null, error: 'Mitglied not found' }
  }

  const { data, error } = await supabase
    .from('anlagen')
    .select('*')
    .eq('mitglied_id', mitglied.id)
    .eq('aktiv', true)
    .order('anlagenname')
    .limit(1)
    .single()

  return { data, error }
}

/**
 * Bestimmt welche Anlage angezeigt werden soll
 * - Priorisiert anlageId aus URL-Parameter
 * - Falls keine ID: Erste Anlage des Users
 */
export async function resolveAnlageId(requestedAnlageId?: string | null) {
  if (requestedAnlageId) {
    // Prüfe ob User Zugriff auf diese Anlage hat (via RLS)
    const { data, error } = await getAnlageById(requestedAnlageId)
    if (data && !error) {
      return { anlageId: data.id, anlage: data }
    }
  }

  // Fallback: Erste Anlage
  const { data } = await getFirstAnlage()
  return { anlageId: data?.id || null, anlage: data }
}

/**
 * Holt das aktuelle Mitglied (ersetzt getCurrentUser)
 */
export async function getCurrentMitglied() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  return { data, error }
}
