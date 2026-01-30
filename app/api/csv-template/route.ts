// app/api/csv-template/route.ts
// API-Route für CSV-Template-Generierung mit ALLEN möglichen Spalten
// Angepasst für FRESH-START Schema

import { NextRequest, NextResponse } from 'next/server'
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

    // 4. Alle Spalten generieren (nicht mehr personalisiert)
    const columns = generateAllColumns()

    // 5. CSV erstellen
    const csv = generateCSV(columns, anlage)

    // 6. Als Download zurückgeben
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

// Generiert ALLE möglichen Spalten - User füllt nur aus was er hat
function generateAllColumns(): Column[] {
  return [
    // === PFLICHTFELDER ===
    { name: 'Jahr', dbName: 'jahr', required: true, example: '2024' },
    { name: 'Monat', dbName: 'monat', required: true, example: '1', hint: '1-12' },

    // === ENERGIE-FLÜSSE (Kern-Daten) ===
    { name: 'PV-Erzeugung (kWh)', dbName: 'pv_erzeugung_kwh', required: true, example: '280', hint: 'Vom Wechselrichter erzeugt' },
    { name: 'Gesamtverbrauch (kWh)', dbName: 'gesamtverbrauch_kwh', required: true, example: '450', hint: 'Gesamter Haushalts-Stromverbrauch' },
    { name: 'Direktverbrauch (kWh)', dbName: 'direktverbrauch_kwh', required: true, example: '180', hint: 'PV direkt verbraucht (ohne Batterie)' },
    { name: 'Einspeisung (kWh)', dbName: 'einspeisung_kwh', required: true, example: '100', hint: 'Ins Netz eingespeist' },
    { name: 'Netzbezug (kWh)', dbName: 'netzbezug_kwh', required: true, example: '170', hint: 'Vom Netz bezogen' },

    // === BATTERIESPEICHER (optional - leer lassen wenn kein Speicher) ===
    { name: 'Batterieladung (kWh)', dbName: 'batterieladung_kwh', required: false, example: '60', hint: 'In Batterie geladen (leer wenn kein Speicher)' },
    { name: 'Batterieentladung (kWh)', dbName: 'batterieentladung_kwh', required: false, example: '50', hint: 'Aus Batterie entnommen (leer wenn kein Speicher)' },

    // === STROMPREISE (optional - leer = Stammdaten-Preise) ===
    { name: 'Netzbezugspreis (Cent/kWh)', dbName: 'netzbezug_preis_cent_kwh', required: false, example: '', hint: 'Leer = Stammdaten-Preis' },
    { name: 'Einspeisevergütung (Cent/kWh)', dbName: 'einspeisung_preis_cent_kwh', required: false, example: '', hint: 'Leer = Stammdaten-Preis' },

    // === FINANZEN (optional - werden aus kWh × Preis berechnet wenn leer) ===
    { name: 'Einspeise-Ertrag (€)', dbName: 'einspeisung_ertrag_euro', required: false, example: '', hint: 'Wird berechnet wenn leer' },
    { name: 'Netzbezug-Kosten (€)', dbName: 'netzbezug_kosten_euro', required: false, example: '', hint: 'Wird berechnet wenn leer' },
    { name: 'Betriebsausgaben (€)', dbName: 'betriebsausgaben_monat_euro', required: false, example: '', hint: 'Wartung, Versicherung etc.' },

    // === WETTER (optional) ===
    { name: 'Sonnenstunden', dbName: 'sonnenstunden', required: false, example: '180', hint: 'Sonnenstunden im Monat' },
    { name: 'Globalstrahlung (kWh/m²)', dbName: 'globalstrahlung_kwh_m2', required: false, example: '120', hint: 'Solare Einstrahlung' },

    // === META (optional) ===
    { name: 'Datenquelle', dbName: 'datenquelle', required: false, example: 'CSV-Import', hint: 'z.B. Wechselrichter-App, Zähler' },
    { name: 'Notizen', dbName: 'notizen', required: false, example: '', hint: 'Optionale Anmerkungen' },
  ]
}

function generateCSV(columns: Column[], anlage: any): string {
  // Header-Zeile
  const header = columns.map(c => c.name).join(',')

  // Beispiel-Zeile 1 (Januar - Winter: wenig PV, viel Netzbezug, Speicher aktiv)
  const example1 = columns.map(c => {
    switch (c.dbName) {
      case 'jahr': return '2024'
      case 'monat': return '1'
      case 'pv_erzeugung_kwh': return '120'
      case 'gesamtverbrauch_kwh': return '450'
      case 'direktverbrauch_kwh': return '80'
      case 'einspeisung_kwh': return '10'
      case 'netzbezug_kwh': return '340'
      case 'batterieladung_kwh': return '20'
      case 'batterieentladung_kwh': return '30'
      case 'sonnenstunden': return '45'
      case 'globalstrahlung_kwh_m2': return '25'
      case 'datenquelle': return 'CSV-Import'
      default: return ''
    }
  }).join(',')

  // Beispiel-Zeile 2 (Juli - Sommer: viel PV, wenig Netzbezug)
  const example2 = columns.map(c => {
    switch (c.dbName) {
      case 'jahr': return '2024'
      case 'monat': return '7'
      case 'pv_erzeugung_kwh': return '650'
      case 'gesamtverbrauch_kwh': return '380'
      case 'direktverbrauch_kwh': return '250'
      case 'einspeisung_kwh': return '320'
      case 'netzbezug_kwh': return '50'
      case 'batterieladung_kwh': return '60'
      case 'batterieentladung_kwh': return '80'
      case 'sonnenstunden': return '260'
      case 'globalstrahlung_kwh_m2': return '180'
      case 'datenquelle': return 'CSV-Import'
      default: return ''
    }
  }).join(',')

  // Leere Zeilen für eigene Daten
  const empty = columns.map(() => '').join(',')

  // Kommentar-Zeilen mit Hinweisen
  const comments = [
    `# CSV-Vorlage für ${anlage.anlagenname} (${anlage.leistung_kwp} kWp)`,
    '#',
    '# PFLICHTFELDER: Jahr, Monat, PV-Erzeugung, Gesamtverbrauch, Direktverbrauch, Einspeisung, Netzbezug',
    '# OPTIONAL: Alle anderen Spalten - einfach leer lassen wenn nicht relevant',
    '#',
    '# HINWEISE:',
    '# - Batterieladung/-entladung: Nur ausfüllen wenn Speicher vorhanden',
    '# - Strompreise: Leer lassen = Stammdaten-Preise werden verwendet',
    '# - Euro-Beträge: Werden automatisch berechnet wenn leer (kWh × Preis)',
    '# - Die beiden Beispielzeilen können gelöscht oder überschrieben werden',
    '#',
  ]

  // UTF-8 BOM für Excel-Kompatibilität
  const bom = '\uFEFF'

  return bom + [
    ...comments,
    header,
    example1,
    example2,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty  // 12 leere Zeilen für ein Jahr
  ].join('\n')
}
