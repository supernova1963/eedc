// components/CO2ImpactDashboard.tsx
// Enhanced CO₂ Impact Visualization with environmental equivalents

'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import SimpleIcon from './SimpleIcon'
import ExportButton from './ExportButton'

interface CO2ImpactDashboardProps {
  monatsdaten: any[]
  investitionen: any[]
}

interface YearlyCO2 {
  jahr: number
  co2Einsparung: number
  kumuliertCO2: number
  baeume: number
  autoKm: number
}

export default function CO2ImpactDashboard({ monatsdaten, investitionen }: CO2ImpactDashboardProps) {
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

  // CO₂-Berechnungen
  // Annahmen:
  // - 1 kWh Strom aus Kohlekraft ≈ 0.4 kg CO₂
  // - 1 Baum bindet ca. 10 kg CO₂ pro Jahr
  // - 1 Auto-km (Verbrenner) ≈ 0.15 kg CO₂
  const CO2_PER_KWH = 0.4 // kg
  const CO2_PER_BAUM_JAHR = 10 // kg
  const CO2_PER_AUTO_KM = 0.15 // kg

  // Gruppiere nach Jahr
  const yearlyData: Record<number, any[]> = {}
  monatsdaten.forEach(m => {
    if (!yearlyData[m.jahr]) {
      yearlyData[m.jahr] = []
    }
    yearlyData[m.jahr].push(m)
  })

  // Berechne jährliche CO₂-Einsparungen
  const yearlyCO2Stats: YearlyCO2[] = []
  let kumuliertCO2 = 0

  Object.keys(yearlyData)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(jahr => {
      const jahresMonatsdaten = yearlyData[parseInt(jahr)]

      // PV-Erzeugung die ins Netz eingespeist oder selbst verbraucht wurde
      const erzeugung = jahresMonatsdaten.reduce((sum, m) =>
        sum + toNum(m.pv_erzeugung_kwh), 0)

      // CO₂-Einsparung durch PV-Strom
      const co2Einsparung = erzeugung * CO2_PER_KWH

      kumuliertCO2 += co2Einsparung

      // Umrechnungen
      const baeume = co2Einsparung / CO2_PER_BAUM_JAHR
      const autoKm = co2Einsparung / CO2_PER_AUTO_KM

      yearlyCO2Stats.push({
        jahr: parseInt(jahr),
        co2Einsparung,
        kumuliertCO2,
        baeume,
        autoKm
      })
    })

  // Investitionen CO₂-Einsparungen
  const investitionenCO2 = investitionen.reduce((sum, inv) =>
    sum + toNum(inv.co2_einsparung_kg_jahr), 0)

  // Gesamtstatistiken
  const gesamtCO2 = kumuliertCO2 + (investitionenCO2 * yearlyCO2Stats.length)
  const gesamtBaeume = gesamtCO2 / CO2_PER_BAUM_JAHR
  const gesamtAutoKm = gesamtCO2 / CO2_PER_AUTO_KM
  const erdumrundungen = gesamtAutoKm / 40075 // Erdumfang in km

  // Aktuelles Jahr
  const aktuellesJahr = yearlyCO2Stats[yearlyCO2Stats.length - 1]
  const letzesJahr = yearlyCO2Stats[yearlyCO2Stats.length - 2]

  const yoyWachstum = letzesJahr && aktuellesJahr
    ? ((aktuellesJahr.co2Einsparung - letzesJahr.co2Einsparung) / letzesJahr.co2Einsparung) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
            <SimpleIcon type="globe" className="w-6 h-6 text-green-600" />
            CO₂-Impact & Umweltbilanz
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Dein Beitrag zum Klimaschutz seit {yearlyCO2Stats[0]?.jahr || 'Inbetriebnahme'}
          </p>
        </div>
        <ExportButton
          data={yearlyCO2Stats}
          filename={`CO2_Impact_${new Date().toISOString().split('T')[0]}`}
          headers={['Jahr', 'CO₂-Einsparung (kg)', 'CO₂-Einsparung (t)', 'Bäume-Äquivalent', 'Auto-km-Äquivalent', 'Kumuliert (kg)']}
          mapDataToRow={(year) => [
            year.jahr,
            year.co2Einsparung.toFixed(2),
            (year.co2Einsparung / 1000).toFixed(2),
            year.baeume.toFixed(0),
            year.autoKm.toFixed(0),
            year.kumuliertCO2.toFixed(2)
          ]}
        />
      </div>

      {/* Haupt-KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-green-700 font-medium">Gesamt CO₂-Einsparung</div>
            <SimpleIcon type="globe" className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-700">{fmtDec(gesamtCO2 / 1000)} t</div>
          <div className="text-xs text-green-600 mt-1">
            {fmt(gesamtCO2)} kg seit Start
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-lg shadow p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-blue-700 font-medium">≈ Bäume</div>
            <SimpleIcon type="tree" className="w-8 h-8 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-blue-700">{fmt(gesamtBaeume)}</div>
          <div className="text-xs text-blue-600 mt-1">
            CO₂-Bindung pro Jahr
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-lg shadow p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-purple-700 font-medium">≈ Autofahrten</div>
            <SimpleIcon type="car" className="w-6 h-6 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-700">{fmt(gesamtAutoKm)} km</div>
          <div className="text-xs text-purple-600 mt-1">
            Verbrenner-Fahrzeug vermieden
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-lg shadow p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-orange-700 font-medium">Ø Einsparung/Jahr</div>
            <SimpleIcon type="chart" className="w-6 h-6 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-orange-700">
            {yearlyCO2Stats.length > 0
              ? fmtDec(gesamtCO2 / yearlyCO2Stats.length / 1000)
              : '0'} t
          </div>
          <div className="text-xs text-orange-600 mt-1">
            {yoyWachstum !== 0 && letzesJahr ? (
              <span className={yoyWachstum > 0 ? 'text-green-600' : 'text-red-600'}>
                {yoyWachstum > 0 ? '+' : '-'} {Math.abs(yoyWachstum).toFixed(1)}% YoY
              </span>
            ) : (
              'Durchschnitt'
            )}
          </div>
        </div>
      </div>

      {/* Fun Facts */}
      <div className="bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 border-2 border-green-300 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <SimpleIcon type="rocket" className="w-5 h-5 text-green-600" />
          Das entspricht...
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <SimpleIcon type="tree" className="w-16 h-16 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-700">{fmt(gesamtBaeume)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Bäume die ein Jahr lang CO₂ binden
            </div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <SimpleIcon type="car" className="w-16 h-16 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-700">{fmtDec(erdumrundungen)}x</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Erdumrundungen mit dem Auto
              <br />
              <span className="text-xs text-gray-500">({fmt(gesamtAutoKm)} km)</span>
            </div>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <SimpleIcon type="lightning" className="w-16 h-16 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-700">
              {fmt(gesamtCO2 / CO2_PER_KWH)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              kWh saubere Energie erzeugt
            </div>
          </div>
        </div>
      </div>

      {/* Cumulative CO₂ Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <SimpleIcon type="trend" className="w-5 h-5 text-gray-600" />
          Kumulierte CO₂-Einsparung
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={yearlyCO2Stats}>
            <defs>
              <linearGradient id="colorCO2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="jahr" />
            <YAxis
              tickFormatter={(value) => `${(value / 1000).toFixed(1)} t`}
            />
            <Tooltip
              formatter={(value: any) => `${fmtDec(value / 1000)} Tonnen`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="kumuliertCO2"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorCO2)"
              name="Kumulierte CO₂-Einsparung (kg)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Yearly CO₂ Savings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <SimpleIcon type="chart" className="w-5 h-5 text-gray-600" />
          Jährliche CO₂-Einsparung
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={yearlyCO2Stats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="jahr" />
            <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(1)} t`} />
            <Tooltip
              formatter={(value: any) => `${fmtDec(value / 1000)} Tonnen`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
            />
            <Legend />
            <Bar dataKey="co2Einsparung" fill="#10b981" name="CO₂-Einsparung (kg)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Yearly Details Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600" />
            Jahresübersicht CO₂-Impact
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jahr</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">CO₂-Einsparung</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">≈ Bäume</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">≈ Auto-km</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kumuliert</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
              {yearlyCO2Stats.map((year) => (
                <tr key={year.jahr} className="hover:bg-gray-50 dark:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {year.jahr}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-600">
                    {fmtDec(year.co2Einsparung / 1000)} t
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {fmt(year.baeume)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {fmt(year.autoKm)} km
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-700">
                    {fmtDec(year.kumuliertCO2 / 1000)} t
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Investments CO₂ */}
      {investitionen.length > 0 && investitionenCO2 > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <SimpleIcon type="briefcase" className="w-5 h-5 text-blue-700" />
            Zusätzliche CO₂-Einsparungen durch Investitionen
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Jährlich zusätzlich</div>
              <div className="text-xl font-bold text-blue-700">
                {fmtDec(investitionenCO2 / 1000)} t CO₂
              </div>
              <div className="text-xs text-gray-500 mt-1">
                durch {investitionen.length} Investition{investitionen.length !== 1 ? 'en' : ''}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">≈ Bäume äquivalent</div>
              <div className="text-xl font-bold text-green-700">
                {fmt(investitionenCO2 / CO2_PER_BAUM_JAHR)}
              </div>
              <div className="text-xs text-gray-500 mt-1">pro Jahr</div>
            </div>
            <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Gesamt über {yearlyCO2Stats.length} Jahre</div>
              <div className="text-xl font-bold text-purple-700">
                {fmtDec((investitionenCO2 * yearlyCO2Stats.length) / 1000)} t
              </div>
              <div className="text-xs text-gray-500 mt-1">kombinierte Einsparung</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
