// components/AnlagenFreigabeForm.tsx
// FIXED: Server Action statt Client-Side DB Call

'use client'

import { useState } from 'react'
import { updateFreigaben } from '@/lib/freigabe-actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SimpleIcon from './SimpleIcon'
import { card, text, alert, btn, input } from '@/lib/styles'

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
    <div className={card.padded}>
      <h2 className={`${text.h2} mb-4 flex items-center gap-2`}>
        <SimpleIcon type="lock" className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        Privatsphäre & Freigabe
      </h2>

      <p className={`${text.sm} mb-6`}>
        Bestimme, welche Informationen für andere Community-Mitglieder sichtbar sein sollen.
      </p>

      {error && (
        <div className={`${alert.errorInline} mb-4 flex items-center gap-2`}>
          <SimpleIcon type="error" className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className={`${alert.successInline} mb-4 flex items-center gap-2`}>
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
              className={`mt-1 ${input.checkbox}`}
            />
            <div>
              <div className={`font-medium ${text.primary}`}>Profil öffentlich zeigen</div>
              <div className={text.sm}>
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
              className={`mt-1 ${input.checkbox}`}
            />
            <div>
              <div className={`font-medium ${text.primary}`}>Kennzahlen teilen</div>
              <div className={text.sm}>
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
              className={`mt-1 ${input.checkbox}`}
            />
            <div>
              <div className={`font-medium ${text.primary}`}>Auswertungen teilen</div>
              <div className={text.sm}>
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
              className={`mt-1 ${input.checkbox}`}
            />
            <div>
              <div className={`font-medium ${text.primary}`}>Investitionen teilen</div>
              <div className={text.sm}>
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
              className={`mt-1 ${input.checkbox}`}
            />
            <div>
              <div className={`font-medium ${text.primary}`}>Monatsdaten teilen</div>
              <div className={text.sm}>
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
              className={`mt-1 ${input.checkbox}`}
            />
            <div>
              <div className={`font-medium ${text.primary}`}>Genauer Standort</div>
              <div className={text.sm}>
                Exakte Koordinaten (für Karte), sonst nur PLZ-Bereich
              </div>
            </div>
          </label>
        </div>

        {/* Info */}
        <div className={alert.info}>
          <div className="flex gap-2">
            <SimpleIcon type="info" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="text-sm">
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
            className={`${btn.secondary} flex items-center gap-2`}
          >
            <SimpleIcon type="link" className="w-4 h-4" />
            Öffentliches Profil ansehen
          </Link>

          {/* Speichern-Button */}
          <button
            type="submit"
            disabled={loading}
            className={`${loading ? btn.disabled : btn.primaryLg} flex items-center gap-2`}
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
        <div className={`${alert.warning} mt-4`}>
          <div className="flex gap-2">
            <SimpleIcon type="info" className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <div className="text-sm">
              <strong>Hinweis:</strong> Dein Profil ist derzeit nicht öffentlich sichtbar.
              Aktiviere &quot;Profil öffentlich zeigen&quot;, damit andere Community-Mitglieder deine Anlage sehen können.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
