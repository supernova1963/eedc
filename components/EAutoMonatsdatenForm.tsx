'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Investition {
  id: string
  bezeichnung: string
  typ: string
}

interface Props {
  investition: Investition
}

export default function EAutoMonatsdatenForm({ investition }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    pv_laden_kwh: 0,
    netz_laden_kwh: 0,
    gefahrene_km: 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('investition_monatsdaten')
        .insert([{
          investition_id: investition.id,
          ...formData
        }])

      if (error) throw error

      alert('✅ E-Auto Daten erfolgreich gespeichert!')
      router.refresh()
    } catch (error) {
      console.error('Fehler:', error)
      alert('❌ Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          🚗 {investition.bezeichnung}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Monatliche Lade- und Fahrdaten
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('de-DE', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PV-Laden (kWh)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.pv_laden_kwh}
              onChange={(e) => setFormData({ ...formData, pv_laden_kwh: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Netz-Laden (kWh)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.netz_laden_kwh}
              onChange={(e) => setFormData({ ...formData, netz_laden_kwh: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gefahrene Kilometer
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.gefahrene_km}
              onChange={(e) => setFormData({ ...formData, gefahrene_km: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-md font-medium text-white"
          >
            {loading ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
