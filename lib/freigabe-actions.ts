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

  // UPSERT mit onConflict
  const { error } = await supabase
    .from('anlagen_freigaben')
    .upsert({
      anlage_id: anlageId,
      ...formData
    }, {
      onConflict: 'anlage_id'
    })

  if (error) {
    return { error: error.message }
  }

  // Revalidate the page
  revalidatePath('/anlage')

  return { success: true }
}
