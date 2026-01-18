// app/eingabe/page.tsx
// KOMPLETT mit PV, E-Auto, Wärmepumpe, Speicher

import { supabase } from '@/lib/supabase'
import MonatsdatenForm from '@/components/MonatsdatenForm'
import EAutoMonatsdatenForm from '@/components/EAutoMonatsdatenForm'
import WaermepumpeMonatsdatenForm from '@/components/WaermepumpeMonatsdatenForm'
import SpeicherMonatsdatenForm from '@/components/SpeicherMonatsdatenForm'
import Link from 'next/link'

async function getData() {
  const { data: anlage } = await supabase.from('anlagen').select('*').limit(1).single()
  
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
    anlage, 
    eAutos: eAutos || [], 
    waermepumpen: waermepumpen || [],
    speicher: speicher || []
  }
}

export const dynamic = 'force-dynamic'

export default async function EingabePage({ 
  searchParams 
}: { 
  searchParams: Promise<{ tab?: string }> 
}) {
  const { anlage, eAutos, waermepumpen, speicher } = await getData()
  const params = await searchParams
  const activeTab = params.tab || 'pv'

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Keine Anlage gefunden</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">➕ Monatsdaten erfassen</h1>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
            >
              ← Dashboard
            </Link>
          </div>
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <Link 
                href="/eingabe?tab=pv" 
                className={`${
                  activeTab === 'pv'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  🚗 E-Auto ({eAutos.length})
                </Link>
              )}

              {waermepumpen.length > 0 && (
                <Link 
                  href="/eingabe?tab=waermepumpe" 
                  className={`${
                    activeTab === 'waermepumpe'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  🔥 Wärmepumpe ({waermepumpen.length})
                </Link>
              )}

              {speicher.length > 0 && (
                <Link 
                  href="/eingabe?tab=speicher" 
                  className={`${
                    activeTab === 'speicher'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
                >
                  🔋 Speicher ({speicher.length})
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'pv' && <MonatsdatenForm anlage={anlage} />}
        {activeTab === 'e-auto' && eAutos.length > 0 && (
          <EAutoMonatsdatenForm investition={eAutos[0]} />
        )}
        {activeTab === 'waermepumpe' && waermepumpen.length > 0 && (
          <WaermepumpeMonatsdatenForm investition={waermepumpen[0]} />
        )}
        {activeTab === 'speicher' && speicher.length > 0 && (
          <SpeicherMonatsdatenForm investition={speicher[0]} />
        )}
      </div>
    </main>
  )
}
