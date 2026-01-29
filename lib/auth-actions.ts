// lib/auth-actions.ts
// Server Actions für Authentication
'use server'

import { createClient } from './supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

// Admin Client mit Service Role für Operationen die RLS umgehen müssen
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/meine-anlage')
}

export async function signUp(formData: {
  email: string
  password: string
  vorname: string
  nachname: string
  plz?: string
  ort?: string
}) {
  const supabase = await createClient()

  // 1. Erstelle Auth User mit Metadaten (Trigger erstellt Mitglied automatisch)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        vorname: formData.vorname,
        nachname: formData.nachname,
      }
    }
  })

  if (authError) {
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Benutzer konnte nicht erstellt werden' }
  }

  // 2. Aktualisiere Mitglied mit zusätzlichen Daten (PLZ, Ort) via Admin Client
  const adminClient = createAdminClient()

  const { error: updateError } = await adminClient
    .from('mitglieder')
    .update({
      plz: formData.plz || null,
      ort: formData.ort || null,
    })
    .eq('auth_user_id', authData.user.id)

  if (updateError) {
    console.error('Fehler beim Aktualisieren der Mitgliedsdaten:', updateError)
    // Kein harter Fehler - Basisdaten wurden vom Trigger erstellt
  }

  redirect('/meine-anlage')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
