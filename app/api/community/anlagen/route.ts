// app/api/community/anlagen/route.ts
// API-Route für öffentliche Anlagen-Liste

import { NextRequest, NextResponse } from 'next/server'
import { getPublicAnlagen } from '@/lib/community'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Filter aus Query-Parametern
    const filters = {
      ort: searchParams.get('ort') || undefined,
      plz: searchParams.get('plz') || undefined,
      minLeistung: searchParams.get('minLeistung') ? parseFloat(searchParams.get('minLeistung')!) : undefined,
      maxLeistung: searchParams.get('maxLeistung') ? parseFloat(searchParams.get('maxLeistung')!) : undefined,
      hatBatterie: searchParams.get('hatBatterie') === 'true' ? true : undefined,
      hatEAuto: searchParams.get('hatEAuto') === 'true' ? true : undefined,
      hatWaermepumpe: searchParams.get('hatWaermepumpe') === 'true' ? true : undefined,
    }

    const anlagen = await getPublicAnlagen(filters)

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
