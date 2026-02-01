// components/WaermepumpeAuswertung.tsx
'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import SimpleIcon from './SimpleIcon'

interface WaermepumpeAuswertungProps {
  investition: any
  prognoseVergleich: any
  monatsdaten: any[]
}

export default function WaermepumpeAuswertung({ 
  investition, 
  prognoseVergleich, 
  monatsdaten 
}: WaermepumpeAuswertungProps) {

  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // Prognose-Werte
  const prognoseJahr = prognoseVergleich?.prognose_jahr_euro || 0
  const prognoseJAZ = investition.parameter?.jaz || 0

  // Ist-Werte (kompatibel mit beiden View-Versionen)
  const anzahlMonate = prognoseVergleich?.anzahl_monate_erfasst || prognoseVergleich?.anzahl_monate || 0
  const einsparungIst = prognoseVergleich?.ist_gesamt_euro || prognoseVergleich?.einsparung_ist_jahr_euro || 0
  const hochrechnungJahr = prognoseVergleich?.ist_hochrechnung_jahr_euro || prognoseVergleich?.hochrechnung_jahr_euro || 0
  const abweichung = prognoseVergleich?.abweichung_prozent || prognoseVergleich?.abweichung_hochrechnung_prozent || 0

  // Bewertung berechnen
  let bewertung = 'Keine Daten'
  if (anzahlMonate >= 3) {
    if (abweichung > 10) bewertung = 'Besser als Prognose'
    else if (abweichung >= -10) bewertung = 'Im Rahmen der Prognose'
    else bewertung = 'Schlechter als Prognose'
  }

  // Bewertungs-Farbe
  const getBewertungColor = () => {
    if (bewertung === 'Besser als Prognose') return 'text-green-700 bg-green-100'
    if (bewertung === 'Im Rahmen der Prognose') return 'text-blue-700 bg-blue-100'
    return 'text-orange-700 bg-orange-100'
  }

  // Chart-Daten
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  
  const kostenChartData = monatsdaten.map(m => ({
    monat: `${monatsnamen[m.monat]} ${m.jahr}`,
    kosten: m.kosten_daten?.kosten_gesamt_euro || 0,
    prognose: prognoseJahr / 12
  }))

  const jazChartData = monatsdaten.map(m => ({
    monat: `${monatsnamen[m.monat]} ${m.jahr}`,
    jaz_ist: m.verbrauch_daten?.jaz || 0,
    jaz_prognose: prognoseJAZ
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SimpleIcon type="heat" className="w-6 h-6 text-orange-500" />
            {investition.bezeichnung}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {investition.parameter?.leistung_kw || '-'} kW Heizleistung
          </p>
        </div>
        <Link
          href="/eingabe?tab=waermepumpe"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white flex items-center gap-2"
        >
          <SimpleIcon type="plus" className="w-4 h-4" />
          Monat erfassen
        </Link>
      </div>

      {/* Prognose vs. Ist */}
      {anzahlMonate >= 3 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="chart" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Prognose vs. Ist-Verbrauch
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Erfasste Monate</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{anzahlMonate}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Kosten (Prognose/Jahr)</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{fmt(prognoseJahr)} €</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Hochrechnung (Jahr)</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(hochrechnungJahr)} €</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Abweichung</div>
              <div className={`text-2xl font-bold ${abweichung > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {abweichung > 0 ? '+' : ''}{fmtDec(abweichung)}%
              </div>
            </div>
          </div>
          
          <div className={`mt-4 px-4 py-3 rounded-md ${getBewertungColor()}`}>
            <div className="font-medium">{bewertung}</div>
            <div className="text-sm mt-1">
              Basierend auf {anzahlMonate} Monaten: {fmt(einsparungIst)} € → Hochrechnung: {fmt(hochrechnungJahr)} € pro Jahr
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <SimpleIcon type="info" className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300">Noch nicht genug Daten</h3>
              <p className="text-sm text-blue-700 mt-1">
                Erfasse mindestens 3 Monate, um einen Prognose-Vergleich zu sehen.
                Aktuell: {anzahlMonate} {anzahlMonate === 1 ? 'Monat' : 'Monate'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {monatsdaten.length > 0 && (
        <>
          {/* Kosten-Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="money" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              Monatliche Kosten
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={kostenChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="kosten" fill="#3b82f6" name="Ist-Kosten (€)" />
                <Bar dataKey="prognose" fill="#cbd5e1" name="Prognose (€)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* JAZ-Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="trend" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              JAZ-Entwicklung (Jahresarbeitszahl)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={jazChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis domain={[0, 6]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="jaz_ist" stroke="#10b981" strokeWidth={2} name="JAZ Ist" />
                <Line type="monotone" dataKey="jaz_prognose" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="JAZ Prognose" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-sm text-gray-600 mt-2">
              Höhere JAZ = bessere Effizienz. Prognose: {fmtDec(prognoseJAZ)}
            </p>
          </div>
        </>
      )}

      {/* Monatsdaten-Tabelle */}
      {monatsdaten.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              Alle Monatsdaten ({monatsdaten.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monat</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Strom</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Wärme</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">JAZ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">PV-Anteil</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kosten</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                {monatsdaten.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {monatsnamen[m.monat]} {m.jahr}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {fmt(m.verbrauch_daten?.strom_kwh)} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {fmt(m.verbrauch_daten?.waerme_kwh)} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                      {fmtDec(m.verbrauch_daten?.jaz)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {fmt(m.verbrauch_daten?.pv_anteil_prozent)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                      {fmtDec(m.kosten_daten?.kosten_gesamt_euro)} €
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
            href="/eingabe?tab=waermepumpe"
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
