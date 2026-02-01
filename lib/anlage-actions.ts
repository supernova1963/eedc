// lib/anlage-actions.ts
'use server'

import { createClient } from './supabase-server'
import { getCurrentMitglied } from './anlagen-helpers'
import { redirect } from 'next/navigation'

export async function createAnlage(formData: FormData) {
  console.log('🚀 createAnlage called')

  const mitglied = await getCurrentMitglied()
  console.log('👤 Mitglied:', mitglied.data)

  if (!mitglied.data) {
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
  const anschaffungskosten_euro_str = formData.get('anschaffungskosten_euro') as string
  const einspeiseverguetung_cent_kwh_str = formData.get('einspeiseverguetung_cent_kwh') as string

  const anschaffungskosten_euro = anschaffungskosten_euro_str ? parseFloat(anschaffungskosten_euro_str) : null
  const einspeiseverguetung_cent_kwh = einspeiseverguetung_cent_kwh_str ? parseFloat(einspeiseverguetung_cent_kwh_str) : null

  console.log('📝 FormData:', {
    anlagenname,
    leistung_kwp,
    installationsdatum,
    standort_plz,
    standort_ort,
    anschaffungskosten_euro,
    einspeiseverguetung_cent_kwh,
  })

  // Validierung
  if (!anlagenname || !leistung_kwp || !installationsdatum) {
    console.error('❌ Validierung fehlgeschlagen')
    return { error: 'Bitte füllen Sie alle Pflichtfelder aus' }
  }

  // Anlage erstellen - nur Basis-Informationen
  // Komponenten wie Batteriespeicher werden separat als Investitionen erfasst
  // FRESH-START: Freigaben-Spalten direkt in anlagen Tabelle (Defaults aus Schema)
  const insertData: any = {
    mitglied_id: mitglied.data.id,
    anlagenname,
    anlagentyp: 'Solar',
    leistung_kwp,
    installationsdatum,
    aktiv: true,
    // Freigaben mit Defaults (werden vom Schema gesetzt, aber explizit hier für Klarheit)
    oeffentlich: false,
    standort_genau_anzeigen: false,
    kennzahlen_oeffentlich: false,
    monatsdaten_oeffentlich: false,
    komponenten_oeffentlich: false,
  }

  // Optionale Felder
  if (standort_plz) insertData.standort_plz = standort_plz
  if (standort_ort) insertData.standort_ort = standort_ort
  if (anschaffungskosten_euro) insertData.anschaffungskosten_euro = anschaffungskosten_euro
  if (einspeiseverguetung_cent_kwh) insertData.einspeiseverguetung_cent_kwh = einspeiseverguetung_cent_kwh

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

  console.log('✅ Success! Returning anlage ID:', anlage.id)
  return { success: true, anlageId: anlage.id }
}
