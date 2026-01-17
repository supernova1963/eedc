// app/page.tsx
// FIX: Konvertiert String-Werte zu Zahlen

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import DashboardChart from '@/components/DashboardChart'

async function getDashboardData() {
  const { data: anlage } = await supabase
    .from('anlagen')
    .select('*')
    .limit(1)
    .single()

  const { data: monatsdaten } = await supabase
    .from('monatsdaten')
    .select('*')
    .order('jahr', { ascending: true })
    .order('monat', { ascending: true })

  return { anlage, monatsdaten: monatsdaten || [] }
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { anlage, monatsdaten } = await getDashboardData()

  // String zu Number konvertieren
  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  // Berechnungen mit String→Number Konvertierung
  const gesamtErzeugung = monatsdaten.reduce((sum, m) => 
    sum + toNum(m.pv_erzeugung_kwh), 0
  )
  
  const gesamtEigenverbrauch = monatsdaten.reduce((sum, m) => 
    sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0
  )
  
  const gesamtVerbrauch = monatsdaten.reduce((sum, m) => 
    sum + toNum(m.gesamtverbrauch_kwh), 0
  )
  
  const eigenverbrauchsquote = gesamtErzeugung > 0 
    ? (gesamtEigenverbrauch / gesamtErzeugung) * 100 
    : 0
    
  const autarkiegrad = gesamtVerbrauch > 0 
    ? (gesamtEigenverbrauch / gesamtVerbrauch) * 100 
    : 0

  const fmt = (num: number) => num.toLocaleString('de-DE', { maximumFractionDigits: 0 })

  // Chart Daten
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const chartData = monatsdaten.map(m => ({
    monat: `${monatsnamen[m.monat]} ${m.jahr}`,
    eigenverbrauch: toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh),
    erzeugung: toNum(m.pv_erzeugung_kwh),
    verbrauch: toNum(m.gesamtverbrauch_kwh)
  }))

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <span>🌞</span> EEDC Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!anlage ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Keine Anlage gefunden</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Gesamt-Verbrauch</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {fmt(gesamtVerbrauch)} kWh
                    </p>
                  </div>
                  <span className="text-4xl">⚡</span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">PV-Erzeugung</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {fmt(gesamtErzeugung)} kWh
                    </p>
                  </div>
                  <span className="text-4xl">☀️</span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Eigenverbrauch</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {fmt(gesamtEigenverbrauch)} kWh
                    </p>
                  </div>
                  <span className="text-4xl">🏠</span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Ø Autarkie</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {autarkiegrad.toFixed(0)}%
                    </p>
                  </div>
                  <span className="text-4xl">📊</span>
                </div>
              </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  📈 Monatlicher Verlauf
                </h2>
                <DashboardChart data={chartData} />
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 Schnellzugriff</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href="/eingabe"
                  className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
                >
                  <span className="text-3xl">➕</span>
                  <div>
                    <div className="font-medium text-gray-900">Monatsdaten erfassen</div>
                    <div className="text-sm text-gray-600">PV & E-Auto Daten</div>
                  </div>
                </Link>
                
                <Link
                  href="/investitionen"
                  className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
                >
                  <span className="text-3xl">💼</span>
                  <div>
                    <div className="font-medium text-gray-900">Investitionen</div>
                    <div className="text-sm text-gray-600">E-Auto, Wärmepumpe, etc.</div>
                  </div>
                </Link>
                
                <Link
                  href="/auswertung"
                  className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
                >
                  <span className="text-3xl">📊</span>
                  <div>
                    <div className="font-medium text-gray-900">Auswertungen</div>
                    <div className="text-sm text-gray-600">ROI, Charts, Bilanz</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
