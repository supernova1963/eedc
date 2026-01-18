// components/SpeicherMonatsdatenForm.tsx
// VEREINFACHT: ohne Zyklen & SOC, mit ungeplanten Ausgaben

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface SpeicherMonatsdatenFormProps {
  investition: any
}

export default function SpeicherMonatsdatenForm({ investition }: SpeicherMonatsdatenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    batterieladung_kwh: '',
    batterieentladung_kwh: '',
    betriebsausgaben_monat_euro: ''  // NEU
  })

  // Berechnung für Vorschau
  const ladung = parseFloat(formData.batterieladung_kwh) || 0
  const entladung = parseFloat(formData.batterieentladung_kwh) || 0
  const wirkungsgrad = ladung > 0 ? (entladung / ladung) * 100 : 0
  const selbstentladung = ladung - entladung

  // Prognose-Werte aus Investition
  const prognoseKapazitaet = investition.parameter?.kapazitaet_kwh || 0
  const prognoseWirkungsgrad = investition.parameter?.wirkungsgrad_prozent || 90

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
        investition_id: investition.id,
        jahr: formData.jahr,
        monat: formData.monat,
        verbrauch_daten: {
          batterieladung_kwh: parseFloat(formData.batterieladung_kwh),
          batterieentladung_kwh: parseFloat(formData.batterieentladung_kwh),
          wirkungsgrad_prozent: wirkungsgrad,
          selbstentladung_kwh: selbstentladung
        },
        kosten_daten: {
          betriebsausgaben_monat_euro: parseFloat(formData.betriebsausgaben_monat_euro) || 0  //NEU
        },
        einsparung_monat_euro: 0,
        co2_einsparung_kg: 0
      }

      const { error: dbError } = await supabase
        .from('investition_monatsdaten')
        .insert(monatsdaten)

      if (dbError) throw dbError

      router.push('/auswertung?tab=speicher')
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
        🔋 {investition.bezeichnung}
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          ❌ {error}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monat *</label>
            <select
              name="monat"
              value={formData.monat}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {monate.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Batterie-Daten */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Batterieladung (kWh) *
            </label>
            <input
              type="number"
              name="batterieladung_kwh"
              value={formData.batterieladung_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 450"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">
              Von PV in Batterie geladen
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Batterieentladung (kWh) *
            </label>
            <input
              type="number"
              name="batterieentladung_kwh"
              value={formData.batterieentladung_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 400"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">
              Aus Batterie ins Haus entladen
            </p>
          </div>
        </div>

        {/* Betriebsausgaben */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Betriebsausgaben diesen Monat (€)
          </label>
          <input
            type="number"
            name="betriebsausgaben_monat_euro"
            value={formData.betriebsausgaben_monat_euro}
            onChange={handleChange}
            step="0.01"
            placeholder="z.B. 0 (oder Wartung, Reparatur)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="mt-1 text-xs text-gray-500">
            Wartung, Reparatur, Versicherung - falls angefallen
          </p>
        </div>
        
        {/* Berechnete Werte - Vorschau */}
        {ladung > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">📊 Berechnete Werte:</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-blue-700">Wirkungsgrad:</span>
                <span className="float-right font-medium">{wirkungsgrad.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-blue-700">Prognose:</span>
                <span className="float-right font-medium">{prognoseWirkungsgrad}%</span>
              </div>
              <div>
                <span className="text-blue-700">Selbstentladung:</span>
                <span className="float-right font-medium">{selbstentladung.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-blue-700">Kapazität:</span>
                <span className="float-right font-medium">{prognoseKapazitaet} kWh</span>
              </div>
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
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Speichert...' : '💾 Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
