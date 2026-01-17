// app/auswertung/page.tsx
// Erweitert um E-Auto Details Tab

import { supabase } from '@/lib/supabase'
import WirtschaftlichkeitStats from '@/components/WirtschaftlichkeitStats'
import GesamtHaushaltBilanz from '@/components/GesamtHaushaltBilanz'
import EAutoAuswertung from '@/components/EAutoAuswertung'
import Link from 'next/link'

async function getAuswertungData() {
  const { data: monatsdaten } = await supabase
    .from('monatsdaten_kennzahlen')
    .select('*')
    .order('jahr', { ascending: true })
    .order('monat', { ascending: true })

  const { data: anlage } = await supabase
    .from('anlagen')
    .select('*')
    .limit(1)
    .single()

  const { data: investitionen } = await supabase
    .from('investitionen_uebersicht')
    .select('*')
    .order('anschaffungsdatum', { ascending: false })

  // E-Autos für Detail-Tab
  const { data: eAutos } = await supabase
    .from('alternative_investitionen')
    .select('*')
    .eq('typ', 'e-auto')
    .eq('aktiv', true)

  return {
    monatsdaten: monatsdaten || [],
    anlage,
    investitionen: investitionen || [],
    eAutos: eAutos || []
  }
}

async function getEAutoDetails(autoId: string) {
  // Prognose vs. Ist
  const { data: prognoseVergleich } = await supabase
    .from('investition_prognose_ist_vergleich')
    .select('*')
    .eq('investition_id', autoId)
    .order('jahr', { ascending: false })
    .limit(1)
    .single()

  // Monatsdaten
  const { data: monatsdaten } = await supabase
    .from('investition_monatsdaten_detail')
    .select('*')
    .eq('investition_id', autoId)
    .order('jahr', { ascending: false })
    .order('monat', { ascending: false })

  return {
    prognoseVergleich,
    monatsdaten: monatsdaten || []
  }
}

export const dynamic = 'force-dynamic'

export default async function AuswertungPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string, auto?: string }>
}) {
  const { monatsdaten, anlage, investitionen, eAutos } = await getAuswertungData()
  const params = await searchParams
  const activeTab = params.tab || 'pv'
  const selectedAutoId = params.auto

  // E-Auto Details laden wenn Tab aktiv
  let eAutoDetails = null
  let selectedEAuto = null
  
  if (activeTab === 'e-auto' && eAutos.length > 0) {
    const autoId = selectedAutoId || eAutos[0].id
    selectedEAuto = eAutos.find(a => a.id === autoId) || eAutos[0]
    eAutoDetails = await getEAutoDetails(selectedEAuto.id)
  }

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">📊 Auswertung</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                📊 Erweiterte Auswertungen
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Wirtschaftlichkeit, ROI und CO₂-Bilanz
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
            >
              ← Dashboard
            </Link>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <Link
                href="/auswertung?tab=pv"
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
                  href="/auswertung?tab=e-auto"
                  className={`${
                    activeTab === 'e-auto'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  🚗 E-Auto Details
                </Link>
              )}
              
              {investitionen.length > 0 && (
                <Link
                  href="/auswertung?tab=gesamt"
                  className={`${
                    activeTab === 'gesamt'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  💎 Gesamtbilanz
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {monatsdaten.length === 0 && activeTab === 'pv' ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">
              Keine Daten vorhanden. Erfasse zunächst einige Monatsdaten.
            </p>
            <Link
              href="/eingabe"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
            >
              ➕ Daten erfassen
            </Link>
          </div>
        ) : (
          <>
            {activeTab === 'pv' && (
              <WirtschaftlichkeitStats monatsdaten={monatsdaten} anlage={anlage} />
            )}
            
            {activeTab === 'e-auto' && selectedEAuto && eAutoDetails && (
              <div>
                {/* Auto-Auswahl wenn mehrere */}
                {eAutos.length > 1 && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-blue-900 mb-2">
                      E-Auto auswählen:
                    </label>
                    <div className="flex gap-2">
                      {eAutos.map(auto => (
                        <Link
                          key={auto.id}
                          href={`/auswertung?tab=e-auto&auto=${auto.id}`}
                          className={`px-4 py-2 rounded-md font-medium ${
                            selectedEAuto.id === auto.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {auto.bezeichnung}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                <EAutoAuswertung 
                  investition={selectedEAuto}
                  prognoseVergleich={eAutoDetails.prognoseVergleich}
                  monatsdaten={eAutoDetails.monatsdaten}
                />
              </div>
            )}
            
            {activeTab === 'gesamt' && investitionen.length > 0 && (
              <GesamtHaushaltBilanz 
                monatsdaten={monatsdaten} 
                anlage={anlage}
                investitionen={investitionen}
              />
            )}
          </>
        )}
      </div>
    </main>
  )
}
