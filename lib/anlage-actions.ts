// lib/anlage-actions.ts
'use server'

import { createClient } from './supabase-server'
import { getCurrentUser } from './auth'
import { redirect } from 'next/navigation'

export async function createAnlage(formData: FormData) {
  console.log('🚀 createAnlage called')

  const user = await getCurrentUser()
  console.log('👤 User:', user)

  if (!user) {
    console.error('❌ Nicht authentifiziert')
    return { error: 'Nicht authentifiziert' }
  }

  const supabase = await createClient()

  // Daten aus FormData extrahieren
  const anlagenname = formData.get('anlagenname') as string
  const leistung_kwp = parseFloat(formData.get('leistung_kwp') as string)
  const installationsdatum = formData.get('installationsdatum') as string
  const standort_plz = formData.get('standort_plz') as string
  const standort_ort = formData.get('standort_ort') as string

  console.log('📝 FormData:', {
    anlagenname,
    leistung_kwp,
    installationsdatum,
    standort_plz,
    standort_ort,
  })

  // Validierung
  if (!anlagenname || !leistung_kwp || !installationsdatum) {
    console.error('❌ Validierung fehlgeschlagen')
    return { error: 'Bitte füllen Sie alle Pflichtfelder aus' }
  }

  // Anlage erstellen - nur Basis-Informationen
  // Komponenten wie Batteriespeicher werden separat als Investitionen erfasst
  const insertData: any = {
    mitglied_id: user.id,
    anlagenname,
    anlagentyp: 'Solar',
    leistung_kwp,
    installationsdatum,
    aktiv: true,
  }

  // Optionale Standort-Felder
  if (standort_plz) insertData.standort_plz = standort_plz
  if (standort_ort) insertData.standort_ort = standort_ort

  console.log('💾 Inserting anlage:', insertData)

  const { data: anlage, error: anlageError } = await supabase
    .from('anlagen')
    .insert(insertData)
    .select()
    .single()

  if (anlageError) {
    console.error('❌ Anlage creation error:', anlageError)
    return { error: 'Fehler beim Erstellen der Anlage: ' + anlageError.message }
  }

  console.log('✅ Anlage created:', anlage)

  // Standardmäßige Freigaben erstellen (alle deaktiviert)
  const { error: freigabenError } = await supabase
    .from('anlagen_freigaben')
    .insert({
      anlage_id: anlage.id,
      profil_oeffentlich: false,
      kennzahlen_oeffentlich: false,
      auswertungen_oeffentlich: false,
      investitionen_oeffentlich: false,
      monatsdaten_oeffentlich: false,
      standort_genau: false,
    })

  if (freigabenError) {
    console.error('Freigaben creation error:', freigabenError)
    // Nicht kritisch, weitermachen
  }

  console.log('✅ Success! Returning anlage ID:', anlage.id)
  return { success: true, anlageId: anlage.id }
}
