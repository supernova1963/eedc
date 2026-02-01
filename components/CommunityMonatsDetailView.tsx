// components/CommunityMonatsDetailView.tsx
// Öffentliche Monatsdetail-Ansicht für Community (ohne sensible Daten)

'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import SimpleIcon from './SimpleIcon'
import FormelTooltip, { fmtCalc } from './FormelTooltip'

interface CommunityMonatsDetailViewProps {
  monatsdaten: any[]
  leistung_kwp: number
}

export default function CommunityMonatsDetailView({ monatsdaten, leistung_kwp }: CommunityMonatsDetailViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<any>(null)

  if (!monatsdaten || monatsdaten.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <SimpleIcon type="info" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Keine Monatsdaten freigegeben</p>
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

  // Finanzen aus Monatsdaten
  const netzbezugKosten = toNum(currentMonth.netzbezug_kosten_euro)
  const einspeisungErtrag = toNum(currentMonth.einspeisung_ertrag_euro)
  const betriebsausgaben = toNum(currentMonth.betriebsausgaben_monat_euro)
  // Strompreis direkt aus Monatsdaten (in ct, umrechnen auf €)
  const strompreis = toNum(currentMonth.strompreis_cent_kwh) / 100 || 0.30
  const evEinsparung = eigenverbrauch * strompreis
  // Netto-Ertrag OHNE Netzbezugskosten (diese fallen auch ohne PV an)
  const nettoErtrag = evEinsparung + einspeisungErtrag - betriebsausgaben

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

  // Effizienz-Metriken
  const batterieEffizienz = batterieladung > 0 ? (batterieentladung / batterieladung) * 100 : 0
  const durchschnittTagErzeugung = erzeugung / 30

  // Spezifischer Ertrag (kWh/kWp)
  const spezifischerErtrag = leistung_kwp > 0 ? erzeugung / leistung_kwp : 0

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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="calendar" className="w-5 h-5 text-blue-600" />
              Monats-Detailansicht
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Tiefgehende Analyse einzelner Monate
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Ausgewählter Monat</div>
            <div className="text-xl font-bold text-blue-600">
              {monatsnamen[currentMonth.monat]} {currentMonth.jahr}
            </div>
          </div>
        </div>

        {/* Monatsauswahl */}
        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monat auswählen:
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {sortedData.slice(0, 12).map((m, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(m)}
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  currentMonth === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {monatsnamen[m.monat]} {String(m.jahr).slice(-2)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Haupt-KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-100 rounded-lg shadow p-4 border border-yellow-200">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-yellow-800 font-medium">PV-Erzeugung</div>
            <SimpleIcon type="sun" className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-yellow-800">{fmt(erzeugung)} kWh</div>
          <FormelTooltip
            formel="Erzeugung ÷ Anlagenleistung"
            berechnung={`${fmtCalc(erzeugung, 0)} kWh ÷ ${fmtCalc(leistung_kwp)} kWp`}
            ergebnis={`= ${fmtCalc(spezifischerErtrag)} kWh/kWp`}
          >
            <span className="text-xs text-yellow-700">
              {fmtDec(spezifischerErtrag)} kWh/kWp
            </span>
          </FormelTooltip>
          {vormonat && (
            <div className={`text-xs mt-1 ${veraenderungErzeugung >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {veraenderungErzeugung >= 0 ? '+' : ''}{fmtDec(veraenderungErzeugung)}% zum Vormonat
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-lg shadow p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-blue-800 font-medium">Eigenverbrauch</div>
            <SimpleIcon type="home" className="w-5 h-5 text-blue-600" />
          </div>
          <FormelTooltip
            formel="Direktverbrauch + Batterieentladung"
            berechnung={`${fmtCalc(direktverbrauch, 0)} + ${fmtCalc(batterieentladung, 0)} kWh`}
            ergebnis={`= ${fmtCalc(eigenverbrauch, 0)} kWh`}
          >
            <span className="text-2xl font-bold text-blue-800">{fmt(eigenverbrauch)} kWh</span>
          </FormelTooltip>
          <FormelTooltip
            formel="Eigenverbrauch ÷ Erzeugung × 100"
            berechnung={`${fmtCalc(eigenverbrauch, 0)} ÷ ${fmtCalc(erzeugung, 0)} × 100`}
            ergebnis={`= ${fmtCalc(eigenverbrauchsquote)}%`}
          >
            <span className="text-xs text-blue-700">
              {fmtDec(eigenverbrauchsquote)}% Quote
            </span>
          </FormelTooltip>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-lg shadow p-4 border border-purple-200">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-purple-800 font-medium">Autarkiegrad</div>
            <SimpleIcon type="shield" className="w-5 h-5 text-purple-600" />
          </div>
          <FormelTooltip
            formel="Eigenverbrauch ÷ Gesamtverbrauch × 100"
            berechnung={`${fmtCalc(eigenverbrauch, 0)} ÷ ${fmtCalc(gesamtverbrauch, 0)} × 100`}
            ergebnis={`= ${fmtCalc(autarkiegrad)}%`}
          >
            <span className="text-2xl font-bold text-purple-800">{fmtDec(autarkiegrad)}%</span>
          </FormelTooltip>
          <div className="text-xs text-purple-700">
            Unabhängigkeit vom Netz
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg shadow p-4 border border-green-200">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-green-800 font-medium">Netto-Ertrag</div>
            <SimpleIcon type="money" className="w-5 h-5 text-green-600" />
          </div>
          <FormelTooltip
            formel="EV-Einsparung + Einspeise-Erlöse − Betriebsausgaben"
            berechnung={`${fmtCalc(evEinsparung)} € + ${fmtCalc(einspeisungErtrag)} € − ${fmtCalc(betriebsausgaben)} €`}
            ergebnis={`= ${fmtCalc(nettoErtrag)} €`}
          >
            <span className={`text-2xl font-bold ${nettoErtrag >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {nettoErtrag >= 0 ? '+' : ''}{fmtDec(nettoErtrag)} €
            </span>
          </FormelTooltip>
          <div className="text-xs text-green-700">
            EV-Ersparnis + Erlöse − Betrieb
          </div>
        </div>
      </div>

      {/* Charts-Sektion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Energiefluss */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="lightning" className="w-4 h-4 text-blue-600" />
            PV-Energie Verwendung
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={energieflussData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="plug" className="w-4 h-4 text-purple-600" />
            Verbrauchsdeckung
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={verbrauchsdeckungData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
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

      {/* Detailtabellen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Energiedaten */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-md font-semibold text-gray-900">Energiedaten (kWh)</h3>
          </div>
          <div className="p-4">
            <table className="min-w-full text-sm">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-2 text-gray-600">PV-Erzeugung</td>
                  <td className="py-2 text-right font-medium text-gray-900">{fmt(erzeugung)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Direktverbrauch</td>
                  <td className="py-2 text-right font-medium text-blue-600">{fmt(direktverbrauch)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Batterieladung</td>
                  <td className="py-2 text-right font-medium text-purple-600">{fmt(batterieladung)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Batterieentladung</td>
                  <td className="py-2 text-right font-medium text-purple-600">{fmt(batterieentladung)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Einspeisung</td>
                  <td className="py-2 text-right font-medium text-green-600">{fmt(einspeisung)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Netzbezug</td>
                  <td className="py-2 text-right font-medium text-red-600">{fmt(netzbezug)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">Gesamtverbrauch</td>
                  <td className="py-2 text-right font-bold text-gray-900">{fmt(gesamtverbrauch)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Kennzahlen */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-md font-semibold text-gray-900">Kennzahlen</h3>
          </div>
          <div className="p-4">
            <table className="min-w-full text-sm">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-2 text-gray-600">
                    <FormelTooltip
                      formel="Eigenverbrauch ÷ Erzeugung × 100"
                      berechnung={`${fmtCalc(eigenverbrauch, 0)} ÷ ${fmtCalc(erzeugung, 0)} × 100`}
                      ergebnis={`= ${fmtCalc(eigenverbrauchsquote)}%`}
                    >
                      <span>Eigenverbrauchsquote</span>
                    </FormelTooltip>
                  </td>
                  <td className="py-2 text-right font-medium text-blue-600">{fmtDec(eigenverbrauchsquote)}%</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">
                    <FormelTooltip
                      formel="Eigenverbrauch ÷ Gesamtverbrauch × 100"
                      berechnung={`${fmtCalc(eigenverbrauch, 0)} ÷ ${fmtCalc(gesamtverbrauch, 0)} × 100`}
                      ergebnis={`= ${fmtCalc(autarkiegrad)}%`}
                    >
                      <span>Autarkiegrad</span>
                    </FormelTooltip>
                  </td>
                  <td className="py-2 text-right font-medium text-purple-600">{fmtDec(autarkiegrad)}%</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">
                    <FormelTooltip
                      formel="Batterieentladung ÷ Batterieladung × 100"
                      berechnung={`${fmtCalc(batterieentladung, 0)} ÷ ${fmtCalc(batterieladung, 0)} × 100`}
                      ergebnis={`= ${fmtCalc(batterieEffizienz)}%`}
                    >
                      <span>Batterie-Effizienz</span>
                    </FormelTooltip>
                  </td>
                  <td className="py-2 text-right font-medium text-purple-600">{fmtDec(batterieEffizienz)}%</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">
                    <FormelTooltip
                      formel="Erzeugung ÷ 30 Tage"
                      berechnung={`${fmtCalc(erzeugung, 0)} kWh ÷ 30`}
                      ergebnis={`= ${fmtCalc(durchschnittTagErzeugung)} kWh/Tag`}
                    >
                      <span>Ø Erzeugung/Tag</span>
                    </FormelTooltip>
                  </td>
                  <td className="py-2 text-right font-medium text-gray-900">{fmtDec(durchschnittTagErzeugung)} kWh</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Spez. Ertrag</td>
                  <td className="py-2 text-right font-medium text-yellow-600">{fmtDec(spezifischerErtrag)} kWh/kWp</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance-Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4">
        <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <SimpleIcon type="bulb" className="w-4 h-4 text-blue-600" />
          Monats-Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs font-medium text-gray-700 mb-1">Performance</div>
            <div className="text-xs text-gray-600">
              {eigenverbrauchsquote > 70 ? '✓' : '⚠'} Eigenverbrauch: {eigenverbrauchsquote > 70 ? 'Sehr gut' : eigenverbrauchsquote > 50 ? 'Gut' : 'Optimierbar'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {autarkiegrad > 60 ? '✓' : '⚠'} Autarkie: {autarkiegrad > 60 ? 'Stark' : autarkiegrad > 40 ? 'Mittel' : 'Ausbaufähig'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs font-medium text-gray-700 mb-1">Wirtschaftlichkeit</div>
            <div className="text-xs text-gray-600">
              {nettoErtrag > 0 ? '✓ Positiv' : '⚠ Negativ'}: {fmtDec(nettoErtrag)} €
            </div>
            <FormelTooltip
              formel="Eigenverbrauch × Ø Strompreis"
              berechnung={`${fmtCalc(eigenverbrauch, 0)} kWh × ${fmtCalc(strompreis)} €/kWh`}
              ergebnis={`= ${fmtCalc(evEinsparung)} € vermieden`}
            >
              <span className="text-xs text-gray-600 mt-1 block">
                Einsparung: {fmtDec(evEinsparung)} € vermieden
              </span>
            </FormelTooltip>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs font-medium text-gray-700 mb-1">Speicher</div>
            <div className="text-xs text-gray-600">
              Effizienz: {fmtDec(batterieEffizienz)}%
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {batterieEffizienz > 80 ? '✓ Optimal' : batterieEffizienz > 70 ? '○ Gut' : batterieEffizienz > 0 ? '⚠ Prüfen' : '- Kein Speicher'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
