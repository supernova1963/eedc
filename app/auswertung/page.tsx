// app/auswertung/page.tsx
// KOMPLETT mit PV, E-Auto, Wärmepumpe, Speicher, Gesamtbilanz

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getUserAnlagen, resolveAnlageId } from '@/lib/anlagen-helpers'
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
import { AnlagenSelector } from '@/components/AnlagenSelector'

async function getAuswertungData(anlageId: string, mitgliedId: string) {
  const supabase = await createClient()

  const { data: monatsdaten } = await supabase
    .from('monatsdaten')
    .select('*')
    .eq('anlage_id', anlageId)
    .order('jahr', { ascending: true })
    .order('monat', { ascending: true })

  const { data: investitionen } = await supabase
    .from('investitionen_uebersicht')
    .select('*')
    .eq('mitglied_id', mitgliedId)
    .order('anschaffungsdatum', { ascending: false })

  // Haushalts-Komponenten (E-Auto, Wärmepumpe) - mitglied-bezogen
  const { data: eAutos } = await supabase
    .from('haushalt_komponenten')
    .select('*')
    .eq('mitglied_id', mitgliedId)
    .eq('typ', 'e-auto')
    .eq('aktiv', true)

  const { data: waermepumpen } = await supabase
    .from('haushalt_komponenten')
    .select('*')
    .eq('mitglied_id', mitgliedId)
    .eq('typ', 'waermepumpe')
    .eq('aktiv', true)

  // Anlagen-Komponenten (Speicher) - anlage-bezogen
  const { data: speicher } = await supabase
    .from('anlagen_komponenten')
    .select('*')
    .eq('anlage_id', anlageId)
    .eq('typ', 'speicher')
    .eq('aktiv', true)

  return {
    monatsdaten: monatsdaten || [],
    investitionen: investitionen || [],
    eAutos: eAutos || [],
    waermepumpen: waermepumpen || [],
    speicher: speicher || []
  }
}

async function getEAutoDetails(autoId: string) {
  const supabase = await createClient()

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
  const supabase = await createClient()

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
  const supabase = await createClient()

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
  searchParams: Promise<{ tab?: string, auto?: string, wp?: string, speicher?: string, anlageId?: string }>
}) {
  const mitglied = await getCurrentMitglied()

  if (!mitglied.data) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="chart" className="w-8 h-8 text-blue-600" />
              Auswertung
            </h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Nicht authentifiziert</p>
          </div>
        </div>
      </main>
    )
  }

  const params = await searchParams
  const { data: alleAnlagen } = await getUserAnlagen()
  const { anlageId, anlage } = await resolveAnlageId(params.anlageId)

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="chart" className="w-8 h-8 text-blue-600" />
              Auswertung
            </h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Keine Anlage gefunden.</p>
            <Link
              href="/anlage"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Jetzt Anlage anlegen
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const { monatsdaten, investitionen, eAutos, waermepumpen, speicher } = await getAuswertungData(anlage.id, mitglied.data.id)
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SimpleIcon type="chart" className="w-8 h-8 text-blue-600" />
                {activeTab === 'pv' && 'PV-Anlage Auswertung'}
                {activeTab === 'e-auto' && 'E-Auto Details'}
                {activeTab === 'waermepumpe' && 'Wärmepumpe Details'}
                {activeTab === 'speicher' && 'Speicher Details'}
                {activeTab === 'gesamt' && 'Gesamtbilanz'}
                {activeTab === 'roi' && 'ROI-Analyse'}
                {activeTab === 'co2' && 'CO₂-Impact'}
                {activeTab === 'prognose' && 'Prognose vs. IST'}
                {activeTab === 'monatsdetail' && 'Monats-Details'}
                {activeTab === 'optimierung' && 'Optimierungsvorschläge'}
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {anlage.anlagenname} - {anlage.leistung_kwp} kWp
              </p>
            </div>
            <div className="flex gap-3">
              {alleAnlagen && alleAnlagen.length > 1 && (
                <AnlagenSelector
                  anlagen={alleAnlagen}
                  currentAnlageId={anlageId}
                />
              )}
              <Link
                href="/meine-anlage"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 flex items-center gap-2"
              >
                <SimpleIcon type="back" className="w-4 h-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {monatsdaten.length === 0 && activeTab === 'pv' ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
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
