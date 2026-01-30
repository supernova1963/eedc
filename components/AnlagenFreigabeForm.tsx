// components/AnlagenFreigabeForm.tsx
// FIXED: Server Action statt Client-Side DB Call

'use client'

import { useState } from 'react'
import { updateFreigaben } from '@/lib/freigabe-actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
      // Server Action aufrufen
      const result = await updateFreigaben(anlage.id, formData)

      if (result.error) {
        throw new Error(result.error)
      }

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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <SimpleIcon type="lock" className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        Privatsphäre & Freigabe
      </h2>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Bestimme, welche Informationen für andere Community-Mitglieder sichtbar sein sollen.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded flex items-center gap-2">
          <SimpleIcon type="error" className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded flex items-center gap-2">
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
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Profil öffentlich zeigen</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
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
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Kennzahlen teilen</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
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
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Auswertungen teilen</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
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
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Investitionen teilen</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
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
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Monatsdaten teilen</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
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
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Genauer Standort</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Exakte Koordinaten (für Karte), sonst nur PLZ-Bereich
              </div>
            </div>
          </label>
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-2">
            <SimpleIcon type="info" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="text-sm text-blue-900 dark:text-blue-300">
              <strong>Hinweis:</strong> Diese Einstellungen wirken sich nur auf die Community-Ansicht aus.
              Deine persönlichen Daten bleiben immer privat und werden nie weitergegeben.
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-between items-center pt-4">
          {/* Vorschau-Button */}
          <Link
            href={`/community/${anlage.id}`}
            target="_blank"
            className="px-4 py-2 rounded-md font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <SimpleIcon type="link" className="w-4 h-4" />
            Öffentliches Profil ansehen
          </Link>

          {/* Speichern-Button */}
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

      {/* Vorschau-Hinweis */}
      {!formData.profil_oeffentlich && (
        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex gap-2">
            <SimpleIcon type="info" className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <div className="text-sm text-yellow-900 dark:text-yellow-300">
              <strong>Hinweis:</strong> Dein Profil ist derzeit nicht öffentlich sichtbar.
              Aktiviere &quot;Profil öffentlich zeigen&quot;, damit andere Community-Mitglieder deine Anlage sehen können.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
