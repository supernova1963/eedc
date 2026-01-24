// components/PrognoseVsIstDashboard.tsx
// Prognose vs. IST Vergleich für PV-Erzeugung

'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import SimpleIcon from './SimpleIcon'
import ExportButton from './ExportButton'

interface PrognoseVsIstDashboardProps {
  monatsdaten: any[]
  anlage: any
}

interface MonatsPrognose {
  jahr: number
  monat: number
  monatName: string
  istErzeugung: number
  prognoseErzeugung: number
  abweichungKwh: number
  abweichungProzent: number
  genauigkeit: number
}

export default function PrognoseVsIstDashboard({ monatsdaten, anlage }: PrognoseVsIstDashboardProps) {

  if (!monatsdaten || monatsdaten.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <SimpleIcon type="info" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Keine Daten für Prognose-Vergleich vorhanden</p>
      </div>
    )
  }

  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  const fmt = (num: number): string => {
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num: number): string => {
    return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Prognose-Berechnung basierend auf:
  // 1. Durchschnitt gleicher Monat in Vorjahren
  // 2. Jahreszeitliche Faktoren
  // 3. Anlagenleistung
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  // Typische Erzeugungsfaktoren pro Monat (0-1, normalisiert auf Jahresdurchschnitt)
  const monatsfaktoren: { [key: number]: number } = {
    1: 0.4,   // Januar - niedrig
    2: 0.6,   // Februar
    3: 0.9,   // März
    4: 1.2,   // April
    5: 1.4,   // Mai
    6: 1.5,   // Juni - peak
    7: 1.5,   // Juli - peak
    8: 1.3,   // August
    9: 1.0,   // September
    10: 0.7,  // Oktober
    11: 0.5,  // November
    12: 0.3   // Dezember - niedrig
  }

  // Berechne durchschnittliche Jahreserzeugung pro kWp
  const gesamtErzeugung = monatsdaten.reduce((sum, m) => sum + toNum(m.pv_erzeugung_kwh), 0)
  const anzahlMonate = monatsdaten.length
  const durchschnittProMonat = anzahlMonate > 0 ? gesamtErzeugung / anzahlMonate : 0
  const jahresdurchschnittProKwp = anlage?.leistung_kwp > 0
    ? (durchschnittProMonat * 12) / toNum(anlage.leistung_kwp)
    : 850 // Fallback: 850 kWh/kWp/Jahr (Deutschland-Durchschnitt)

  // Gruppiere Daten nach Monat über alle Jahre
  const monatsdatenByMonat: { [key: number]: number[] } = {}
  monatsdaten.forEach(m => {
    if (!monatsdatenByMonat[m.monat]) {
      monatsdatenByMonat[m.monat] = []
    }
    monatsdatenByMonat[m.monat].push(toNum(m.pv_erzeugung_kwh))
  })

  // Berechne Prognose für jeden Monat
  const prognoseData: MonatsPrognose[] = monatsdaten.map(m => {
    const istErzeugung = toNum(m.pv_erzeugung_kwh)

    // Methode 1: Durchschnitt gleicher Monat in Vorjahren
    const gleicheMonateDaten = monatsdatenByMonat[m.monat] || []
    const durchschnittGleicherMonat = gleicheMonateDaten.length > 1
      ? gleicheMonateDaten.reduce((sum, val) => sum + val, 0) / gleicheMonateDaten.length
      : 0

    // Methode 2: Basierend auf Anlagenleistung und Monatsfaktor
    const monatsfaktor = monatsfaktoren[m.monat] || 1
    const prognoseBasedOnLeistung = (jahresdurchschnittProKwp / 12) * monatsfaktor * toNum(anlage?.leistung_kwp || 1)

    // Kombiniere beide Methoden (gewichtet)
    let prognoseErzeugung = 0
    if (durchschnittGleicherMonat > 0 && gleicheMonateDaten.length > 1) {
      // Wenn historische Daten vorhanden: 70% Historie, 30% Leistungsberechnung
      prognoseErzeugung = durchschnittGleicherMonat * 0.7 + prognoseBasedOnLeistung * 0.3
    } else {
      // Sonst nur Leistungsberechnung
      prognoseErzeugung = prognoseBasedOnLeistung
    }

    const abweichungKwh = istErzeugung - prognoseErzeugung
    const abweichungProzent = prognoseErzeugung > 0
      ? (abweichungKwh / prognoseErzeugung) * 100
      : 0
    const genauigkeit = prognoseErzeugung > 0
      ? 100 - Math.abs(abweichungProzent)
      : 0

    return {
      jahr: m.jahr,
      monat: m.monat,
      monatName: `${monatsnamen[m.monat]} ${m.jahr}`,
      istErzeugung,
      prognoseErzeugung,
      abweichungKwh,
      abweichungProzent,
      genauigkeit
    }
  })

  // Sortiere chronologisch
  prognoseData.sort((a, b) => {
    if (a.jahr !== b.jahr) return a.jahr - b.jahr
    return a.monat - b.monat
  })

  // Berechne KPIs
  const gesamtIst = prognoseData.reduce((sum, m) => sum + m.istErzeugung, 0)
  const gesamtPrognose = prognoseData.reduce((sum, m) => sum + m.prognoseErzeugung, 0)
  const gesamtAbweichung = gesamtIst - gesamtPrognose
  const gesamtAbweichungProzent = gesamtPrognose > 0
    ? (gesamtAbweichung / gesamtPrognose) * 100
    : 0
  const durchschnittGenauigkeit = prognoseData.length > 0
    ? prognoseData.reduce((sum, m) => sum + m.genauigkeit, 0) / prognoseData.length
    : 0

  // Finde Monate mit größten Abweichungen
  const maxUebererfuellung = prognoseData.reduce((max, m) =>
    m.abweichungKwh > max.abweichungKwh ? m : max
  , prognoseData[0] || { abweichungKwh: 0, monatName: '' })

  const maxUntererfuellung = prognoseData.reduce((min, m) =>
    m.abweichungKwh < min.abweichungKwh ? m : min
  , prognoseData[0] || { abweichungKwh: 0, monatName: '' })

  // Chart-Daten
  const chartData = prognoseData.map(m => ({
    monat: m.monatName,
    'IST': m.istErzeugung,
    'Prognose': m.prognoseErzeugung,
    'Abweichung': m.abweichungKwh
  }))

  // Genauigkeits-Trend
  const genauigkeitTrend = prognoseData.map(m => ({
    monat: m.monatName,
    'Genauigkeit (%)': m.genauigkeit,
    'Abweichung (%)': Math.abs(m.abweichungProzent)
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
            <SimpleIcon type="target" className="w-6 h-6 text-blue-600" />
            Prognose vs. IST-Vergleich
          </h2>
          <p className="text-sm text-gray-600">
            Vergleich prognostizierte und tatsächliche PV-Erzeugung
          </p>
        </div>
        <ExportButton
          data={prognoseData}
          filename={`Prognose_vs_IST_${new Date().toISOString().split('T')[0]}`}
          headers={['Jahr', 'Monat', 'IST-Erzeugung (kWh)', 'Prognose (kWh)', 'Abweichung (kWh)', 'Abweichung (%)', 'Genauigkeit (%)']}
          mapDataToRow={(m) => [
            m.jahr,
            m.monat,
            m.istErzeugung.toFixed(2),
            m.prognoseErzeugung.toFixed(2),
            m.abweichungKwh.toFixed(2),
            m.abweichungProzent.toFixed(2),
            m.genauigkeit.toFixed(2)
          ]}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600 font-medium">Gesamt-Abweichung</div>
            <SimpleIcon
              type={gesamtAbweichung >= 0 ? 'trend-up' : 'trend-down'}
              className={`w-6 h-6 ${gesamtAbweichung >= 0 ? 'text-green-600' : 'text-red-600'}`}
            />
          </div>
          <div className={`text-3xl font-bold ${gesamtAbweichung >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {gesamtAbweichung >= 0 ? '+' : ''}{fmtDec(gesamtAbweichungProzent)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {gesamtAbweichung >= 0 ? '+' : ''}{fmt(gesamtAbweichung)} kWh
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-lg shadow p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-blue-700 font-medium">Prognose-Genauigkeit</div>
            <SimpleIcon type="check" className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-700">
            {fmtDec(durchschnittGenauigkeit)}%
          </div>
          <div className="text-xs text-blue-600 mt-1">
            Durchschnitt über alle Monate
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-green-700 font-medium">Beste Übererfüllung</div>
            <SimpleIcon type="trophy" className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-700">
            +{fmt(maxUebererfuellung?.abweichungKwh || 0)}
          </div>
          <div className="text-xs text-green-600 mt-1">
            {maxUebererfuellung?.monatName || '-'} kWh
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-lg shadow p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-orange-700 font-medium">Größte Untererfüllung</div>
            <SimpleIcon type="alert" className="w-6 h-6 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-orange-700">
            {fmt(maxUntererfuellung?.abweichungKwh || 0)}
          </div>
          <div className="text-xs text-orange-600 mt-1">
            {maxUntererfuellung?.monatName || '-'} kWh
          </div>
        </div>
      </div>

      {/* Haupt-Chart: IST vs. Prognose */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="chart" className="w-5 h-5 text-blue-600" />
          IST vs. Prognose - Monatliche Erzeugung
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="monat"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: any) => fmt(value) + ' kWh'}
            />
            <Legend />
            <Bar dataKey="Prognose" fill="#3b82f6" opacity={0.6} name="Prognose" />
            <Line
              type="monotone"
              dataKey="IST"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4 }}
              name="IST-Erzeugung"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Abweichungs-Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="trend" className="w-5 h-5 text-purple-600" />
          Abweichungen von Prognose
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="monat"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: any) => fmt(value) + ' kWh'}
            />
            <Legend />
            <Bar
              dataKey="Abweichung"
              fill="#8b5cf6"
              name="Abweichung"
            >
              {chartData.map((entry, index) => (
                <rect
                  key={`cell-${index}`}
                  fill={entry.Abweichung >= 0 ? '#10b981' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Genauigkeits-Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="target" className="w-5 h-5 text-green-600" />
          Prognose-Genauigkeit im Zeitverlauf
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={genauigkeitTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="monat"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              label={{ value: '%', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: any) => fmtDec(value) + '%'}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Genauigkeit (%)"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Detailtabelle */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600" />
            Detaillierte Monatsdaten
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monat</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">IST-Erzeugung</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prognose</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Abweichung</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Abweichung %</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Genauigkeit</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {prognoseData
                .slice()
                .reverse()
                .map((m, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {m.monatName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {fmt(m.istErzeugung)} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600">
                      {fmt(m.prognoseErzeugung)} kWh
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      m.abweichungKwh >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {m.abweichungKwh >= 0 ? '+' : ''}{fmt(m.abweichungKwh)} kWh
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                      m.abweichungProzent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {m.abweichungProzent >= 0 ? '+' : ''}{fmtDec(m.abweichungProzent)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        m.genauigkeit >= 90 ? 'bg-green-100 text-green-800' :
                        m.genauigkeit >= 75 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {fmtDec(m.genauigkeit)}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights & Analyse */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="bulb" className="w-5 h-5 text-blue-600" />
          Prognose-Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Prognose-Methodik</div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 70% historischer Durchschnitt (gleicher Monat)</li>
              <li>• 30% Anlagenleistung + Saisonfaktoren</li>
              <li>• Berücksichtigt {toNum(anlage?.leistung_kwp || 0)} kWp Leistung</li>
            </ul>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Verbesserungspotenzial</div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Integration von Wetterdaten möglich</li>
              <li>• Verschattungs-Analyse empfohlen</li>
              <li>• Wartungs-Check bei Untererfüllung</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
