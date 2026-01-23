// components/MonatsdatenForm.tsx
// MIT Betriebsausgaben

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface MonatsdatenFormProps {
  anlage: any
}

export default function MonatsdatenForm({ anlage }: MonatsdatenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    pv_erzeugung_kwh: '',
    gesamtverbrauch_kwh: '',
    direktverbrauch_kwh: '',
    batterieentladung_kwh: '',
    einspeisung_kwh: '',
    netzbezug_kwh: '',
    einspeisung_ertrag_euro: '',
    netzbezug_kosten_euro: '',
    betriebsausgaben_monat_euro: ''  // NEU
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Hole mitglied_id
      const { data: mitgliedData } = await supabase
        .from('mitglieder')
        .select('id')
        .limit(1)
        .single()

      if (!mitgliedData) throw new Error('Kein Mitglied gefunden')

      const monatsdaten = {
        mitglied_id: mitgliedData.id,
        jahr: formData.jahr,
        monat: formData.monat,
        pv_erzeugung_kwh: parseFloat(formData.pv_erzeugung_kwh) || 0,
        gesamtverbrauch_kwh: parseFloat(formData.gesamtverbrauch_kwh) || 0,
        direktverbrauch_kwh: parseFloat(formData.direktverbrauch_kwh) || 0,
        batterieentladung_kwh: parseFloat(formData.batterieentladung_kwh) || 0,
        einspeisung_kwh: parseFloat(formData.einspeisung_kwh) || 0,
        netzbezug_kwh: parseFloat(formData.netzbezug_kwh) || 0,
        einspeisung_ertrag_euro: parseFloat(formData.einspeisung_ertrag_euro) || 0,
        netzbezug_kosten_euro: parseFloat(formData.netzbezug_kosten_euro) || 0,
        betriebsausgaben_monat_euro: parseFloat(formData.betriebsausgaben_monat_euro) || 0  // NEU
      }

      const { error: dbError } = await supabase
        .from('monatsdaten')
        .insert(monatsdaten)

      if (dbError) throw dbError

      router.push('/uebersicht')
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
        🌞 PV-Monatsdaten erfassen
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
              id="jahr"
              type="number"
              name="jahr"
              value={formData.jahr}
              onChange={handleChange}
              required
              placeholder="z.B. 2023"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="monat" className="block text-sm font-medium text-gray-700 mb-2">Monat *</label>
            <select
              id="monat"
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

        {/* Erzeugung & Verbrauch */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pv-erzeugung" className="block text-sm font-medium text-gray-700 mb-2">
              PV-Erzeugung (kWh) *
            </label>
            <input
              id="pv-erzeugung"
              type="number"
              name="pv_erzeugung_kwh"
              value={formData.pv_erzeugung_kwh}
              onChange={handleChange}
              required
              placeholder="z.B. 1500"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gesamt-Verbrauch (kWh) *
            </label>
            <input
              type="number"
              name="gesamtverbrauch_kwh"
              value={formData.gesamtverbrauch_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 400"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Eigenverbrauch */}
        <div className="grid grid-cols-2 gap-4">
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
              placeholder="z.B. 200"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">PV direkt ins Haus</p>
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
              placeholder="z.B. 150"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">Aus Batterie ins Haus</p>
          </div>
        </div>

        {/* Einspeisung & Netzbezug */}
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
              placeholder="z.B. 1100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
              placeholder="z.B. 50"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Kosten */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Einspeise-Erlöse (€) *
            </label>
            <input
              type="number"
              name="einspeisung_ertrag_euro"
              value={formData.einspeisung_ertrag_euro}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 88.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Netzbezug-Kosten (€) *
            </label>
            <input
              type="number"
              name="netzbezug_kosten_euro"
              value={formData.netzbezug_kosten_euro}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 16.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* NEU: Betriebsausgaben */}
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
            Wartung, Reparatur, Reinigung - falls angefallen
          </p>
        </div>

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
