// components/GesamtHaushaltBilanz.tsx
// FIX: Korrekte Baum-Berechnung

'use client'

import Link from 'next/link'
import SimpleIcon from './SimpleIcon'
import FormelTooltip from './FormelTooltip'

interface GesamtHaushaltBilanzProps {
  monatsdaten: any[]
  anlage: any
  investitionen: any[]
}

export default function GesamtHaushaltBilanz({ monatsdaten, anlage, investitionen }: GesamtHaushaltBilanzProps) {
  
  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // ===== PV-ANLAGE: Tatsächliche Werte aus Monatsdaten =====
  const gesamtErzeugung = monatsdaten.reduce((sum, m) => sum + toNum(m.pv_erzeugung_kwh), 0)
  const gesamtEigenverbrauch = monatsdaten.reduce((sum, m) =>
    sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0)

  // Einspeise-Erlöse
  const pvEinspeiseErloese = monatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_ertrag_euro), 0)

  // Eigenverbrauch-Einsparung
  const durchschnittNetzbezugPreis = monatsdaten.length > 0
    ? monatsdaten.reduce((sum, m) => sum + toNum(m.netzbezug_preis_cent_kwh), 0) / monatsdaten.length
    : 0
  const pvEigenverbrauchEinsparung = gesamtEigenverbrauch * durchschnittNetzbezugPreis / 100

  // PV Betriebsausgaben
  const pvBetriebsausgaben = monatsdaten.reduce((sum, m) => sum + toNum(m.betriebsausgaben_monat_euro), 0)

  // PV Netto-Ertrag (tatsächlich, kumuliert über alle Monate)
  const pvNettoErtragGesamt = pvEinspeiseErloese + pvEigenverbrauchEinsparung - pvBetriebsausgaben

  // Anzahl erfasster Monate und Jahre für Hochrechnung
  const erfassteMonateCount = monatsdaten.length
  const erfassteJahre = erfassteMonateCount / 12

  // PV Ertrag pro Jahr (hochgerechnet auf 12 Monate)
  const pvErtragProJahr = erfassteMonateCount > 0
    ? (pvNettoErtragGesamt / erfassteMonateCount) * 12
    : 0

  // PV Investitionskosten
  const pvInvestition = toNum(anlage?.anschaffungskosten_gesamt)

  // PV CO2-Einsparung (ca. 400g CO2 pro kWh Strom aus deutschem Mix)
  const pvCO2ProJahr = erfassteJahre > 0 ? (gesamtErzeugung / erfassteJahre) * 0.4 : 0

  // ===== ANDERE INVESTITIONEN =====
  // Investitionen nach Anlagen-Zugehörigkeit gruppieren
  const anlageInvestitionen = investitionen.filter(inv => inv.anlage_id === anlage?.id)
  const sonstigeInvestitionen = investitionen.filter(inv => inv.anlage_id !== anlage?.id)

  const gesamtInvKosten = investitionen.reduce((sum, inv) => sum + toNum(inv.anschaffungskosten_relevant), 0)
  const gesamtInvEinsparungProJahr = investitionen.reduce((sum, inv) => sum + toNum(inv.einsparung_gesamt_jahr), 0)
  const invCO2ProJahr = investitionen.reduce((sum, inv) => sum + toNum(inv.co2_einsparung_kg_jahr), 0)

  // ===== GESAMTSUMMEN =====
  const gesamtKosten = pvInvestition + gesamtInvKosten
  const gesamtErtragProJahr = pvErtragProJahr + gesamtInvEinsparungProJahr
  const gesamtCO2ProJahr = pvCO2ProJahr + invCO2ProJahr

  // Gesamt-ROI und Amortisation
  const gesamtROI = gesamtKosten > 0 ? (gesamtErtragProJahr / gesamtKosten) * 100 : 0
  const gesamtAmortisation = gesamtErtragProJahr > 0 ? gesamtKosten / gesamtErtragProJahr : 0

  // Bäume-Berechnung: 1 Baum bindet ca. 10 kg CO₂ pro Jahr
  const anzahlBaeume = Math.round(gesamtCO2ProJahr / 10)

  const getIconType = (typ: string) => {
    const iconTypes: Record<string, string> = {
      'e-auto': 'car',
      'waermepumpe': 'heat',
      'speicher': 'battery',
      'balkonkraftwerk': 'solar',
      'wallbox': 'wallbox',
      'sonstiges': 'box'
    }
    return iconTypes[typ] || 'box'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SimpleIcon type="gem" className="w-6 h-6 text-blue-600" />
          Gesamtbilanz Haushalt
        </h2>
        <Link
          href="/investitionen"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white flex items-center gap-2"
        >
          <SimpleIcon type="briefcase" className="w-4 h-4" />
          Investitionen verwalten
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <FormelTooltip
            formel="PV-Investition + Sonstige Investitionen"
            berechnung={`${fmt(pvInvestition)} € + ${fmt(gesamtInvKosten)} €`}
            ergebnis={`= ${fmt(gesamtKosten)} €`}
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">Gesamt-Investition</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{fmt(gesamtKosten)} €</div>
            <div className="text-xs text-gray-500 mt-1">PV: {fmt(pvInvestition)} € + Sonstige: {fmt(gesamtInvKosten)} €</div>
          </FormelTooltip>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <FormelTooltip
            formel="PV-Ertrag/Jahr + Sonstige Einsparungen/Jahr"
            berechnung={`${fmt(pvErtragProJahr)} € + ${fmt(gesamtInvEinsparungProJahr)} €`}
            ergebnis={`= ${fmt(gesamtErtragProJahr)} €/Jahr`}
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">Netto-Ertrag/Jahr</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(gesamtErtragProJahr)} €</div>
            <div className="text-xs text-gray-500 mt-1">PV: {fmt(pvErtragProJahr)} € + Sonstige: {fmt(gesamtInvEinsparungProJahr)} €</div>
          </FormelTooltip>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <FormelTooltip
            formel="Gesamt-Investition ÷ Ertrag/Jahr"
            berechnung={`${fmt(gesamtKosten)} € ÷ ${fmt(gesamtErtragProJahr)} €`}
            ergebnis={`= ${fmtDec(gesamtAmortisation)} Jahre`}
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">Amortisation</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{fmtDec(gesamtAmortisation)} J.</div>
            <div className="text-xs text-gray-500 mt-1">ROI: {fmtDec(gesamtROI)}%</div>
          </FormelTooltip>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <FormelTooltip
            formel="PV-CO₂ + Investitionen-CO₂"
            berechnung={`${fmtDec(pvCO2ProJahr / 1000)} t + ${fmtDec(invCO2ProJahr / 1000)} t`}
            ergebnis={`= ${fmtDec(gesamtCO2ProJahr / 1000)} t/Jahr`}
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">CO₂-Einsparung/Jahr</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmtDec(gesamtCO2ProJahr / 1000)} t</div>
            <div className="text-xs text-gray-500 mt-1">≈ {fmt(anzahlBaeume)} Bäume</div>
          </FormelTooltip>
        </div>
      </div>

      {/* Investitions-Tabelle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <SimpleIcon type="chart" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Alle Investitionen ({investitionen.length + 1})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Investition</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Investition</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ertrag/Jahr</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROI</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amortisation</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">CO₂/Jahr</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
              {/* PV-Anlage als erste Zeile */}
              {anlage && (
                <tr className="hover:bg-gray-50 dark:bg-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <SimpleIcon type="sun" className="w-6 h-6 mr-3 text-yellow-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{anlage.anlagenname}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {anlage.leistung_kwp} kWp • {erfassteMonateCount} Monate erfasst
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                    {fmt(pvInvestition)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                    {fmt(pvErtragProJahr)} €
                    <div className="text-xs text-gray-400">
                      (EV: {fmt(pvEigenverbrauchEinsparung / erfassteJahre)} + Einsp: {fmt(pvEinspeiseErloese / erfassteJahre)})
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {pvInvestition > 0 ? fmtDec((pvErtragProJahr / pvInvestition) * 100) : '-'}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {pvErtragProJahr > 0 ? fmtDec(pvInvestition / pvErtragProJahr) : '-'} J.
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {fmtDec(pvCO2ProJahr / 1000)} t
                  </td>
                </tr>
              )}
              {/* Investitionen, die zur Anlage gehören - gelb hinterlegt und eingerückt */}
              {anlageInvestitionen.map((inv) => (
                <tr key={inv.id} className="hover:bg-yellow-100 dark:hover:bg-yellow-900/30 bg-yellow-50/50 dark:bg-yellow-900/10">
                  <td className="px-6 py-4">
                    <div className="flex items-center pl-6">
                      <SimpleIcon type={getIconType(inv.typ)} className="w-5 h-5 mr-3 text-yellow-600 dark:text-yellow-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{inv.bezeichnung}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          zur Anlage • seit {new Date(inv.anschaffungsdatum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {fmtDec(inv.roi_prozent)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {fmtDec(inv.amortisation_jahre)} J.
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {fmtDec((inv.co2_einsparung_kg_jahr || 0) / 1000)} t
                  </td>
                </tr>
              ))}
              {/* Sonstige Investitionen (nicht zur Anlage gehörend) */}
              {sonstigeInvestitionen.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 dark:bg-gray-700">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <SimpleIcon type={getIconType(inv.typ)} className="w-6 h-6 mr-3 text-gray-600 dark:text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{inv.bezeichnung}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {fmtDec(inv.roi_prozent)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {fmtDec(inv.amortisation_jahre)} J.
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {fmtDec((inv.co2_einsparung_kg_jahr || 0) / 1000)} t
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Berechnungs-Erläuterung */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Berechnungsgrundlage PV-Ertrag</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div><strong>EV-Einsparung:</strong> Eigenverbrauch × Ø Netzbezugspreis ({fmtDec(durchschnittNetzbezugPreis)} ct/kWh)</div>
          <div><strong>Einspeise-Erlös:</strong> Eingespeiste kWh × Einspeisevergütung</div>
          <div><strong>Netto-Ertrag:</strong> EV-Einsparung + Einspeise-Erlös − Betriebskosten</div>
          <div className="text-gray-500 italic mt-2">PV-Werte basieren auf {erfassteMonateCount} erfassten Monaten, hochgerechnet auf 12 Monate/Jahr.</div>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SimpleIcon type="globe" className="w-5 h-5 text-green-600" />
          Umwelt-Impact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-green-700 dark:text-green-400">{fmtDec(gesamtCO2ProJahr / 1000)} t</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">CO₂-Einsparung pro Jahr</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{fmt(anzahlBaeume)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">≈ Bäume (CO₂-Bindung)</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-700 dark:text-green-400">{fmt(gesamtErtragProJahr)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Euro Einsparung pro Jahr</div>
          </div>
        </div>
      </div>
    </div>
  )
}
