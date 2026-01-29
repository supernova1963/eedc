// app/eingabe/page.tsx
// Monatsdaten-Erfassung mit Multi-Anlage Support
// Unterscheidet: anlagen_komponenten vs haushalt_komponenten

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getUserAnlagen, resolveAnlageId } from '@/lib/anlagen-helpers'
import HaushaltMonatsdatenForm from '@/components/HaushaltMonatsdatenForm'
import EAutoMonatsdatenForm from '@/components/EAutoMonatsdatenForm'
import WaermepumpeMonatsdatenForm from '@/components/WaermepumpeMonatsdatenForm'
import SpeicherMonatsdatenForm from '@/components/SpeicherMonatsdatenForm'
import WechselrichterMonatsdatenForm from '@/components/WechselrichterMonatsdatenForm'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'
import { AnlagenSelector } from '@/components/AnlagenSelector'

async function getData(anlageId: string, mitgliedId: string) {
  const supabase = await createClient()

  // Anlagen-Komponenten (zur aktuellen Anlage gehörig)
  const { data: speicher } = await supabase
    .from('anlagen_komponenten')
    .select('*')
    .eq('anlage_id', anlageId)
    .eq('typ', 'speicher')
    .eq('aktiv', true)

  const { data: wechselrichter } = await supabase
    .from('anlagen_komponenten')
    .select('*')
    .eq('anlage_id', anlageId)
    .eq('typ', 'wechselrichter')
    .eq('aktiv', true)

  // Haushalts-Komponenten (zum Mitglied gehörig, nicht zur Anlage!)
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

  return {
    speicher: speicher || [],
    wechselrichter: wechselrichter || [],
    eAutos: eAutos || [],
    waermepumpen: waermepumpen || []
  }
}

export const dynamic = 'force-dynamic'

export default async function EingabePage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; anlageId?: string }>
}) {
  const mitglied = await getCurrentMitglied()

  if (!mitglied.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Nicht authentifiziert</p>
        </div>
      </div>
    )
  }

  // Alle Anlagen des Users holen
  const { data: alleAnlagen } = await getUserAnlagen()

  // Bestimme welche Anlage verwendet werden soll
  const params = await searchParams
  const { anlageId, anlage } = await resolveAnlageId(params.anlageId)

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Keine Anlage gefunden</p>
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

  const { speicher, wechselrichter, eAutos, waermepumpen } = await getData(anlage.id, mitglied.data.id)
  const activeTab = params.tab || 'haushalt'

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SimpleIcon type="plus" className="w-8 h-8 text-blue-600" />
                Monatsdaten erfassen
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {anlage.anlagenname} - {anlage.leistung_kwp} kWp
              </p>
            </div>
            <div className="flex items-center gap-4">
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
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <Link
                href={`/eingabe?tab=haushalt${anlageId ? `&anlageId=${anlageId}` : ''}`}
                className={`${
                  activeTab === 'haushalt'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="home" className="w-4 h-4" />
                Haushalt
              </Link>

              {eAutos.length > 0 && (
                <Link
                  href={`/eingabe?tab=e-auto${anlageId ? `&anlageId=${anlageId}` : ''}`}
                  className={`${
                    activeTab === 'e-auto'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <SimpleIcon type="car" className="w-4 h-4" />
                  E-Auto ({eAutos.length})
                </Link>
              )}

              {waermepumpen.length > 0 && (
                <Link
                  href={`/eingabe?tab=waermepumpe${anlageId ? `&anlageId=${anlageId}` : ''}`}
                  className={`${
                    activeTab === 'waermepumpe'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <SimpleIcon type="heat" className="w-4 h-4" />
                  Wärmepumpe ({waermepumpen.length})
                </Link>
              )}

              {speicher.length > 0 && (
                <Link
                  href={`/eingabe?tab=speicher${anlageId ? `&anlageId=${anlageId}` : ''}`}
                  className={`${
                    activeTab === 'speicher'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <SimpleIcon type="battery" className="w-4 h-4" />
                  Speicher ({speicher.length})
                </Link>
              )}

              {wechselrichter.length > 0 && (
                <Link
                  href={`/eingabe?tab=wechselrichter${anlageId ? `&anlageId=${anlageId}` : ''}`}
                  className={`${
                    activeTab === 'wechselrichter'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <SimpleIcon type="inverter" className="w-4 h-4" />
                  Wechselrichter ({wechselrichter.length})
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'haushalt' && <HaushaltMonatsdatenForm anlage={anlage} />}
        {activeTab === 'e-auto' && eAutos.length > 0 && (
          <EAutoMonatsdatenForm investition={eAutos[0]} />
        )}
        {activeTab === 'waermepumpe' && waermepumpen.length > 0 && (
          <WaermepumpeMonatsdatenForm investition={waermepumpen[0]} />
        )}
        {activeTab === 'speicher' && speicher.length > 0 && (
          <SpeicherMonatsdatenForm investition={speicher[0]} />
        )}
        {activeTab === 'wechselrichter' && wechselrichter.length > 0 && (
          <WechselrichterMonatsdatenForm investition={wechselrichter[0]} />
        )}
      </div>
    </main>
  )
}
