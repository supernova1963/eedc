// app/api/csv-template/route.ts
// API-Route für dynamische CSV-Template-Generierung

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getAnlageById } from '@/lib/anlagen-helpers'

export async function GET(request: NextRequest) {
  try {
    // 1. Authentifizierung
    const mitglied = await getCurrentMitglied()
    if (!mitglied.data) {
      return new NextResponse('Nicht authentifiziert', { status: 401 })
    }

    // 2. Anlagen-ID aus Query-Parameter
    const { searchParams } = new URL(request.url)
    const anlageId = searchParams.get('anlageId')

    if (!anlageId) {
      return new NextResponse('Anlagen-ID fehlt', { status: 400 })
    }

    // 3. Zugriffsberechtigung prüfen (via RLS)
    const { data: anlage } = await getAnlageById(anlageId)
    if (!anlage) {
      return new NextResponse('Keine Berechtigung', { status: 403 })
    }

    // 5. Spalten basierend auf Anlage generieren
    const columns = generateColumns(anlage)

    // 6. CSV erstellen
    const csv = generateCSV(columns, anlage)

    // 7. Als Download zurückgeben
    const filename = `monatsdaten_${anlage.anlagenname.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error: any) {
    console.error('Template generation error:', error)
    return new NextResponse('Serverfehler: ' + error.message, { status: 500 })
  }
}

interface Column {
  name: string
  required: boolean
  example?: string
}

function generateColumns(anlage: any): Column[] {
  const columns: Column[] = [
    // Pflichtfelder
    { name: 'Jahr', required: true, example: '2024' },
    { name: 'Monat', required: true, example: '1' },

    // Basis-Energiedaten (immer)
    { name: 'Gesamtverbrauch (kWh)', required: false, example: '450.5' },
    { name: 'PV-Erzeugung (kWh)', required: false, example: '280.3' },
    { name: 'Direktverbrauch (kWh)', required: false, example: '180.2' },
    { name: 'Netzbezug (kWh)', required: false, example: '250.2' },
    { name: 'Einspeisung (kWh)', required: false, example: '100.1' },
  ]

  // Batteriespeicher
  if (anlage.batteriekapazitaet_kwh && anlage.batteriekapazitaet_kwh > 0) {
    columns.push(
      { name: 'Batterieentladung (kWh)', required: false, example: '120.1' },
      { name: 'Batterieladung (kWh)', required: false, example: '150.4' }
    )
  }

  // E-Fahrzeug
  if (anlage.ekfz_vorhanden) {
    columns.push(
      { name: 'E-Auto Ladung (kWh)', required: false, example: '50.0' }
    )
  }

  // Finanz-Daten
  columns.push(
    { name: 'Netzbezug Kosten (€)', required: false, example: '' },
    { name: 'Einspeisung Ertrag (€)', required: false, example: '' },
    { name: 'Grundpreis (€)', required: false, example: '8.50' },
    { name: 'Netzbezugspreis (Cent/kWh)', required: false, example: '30.2' },
    { name: 'Einspeisevergütung (Cent/kWh)', required: false, example: '12.05' },
    { name: 'Betriebsausgaben (€)', required: false, example: '15.00' },
    { name: 'Notizen', required: false, example: 'Optionale Anmerkungen' }
  )

  return columns
}

function generateCSV(columns: Column[], anlage: any): string {
  // Header-Zeile
  const header = columns.map(c => c.name).join(',')

  // Beispiel-Zeile 1 (mit Auto-Berechnung)
  const example1 = columns.map(c => {
    if (c.name === 'Jahr') return '2024'
    if (c.name === 'Monat') return '1'
    if (c.name === 'Netzbezug Kosten (€)') return '' // Wird berechnet
    if (c.name === 'Einspeisung Ertrag (€)') return '' // Wird berechnet
    return c.example || ''
  }).join(',')

  // Beispiel-Zeile 2 (manuell)
  const example2 = columns.map(c => {
    if (c.name === 'Jahr') return '2024'
    if (c.name === 'Monat') return '2'
    if (c.name === 'Gesamtverbrauch (kWh)') return '420.8'
    if (c.name === 'PV-Erzeugung (kWh)') return '310.5'
    if (c.name === 'Direktverbrauch (kWh)') return '200.3'
    if (c.name === 'Batterieentladung (kWh)') return '110.5'
    if (c.name === 'Batterieladung (kWh)') return '140.2'
    if (c.name === 'Netzbezug (kWh)') return '220.0'
    if (c.name === 'Einspeisung (kWh)') return '110.2'
    if (c.name === 'E-Auto Ladung (kWh)') return '45.0'
    if (c.name === 'Netzbezug Kosten (€)') return '66.00'
    if (c.name === 'Einspeisung Ertrag (€)') return '13.22'
    if (c.name === 'Grundpreis (€)') return '8.50'
    if (c.name === 'Netzbezugspreis (Cent/kWh)') return '30.0'
    if (c.name === 'Einspeisevergütung (Cent/kWh)') return '12.0'
    if (c.name === 'Betriebsausgaben (€)') return '15.00'
    if (c.name === 'Notizen') return 'Manuelle Eingabe'
    return ''
  }).join(',')

  // Leere Zeile
  const empty = columns.map(() => '').join(',')

  // Kommentar-Zeile (als CSV-Zeile mit Hinweis in erster Spalte)
  const comment1 = columns.map((c, i) => {
    if (i === 0) return '# Beispieldaten für ' + anlage.anlagenname
    return ''
  }).join(',')

  const comment2 = columns.map((c, i) => {
    if (i === 0) return '# Kosten/Erlöse werden automatisch berechnet wenn leer'
    return ''
  }).join(',')

  // UTF-8 BOM für Excel-Kompatibilität
  const bom = '\uFEFF'

  return bom + [
    comment1,
    comment2,
    header,
    example1,
    example2,
    empty
  ].join('\n')
}
