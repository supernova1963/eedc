// app/api/community/anlagen/route.ts
// API-Route für öffentliche Anlagen-Liste

import { NextRequest, NextResponse } from 'next/server'
import { getPublicAnlagen, searchPublicAnlagen, type SearchFilters } from '@/lib/community'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Wenn keine Filter angegeben sind, alle öffentlichen Anlagen zurückgeben
    const hasFilters = searchParams.has('ort') || searchParams.has('plz_prefix') ||
                       searchParams.has('min_kwp') || searchParams.has('max_kwp') ||
                       searchParams.has('hat_speicher') || searchParams.has('hat_wallbox')

    let anlagen
    if (hasFilters) {
      // Filter aus Query-Parametern
      const filters: SearchFilters = {
        ort: searchParams.get('ort') || undefined,
        plz_prefix: searchParams.get('plz_prefix') || undefined,
        min_kwp: searchParams.get('min_kwp') ? parseFloat(searchParams.get('min_kwp')!) : undefined,
        max_kwp: searchParams.get('max_kwp') ? parseFloat(searchParams.get('max_kwp')!) : undefined,
        hat_speicher: searchParams.get('hat_speicher') === 'true' ? true : undefined,
        hat_wallbox: searchParams.get('hat_wallbox') === 'true' ? true : undefined,
      }
      anlagen = await searchPublicAnlagen(filters)
    } else {
      anlagen = await getPublicAnlagen()
    }

    return NextResponse.json({
      success: true,
      data: anlagen,
      count: anlagen.length
    })
  } catch (error: any) {
    console.error('Public anlagen API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
