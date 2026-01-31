// components/MonatsdatenFormDynamic.tsx
// Dynamisches Monatsdaten-Formular - erfasst nur Rohdaten, berechnet den Rest
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SimpleIcon from './SimpleIcon'
import { getMonthlyWeatherData, getCoordinatesFromPLZ } from '@/lib/weather-api'

interface Investition {
  id: string
  typ: string
  bezeichnung: string
  parameter?: any
}

interface ExistingData {
  id: string
  jahr: number
  monat: number
  einspeisung_kwh?: number
  netzbezug_kwh?: number
  // Berechnete Werte (nur für Anzeige im Edit-Mode)
  pv_erzeugung_kwh?: number
  gesamtverbrauch_kwh?: number
  direktverbrauch_kwh?: number
  batterieentladung_kwh?: number
  batterieladung_kwh?: number
  einspeisung_preis_cent_kwh?: number
  netzbezug_preis_cent_kwh?: number
  notizen?: string
  datenquelle?: string
}

interface MonatsdatenFormDynamicProps {
  anlage: any
  investitionen: Investition[]
  existingData?: ExistingData | null
  existingInvestitionsDaten?: Record<string, any>
  onSuccess?: () => void
}

export default function MonatsdatenFormDynamic({
  anlage,
  investitionen,
  existingData,
  existingInvestitionsDaten,
  onSuccess
}: MonatsdatenFormDynamicProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingWeather, setLoadingWeather] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [savedData, setSavedData] = useState<any>(null) // Für Ergebnis-Ansicht
  const [wetterDaten, setWetterDaten] = useState<{ sonnenstunden: number, globalstrahlung_kwh_m2: number } | null>(null)

  const isEditMode = !!existingData

  // Strompreise aus Stammdaten
  const [stammStrompreise, setStammStrompreise] = useState<{
    netzbezug_cent_kwh: number | null
    einspeiseverguetung_cent_kwh: number | null
  }>({ netzbezug_cent_kwh: null, einspeiseverguetung_cent_kwh: null })

  // Welche Investitionstypen sind vorhanden?
  const hatWechselrichter = investitionen.some(i => i.typ === 'wechselrichter')
  const hatSpeicher = investitionen.some(i => i.typ === 'speicher')
  const hatEAuto = investitionen.some(i => i.typ === 'e-auto')
  const hatWaermepumpe = investitionen.some(i => i.typ === 'waermepumpe')

  // Formular State - NUR Rohdaten
  const [formData, setFormData] = useState(() => ({
    jahr: existingData?.jahr || new Date().getFullYear(),
    monat: existingData?.monat || new Date().getMonth() + 1,
    // Zählerstände (Eingabe)
    einspeisung_kwh: existingData?.einspeisung_kwh?.toString() || '',
    netzbezug_kwh: existingData?.netzbezug_kwh?.toString() || '',
    // Optional
    notizen: existingData?.notizen || '',
    datenquelle: existingData?.datenquelle || ''
  }))

  // Investitions-spezifische Daten
  const [investitionsDaten, setInvestitionsDaten] = useState<Record<string, any>>({})

  // Initialisiere Investitions-Daten
  useEffect(() => {
    const initial: Record<string, any> = {}
    investitionen.forEach(inv => {
      const existing = existingInvestitionsDaten?.[inv.id]

      if (inv.typ === 'wechselrichter') {
        initial[inv.id] = {
          pv_erzeugung_kwh: existing?.pv_erzeugung_ist_kwh?.toString() || ''
        }
      } else if (inv.typ === 'speicher') {
        initial[inv.id] = {
          entladung_kwh: existing?.entladung_kwh?.toString() || '',
          ladung_kwh: existing?.ladung_kwh?.toString() || ''
        }
      } else if (inv.typ === 'e-auto') {
        initial[inv.id] = {
          km_gefahren: existing?.km_gefahren?.toString() || '',
          verbrauch_kwh: existing?.verbrauch_kwh?.toString() || '',
          ladung_pv_kwh: existing?.ladung_pv_kwh?.toString() || '',
          ladung_netz_kwh: existing?.ladung_netz_kwh?.toString() || ''
        }
      } else if (inv.typ === 'waermepumpe') {
        initial[inv.id] = {
          heizenergie_kwh: existing?.heizenergie_kwh?.toString() || '',
          warmwasser_kwh: existing?.warmwasser_kwh?.toString() || '',
          stromverbrauch_kwh: existing?.stromverbrauch_kwh?.toString() || ''
        }
      }
    })
    setInvestitionsDaten(initial)
  }, [investitionen, existingInvestitionsDaten])

  // Strompreise aus Stammdaten laden (für den gewählten Monat)
  useEffect(() => {
    const loadStrompreise = async () => {
      if (!anlage?.mitglied_id) return

      try {
        const supabase = createBrowserClient()

        // Stichtag auf Mitte des gewählten Monats setzen
        const stichtag = `${formData.jahr}-${String(formData.monat).padStart(2, '0')}-15`

        const { data, error } = await supabase.rpc('get_aktueller_strompreis', {
          p_mitglied_id: anlage.mitglied_id,
          p_anlage_id: anlage.id,
          p_stichtag: stichtag
        })

        if (!error && data && data.length > 0) {
          setStammStrompreise({
            netzbezug_cent_kwh: data[0].netzbezug_cent_kwh,
            einspeiseverguetung_cent_kwh: data[0].einspeiseverguetung_cent_kwh
          })
        } else {
          // Falls keine Daten gefunden, zurücksetzen
          setStammStrompreise({
            netzbezug_cent_kwh: null,
            einspeiseverguetung_cent_kwh: null
          })
        }
      } catch (err) {
        console.error('Fehler beim Laden der Strompreise:', err)
      }
    }

    loadStrompreise()
  }, [anlage?.mitglied_id, anlage?.id, formData.jahr, formData.monat])

  // Alle berechneten Werte
  const berechneteWerte = useMemo(() => {
    // Eingabewerte
    const einspeisung = parseFloat(formData.einspeisung_kwh) || 0
    const netzbezug = parseFloat(formData.netzbezug_kwh) || 0

    // Summen aus Investitionen
    let pvErzeugung = 0
    let batterieLadung = 0
    let batterieEntladung = 0
    let speicherKapazitaet = 0 // Gesamte Speicherkapazität in kWh
    let eAutoLadungPv = 0
    let eAutoLadungNetz = 0
    let eAutoKmGefahren = 0
    let eAutoVerbrauch = 0
    let waermepumpeStrom = 0
    let waermepumpeHeizenergie = 0
    let waermepumpeWarmwasser = 0

    investitionen.forEach(inv => {
      const daten = investitionsDaten[inv.id]

      if (inv.typ === 'wechselrichter') {
        pvErzeugung += parseFloat(daten?.pv_erzeugung_kwh) || 0
      } else if (inv.typ === 'speicher') {
        batterieLadung += parseFloat(daten?.ladung_kwh) || 0
        batterieEntladung += parseFloat(daten?.entladung_kwh) || 0
        // Speicherkapazität aus Parameter lesen
        speicherKapazitaet += parseFloat(inv.parameter?.kapazitaet_kwh) || 0
      } else if (inv.typ === 'e-auto') {
        eAutoLadungPv += parseFloat(daten?.ladung_pv_kwh) || 0
        eAutoLadungNetz += parseFloat(daten?.ladung_netz_kwh) || 0
        eAutoKmGefahren += parseFloat(daten?.km_gefahren) || 0
        eAutoVerbrauch += parseFloat(daten?.verbrauch_kwh) || 0
      } else if (inv.typ === 'waermepumpe') {
        waermepumpeStrom += parseFloat(daten?.stromverbrauch_kwh) || 0
        waermepumpeHeizenergie += parseFloat(daten?.heizenergie_kwh) || 0
        waermepumpeWarmwasser += parseFloat(daten?.warmwasser_kwh) || 0
      }
    })

    // Berechnungen
    // Direktverbrauch = Was direkt von der PV verbraucht wird (ohne Batterie-Umweg)
    const direktverbrauch = pvErzeugung - einspeisung - batterieLadung

    // Eigenverbrauch = Direktverbrauch + was aus der Batterie kommt
    const eigenverbrauch = direktverbrauch + batterieEntladung

    // Gesamtverbrauch = Eigenverbrauch + Netzbezug
    const gesamtverbrauch = eigenverbrauch + netzbezug

    // Kennzahlen
    const eigenverbrauchsquote = pvErzeugung > 0 ? (eigenverbrauch / pvErzeugung) * 100 : 0
    const direktverbrauchsquote = pvErzeugung > 0 ? (direktverbrauch / pvErzeugung) * 100 : 0
    const autarkiegrad = gesamtverbrauch > 0 ? (eigenverbrauch / gesamtverbrauch) * 100 : 0

    // Spezifischer Ertrag (kWh pro kWp)
    const anlagenLeistungKwp = anlage?.leistung_kwp || 0
    const spezifischerErtrag = anlagenLeistungKwp > 0 ? pvErzeugung / anlagenLeistungKwp : 0

    // Batterie-Kennzahlen
    const batteriezyklen = speicherKapazitaet > 0 ? batterieLadung / speicherKapazitaet : 0
    const batterieWirkungsgrad = batterieLadung > 0 ? (batterieEntladung / batterieLadung) * 100 : 0

    // E-Auto Kennzahlen
    const eAutoLadungGesamt = eAutoLadungPv + eAutoLadungNetz
    const eAutoVerbrauchPro100km = eAutoKmGefahren > 0 ? (eAutoVerbrauch / eAutoKmGefahren) * 100 : 0
    const eAutoPvLadeanteil = eAutoLadungGesamt > 0 ? (eAutoLadungPv / eAutoLadungGesamt) * 100 : 0

    // Wärmepumpe Kennzahlen
    const waermepumpeWaermeGesamt = waermepumpeHeizenergie + waermepumpeWarmwasser
    const waermepumpeArbeitszahl = waermepumpeStrom > 0 ? waermepumpeWaermeGesamt / waermepumpeStrom : 0
    const waermepumpeHeizanteil = waermepumpeWaermeGesamt > 0 ? (waermepumpeHeizenergie / waermepumpeWaermeGesamt) * 100 : 0

    // Plausibilitätsprüfung
    const bilanzOk = direktverbrauch >= 0 && eigenverbrauch >= 0

    // Finanzwerte
    const einspeisungErtragEuro = stammStrompreise.einspeiseverguetung_cent_kwh
      ? (einspeisung * stammStrompreise.einspeiseverguetung_cent_kwh / 100)
      : null

    const netzbezugKostenEuro = stammStrompreise.netzbezug_cent_kwh
      ? (netzbezug * stammStrompreise.netzbezug_cent_kwh / 100)
      : null

    return {
      // Summen
      pvErzeugung,
      batterieLadung,
      batterieEntladung,
      speicherKapazitaet,
      eAutoLadungPv,
      eAutoLadungNetz,
      eAutoLadungGesamt,
      eAutoKmGefahren,
      eAutoVerbrauch,
      waermepumpeStrom,
      waermepumpeHeizenergie,
      waermepumpeWarmwasser,
      waermepumpeWaermeGesamt,
      // Berechnete Werte
      direktverbrauch,
      eigenverbrauch,
      gesamtverbrauch,
      // Kennzahlen PV
      eigenverbrauchsquote,
      direktverbrauchsquote,
      autarkiegrad,
      spezifischerErtrag,
      // Kennzahlen Batterie
      batteriezyklen,
      batterieWirkungsgrad,
      // Kennzahlen E-Auto
      eAutoVerbrauchPro100km,
      eAutoPvLadeanteil,
      // Kennzahlen Wärmepumpe
      waermepumpeArbeitszahl,
      waermepumpeHeizanteil,
      bilanzOk,
      // Finanzen
      einspeisungErtragEuro,
      netzbezugKostenEuro
    }
  }, [formData, investitionsDaten, investitionen, stammStrompreise])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleInvestitionChange = (investitionId: string, field: string, value: string) => {
    setInvestitionsDaten(prev => ({
      ...prev,
      [investitionId]: {
        ...prev[investitionId],
        [field]: value
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createBrowserClient()

      // 1. Monatsdaten speichern (mit berechneten Werten)
      const monatsdaten: any = {
        anlage_id: anlage.id,
        jahr: formData.jahr,
        monat: formData.monat,
        // Eingabewerte
        einspeisung_kwh: parseFloat(formData.einspeisung_kwh) || 0,
        netzbezug_kwh: parseFloat(formData.netzbezug_kwh) || 0,
        // Berechnete Werte
        pv_erzeugung_kwh: berechneteWerte.pvErzeugung,
        batterieladung_kwh: berechneteWerte.batterieLadung,
        batterieentladung_kwh: berechneteWerte.batterieEntladung,
        direktverbrauch_kwh: berechneteWerte.direktverbrauch,
        gesamtverbrauch_kwh: berechneteWerte.gesamtverbrauch,
        // Kennzahlen
        eigenverbrauchsquote_prozent: berechneteWerte.eigenverbrauchsquote,
        autarkiegrad_prozent: berechneteWerte.autarkiegrad,
        // Finanzen
        einspeisung_ertrag_euro: berechneteWerte.einspeisungErtragEuro ?? 0,
        netzbezug_kosten_euro: berechneteWerte.netzbezugKostenEuro ?? 0,
        einspeisung_preis_cent_kwh: stammStrompreise.einspeiseverguetung_cent_kwh,
        netzbezug_preis_cent_kwh: stammStrompreise.netzbezug_cent_kwh,
        // Meta
        notizen: formData.notizen || null,
        datenquelle: formData.datenquelle || (isEditMode ? 'bearbeitet' : 'manuell'),
        aktualisiert_am: new Date().toISOString()
      }

      if (isEditMode && existingData) {
        monatsdaten.id = existingData.id
      }

      const { error: dbError } = await supabase
        .from('monatsdaten')
        .upsert(monatsdaten, { onConflict: isEditMode ? 'id' : 'anlage_id,jahr,monat' })

      if (dbError) throw dbError

      // 2. Investitions-Monatsdaten speichern
      for (const inv of investitionen) {
        const daten = investitionsDaten[inv.id]
        if (!daten) continue

        let verbrauchDaten: any = {}

        if (inv.typ === 'wechselrichter') {
          verbrauchDaten = {
            pv_erzeugung_ist_kwh: parseFloat(daten.pv_erzeugung_kwh) || 0
          }
        } else if (inv.typ === 'speicher') {
          verbrauchDaten = {
            entladung_kwh: parseFloat(daten.entladung_kwh) || 0,
            ladung_kwh: parseFloat(daten.ladung_kwh) || 0
          }
        } else if (inv.typ === 'e-auto') {
          verbrauchDaten = {
            km_gefahren: parseFloat(daten.km_gefahren) || 0,
            verbrauch_kwh: parseFloat(daten.verbrauch_kwh) || 0,
            ladung_pv_kwh: parseFloat(daten.ladung_pv_kwh) || 0,
            ladung_netz_kwh: parseFloat(daten.ladung_netz_kwh) || 0
          }
        } else if (inv.typ === 'waermepumpe') {
          verbrauchDaten = {
            heizenergie_kwh: parseFloat(daten.heizenergie_kwh) || 0,
            warmwasser_kwh: parseFloat(daten.warmwasser_kwh) || 0,
            stromverbrauch_kwh: parseFloat(daten.stromverbrauch_kwh) || 0
          }
        }

        const hatDaten = Object.values(verbrauchDaten).some((v: any) => v > 0)
        if (hatDaten) {
          const { error: invError } = await supabase
            .from('investition_monatsdaten')
            .upsert({
              investition_id: inv.id,
              jahr: formData.jahr,
              monat: formData.monat,
              verbrauch_daten: verbrauchDaten
            }, { onConflict: 'investition_id,jahr,monat' })

          if (invError) {
            console.error(`Fehler bei ${inv.bezeichnung}:`, invError)
          }
        }
      }

      // 3. Wetterdaten abrufen und speichern
      setLoadingWeather(true)
      let fetchedWeather: { sonnenstunden: number, globalstrahlung_kwh_m2: number } | null = null

      try {
        // Koordinaten aus Anlage oder PLZ ermitteln
        let lat = anlage.standort_latitude
        let lon = anlage.standort_longitude

        if (!lat || !lon) {
          // Fallback: Koordinaten aus PLZ
          const coords = getCoordinatesFromPLZ(anlage.standort_plz || '')
          if (coords) {
            lat = coords.lat
            lon = coords.lon
          }
        }

        if (lat && lon) {
          const weather = await getMonthlyWeatherData(lat, lon, formData.jahr, formData.monat)
          if (weather) {
            fetchedWeather = weather
            setWetterDaten(weather)

            // Wetterdaten in DB speichern
            await supabase
              .from('monatsdaten')
              .update({
                sonnenstunden: weather.sonnenstunden,
                globalstrahlung_kwh_m2: weather.globalstrahlung_kwh_m2
              })
              .eq('anlage_id', anlage.id)
              .eq('jahr', formData.jahr)
              .eq('monat', formData.monat)
          }
        }
      } catch (weatherErr) {
        console.error('Fehler beim Abrufen der Wetterdaten:', weatherErr)
        // Kein Fehler anzeigen - Wetterdaten sind optional
      } finally {
        setLoadingWeather(false)
      }

      // Ergebnis-Ansicht vorbereiten
      setSavedData({
        ...monatsdaten,
        berechneteWerte,
        investitionsDaten,
        wetterDaten: fetchedWeather
      })

      setSuccess(isEditMode ? 'Monatsdaten erfolgreich aktualisiert!' : 'Monatsdaten erfolgreich gespeichert!')

    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const monate = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ]

  // Ergebnis-Ansicht nach dem Speichern
  if (savedData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <SimpleIcon type="check" className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {monate[formData.monat - 1]} {formData.jahr} gespeichert
            </h2>
            <p className="text-sm text-gray-600">Hier ist die Zusammenfassung der erfassten und berechneten Werte</p>
          </div>
        </div>

        {/* Erfasste Rohdaten */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <SimpleIcon type="edit" className="w-5 h-5 text-blue-500" />
            Erfasste Werte
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Einspeisung:</span>
                <span className="float-right font-medium">{savedData.einspeisung_kwh.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-blue-700">Netzbezug:</span>
                <span className="float-right font-medium">{savedData.netzbezug_kwh.toFixed(1)} kWh</span>
              </div>
              {berechneteWerte.pvErzeugung > 0 && (
                <div>
                  <span className="text-blue-700">PV (Σ Wechselrichter):</span>
                  <span className="float-right font-medium">{berechneteWerte.pvErzeugung.toFixed(1)} kWh</span>
                </div>
              )}
              {berechneteWerte.batterieEntladung > 0 && (
                <div>
                  <span className="text-blue-700">Batterie (Σ Speicher):</span>
                  <span className="float-right font-medium">
                    +{berechneteWerte.batterieEntladung.toFixed(1)} / -{berechneteWerte.batterieLadung.toFixed(1)} kWh
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Berechnete Werte */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <SimpleIcon type="calculator" className="w-5 h-5 text-green-500" />
            Berechnete Werte
          </h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-green-700">Direktverbrauch:</span>
                <span className="float-right font-medium">{berechneteWerte.direktverbrauch.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-green-700">Eigenverbrauch:</span>
                <span className="float-right font-medium">{berechneteWerte.eigenverbrauch.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-green-700">Gesamtverbrauch:</span>
                <span className="float-right font-medium">{berechneteWerte.gesamtverbrauch.toFixed(1)} kWh</span>
              </div>
            </div>
          </div>
        </div>

        {/* Kennzahlen */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <SimpleIcon type="chart" className="w-5 h-5 text-purple-500" />
            Kennzahlen
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{berechneteWerte.eigenverbrauchsquote.toFixed(1)}%</div>
              <div className="text-xs text-yellow-600">Eigenverbrauchsquote</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{berechneteWerte.direktverbrauchsquote.toFixed(1)}%</div>
              <div className="text-xs text-yellow-600">Direktverbrauchsquote</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{berechneteWerte.autarkiegrad.toFixed(1)}%</div>
              <div className="text-xs text-blue-600">Autarkiegrad</div>
            </div>
            {berechneteWerte.spezifischerErtrag > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{berechneteWerte.spezifischerErtrag.toFixed(1)}</div>
                <div className="text-xs text-orange-600">kWh/kWp</div>
              </div>
            )}
          </div>

          {/* Batterie-Kennzahlen (nur wenn Speicher vorhanden) */}
          {berechneteWerte.batterieLadung > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{berechneteWerte.batteriezyklen.toFixed(1)}</div>
                <div className="text-xs text-green-600">Batteriezyklen</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{berechneteWerte.batterieWirkungsgrad.toFixed(1)}%</div>
                <div className="text-xs text-green-600">Batterie-Wirkungsgrad</div>
              </div>
              {berechneteWerte.speicherKapazitaet > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{berechneteWerte.speicherKapazitaet.toFixed(1)} kWh</div>
                  <div className="text-xs text-green-600">Speicherkapazität</div>
                </div>
              )}
            </div>
          )}

          {/* E-Auto-Kennzahlen (nur wenn E-Auto Daten vorhanden) */}
          {berechneteWerte.eAutoLadungGesamt > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{berechneteWerte.eAutoVerbrauchPro100km.toFixed(1)}</div>
                <div className="text-xs text-blue-600">kWh/100km</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{berechneteWerte.eAutoPvLadeanteil.toFixed(1)}%</div>
                <div className="text-xs text-blue-600">PV-Ladeanteil</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{berechneteWerte.eAutoLadungGesamt.toFixed(1)} kWh</div>
                <div className="text-xs text-blue-600">Ladung Gesamt</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{berechneteWerte.eAutoKmGefahren.toFixed(0)} km</div>
                <div className="text-xs text-blue-600">Gefahrene km</div>
              </div>
            </div>
          )}

          {/* Wärmepumpe-Kennzahlen (nur wenn Wärmepumpe Daten vorhanden) */}
          {berechneteWerte.waermepumpeWaermeGesamt > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{berechneteWerte.waermepumpeArbeitszahl.toFixed(2)}</div>
                <div className="text-xs text-orange-600">Arbeitszahl (COP)</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{berechneteWerte.waermepumpeHeizanteil.toFixed(1)}%</div>
                <div className="text-xs text-orange-600">Heizanteil</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{berechneteWerte.waermepumpeWaermeGesamt.toFixed(1)} kWh</div>
                <div className="text-xs text-orange-600">Wärme Gesamt</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{berechneteWerte.waermepumpeStrom.toFixed(1)} kWh</div>
                <div className="text-xs text-orange-600">Stromverbrauch</div>
              </div>
            </div>
          )}

          {/* Finanz-Kennzahlen */}
          {(berechneteWerte.einspeisungErtragEuro !== null || berechneteWerte.netzbezugKostenEuro !== null) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {berechneteWerte.einspeisungErtragEuro !== null && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">+{berechneteWerte.einspeisungErtragEuro.toFixed(2)} €</div>
                  <div className="text-xs text-green-600">Einspeise-Erlös</div>
                </div>
              )}
              {berechneteWerte.netzbezugKostenEuro !== null && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">-{berechneteWerte.netzbezugKostenEuro.toFixed(2)} €</div>
                  <div className="text-xs text-red-600">Netzbezugskosten</div>
                </div>
              )}
              {berechneteWerte.einspeisungErtragEuro !== null && berechneteWerte.netzbezugKostenEuro !== null && (
                <div className={`rounded-lg p-3 text-center ${
                  (berechneteWerte.einspeisungErtragEuro - berechneteWerte.netzbezugKostenEuro) >= 0
                    ? 'bg-green-100 border border-green-300'
                    : 'bg-red-100 border border-red-300'
                }`}>
                  <div className={`text-2xl font-bold ${
                    (berechneteWerte.einspeisungErtragEuro - berechneteWerte.netzbezugKostenEuro) >= 0
                      ? 'text-green-800'
                      : 'text-red-800'
                  }`}>
                    {(berechneteWerte.einspeisungErtragEuro - berechneteWerte.netzbezugKostenEuro) >= 0 ? '+' : ''}
                    {(berechneteWerte.einspeisungErtragEuro - berechneteWerte.netzbezugKostenEuro).toFixed(2)} €
                  </div>
                  <div className="text-xs text-gray-600">Bilanz Monat</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wetterdaten */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <SimpleIcon type="sun" className="w-5 h-5 text-yellow-500" />
            Wetterdaten (Open-Meteo)
          </h3>
          {loadingWeather ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-700">Wetterdaten werden abgerufen...</p>
            </div>
          ) : savedData.wetterDaten ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700">{savedData.wetterDaten.sonnenstunden.toFixed(1)} h</div>
                <div className="text-xs text-yellow-600">Sonnenstunden</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{savedData.wetterDaten.globalstrahlung_kwh_m2.toFixed(1)} kWh/m²</div>
                <div className="text-xs text-orange-600">Globalstrahlung</div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">Wetterdaten nicht verfügbar (Monat evtl. noch nicht abgeschlossen)</p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={() => {
              setSavedData(null)
              setWetterDaten(null)
              if (!isEditMode) {
                // Formular für nächsten Monat zurücksetzen
                setFormData(prev => ({
                  ...prev,
                  einspeisung_kwh: '',
                  netzbezug_kwh: '',
                  notizen: ''
                }))
                // Investitionsdaten zurücksetzen
                const reset: Record<string, any> = {}
                investitionen.forEach(inv => {
                  if (inv.typ === 'wechselrichter') reset[inv.id] = { pv_erzeugung_kwh: '' }
                  else if (inv.typ === 'speicher') reset[inv.id] = { entladung_kwh: '', ladung_kwh: '' }
                  else if (inv.typ === 'e-auto') reset[inv.id] = { km_gefahren: '', verbrauch_kwh: '', ladung_pv_kwh: '', ladung_netz_kwh: '' }
                  else if (inv.typ === 'waermepumpe') reset[inv.id] = { heizenergie_kwh: '', warmwasser_kwh: '', stromverbrauch_kwh: '' }
                })
                setInvestitionsDaten(reset)
              }
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
          >
            Weiteren Monat erfassen
          </button>
          <button
            onClick={() => {
              router.push('/uebersicht')
              router.refresh()
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
          >
            Zur Übersicht
          </button>
        </div>
      </div>
    )
  }

  // Eingabe-Formular
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <SimpleIcon type={isEditMode ? 'edit' : 'plus'} className="w-5 h-5 text-blue-600" />
        {isEditMode
          ? `${monate[existingData!.monat - 1]} ${existingData!.jahr} bearbeiten`
          : 'Monatsdaten erfassen'
        }
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Zeitraum */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jahr *</label>
            <input
              type="number"
              name="jahr"
              value={formData.jahr}
              onChange={handleChange}
              required
              disabled={isEditMode}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monat *</label>
            <select
              name="monat"
              value={formData.monat}
              onChange={handleChange}
              required
              disabled={isEditMode}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isEditMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              {monate.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Wechselrichter / PV-Erzeugung */}
        {hatWechselrichter ? (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="sun" className="w-5 h-5 text-yellow-500" />
              PV-Erzeugung (vom Wechselrichter ablesen)
            </h3>
            <div className="space-y-3">
              {investitionen.filter(i => i.typ === 'wechselrichter').map(inv => (
                <div key={inv.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-yellow-800 mb-2">
                    {inv.bezeichnung} (kWh) *
                  </label>
                  <input
                    type="number"
                    value={investitionsDaten[inv.id]?.pv_erzeugung_kwh || ''}
                    onChange={(e) => handleInvestitionChange(inv.id, 'pv_erzeugung_kwh', e.target.value)}
                    required
                    step="0.1"
                    placeholder="z.B. 450"
                    className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              ))}
              {investitionen.filter(i => i.typ === 'wechselrichter').length > 1 && (
                <p className="text-sm text-yellow-700 font-medium">
                  Gesamt PV-Erzeugung: {berechneteWerte.pvErzeugung.toFixed(1)} kWh
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              Kein Wechselrichter angelegt. Bitte zuerst unter Investitionen einen Wechselrichter anlegen.
            </p>
          </div>
        )}

        {/* Speicher */}
        {hatSpeicher && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="battery" className="w-5 h-5 text-green-500" />
              Batteriespeicher
            </h3>
            {investitionen.filter(i => i.typ === 'speicher').map(inv => (
              <div key={inv.id} className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                <p className="text-sm font-medium text-green-800 mb-3">{inv.bezeichnung}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2">
                      Ladung (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.ladung_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'ladung_kwh', e.target.value)}
                      step="0.1"
                      placeholder="z.B. 60"
                      className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2">
                      Entladung (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.entladung_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'entladung_kwh', e.target.value)}
                      step="0.1"
                      placeholder="z.B. 50"
                      className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Zählerstände */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="grid" className="w-5 h-5 text-gray-500" />
            Stromzähler (Zweirichtungszähler)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Einspeisung (kWh) *
              </label>
              <input
                type="number"
                name="einspeisung_kwh"
                value={formData.einspeisung_kwh}
                onChange={handleChange}
                required
                step="0.1"
                placeholder="z.B. 320"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Ins Netz eingespeist</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Netzbezug (kWh) *
              </label>
              <input
                type="number"
                name="netzbezug_kwh"
                value={formData.netzbezug_kwh}
                onChange={handleChange}
                required
                step="0.1"
                placeholder="z.B. 170"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Vom Netz bezogen</p>
            </div>
          </div>

          {/* Strompreise-Info */}
          {stammStrompreise.netzbezug_cent_kwh !== null || stammStrompreise.einspeiseverguetung_cent_kwh !== null ? (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-700 mb-1">Hinterlegte Strompreise für {monate[formData.monat - 1]} {formData.jahr}:</p>
              <div className="flex gap-4 text-sm">
                {stammStrompreise.einspeiseverguetung_cent_kwh !== null && (
                  <span>Einspeisevergütung: <strong>{stammStrompreise.einspeiseverguetung_cent_kwh.toFixed(2)} ct/kWh</strong></span>
                )}
                {stammStrompreise.netzbezug_cent_kwh !== null && (
                  <span>Netzbezug: <strong>{stammStrompreise.netzbezug_cent_kwh.toFixed(2)} ct/kWh</strong></span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                Keine Strompreise für {monate[formData.monat - 1]} {formData.jahr} hinterlegt.
                <a href="/stammdaten/strompreise" className="underline ml-1">Strompreise erfassen</a>
              </p>
            </div>
          )}
        </div>

        {/* E-Auto */}
        {hatEAuto && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="car" className="w-5 h-5 text-blue-500" />
              E-Auto
            </h3>
            {investitionen.filter(i => i.typ === 'e-auto').map(inv => (
              <div key={inv.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                <p className="text-sm font-medium text-blue-800 mb-3">{inv.bezeichnung}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">km gefahren</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.km_gefahren || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'km_gefahren', e.target.value)}
                      step="1"
                      placeholder="1500"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Verbrauch (kWh)</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.verbrauch_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'verbrauch_kwh', e.target.value)}
                      step="0.1"
                      placeholder="270"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Ladung PV (kWh)</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.ladung_pv_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'ladung_pv_kwh', e.target.value)}
                      step="0.1"
                      placeholder="200"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Ladung Netz (kWh)</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.ladung_netz_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'ladung_netz_kwh', e.target.value)}
                      step="0.1"
                      placeholder="70"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Wärmepumpe */}
        {hatWaermepumpe && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="heat" className="w-5 h-5 text-orange-500" />
              Wärmepumpe
            </h3>
            {investitionen.filter(i => i.typ === 'waermepumpe').map(inv => (
              <div key={inv.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-3">
                <p className="text-sm font-medium text-orange-800 mb-3">{inv.bezeichnung}</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-2">Heizenergie (kWh)</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.heizenergie_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'heizenergie_kwh', e.target.value)}
                      step="0.1"
                      placeholder="600"
                      className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-2">Warmwasser (kWh)</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.warmwasser_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'warmwasser_kwh', e.target.value)}
                      step="0.1"
                      placeholder="150"
                      className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-2">Stromverbrauch (kWh)</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.stromverbrauch_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'stromverbrauch_kwh', e.target.value)}
                      step="0.1"
                      placeholder="250"
                      className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notizen */}
        <div className="border-t pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notizen (optional)
          </label>
          <textarea
            name="notizen"
            value={formData.notizen}
            onChange={handleChange}
            rows={2}
            placeholder="Optionale Anmerkungen..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Live-Vorschau der berechneten Werte */}
        {(berechneteWerte.pvErzeugung > 0 || parseFloat(formData.netzbezug_kwh) > 0) && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Vorschau (wird berechnet):</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
              <div>
                <span className="text-gray-600">Direktverbrauch:</span>
                <span className={`float-right font-medium ${berechneteWerte.direktverbrauch < 0 ? 'text-red-600' : ''}`}>
                  {berechneteWerte.direktverbrauch.toFixed(1)} kWh
                </span>
              </div>
              <div>
                <span className="text-gray-600">Eigenverbrauch:</span>
                <span className="float-right font-medium">{berechneteWerte.eigenverbrauch.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-gray-600">Gesamtverbrauch:</span>
                <span className="float-right font-medium">{berechneteWerte.gesamtverbrauch.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-gray-600">Bilanz:</span>
                <span className={`float-right font-medium ${berechneteWerte.bilanzOk ? 'text-green-600' : 'text-red-600'}`}>
                  {berechneteWerte.bilanzOk ? 'OK' : 'Prüfen!'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Eigenverbr.quote:</span>
                <span className="float-right font-medium">{berechneteWerte.eigenverbrauchsquote.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-gray-600">Autarkiegrad:</span>
                <span className="float-right font-medium">{berechneteWerte.autarkiegrad.toFixed(1)}%</span>
              </div>
              {berechneteWerte.spezifischerErtrag > 0 && (
                <div>
                  <span className="text-gray-600">kWh/kWp:</span>
                  <span className="float-right font-medium">{berechneteWerte.spezifischerErtrag.toFixed(1)}</span>
                </div>
              )}
              {berechneteWerte.batteriezyklen > 0 && (
                <div>
                  <span className="text-gray-600">Batteriezyklen:</span>
                  <span className="float-right font-medium">{berechneteWerte.batteriezyklen.toFixed(1)}</span>
                </div>
              )}
            </div>
            {/* E-Auto Live-Vorschau */}
            {berechneteWerte.eAutoLadungGesamt > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t border-gray-200">
                <div>
                  <span className="text-blue-600">E-Auto kWh/100km:</span>
                  <span className="float-right font-medium">{berechneteWerte.eAutoVerbrauchPro100km.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-blue-600">PV-Ladeanteil:</span>
                  <span className="float-right font-medium">{berechneteWerte.eAutoPvLadeanteil.toFixed(1)}%</span>
                </div>
              </div>
            )}
            {/* Wärmepumpe Live-Vorschau */}
            {berechneteWerte.waermepumpeWaermeGesamt > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t border-gray-200">
                <div>
                  <span className="text-orange-600">Arbeitszahl (COP):</span>
                  <span className="float-right font-medium">{berechneteWerte.waermepumpeArbeitszahl.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-orange-600">Heizanteil:</span>
                  <span className="float-right font-medium">{berechneteWerte.waermepumpeHeizanteil.toFixed(1)}%</span>
                </div>
              </div>
            )}
            {!berechneteWerte.bilanzOk && (
              <p className="mt-2 text-xs text-red-600">
                Hinweis: Direktverbrauch ist negativ. Bitte Eingaben prüfen (PV-Erzeugung, Einspeisung, Batterieladung).
              </p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-md font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading || !berechneteWerte.bilanzOk}
            className={`px-6 py-3 rounded-md font-medium text-white ${
              loading || !berechneteWerte.bilanzOk
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
