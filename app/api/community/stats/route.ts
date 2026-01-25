// app/api/community/stats/route.ts
// API-Route für Community-Statistiken

import { NextResponse } from 'next/server'
import { getCommunityStats } from '@/lib/community'

export async function GET() {
  try {
    const stats = await getCommunityStats()

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error: any) {
    console.error('Community stats API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
