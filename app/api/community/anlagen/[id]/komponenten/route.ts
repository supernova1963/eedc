// app/api/community/anlagen/[id]/komponenten/route.ts
// API-Route für öffentliche Komponenten einer Anlage

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
    const { data, error } = await supabase.rpc('get_public_komponenten', {
      p_anlage_id: id
    })

    if (error) {
      console.error('Error fetching public komponenten:', error)
      return NextResponse.json({
        success: false,
        message: 'Fehler beim Laden der Komponenten'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: any) {
    console.error('Public komponenten API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
