// lib/auth-actions.ts
// Server Actions für Authentication
'use server'

import { createClient } from './supabase-server'
import { redirect } from 'next/navigation'

export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/')
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

  // 1. Erstelle Auth User
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  })

  if (authError) {
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Benutzer konnte nicht erstellt werden' }
  }

  // 2. Erstelle Mitglied in der Datenbank
  const insertData = {
    email: formData.email,
    vorname: formData.vorname,
    nachname: formData.nachname,
    plz: formData.plz || null,
    ort: formData.ort || null,
    aktiv: true,
  }

  // Verwende UPSERT statt INSERT um Race Conditions zu vermeiden
  const { error: mitgliedError } = await supabase
    .from('mitglieder')
    .upsert(insertData, {
      onConflict: 'email',
      ignoreDuplicates: false
    })
    .select()

  if (mitgliedError) {
    return { error: `Mitgliedsdaten konnten nicht gespeichert werden: ${mitgliedError.message}` }
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
