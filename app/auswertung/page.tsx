// app/auswertung/page.tsx
// KOMPLETT mit PV, E-Auto, Wärmepumpe, Speicher, Gesamtbilanz

import { supabase } from '@/lib/supabase'
import WirtschaftlichkeitStats from '@/components/WirtschaftlichkeitStats'
import GesamtHaushaltBilanz from '@/components/GesamtHaushaltBilanz'
import EAutoAuswertung from '@/components/EAutoAuswertung'
import WaermepumpeAuswertung from '@/components/WaermepumpeAuswertung'
import SpeicherAuswertung from '@/components/SpeicherAuswertung'
import ROIDashboard from '@/components/ROIDashboard'
import CO2ImpactDashboard from '@/components/CO2ImpactDashboard'
import PrognoseVsIstDashboard from '@/components/PrognoseVsIstDashboard'
import MonatsDetailView from '@/components/MonatsDetailView'
import OptimierungsvorschlaegeDashboard from '@/components/OptimierungsvorschlaegeDashboard'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'

async function getAuswertungData() {
  const { data: monatsdaten } = await supabase
    .from('monatsdaten')
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

  const { data: eAutos } = await supabase
    .from('alternative_investitionen')
    .select('*')
    .eq('typ', 'e-auto')
    .eq('aktiv', true)
  
  const { data: waermepumpen } = await supabase
    .from('alternative_investitionen')
    .select('*')
    .eq('typ', 'waermepumpe')
    .eq('aktiv', true)

  const { data: speicher } = await supabase
    .from('alternative_investitionen')
    .select('*')
    .eq('typ', 'speicher')
    .eq('aktiv', true)

  return {
    monatsdaten: monatsdaten || [],
    anlage,
    investitionen: investitionen || [],
    eAutos: eAutos || [],
    waermepumpen: waermepumpen || [],
    speicher: speicher || []
  }
}

async function getEAutoDetails(autoId: string) {
  const { data: prognoseVergleich } = await supabase
    .from('investition_prognose_ist_vergleich')
    .select('*')
    .eq('investition_id', autoId)
    .order('jahr', { ascending: false })
    .limit(1)
    .single()

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

async function getWaermepumpeDetails(wpId: string) {
  const { data: prognoseVergleich } = await supabase
    .from('investition_prognose_ist_vergleich')
    .select('*')
    .eq('investition_id', wpId)
    .order('jahr', { ascending: false })
    .limit(1)
    .single()

  const { data: monatsdaten } = await supabase
    .from('investition_monatsdaten_detail')
    .select('*')
    .eq('investition_id', wpId)
    .order('jahr', { ascending: false })
    .order('monat', { ascending: false })

  return {
    prognoseVergleich,
    monatsdaten: monatsdaten || []
  }
}

async function getSpeicherDetails(speicherId: string) {
  const { data: prognoseVergleich } = await supabase
    .from('investition_prognose_ist_vergleich')
    .select('*')
    .eq('investition_id', speicherId)
    .order('jahr', { ascending: false })
    .limit(1)
    .single()

  const { data: monatsdaten } = await supabase
    .from('investition_monatsdaten_detail')
    .select('*')
    .eq('investition_id', speicherId)
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
  searchParams: Promise<{ tab?: string, auto?: string, wp?: string, speicher?: string }>
}) {
  const { monatsdaten, anlage, investitionen, eAutos, waermepumpen, speicher } = await getAuswertungData()
  const params = await searchParams
  const activeTab = params.tab || 'pv'
  const selectedAutoId = params.auto
  const selectedWpId = params.wp
  const selectedSpeicherId = params.speicher

  // E-Auto Details laden
  let eAutoDetails = null
  let selectedEAuto = null
  
  if (activeTab === 'e-auto' && eAutos.length > 0) {
    const autoId = selectedAutoId || eAutos[0].id
    selectedEAuto = eAutos.find(a => a.id === autoId) || eAutos[0]
    eAutoDetails = await getEAutoDetails(selectedEAuto.id)
  }

  // Wärmepumpe Details laden
  let waermepumpeDetails = null
  let selectedWaermepumpe = null
  
  if (activeTab === 'waermepumpe' && waermepumpen.length > 0) {
    const wpId = selectedWpId || waermepumpen[0].id
    selectedWaermepumpe = waermepumpen.find(w => w.id === wpId) || waermepumpen[0]
    waermepumpeDetails = await getWaermepumpeDetails(selectedWaermepumpe.id)
  }

  // Speicher Details laden
  let speicherDetails = null
  let selectedSpeicher = null
  
  if (activeTab === 'speicher' && speicher.length > 0) {
    const spId = selectedSpeicherId || speicher[0].id
    selectedSpeicher = speicher.find(s => s.id === spId) || speicher[0]
    speicherDetails = await getSpeicherDetails(selectedSpeicher.id)
  }

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="chart" className="w-8 h-8 text-blue-600" />
              Auswertung
            </h1>
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
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SimpleIcon type="chart" className="w-8 h-8 text-blue-600" />
                Erweiterte Auswertungen
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Wirtschaftlichkeit, ROI und CO₂-Bilanz
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 flex items-center gap-2"
            >
              <SimpleIcon type="back" className="w-4 h-4" />
              Dashboard
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
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="sun" className="w-4 h-4 text-yellow-500" />
                PV-Anlage
              </Link>

              {eAutos.length > 0 && (
                <Link
                  href="/auswertung?tab=e-auto"
                  className={`${
                    activeTab === 'e-auto'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <SimpleIcon type="car" className="w-4 h-4" />
                  E-Auto Details
                </Link>
              )}

              {waermepumpen.length > 0 && (
                <Link
                  href="/auswertung?tab=waermepumpe"
                  className={`${
                    activeTab === 'waermepumpe'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <SimpleIcon type="heat" className="w-4 h-4 text-red-500" />
                  Wärmepumpe Details
                </Link>
              )}

              {speicher.length > 0 && (
                <Link
                  href="/auswertung?tab=speicher"
                  className={`${
                    activeTab === 'speicher'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <SimpleIcon type="battery" className="w-4 h-4" />
                  Speicher Details
                </Link>
              )}

              {investitionen.length > 0 && (
                <Link
                  href="/auswertung?tab=gesamt"
                  className={`${
                    activeTab === 'gesamt'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <SimpleIcon type="gem" className="w-4 h-4 text-green-500" />
                  Gesamtbilanz
                </Link>
              )}

              <Link
                href="/auswertung?tab=roi"
                className={`${
                  activeTab === 'roi'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="trend" className="w-4 h-4 text-purple-500" />
                ROI-Analyse
              </Link>

              <Link
                href="/auswertung?tab=co2"
                className={`${
                  activeTab === 'co2'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="globe" className="w-4 h-4 text-green-500" />
                CO₂-Impact
              </Link>

              <Link
                href="/auswertung?tab=prognose"
                className={`${
                  activeTab === 'prognose'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="target" className="w-4 h-4 text-blue-500" />
                Prognose vs. IST
              </Link>

              <Link
                href="/auswertung?tab=monatsdetail"
                className={`${
                  activeTab === 'monatsdetail'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="calendar" className="w-4 h-4 text-indigo-500" />
                Monats-Details
              </Link>

              <Link
                href="/auswertung?tab=optimierung"
                className={`${
                  activeTab === 'optimierung'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="bulb" className="w-4 h-4 text-yellow-500" />
                Optimierung
              </Link>
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
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
            >
              <SimpleIcon type="plus" className="w-5 h-5" />
              Daten erfassen
            </Link>
          </div>
        ) : (
          <>
            {activeTab === 'pv' && (
              <WirtschaftlichkeitStats monatsdaten={monatsdaten} anlage={anlage} />
            )}

            {activeTab === 'e-auto' && selectedEAuto && eAutoDetails && (
              <div>
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

            {activeTab === 'waermepumpe' && selectedWaermepumpe && waermepumpeDetails && (
              <div>
                {waermepumpen.length > 1 && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-blue-900 mb-2">
                      Wärmepumpe auswählen:
                    </label>
                    <div className="flex gap-2">
                      {waermepumpen.map(wp => (
                        <Link
                          key={wp.id}
                          href={`/auswertung?tab=waermepumpe&wp=${wp.id}`}
                          className={`px-4 py-2 rounded-md font-medium ${
                            selectedWaermepumpe.id === wp.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {wp.bezeichnung}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                <WaermepumpeAuswertung 
                  investition={selectedWaermepumpe}
                  prognoseVergleich={waermepumpeDetails.prognoseVergleich}
                  monatsdaten={waermepumpeDetails.monatsdaten}
                />
              </div>
            )}

            {activeTab === 'speicher' && selectedSpeicher && speicherDetails && (
              <div>
                {speicher.length > 1 && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-blue-900 mb-2">
                      Speicher auswählen:
                    </label>
                    <div className="flex gap-2">
                      {speicher.map(sp => (
                        <Link
                          key={sp.id}
                          href={`/auswertung?tab=speicher&speicher=${sp.id}`}
                          className={`px-4 py-2 rounded-md font-medium ${
                            selectedSpeicher.id === sp.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {sp.bezeichnung}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                
                <SpeicherAuswertung 
                  investition={selectedSpeicher}
                  prognoseVergleich={speicherDetails.prognoseVergleich}
                  monatsdaten={speicherDetails.monatsdaten}
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

            {activeTab === 'roi' && (
              <ROIDashboard
                anlage={anlage}
                monatsdaten={monatsdaten}
                investitionen={investitionen}
              />
            )}

            {activeTab === 'co2' && (
              <CO2ImpactDashboard
                monatsdaten={monatsdaten}
                investitionen={investitionen}
              />
            )}

            {activeTab === 'prognose' && (
              <PrognoseVsIstDashboard
                monatsdaten={monatsdaten}
                anlage={anlage}
              />
            )}

            {activeTab === 'monatsdetail' && (
              <MonatsDetailView
                monatsdaten={monatsdaten}
                anlage={anlage}
              />
            )}

            {activeTab === 'optimierung' && (
              <OptimierungsvorschlaegeDashboard
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
