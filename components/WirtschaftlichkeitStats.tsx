// components/WirtschaftlichkeitStats.tsx
// Mit parseFloat für String-Werte

'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface WirtschaftlichkeitStatsProps {
  monatsdaten: any[]
  anlage: any
}

export default function WirtschaftlichkeitStats({ monatsdaten, anlage }: WirtschaftlichkeitStatsProps) {
  
  if (!monatsdaten || monatsdaten.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Keine Daten vorhanden</p>
      </div>
    )
  }

  // String zu Number konvertieren
  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  // Format-Funktionen
  const fmt = (num: number): string => {
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num: number): string => {
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // Berechnungen
  const gesamtErzeugung = monatsdaten.reduce((sum, m) => 
    sum + toNum(m.pv_erzeugung_kwh), 0
  )
  
  const gesamtEigenverbrauch = monatsdaten.reduce((sum, m) => 
    sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0
  )
  
  const gesamtEinspeisung = monatsdaten.reduce((sum, m) => 
    sum + toNum(m.einspeisung_kwh), 0
  )
  
  const gesamtErloese = monatsdaten.reduce((sum, m) => 
    sum + toNum(m.einspeisung_ertrag_euro), 0
  )
  
  const gesamtNetzbezugKosten = monatsdaten.reduce((sum, m) => 
    sum + toNum(m.netzbezug_kosten_euro), 0
  )
  
  const eigenverbrauchsquote = gesamtErzeugung > 0 
    ? (gesamtEigenverbrauch / gesamtErzeugung) * 100 
    : 0
    
  const nettoErtrag = gesamtErloese - gesamtNetzbezugKosten

  // Chart-Daten
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const chartData = monatsdaten.map(m => ({
    monat: `${monatsnamen[m.monat] || m.monat} ${m.jahr}`,
    erzeugung: toNum(m.pv_erzeugung_kwh),
    eigenverbrauch: toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh),
    einspeisung: toNum(m.einspeisung_kwh)
  }))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Gesamt-Erzeugung</div>
          <div className="text-2xl font-bold text-gray-900">{fmt(gesamtErzeugung)} kWh</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Eigenverbrauch</div>
          <div className="text-2xl font-bold text-green-700">{fmtDec(eigenverbrauchsquote)}%</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Erlöse</div>
          <div className="text-2xl font-bold text-blue-700">{fmtDec(gesamtErloese)} €</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Netto-Ertrag</div>
          <div className="text-2xl font-bold text-green-700">{fmtDec(nettoErtrag)} €</div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📈 Monatliche Entwicklung
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monat" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="erzeugung" fill="#10b981" name="Erzeugung (kWh)" />
              <Bar dataKey="eigenverbrauch" fill="#3b82f6" name="Eigenverbrauch (kWh)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            📋 Monatsdaten ({monatsdaten.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monat</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Erzeugung</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Eigenverbrauch</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Einspeisung</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Erlöse</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monatsdaten
                .sort((a, b) => {
                  if (a.jahr !== b.jahr) return b.jahr - a.jahr
                  return b.monat - a.monat
                })
                .map((m, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {monatsnamen[m.monat] || m.monat} {m.jahr}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {fmt(toNum(m.pv_erzeugung_kwh))} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {fmt(toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh))} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {fmt(toNum(m.einspeisung_kwh))} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                      {fmtDec(toNum(m.einspeisung_ertrag_euro))} €
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
