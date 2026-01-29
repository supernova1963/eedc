// components/MonatsdatenFormDynamic.tsx
// Dynamisches Monatsdaten-Formular das sich an vorhandene Investitionen anpasst
// Ersetzt HaushaltMonatsdatenForm mit erweiterter Funktionalität

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SimpleIcon from './SimpleIcon'

interface Investition {
  id: string
  typ: string
  bezeichnung: string
  parameter?: any
}

interface MonatsdatenFormDynamicProps {
  anlage: any
  investitionen: Investition[]
}

export default function MonatsdatenFormDynamic({ anlage, investitionen }: MonatsdatenFormDynamicProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Strompreise aus Stammdaten (Fallback)
  const [stammStrompreise, setStammStrompreise] = useState<{
    netzbezug_cent_kwh: number | null
    einspeiseverguetung_cent_kwh: number | null
  }>({ netzbezug_cent_kwh: null, einspeiseverguetung_cent_kwh: null })

  // Welche Investitionstypen sind vorhanden?
  const hatWechselrichter = investitionen.some(i => i.typ === 'wechselrichter')
  const hatSpeicher = investitionen.some(i => i.typ === 'speicher')
  const hatEAuto = investitionen.some(i => i.typ === 'e-auto')
  const hatWaermepumpe = investitionen.some(i => i.typ === 'waermepumpe')

  // Haupt-Formular State
  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    // Haushalts-Daten
    gesamtverbrauch_kwh: '',
    direktverbrauch_kwh: '',
    einspeisung_kwh: '',
    netzbezug_kwh: '',
    // PV-Erzeugung (direkt eingeben wenn kein Wechselrichter)
    pv_erzeugung_kwh: '',
    // Batterie (wenn Speicher vorhanden)
    batterieentladung_kwh: '',
    batterieladung_kwh: '',
    // Optionale Strompreise (ct/kWh für dynamische Tarife)
    einspeiseverguetung_monat_cent: '',
    netzbezug_preis_monat_cent: '',
    // Sonstiges
    betriebsausgaben_monat_euro: ''
  })

  // Investitions-spezifische Daten
  const [investitionsDaten, setInvestitionsDaten] = useState<Record<string, any>>({})

  // Initialisiere Investitions-Daten
  useEffect(() => {
    const initial: Record<string, any> = {}
    investitionen.forEach(inv => {
      if (inv.typ === 'wechselrichter') {
        initial[inv.id] = { pv_erzeugung_kwh: '' }
      } else if (inv.typ === 'speicher') {
        initial[inv.id] = { entladung_kwh: '', ladung_kwh: '' }
      } else if (inv.typ === 'e-auto') {
        initial[inv.id] = { km_gefahren: '', verbrauch_kwh: '', ladung_pv_kwh: '', ladung_netz_kwh: '' }
      } else if (inv.typ === 'waermepumpe') {
        initial[inv.id] = { heizenergie_kwh: '', warmwasser_kwh: '', stromverbrauch_kwh: '' }
      }
    })
    setInvestitionsDaten(initial)
  }, [investitionen])

  // Strompreise aus Stammdaten laden
  useEffect(() => {
    const loadStrompreise = async () => {
      if (!anlage?.mitglied_id) return

      try {
        const supabase = createBrowserClient()
        const { data, error } = await supabase.rpc('get_aktueller_strompreis', {
          p_mitglied_id: anlage.mitglied_id,
          p_anlage_id: anlage.id
        })

        if (!error && data && data.length > 0) {
          setStammStrompreise({
            netzbezug_cent_kwh: data[0].netzbezug_arbeitspreis_cent_kwh,
            einspeiseverguetung_cent_kwh: data[0].einspeiseverguetung_cent_kwh
          })
        }
      } catch (err) {
        console.error('Fehler beim Laden der Strompreise:', err)
      }
    }

    loadStrompreise()
  }, [anlage?.mitglied_id, anlage?.id])

  // Berechnete Werte
  const berechneteWerte = useMemo(() => {
    const gesamtverbrauch = parseFloat(formData.gesamtverbrauch_kwh) || 0
    const direktverbrauch = parseFloat(formData.direktverbrauch_kwh) || 0
    const einspeisung = parseFloat(formData.einspeisung_kwh) || 0
    const netzbezug = parseFloat(formData.netzbezug_kwh) || 0
    const batterieentladung = parseFloat(formData.batterieentladung_kwh) || 0

    // PV-Erzeugung: Aus Formular oder Summe der Wechselrichter
    let pvErzeugung = parseFloat(formData.pv_erzeugung_kwh) || 0
    if (hatWechselrichter && !formData.pv_erzeugung_kwh) {
      // Summiere alle Wechselrichter
      pvErzeugung = investitionen
        .filter(i => i.typ === 'wechselrichter')
        .reduce((sum, inv) => {
          return sum + (parseFloat(investitionsDaten[inv.id]?.pv_erzeugung_kwh) || 0)
        }, 0)
    }

    // Eigenverbrauch = Direktverbrauch + Batterieentladung
    const eigenverbrauch = direktverbrauch + batterieentladung

    // Kennzahlen
    const eigenverbrauchsquote = pvErzeugung > 0 ? (eigenverbrauch / pvErzeugung) * 100 : 0
    const autarkiegrad = gesamtverbrauch > 0 ? (eigenverbrauch / gesamtverbrauch) * 100 : 0
    const bilanzOk = Math.abs((netzbezug + eigenverbrauch) - gesamtverbrauch) < 1

    // Effektive Strompreise
    const effektiverEinspeisepreis = formData.einspeiseverguetung_monat_cent !== ''
      ? parseFloat(formData.einspeiseverguetung_monat_cent)
      : stammStrompreise.einspeiseverguetung_cent_kwh

    const effektiverNetzbezugspreis = formData.netzbezug_preis_monat_cent !== ''
      ? parseFloat(formData.netzbezug_preis_monat_cent)
      : stammStrompreise.netzbezug_cent_kwh

    // Euro-Beträge
    const einspeisungErtragEuro = typeof effektiverEinspeisepreis === 'number'
      ? (einspeisung * effektiverEinspeisepreis / 100)
      : null

    const netzbezugKostenEuro = typeof effektiverNetzbezugspreis === 'number'
      ? (netzbezug * effektiverNetzbezugspreis / 100)
      : null

    return {
      pvErzeugung,
      eigenverbrauch,
      eigenverbrauchsquote,
      autarkiegrad,
      bilanzOk,
      einspeisungErtragEuro,
      netzbezugKostenEuro
    }
  }, [formData, investitionsDaten, hatWechselrichter, investitionen, stammStrompreise])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

      // 1. Haushalts-Monatsdaten speichern
      const monatsdaten = {
        anlage_id: anlage.id,
        jahr: formData.jahr,
        monat: formData.monat,
        pv_erzeugung_kwh: berechneteWerte.pvErzeugung,
        gesamtverbrauch_kwh: parseFloat(formData.gesamtverbrauch_kwh) || 0,
        direktverbrauch_kwh: parseFloat(formData.direktverbrauch_kwh) || 0,
        batterieentladung_kwh: parseFloat(formData.batterieentladung_kwh) || 0,
        batterieladung_kwh: parseFloat(formData.batterieladung_kwh) || 0,
        einspeisung_kwh: parseFloat(formData.einspeisung_kwh) || 0,
        netzbezug_kwh: parseFloat(formData.netzbezug_kwh) || 0,
        einspeisung_ertrag_euro: berechneteWerte.einspeisungErtragEuro ?? 0,
        netzbezug_kosten_euro: berechneteWerte.netzbezugKostenEuro ?? 0,
        betriebsausgaben_monat_euro: parseFloat(formData.betriebsausgaben_monat_euro) || 0,
        eigenverbrauchsquote_prozent: berechneteWerte.eigenverbrauchsquote,
        autarkiegrad_prozent: berechneteWerte.autarkiegrad
      }

      const { error: dbError } = await supabase
        .from('monatsdaten')
        .upsert(monatsdaten, { onConflict: 'anlage_id,jahr,monat' })

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
            ladung_kwh: parseFloat(daten.ladung_kwh) || 0,
            batterieentladung_kwh: parseFloat(daten.entladung_kwh) || 0
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

        // Nur speichern wenn Daten vorhanden
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

      setSuccess('Monatsdaten erfolgreich gespeichert!')
      setTimeout(() => {
        router.push('/auswertung')
        router.refresh()
      }, 1000)

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

  const hatStrompreise = typeof stammStrompreise.einspeiseverguetung_cent_kwh === 'number' ||
                         typeof stammStrompreise.netzbezug_cent_kwh === 'number' ||
                         formData.einspeiseverguetung_monat_cent !== '' ||
                         formData.netzbezug_preis_monat_cent !== ''

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <SimpleIcon type="plus" className="w-5 h-5 text-blue-600" />
        Monatsdaten erfassen
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {success}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monat *</label>
            <select
              name="monat"
              value={formData.monat}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monate.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* PV-Erzeugung Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="sun" className="w-5 h-5 text-yellow-500" />
            PV-Erzeugung
          </h3>

          {hatWechselrichter ? (
            // Wechselrichter vorhanden - Eingabe pro Wechselrichter
            <div className="space-y-4">
              {investitionen.filter(i => i.typ === 'wechselrichter').map(inv => (
                <div key={inv.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-yellow-800 mb-2">
                    {inv.bezeichnung} - Erzeugung (kWh) *
                  </label>
                  <input
                    type="number"
                    value={investitionsDaten[inv.id]?.pv_erzeugung_kwh || ''}
                    onChange={(e) => handleInvestitionChange(inv.id, 'pv_erzeugung_kwh', e.target.value)}
                    required
                    step="0.01"
                    placeholder="z.B. 450"
                    className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              ))}
              {investitionen.filter(i => i.typ === 'wechselrichter').length > 1 && (
                <p className="text-sm text-yellow-700">
                  Gesamt: {berechneteWerte.pvErzeugung.toFixed(1)} kWh
                </p>
              )}
            </div>
          ) : (
            // Kein Wechselrichter - direkte Eingabe
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PV-Erzeugung (kWh) *
              </label>
              <input
                type="number"
                name="pv_erzeugung_kwh"
                value={formData.pv_erzeugung_kwh}
                onChange={handleChange}
                required
                step="0.01"
                placeholder="z.B. 450"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Gesamte Erzeugung vom Wechselrichter ablesen
              </p>
            </div>
          )}
        </div>

        {/* Verbrauchsdaten */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="home" className="w-5 h-5 text-blue-500" />
            Haushalts-Verbrauch
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gesamtverbrauch (kWh) *
              </label>
              <input
                type="number"
                name="gesamtverbrauch_kwh"
                value={formData.gesamtverbrauch_kwh}
                onChange={handleChange}
                required
                step="0.01"
                placeholder="z.B. 450"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Direktverbrauch (kWh) *
              </label>
              <input
                type="number"
                name="direktverbrauch_kwh"
                value={formData.direktverbrauch_kwh}
                onChange={handleChange}
                required
                step="0.01"
                placeholder="z.B. 280"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">PV direkt verbraucht</p>
            </div>
          </div>
        </div>

        {/* Netz-Interaktion */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="grid" className="w-5 h-5 text-gray-500" />
            Netz-Interaktion
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
                step="0.01"
                placeholder="z.B. 320"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                step="0.01"
                placeholder="z.B. 170"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Speicher Section (dynamisch) */}
        {hatSpeicher && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="battery" className="w-5 h-5 text-green-500" />
              Batteriespeicher
            </h3>
            {investitionen.filter(i => i.typ === 'speicher').map(inv => (
              <div key={inv.id} className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-green-800 mb-3">{inv.bezeichnung}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2">
                      Entladung (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.entladung_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'entladung_kwh', e.target.value)}
                      step="0.01"
                      placeholder="z.B. 50"
                      className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2">
                      Ladung (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.ladung_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'ladung_kwh', e.target.value)}
                      step="0.01"
                      placeholder="z.B. 60"
                      className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            ))}
            {/* Zusätzlich: Batterie-Felder für monatsdaten Tabelle */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batterieentladung gesamt (kWh)
                </label>
                <input
                  type="number"
                  name="batterieentladung_kwh"
                  value={formData.batterieentladung_kwh}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="Summe aller Speicher"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batterieladung gesamt (kWh)
                </label>
                <input
                  type="number"
                  name="batterieladung_kwh"
                  value={formData.batterieladung_kwh}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="Summe aller Speicher"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* E-Auto Section (dynamisch) */}
        {hatEAuto && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="car" className="w-5 h-5 text-blue-500" />
              E-Auto
            </h3>
            {investitionen.filter(i => i.typ === 'e-auto').map(inv => (
              <div key={inv.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-blue-800 mb-3">{inv.bezeichnung}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      km gefahren
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.km_gefahren || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'km_gefahren', e.target.value)}
                      step="1"
                      placeholder="z.B. 1500"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      Verbrauch (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.verbrauch_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'verbrauch_kwh', e.target.value)}
                      step="0.01"
                      placeholder="z.B. 270"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      Ladung PV (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.ladung_pv_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'ladung_pv_kwh', e.target.value)}
                      step="0.01"
                      placeholder="z.B. 200"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                      Ladung Netz (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.ladung_netz_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'ladung_netz_kwh', e.target.value)}
                      step="0.01"
                      placeholder="z.B. 70"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Wärmepumpe Section (dynamisch) */}
        {hatWaermepumpe && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="heat" className="w-5 h-5 text-orange-500" />
              Wärmepumpe
            </h3>
            {investitionen.filter(i => i.typ === 'waermepumpe').map(inv => (
              <div key={inv.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-orange-800 mb-3">{inv.bezeichnung}</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-2">
                      Heizenergie (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.heizenergie_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'heizenergie_kwh', e.target.value)}
                      step="0.01"
                      placeholder="z.B. 600"
                      className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-2">
                      Warmwasser (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.warmwasser_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'warmwasser_kwh', e.target.value)}
                      step="0.01"
                      placeholder="z.B. 150"
                      className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-2">
                      Stromverbrauch (kWh)
                    </label>
                    <input
                      type="number"
                      value={investitionsDaten[inv.id]?.stromverbrauch_kwh || ''}
                      onChange={(e) => handleInvestitionChange(inv.id, 'stromverbrauch_kwh', e.target.value)}
                      step="0.01"
                      placeholder="z.B. 250"
                      className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Strompreise */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Strompreise</h3>
          <p className="text-sm text-gray-600 mb-4">
            Optional: Nur ausfüllen bei dynamischen Tarifen.
          </p>

          {(typeof stammStrompreise.einspeiseverguetung_cent_kwh === 'number' ||
            typeof stammStrompreise.netzbezug_cent_kwh === 'number') && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-600 mb-1">Aus Stammdaten:</p>
              <div className="flex gap-6 text-sm">
                {typeof stammStrompreise.einspeiseverguetung_cent_kwh === 'number' && (
                  <span>Einspeisevergütung: <strong>{stammStrompreise.einspeiseverguetung_cent_kwh.toFixed(2)} ct/kWh</strong></span>
                )}
                {typeof stammStrompreise.netzbezug_cent_kwh === 'number' && (
                  <span>Netzbezug: <strong>{stammStrompreise.netzbezug_cent_kwh.toFixed(2)} ct/kWh</strong></span>
                )}
              </div>
            </div>
          )}

          {!hatStrompreise && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                Keine Strompreise hinterlegt. Bitte unter Stammdaten erfassen.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Einspeisevergütung (ct/kWh)
              </label>
              <input
                type="number"
                name="einspeiseverguetung_monat_cent"
                value={formData.einspeiseverguetung_monat_cent}
                onChange={handleChange}
                step="0.01"
                placeholder="Leer = Stammdaten"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Netzbezugspreis (ct/kWh)
              </label>
              <input
                type="number"
                name="netzbezug_preis_monat_cent"
                value={formData.netzbezug_preis_monat_cent}
                onChange={handleChange}
                step="0.01"
                placeholder="Leer = Stammdaten"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Sonstiges */}
        <div className="border-t pt-6">
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Betriebsausgaben (Euro)
            </label>
            <input
              type="number"
              name="betriebsausgaben_monat_euro"
              value={formData.betriebsausgaben_monat_euro}
              onChange={handleChange}
              step="0.01"
              placeholder="z.B. 0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Berechnete Kennzahlen */}
        {(parseFloat(formData.gesamtverbrauch_kwh) > 0 || berechneteWerte.pvErzeugung > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Berechnete Kennzahlen:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700">PV-Erzeugung:</span>
                <span className="float-right font-medium">{berechneteWerte.pvErzeugung.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-blue-700">Eigenverbrauch:</span>
                <span className="float-right font-medium">{berechneteWerte.eigenverbrauch.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-blue-700">Eigenverbrauchsquote:</span>
                <span className="float-right font-medium">{berechneteWerte.eigenverbrauchsquote.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-blue-700">Autarkiegrad:</span>
                <span className="float-right font-medium">{berechneteWerte.autarkiegrad.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-blue-700">Bilanz:</span>
                <span className={`float-right font-medium ${berechneteWerte.bilanzOk ? 'text-green-600' : 'text-amber-600'}`}>
                  {berechneteWerte.bilanzOk ? 'OK' : 'Prüfen!'}
                </span>
              </div>
              {berechneteWerte.einspeisungErtragEuro !== null && (
                <div>
                  <span className="text-blue-700">Einspeisevergütung:</span>
                  <span className="float-right font-medium text-green-600">{berechneteWerte.einspeisungErtragEuro.toFixed(2)} €</span>
                </div>
              )}
              {berechneteWerte.netzbezugKostenEuro !== null && (
                <div>
                  <span className="text-blue-700">Netzbezugskosten:</span>
                  <span className="float-right font-medium text-red-600">-{berechneteWerte.netzbezugKostenEuro.toFixed(2)} €</span>
                </div>
              )}
            </div>
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
            disabled={loading}
            className={`px-6 py-3 rounded-md font-medium text-white ${
              loading
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
