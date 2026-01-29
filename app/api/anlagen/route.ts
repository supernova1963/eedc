// app/api/anlagen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied } from '@/lib/anlagen-helpers'

export async function POST(request: NextRequest) {
  try {
    // Authentifizierung prüfen
    const mitglied = await getCurrentMitglied()
    if (!mitglied.data) {
      return NextResponse.json({
        success: false,
        message: 'Nicht authentifiziert'
      }, { status: 401 })
    }

    const supabase = await createClient()
    const anlageData = await request.json()

    // Sicherstellen, dass mitglied_id dem aktuellen Mitglied entspricht
    if (anlageData.mitglied_id !== mitglied.data.id) {
      return NextResponse.json({
        success: false,
        message: 'Keine Berechtigung'
      }, { status: 403 })
    }

    // FRESH-START: Freigaben-Spalten direkt in anlageData setzen (falls nicht vorhanden)
    const insertData = {
      ...anlageData,
      // Defaults für Freigaben (falls nicht im Request)
      oeffentlich: anlageData.oeffentlich ?? false,
      standort_genau_anzeigen: anlageData.standort_genau_anzeigen ?? false,
      kennzahlen_oeffentlich: anlageData.kennzahlen_oeffentlich ?? false,
      monatsdaten_oeffentlich: anlageData.monatsdaten_oeffentlich ?? false,
      komponenten_oeffentlich: anlageData.komponenten_oeffentlich ?? false,
    }

    // Anlage erstellen
    const { data: anlage, error: anlageError } = await supabase
      .from('anlagen')
      .insert(insertData)
      .select()
      .single()

    if (anlageError) {
      console.error('Anlage creation error:', anlageError)
      return NextResponse.json({
        success: false,
        message: 'Fehler beim Erstellen der Anlage: ' + anlageError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: anlage
    })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
