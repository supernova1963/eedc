// components/ROIDashboard.tsx
// Enhanced ROI Dashboard with yearly trends and cumulative analysis

'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import SimpleIcon from './SimpleIcon'
import ExportButton from './ExportButton'

interface ROIDashboardProps {
  anlage: any
  monatsdaten: any[]
  investitionen: any[]
}

interface YearlyStats {
  jahr: number
  erzeugung: number
  eigenverbrauch: number
  einspeisung: number
  erloese: number
  kosten: number
  nettoErtrag: number
  kumuliertErtrag: number
  kumuliertVsInvestition: number
  paybackProgress: number
}

export default function ROIDashboard({ anlage, monatsdaten, investitionen }: ROIDashboardProps) {
  const fmt = (num: number): string => {
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num: number): string => {
    return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  // Gesamtinvestition berechnen
  const gesamtInvestition = anlage?.anschaffungskosten_gesamt || 0

  // Gruppiere Monatsdaten nach Jahr
  const yearlyData: Record<number, any[]> = {}
  monatsdaten.forEach(m => {
    if (!yearlyData[m.jahr]) {
      yearlyData[m.jahr] = []
    }
    yearlyData[m.jahr].push(m)
  })

  // Berechne Jahresstatistiken
  const yearlyStats: YearlyStats[] = []
  let kumuliertErtrag = 0

  Object.keys(yearlyData)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(jahr => {
      const jahresMonatsdaten = yearlyData[parseInt(jahr)]

      const erzeugung = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.pv_erzeugung_kwh), 0)
      const eigenverbrauch = jahresMonatsdaten.reduce((sum, m) =>
        sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0)
      const einspeisung = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_kwh), 0)
      const erloese = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_ertrag_euro), 0)
      const kosten = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.netzbezug_kosten_euro), 0)
      const betriebsausgaben = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.betriebsausgaben_monat_euro), 0)

      const nettoErtrag = erloese - kosten - betriebsausgaben
      kumuliertErtrag += nettoErtrag

      const paybackProgress = gesamtInvestition > 0
        ? (kumuliertErtrag / gesamtInvestition) * 100
        : 0

      yearlyStats.push({
        jahr: parseInt(jahr),
        erzeugung,
        eigenverbrauch,
        einspeisung,
        erloese,
        kosten: kosten + betriebsausgaben,
        nettoErtrag,
        kumuliertErtrag,
        kumuliertVsInvestition: kumuliertErtrag - gesamtInvestition,
        paybackProgress: Math.min(paybackProgress, 100)
      })
    })

  // Aktuelle Statistiken
  const aktuellesJahr = yearlyStats[yearlyStats.length - 1]
  const letzesJahr = yearlyStats[yearlyStats.length - 2]

  const gesamtErtrag = kumuliertErtrag
  const verbleibendeInvestition = Math.max(0, gesamtInvestition - gesamtErtrag)
  const istAmortisiert = gesamtErtrag >= gesamtInvestition

  // Hochrechnung bis Amortisation
  const durchschnittErtragProJahr = yearlyStats.length > 0
    ? yearlyStats.reduce((sum, y) => sum + y.nettoErtrag, 0) / yearlyStats.length
    : 0

  const verbleibendeJahre = durchschnittErtragProJahr > 0
    ? verbleibendeInvestition / durchschnittErtragProJahr
    : 0

  // Year-over-Year Vergleich
  const yoyWachstum = letzesJahr && aktuellesJahr
    ? ((aktuellesJahr.nettoErtrag - letzesJahr.nettoErtrag) / letzesJahr.nettoErtrag) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
            <SimpleIcon type="trend" className="w-6 h-6 text-blue-600" />
            ROI-Analyse & Wirtschaftlichkeit
          </h2>
          <p className="text-sm text-gray-600">
            Detaillierte Analyse der Investitionsrendite seit {yearlyStats[0]?.jahr || 'Inbetriebnahme'}
          </p>
        </div>
        <ExportButton
          data={yearlyStats}
          filename={`ROI_Analyse_${new Date().toISOString().split('T')[0]}`}
          headers={['Jahr', 'Erzeugung (kWh)', 'Erlöse (€)', 'Kosten (€)', 'Netto-Ertrag (€)', 'Kumuliert (€)', 'Fortschritt (%)']}
          mapDataToRow={(year) => [
            year.jahr,
            year.erzeugung.toFixed(2),
            year.erloese.toFixed(2),
            year.kosten.toFixed(2),
            year.nettoErtrag.toFixed(2),
            year.kumuliertErtrag.toFixed(2),
            year.paybackProgress.toFixed(2)
          ]}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Gesamtertrag</div>
          <div className="text-2xl font-bold text-green-700">{fmtDec(gesamtErtrag)} €</div>
          <div className="text-xs text-gray-500 mt-1">
            seit {yearlyStats.length} Jahr{yearlyStats.length !== 1 ? 'en' : ''}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Amortisation</div>
          <div className={`text-2xl font-bold ${istAmortisiert ? 'text-green-700' : 'text-blue-700'}`}>
            {istAmortisiert ? '✓ Erreicht' : `${fmtDec(verbleibendeJahre)} J.`}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {istAmortisiert ? `+${fmtDec(gesamtErtrag - gesamtInvestition)} € Gewinn` : 'bis Payback'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Ø Ertrag/Jahr</div>
          <div className="text-2xl font-bold text-blue-700">{fmt(durchschnittErtragProJahr)} €</div>
          <div className="text-xs text-gray-500 mt-1">
            {yoyWachstum !== 0 && letzesJahr ? (
              <span className={yoyWachstum > 0 ? 'text-green-600' : 'text-red-600'}>
                {yoyWachstum > 0 ? '+' : ''}{fmtDec(yoyWachstum)}% YoY
              </span>
            ) : (
              'Durchschnitt'
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">ROI aktuell</div>
          <div className="text-2xl font-bold text-purple-700">
            {fmtDec((gesamtErtrag / gesamtInvestition) * 100)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            von {fmt(gesamtInvestition)} €
          </div>
        </div>
      </div>

      {/* Payback Progress Bar */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Amortisations-Fortschritt</h3>
          <span className="text-sm font-medium text-gray-600">
            {fmtDec(Math.min((gesamtErtrag / gesamtInvestition) * 100, 100))}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              istAmortisiert ? 'bg-green-500' : 'bg-blue-500'
            } flex items-center justify-end pr-2`}
            style={{ width: `${Math.min((gesamtErtrag / gesamtInvestition) * 100, 100)}%` }}
          >
            {(gesamtErtrag / gesamtInvestition) * 100 > 10 && (
              <span className="text-xs font-bold text-white">
                {fmtDec(gesamtErtrag)} € / {fmt(gesamtInvestition)} €
              </span>
            )}
          </div>
        </div>
        {istAmortisiert && (
          <div className="mt-3 flex items-center gap-2 text-green-700">
            <SimpleIcon type="check" className="w-5 h-5" />
            <span className="font-medium">
              Investition amortisiert! {fmtDec(gesamtErtrag - gesamtInvestition)} € Gewinn
            </span>
          </div>
        )}
      </div>

      {/* Cumulative Savings Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="chart" className="w-5 h-5 text-gray-600" />
          Kumulierte Erträge vs. Investition
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={yearlyStats}>
            <defs>
              <linearGradient id="colorErtrag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="jahr" />
            <YAxis
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k €`}
            />
            <Tooltip
              formatter={(value: any) => `${fmtDec(value)} €`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="kumuliertErtrag"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorErtrag)"
              name="Kumulierter Ertrag"
            />
            <Line
              type="monotone"
              dataKey={() => gesamtInvestition}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Investition"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Yearly Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="trend" className="w-5 h-5 text-gray-600" />
          Jahresvergleich: Erträge & Kosten
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={yearlyStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="jahr" />
            <YAxis tickFormatter={(value) => `${value.toFixed(0)} €`} />
            <Tooltip
              formatter={(value: any) => `${fmtDec(value)} €`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
            />
            <Legend />
            <Bar dataKey="erloese" fill="#10b981" name="Erlöse" />
            <Bar dataKey="kosten" fill="#ef4444" name="Kosten" />
            <Bar dataKey="nettoErtrag" fill="#3b82f6" name="Netto-Ertrag" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Yearly Stats Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600" />
            Jahresübersicht
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jahr</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Erzeugung</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Erlöse</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kosten</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Netto</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kumuliert</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fortschritt</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {yearlyStats.map((year) => (
                <tr key={year.jahr} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {year.jahr}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {fmt(year.erzeugung)} kWh
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                    {fmtDec(year.erloese)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                    {fmtDec(year.kosten)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700 font-bold">
                    {fmtDec(year.nettoErtrag)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                    {fmtDec(year.kumuliertErtrag)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      year.paybackProgress >= 100
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {fmtDec(year.paybackProgress)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investment Breakdown */}
      {investitionen.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="gem" className="w-5 h-5 text-blue-600" />
            Investitionsübersicht
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600">PV-Anlage</div>
              <div className="text-xl font-bold text-gray-900">{fmt(gesamtInvestition)} €</div>
              <div className="text-xs text-gray-500 mt-1">Hauptinvestition</div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600">Zusatzinvestitionen</div>
              <div className="text-xl font-bold text-gray-900">
                {fmt(investitionen.reduce((sum, inv) => sum + (inv.anschaffungskosten_relevant || 0), 0))} €
              </div>
              <div className="text-xs text-gray-500 mt-1">{investitionen.length} Positionen</div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600">Gesamtinvestition</div>
              <div className="text-xl font-bold text-blue-700">
                {fmt(
                  gesamtInvestition +
                  investitionen.reduce((sum, inv) => sum + (inv.anschaffungskosten_relevant || 0), 0)
                )} €
              </div>
              <div className="text-xs text-gray-500 mt-1">Inklusive Zusätze</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
