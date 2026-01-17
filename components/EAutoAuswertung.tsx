// components/EAutoAuswertung.tsx
// Auswertung E-Auto: Prognose vs. Ist, Chart, Tabelle

'use client'

import { InvestitionPrognoseIstVergleich, InvestitionMonatsdatenDetail } from '@/lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Link from 'next/link'

interface EAutoAuswertungProps {
  investition: any
  prognoseVergleich: InvestitionPrognoseIstVergleich | null
  monatsdaten: InvestitionMonatsdatenDetail[]
}

export default function EAutoAuswertung({ 
  investition, 
  prognoseVergleich,
  monatsdaten 
}: EAutoAuswertungProps) {
  
  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // Monatsnamen
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  // Chart-Daten vorbereiten
  const chartData = monatsdaten
    .sort((a, b) => {
      if (a.jahr !== b.jahr) return a.jahr - b.jahr
      return a.monat - b.monat
    })
    .map(m => ({
      monat: `${monatsnamen[m.monat]} ${m.jahr}`,
      einsparung: m.einsparung_monat_euro || 0,
      km: m.verbrauch_daten.km_gefahren || 0,
      kwh: m.verbrauch_daten.strom_kwh || 0,
      verbrauch: m.verbrauch_daten.verbrauch_kwh_100km || 0
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            🚗 {investition.bezeichnung}
          </h2>
          <p className="text-sm text-gray-600">
            {investition.alternativ_beschreibung && `vs. ${investition.alternativ_beschreibung} • `}
            seit {new Date(investition.anschaffungsdatum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/eingabe?tab=e-auto"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
        >
          ➕ Monat erfassen
        </Link>
      </div>

      {/* Prognose vs. Ist */}
      {prognoseVergleich && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📊 Prognose vs. Ist ({prognoseVergleich.jahr || new Date().getFullYear()})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600">Prognose (Jahr)</div>
              <div className="text-2xl font-bold text-gray-900">
                {fmt(prognoseVergleich.prognose_jahr_euro)} €
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Ist ({prognoseVergleich.anzahl_monate} Monate)</div>
              <div className="text-2xl font-bold text-blue-700">
                {fmt(prognoseVergleich.einsparung_ist_jahr_euro)} €
              </div>
            </div>

            {prognoseVergleich.hochrechnung_jahr_euro && (
              <>
                <div>
                  <div className="text-sm text-gray-600">Hochrechnung</div>
                  <div className="text-2xl font-bold text-green-700">
                    {fmt(prognoseVergleich.hochrechnung_jahr_euro)} €
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600">Abweichung</div>
                  <div className={`text-2xl font-bold ${
                    (prognoseVergleich.abweichung_hochrechnung_prozent || 0) >= 0 
                      ? 'text-green-700' 
                      : 'text-red-700'
                  }`}>
                    {prognoseVergleich.abweichung_hochrechnung_prozent && 
                      (prognoseVergleich.abweichung_hochrechnung_prozent > 0 ? '+' : '')
                    }
                    {fmtDec(prognoseVergleich.abweichung_hochrechnung_prozent)}%
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bewertung */}
          <div className={`p-4 rounded-lg ${
            prognoseVergleich.bewertung === 'Besser als Prognose' ? 'bg-green-50 border border-green-200' :
            prognoseVergleich.bewertung === 'Schlechter als Prognose' ? 'bg-yellow-50 border border-yellow-200' :
            prognoseVergleich.bewertung === 'Im Rahmen der Prognose' ? 'bg-blue-50 border border-blue-200' :
            'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {prognoseVergleich.bewertung === 'Besser als Prognose' ? '✅' :
                 prognoseVergleich.bewertung === 'Schlechter als Prognose' ? '⚠️' :
                 prognoseVergleich.bewertung === 'Im Rahmen der Prognose' ? '👍' : 'ℹ️'}
              </span>
              <div>
                <div className="font-medium">{prognoseVergleich.bewertung}</div>
                {prognoseVergleich.bewertung === 'Besser als Prognose' && (
                  <div className="text-sm text-gray-600">
                    Du sparst mehr als prognostiziert - super! 🎉
                  </div>
                )}
                {prognoseVergleich.bewertung === 'Zu wenig Daten' && (
                  <div className="text-sm text-gray-600">
                    Erfasse mindestens 3 Monate für eine Hochrechnung
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {monatsdaten.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📈 Monatliche Entwicklung
          </h3>

          {/* Einsparung Chart */}
          <div className="mb-8">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Einsparung (€)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => `${value.toFixed(2)} €`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                />
                <Bar dataKey="einsparung" fill="#10b981" name="Einsparung" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Verbrauch Chart */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Verbrauch (kWh/100km)</h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => `${value.toFixed(1)} kWh/100km`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                />
                <Line type="monotone" dataKey="verbrauch" stroke="#3b82f6" name="Verbrauch" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monatsdaten Tabelle */}
      {monatsdaten.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              📋 Alle erfassten Monate ({monatsdaten.length})
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Monat
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    km
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    kWh
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    PV-Anteil
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Verbrauch
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Einsparung
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    CO₂
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monatsdaten
                  .sort((a, b) => {
                    if (a.jahr !== b.jahr) return b.jahr - a.jahr
                    return b.monat - a.monat
                  })
                  .map((m) => {
                    const pvAnteil = m.verbrauch_daten.strom_kwh > 0 
                      ? (m.verbrauch_daten.strom_pv_kwh / m.verbrauch_daten.strom_kwh) * 100 
                      : 0

                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {monatsnamen[m.monat]} {m.jahr}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {fmt(m.verbrauch_daten.km_gefahren)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {fmtDec(m.verbrauch_daten.strom_kwh)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {fmtDec(pvAnteil)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {fmtDec(m.verbrauch_daten.verbrauch_kwh_100km)} kWh/100km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                          {fmt(m.einsparung_monat_euro)} €
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {fmtDec((m.co2_einsparung_kg || 0) / 1000)} t
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <Link
                            href={`/eingabe?tab=e-auto&edit=${m.id}`}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            title="Bearbeiten"
                          >
                            ✏️
                          </Link>
                          {/* TODO: Löschen-Button */}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">
            Noch keine Monatsdaten erfasst.
          </p>
          <Link
            href="/eingabe?tab=e-auto"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
          >
            ➕ Ersten Monat erfassen
          </Link>
        </div>
      )}
    </div>
  )
}
