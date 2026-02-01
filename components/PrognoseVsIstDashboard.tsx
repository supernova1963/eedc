// components/PrognoseVsIstDashboard.tsx
// Prognose vs. IST Vergleich für PV-Erzeugung

'use client'

import { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import SimpleIcon from './SimpleIcon'
import ExportButton from './ExportButton'
import { text, card, border, table, gradient, colors, badge } from '@/lib/styles'

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
  istInstallationsmonat: boolean
}

export default function PrognoseVsIstDashboard({ monatsdaten, anlage }: PrognoseVsIstDashboardProps) {
  // Toggle um Installationsmonat ein-/auszuschließen
  const [excludeInstallationsmonat, setExcludeInstallationsmonat] = useState(true)

  if (!monatsdaten || monatsdaten.length === 0) {
    return (
      <div className={`${card.padded} p-8 text-center`}>
        <SimpleIcon type="info" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className={text.muted}>Keine Daten für Prognose-Vergleich vorhanden</p>
      </div>
    )
  }

  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  // Ermittle den Installationsmonat (erster Monat mit Daten oder aus Anlage)
  const sortedData = [...monatsdaten].sort((a, b) => {
    if (a.jahr !== b.jahr) return a.jahr - b.jahr
    return a.monat - b.monat
  })
  const ersterMonat = sortedData[0]
  const installationsJahr = ersterMonat?.jahr
  const installationsMonat = ersterMonat?.monat

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
  const prognoseDataAll: MonatsPrognose[] = monatsdaten.map(m => {
    const istErzeugung = toNum(m.pv_erzeugung_kwh)

    // Prüfe ob dies der Installationsmonat ist
    const istInstallationsmonat = m.jahr === installationsJahr && m.monat === installationsMonat

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
      monatName: `${monatsnamen[m.monat]} ${m.jahr}${istInstallationsmonat ? '*' : ''}`,
      istErzeugung,
      prognoseErzeugung,
      abweichungKwh,
      abweichungProzent,
      genauigkeit,
      istInstallationsmonat
    }
  })

  // Filtere Installationsmonat wenn gewünscht
  const prognoseData = excludeInstallationsmonat
    ? prognoseDataAll.filter(m => !m.istInstallationsmonat)
    : prognoseDataAll

  // Info über Installationsmonat
  const installationsmonatData = prognoseDataAll.find(m => m.istInstallationsmonat)

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
          <h2 className={`${text.h1} flex items-center gap-2 mb-2`}>
            <SimpleIcon type="target" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Prognose vs. IST-Vergleich
          </h2>
          <p className={text.sm}>
            Vergleich prognostizierte und tatsächliche PV-Erzeugung
          </p>
        </div>
        <div className="flex items-center gap-4">
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
      </div>

      {/* Installationsmonat Hinweis und Toggle */}
      {installationsmonatData && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SimpleIcon type="alert" className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <div>
                <div className={`${text.sm} font-medium text-orange-800 dark:text-orange-200`}>
                  Installationsmonat erkannt: {monatsnamen[installationsMonat]} {installationsJahr}
                </div>
                <div className={`${text.xs} text-orange-600 dark:text-orange-400`}>
                  Bei untermonatlicher Installation ist die Erzeugung typischerweise geringer als die Prognose.
                  IST: {fmt(installationsmonatData.istErzeugung)} kWh vs. Prognose: {fmt(installationsmonatData.prognoseErzeugung)} kWh
                  ({fmtDec(installationsmonatData.abweichungProzent)}%)
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className={`${text.xs} text-orange-700 dark:text-orange-300`}>
                {excludeInstallationsmonat ? 'Ausgeblendet' : 'Einbezogen'}
              </span>
              <button
                onClick={() => setExcludeInstallationsmonat(!excludeInstallationsmonat)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  excludeInstallationsmonat ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    excludeInstallationsmonat ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={card.padded}>
          <div className="flex items-center justify-between mb-2">
            <div className={`${text.sm} font-medium`}>Gesamt-Abweichung</div>
            <SimpleIcon
              type={gesamtAbweichung >= 0 ? 'trend-up' : 'trend-down'}
              className={`w-6 h-6 ${gesamtAbweichung >= 0 ? colors.positive : colors.negative}`}
            />
          </div>
          <div className={`text-3xl font-bold ${gesamtAbweichung >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {gesamtAbweichung >= 0 ? '+' : ''}{fmtDec(gesamtAbweichungProzent)}%
          </div>
          <div className={`${text.xs} mt-1`}>
            {gesamtAbweichung >= 0 ? '+' : ''}{fmt(gesamtAbweichung)} kWh
          </div>
        </div>

        <div className={`${gradient.kpiBlue} rounded-lg shadow p-6`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Prognose-Genauigkeit</div>
            <SimpleIcon type="check" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
            {fmtDec(durchschnittGenauigkeit)}%
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Durchschnitt über alle Monate
          </div>
        </div>

        <div className={`${gradient.kpiGreen} rounded-lg shadow p-6`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">Beste Übererfüllung</div>
            <SimpleIcon type="trophy" className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-300">
            +{fmt(maxUebererfuellung?.abweichungKwh || 0)}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            {maxUebererfuellung?.monatName || '-'} kWh
          </div>
        </div>

        <div className={`${gradient.kpiOrange} rounded-lg shadow p-6`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Größte Untererfüllung</div>
            <SimpleIcon type="alert" className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
            {fmt(maxUntererfuellung?.abweichungKwh || 0)}
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
            {maxUntererfuellung?.monatName || '-'} kWh
          </div>
        </div>
      </div>

      {/* Haupt-Chart: IST vs. Prognose */}
      <div className={card.padded}>
        <h3 className={`${text.h3} mb-4 flex items-center gap-2`}>
          <SimpleIcon type="chart" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
      <div className={card.padded}>
        <h3 className={`${text.h3} mb-4 flex items-center gap-2`}>
          <SimpleIcon type="trend" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
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
      <div className={card.padded}>
        <h3 className={`${text.h3} mb-4 flex items-center gap-2`}>
          <SimpleIcon type="target" className="w-5 h-5 text-green-600 dark:text-green-400" />
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
      <div className={card.overflow}>
        <div className={`px-6 py-4 border-b ${border.default}`}>
          <h3 className={`${text.h3} flex items-center gap-2`}>
            <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Detaillierte Monatsdaten
          </h3>
        </div>
        <div className={table.wrapper}>
          <table className={table.base}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Monat</th>
                <th className={table.thRight}>IST-Erzeugung</th>
                <th className={table.thRight}>Prognose</th>
                <th className={table.thRight}>Abweichung</th>
                <th className={table.thRight}>Abweichung %</th>
                <th className={table.thRight}>Genauigkeit</th>
              </tr>
            </thead>
            <tbody className={table.tbody}>
              {prognoseData
                .slice()
                .reverse()
                .map((m, i) => (
                  <tr key={i} className={table.tr}>
                    <td className={`${table.td} font-medium`}>
                      {m.monatName}
                    </td>
                    <td className={table.tdRight}>
                      {fmt(m.istErzeugung)} kWh
                    </td>
                    <td className={`${table.tdRight} ${colors.accent}`}>
                      {fmt(m.prognoseErzeugung)} kWh
                    </td>
                    <td className={`${table.tdRight} font-medium ${
                      m.abweichungKwh >= 0 ? colors.positive : colors.negative
                    }`}>
                      {m.abweichungKwh >= 0 ? '+' : ''}{fmt(m.abweichungKwh)} kWh
                    </td>
                    <td className={`${table.tdRight} ${
                      m.abweichungProzent >= 0 ? colors.positive : colors.negative
                    }`}>
                      {m.abweichungProzent >= 0 ? '+' : ''}{fmtDec(m.abweichungProzent)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={
                        m.genauigkeit >= 90 ? badge.success :
                        m.genauigkeit >= 75 ? badge.warning :
                        badge.error
                      }>
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
      <div className={`${gradient.infoBox} rounded-lg p-6 border-2`}>
        <h3 className={`${text.h3} mb-4 flex items-center gap-2`}>
          <SimpleIcon type="bulb" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Prognose-Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={card.inner}>
            <div className={`${text.label} mb-2`}>Prognose-Methodik</div>
            <ul className={`${text.sm} space-y-1`}>
              <li>• 70% historischer Durchschnitt (gleicher Monat)</li>
              <li>• 30% Anlagenleistung + Saisonfaktoren</li>
              <li>• Berücksichtigt {toNum(anlage?.leistung_kwp || 0)} kWp Leistung</li>
            </ul>
          </div>
          <div className={card.inner}>
            <div className={`${text.label} mb-2`}>Verbesserungspotenzial</div>
            <ul className={`${text.sm} space-y-1`}>
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
