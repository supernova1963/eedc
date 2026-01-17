// app/eingabe/page.tsx
// Erweitert mit Tab-Navigation für verschiedene Investitionstypen

import { supabase } from '@/lib/supabase'
import MonatsdatenForm from '@/components/MonatsdatenForm'
import EAutoMonatsdatenForm from '@/components/EAutoMonatsdatenForm'
import Link from 'next/link'

async function getData() {
  const { data: anlage } = await supabase
    .from('anlagen')
    .select('*')
    .limit(1)
    .single()

  // E-Autos laden
  const { data: eAutos } = await supabase
    .from('alternative_investitionen')
    .select('*')
    .eq('typ', 'e-auto')
    .eq('aktiv', true)

  return {
    anlage,
    eAutos: eAutos || []
  }
}

export const dynamic = 'force-dynamic'

export default async function EingabePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string, edit?: string }>
}) {
  const { anlage, eAutos } = await getData()
  const params = await searchParams
  const activeTab = params.tab || 'pv'
  const editId = params.edit

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Keine Anlage gefunden.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {editId ? '✏️ Monatsdaten bearbeiten' : '➕ Monatsdaten erfassen'}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Monatliche Verbrauchs- und Ertragsdaten
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/uebersicht"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
              >
                📋 Zur Übersicht
              </Link>
              <Link
                href="/"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
              >
                ← Dashboard
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <Link
                href="/eingabe?tab=pv"
                className={`${
                  activeTab === 'pv'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
              >
                🌞 PV-Anlage
              </Link>
              
              {eAutos.length > 0 && (
                <Link
                  href="/eingabe?tab=e-auto"
                  className={`${
                    activeTab === 'e-auto'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  🚗 E-Auto ({eAutos.length})
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'pv' && (
          <MonatsdatenForm anlage={anlage} editId={editId} />
        )}
        
        {activeTab === 'e-auto' && eAutos.length > 0 && (
          <div className="space-y-6">
            {eAutos.length === 1 ? (
              <EAutoMonatsdatenForm investition={eAutos[0]} />
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    💡 Du hast mehrere E-Autos. Wähle eines aus:
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {eAutos.map(auto => (
                    <Link
                      key={auto.id}
                      href={`/eingabe?tab=e-auto&auto=${auto.id}`}
                      className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition"
                    >
                      <div className="flex items-center">
                        <span className="text-4xl mr-4">🚗</span>
                        <div>
                          <div className="font-medium text-gray-900">
                            {auto.bezeichnung}
                          </div>
                          <div className="text-sm text-gray-500">
                            seit {new Date(auto.anschaffungsdatum).getFullYear()}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'e-auto' && eAutos.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">
              Noch kein E-Auto erfasst.
            </p>
            <Link
              href="/investitionen/neu"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
            >
              ➕ E-Auto erfassen
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
