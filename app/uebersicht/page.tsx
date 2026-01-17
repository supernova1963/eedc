// app/uebersicht/page.tsx
// Seite mit Tabellen-Übersicht aller Monatsdaten

import { supabase } from '@/lib/supabase'
import MonatsdatenTable from '@/components/MonatsdatenTable'
import Link from 'next/link'

async function getMonatsdaten() {
  const { data, error } = await supabase
    .from('monatsdaten_kennzahlen')
    .select('*')
    .order('jahr', { ascending: false })
    .order('monat', { ascending: false })

  if (error) {
    console.error('Fehler beim Laden:', error)
    return []
  }

  return data || []
}

export const dynamic = 'force-dynamic'

export default async function UebersichtPage() {
  const monatsdaten = await getMonatsdaten()

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                📋 Daten-Übersicht
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Alle erfassten Monatsdaten im Überblick
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
              >
                ← Dashboard
              </Link>
              <Link
                href="/eingabe"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
              >
                ➕ Neue Daten
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MonatsdatenTable monatsdaten={monatsdaten} />
      </div>
    </main>
  )
}
