// components/WallboxAuswertung.tsx
// Wallbox Auswertung - Ladestatistiken und PV-Anteil

'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Link from 'next/link'
import SimpleIcon from './SimpleIcon'

interface WallboxAuswertungProps {
  investition: any
  prognoseVergleich: any
  monatsdaten: any[]
}

export default function WallboxAuswertung({
  investition,
  prognoseVergleich,
  monatsdaten
}: WallboxAuswertungProps) {

  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // Statistiken berechnen
  const stats = useMemo(() => {
    if (monatsdaten.length === 0) return null

    const totalLadung = monatsdaten.reduce((sum, m) =>
      sum + (m.verbrauch_daten?.ladung_kwh || 0), 0)
    const totalPvLadung = monatsdaten.reduce((sum, m) =>
      sum + (m.verbrauch_daten?.pv_ladung_kwh || 0), 0)
    const totalNetzLadung = monatsdaten.reduce((sum, m) =>
      sum + (m.verbrauch_daten?.netz_ladung_kwh || 0), 0)
    const totalLadevorgaenge = monatsdaten.reduce((sum, m) =>
      sum + (m.verbrauch_daten?.anzahl_ladevorgaenge || 0), 0)

    const pvAnteil = totalLadung > 0 ? (totalPvLadung / totalLadung) * 100 : 0
    const avgLadungProVorgang = totalLadevorgaenge > 0 ? totalLadung / totalLadevorgaenge : 0

    return {
      totalLadung,
      totalPvLadung,
      totalNetzLadung,
      totalLadevorgaenge,
      pvAnteil,
      avgLadungProVorgang
    }
  }, [monatsdaten])

  // Chart-Daten
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  const ladungChartData = monatsdaten.map(m => ({
    monat: `${monatsnamen[m.monat]} ${m.jahr}`,
    pvLadung: m.verbrauch_daten?.pv_ladung_kwh || 0,
    netzLadung: m.verbrauch_daten?.netz_ladung_kwh || 0,
    gesamt: (m.verbrauch_daten?.pv_ladung_kwh || 0) + (m.verbrauch_daten?.netz_ladung_kwh || 0)
  }))

  // Pie Chart Daten
  const pieData = stats ? [
    { name: 'PV-Strom', value: stats.totalPvLadung, color: '#22c55e' },
    { name: 'Netzstrom', value: stats.totalNetzLadung, color: '#64748b' }
  ] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SimpleIcon type="plug" className="w-6 h-6 text-purple-600" />
            {investition.bezeichnung}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {investition.parameter?.leistung_kw || '-'} kW Ladeleistung
          </p>
        </div>
        <Link
          href="/eingabe?tab=wallbox"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white flex items-center gap-2"
        >
          <SimpleIcon type="plus" className="w-4 h-4" />
          Monat erfassen
        </Link>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Gesamt geladen</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(stats.totalLadung)} kWh</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">PV-Anteil</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmtDec(stats.pvAnteil)}%</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Ladevorgänge</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(stats.totalLadevorgaenge)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">Ø pro Ladevorgang</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmtDec(stats.avgLadungProVorgang)} kWh</div>
          </div>
        </div>
      )}

      {/* Charts */}
      {monatsdaten.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ladung Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <SimpleIcon type="lightning" className="w-5 h-5 text-purple-600" />
              Monatliche Ladung
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ladungChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="pvLadung" stackId="a" fill="#22c55e" name="PV-Strom (kWh)" />
                <Bar dataKey="netzLadung" stackId="a" fill="#64748b" name="Netzstrom (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <SimpleIcon type="chart" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              Stromquelle
            </h3>
            {stats && (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(0)} kWh`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Monatsdaten-Tabelle */}
      {monatsdaten.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              Alle Monatsdaten ({monatsdaten.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monat</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gesamt</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">PV-Strom</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Netzstrom</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">PV-Anteil</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ladevorgänge</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {monatsdaten
                  .sort((a, b) => {
                    if (a.jahr !== b.jahr) return b.jahr - a.jahr
                    return b.monat - a.monat
                  })
                  .map((m) => {
                    const pvLadung = m.verbrauch_daten?.pv_ladung_kwh || 0
                    const netzLadung = m.verbrauch_daten?.netz_ladung_kwh || 0
                    const gesamt = pvLadung + netzLadung
                    const pvAnteil = gesamt > 0 ? (pvLadung / gesamt) * 100 : 0

                    return (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {monatsnamen[m.monat]} {m.jahr}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                          {fmt(gesamt)} kWh
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 dark:text-green-400">
                          {fmt(pvLadung)} kWh
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-400">
                          {fmt(netzLadung)} kWh
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            pvAnteil >= 70
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : pvAnteil >= 50
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {fmtDec(pvAnteil)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                          {fmt(m.verbrauch_daten?.anzahl_ladevorgaenge)}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {monatsdaten.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Noch keine Monatsdaten erfasst</p>
          <Link
            href="/eingabe?tab=wallbox"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
          >
            <SimpleIcon type="plus" className="w-4 h-4" />
            Ersten Monat erfassen
          </Link>
        </div>
      )}
    </div>
  )
}
