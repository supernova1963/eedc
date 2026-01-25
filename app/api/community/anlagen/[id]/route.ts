// app/api/community/anlagen/[id]/route.ts
// API-Route für einzelne öffentliche Anlage

import { NextRequest, NextResponse } from 'next/server'
import { getPublicAnlage, getPublicKennzahlen, getPublicMonatsdaten } from '@/lib/community'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeKennzahlen = searchParams.get('kennzahlen') === 'true'
    const includeMonatsdaten = searchParams.get('monatsdaten') === 'true'
    const jahr = searchParams.get('jahr') ? parseInt(searchParams.get('jahr')!) : undefined

    const anlage = await getPublicAnlage(id)

    if (!anlage) {
      return NextResponse.json({
        success: false,
        message: 'Anlage nicht gefunden oder nicht öffentlich'
      }, { status: 404 })
    }

    const response: any = {
      success: true,
      data: anlage
    }

    // Optional: Kennzahlen hinzufügen
    if (includeKennzahlen && anlage.freigaben.kennzahlen_oeffentlich) {
      response.kennzahlen = await getPublicKennzahlen(id)
    }

    // Optional: Monatsdaten hinzufügen
    if (includeMonatsdaten && anlage.freigaben.monatsdaten_oeffentlich) {
      response.monatsdaten = await getPublicMonatsdaten(id, jahr)
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Public anlage API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
