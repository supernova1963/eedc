// lib/weather-api.ts
// Open-Meteo API Integration für historische Wetterdaten
// Kostenlos, kein API-Key erforderlich
// Docs: https://open-meteo.com/en/docs/historical-weather-api

interface MonthlyWeatherData {
  sonnenstunden: number        // Stunden im Monat
  globalstrahlung_kwh_m2: number  // kWh/m² im Monat
}

interface DailyWeatherResponse {
  daily: {
    time: string[]
    sunshine_duration: number[]  // Sekunden pro Tag
    shortwave_radiation_sum: number[]  // MJ/m² pro Tag
  }
}

// PLZ zu Koordinaten Mapping (Deutsche PLZ-Bereiche - Näherungswerte)
// Für genauere Daten könnte man eine externe Geocoding-API nutzen
const PLZ_COORDINATES: Record<string, { lat: number, lon: number }> = {
  // Große Städte / PLZ-Bereiche
  '01': { lat: 51.05, lon: 13.74 },   // Dresden
  '04': { lat: 51.34, lon: 12.37 },   // Leipzig
  '10': { lat: 52.52, lon: 13.41 },   // Berlin
  '20': { lat: 53.55, lon: 9.99 },    // Hamburg
  '30': { lat: 52.37, lon: 9.74 },    // Hannover
  '40': { lat: 51.23, lon: 6.78 },    // Düsseldorf
  '50': { lat: 50.94, lon: 6.96 },    // Köln
  '60': { lat: 50.11, lon: 8.68 },    // Frankfurt
  '70': { lat: 48.78, lon: 9.18 },    // Stuttgart
  '80': { lat: 48.14, lon: 11.58 },   // München
  '90': { lat: 49.45, lon: 11.08 },   // Nürnberg
  // Österreich
  '1': { lat: 48.21, lon: 16.37 },    // Wien (1xxx)
  '2': { lat: 47.81, lon: 16.24 },    // Burgenland/NÖ
  '3': { lat: 48.20, lon: 15.63 },    // NÖ West
  '4': { lat: 48.31, lon: 14.29 },    // OÖ
  '5': { lat: 47.80, lon: 13.04 },    // Salzburg
  '6': { lat: 47.26, lon: 11.39 },    // Tirol
  '7': { lat: 47.05, lon: 15.44 },    // Steiermark
  '8': { lat: 47.07, lon: 15.44 },    // Graz
  '9': { lat: 46.62, lon: 14.31 },    // Kärnten
}

// Koordinaten aus PLZ ermitteln (Näherung)
export function getCoordinatesFromPLZ(plz: string): { lat: number, lon: number } | null {
  if (!plz) return null

  // Versuche exakte PLZ-Präfixe (2-stellig für DE, 1-stellig für AT)
  const prefix2 = plz.substring(0, 2)
  const prefix1 = plz.substring(0, 1)

  if (PLZ_COORDINATES[prefix2]) {
    return PLZ_COORDINATES[prefix2]
  }

  if (PLZ_COORDINATES[prefix1]) {
    return PLZ_COORDINATES[prefix1]
  }

  // Fallback: Mitte Deutschlands
  return { lat: 51.0, lon: 10.0 }
}

// Wetterdaten für einen Monat abrufen
export async function getMonthlyWeatherData(
  lat: number,
  lon: number,
  year: number,
  month: number
): Promise<MonthlyWeatherData | null> {
  try {
    // Datum-Range für den Monat berechnen
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate() // Letzter Tag des Monats
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Prüfen ob Datum in der Vergangenheit liegt (API hat 2 Tage Verzögerung)
    const today = new Date()
    const endDateObj = new Date(endDate)
    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)

    if (endDateObj > twoDaysAgo) {
      console.log(`Wetterdaten für ${year}-${month} noch nicht verfügbar (max. 2 Tage Verzögerung)`)
      return null
    }

    const url = `https://archive-api.open-meteo.com/v1/archive?` +
      `latitude=${lat}&longitude=${lon}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&daily=sunshine_duration,shortwave_radiation_sum` +
      `&timezone=Europe/Berlin`

    const response = await fetch(url)

    if (!response.ok) {
      console.error(`Open-Meteo API Fehler: ${response.status}`)
      return null
    }

    const data: DailyWeatherResponse = await response.json()

    if (!data.daily || !data.daily.sunshine_duration || !data.daily.shortwave_radiation_sum) {
      console.error('Unerwartete API-Antwort:', data)
      return null
    }

    // Sonnenstunden summieren (API liefert Sekunden pro Tag)
    const totalSunshineSeconds = data.daily.sunshine_duration.reduce((sum, val) => sum + (val || 0), 0)
    const sonnenstunden = totalSunshineSeconds / 3600 // Sekunden → Stunden

    // Globalstrahlung summieren (API liefert MJ/m² pro Tag)
    const totalRadiationMJ = data.daily.shortwave_radiation_sum.reduce((sum, val) => sum + (val || 0), 0)
    // MJ/m² → kWh/m² (1 MJ = 0.2778 kWh)
    const globalstrahlung_kwh_m2 = totalRadiationMJ * 0.2778

    return {
      sonnenstunden: Math.round(sonnenstunden * 10) / 10,  // 1 Dezimalstelle
      globalstrahlung_kwh_m2: Math.round(globalstrahlung_kwh_m2 * 10) / 10
    }
  } catch (error) {
    console.error('Fehler beim Abrufen der Wetterdaten:', error)
    return null
  }
}

// Wetterdaten für mehrere Monate abrufen
export async function getWeatherDataForMonths(
  plz: string,
  months: Array<{ year: number, month: number }>
): Promise<Map<string, MonthlyWeatherData>> {
  const results = new Map<string, MonthlyWeatherData>()

  const coords = getCoordinatesFromPLZ(plz)
  if (!coords) {
    console.error('Keine Koordinaten für PLZ:', plz)
    return results
  }

  // Sequentiell abrufen um API nicht zu überlasten
  for (const { year, month } of months) {
    const key = `${year}-${month}`
    const data = await getMonthlyWeatherData(coords.lat, coords.lon, year, month)
    if (data) {
      results.set(key, data)
    }
    // Kleine Pause zwischen Anfragen
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}
