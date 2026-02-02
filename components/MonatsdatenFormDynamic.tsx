// components/MonatsdatenFormDynamic.tsx
// Dynamisches Monatsdaten-Formular - erfasst nur Rohdaten, berechnet den Rest
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SimpleIcon from './SimpleIcon'
import FormelTooltip, { fmtCalc } from './FormelTooltip'
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
  const hatWallbox = investitionen.some(i => i.typ === 'wallbox')

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
      } else if (inv.typ === 'wallbox') {
        initial[inv.id] = {
          ladung_kwh: existing?.ladung_kwh?.toString() || '',
          ladevorgaenge: existing?.ladevorgaenge?.toString() || ''
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
    let wallboxLadung = 0
    let wallboxLadevorgaenge = 0

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
      } else if (inv.typ === 'wallbox') {
        wallboxLadung += parseFloat(daten?.ladung_kwh) || 0
        wallboxLadevorgaenge += parseFloat(daten?.ladevorgaenge) || 0
      }
    })

    // Berechnungen
    // Verfügbare PV-Energie nach Einspeisung
    const pvNachEinspeisung = pvErzeugung - einspeisung

    // Batterieladung kann aus PV ODER aus Netz kommen
    // Ladung aus PV ist maximal das, was nach Einspeisung noch da ist
    const batterieLadungAusPV = Math.min(batterieLadung, Math.max(0, pvNachEinspeisung))
    const batterieLadungAusNetz = batterieLadung - batterieLadungAusPV

    // Direktverbrauch = Was direkt von der PV verbraucht wird (ohne Batterie-Umweg)
    const direktverbrauch = pvNachEinspeisung - batterieLadungAusPV

    // Eigenverbrauch = Direktverbrauch + was aus der Batterie kommt
    const eigenverbrauch = direktverbrauch + batterieEntladung

    // Gesamtverbrauch = Eigenverbrauch + Netzbezug (Netzbezug inkl. Batterie-Ladung aus Netz)
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

    // Wallbox Kennzahlen - Vergleich mit E-Auto Ladung
    // Wenn Wallbox-Ladung < E-Auto-Ladung gesamt → extern geladen
    const wallboxExternGeladen = eAutoLadungGesamt > wallboxLadung ? eAutoLadungGesamt - wallboxLadung : 0
    const wallboxKwhProLadevorgang = wallboxLadevorgaenge > 0 ? wallboxLadung / wallboxLadevorgaenge : 0

    // Plausibilitätsprüfung
    const bilanzOk = direktverbrauch >= 0 && eigenverbrauch >= 0

    // Finanzwerte
    const einspeisungErtragEuro = stammStrompreise.einspeiseverguetung_cent_kwh
      ? (einspeisung * stammStrompreise.einspeiseverguetung_cent_kwh / 100)
      : null

    const netzbezugKostenEuro = stammStrompreise.netzbezug_cent_kwh
      ? (netzbezug * stammStrompreise.netzbezug_cent_kwh / 100)
      : null

    // Eigenverbrauch-Einsparung = Was wir durch Eigenverbrauch an Netzbezugskosten gespart haben
    const eigenverbrauchEinsparungEuro = stammStrompreise.netzbezug_cent_kwh
      ? (eigenverbrauch * stammStrompreise.netzbezug_cent_kwh / 100)
      : null

    // Gesamtersparnis durch PV-Anlage = Einspeise-Erlös + Eigenverbrauch-Einsparung
    // OHNE Netzbezugskosten! Der Netzbezug ist allgemeiner Haushaltsverbrauch,
    // keine Kosten der Anlage - diese würden auch ohne PV anfallen.
    const gesamtErsparnisEuro = (eigenverbrauchEinsparungEuro !== null && einspeisungErtragEuro !== null)
      ? (eigenverbrauchEinsparungEuro + einspeisungErtragEuro)
      : null

    return {
      // Summen
      pvErzeugung,
      batterieLadung,
      batterieLadungAusPV,
      batterieLadungAusNetz,
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
      wallboxLadung,
      wallboxLadevorgaenge,
      wallboxExternGeladen,
      wallboxKwhProLadevorgang,
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
      netzbezugKostenEuro,
      eigenverbrauchEinsparungEuro,
      gesamtErsparnisEuro
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

      // 2. Investitions-Monatsdaten speichern mit Einsparungs-Berechnung
      const strompreisNetz = stammStrompreise.netzbezug_cent_kwh || 30 // Fallback 30 ct/kWh

      for (const inv of investitionen) {
        const daten = investitionsDaten[inv.id]
        if (!daten) continue

        let verbrauchDaten: any = {}
        let einsparungMonatEuro: number | null = null
        let co2EinsparungKg: number | null = null

        if (inv.typ === 'wechselrichter') {
          verbrauchDaten = {
            pv_erzeugung_ist_kwh: parseFloat(daten.pv_erzeugung_kwh) || 0
          }
          // Wechselrichter hat keine direkte Einsparung (wird über Eigenverbrauch erfasst)
        } else if (inv.typ === 'speicher') {
          const entladung = parseFloat(daten.entladung_kwh) || 0
          const ladung = parseFloat(daten.ladung_kwh) || 0
          verbrauchDaten = {
            entladung_kwh: entladung,
            ladung_kwh: ladung
          }
          // Speicher-Einsparung: Entladung wird zum Eigenverbrauch und spart Netzbezug
          // Aber: Ladung kommt oft aus PV, daher nur die Netto-Einsparung durch Entladung
          // Vereinfachte Berechnung: Entladung × Strompreis (weil wir sonst Netz bezogen hätten)
          einsparungMonatEuro = entladung * strompreisNetz / 100
          co2EinsparungKg = entladung * 0.4 // ~400g CO2/kWh Strommix
        } else if (inv.typ === 'e-auto') {
          const kmGefahren = parseFloat(daten.km_gefahren) || 0
          const verbrauchKwh = parseFloat(daten.verbrauch_kwh) || 0
          const ladungPvKwh = parseFloat(daten.ladung_pv_kwh) || 0
          const ladungNetzKwh = parseFloat(daten.ladung_netz_kwh) || 0
          verbrauchDaten = {
            km_gefahren: kmGefahren,
            verbrauch_kwh: verbrauchKwh,
            ladung_pv_kwh: ladungPvKwh,
            ladung_netz_kwh: ladungNetzKwh
          }

          // E-Auto Einsparung: Vergleich mit Verbrenner-Alternative
          const benzinPreis = parseFloat(inv.parameter?.benzinpreis_euro_liter) || 1.69
          const verbrennerVerbrauch = parseFloat(inv.parameter?.vergleich_verbrenner_l_100km) || 7.0 // Fallback 7L/100km

          // Spritkosten die wir hätten zahlen müssen
          const spritKostenAlternativ = (kmGefahren / 100) * verbrennerVerbrauch * benzinPreis

          // Tatsächliche Stromkosten (nur Netz-Ladung kostet, PV ist "gratis")
          const stromKostenEAuto = ladungNetzKwh * strompreisNetz / 100

          einsparungMonatEuro = spritKostenAlternativ - stromKostenEAuto
          co2EinsparungKg = (kmGefahren / 100) * verbrennerVerbrauch * 2.37 // ~2.37 kg CO2/Liter Benzin
        } else if (inv.typ === 'waermepumpe') {
          const heizenergie = parseFloat(daten.heizenergie_kwh) || 0
          const warmwasser = parseFloat(daten.warmwasser_kwh) || 0
          const stromverbrauch = parseFloat(daten.stromverbrauch_kwh) || 0
          verbrauchDaten = {
            heizenergie_kwh: heizenergie,
            warmwasser_kwh: warmwasser,
            stromverbrauch_kwh: stromverbrauch
          }

          // Wärmepumpe Einsparung: Vergleich mit altem Energieträger (Gas/Öl)
          const alterPreisCent = parseFloat(inv.parameter?.alter_preis_cent_kwh) || 8 // Fallback 8 ct/kWh
          const waermeGesamt = heizenergie + warmwasser

          // Kosten die wir mit Gas/Öl hätten zahlen müssen
          const alterEnergieKosten = waermeGesamt * alterPreisCent / 100

          // Tatsächliche Stromkosten der WP (vereinfacht: ganzer Stromverbrauch × Netzpreis)
          // Bei PV-Eigenverbrauch wäre es weniger, aber das ist in Eigenverbrauch-Einsparung erfasst
          const wpStromKosten = stromverbrauch * strompreisNetz / 100

          einsparungMonatEuro = alterEnergieKosten - wpStromKosten

          // CO2: Gas ~0.2 kg/kWh, Öl ~0.27 kg/kWh, Strom-Mix ~0.4 kg/kWh
          const alterCo2Faktor = inv.parameter?.alter_energietraeger === 'Öl' ? 0.27 : 0.20
          co2EinsparungKg = waermeGesamt * alterCo2Faktor - stromverbrauch * 0.4
        } else if (inv.typ === 'wallbox') {
          verbrauchDaten = {
            ladung_kwh: parseFloat(daten.ladung_kwh) || 0,
            ladevorgaenge: parseFloat(daten.ladevorgaenge) || 0
          }
          // Wallbox selbst hat keine Einsparung - die wird beim E-Auto erfasst
        }

        const hatDaten = Object.values(verbrauchDaten).some((v: any) => v > 0)
        if (hatDaten) {
          const { error: invError } = await supabase
            .from('investition_monatsdaten')
            .upsert({
              investition_id: inv.id,
              jahr: formData.jahr,
              monat: formData.monat,
              verbrauch_daten: verbrauchDaten,
              einsparung_monat_euro: einsparungMonatEuro,
              co2_einsparung_kg: co2EinsparungKg
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
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <SimpleIcon type="check" className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {monate[formData.monat - 1]} {formData.jahr} gespeichert
            </h2>
            <p className="text-sm text-gray-600">Zusammenfassung der erfassten und berechneten Werte</p>
          </div>
        </div>

        {/* Hauptkennzahlen - immer sichtbar, kompakt */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4 text-center">
            <FormelTooltip
              formel="Eigenverbrauch ÷ Gesamtverbrauch × 100"
              berechnung={`${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh ÷ ${fmtCalc(berechneteWerte.gesamtverbrauch, 1)} kWh × 100`}
              ergebnis={`= ${fmtCalc(berechneteWerte.autarkiegrad, 1)}%`}
            >
              <div className="text-3xl font-bold text-yellow-700">{berechneteWerte.autarkiegrad.toFixed(0)}%</div>
            </FormelTooltip>
            <div className="text-xs text-yellow-600 font-medium">Autarkiegrad</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 text-center">
            <FormelTooltip
              formel="Eigenverbrauch ÷ PV-Erzeugung × 100"
              berechnung={`${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh ÷ ${fmtCalc(berechneteWerte.pvErzeugung, 1)} kWh × 100`}
              ergebnis={`= ${fmtCalc(berechneteWerte.eigenverbrauchsquote, 1)}%`}
            >
              <div className="text-3xl font-bold text-green-700">{berechneteWerte.eigenverbrauchsquote.toFixed(0)}%</div>
            </FormelTooltip>
            <div className="text-xs text-green-600 font-medium">Eigenverbrauch</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 text-center">
            <FormelTooltip
              formel="Einspeisung + Eigenverbrauch"
              berechnung={`${fmtCalc(savedData?.einspeisung_kwh || parseFloat(formData.einspeisung_kwh) || 0, 1)} kWh + ${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh`}
              ergebnis={`= ${fmtCalc(berechneteWerte.pvErzeugung, 1)} kWh`}
            >
              <div className="text-3xl font-bold text-blue-700">{berechneteWerte.pvErzeugung.toFixed(0)}</div>
            </FormelTooltip>
            <div className="text-xs text-blue-600 font-medium">kWh erzeugt</div>
          </div>
          {berechneteWerte.gesamtErsparnisEuro !== null ? (
            <div className={`bg-gradient-to-br rounded-xl p-4 text-center ${
              berechneteWerte.gesamtErsparnisEuro >= 0
                ? 'from-green-50 to-green-100 border border-green-200'
                : 'from-red-50 to-red-100 border border-red-200'
            }`}>
              <FormelTooltip
                formel="EV-Einsparung + Einspeise-Erlös"
                berechnung={`${fmtCalc(berechneteWerte.eigenverbrauchEinsparungEuro)} € + ${fmtCalc(berechneteWerte.einspeisungErtragEuro)} €`}
                ergebnis={`= ${fmtCalc(berechneteWerte.gesamtErsparnisEuro)} € (ohne Netzbezugskosten)`}
              >
                <div className={`text-3xl font-bold ${
                  berechneteWerte.gesamtErsparnisEuro >= 0
                    ? 'text-green-700' : 'text-red-700'
                }`}>
                  {berechneteWerte.gesamtErsparnisEuro >= 0 ? '+' : ''}
                  {berechneteWerte.gesamtErsparnisEuro.toFixed(0)}€
                </div>
              </FormelTooltip>
              <div className="text-xs text-gray-600 font-medium">Ersparnis</div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 text-center">
              <FormelTooltip
                formel="Eigenverbrauch + Netzbezug"
                berechnung={`${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh + ${fmtCalc(parseFloat(formData.netzbezug_kwh) || 0, 1)} kWh`}
                ergebnis={`= ${fmtCalc(berechneteWerte.gesamtverbrauch, 1)} kWh`}
              >
                <div className="text-3xl font-bold text-gray-700">{berechneteWerte.gesamtverbrauch.toFixed(0)}</div>
              </FormelTooltip>
              <div className="text-xs text-gray-600 font-medium">kWh Verbrauch</div>
            </div>
          )}
        </div>

        {/* Zwei-Spalten-Layout für Details */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Linke Spalte: Energiebilanz */}
          <div className="space-y-4">
            {/* Energieflüsse */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <SimpleIcon type="grid" className="w-4 h-4" />
                Energiebilanz
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">PV-Erzeugung</span>
                  <FormelTooltip
                    formel="Einspeisung + Eigenverbrauch"
                    berechnung={`${fmtCalc(savedData?.einspeisung_kwh, 1)} kWh + ${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh`}
                    ergebnis={`= ${fmtCalc(berechneteWerte.pvErzeugung, 1)} kWh`}
                  >
                    <span className="font-medium text-yellow-700">{berechneteWerte.pvErzeugung.toFixed(1)} kWh</span>
                  </FormelTooltip>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Direktverbrauch</span>
                  <FormelTooltip
                    formel="Eigenverbrauch − Batterieentladung"
                    berechnung={`${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh − ${fmtCalc(berechneteWerte.batterieEntladung, 1)} kWh`}
                    ergebnis={`= ${fmtCalc(berechneteWerte.direktverbrauch, 1)} kWh (direkt von PV verbraucht)`}
                  >
                    <span className="font-medium">{berechneteWerte.direktverbrauch.toFixed(1)} kWh</span>
                  </FormelTooltip>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Eigenverbrauch</span>
                  <FormelTooltip
                    formel="Direktverbrauch + Batterieentladung"
                    berechnung={`${fmtCalc(berechneteWerte.direktverbrauch, 1)} kWh + ${fmtCalc(berechneteWerte.batterieEntladung, 1)} kWh`}
                    ergebnis={`= ${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh (selbst genutzter PV-Strom)`}
                  >
                    <span className="font-medium text-green-700">{berechneteWerte.eigenverbrauch.toFixed(1)} kWh</span>
                  </FormelTooltip>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="text-gray-600">Gesamtverbrauch</span>
                  <FormelTooltip
                    formel="Eigenverbrauch + Netzbezug"
                    berechnung={`${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh + ${fmtCalc(savedData?.netzbezug_kwh, 1)} kWh`}
                    ergebnis={`= ${fmtCalc(berechneteWerte.gesamtverbrauch, 1)} kWh`}
                  >
                    <span className="font-semibold">{berechneteWerte.gesamtverbrauch.toFixed(1)} kWh</span>
                  </FormelTooltip>
                </div>
              </div>
            </div>

            {/* Netz */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <SimpleIcon type="grid" className="w-4 h-4" />
                Netz
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Einspeisung</span>
                  <span className="font-medium text-green-600">+{savedData.einspeisung_kwh.toFixed(1)} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Netzbezug</span>
                  <span className="font-medium text-red-600">-{savedData.netzbezug_kwh.toFixed(1)} kWh</span>
                </div>
                {berechneteWerte.eigenverbrauchEinsparungEuro !== null && (
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="text-gray-600">Eigenverbrauch-Einsparung</span>
                    <FormelTooltip
                      formel="Eigenverbrauch × Netzbezugspreis"
                      berechnung={`${fmtCalc(berechneteWerte.eigenverbrauch, 1)} kWh × ${fmtCalc(stammStrompreise.netzbezug_cent_kwh)} ct/kWh ÷ 100`}
                      ergebnis={`= ${fmtCalc(berechneteWerte.eigenverbrauchEinsparungEuro)} €`}
                    >
                      <span className="font-medium text-green-600">+{berechneteWerte.eigenverbrauchEinsparungEuro.toFixed(2)} €</span>
                    </FormelTooltip>
                  </div>
                )}
                {berechneteWerte.einspeisungErtragEuro !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Einspeise-Erlös</span>
                    <FormelTooltip
                      formel="Einspeisung × Einspeisevergütung"
                      berechnung={`${fmtCalc(savedData.einspeisung_kwh, 1)} kWh × ${fmtCalc(stammStrompreise.einspeiseverguetung_cent_kwh)} ct/kWh ÷ 100`}
                      ergebnis={`= ${fmtCalc(berechneteWerte.einspeisungErtragEuro)} €`}
                    >
                      <span className="font-medium text-green-600">+{berechneteWerte.einspeisungErtragEuro.toFixed(2)} €</span>
                    </FormelTooltip>
                  </div>
                )}
                {berechneteWerte.netzbezugKostenEuro !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Netzbezugskosten</span>
                    <FormelTooltip
                      formel="Netzbezug × Netzbezugspreis"
                      berechnung={`${fmtCalc(savedData.netzbezug_kwh, 1)} kWh × ${fmtCalc(stammStrompreise.netzbezug_cent_kwh)} ct/kWh ÷ 100`}
                      ergebnis={`= ${fmtCalc(berechneteWerte.netzbezugKostenEuro)} € (Info, kein Abzug!)`}
                    >
                      <span className="font-medium text-red-600">-{berechneteWerte.netzbezugKostenEuro.toFixed(2)} €</span>
                    </FormelTooltip>
                  </div>
                )}
                {berechneteWerte.gesamtErsparnisEuro !== null && (
                  <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                    <span className="font-semibold text-gray-700">Gesamtersparnis</span>
                    <FormelTooltip
                      formel="EV-Einsparung + Einspeise-Erlös"
                      berechnung={`${fmtCalc(berechneteWerte.eigenverbrauchEinsparungEuro)} € + ${fmtCalc(berechneteWerte.einspeisungErtragEuro)} €`}
                      ergebnis={`= ${fmtCalc(berechneteWerte.gesamtErsparnisEuro)} € (ohne Netzbezugskosten!)`}
                    >
                      <span className={`font-bold ${berechneteWerte.gesamtErsparnisEuro >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {berechneteWerte.gesamtErsparnisEuro >= 0 ? '+' : ''}{berechneteWerte.gesamtErsparnisEuro.toFixed(2)} €
                      </span>
                    </FormelTooltip>
                  </div>
                )}
              </div>
            </div>

            {/* PV-Kennzahlen */}
            {berechneteWerte.spezifischerErtrag > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                  <SimpleIcon type="sun" className="w-4 h-4" />
                  PV-Anlage
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-yellow-700">{berechneteWerte.spezifischerErtrag.toFixed(1)}</div>
                    <div className="text-xs text-yellow-600">kWh/kWp</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-yellow-700">{berechneteWerte.direktverbrauchsquote.toFixed(1)}%</div>
                    <div className="text-xs text-yellow-600">Direktverbrauch</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rechte Spalte: Komponenten */}
          <div className="space-y-4">
            {/* Batteriespeicher */}
            {berechneteWerte.batterieLadung > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <SimpleIcon type="battery" className="w-4 h-4" />
                  Batteriespeicher
                </h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-700">{berechneteWerte.batteriezyklen.toFixed(1)}</div>
                    <div className="text-xs text-green-600">Zyklen</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-700">{berechneteWerte.batterieWirkungsgrad.toFixed(0)}%</div>
                    <div className="text-xs text-green-600">Wirkungsgrad</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-700">{berechneteWerte.batterieEntladung.toFixed(0)}</div>
                    <div className="text-xs text-green-600">kWh entladen</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-200 text-xs text-green-700">
                  Ladung: {berechneteWerte.batterieLadung.toFixed(1)} kWh | Kapazität: {berechneteWerte.speicherKapazitaet.toFixed(1)} kWh
                </div>
              </div>
            )}

            {/* E-Auto */}
            {berechneteWerte.eAutoLadungGesamt > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <SimpleIcon type="car" className="w-4 h-4" />
                  E-Auto
                </h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-700">{berechneteWerte.eAutoVerbrauchPro100km.toFixed(1)}</div>
                    <div className="text-xs text-blue-600">kWh/100km</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-700">{berechneteWerte.eAutoPvLadeanteil.toFixed(0)}%</div>
                    <div className="text-xs text-blue-600">PV-Anteil</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-700">{berechneteWerte.eAutoKmGefahren.toFixed(0)}</div>
                    <div className="text-xs text-blue-600">km gefahren</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-700">
                  Ladung: {berechneteWerte.eAutoLadungGesamt.toFixed(1)} kWh (PV: {berechneteWerte.eAutoLadungPv.toFixed(1)} | Netz: {berechneteWerte.eAutoLadungNetz.toFixed(1)})
                </div>
              </div>
            )}

            {/* Wärmepumpe */}
            {berechneteWerte.waermepumpeWaermeGesamt > 0 && (
              <div className="bg-orange-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                  <SimpleIcon type="heat" className="w-4 h-4" />
                  Wärmepumpe
                </h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-orange-700">{berechneteWerte.waermepumpeArbeitszahl.toFixed(2)}</div>
                    <div className="text-xs text-orange-600">COP</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-orange-700">{berechneteWerte.waermepumpeHeizanteil.toFixed(0)}%</div>
                    <div className="text-xs text-orange-600">Heizanteil</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-orange-700">{berechneteWerte.waermepumpeWaermeGesamt.toFixed(0)}</div>
                    <div className="text-xs text-orange-600">kWh Wärme</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-orange-200 text-xs text-orange-700">
                  Heizung: {berechneteWerte.waermepumpeHeizenergie.toFixed(0)} kWh | Warmwasser: {berechneteWerte.waermepumpeWarmwasser.toFixed(0)} kWh | Strom: {berechneteWerte.waermepumpeStrom.toFixed(0)} kWh
                </div>
              </div>
            )}

            {/* Wallbox */}
            {berechneteWerte.wallboxLadung > 0 && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                  <SimpleIcon type="wallbox" className="w-4 h-4" />
                  Wallbox
                </h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-700">{berechneteWerte.wallboxLadung.toFixed(0)}</div>
                    <div className="text-xs text-purple-600">kWh geladen</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-700">{berechneteWerte.wallboxLadevorgaenge.toFixed(0)}</div>
                    <div className="text-xs text-purple-600">Ladevorgänge</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-700">{berechneteWerte.wallboxKwhProLadevorgang.toFixed(1)}</div>
                    <div className="text-xs text-purple-600">kWh/Ladung</div>
                  </div>
                </div>
                {berechneteWerte.wallboxExternGeladen > 0 && (
                  <div className="mt-3 pt-3 border-t border-purple-200 text-xs text-purple-700">
                    Extern geladen: ca. {berechneteWerte.wallboxExternGeladen.toFixed(1)} kWh (E-Auto-Ladung &gt; Wallbox)
                  </div>
                )}
              </div>
            )}

            {/* Wetter */}
            {savedData.wetterDaten && (
              <div className="bg-sky-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-sky-800 mb-3 flex items-center gap-2">
                  <SimpleIcon type="sun" className="w-4 h-4" />
                  Wetter
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-sky-700">{savedData.wetterDaten.sonnenstunden.toFixed(0)}h</div>
                    <div className="text-xs text-sky-600">Sonnenstunden</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-sky-700">{savedData.wetterDaten.globalstrahlung_kwh_m2.toFixed(0)}</div>
                    <div className="text-xs text-sky-600">kWh/m² Strahlung</div>
                  </div>
                </div>
              </div>
            )}

            {loadingWeather && (
              <div className="bg-sky-50 rounded-lg p-4 text-center">
                <p className="text-sm text-sky-700">Wetterdaten werden abgerufen...</p>
              </div>
            )}
          </div>
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
                  else if (inv.typ === 'wallbox') reset[inv.id] = { ladung_kwh: '', ladevorgaenge: '' }
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

        {/* Wallbox */}
        {hatWallbox && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="wallbox" className="w-5 h-5 text-purple-500" />
              Wallbox
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Erfasse hier die Ladedaten der Wallbox. Vergleich mit E-Auto zeigt, wie viel extern geladen wurde.
            </p>
            {investitionen.filter(i => i.typ === 'wallbox').map(inv => (
              <div key={inv.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-3">
                <p className="text-sm font-medium text-purple-800 mb-3">{inv.bezeichnung}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-2">Ladung gesamt (kWh)</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.ladung_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'ladung_kwh', e.target.value)}
                      step="0.1"
                      placeholder="200"
                      className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-2">Ladevorgänge</label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.ladevorgaenge || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'ladevorgaenge', e.target.value)}
                      step="1"
                      placeholder="12"
                      className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            ))}
            {/* Hinweis wenn E-Auto und Wallbox vorhanden */}
            {hatEAuto && berechneteWerte.wallboxExternGeladen > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <strong>Hinweis:</strong> Ca. {berechneteWerte.wallboxExternGeladen.toFixed(1)} kWh wurden extern geladen
                (E-Auto-Ladung {berechneteWerte.eAutoLadungGesamt.toFixed(1)} kWh &gt; Wallbox {berechneteWerte.wallboxLadung.toFixed(1)} kWh)
              </div>
            )}
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
            {berechneteWerte.batterieLadungAusNetz > 0 && (
              <p className="mt-2 text-xs text-blue-600">
                ℹ️ {berechneteWerte.batterieLadungAusNetz.toFixed(1)} kWh Batterieladung aus dem Netz erkannt (Ladung &gt; verfügbare PV).
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
