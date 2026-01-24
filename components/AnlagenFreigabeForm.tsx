// components/AnlagenFreigabeForm.tsx
// FIXED: upsert mit onConflict

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import SimpleIcon from './SimpleIcon'

interface AnlagenFreigabeFormProps {
  anlage: any
  freigaben: any
}

export default function AnlagenFreigabeForm({ anlage, freigaben }: AnlagenFreigabeFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    profil_oeffentlich: freigaben?.profil_oeffentlich || false,
    kennzahlen_oeffentlich: freigaben?.kennzahlen_oeffentlich || false,
    auswertungen_oeffentlich: freigaben?.auswertungen_oeffentlich || false,
    investitionen_oeffentlich: freigaben?.investitionen_oeffentlich || false,
    monatsdaten_oeffentlich: freigaben?.monatsdaten_oeffentlich || false,
    standort_genau: freigaben?.standort_genau || false
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // FIXED: onConflict Parameter hinzugefügt
      const { error: dbError } = await supabase
        .from('anlagen_freigaben')
        .upsert({
          anlage_id: anlage.id,
          ...formData
        }, {
          onConflict: 'anlage_id'  // ← DAS WAR DAS PROBLEM!
        })

      if (dbError) throw dbError

      setSuccess(true)
      router.refresh()

      setTimeout(() => setSuccess(false), 3000)

    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <SimpleIcon type="lock" className="w-5 h-5 text-gray-700" />
        Privatsphäre & Freigabe
      </h2>

      <p className="text-sm text-gray-600 mb-6">
        Bestimme, welche Informationen für andere Community-Mitglieder sichtbar sein sollen.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded flex items-center gap-2">
          <SimpleIcon type="error" className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded flex items-center gap-2">
          <SimpleIcon type="check" className="w-5 h-5" />
          Freigabe-Einstellungen gespeichert!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profil */}
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="profil_oeffentlich"
              checked={formData.profil_oeffentlich}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <div className="font-medium text-gray-900">Profil öffentlich zeigen</div>
              <div className="text-sm text-gray-600">
                Name, Standort (PLZ/Ort) und Komponenten-Übersicht
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="kennzahlen_oeffentlich"
              checked={formData.kennzahlen_oeffentlich}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <div className="font-medium text-gray-900">Kennzahlen teilen</div>
              <div className="text-sm text-gray-600">
                Erzeugung, Verbrauch, Eigenverbrauch, Autarkie
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="auswertungen_oeffentlich"
              checked={formData.auswertungen_oeffentlich}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <div className="font-medium text-gray-900">Auswertungen teilen</div>
              <div className="text-sm text-gray-600">
                ROI, Amortisation, CO₂-Einsparung
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="investitionen_oeffentlich"
              checked={formData.investitionen_oeffentlich}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <div className="font-medium text-gray-900">Investitionen teilen</div>
              <div className="text-sm text-gray-600">
                Anschaffungskosten, Einsparungen (ohne private Details)
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="monatsdaten_oeffentlich"
              checked={formData.monatsdaten_oeffentlich}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <div className="font-medium text-gray-900">Monatsdaten teilen</div>
              <div className="text-sm text-gray-600">
                Detaillierte monatliche Werte und Entwicklung
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="standort_genau"
              checked={formData.standort_genau}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <div className="font-medium text-gray-900">Genauer Standort</div>
              <div className="text-sm text-gray-600">
                Exakte Koordinaten (für Karte), sonst nur PLZ-Bereich
              </div>
            </div>
          </label>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-2">
            <SimpleIcon type="info" className="w-5 h-5 text-blue-600" />
            <div className="text-sm text-blue-900">
              <strong>Hinweis:</strong> Diese Einstellungen wirken sich nur auf die Community-Ansicht aus. 
              Deine persönlichen Daten bleiben immer privat und werden nie weitergegeben.
            </div>
          </div>
        </div>

        {/* Button */}
        <div className="flex justify-end pt-4">
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
