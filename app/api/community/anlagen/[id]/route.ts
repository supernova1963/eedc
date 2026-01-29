// app/api/community/anlagen/[id]/route.ts
// API-Route für einzelne öffentliche Anlage

import { NextRequest, NextResponse } from 'next/server'
import { getPublicAnlageDetails, getPublicMonatsdaten } from '@/lib/community'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // getPublicAnlageDetails enthält bereits alle Details inkl. Komponenten und Monatsdaten-Summary
    const anlage = await getPublicAnlageDetails(id)

    if (!anlage) {
      return NextResponse.json({
        success: false,
        message: 'Anlage nicht gefunden oder nicht öffentlich'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: anlage
    })
  } catch (error: any) {
    console.error('Public anlage API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
