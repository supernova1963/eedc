// app/api/community/anlagen/[id]/monatsdaten/route.ts
// API-Route für öffentliche Monatsdaten einer Anlage

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Rufe die RPC-Funktion auf
    const { data, error } = await supabase.rpc('get_public_monatsdaten', {
      p_anlage_id: id
    })

    if (error) {
      console.error('Error fetching public monatsdaten:', error)
      return NextResponse.json({
        success: false,
        message: 'Fehler beim Laden der Monatsdaten'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: any) {
    console.error('Public monatsdaten API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
