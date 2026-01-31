// app/api/csv-template/route.ts
// API-Route für personalisierte CSV-Template-Generierung
// Enthält Basis-Monatsdaten + Spalten für alle Investitionen des Mitglieds

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
      .from('alternative_investitionen')
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

// Generiert alle Spalten: Basis-Monatsdaten + personalisierte Investitions-Spalten
function generateAllColumns(investitionen: Investition[]): Column[] {
  const columns: Column[] = [
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
    { name: 'Batterieladung (kWh)', dbName: 'batterieladung_kwh', required: false, example: '60', hint: 'In Batterie geladen' },
    { name: 'Batterieentladung (kWh)', dbName: 'batterieentladung_kwh', required: false, example: '50', hint: 'Aus Batterie entnommen' },

    // === STROMPREISE (optional - leer = Stammdaten-Preise) ===
    { name: 'Netzbezugspreis (Cent/kWh)', dbName: 'netzbezug_preis_cent_kwh', required: false, example: '', hint: 'Leer = Stammdaten-Preis' },
    { name: 'Einspeisevergütung (Cent/kWh)', dbName: 'einspeisung_preis_cent_kwh', required: false, example: '', hint: 'Leer = Stammdaten-Preis' },

    // === FINANZEN (optional - werden aus kWh × Preis berechnet wenn leer) ===
    { name: 'Einspeise-Ertrag (€)', dbName: 'einspeisung_ertrag_euro', required: false, example: '', hint: 'Wird berechnet wenn leer' },
    { name: 'Netzbezug-Kosten (€)', dbName: 'netzbezug_kosten_euro', required: false, example: '', hint: 'Wird berechnet wenn leer' },
    { name: 'Betriebsausgaben (€)', dbName: 'betriebsausgaben_monat_euro', required: false, example: '', hint: 'Wartung, Versicherung etc.' },

    // === WETTER: Wird automatisch von Open-Meteo API geholt ===
    // Sonnenstunden und Globalstrahlung werden beim Import automatisch ergänzt

    // === META (optional) ===
    { name: 'Datenquelle', dbName: 'datenquelle', required: false, example: 'CSV-Import', hint: 'z.B. Wechselrichter-App, Zähler' },
    { name: 'Notizen', dbName: 'notizen', required: false, example: '', hint: 'Optionale Anmerkungen' },
  ]

  // === INVESTITIONS-SPALTEN (personalisiert) ===
  for (const inv of investitionen) {
    const prefix = inv.bezeichnung

    if (inv.typ === 'e-auto') {
      columns.push(
        { name: `${prefix} - km gefahren`, dbName: `inv_${inv.id}_km`, required: false, investitionId: inv.id, investitionTyp: 'e-auto', jsonField: 'km_gefahren' },
        { name: `${prefix} - Strom (kWh)`, dbName: `inv_${inv.id}_strom`, required: false, investitionId: inv.id, investitionTyp: 'e-auto', jsonField: 'strom_kwh' },
        { name: `${prefix} - Strom PV (kWh)`, dbName: `inv_${inv.id}_strom_pv`, required: false, investitionId: inv.id, investitionTyp: 'e-auto', jsonField: 'strom_pv_kwh' },
        { name: `${prefix} - Strom Netz (kWh)`, dbName: `inv_${inv.id}_strom_netz`, required: false, investitionId: inv.id, investitionTyp: 'e-auto', jsonField: 'strom_netz_kwh' }
      )
    } else if (inv.typ === 'waermepumpe') {
      columns.push(
        { name: `${prefix} - Wärme (kWh)`, dbName: `inv_${inv.id}_waerme`, required: false, investitionId: inv.id, investitionTyp: 'waermepumpe', jsonField: 'waerme_kwh' },
        { name: `${prefix} - Strom (kWh)`, dbName: `inv_${inv.id}_strom`, required: false, investitionId: inv.id, investitionTyp: 'waermepumpe', jsonField: 'strom_kwh' },
        { name: `${prefix} - Strom PV (kWh)`, dbName: `inv_${inv.id}_strom_pv`, required: false, investitionId: inv.id, investitionTyp: 'waermepumpe', jsonField: 'strom_pv_kwh' }
      )
    } else if (inv.typ === 'speicher') {
      columns.push(
        { name: `${prefix} - Ladung (kWh)`, dbName: `inv_${inv.id}_ladung`, required: false, investitionId: inv.id, investitionTyp: 'speicher', jsonField: 'gespeichert_kwh' },
        { name: `${prefix} - Entladung (kWh)`, dbName: `inv_${inv.id}_entladung`, required: false, investitionId: inv.id, investitionTyp: 'speicher', jsonField: 'entladen_kwh' },
        { name: `${prefix} - Zyklen`, dbName: `inv_${inv.id}_zyklen`, required: false, investitionId: inv.id, investitionTyp: 'speicher', jsonField: 'zyklen' }
      )
    } else if (inv.typ === 'wallbox') {
      columns.push(
        { name: `${prefix} - Ladung (kWh)`, dbName: `inv_${inv.id}_ladung`, required: false, investitionId: inv.id, investitionTyp: 'wallbox', jsonField: 'ladung_kwh' },
        { name: `${prefix} - Ladevorgänge`, dbName: `inv_${inv.id}_vorgaenge`, required: false, investitionId: inv.id, investitionTyp: 'wallbox', jsonField: 'ladevorgaenge' }
      )
    }
    // Wechselrichter und PV-Module haben keine separaten Monatsdaten
    // (PV-Erzeugung ist in monatsdaten direkt)
  }

  return columns
}

function generateCSV(columns: Column[], anlage: any, investitionen: Investition[]): string {
  // Header-Zeile
  const header = columns.map(c => `"${c.name}"`).join(',')

  // Beispiel-Zeile 1 (Januar - Winter)
  const example1 = columns.map(c => {
    // Basis-Spalten
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
      case 'datenquelle': return 'CSV-Import'
    }
    // Investitions-Spalten - Beispielwerte für Winter
    if (c.investitionTyp === 'e-auto') {
      if (c.jsonField === 'km_gefahren') return '1200'
      if (c.jsonField === 'strom_kwh') return '240'
      if (c.jsonField === 'strom_pv_kwh') return '48'
      if (c.jsonField === 'strom_netz_kwh') return '192'
    }
    if (c.investitionTyp === 'waermepumpe') {
      if (c.jsonField === 'waerme_kwh') return '2200'
      if (c.jsonField === 'strom_kwh') return '680'
      if (c.jsonField === 'strom_pv_kwh') return '80'
    }
    if (c.investitionTyp === 'speicher') {
      if (c.jsonField === 'gespeichert_kwh') return '180'
      if (c.jsonField === 'entladen_kwh') return '170'
      if (c.jsonField === 'zyklen') return '18'
    }
    return ''
  }).join(',')

  // Beispiel-Zeile 2 (Juli - Sommer)
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
      case 'datenquelle': return 'CSV-Import'
    }
    // Investitions-Spalten - Beispielwerte für Sommer
    if (c.investitionTyp === 'e-auto') {
      if (c.jsonField === 'km_gefahren') return '1500'
      if (c.jsonField === 'strom_kwh') return '300'
      if (c.jsonField === 'strom_pv_kwh') return '240'
      if (c.jsonField === 'strom_netz_kwh') return '60'
    }
    if (c.investitionTyp === 'waermepumpe') {
      if (c.jsonField === 'waerme_kwh') return '400'
      if (c.jsonField === 'strom_kwh') return '120'
      if (c.jsonField === 'strom_pv_kwh') return '100'
    }
    if (c.investitionTyp === 'speicher') {
      if (c.jsonField === 'gespeichert_kwh') return '480'
      if (c.jsonField === 'entladen_kwh') return '460'
      if (c.jsonField === 'zyklen') return '30'
    }
    return ''
  }).join(',')

  // Leere Zeilen
  const empty = columns.map(() => '').join(',')

  // Investitions-Info für Kommentare
  const invInfo = investitionen.length > 0
    ? investitionen.map(i => `#   - ${i.bezeichnung} (${i.typ})`).join('\n')
    : '#   (keine Investitionen erfasst)'

  // Kommentar-Zeilen
  const comments = [
    `# CSV-Vorlage für ${anlage.anlagenname} (${anlage.leistung_kwp} kWp)`,
    `# Erstellt am: ${new Date().toLocaleDateString('de-DE')}`,
    '#',
    '# PFLICHTFELDER: Jahr, Monat, PV-Erzeugung, Gesamtverbrauch, Direktverbrauch, Einspeisung, Netzbezug',
    '# OPTIONAL: Alle anderen Spalten - einfach leer lassen wenn nicht relevant',
    '#',
    '# IHRE INVESTITIONEN:',
    invInfo,
    '#',
    '# HINWEISE:',
    '# - Batterieladung/-entladung: Nur ausfüllen wenn Speicher vorhanden',
    '# - Strompreise: Leer lassen = Stammdaten-Preise werden verwendet',
    '# - Euro-Beträge: Werden automatisch berechnet wenn leer (kWh × Preis)',
    '# - Wetterdaten: Werden automatisch von Open-Meteo API ergänzt (Sonnenstunden, Globalstrahlung)',
    '# - Investitions-Spalten: Nur ausfüllen wenn Sie diese Daten haben',
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
