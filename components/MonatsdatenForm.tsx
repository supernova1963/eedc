'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Anlage {
  id: string
  nennleistung_kwp: number
  inbetriebnahme: string
  anschaffungskosten: number
}

interface Props {
  anlage: Anlage
  editId?: string
}

export default function MonatsdatenForm({ anlage, editId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    stromverbrauch_kwh: 0,
    pv_erzeugung_kwh: 0,
    einspeisung_kwh: 0,
    netzbezug_kwh: 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('monatsdaten')
        .insert([{
          anlage_id: anlage.id,
          ...formData
        }])

      if (error) throw error

      alert('✅ Daten erfolgreich gespeichert!')
      router.push('/uebersicht')
      router.refresh()
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Jahr & Monat */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Jahr
          </label>
          <input
            type="number"
            required
            min="2020"
            max="2030"
            value={formData.jahr}
            onChange={(e) => setFormData({ ...formData, jahr: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monat
          </label>
          <select
            required
            value={formData.monat}
            onChange={(e) => setFormData({ ...formData, monat: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleString('de-DE', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>

        {/* Stromverbrauch */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stromverbrauch (kWh)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.stromverbrauch_kwh}
            onChange={(e) => setFormData({ ...formData, stromverbrauch_kwh: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* PV-Erzeugung */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PV-Erzeugung (kWh)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.pv_erzeugung_kwh}
            onChange={(e) => setFormData({ ...formData, pv_erzeugung_kwh: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Einspeisung */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Einspeisung (kWh)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.einspeisung_kwh}
            onChange={(e) => setFormData({ ...formData, einspeisung_kwh: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Netzbezug */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Netzbezug (kWh)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.netzbezug_kwh}
            onChange={(e) => setFormData({ ...formData, netzbezug_kwh: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-md font-medium text-white"
        >
          {loading ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}
