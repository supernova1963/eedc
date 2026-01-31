// app/api/upload-monatsdaten/route.ts
// API-Route für Monatsdaten-Upload und Parsing
// Neues Konzept: Nur Rohdaten importieren, Summen automatisch berechnen

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getAnlageById } from '@/lib/anlagen-helpers'
import { getCoordinatesFromPLZ, getMonthlyWeatherData } from '@/lib/weather-api'
import Papa from 'papaparse'

interface ValidationError {
  row: number
  field: string
  message: string
}

interface ParsedRow {
  jahr: number
  monat: number
  einspeisung_kwh: number
  netzbezug_kwh: number
  datenquelle?: string
  notizen?: string
  // Investitions-Daten werden separat gesammelt
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
  parameter?: any
}

// Mapping von deutschen Spaltennamen zu DB-Feldern (nur Basis-Felder)
const columnMapping: Record<string, string> = {
  'Jahr': 'jahr',
  'Monat': 'monat',
  'Einspeisung (kWh)': 'einspeisung_kwh',
  'Netzbezug (kWh)': 'netzbezug_kwh',
  'Datenquelle': 'datenquelle',
  'Notizen': 'notizen'
}

// Generiert dynamisches Mapping für Investitions-Spalten
function generateInvestitionMapping(investitionen: Investition[]): Record<string, { investitionId: string, investitionTyp: string, jsonField: string }> {
  const mapping: Record<string, { investitionId: string, investitionTyp: string, jsonField: string }> = {}

  for (const inv of investitionen) {
    const prefix = inv.bezeichnung

    if (inv.typ === 'wechselrichter') {
      mapping[`${prefix} - PV-Erzeugung (kWh)`] = { investitionId: inv.id, investitionTyp: 'wechselrichter', jsonField: 'pv_erzeugung_ist_kwh' }
    } else if (inv.typ === 'speicher') {
      mapping[`${prefix} - Ladung (kWh)`] = { investitionId: inv.id, investitionTyp: 'speicher', jsonField: 'ladung_kwh' }
      mapping[`${prefix} - Entladung (kWh)`] = { investitionId: inv.id, investitionTyp: 'speicher', jsonField: 'entladung_kwh' }
    } else if (inv.typ === 'e-auto') {
      mapping[`${prefix} - km gefahren`] = { investitionId: inv.id, investitionTyp: 'e-auto', jsonField: 'km_gefahren' }
      mapping[`${prefix} - Verbrauch (kWh)`] = { investitionId: inv.id, investitionTyp: 'e-auto', jsonField: 'verbrauch_kwh' }
      mapping[`${prefix} - Ladung PV (kWh)`] = { investitionId: inv.id, investitionTyp: 'e-auto', jsonField: 'ladung_pv_kwh' }
      mapping[`${prefix} - Ladung Netz (kWh)`] = { investitionId: inv.id, investitionTyp: 'e-auto', jsonField: 'ladung_netz_kwh' }
    } else if (inv.typ === 'waermepumpe') {
      mapping[`${prefix} - Heizenergie (kWh)`] = { investitionId: inv.id, investitionTyp: 'waermepumpe', jsonField: 'heizenergie_kwh' }
      mapping[`${prefix} - Warmwasser (kWh)`] = { investitionId: inv.id, investitionTyp: 'waermepumpe', jsonField: 'warmwasser_kwh' }
      mapping[`${prefix} - Stromverbrauch (kWh)`] = { investitionId: inv.id, investitionTyp: 'waermepumpe', jsonField: 'stromverbrauch_kwh' }
    } else if (inv.typ === 'wallbox') {
      mapping[`${prefix} - Ladung (kWh)`] = { investitionId: inv.id, investitionTyp: 'wallbox', jsonField: 'ladung_kwh' }
      mapping[`${prefix} - Ladevorgänge`] = { investitionId: inv.id, investitionTyp: 'wallbox', jsonField: 'ladevorgaenge' }
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

function validateRow(row: any, rowIndex: number): { data?: ParsedRow, errors: ValidationError[] } {
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

  // Einspeisung und Netzbezug sind Pflichtfelder
  const einspeisung_kwh = parseNumber(row.einspeisung_kwh)
  const netzbezug_kwh = parseNumber(row.netzbezug_kwh)

  if (einspeisung_kwh === undefined) {
    errors.push({ row: rowIndex, field: 'Einspeisung', message: 'Einspeisung ist erforderlich' })
  }
  if (netzbezug_kwh === undefined) {
    errors.push({ row: rowIndex, field: 'Netzbezug', message: 'Netzbezug ist erforderlich' })
  }

  if (errors.length > 0) {
    return { errors }
  }

  const data: ParsedRow = {
    jahr: jahr!,
    monat: monat!,
    einspeisung_kwh: einspeisung_kwh!,
    netzbezug_kwh: netzbezug_kwh!,
    datenquelle: row.datenquelle || 'CSV-Import',
    notizen: row.notizen || undefined
  }

  return { data, errors: [] }
}

// Extrahiert Investitions-Daten aus einer CSV-Zeile
function extractInvestitionsDaten(
  row: any,
  jahr: number,
  monat: number,
  investitionMapping: Record<string, { investitionId: string, investitionTyp: string, jsonField: string }>
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

// Berechnet abgeleitete Werte aus Rohdaten (wie im Formular)
function calculateDerivedValues(
  einspeisung: number,
  netzbezug: number,
  investitionsDaten: ParsedInvestitionMonatsdaten[],
  investitionen: Investition[]
): {
  pvErzeugung: number
  batterieLadung: number
  batterieEntladung: number
  direktverbrauch: number
  eigenverbrauch: number
  gesamtverbrauch: number
  eigenverbrauchsquote: number
  autarkiegrad: number
} {
  // Summen aus Investitionen
  let pvErzeugung = 0
  let batterieLadung = 0
  let batterieEntladung = 0

  for (const invData of investitionsDaten) {
    const inv = investitionen.find(i => i.id === invData.investition_id)
    if (!inv) continue

    if (inv.typ === 'wechselrichter') {
      pvErzeugung += invData.verbrauch_daten.pv_erzeugung_ist_kwh || 0
    } else if (inv.typ === 'speicher') {
      batterieLadung += invData.verbrauch_daten.ladung_kwh || 0
      batterieEntladung += invData.verbrauch_daten.entladung_kwh || 0
    }
  }

  // Berechnungen (wie im Formular)
  // Direktverbrauch = Was direkt von der PV verbraucht wird (ohne Batterie-Umweg)
  const direktverbrauch = pvErzeugung - einspeisung - batterieLadung

  // Eigenverbrauch = Direktverbrauch + was aus der Batterie kommt
  const eigenverbrauch = direktverbrauch + batterieEntladung

  // Gesamtverbrauch = Eigenverbrauch + Netzbezug
  const gesamtverbrauch = eigenverbrauch + netzbezug

  // Kennzahlen
  const eigenverbrauchsquote = pvErzeugung > 0 ? (eigenverbrauch / pvErzeugung) * 100 : 0
  const autarkiegrad = gesamtverbrauch > 0 ? (eigenverbrauch / gesamtverbrauch) * 100 : 0

  return {
    pvErzeugung,
    batterieLadung,
    batterieEntladung,
    direktverbrauch,
    eigenverbrauch,
    gesamtverbrauch,
    eigenverbrauchsquote,
    autarkiegrad
  }
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
      .from('investitionen')
      .select('id, typ, bezeichnung, parameter')
      .eq('mitglied_id', mitglied.data.id)
      .eq('aktiv', true)

    const investitionMapping = generateInvestitionMapping(investitionen || [])

    // 4. Strompreise laden (für Berechnungen)
    const loadStrompreise = async (jahr: number, monat: number) => {
      const stichtag = `${jahr}-${String(monat).padStart(2, '0')}-15`
      const { data } = await supabase.rpc('get_aktueller_strompreis', {
        p_mitglied_id: mitglied.data!.id,
        p_anlage_id: anlageId,
        p_stichtag: stichtag
      })
      return data && data.length > 0 ? data[0] : null
    }

    // Datei als Text lesen
    const fileContent = await file.text()

    // CSV parsen mit PapaParse
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
        const trimmedKey = key.trim()
        const mappedKey = columnMapping[trimmedKey] || trimmedKey
        transformed[mappedKey] = value
        // Original-Key behalten für Investitions-Spalten
        transformed[trimmedKey] = value
      }
      return transformed
    })

    // Validiere und sammle Daten
    const validatedRows: ParsedRow[] = []
    const allInvestitionsDaten: ParsedInvestitionMonatsdaten[] = []
    const allErrors: ValidationError[] = []
    const allWarnings: ValidationError[] = []

    transformedData.forEach((row: any, index: number) => {
      const { data, errors } = validateRow(row, index + 2)

      if (data) {
        validatedRows.push(data)

        // Investitions-Daten extrahieren
        const invDaten = extractInvestitionsDaten(row, data.jahr, data.monat, investitionMapping)
        allInvestitionsDaten.push(...invDaten)

        // Prüfe ob mindestens ein Wechselrichter Daten hat
        const hatWechselrichterDaten = invDaten.some(d => {
          const inv = investitionen?.find(i => i.id === d.investition_id)
          return inv?.typ === 'wechselrichter'
        })

        if (!hatWechselrichterDaten && investitionen?.some(i => i.typ === 'wechselrichter')) {
          allWarnings.push({
            row: index + 2,
            field: 'PV-Erzeugung',
            message: 'Keine PV-Erzeugung für Wechselrichter angegeben'
          })
        }
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

    if (validatedRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Keine gültigen Datensätze gefunden'
      }, { status: 400 })
    }

    // Berechne abgeleitete Werte für jeden Monat
    const processedData: any[] = []

    for (const row of validatedRows) {
      // Finde zugehörige Investitions-Daten
      const rowInvDaten = allInvestitionsDaten.filter(d => d.jahr === row.jahr && d.monat === row.monat)

      // Berechne abgeleitete Werte
      const calculated = calculateDerivedValues(
        row.einspeisung_kwh,
        row.netzbezug_kwh,
        rowInvDaten,
        investitionen || []
      )

      // Plausibilitätsprüfung
      if (calculated.direktverbrauch < 0) {
        allWarnings.push({
          row: 0,
          field: 'Direktverbrauch',
          message: `${row.jahr}-${String(row.monat).padStart(2, '0')}: Direktverbrauch negativ (${calculated.direktverbrauch.toFixed(1)} kWh). Prüfen Sie PV-Erzeugung, Einspeisung und Batterieladung.`
        })
      }

      // Strompreise für diesen Monat laden
      const strompreise = await loadStrompreise(row.jahr, row.monat)

      // Finanzwerte berechnen
      const einspeisungErtragEuro = strompreise?.einspeiseverguetung_cent_kwh
        ? (row.einspeisung_kwh * strompreise.einspeiseverguetung_cent_kwh / 100)
        : 0

      const netzbezugKostenEuro = strompreise?.netzbezug_cent_kwh
        ? (row.netzbezug_kwh * strompreise.netzbezug_cent_kwh / 100)
        : 0

      processedData.push({
        anlage_id: anlageId,
        jahr: row.jahr,
        monat: row.monat,
        // Eingabewerte
        einspeisung_kwh: row.einspeisung_kwh,
        netzbezug_kwh: row.netzbezug_kwh,
        // Berechnete Werte
        pv_erzeugung_kwh: calculated.pvErzeugung,
        batterieladung_kwh: calculated.batterieLadung,
        batterieentladung_kwh: calculated.batterieEntladung,
        direktverbrauch_kwh: calculated.direktverbrauch,
        gesamtverbrauch_kwh: calculated.gesamtverbrauch,
        // Kennzahlen
        eigenverbrauchsquote_prozent: calculated.eigenverbrauchsquote,
        autarkiegrad_prozent: calculated.autarkiegrad,
        // Finanzen
        einspeisung_ertrag_euro: einspeisungErtragEuro,
        netzbezug_kosten_euro: netzbezugKostenEuro,
        einspeisung_preis_cent_kwh: strompreise?.einspeiseverguetung_cent_kwh || null,
        netzbezug_preis_cent_kwh: strompreise?.netzbezug_cent_kwh || null,
        // Meta
        datenquelle: row.datenquelle || 'CSV-Import',
        notizen: row.notizen || null,
        aktualisiert_am: new Date().toISOString()
      })
    }

    // Preview-Modus: Nur Daten zurückgeben, nicht importieren
    if (isPreview) {
      return NextResponse.json({
        success: true,
        data: processedData,
        investitionsDaten: allInvestitionsDaten,
        warnings: allWarnings
      })
    }

    // === WETTERDATEN AUTOMATISCH ERGÄNZEN ===
    let weatherDataFetched = 0
    const coords = anlage.standort_plz ? getCoordinatesFromPLZ(anlage.standort_plz) : null

    if (coords) {
      for (const data of processedData) {
        const weather = await getMonthlyWeatherData(coords.lat, coords.lon, data.jahr, data.monat)
        if (weather) {
          data.sonnenstunden = weather.sonnenstunden
          data.globalstrahlung_kwh_m2 = weather.globalstrahlung_kwh_m2
          weatherDataFetched++
        }
      }
    }

    // === DATEN IN DB EINFÜGEN ===

    // Prüfe auf Duplikate (Jahr/Monat/Anlage) für Monatsdaten
    const duplicateChecks = await Promise.all(
      processedData.map(d =>
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
      .map((result, i) => result.data ? processedData[i] : null)
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
    const { error: insertError } = await supabase
      .from('monatsdaten')
      .insert(processedData)

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
    let message = `${processedData.length} Monatsdatensätze erfolgreich importiert`
    if (investitionenImported > 0) {
      message += `, ${investitionenImported} Investitions-Datensätze`
    }
    if (weatherDataFetched > 0) {
      message += ` (${weatherDataFetched}× Wetterdaten ergänzt)`
    }

    return NextResponse.json({
      success: true,
      message,
      data: processedData,
      investitionsDaten: allInvestitionsDaten,
      warnings: allWarnings
    })

  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      success: false,
      message: 'Serverfehler: ' + error.message
    }, { status: 500 })
  }
}
