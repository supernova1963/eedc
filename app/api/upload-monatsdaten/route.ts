// app/api/upload-monatsdaten/route.ts
// API-Route für Monatsdaten-Upload und Parsing

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
  // Strompreise (ct/kWh) - optional, wenn leer werden Stammdaten verwendet
  netzbezug_preis_cent_kwh?: number
  einspeisung_preis_cent_kwh?: number
  // Sonstiges
  betriebsausgaben_monat_euro?: number
  notizen?: string
}

// Mapping von deutschen Spaltennamen zu DB-Feldern
// Angepasst für FRESH-START Schema
const columnMapping: Record<string, string> = {
  'Jahr': 'jahr',
  'Monat': 'monat',
  'Gesamtverbrauch (kWh)': 'gesamtverbrauch_kwh',
  'PV-Erzeugung (kWh)': 'pv_erzeugung_kwh',
  'Direktverbrauch (kWh)': 'direktverbrauch_kwh',
  'Batterieentladung (kWh)': 'batterieentladung_kwh',
  'Batterieladung (kWh)': 'batterieladung_kwh',
  'Netzbezug (kWh)': 'netzbezug_kwh',
  'Einspeisung (kWh)': 'einspeisung_kwh',
  // Strompreise in ct/kWh - direkt auf DB-Spaltennamen mappen
  'Netzbezugspreis (Cent/kWh)': 'netzbezug_preis_cent_kwh',
  'Einspeisevergütung (Cent/kWh)': 'einspeisung_preis_cent_kwh',
  // Sonstiges
  'Betriebsausgaben (€)': 'betriebsausgaben_monat_euro',
  'Notizen': 'notizen'
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

  // Alle Daten parsen - Euro-Beträge werden NICHT mehr importiert,
  // sie werden beim Speichern automatisch aus Strompreisen berechnet
  const data: ParsedMonatsdaten = {
    jahr: jahr!,
    monat: monat!,
    // Energie-Flüsse
    gesamtverbrauch_kwh: parseNumber(row.gesamtverbrauch_kwh),
    pv_erzeugung_kwh: parseNumber(row.pv_erzeugung_kwh),
    direktverbrauch_kwh: parseNumber(row.direktverbrauch_kwh),
    batterieentladung_kwh: parseNumber(row.batterieentladung_kwh),
    batterieladung_kwh: parseNumber(row.batterieladung_kwh),
    netzbezug_kwh: parseNumber(row.netzbezug_kwh),
    einspeisung_kwh: parseNumber(row.einspeisung_kwh),
    // Strompreise (optional - für dynamische Tarife)
    netzbezug_preis_cent_kwh: parseNumber(row.netzbezug_preis_cent_kwh),
    einspeisung_preis_cent_kwh: parseNumber(row.einspeisung_preis_cent_kwh),
    // Sonstiges
    betriebsausgaben_monat_euro: parseNumber(row.betriebsausgaben_monat_euro),
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

    // Datei als Text lesen
    const fileContent = await file.text()

    // CSV parsen mit PapaParse
    const parseResult = await new Promise<Papa.ParseResult<any>>((resolve) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          // Mapping von deutschen Namen zu DB-Feldern
          return columnMapping[header.trim()] || header.trim()
        },
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

    // Validiere und transformiere Daten
    const validatedData: ParsedMonatsdaten[] = []
    const allErrors: ValidationError[] = []
    const allWarnings: ValidationError[] = []

    parseResult.data.forEach((row, index) => {
      const { data, errors } = validateRow(row, index + 2) // +2 wegen Header und 1-basiertem Index

      if (data) {
        validatedData.push(data)
        // Warnungen sammeln
        allWarnings.push(...errors.filter(e => e.message.includes('Sehr hoher Wert')))
      } else {
        // Echte Fehler
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
        warnings: allWarnings
      })
    }

    // Daten in DB einfügen
    // Hinweis: mitglied_id nicht mehr nötig - Beziehung läuft über anlage_id
    // Euro-Beträge werden NICHT importiert - sie werden automatisch aus Strompreisen berechnet
    const insertData = validatedData.map(d => ({
      anlage_id: anlageId,
      ...d
    }))

    // Prüfe auf Duplikate (Jahr/Monat/Anlage)
    const supabase = await createClient()
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

    return NextResponse.json({
      success: true,
      message: `${validatedData.length} Datensätze erfolgreich importiert`,
      data: validatedData
    })

  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
