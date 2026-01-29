// lib/freigabe-actions.ts
'use server'

import { createClient } from './supabase-server'
import { revalidatePath } from 'next/cache'

export async function updateFreigaben(anlageId: string, formData: {
  profil_oeffentlich: boolean
  kennzahlen_oeffentlich: boolean
  auswertungen_oeffentlich: boolean
  investitionen_oeffentlich: boolean
  monatsdaten_oeffentlich: boolean
  standort_genau: boolean
}) {
  const supabase = await createClient()

  // FRESH-START: Update Freigaben-Spalten direkt in anlagen Tabelle
  const { error } = await supabase
    .from('anlagen')
    .update({
      oeffentlich: formData.profil_oeffentlich,
      kennzahlen_oeffentlich: formData.kennzahlen_oeffentlich,
      monatsdaten_oeffentlich: formData.monatsdaten_oeffentlich,
      komponenten_oeffentlich: formData.investitionen_oeffentlich, // Umbenannt: investitionen → komponenten
      standort_genau_anzeigen: formData.standort_genau
    })
    .eq('id', anlageId)

  if (error) {
    return { error: error.message }
  }

  // Revalidate the page
  revalidatePath('/anlage')

  return { success: true }
}
