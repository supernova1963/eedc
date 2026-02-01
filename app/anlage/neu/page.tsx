// app/anlage/neu/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAnlage } from '@/lib/anlage-actions'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'

export default function NeueAnlagePage() {
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    console.log('📤 Form submitted')
    setError('')
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)

    try {
      console.log('🔄 Calling createAnlage...')
      const result = await createAnlage(formData)
      console.log('📥 Result:', result)

      if (result?.error) {
        console.error('❌ Error from server:', result.error)
        setError(result.error)
        setIsSubmitting(false)
      } else if (result?.success && result?.anlageId) {
        console.log('✅ Success! Redirecting to anlage page...')
        router.push('/anlage?anlageId=' + result.anlageId)
      }
    } catch (err) {
      console.error('❌ Exception:', err)
      setError('Ein unerwarteter Fehler ist aufgetreten: ' + (err as Error).message)
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/anlage"
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <SimpleIcon type="back" className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="sun" className="w-8 h-8 text-yellow-500" />
              Neue Anlage erstellen
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basis-Informationen */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <SimpleIcon type="settings" className="w-5 h-5 text-blue-600" />
                Basis-Informationen
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Anlagenname *
                  </label>
                  <input
                    type="text"
                    name="anlagenname"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. PV-Anlage Einfamilienhaus"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leistung (kWp) *
                  </label>
                  <input
                    type="number"
                    name="leistung_kwp"
                    step="0.01"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="9.8"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Installationsdatum *
                  </label>
                  <input
                    type="date"
                    name="installationsdatum"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Standort */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <SimpleIcon type="globe" className="w-5 h-5 text-blue-600" />
                Standort
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PLZ
                  </label>
                  <input
                    type="text"
                    name="standort_plz"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="80331"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ort
                  </label>
                  <input
                    type="text"
                    name="standort_ort"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="München"
                  />
                </div>
              </div>
            </div>

            {/* Nächste Schritte */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <SimpleIcon type="info" className="w-5 h-5 text-blue-600" />
                Nach der Erstellung
              </h2>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700 mb-3">
                  <strong>Zusätzliche Komponenten separat erfassen:</strong>
                </p>
                <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                  <li>Batteriespeicher, Wechselrichter, etc. als <strong>Investitionen</strong> erfassen</li>
                  <li>E-Fahrzeuge und Wärmepumpen als separate Verbraucher anlegen</li>
                  <li>Monatsdaten über den Import oder manuell eingeben</li>
                </ul>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-6 border-t border-gray-200 flex gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Wird erstellt...' : 'Anlage erstellen'}
              </button>
              <Link
                href="/anlage"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold text-center"
              >
                Abbrechen
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
