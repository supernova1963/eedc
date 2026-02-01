// components/MonatsDetailView.tsx
// Detaillierte Monatsdaten-Ansicht mit Drill-down

'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import SimpleIcon from './SimpleIcon'
import FormelTooltip, { fmtCalc } from './FormelTooltip'

interface MonatsDetailViewProps {
  monatsdaten: any[]
  anlage: any
}

export default function MonatsDetailView({ monatsdaten, anlage }: MonatsDetailViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<any>(null)

  if (!monatsdaten || monatsdaten.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <SimpleIcon type="info" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Keine Monatsdaten vorhanden</p>
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

  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  // Sortiere Monate chronologisch absteigend
  const sortedData = [...monatsdaten].sort((a, b) => {
    if (a.jahr !== b.jahr) return b.jahr - a.jahr
    return b.monat - a.monat
  })

  // Wenn noch kein Monat ausgewählt, nehme den neuesten
  const currentMonth = selectedMonth || sortedData[0]

  // Berechne Kennzahlen für ausgewählten Monat
  const erzeugung = toNum(currentMonth.pv_erzeugung_kwh)
  const direktverbrauch = toNum(currentMonth.direktverbrauch_kwh)
  const batterieentladung = toNum(currentMonth.batterieentladung_kwh)
  const batterieladung = toNum(currentMonth.batterieladung_kwh)
  const einspeisung = toNum(currentMonth.einspeisung_kwh)
  const netzbezug = toNum(currentMonth.netzbezug_kwh)
  const gesamtverbrauch = toNum(currentMonth.gesamtverbrauch_kwh)
  const eigenverbrauch = direktverbrauch + batterieentladung

  const eigenverbrauchsquote = erzeugung > 0 ? (eigenverbrauch / erzeugung) * 100 : 0
  const autarkiegrad = gesamtverbrauch > 0 ? (eigenverbrauch / gesamtverbrauch) * 100 : 0

  const netzbezugKosten = toNum(currentMonth.netzbezug_kosten_euro)
  const einspeisungErtrag = toNum(currentMonth.einspeisung_ertrag_euro)
  const betriebsausgaben = toNum(currentMonth.betriebsausgaben_monat_euro)
  const nettoErtrag = einspeisungErtrag - netzbezugKosten - betriebsausgaben

  // Pie Chart Daten - Energiefluss
  const energieflussData = [
    { name: 'Direktverbrauch', value: direktverbrauch, color: '#3b82f6' },
    { name: 'Batterieladung', value: batterieladung, color: '#8b5cf6' },
    { name: 'Einspeisung', value: einspeisung, color: '#10b981' },
  ].filter(item => item.value > 0)

  // Pie Chart Daten - Verbrauchsdeckung
  const verbrauchsdeckungData = [
    { name: 'Direktverbrauch PV', value: direktverbrauch, color: '#fbbf24' },
    { name: 'Aus Batterie', value: batterieentladung, color: '#8b5cf6' },
    { name: 'Netzbezug', value: netzbezug, color: '#ef4444' },
  ].filter(item => item.value > 0)

  // Wirtschaftliche Aufschlüsselung
  const wirtschaftData = [
    { kategorie: 'Erlöse', wert: einspeisungErtrag, color: '#10b981' },
    { kategorie: 'Netzbezug', wert: -netzbezugKosten, color: '#ef4444' },
    { kategorie: 'Betrieb', wert: -betriebsausgaben, color: '#f59e0b' },
  ]

  // Effizienz-Metriken
  const batterieEffizienz = batterieladung > 0 ? (batterieentladung / batterieladung) * 100 : 0
  const eigenverbrauchAbsolut = direktverbrauch + batterieentladung
  const durchschnittTagErzeugung = erzeugung / 30
  const durchschnittTagVerbrauch = gesamtverbrauch / 30

  // Spezifischer Ertrag (kWh/kWp)
  const spezifischerErtrag = anlage?.leistung_kwp > 0
    ? erzeugung / toNum(anlage.leistung_kwp)
    : 0

  // Vergleich mit Vormonat (falls vorhanden)
  const currentIndex = sortedData.findIndex(m => m === currentMonth)
  const vormonat = currentIndex < sortedData.length - 1 ? sortedData[currentIndex + 1] : null
  const vormonatErzeugung = vormonat ? toNum(vormonat.pv_erzeugung_kwh) : 0
  const veraenderungErzeugung = vormonat && vormonatErzeugung > 0
    ? ((erzeugung - vormonatErzeugung) / vormonatErzeugung) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Header mit Monatsauswahl */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="calendar" className="w-6 h-6 text-blue-600" />
              Monats-Detailansicht
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Tiefgehende Analyse einzelner Monate
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 dark:text-gray-400">Ausgewählter Monat</div>
            <div className="text-2xl font-bold text-blue-600">
              {monatsnamen[currentMonth.monat]} {currentMonth.jahr}
            </div>
          </div>
        </div>

        {/* Monatsauswahl */}
        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monat auswählen:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {sortedData.map((m, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentMonth === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {monatsnamen[m.monat]} {m.jahr.toString().slice(-2)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Haupt-KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-100 rounded-lg shadow p-6 border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-yellow-800 font-medium">PV-Erzeugung</div>
            <SimpleIcon type="sun" className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="text-3xl font-bold text-yellow-800 dark:text-yellow-300">{fmt(erzeugung)} kWh</div>
          <FormelTooltip
            formel="Erzeugung ÷ Anlagenleistung"
            berechnung={`${fmtCalc(erzeugung, 0)} kWh ÷ ${fmtCalc(anlage?.leistung_kwp)} kWp`}
            ergebnis={`= ${fmtCalc(spezifischerErtrag)} kWh/kWp`}
          >
            <span className="text-xs text-yellow-700 mt-1">
              {fmtDec(spezifischerErtrag)} kWh/kWp
            </span>
          </FormelTooltip>
          {vormonat && (
            <div className={`text-xs mt-1 ${veraenderungErzeugung >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {veraenderungErzeugung >= 0 ? '+' : ''}{fmtDec(veraenderungErzeugung)}% zum Vormonat
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-lg shadow p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-blue-800 font-medium">Eigenverbrauch</div>
            <SimpleIcon type="home" className="w-6 h-6 text-blue-600" />
          </div>
          <FormelTooltip
            formel="Direktverbrauch + Batterieentladung"
            berechnung={`${fmtCalc(direktverbrauch, 0)} + ${fmtCalc(batterieentladung, 0)} kWh`}
            ergebnis={`= ${fmtCalc(eigenverbrauchAbsolut, 0)} kWh`}
          >
            <span className="text-3xl font-bold text-blue-800 dark:text-blue-300">{fmt(eigenverbrauchAbsolut)} kWh</span>
          </FormelTooltip>
          <FormelTooltip
            formel="Eigenverbrauch ÷ Erzeugung × 100"
            berechnung={`${fmtCalc(eigenverbrauchAbsolut, 0)} ÷ ${fmtCalc(erzeugung, 0)} × 100`}
            ergebnis={`= ${fmtCalc(eigenverbrauchsquote)}%`}
          >
            <span className="text-xs text-blue-700 mt-1">
              {fmtDec(eigenverbrauchsquote)}% Quote
            </span>
          </FormelTooltip>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-lg shadow p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-purple-800 font-medium">Autarkiegrad</div>
            <SimpleIcon type="shield" className="w-6 h-6 text-purple-600" />
          </div>
          <FormelTooltip
            formel="Eigenverbrauch ÷ Gesamtverbrauch × 100"
            berechnung={`${fmtCalc(eigenverbrauch, 0)} ÷ ${fmtCalc(gesamtverbrauch, 0)} × 100`}
            ergebnis={`= ${fmtCalc(autarkiegrad)}%`}
          >
            <span className="text-3xl font-bold text-purple-800">{fmtDec(autarkiegrad)}%</span>
          </FormelTooltip>
          <div className="text-xs text-purple-700 mt-1">
            Unabhängigkeit vom Netz
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-green-800 font-medium">Netto-Ertrag</div>
            <SimpleIcon type="money" className="w-6 h-6 text-green-600" />
          </div>
          <FormelTooltip
            formel="Einspeise-Erlöse − Netzbezugskosten − Betriebsausgaben"
            berechnung={`${fmtCalc(einspeisungErtrag)} € − ${fmtCalc(netzbezugKosten)} € − ${fmtCalc(betriebsausgaben)} €`}
            ergebnis={`= ${fmtCalc(nettoErtrag)} €`}
          >
            <span className={`text-3xl font-bold ${nettoErtrag >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {nettoErtrag >= 0 ? '+' : ''}{fmtDec(nettoErtrag)} €
            </span>
          </FormelTooltip>
          <div className="text-xs text-green-700 mt-1">
            Erlöse - Kosten
          </div>
        </div>
      </div>

      {/* Charts-Sektion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Energiefluss */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="lightning" className="w-5 h-5 text-blue-600" />
            PV-Energie Verwendung
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={energieflussData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {energieflussData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => fmt(value) + ' kWh'} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Verbrauchsdeckung */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="plug" className="w-5 h-5 text-purple-600" />
            Verbrauchsdeckung
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={verbrauchsdeckungData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {verbrauchsdeckungData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => fmt(value) + ' kWh'} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Wirtschaftliche Aufschlüsselung */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="money" className="w-5 h-5 text-green-600" />
          Wirtschaftliche Aufschlüsselung
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={wirtschaftData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="kategorie" type="category" width={100} />
            <Tooltip formatter={(value: any) => fmtDec(Math.abs(value)) + ' €'} />
            <Bar dataKey="wert">
              {wirtschaftData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailtabellen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Energiedaten */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Energiedaten (kWh)</h3>
          </div>
          <div className="p-6">
            <table className="min-w-full">
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">PV-Erzeugung</td>
                  <td className="py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{fmt(erzeugung)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Direktverbrauch</td>
                  <td className="py-2 text-sm text-right font-medium text-blue-600">{fmt(direktverbrauch)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Batterieladung</td>
                  <td className="py-2 text-sm text-right font-medium text-purple-600">{fmt(batterieladung)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Batterieentladung</td>
                  <td className="py-2 text-sm text-right font-medium text-purple-600">{fmt(batterieentladung)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Einspeisung</td>
                  <td className="py-2 text-sm text-right font-medium text-green-600">{fmt(einspeisung)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Netzbezug</td>
                  <td className="py-2 text-sm text-right font-medium text-red-600">{fmt(netzbezug)}</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <td className="py-2 text-sm font-medium text-gray-900 dark:text-gray-100">Gesamtverbrauch</td>
                  <td className="py-2 text-sm text-right font-bold text-gray-900 dark:text-gray-100">{fmt(gesamtverbrauch)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Finanzdaten & Kennzahlen */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Finanzen & Kennzahlen</h3>
          </div>
          <div className="p-6">
            <table className="min-w-full">
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Einspeisevergütung</td>
                  <td className="py-2 text-sm text-right font-medium text-green-600">+{fmtDec(einspeisungErtrag)} €</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Netzbezugskosten</td>
                  <td className="py-2 text-sm text-right font-medium text-red-600">-{fmtDec(netzbezugKosten)} €</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">Betriebsausgaben</td>
                  <td className="py-2 text-sm text-right font-medium text-orange-600">-{fmtDec(betriebsausgaben)} €</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <td className="py-2 text-sm font-medium text-gray-900 dark:text-gray-100">Netto-Ertrag</td>
                  <td className={`py-2 text-sm text-right font-bold ${nettoErtrag >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {nettoErtrag >= 0 ? '+' : ''}{fmtDec(nettoErtrag)} €
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 pt-4">
                    <FormelTooltip
                      formel="Eigenverbrauch ÷ Erzeugung × 100"
                      berechnung={`${fmtCalc(eigenverbrauch, 0)} ÷ ${fmtCalc(erzeugung, 0)} × 100`}
                      ergebnis={`= ${fmtCalc(eigenverbrauchsquote)}%`}
                    >
                      <span>Eigenverbrauchsquote</span>
                    </FormelTooltip>
                  </td>
                  <td className="py-2 text-sm text-right font-medium text-blue-600 pt-4">{fmtDec(eigenverbrauchsquote)}%</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                    <FormelTooltip
                      formel="Eigenverbrauch ÷ Gesamtverbrauch × 100"
                      berechnung={`${fmtCalc(eigenverbrauch, 0)} ÷ ${fmtCalc(gesamtverbrauch, 0)} × 100`}
                      ergebnis={`= ${fmtCalc(autarkiegrad)}%`}
                    >
                      <span>Autarkiegrad</span>
                    </FormelTooltip>
                  </td>
                  <td className="py-2 text-sm text-right font-medium text-purple-600">{fmtDec(autarkiegrad)}%</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                    <FormelTooltip
                      formel="Batterieentladung ÷ Batterieladung × 100"
                      berechnung={`${fmtCalc(batterieentladung, 0)} ÷ ${fmtCalc(batterieladung, 0)} × 100`}
                      ergebnis={`= ${fmtCalc(batterieEffizienz)}%`}
                    >
                      <span>Batterie-Effizienz</span>
                    </FormelTooltip>
                  </td>
                  <td className="py-2 text-sm text-right font-medium text-purple-600">{fmtDec(batterieEffizienz)}%</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                    <FormelTooltip
                      formel="Erzeugung ÷ 30 Tage"
                      berechnung={`${fmtCalc(erzeugung, 0)} kWh ÷ 30`}
                      ergebnis={`= ${fmtCalc(durchschnittTagErzeugung)} kWh/Tag`}
                    >
                      <span>Ø Erzeugung/Tag</span>
                    </FormelTooltip>
                  </td>
                  <td className="py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">{fmtDec(durchschnittTagErzeugung)} kWh</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="bulb" className="w-5 h-5 text-blue-600" />
          Monats-Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Performance</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {eigenverbrauchsquote > 70 ? '✓' : '⚠'} Eigenverbrauch: {eigenverbrauchsquote > 70 ? 'Sehr gut' : 'Optimierbar'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {autarkiegrad > 60 ? '✓' : '⚠'} Autarkie: {autarkiegrad > 60 ? 'Stark' : 'Ausbaufähig'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Wirtschaftlichkeit</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {nettoErtrag > 0 ? '✓ Positiv' : '⚠ Negativ'}: {fmtDec(nettoErtrag)} €
            </div>
            <FormelTooltip
              formel="Eigenverbrauch × Ø Strompreis (0,30 €/kWh)"
              berechnung={`${fmtCalc(eigenverbrauchAbsolut, 0)} kWh × 0,30 €/kWh`}
              ergebnis={`= ${fmtCalc(eigenverbrauchAbsolut * 0.30)} € vermieden`}
            >
              <span className="text-sm text-gray-600 mt-1">
                Einsparung: {fmtDec(eigenverbrauchAbsolut * 0.30)} € vermieden
              </span>
            </FormelTooltip>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Speicher</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Effizienz: {fmtDec(batterieEffizienz)}%
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {batterieEffizienz > 80 ? '✓ Optimal' : batterieEffizienz > 70 ? '○ Gut' : '⚠ Prüfen'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
