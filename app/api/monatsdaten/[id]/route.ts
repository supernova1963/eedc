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

    // Update durchführen - RLS prüft die Berechtigung
    const { data: updated, error: updateError } = await supabase
      .from('monatsdaten')
      .update(updateData)
      .eq('id', id)
      .select()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // Prüfen ob etwas aktualisiert wurde
    if (!updated || updated.length === 0) {
      return NextResponse.json({ success: false, error: 'Monatsdaten nicht gefunden oder keine Berechtigung' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated[0] })

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

    // Erst prüfen ob Monatsdaten existieren und Zugriff möglich ist
    const { data: existing, error: selectError } = await supabase
      .from('monatsdaten')
      .select('id')
      .eq('id', id)
      .single()

    if (selectError || !existing) {
      return NextResponse.json({ success: false, error: 'Monatsdaten nicht gefunden oder keine Berechtigung' }, { status: 404 })
    }

    // Löschen - RLS prüft die Berechtigung
    const { error: deleteError } = await supabase
      .from('monatsdaten')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
