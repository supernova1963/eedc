// app/api/csv-template/route.ts
// API-Route für personalisierte CSV-Template-Generierung
// Neues Konzept: Nur Rohdaten erfassen, Summen werden automatisch berechnet

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getAnlageById } from '@/lib/anlagen-helpers'

interface Investition {
  id: string
  typ: string
  bezeichnung: string
  parameter?: any
}

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

    // 4. Investitionen des Mitglieds laden
    const supabase = await createClient()
    const { data: investitionen } = await supabase
      .from('investitionen')
      .select('id, typ, bezeichnung, parameter')
      .eq('mitglied_id', mitglied.data.id)
      .eq('aktiv', true)
      .order('typ')
      .order('bezeichnung')

    // 5. Spalten generieren (Basis + Investitionen)
    const columns = generateAllColumns(investitionen || [])

    // 6. CSV erstellen
    const csv = generateCSV(columns, anlage, investitionen || [])

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
  // Für Investitions-Spalten:
  investitionId?: string
  investitionTyp?: string
  jsonField?: string  // Feld in verbrauch_daten JSON
}

// Generiert alle Spalten: Nur Rohdaten + personalisierte Investitions-Spalten
function generateAllColumns(investitionen: Investition[]): Column[] {
  const columns: Column[] = [
    // === PFLICHTFELDER ===
    { name: 'Jahr', dbName: 'jahr', required: true, example: '2024' },
    { name: 'Monat', dbName: 'monat', required: true, example: '1', hint: '1-12' },

    // === ZÄHLERSTÄNDE (Eingabe vom Zweirichtungszähler) ===
    { name: 'Einspeisung (kWh)', dbName: 'einspeisung_kwh', required: true, example: '100', hint: 'Ins Netz eingespeist (Zähler)' },
    { name: 'Netzbezug (kWh)', dbName: 'netzbezug_kwh', required: true, example: '170', hint: 'Vom Netz bezogen (Zähler)' },

    // === META (optional) ===
    { name: 'Datenquelle', dbName: 'datenquelle', required: false, example: 'CSV-Import', hint: 'z.B. Wechselrichter-App, Zähler' },
    { name: 'Notizen', dbName: 'notizen', required: false, example: '', hint: 'Optionale Anmerkungen' },
  ]

  // === INVESTITIONS-SPALTEN (personalisiert) ===
  for (const inv of investitionen) {
    const prefix = inv.bezeichnung

    if (inv.typ === 'wechselrichter') {
      // PV-Erzeugung pro Wechselrichter
      columns.push({
        name: `${prefix} - PV-Erzeugung (kWh)`,
        dbName: `inv_${inv.id}_pv`,
        required: true,  // Mindestens ein Wechselrichter muss Daten haben
        example: '450',
        hint: 'Vom Wechselrichter abgelesen',
        investitionId: inv.id,
        investitionTyp: 'wechselrichter',
        jsonField: 'pv_erzeugung_ist_kwh'
      })
    } else if (inv.typ === 'speicher') {
      columns.push(
        {
          name: `${prefix} - Ladung (kWh)`,
          dbName: `inv_${inv.id}_ladung`,
          required: false,
          example: '60',
          hint: 'In Batterie geladen',
          investitionId: inv.id,
          investitionTyp: 'speicher',
          jsonField: 'ladung_kwh'
        },
        {
          name: `${prefix} - Entladung (kWh)`,
          dbName: `inv_${inv.id}_entladung`,
          required: false,
          example: '50',
          hint: 'Aus Batterie entnommen',
          investitionId: inv.id,
          investitionTyp: 'speicher',
          jsonField: 'entladung_kwh'
        }
      )
    } else if (inv.typ === 'e-auto') {
      columns.push(
        {
          name: `${prefix} - km gefahren`,
          dbName: `inv_${inv.id}_km`,
          required: false,
          example: '1200',
          investitionId: inv.id,
          investitionTyp: 'e-auto',
          jsonField: 'km_gefahren'
        },
        {
          name: `${prefix} - Verbrauch (kWh)`,
          dbName: `inv_${inv.id}_verbrauch`,
          required: false,
          example: '240',
          hint: 'Gesamtverbrauch des E-Autos',
          investitionId: inv.id,
          investitionTyp: 'e-auto',
          jsonField: 'verbrauch_kwh'
        },
        {
          name: `${prefix} - Ladung PV (kWh)`,
          dbName: `inv_${inv.id}_ladung_pv`,
          required: false,
          example: '180',
          hint: 'Ladung aus PV',
          investitionId: inv.id,
          investitionTyp: 'e-auto',
          jsonField: 'ladung_pv_kwh'
        },
        {
          name: `${prefix} - Ladung Netz (kWh)`,
          dbName: `inv_${inv.id}_ladung_netz`,
          required: false,
          example: '60',
          hint: 'Ladung aus Netz',
          investitionId: inv.id,
          investitionTyp: 'e-auto',
          jsonField: 'ladung_netz_kwh'
        }
      )
    } else if (inv.typ === 'waermepumpe') {
      columns.push(
        {
          name: `${prefix} - Heizenergie (kWh)`,
          dbName: `inv_${inv.id}_heiz`,
          required: false,
          example: '600',
          hint: 'Erzeugte Heizwärme',
          investitionId: inv.id,
          investitionTyp: 'waermepumpe',
          jsonField: 'heizenergie_kwh'
        },
        {
          name: `${prefix} - Warmwasser (kWh)`,
          dbName: `inv_${inv.id}_ww`,
          required: false,
          example: '150',
          hint: 'Erzeugte Warmwasser-Wärme',
          investitionId: inv.id,
          investitionTyp: 'waermepumpe',
          jsonField: 'warmwasser_kwh'
        },
        {
          name: `${prefix} - Stromverbrauch (kWh)`,
          dbName: `inv_${inv.id}_strom`,
          required: false,
          example: '250',
          hint: 'Elektrischer Verbrauch der WP',
          investitionId: inv.id,
          investitionTyp: 'waermepumpe',
          jsonField: 'stromverbrauch_kwh'
        }
      )
    } else if (inv.typ === 'wallbox') {
      columns.push(
        {
          name: `${prefix} - Ladung (kWh)`,
          dbName: `inv_${inv.id}_ladung`,
          required: false,
          example: '200',
          investitionId: inv.id,
          investitionTyp: 'wallbox',
          jsonField: 'ladung_kwh'
        },
        {
          name: `${prefix} - Ladevorgänge`,
          dbName: `inv_${inv.id}_vorgaenge`,
          required: false,
          example: '12',
          investitionId: inv.id,
          investitionTyp: 'wallbox',
          jsonField: 'ladevorgaenge'
        }
      )
    }
  }

  return columns
}

function generateCSV(columns: Column[], anlage: any, investitionen: Investition[]): string {
  // Header-Zeile
  const header = columns.map(c => `"${c.name}"`).join(',')

  // Prüfe ob Wechselrichter und Speicher vorhanden
  const hatWechselrichter = investitionen.some(i => i.typ === 'wechselrichter')
  const hatSpeicher = investitionen.some(i => i.typ === 'speicher')
  const hatEAuto = investitionen.some(i => i.typ === 'e-auto')
  const hatWaermepumpe = investitionen.some(i => i.typ === 'waermepumpe')

  // Beispiel-Zeile 1 (Januar - Winter)
  const example1 = columns.map(c => {
    // Basis-Spalten
    switch (c.dbName) {
      case 'jahr': return '2024'
      case 'monat': return '1'
      case 'einspeisung_kwh': return '10'
      case 'netzbezug_kwh': return '340'
      case 'datenquelle': return 'CSV-Import'
    }
    // Investitions-Spalten - Beispielwerte für Winter
    if (c.investitionTyp === 'wechselrichter') {
      if (c.jsonField === 'pv_erzeugung_ist_kwh') return '120'
    }
    if (c.investitionTyp === 'speicher') {
      if (c.jsonField === 'ladung_kwh') return '20'
      if (c.jsonField === 'entladung_kwh') return '18'
    }
    if (c.investitionTyp === 'e-auto') {
      if (c.jsonField === 'km_gefahren') return '1200'
      if (c.jsonField === 'verbrauch_kwh') return '240'
      if (c.jsonField === 'ladung_pv_kwh') return '48'
      if (c.jsonField === 'ladung_netz_kwh') return '192'
    }
    if (c.investitionTyp === 'waermepumpe') {
      if (c.jsonField === 'heizenergie_kwh') return '800'
      if (c.jsonField === 'warmwasser_kwh') return '150'
      if (c.jsonField === 'stromverbrauch_kwh') return '320'
    }
    return ''
  }).join(',')

  // Beispiel-Zeile 2 (Juli - Sommer)
  const example2 = columns.map(c => {
    switch (c.dbName) {
      case 'jahr': return '2024'
      case 'monat': return '7'
      case 'einspeisung_kwh': return '320'
      case 'netzbezug_kwh': return '50'
      case 'datenquelle': return 'CSV-Import'
    }
    // Investitions-Spalten - Beispielwerte für Sommer
    if (c.investitionTyp === 'wechselrichter') {
      if (c.jsonField === 'pv_erzeugung_ist_kwh') return '650'
    }
    if (c.investitionTyp === 'speicher') {
      if (c.jsonField === 'ladung_kwh') return '80'
      if (c.jsonField === 'entladung_kwh') return '75'
    }
    if (c.investitionTyp === 'e-auto') {
      if (c.jsonField === 'km_gefahren') return '1500'
      if (c.jsonField === 'verbrauch_kwh') return '300'
      if (c.jsonField === 'ladung_pv_kwh') return '240'
      if (c.jsonField === 'ladung_netz_kwh') return '60'
    }
    if (c.investitionTyp === 'waermepumpe') {
      if (c.jsonField === 'heizenergie_kwh') return '100'
      if (c.jsonField === 'warmwasser_kwh') return '180'
      if (c.jsonField === 'stromverbrauch_kwh') return '90'
    }
    return ''
  }).join(',')

  // Leere Zeilen
  const empty = columns.map(() => '').join(',')

  // Investitions-Info für Kommentare
  const invInfo = investitionen.length > 0
    ? investitionen.map(i => `#   - ${i.bezeichnung} (${i.typ})`).join('\n')
    : '#   (keine Investitionen erfasst)'

  // Berechnungs-Hinweise
  const berechnungsHinweise = [
    '# AUTOMATISCH BERECHNET WERDEN:',
    '#   - PV-Erzeugung (Summe aller Wechselrichter)',
    '#   - Batterieladung/-entladung (Summe aller Speicher)',
    '#   - Direktverbrauch = PV-Erzeugung - Einspeisung - Batterieladung',
    '#   - Eigenverbrauch = Direktverbrauch + Batterieentladung',
    '#   - Gesamtverbrauch = Eigenverbrauch + Netzbezug',
    '#   - Eigenverbrauchsquote, Autarkiegrad, kWh/kWp',
    '#   - Wetterdaten (Sonnenstunden, Globalstrahlung) via Open-Meteo API',
    '#   - Kosten/Erlöse (aus hinterlegten Strompreisen)'
  ]

  // Kommentar-Zeilen
  const comments = [
    `# CSV-Vorlage für ${anlage.anlagenname} (${anlage.leistung_kwp} kWp)`,
    `# Erstellt am: ${new Date().toLocaleDateString('de-DE')}`,
    '#',
    '# PFLICHTFELDER: Jahr, Monat, Einspeisung, Netzbezug' + (hatWechselrichter ? ', PV-Erzeugung pro Wechselrichter' : ''),
    '# OPTIONAL: Alle anderen Spalten - einfach leer lassen wenn nicht relevant',
    '#',
    '# IHRE INVESTITIONEN:',
    invInfo,
    '#',
    ...berechnungsHinweise,
    '#',
    '# HINWEISE:',
    '# - Strompreise werden aus Stammdaten für den jeweiligen Monat geholt',
    '# - Speicher-Spalten: Nur ausfüllen wenn Batteriespeicher vorhanden',
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
