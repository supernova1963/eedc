// app/api/auth/user/route.ts
import { NextResponse } from 'next/server'
import { getCurrentMitglied } from '@/lib/anlagen-helpers'

export async function GET() {
  try {
    const mitglied = await getCurrentMitglied()

    if (!mitglied.data) {
      return NextResponse.json({
        success: false,
        message: 'Nicht authentifiziert'
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: mitglied.data.id,
        email: mitglied.data.email,
        vorname: mitglied.data.vorname,
        nachname: mitglied.data.nachname,
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
