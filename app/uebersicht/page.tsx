// app/uebersicht/page.tsx
// Mit Erlöse-Spalte

import { supabase } from '@/lib/supabase'
import Link from 'next/link'

async function getMonatsdaten() {
  const { data } = await supabase
    .from('monatsdaten')
    .select('*')
    .order('jahr', { ascending: false })
    .order('monat', { ascending: false })

  return data || []
}

export const dynamic = 'force-dynamic'

export default async function UebersichtPage() {
  const monatsdaten = await getMonatsdaten()

  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  
  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  const fmt = (num: number) => {
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📋 PV-Monatsdaten Übersicht</h1>
              <p className="mt-1 text-sm text-gray-600">
                Alle erfassten Monatsdaten deiner PV-Anlage
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
                ➕ Daten erfassen
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {monatsdaten.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Noch keine Monatsdaten erfasst</p>
            <Link
              href="/eingabe"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
            >
              ➕ Ersten Monat erfassen
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Alle Monatsdaten ({monatsdaten.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Monat
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Verbrauch
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      PV-Erzeugung
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Eigenverbrauch
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Einspeisung
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Netzbezug
                    </th>
                    {/* NEU: Erlöse */}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Erlöse
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Eigenverbrauch %
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Autarkie %
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monatsdaten.map((data) => {
                    const eigenverbrauch = toNum(data.direktverbrauch_kwh) + toNum(data.batterieentladung_kwh)
                    const erzeugung = toNum(data.pv_erzeugung_kwh)
                    const verbrauch = toNum(data.gesamtverbrauch_kwh)
                    const erloes = toNum(data.einspeisung_ertrag_euro)
                    
                    const eigenverbrauchsquote = erzeugung > 0 
                      ? (eigenverbrauch / erzeugung) * 100 
                      : 0
                    const autarkiegrad = verbrauch > 0 
                      ? (eigenverbrauch / verbrauch) * 100 
                      : 0
                    
                    return (
                      <tr key={data.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {monatsnamen[data.monat]} {data.jahr}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {fmt(verbrauch)} kWh
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {fmt(erzeugung)} kWh
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                          {fmt(eigenverbrauch)} kWh
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {fmt(toNum(data.einspeisung_kwh))} kWh
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {fmt(toNum(data.netzbezug_kwh))} kWh
                        </td>
                        {/* NEU: Erlöse */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                          {fmt(erloes)} €
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium">
                            {fmt(eigenverbrauchsquote)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
                            {fmt(autarkiegrad)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
