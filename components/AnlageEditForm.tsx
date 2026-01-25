// components/AnlageEditForm.tsx
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SimpleIcon from './SimpleIcon'

interface AnlageEditFormProps {
  anlage: any
}

export default function AnlageEditForm({ anlage }: AnlageEditFormProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    standort: anlage.standort || '',
    inbetriebnahme: anlage.inbetriebnahme || '',
    nennleistung_kwp: anlage.nennleistung_kwp?.toString() || '',
    anschaffungskosten: anlage.anschaffungskosten?.toString() || '',
    einspeisetarif_cent_kwh: anlage.einspeisetarif_cent_kwh?.toString() || '',
    strompreis_cent_kwh: anlage.strompreis_cent_kwh?.toString() || '',
    hersteller: anlage.hersteller || '',
    wechselrichter: anlage.wechselrichter || '',
    notizen: anlage.notizen || ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createBrowserClient()

      const updateData = {
        standort: formData.standort,
        inbetriebnahme: formData.inbetriebnahme,
        nennleistung_kwp: parseFloat(formData.nennleistung_kwp) || 0,
        anschaffungskosten: parseFloat(formData.anschaffungskosten) || 0,
        einspeisetarif_cent_kwh: parseFloat(formData.einspeisetarif_cent_kwh) || 0,
        strompreis_cent_kwh: parseFloat(formData.strompreis_cent_kwh) || 0,
        hersteller: formData.hersteller || null,
        wechselrichter: formData.wechselrichter || null,
        notizen: formData.notizen || null
      }

      const { error: dbError } = await supabase
        .from('anlagen')
        .update(updateData)
        .eq('id', anlage.id)

      if (dbError) throw dbError

      setSuccess(true)
      setIsEditing(false)
      router.refresh()

      // Success-Message nach 3 Sekunden ausblenden
      setTimeout(() => setSuccess(false), 3000)

    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form data
    setFormData({
      standort: anlage.standort || '',
      inbetriebnahme: anlage.inbetriebnahme || '',
      nennleistung_kwp: anlage.nennleistung_kwp?.toString() || '',
      anschaffungskosten: anlage.anschaffungskosten?.toString() || '',
      einspeisetarif_cent_kwh: anlage.einspeisetarif_cent_kwh?.toString() || '',
      strompreis_cent_kwh: anlage.strompreis_cent_kwh?.toString() || '',
      hersteller: anlage.hersteller || '',
      wechselrichter: anlage.wechselrichter || '',
      notizen: anlage.notizen || ''
    })
    setIsEditing(false)
    setError(null)
  }

  if (!isEditing) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded flex items-center gap-2">
            <SimpleIcon type="check" className="w-5 h-5" />
            Änderungen erfolgreich gespeichert!
          </div>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white flex items-center justify-center gap-2"
        >
          <SimpleIcon type="edit" className="w-4 h-4" />
          Stammdaten bearbeiten
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <SimpleIcon type="edit" className="w-5 h-5 text-gray-700" />
        Stammdaten bearbeiten
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded flex items-center gap-2">
          <SimpleIcon type="error" className="w-5 h-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basis-Daten */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Standort *
            </label>
            <input
              type="text"
              name="standort"
              value={formData.standort}
              onChange={handleChange}
              required
              placeholder="z.B. Nümbrecht"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Inbetriebnahme *
            </label>
            <input
              type="date"
              name="inbetriebnahme"
              value={formData.inbetriebnahme}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nennleistung (kWp) *
            </label>
            <input
              type="number"
              name="nennleistung_kwp"
              value={formData.nennleistung_kwp}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 9.99"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anschaffungskosten (€) *
            </label>
            <input
              type="number"
              name="anschaffungskosten"
              value={formData.anschaffungskosten}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 18000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tarife */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Einspeisevergütung (ct/kWh) *
            </label>
            <input
              type="number"
              name="einspeisetarif_cent_kwh"
              value={formData.einspeisetarif_cent_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 8.03"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strompreis Bezug (ct/kWh) *
            </label>
            <input
              type="number"
              name="strompreis_cent_kwh"
              value={formData.strompreis_cent_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 32"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Optional */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hersteller (optional)
            </label>
            <input
              type="text"
              name="hersteller"
              value={formData.hersteller}
              onChange={handleChange}
              placeholder="z.B. Huawei, SolarEdge"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wechselrichter (optional)
            </label>
            <input
              type="text"
              name="wechselrichter"
              value={formData.wechselrichter}
              onChange={handleChange}
              placeholder="z.B. Modell, Seriennummer"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Notizen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notizen (optional)
          </label>
          <textarea
            name="notizen"
            value={formData.notizen}
            onChange={handleChange}
            rows={3}
            placeholder="Zusätzliche Informationen..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-6 py-3 rounded-md font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3 rounded-md font-medium text-white flex items-center gap-2 ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Speichert...' : (
              <>
                <SimpleIcon type="save" className="w-4 h-4" />
                Speichern
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
