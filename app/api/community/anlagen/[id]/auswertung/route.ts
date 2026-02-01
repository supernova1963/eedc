// app/api/community/anlagen/[id]/auswertung/route.ts
// API-Route für öffentliche Auswertungsdaten einer Anlage

import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Hole Auswertungsdaten via RPC
    const { data: auswertung, error: auswertungError } = await supabase
      .rpc('get_public_auswertung', { p_anlage_id: id })
      .single()

    if (auswertungError) {
      console.error('Auswertung Fehler:', auswertungError)
      return NextResponse.json({
        success: false,
        message: 'Auswertungsdaten nicht verfügbar'
      }, { status: 404 })
    }

    if (!auswertung) {
      return NextResponse.json({
        success: false,
        message: 'Anlage nicht gefunden oder Kennzahlen nicht freigegeben'
      }, { status: 404 })
    }

    // Hole Jahresvergleich
    const { data: jahresvergleich } = await supabase
      .rpc('get_public_jahresvergleich', { p_anlage_id: id })

    return NextResponse.json({
      success: true,
      data: {
        ...auswertung,
        jahresvergleich: jahresvergleich || []
      }
    })

  } catch (error) {
    console.error('Community Auswertung API Fehler:', error)
    return NextResponse.json({
      success: false,
      message: 'Interner Fehler'
    }, { status: 500 })
  }
}
