// app/page.tsx
// Dashboard Hauptseite mit Navigation

import { supabase } from '@/lib/supabase'
import DashboardStats from '@/components/DashboardStats'
import MonthlyChart from '@/components/MonthlyChart'
import Link from 'next/link'

async function getDashboardData() {
  const { data: monatsdaten, error } = await supabase
    .from('monatsdaten_kennzahlen')
    .select('*')
    .order('jahr', { ascending: true })
    .order('monat', { ascending: true })

  if (error) {
    console.error('Fehler beim Laden der Daten:', error)
    return []
  }

  return monatsdaten || []
}

export const dynamic = 'force-dynamic'

export default async function Home() {
  const monatsdaten = await getDashboardData()

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🌞 EEDC Dashboard
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Electronic Energy Data Collection - Deine PV-Übersicht
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/auswertung"
                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 rounded-md font-medium text-purple-700"
              >
                📊 Auswertung
              </Link>
              <Link
                href="/uebersicht"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
              >
                📋 Übersicht
              </Link>
              <Link
                href="/eingabe"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
              >
                ➕ Daten erfassen
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {monatsdaten.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">
              Keine Daten gefunden. Erfasse zunächst deine ersten Monatsdaten.
            </p>
            <Link
              href="/eingabe"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
            >
              ➕ Erste Daten erfassen
            </Link>
          </div>
        ) : (
          <>
            {/* Statistik-Karten */}
            <DashboardStats monatsdaten={monatsdaten} />

            {/* Diagramme */}
            <div className="mt-8">
              <MonthlyChart monatsdaten={monatsdaten} />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
