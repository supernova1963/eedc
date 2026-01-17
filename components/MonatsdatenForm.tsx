// components/MonatsdatenForm.tsx
// PV-Monatsdaten Erfassungsformular

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface MonatsdatenFormProps {
  anlage: any
  editId?: string
}

export default function MonatsdatenForm({ anlage, editId }: MonatsdatenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    pv_erzeugung_kwh: '',
    eigenverbrauch_kwh: '',
    einspeisung_kwh: '',
    netzbezug_kwh: '',
    verbrauch_gesamt_kwh: '',
    einspeisung_preis_cent: '',
    netzbezug_preis_cent: ''
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
      const einspeisungPreis = parseFloat(formData.einspeisung_preis_cent) / 100
      const netzbezugPreis = parseFloat(formData.netzbezug_preis_cent) / 100
      
      const monatsdaten = {
        anlage_id: anlage.id,
        jahr: formData.jahr,
        monat: formData.monat,
        pv_erzeugung_kwh: parseFloat(formData.pv_erzeugung_kwh),
        eigenverbrauch_kwh: parseFloat(formData.eigenverbrauch_kwh),
        einspeisung_kwh: parseFloat(formData.einspeisung_kwh),
        netzbezug_kwh: parseFloat(formData.netzbezug_kwh),
        verbrauch_gesamt_kwh: parseFloat(formData.verbrauch_gesamt_kwh),
        einspeisung_erloese_euro: parseFloat(formData.einspeisung_kwh) * einspeisungPreis,
        netzbezug_kosten_euro: parseFloat(formData.netzbezug_kwh) * netzbezugPreis
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
        🌞 {anlage.bezeichnung || 'PV-Anlage'}
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

        {/* Erzeugung */}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Verbrauch */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eigenverbrauch (kWh) *
            </label>
            <input
              type="number"
              name="eigenverbrauch_kwh"
              value={formData.eigenverbrauch_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 180"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
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
              placeholder="z.B. 270"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Netzbezug & Verbrauch */}
        <div className="grid grid-cols-2 gap-4">
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
              placeholder="z.B. 120"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verbrauch gesamt (kWh) *
            </label>
            <input
              type="number"
              name="verbrauch_gesamt_kwh"
              value={formData.verbrauch_gesamt_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 300"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Preise */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Einspeisevergütung (ct/kWh) *
            </label>
            <input
              type="number"
              name="einspeisung_preis_cent"
              value={formData.einspeisung_preis_cent}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 8.2"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Netzbezugspreis (ct/kWh) *
            </label>
            <input
              type="number"
              name="netzbezug_preis_cent"
              value={formData.netzbezug_preis_cent}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 32"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
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
