// components/EAutoAuswertung.tsx
// Auswertung E-Auto: Prognose vs. Ist, Chart, Tabelle

'use client'

import { InvestitionPrognoseIstVergleich, InvestitionMonatsdatenDetail } from '@/lib/supabase-browser'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import SimpleIcon from './SimpleIcon'

interface EAutoAuswertungProps {
  investition: any
  prognoseVergleich: InvestitionPrognoseIstVergleich | null
  monatsdaten: InvestitionMonatsdatenDetail[]
}

export default function EAutoAuswertung({ 
  investition, 
  prognoseVergleich,
  monatsdaten 
}: EAutoAuswertungProps) {
  
  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // Monatsnamen
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  // V2H-Konfiguration
  const nutztV2h = investition.parameter?.nutzt_v2h === true
  const v2hEntladepreis = investition.parameter?.v2h_entlade_preis_cent || 30

  // V2H-Werte aus Monatsdaten aggregieren
  const gesamtV2hEntladung = monatsdaten.reduce((sum, m) => sum + (m.verbrauch_daten?.entladung_v2h_kwh || 0), 0)
  const gesamtV2hErsparnis = monatsdaten.reduce((sum, m) => {
    const entladung = m.verbrauch_daten?.entladung_v2h_kwh || 0
    return sum + (entladung * v2hEntladepreis / 100)
  }, 0)

  // Chart-Daten vorbereiten
  const chartData = monatsdaten
    .sort((a, b) => {
      if (a.jahr !== b.jahr) return a.jahr - b.jahr
      return a.monat - b.monat
    })
    .map(m => ({
      monat: `${monatsnamen[m.monat]} ${m.jahr}`,
      einsparung: m.einsparung_monat_euro || 0,
      km: m.verbrauch_daten.km_gefahren || 0,
      kwh: m.verbrauch_daten.strom_kwh || 0,
      verbrauch: m.verbrauch_daten.verbrauch_kwh_100km || 0
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <SimpleIcon type="car" className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            {investition.bezeichnung}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {investition.alternativ_beschreibung && `vs. ${investition.alternativ_beschreibung} • `}
            seit {new Date(investition.anschaffungsdatum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/eingabe?tab=e-auto"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white flex items-center gap-2"
        >
          <SimpleIcon type="plus" className="w-4 h-4" />
          Monat erfassen
        </Link>
      </div>

      {/* V2H-Info-Box wenn aktiviert */}
      {nutztV2h && gesamtV2hEntladung > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <SimpleIcon type="battery" className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">Vehicle-to-Home (V2H)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-purple-700 dark:text-purple-300">V2H-Rückspeisung</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{fmt(gesamtV2hEntladung)} kWh</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Strom vom Auto ins Haus</div>
            </div>
            <div>
              <div className="text-sm text-purple-700 dark:text-purple-300">V2H-Ersparnis</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{fmtDec(gesamtV2hErsparnis)} €</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Vermiedener Netzbezug</div>
            </div>
            <div>
              <div className="text-sm text-purple-700 dark:text-purple-300">Ø Entladepreis</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{v2hEntladepreis} ct/kWh</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Vermiedener Strompreis</div>
            </div>
          </div>
        </div>
      )}

      {/* Prognose vs. Ist */}
      {prognoseVergleich && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="chart" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Prognose vs. Ist ({prognoseVergleich.jahr || new Date().getFullYear()})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Prognose (Jahr)</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {fmt(prognoseVergleich.prognose_jahr_euro)} €
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ist ({prognoseVergleich.anzahl_monate_erfasst || prognoseVergleich.anzahl_monate} Monate)</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {fmt(prognoseVergleich.ist_gesamt_euro || prognoseVergleich.einsparung_ist_jahr_euro)} €
              </div>
            </div>

            {(prognoseVergleich.ist_hochrechnung_jahr_euro || prognoseVergleich.hochrechnung_jahr_euro) && (
              <>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Hochrechnung</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {fmt(prognoseVergleich.ist_hochrechnung_jahr_euro || prognoseVergleich.hochrechnung_jahr_euro)} €
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Abweichung</div>
                  <div className={`text-2xl font-bold ${
                    (prognoseVergleich.abweichung_prozent || prognoseVergleich.abweichung_hochrechnung_prozent || 0) >= 0
                      ? 'text-green-700'
                      : 'text-red-700'
                  }`}>
                    {(prognoseVergleich.abweichung_prozent || prognoseVergleich.abweichung_hochrechnung_prozent) &&
                      ((prognoseVergleich.abweichung_prozent || prognoseVergleich.abweichung_hochrechnung_prozent || 0) > 0 ? '+' : '')
                    }
                    {fmtDec(prognoseVergleich.abweichung_prozent || prognoseVergleich.abweichung_hochrechnung_prozent)}%
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bewertung */}
          {(() => {
            const anzahlMonate = prognoseVergleich.anzahl_monate_erfasst || prognoseVergleich.anzahl_monate || 0
            const abweichung = prognoseVergleich.abweichung_prozent || prognoseVergleich.abweichung_hochrechnung_prozent || 0
            let bewertung = 'Zu wenig Daten'
            if (anzahlMonate >= 3) {
              if (abweichung > 10) bewertung = 'Besser als Prognose'
              else if (abweichung >= -10) bewertung = 'Im Rahmen der Prognose'
              else bewertung = 'Schlechter als Prognose'
            }

            return (
              <div className={`p-4 rounded-lg ${
                bewertung === 'Besser als Prognose' ? 'bg-green-50 border border-green-200' :
                bewertung === 'Schlechter als Prognose' ? 'bg-yellow-50 border border-yellow-200' :
                bewertung === 'Im Rahmen der Prognose' ? 'bg-blue-50 border border-blue-200' :
                'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-center gap-2">
                  {bewertung === 'Besser als Prognose' ? (
                    <SimpleIcon type="check" className="w-6 h-6 text-green-600" />
                  ) : bewertung === 'Schlechter als Prognose' ? (
                    <SimpleIcon type="error" className="w-6 h-6 text-yellow-600" />
                  ) : bewertung === 'Im Rahmen der Prognose' ? (
                    <SimpleIcon type="check" className="w-6 h-6 text-blue-600" />
                  ) : (
                    <SimpleIcon type="info" className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium">{bewertung}</div>
                    {bewertung === 'Besser als Prognose' && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Du sparst mehr als prognostiziert!
                      </div>
                    )}
                    {bewertung === 'Zu wenig Daten' && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Erfasse mindestens 3 Monate für eine Hochrechnung
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Charts */}
      {monatsdaten.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="trend" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Monatliche Entwicklung
          </h3>

          {/* Einsparung Chart */}
          <div className="mb-8">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Einsparung (€)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => `${value.toFixed(2)} €`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                />
                <Bar dataKey="einsparung" fill="#10b981" name="Einsparung" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Verbrauch Chart */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Verbrauch (kWh/100km)</h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => `${value.toFixed(1)} kWh/100km`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                />
                <Line type="monotone" dataKey="verbrauch" stroke="#3b82f6" name="Verbrauch" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monatsdaten Tabelle */}
      {monatsdaten.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              Alle erfassten Monate ({monatsdaten.length})
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Monat
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    km
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    kWh
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    PV-Anteil
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Verbrauch
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Einsparung
                  </th>
                  {nutztV2h && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-purple-600 uppercase">
                      V2H
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    CO₂
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                {monatsdaten
                  .sort((a, b) => {
                    if (a.jahr !== b.jahr) return b.jahr - a.jahr
                    return b.monat - a.monat
                  })
                  .map((m) => {
                    const pvAnteil = m.verbrauch_daten.strom_kwh > 0 
                      ? (m.verbrauch_daten.strom_pv_kwh / m.verbrauch_daten.strom_kwh) * 100 
                      : 0

                    return (
                      <tr key={m.id} className="hover:bg-gray-50 dark:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {monatsnamen[m.monat]} {m.jahr}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                          {fmt(m.verbrauch_daten.km_gefahren)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                          {fmtDec(m.verbrauch_daten.strom_kwh)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:text-green-300">
                            {fmtDec(pvAnteil)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                          {fmtDec(m.verbrauch_daten.verbrauch_kwh_100km)} kWh/100km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                          {fmt(m.einsparung_monat_euro)} €
                        </td>
                        {nutztV2h && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-purple-600">
                            {(m.verbrauch_daten?.entladung_v2h_kwh || 0) > 0
                              ? `${fmtDec(m.verbrauch_daten.entladung_v2h_kwh)} kWh`
                              : '-'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                          {fmtDec((m.co2_einsparung_kg || 0) / 1000)} t
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <Link
                            href={`/eingabe?tab=e-auto&edit=${m.id}`}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            title="Bearbeiten"
                          >
                            <SimpleIcon type="edit" className="w-4 h-4" />
                          </Link>
                          {/* TODO: Löschen-Button */}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">
            Noch keine Monatsdaten erfasst.
          </p>
          <Link
            href="/eingabe?tab=e-auto"
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
