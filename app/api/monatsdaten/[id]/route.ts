// app/api/monatsdaten/[id]/route.ts
// API für Monatsdaten Update und Delete

import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// Erlaubte Felder für Update
const ALLOWED_FIELDS = [
  'pv_erzeugung_kwh',
  'direktverbrauch_kwh',
  'batterieladung_kwh',
  'batterieentladung_kwh',
  'einspeisung_kwh',
  'netzbezug_kwh',
  'gesamtverbrauch_kwh',
  'einspeisung_ertrag_euro',
  'netzbezug_kosten_euro',
  'betriebsausgaben_monat_euro',
  'netzbezug_preis_cent_kwh',
  'einspeisung_preis_cent_kwh',
  'sonnenstunden',
  'globalstrahlung_kwh_m2',
  'notizen',
  'datenquelle',
]

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Auth prüfen
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Hole Monatsdaten mit Anlage und Mitglied in einem JOIN
    // Das umgeht RLS-Probleme bei separaten Abfragen
    const { data: monatsdaten, error: mdError } = await supabase
      .from('monatsdaten')
      .select(`
        id,
        anlage_id,
        anlagen!inner (
          id,
          mitglied_id,
          mitglieder!inner (
            id,
            user_id
          )
        )
      `)
      .eq('id', id)
      .single()

    if (mdError || !monatsdaten) {
      console.error('Monatsdaten lookup error:', mdError)
      return NextResponse.json({ success: false, error: 'Monatsdaten nicht gefunden' }, { status: 404 })
    }

    // Berechtigung prüfen - über den JOIN haben wir direkten Zugriff
    const anlage = monatsdaten.anlagen as any
    const mitglied = anlage?.mitglieder as any

    if (!mitglied || mitglied.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Keine Berechtigung' }, { status: 403 })
    }

    // Update-Daten filtern
    const body = await request.json()
    const updateData: Record<string, any> = {
      aktualisiert_am: new Date().toISOString()
    }

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    // Update durchführen
    const { data: updated, error: updateError } = await supabase
      .from('monatsdaten')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: updated })

  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Auth prüfen
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Hole Monatsdaten mit Anlage und Mitglied in einem JOIN
    // Das umgeht RLS-Probleme bei separaten Abfragen
    const { data: monatsdaten, error: mdError } = await supabase
      .from('monatsdaten')
      .select(`
        id,
        anlage_id,
        anlagen!inner (
          id,
          mitglied_id,
          mitglieder!inner (
            id,
            user_id
          )
        )
      `)
      .eq('id', id)
      .single()

    if (mdError || !monatsdaten) {
      console.error('Monatsdaten lookup error:', mdError)
      return NextResponse.json({ success: false, error: 'Monatsdaten nicht gefunden' }, { status: 404 })
    }

    // Berechtigung prüfen - über den JOIN haben wir direkten Zugriff
    const anlage = monatsdaten.anlagen as any
    const mitglied = anlage?.mitglieder as any

    if (!mitglied || mitglied.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Keine Berechtigung' }, { status: 403 })
    }

    // Löschen
    const { error: deleteError } = await supabase
      .from('monatsdaten')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
