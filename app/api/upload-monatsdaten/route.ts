// app/api/upload-monatsdaten/route.ts
// API-Route für Monatsdaten-Upload und Parsing
// Unterstützt Basis-Monatsdaten + personalisierte Investitions-Daten

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getAnlageById } from '@/lib/anlagen-helpers'
import Papa from 'papaparse'

interface ValidationError {
  row: number
  field: string
  message: string
}

interface ParsedMonatsdaten {
  jahr: number
  monat: number
  // Energie-Flüsse (kWh)
  gesamtverbrauch_kwh?: number
  pv_erzeugung_kwh?: number
  direktverbrauch_kwh?: number
  batterieentladung_kwh?: number
  batterieladung_kwh?: number
  netzbezug_kwh?: number
  einspeisung_kwh?: number
  // Strompreise (ct/kWh)
  netzbezug_preis_cent_kwh?: number
  einspeisung_preis_cent_kwh?: number
  // Finanzen
  einspeisung_ertrag_euro?: number
  netzbezug_kosten_euro?: number
  betriebsausgaben_monat_euro?: number
  // Wetter
  sonnenstunden?: number
  globalstrahlung_kwh_m2?: number
  // Meta
  datenquelle?: string
  notizen?: string
}

interface ParsedInvestitionMonatsdaten {
  investition_id: string
  jahr: number
  monat: number
  verbrauch_daten: Record<string, number>
}

interface Investition {
  id: string
  typ: string
  bezeichnung: string
}

// Mapping von deutschen Spaltennamen zu DB-Feldern
const columnMapping: Record<string, string> = {
  // Pflichtfelder
  'Jahr': 'jahr',
  'Monat': 'monat',
  // Energie-Flüsse (Kern-Daten)
  'PV-Erzeugung (kWh)': 'pv_erzeugung_kwh',
  'Gesamtverbrauch (kWh)': 'gesamtverbrauch_kwh',
  'Direktverbrauch (kWh)': 'direktverbrauch_kwh',
  'Einspeisung (kWh)': 'einspeisung_kwh',
  'Netzbezug (kWh)': 'netzbezug_kwh',
  // Batteriespeicher (optional)
  'Batterieladung (kWh)': 'batterieladung_kwh',
  'Batterieentladung (kWh)': 'batterieentladung_kwh',
  // Strompreise (optional)
  'Netzbezugspreis (Cent/kWh)': 'netzbezug_preis_cent_kwh',
  'Einspeisevergütung (Cent/kWh)': 'einspeisung_preis_cent_kwh',
  // Finanzen (optional)
  'Einspeise-Ertrag (€)': 'einspeisung_ertrag_euro',
  'Netzbezug-Kosten (€)': 'netzbezug_kosten_euro',
  'Betriebsausgaben (€)': 'betriebsausgaben_monat_euro',
  // Wetter (optional)
  'Sonnenstunden': 'sonnenstunden',
  'Globalstrahlung (kWh/m²)': 'globalstrahlung_kwh_m2',
  // Meta (optional)
  'Datenquelle': 'datenquelle',
  'Notizen': 'notizen'
}

// Generiert dynamisches Mapping für Investitions-Spalten
function generateInvestitionMapping(investitionen: Investition[]): Record<string, { investitionId: string, jsonField: string }> {
  const mapping: Record<string, { investitionId: string, jsonField: string }> = {}

  for (const inv of investitionen) {
    const prefix = inv.bezeichnung

    if (inv.typ === 'e-auto') {
      mapping[`${prefix} - km gefahren`] = { investitionId: inv.id, jsonField: 'km_gefahren' }
      mapping[`${prefix} - Strom (kWh)`] = { investitionId: inv.id, jsonField: 'strom_kwh' }
      mapping[`${prefix} - Strom PV (kWh)`] = { investitionId: inv.id, jsonField: 'strom_pv_kwh' }
      mapping[`${prefix} - Strom Netz (kWh)`] = { investitionId: inv.id, jsonField: 'strom_netz_kwh' }
    } else if (inv.typ === 'waermepumpe') {
      mapping[`${prefix} - Wärme (kWh)`] = { investitionId: inv.id, jsonField: 'waerme_kwh' }
      mapping[`${prefix} - Strom (kWh)`] = { investitionId: inv.id, jsonField: 'strom_kwh' }
      mapping[`${prefix} - Strom PV (kWh)`] = { investitionId: inv.id, jsonField: 'strom_pv_kwh' }
    } else if (inv.typ === 'speicher') {
      mapping[`${prefix} - Ladung (kWh)`] = { investitionId: inv.id, jsonField: 'gespeichert_kwh' }
      mapping[`${prefix} - Entladung (kWh)`] = { investitionId: inv.id, jsonField: 'entladen_kwh' }
      mapping[`${prefix} - Zyklen`] = { investitionId: inv.id, jsonField: 'zyklen' }
    } else if (inv.typ === 'wallbox') {
      mapping[`${prefix} - Ladung (kWh)`] = { investitionId: inv.id, jsonField: 'ladung_kwh' }
      mapping[`${prefix} - Ladevorgänge`] = { investitionId: inv.id, jsonField: 'ladevorgaenge' }
    }
  }

  return mapping
}

function parseNumber(value: any): number | undefined {
  if (value === null || value === undefined || value === '') return undefined

  // Deutsche Zahlenformate unterstützen (Komma statt Punkt)
  const normalized = String(value).replace(',', '.').replace(/[^\d.-]/g, '')
  const parsed = parseFloat(normalized)

  return isNaN(parsed) ? undefined : parsed
}

function validateRow(row: any, rowIndex: number): { data?: ParsedMonatsdaten, errors: ValidationError[] } {
  const errors: ValidationError[] = []

  // Jahr und Monat sind Pflichtfelder
  const jahr = parseNumber(row.jahr)
  const monat = parseNumber(row.monat)

  if (!jahr) {
    errors.push({ row: rowIndex, field: 'Jahr', message: 'Jahr ist erforderlich' })
  } else if (jahr < 2000 || jahr > 2100) {
    errors.push({ row: rowIndex, field: 'Jahr', message: 'Jahr muss zwischen 2000 und 2100 liegen' })
  }

  if (!monat) {
    errors.push({ row: rowIndex, field: 'Monat', message: 'Monat ist erforderlich' })
  } else if (monat < 1 || monat > 12) {
    errors.push({ row: rowIndex, field: 'Monat', message: 'Monat muss zwischen 1 und 12 liegen' })
  }

  if (errors.length > 0) {
    return { errors }
  }

  // Alle Daten parsen
  const data: ParsedMonatsdaten = {
    jahr: jahr!,
    monat: monat!,
    pv_erzeugung_kwh: parseNumber(row.pv_erzeugung_kwh),
    gesamtverbrauch_kwh: parseNumber(row.gesamtverbrauch_kwh),
    direktverbrauch_kwh: parseNumber(row.direktverbrauch_kwh),
    einspeisung_kwh: parseNumber(row.einspeisung_kwh),
    netzbezug_kwh: parseNumber(row.netzbezug_kwh),
    batterieladung_kwh: parseNumber(row.batterieladung_kwh),
    batterieentladung_kwh: parseNumber(row.batterieentladung_kwh),
    netzbezug_preis_cent_kwh: parseNumber(row.netzbezug_preis_cent_kwh),
    einspeisung_preis_cent_kwh: parseNumber(row.einspeisung_preis_cent_kwh),
    einspeisung_ertrag_euro: parseNumber(row.einspeisung_ertrag_euro),
    netzbezug_kosten_euro: parseNumber(row.netzbezug_kosten_euro),
    betriebsausgaben_monat_euro: parseNumber(row.betriebsausgaben_monat_euro),
    sonnenstunden: parseNumber(row.sonnenstunden),
    globalstrahlung_kwh_m2: parseNumber(row.globalstrahlung_kwh_m2),
    datenquelle: row.datenquelle || undefined,
    notizen: row.notizen || undefined
  }

  // Plausibilitätsprüfungen (Warnungen, keine harten Fehler)
  const warnings: ValidationError[] = []

  if (data.pv_erzeugung_kwh !== undefined && data.pv_erzeugung_kwh > 10000) {
    warnings.push({ row: rowIndex, field: 'PV-Erzeugung', message: 'Sehr hoher Wert (> 10.000 kWh)' })
  }

  if (data.gesamtverbrauch_kwh !== undefined && data.gesamtverbrauch_kwh > 20000) {
    warnings.push({ row: rowIndex, field: 'Gesamtverbrauch', message: 'Sehr hoher Wert (> 20.000 kWh)' })
  }

  return { data, errors: warnings }
}

// Extrahiert Investitions-Daten aus einer CSV-Zeile
function extractInvestitionsDaten(
  row: any,
  jahr: number,
  monat: number,
  investitionMapping: Record<string, { investitionId: string, jsonField: string }>
): ParsedInvestitionMonatsdaten[] {
  // Gruppiere nach investition_id
  const grouped: Record<string, Record<string, number>> = {}

  for (const [header, value] of Object.entries(row)) {
    const mapping = investitionMapping[header]
    if (mapping && value !== undefined && value !== null && value !== '') {
      const numValue = parseNumber(value)
      if (numValue !== undefined) {
        if (!grouped[mapping.investitionId]) {
          grouped[mapping.investitionId] = {}
        }
        grouped[mapping.investitionId][mapping.jsonField] = numValue
      }
    }
  }

  // Konvertiere zu Array
  return Object.entries(grouped)
    .filter(([_, daten]) => Object.keys(daten).length > 0)
    .map(([investitionId, verbrauch_daten]) => ({
      investition_id: investitionId,
      jahr,
      monat,
      verbrauch_daten
    }))
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentifizierung prüfen
    const mitglied = await getCurrentMitglied()
    if (!mitglied.data) {
      return NextResponse.json({
        success: false,
        message: 'Nicht authentifiziert'
      }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const anlageId = formData.get('anlageId') as string
    const isPreview = formData.get('preview') === 'true'

    if (!file) {
      return NextResponse.json({
        success: false,
        message: 'Keine Datei hochgeladen'
      }, { status: 400 })
    }

    if (!anlageId) {
      return NextResponse.json({
        success: false,
        message: 'Anlagen-ID fehlt'
      }, { status: 400 })
    }

    // 2. Zugriffsberechtigung prüfen (via RLS)
    const { data: anlage } = await getAnlageById(anlageId)
    if (!anlage) {
      return NextResponse.json({
        success: false,
        message: 'Keine Berechtigung für diese Anlage'
      }, { status: 403 })
    }

    // 3. Investitionen des Mitglieds laden für dynamisches Mapping
    const supabase = await createClient()
    const { data: investitionen } = await supabase
      .from('alternative_investitionen')
      .select('id, typ, bezeichnung')
      .eq('mitglied_id', mitglied.data.id)
      .eq('aktiv', true)

    const investitionMapping = generateInvestitionMapping(investitionen || [])

    // Datei als Text lesen
    const fileContent = await file.text()

    // CSV parsen mit PapaParse
    // Wir behalten Original-Header und mappen manuell
    const parseResult = await new Promise<Papa.ParseResult<any>>((resolve) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        comments: '#',  // Kommentarzeilen ignorieren
        complete: resolve
      })
    })

    if (parseResult.errors.length > 0) {
      const errors: ValidationError[] = parseResult.errors.map((err: any) => ({
        row: err.row || 0,
        field: 'parse',
        message: err.message
      }))

      return NextResponse.json({
        success: false,
        errors,
        message: 'Fehler beim Parsen der CSV-Datei'
      })
    }

    // Transformiere Headers manuell (für Basis-Felder)
    const transformedData = parseResult.data.map((row: any) => {
      const transformed: any = {}
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = columnMapping[key.trim()] || key.trim()
        transformed[mappedKey] = value
        // Original-Key behalten für Investitions-Spalten
        if (!columnMapping[key.trim()]) {
          transformed[key.trim()] = value
        }
      }
      return transformed
    })

    // Validiere und transformiere Monatsdaten
    const validatedData: ParsedMonatsdaten[] = []
    const allInvestitionsDaten: ParsedInvestitionMonatsdaten[] = []
    const allErrors: ValidationError[] = []
    const allWarnings: ValidationError[] = []

    transformedData.forEach((row: any, index: number) => {
      const { data, errors } = validateRow(row, index + 2)

      if (data) {
        validatedData.push(data)
        allWarnings.push(...errors.filter(e => e.message.includes('Sehr hoher Wert')))

        // Investitions-Daten extrahieren
        const invDaten = extractInvestitionsDaten(row, data.jahr, data.monat, investitionMapping)
        allInvestitionsDaten.push(...invDaten)
      } else {
        allErrors.push(...errors)
      }
    })

    if (allErrors.length > 0) {
      return NextResponse.json({
        success: false,
        errors: allErrors,
        message: 'Validierungsfehler in den Daten'
      })
    }

    if (validatedData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Keine gültigen Datensätze gefunden'
      }, { status: 400 })
    }

    // Preview-Modus: Nur Daten zurückgeben, nicht importieren
    if (isPreview) {
      return NextResponse.json({
        success: true,
        data: validatedData,
        investitionsDaten: allInvestitionsDaten,
        warnings: allWarnings
      })
    }

    // === DATEN IN DB EINFÜGEN ===

    // Prüfe auf Duplikate (Jahr/Monat/Anlage) für Monatsdaten
    const duplicateChecks = await Promise.all(
      validatedData.map(d =>
        supabase
          .from('monatsdaten')
          .select('id')
          .eq('anlage_id', anlageId)
          .eq('jahr', d.jahr)
          .eq('monat', d.monat)
          .single()
      )
    )

    const duplicates = duplicateChecks
      .map((result, i) => result.data ? validatedData[i] : null)
      .filter(Boolean)

    if (duplicates.length > 0) {
      return NextResponse.json({
        success: false,
        message: `${duplicates.length} Datensätze existieren bereits (Jahr/Monat-Kombination)`,
        errors: duplicates.map(d => ({
          row: 0,
          field: 'Duplikat',
          message: `${d!.jahr}-${String(d!.monat).padStart(2, '0')} bereits vorhanden`
        }))
      }, { status: 409 })
    }

    // Monatsdaten einfügen
    const insertData = validatedData.map(d => ({
      anlage_id: anlageId,
      ...d
    }))

    const { error: insertError } = await supabase
      .from('monatsdaten')
      .insert(insertData)

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({
        success: false,
        message: 'Fehler beim Speichern in Datenbank',
        errors: [{ row: 0, field: 'db', message: insertError.message }]
      }, { status: 500 })
    }

    // Investitions-Monatsdaten einfügen (upsert für Duplikate)
    let investitionenImported = 0
    if (allInvestitionsDaten.length > 0) {
      for (const invData of allInvestitionsDaten) {
        const { error: invError } = await supabase
          .from('investition_monatsdaten')
          .upsert({
            investition_id: invData.investition_id,
            jahr: invData.jahr,
            monat: invData.monat,
            verbrauch_daten: invData.verbrauch_daten,
            aktualisiert_am: new Date().toISOString()
          }, { onConflict: 'investition_id,jahr,monat' })

        if (invError) {
          console.error('Investition insert error:', invError)
        } else {
          investitionenImported++
        }
      }
    }

    // Erfolgs-Message
    let message = `${validatedData.length} Monatsdatensätze erfolgreich importiert`
    if (investitionenImported > 0) {
      message += `, ${investitionenImported} Investitions-Datensätze`
    }

    return NextResponse.json({
      success: true,
      message,
      data: validatedData,
      investitionsDaten: allInvestitionsDaten
    })

  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
