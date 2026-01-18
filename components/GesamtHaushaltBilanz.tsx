// components/GesamtHaushaltBilanz.tsx
// FIX: Korrekte Baum-Berechnung

'use client'

import Link from 'next/link'

interface GesamtHaushaltBilanzProps {
  monatsdaten: any[]
  anlage: any
  investitionen: any[]
}

export default function GesamtHaushaltBilanz({ monatsdaten, anlage, investitionen }: GesamtHaushaltBilanzProps) {
  
  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // PV Berechnungen
  const gesamtErzeugung = monatsdaten.reduce((sum, m) => sum + (m.pv_erzeugung_kwh || 0), 0)
  const gesamtErloese = monatsdaten.reduce((sum, m) => sum + (m.einspeisung_erloese_euro || 0), 0)
  
  // Investitionen Summen
  const gesamtInvKosten = investitionen.reduce((sum, inv) => sum + (inv.anschaffungskosten_relevant || 0), 0)
  const gesamtInvEinsparung = investitionen.reduce((sum, inv) => sum + (inv.einsparung_gesamt_jahr || 0), 0)
  const gesamtCO2 = investitionen.reduce((sum, inv) => sum + (inv.co2_einsparung_kg_jahr || 0), 0)

  // Gesamt-ROI
  const gesamtROI = gesamtInvKosten > 0 ? (gesamtInvEinsparung / gesamtInvKosten) * 100 : 0
  const gesamtAmortisation = gesamtInvEinsparung > 0 ? gesamtInvKosten / gesamtInvEinsparung : 0

  // Bäume-Berechnung: 1 Baum bindet ca. 10 kg CO₂ pro Jahr
  const anzahlBaeume = Math.round(gesamtCO2 / 10)

  const getIcon = (typ: string) => {
    const icons: Record<string, string> = {
      'e-auto': '🚗',
      'waermepumpe': '🔥',
      'speicher': '🔋',
      'balkonkraftwerk': '☀️',
      'wallbox': '⚡',
      'sonstiges': '📦'
    }
    return icons[typ] || '📦'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          💎 Gesamtbilanz Haushalt
        </h2>
        <Link
          href="/investitionen"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
        >
          💼 Investitionen verwalten
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Gesamt-ROI</div>
          <div className="text-2xl font-bold text-green-700">{fmtDec(gesamtROI)}%</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Amortisation</div>
          <div className="text-2xl font-bold text-blue-700">{fmtDec(gesamtAmortisation)} J.</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">CO₂-Einsparung/Jahr</div>
          <div className="text-2xl font-bold text-green-700">{fmtDec(gesamtCO2 / 1000)} t</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Netto-Ertrag/Jahr</div>
          <div className="text-2xl font-bold text-green-700">{fmt(gesamtInvEinsparung)} €</div>
        </div>
      </div>

      {/* Investitions-Tabelle */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            📊 Alle Investitionen ({investitionen.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Investition</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mehrkosten</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Einsparung/Jahr</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROI</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amortisation</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">CO₂/Jahr</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {investitionen.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getIcon(inv.typ)}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{inv.bezeichnung}</div>
                        <div className="text-xs text-gray-500">
                          seit {new Date(inv.anschaffungsdatum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                    +{fmt(inv.anschaffungskosten_relevant)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                    {fmt(inv.einsparung_gesamt_jahr)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {fmtDec(inv.roi_prozent)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {fmtDec(inv.amortisation_jahre)} J.
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {fmtDec((inv.co2_einsparung_kg_jahr || 0) / 1000)} t
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🌍 Umwelt-Impact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-green-700">{fmtDec(gesamtCO2 / 1000)} t</div>
            <div className="text-sm text-gray-600">CO₂-Einsparung pro Jahr</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-700">{fmt(anzahlBaeume)}</div>
            <div className="text-sm text-gray-600">≈ Bäume (CO₂-Bindung)</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-700">{fmt(gesamtInvEinsparung)}</div>
            <div className="text-sm text-gray-600">Euro Einsparung pro Jahr</div>
          </div>
        </div>
      </div>
    </div>
  )
}
