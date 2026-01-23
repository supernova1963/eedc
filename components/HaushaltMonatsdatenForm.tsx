// components/HaushaltMonatsdatenForm.tsx
// Haushalts-Monatsdaten: Verbrauch, Einspeisung, Netzbezug, Kosten
// PV-Erzeugung wird automatisch aus Wechselrichter-Daten geholt

'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface HaushaltMonatsdatenFormProps {
  anlage: any
}

export default function HaushaltMonatsdatenForm({ anlage }: HaushaltMonatsdatenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pvErzeugung, setPvErzeugung] = useState<number | null>(null)
  const [batterieentladung, setBatterieentladung] = useState<number | null>(null)
  const [loadingAuto, setLoadingAuto] = useState(false)

  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    gesamtverbrauch_kwh: '',
    direktverbrauch_kwh: '',
    einspeisung_kwh: '',
    netzbezug_kwh: '',
    einspeisung_ertrag_euro: '',
    netzbezug_kosten_euro: '',
    betriebsausgaben_monat_euro: ''
  })

  // Auto-Daten laden wenn Jahr/Monat sich ändern
  useEffect(() => {
    const loadAutoData = async () => {
      if (!anlage?.mitglied_id) return

      setLoadingAuto(true)

      try {
        // PV-Erzeugung aus Wechselrichter-Monatsdaten
        const { data: wrData } = await supabase
          .from('investition_monatsdaten')
          .select(`
            verbrauch_daten,
            investition:investition_id (
              typ,
              mitglied_id
            )
          `)
          .eq('jahr', formData.jahr)
          .eq('monat', formData.monat)

        // Filtere Wechselrichter-Daten für dieses Mitglied
        const wechselrichterDaten = wrData?.filter(
          (d: any) => d.investition?.typ === 'wechselrichter' &&
                     d.investition?.mitglied_id === anlage.mitglied_id
        ) || []

        // Summiere PV-Erzeugung aller Wechselrichter
        const totalPvErzeugung = wechselrichterDaten.reduce((sum: number, d: any) => {
          return sum + (d.verbrauch_daten?.pv_erzeugung_ist_kwh || 0)
        }, 0)

        setPvErzeugung(totalPvErzeugung > 0 ? totalPvErzeugung : null)

        // Batterieentladung aus Speicher-Monatsdaten
        const speicherDaten = wrData?.filter(
          (d: any) => d.investition?.typ === 'speicher' &&
                     d.investition?.mitglied_id === anlage.mitglied_id
        ) || []

        const totalBatterieentladung = speicherDaten.reduce((sum: number, d: any) => {
          return sum + (d.verbrauch_daten?.batterieentladung_kwh || 0)
        }, 0)

        setBatterieentladung(totalBatterieentladung > 0 ? totalBatterieentladung : null)

      } catch (err) {
        console.error('Fehler beim Laden der Auto-Daten:', err)
      } finally {
        setLoadingAuto(false)
      }
    }

    loadAutoData()
  }, [anlage?.mitglied_id, formData.jahr, formData.monat])

  // Berechnete Werte
  const berechneteWerte = useMemo(() => {
    const gesamtverbrauch = parseFloat(formData.gesamtverbrauch_kwh) || 0
    const direktverbrauch = parseFloat(formData.direktverbrauch_kwh) || 0
    const einspeisung = parseFloat(formData.einspeisung_kwh) || 0
    const netzbezug = parseFloat(formData.netzbezug_kwh) || 0
    const pv = pvErzeugung || 0
    const batterie = batterieentladung || 0

    // Eigenverbrauch = Direktverbrauch + Batterieentladung (falls vorhanden)
    const eigenverbrauch = direktverbrauch + batterie

    // Eigenverbrauchsquote = Eigenverbrauch / PV-Erzeugung
    const eigenverbrauchsquote = pv > 0 ? (eigenverbrauch / pv) * 100 : 0

    // Autarkiegrad = Eigenverbrauch / Gesamtverbrauch
    const autarkiegrad = gesamtverbrauch > 0 ? (eigenverbrauch / gesamtverbrauch) * 100 : 0

    // Plausibilitätsprüfung: PV = Direktverbrauch + Einspeisung + Batterieladung
    // Netzbezug + Eigenverbrauch ≈ Gesamtverbrauch
    const bilanzOk = Math.abs((netzbezug + eigenverbrauch) - gesamtverbrauch) < 1

    return {
      eigenverbrauch,
      eigenverbrauchsquote,
      autarkiegrad,
      bilanzOk
    }
  }, [formData, pvErzeugung, batterieentladung])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const monatsdaten = {
        anlage_id: anlage.id,
        jahr: formData.jahr,
        monat: formData.monat,
        pv_erzeugung_kwh: pvErzeugung || 0,
        gesamtverbrauch_kwh: parseFloat(formData.gesamtverbrauch_kwh) || 0,
        direktverbrauch_kwh: parseFloat(formData.direktverbrauch_kwh) || 0,
        batterieentladung_kwh: batterieentladung || 0,
        einspeisung_kwh: parseFloat(formData.einspeisung_kwh) || 0,
        netzbezug_kwh: parseFloat(formData.netzbezug_kwh) || 0,
        einspeisung_ertrag_euro: parseFloat(formData.einspeisung_ertrag_euro) || 0,
        netzbezug_kosten_euro: parseFloat(formData.netzbezug_kosten_euro) || 0,
        betriebsausgaben_monat_euro: parseFloat(formData.betriebsausgaben_monat_euro) || 0,
        // Berechnete Kennzahlen speichern
        eigenverbrauchsquote_prozent: berechneteWerte.eigenverbrauchsquote,
        autarkiegrad_prozent: berechneteWerte.autarkiegrad
      }

      const { error: dbError } = await supabase
        .from('monatsdaten')
        .upsert(monatsdaten, {
          onConflict: 'anlage_id,jahr,monat'
        })

      if (dbError) throw dbError

      router.push('/auswertung')
      router.refresh()

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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        🏠 Haushalts-Monatsdaten
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

        {/* Auto-Werte aus Investitionen */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-900 mb-3">
            Automatisch aus Investitions-Daten:
          </h3>
          {loadingAuto ? (
            <p className="text-sm text-green-700">Lade Daten...</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">PV-Erzeugung:</span>
                <span className="font-medium">
                  {pvErzeugung !== null ? `${pvErzeugung.toFixed(1)} kWh` :
                    <span className="text-amber-600">Keine Daten</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Batterieentladung:</span>
                <span className="font-medium">
                  {batterieentladung !== null ? `${batterieentladung.toFixed(1)} kWh` :
                    <span className="text-gray-400">-</span>}
                </span>
              </div>
            </div>
          )}
          {pvErzeugung === null && !loadingAuto && (
            <p className="mt-2 text-xs text-amber-700">
              Bitte zuerst Wechselrichter-Monatsdaten für {monate[formData.monat - 1]} {formData.jahr} erfassen.
            </p>
          )}
        </div>

        {/* Verbrauchsdaten */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Verbrauchsdaten</h3>
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
              <p className="mt-1 text-xs text-gray-500">
                Gesamter Stromverbrauch des Haushalts
              </p>
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
              <p className="mt-1 text-xs text-gray-500">
                PV-Strom direkt verbraucht (ohne Batterie)
              </p>
            </div>
          </div>
        </div>

        {/* Netz-Interaktion */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Netz-Interaktion</h3>
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
              <p className="mt-1 text-xs text-gray-500">
                Ins Netz eingespeister Überschuss
              </p>
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
              <p className="mt-1 text-xs text-gray-500">
                Vom Netz bezogener Strom
              </p>
            </div>
          </div>
        </div>

        {/* Finanzen */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Finanzen</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Einspeisevergütung (Euro)
              </label>
              <input
                type="number"
                name="einspeisung_ertrag_euro"
                value={formData.einspeisung_ertrag_euro}
                onChange={handleChange}
                step="0.01"
                placeholder="z.B. 25.60"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Netzbezug-Kosten (Euro)
              </label>
              <input
                type="number"
                name="netzbezug_kosten_euro"
                value={formData.netzbezug_kosten_euro}
                onChange={handleChange}
                step="0.01"
                placeholder="z.B. 51.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
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
              <p className="mt-1 text-xs text-gray-500">
                Wartung, Versicherung etc.
              </p>
            </div>
          </div>
        </div>

        {/* Berechnete Kennzahlen */}
        {(parseFloat(formData.gesamtverbrauch_kwh) > 0 || pvErzeugung) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Berechnete Kennzahlen:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
            </div>
            {!berechneteWerte.bilanzOk && (
              <p className="mt-2 text-xs text-amber-700">
                Netzbezug + Eigenverbrauch sollte etwa dem Gesamtverbrauch entsprechen.
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
            disabled={loading || pvErzeugung === null}
            className={`px-6 py-3 rounded-md font-medium text-white ${
              loading || pvErzeugung === null
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
