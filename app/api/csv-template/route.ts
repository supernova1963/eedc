// app/api/csv-template/route.ts
// API-Route für dynamische CSV-Template-Generierung
// Angepasst für FRESH-START Schema

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

    // 4. Prüfen welche Investitionen vorhanden sind (via alternative_investitionen)
    const supabase = await createClient()

    // Speicher prüfen (der Anlage zugeordnet)
    const { data: speicher } = await supabase
      .from('alternative_investitionen')
      .select('id')
      .eq('anlage_id', anlageId)
      .eq('typ', 'speicher')
      .eq('aktiv', true)
      .limit(1)
    const hatSpeicher = !!(speicher && speicher.length > 0)

    // E-Auto prüfen (Mitglied-Ebene, da Haushalt-Komponente)
    const { data: eAuto } = await supabase
      .from('alternative_investitionen')
      .select('id')
      .eq('mitglied_id', mitglied.data.id)
      .eq('typ', 'e-auto')
      .eq('aktiv', true)
      .limit(1)
    const hatEAuto = !!(eAuto && eAuto.length > 0)

    // Wärmepumpe prüfen (Mitglied-Ebene, da Haushalt-Komponente)
    const { data: waermepumpe } = await supabase
      .from('alternative_investitionen')
      .select('id')
      .eq('mitglied_id', mitglied.data.id)
      .eq('typ', 'waermepumpe')
      .eq('aktiv', true)
      .limit(1)
    const hatWaermepumpe = !!(waermepumpe && waermepumpe.length > 0)

    // 5. Spalten basierend auf Anlage generieren
    const columns = generateColumns(hatSpeicher, hatEAuto, hatWaermepumpe)

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
  dbName: string  // Datenbank-Spaltenname für Mapping
  required: boolean
  example?: string
  hint?: string
}

function generateColumns(hatSpeicher: boolean, hatEAuto: boolean, hatWaermepumpe: boolean): Column[] {
  const columns: Column[] = [
    // Pflichtfelder
    { name: 'Jahr', dbName: 'jahr', required: true, example: '2024' },
    { name: 'Monat', dbName: 'monat', required: true, example: '1' },

    // Energie-Flüsse (kWh) - Pflicht für sinnvolle Auswertung
    { name: 'Gesamtverbrauch (kWh)', dbName: 'gesamtverbrauch_kwh', required: true, example: '450', hint: 'Gesamter Haushalts-Stromverbrauch' },
    { name: 'PV-Erzeugung (kWh)', dbName: 'pv_erzeugung_kwh', required: true, example: '280', hint: 'Vom Wechselrichter erzeugt' },
    { name: 'Direktverbrauch (kWh)', dbName: 'direktverbrauch_kwh', required: true, example: '180', hint: 'PV direkt verbraucht (ohne Batterie)' },
    { name: 'Einspeisung (kWh)', dbName: 'einspeisung_kwh', required: true, example: '100', hint: 'Ins Netz eingespeist' },
    { name: 'Netzbezug (kWh)', dbName: 'netzbezug_kwh', required: true, example: '170', hint: 'Vom Netz bezogen' },
  ]

  // Batteriespeicher (nur wenn vorhanden)
  if (hatSpeicher) {
    columns.push(
      { name: 'Batterieentladung (kWh)', dbName: 'batterieentladung_kwh', required: false, example: '50', hint: 'Aus Batterie entnommen' },
      { name: 'Batterieladung (kWh)', dbName: 'batterieladung_kwh', required: false, example: '60', hint: 'In Batterie geladen' }
    )
  }

  // E-Auto (nur wenn vorhanden)
  if (hatEAuto) {
    columns.push(
      { name: 'E-Auto Ladung (kWh)', dbName: 'ekfz_ladung_kwh', required: false, example: '120', hint: 'Gesamte E-Auto Ladung (PV + Netz)' },
      { name: 'E-Auto km gefahren', dbName: 'ekfz_km', required: false, example: '800', hint: 'Gefahrene Kilometer im Monat' }
    )
  }

  // Wärmepumpe (nur wenn vorhanden)
  if (hatWaermepumpe) {
    columns.push(
      { name: 'Wärmepumpe (kWh)', dbName: 'waermepumpe_kwh', required: false, example: '350', hint: 'Stromverbrauch Wärmepumpe' },
      { name: 'Heizwärme (kWh)', dbName: 'heizwaerme_kwh', required: false, example: '1200', hint: 'Erzeugte Heizwärme' }
    )
  }

  // Strompreise (optional - für dynamische Tarife)
  // Wenn leer, werden Stammdaten-Preise verwendet
  columns.push(
    { name: 'Netzbezugspreis (Cent/kWh)', dbName: 'netzbezug_preis_cent_kwh', required: false, example: '', hint: 'Leer = Stammdaten-Preis' },
    { name: 'Einspeisevergütung (Cent/kWh)', dbName: 'einspeisung_preis_cent_kwh', required: false, example: '', hint: 'Leer = Stammdaten-Preis' },
  )

  // Sonstiges
  columns.push(
    { name: 'Betriebsausgaben (€)', dbName: 'betriebsausgaben_monat_euro', required: false, example: '', hint: 'Wartung, Versicherung etc.' },
    { name: 'Notizen', dbName: 'notizen', required: false, example: '', hint: 'Optionale Anmerkungen' }
  )

  return columns
}

function generateCSV(columns: Column[], anlage: any): string {
  // Header-Zeile
  const header = columns.map(c => c.name).join(',')

  // Beispiel-Zeile 1 (Januar - wenig PV, mehr Netzbezug)
  const example1 = columns.map(c => {
    if (c.name === 'Jahr') return '2024'
    if (c.name === 'Monat') return '1'
    if (c.name === 'Gesamtverbrauch (kWh)') return '450'
    if (c.name === 'PV-Erzeugung (kWh)') return '120'
    if (c.name === 'Direktverbrauch (kWh)') return '80'
    if (c.name === 'Einspeisung (kWh)') return '40'
    if (c.name === 'Netzbezug (kWh)') return '370'
    if (c.name === 'Batterieentladung (kWh)') return '30'
    if (c.name === 'Batterieladung (kWh)') return '35'
    if (c.name === 'E-Auto Ladung (kWh)') return '100'
    if (c.name === 'E-Auto km gefahren') return '650'
    if (c.name === 'Wärmepumpe (kWh)') return '450'
    if (c.name === 'Heizwärme (kWh)') return '1600'
    // Strompreise leer = Stammdaten werden verwendet
    return ''
  }).join(',')

  // Beispiel-Zeile 2 (Juli - viel PV, wenig Heizung)
  const example2 = columns.map(c => {
    if (c.name === 'Jahr') return '2024'
    if (c.name === 'Monat') return '7'
    if (c.name === 'Gesamtverbrauch (kWh)') return '380'
    if (c.name === 'PV-Erzeugung (kWh)') return '650'
    if (c.name === 'Direktverbrauch (kWh)') return '280'
    if (c.name === 'Einspeisung (kWh)') return '320'
    if (c.name === 'Netzbezug (kWh)') return '100'
    if (c.name === 'Batterieentladung (kWh)') return '80'
    if (c.name === 'Batterieladung (kWh)') return '130'
    if (c.name === 'E-Auto Ladung (kWh)') return '150'
    if (c.name === 'E-Auto km gefahren') return '950'
    if (c.name === 'Wärmepumpe (kWh)') return '80'
    if (c.name === 'Heizwärme (kWh)') return '250'
    return ''
  }).join(',')

  // Leere Zeile für eigene Daten
  const empty = columns.map(() => '').join(',')

  // Kommentar-Zeilen
  const comment1 = `# CSV-Vorlage für ${anlage.anlagenname} (${anlage.leistung_kwp} kWp)`
  const comment2 = '# Strompreise: Leer lassen um Stammdaten-Preise zu verwenden'
  const comment3 = '# Euro-Beträge werden automatisch aus kWh × Strompreis berechnet'

  // UTF-8 BOM für Excel-Kompatibilität
  const bom = '\uFEFF'

  return bom + [
    comment1,
    comment2,
    comment3,
    header,
    example1,
    example2,
    empty,
    empty,
    empty
  ].join('\n')
}
