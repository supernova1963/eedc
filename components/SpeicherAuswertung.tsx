// components/SpeicherAuswertung.tsx
// VEREINFACHT: ohne Zyklen & SOC Spalten

'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Link from 'next/link'

interface SpeicherAuswertungProps {
  investition: any
  prognoseVergleich: any
  monatsdaten: any[]
}

export default function SpeicherAuswertung({ 
  investition, 
  prognoseVergleich, 
  monatsdaten 
}: SpeicherAuswertungProps) {

  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // Prognose-Werte
  const prognoseKapazitaet = investition.parameter?.kapazitaet_kwh || 0
  const prognoseWirkungsgrad = investition.parameter?.wirkungsgrad_prozent || 90
  const prognoseBetriebskostenJahr = investition.parameter?.betriebskosten_jahr_euro || 0
  
  // Ist-Werte
  const anzahlMonate = monatsdaten.length

  // Durchschnittswerte
  const avgWirkungsgrad = anzahlMonate > 0
    ? monatsdaten.reduce((sum, m) => sum + (m.verbrauch_daten?.wirkungsgrad_prozent || 0), 0) / anzahlMonate
    : 0

  const gesamtLadung = monatsdaten.reduce((sum, m) => sum + (m.verbrauch_daten?.batterieladung_kwh || 0), 0)
  const gesamtEntladung = monatsdaten.reduce((sum, m) => sum + (m.verbrauch_daten?.batterieentladung_kwh || 0), 0)
  const gesamtSelbstentladung = gesamtLadung - gesamtEntladung
  const gesamtUngeplant = monatsdaten.reduce((sum, m) => sum + (m.kosten_daten?.ungeplante_ausgaben_euro || 0), 0)

  // Chart-Daten
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  
  const wirkungsgradChartData = monatsdaten.map(m => ({
    monat: `${monatsnamen[m.monat]} ${m.jahr}`,
    wirkungsgrad_ist: m.verbrauch_daten?.wirkungsgrad_prozent || 0,
    wirkungsgrad_prognose: prognoseWirkungsgrad
  }))

  const durchsatzChartData = monatsdaten.map(m => ({
    monat: `${monatsnamen[m.monat]} ${m.jahr}`,
    ladung: m.verbrauch_daten?.batterieladung_kwh || 0,
    entladung: m.verbrauch_daten?.batterieentladung_kwh || 0
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            🔋 {investition.bezeichnung}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {prognoseKapazitaet} kWh Kapazität
          </p>
        </div>
        <Link
          href="/eingabe?tab=speicher"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
        >
          ➕ Monat erfassen
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Ø Wirkungsgrad</div>
          <div className="text-2xl font-bold text-green-700">{fmtDec(avgWirkungsgrad)}%</div>
          <div className="text-xs text-gray-500 mt-1">Prognose: {prognoseWirkungsgrad}%</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Gesamt-Entladung</div>
          <div className="text-2xl font-bold text-gray-900">{fmt(gesamtEntladung)} kWh</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Selbstentladung</div>
          <div className="text-2xl font-bold text-orange-600">{fmt(gesamtSelbstentladung)} kWh</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Ungeplante Ausgaben</div>
          <div className="text-2xl font-bold text-red-600">{fmtDec(gesamtUngeplant)} €</div>
          <div className="text-xs text-gray-500 mt-1">Prognose: {fmtDec(prognoseBetriebskostenJahr)}/Jahr</div>
        </div>
      </div>

      {/* Charts */}
      {monatsdaten.length > 0 && (
        <>
          {/* Wirkungsgrad-Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📈 Wirkungsgrad-Entwicklung
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={wirkungsgradChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="wirkungsgrad_ist" stroke="#10b981" strokeWidth={2} name="Ist %" />
                <Line type="monotone" dataKey="wirkungsgrad_prognose" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="Prognose %" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-sm text-gray-600 mt-2">
              Durchschnitt: {fmtDec(avgWirkungsgrad)}% | Prognose: {prognoseWirkungsgrad}%
            </p>
          </div>

          {/* Durchsatz-Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🔄 Ladung & Entladung
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={durchsatzChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="ladung" fill="#3b82f6" name="Ladung (kWh)" />
                <Bar dataKey="entladung" fill="#10b981" name="Entladung (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Monatsdaten-Tabelle */}
      {monatsdaten.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              📋 Alle Monatsdaten ({monatsdaten.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monat</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ladung</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entladung</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Wirkungsgrad</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ungeplant</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monatsdaten.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {monatsnamen[m.monat]} {m.jahr}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {fmt(m.verbrauch_daten?.batterieladung_kwh)} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {fmt(m.verbrauch_daten?.batterieentladung_kwh)} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                      {fmtDec(m.verbrauch_daten?.wirkungsgrad_prozent)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      {fmtDec(m.kosten_daten?.ungeplante_ausgaben_euro)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {monatsdaten.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">Noch keine Monatsdaten erfasst</p>
          <Link
            href="/eingabe?tab=speicher"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
          >
            ➕ Ersten Monat erfassen
          </Link>
        </div>
      )}
    </div>
  )
}
