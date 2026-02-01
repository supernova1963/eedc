// components/auswertungen/EAutoAuswertungV2.tsx
// E-Auto Auswertung - Überarbeitete Version mit Hints & Tips

'use client'

import { useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import { HeaderKPIs, BewertungsBox, HintBox, EmptyState } from './AuswertungLayout'

interface Investition {
  id: string
  bezeichnung: string
  anschaffungsdatum: string
  alternativ_beschreibung?: string
  parameter: {
    km_jahr?: number
    verbrauch_kwh_100km?: number
    pv_anteil_prozent?: number
    vergleich_verbrenner_l_100km?: number
    benzinpreis_euro_liter?: number
    strompreis_cent_kwh?: number
    betriebskosten_jahr_euro?: number
  }
  einsparung_gesamt_jahr?: number
  co2_einsparung_kg_jahr?: number
}

interface PrognoseVergleich {
  investition_id: string
  prognose_jahr_euro: number
  ist_gesamt_euro: number
  anzahl_monate_erfasst: number
  ist_hochrechnung_jahr_euro?: number
  abweichung_prozent?: number
  co2_ist_gesamt_kg?: number
}

interface Monatsdaten {
  id: string
  jahr: number
  monat: number
  verbrauch_daten: {
    km_gefahren?: number
    strom_kwh?: number
    strom_pv_kwh?: number
    strom_netz_kwh?: number
    verbrauch_kwh_100km?: number
  }
  einsparung_monat_euro?: number
  co2_einsparung_kg?: number
}

interface EAutoAuswertungV2Props {
  investition: Investition
  prognoseVergleich: PrognoseVergleich | null
  monatsdaten: Monatsdaten[]
  strompreis?: number // aktueller Strompreis in Cent/kWh
}

export default function EAutoAuswertungV2({
  investition,
  prognoseVergleich,
  monatsdaten,
  strompreis = 30
}: EAutoAuswertungV2Props) {

  // Formatierungsfunktionen
  const fmt = (num?: number | null) => {
    if (num === null || num === undefined) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num?: number | null) => {
    if (num === null || num === undefined) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }

  // Monatsnamen
  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  // Sortierte Monatsdaten
  const sortedMonatsdaten = useMemo(() =>
    [...monatsdaten].sort((a, b) => {
      if (a.jahr !== b.jahr) return a.jahr - b.jahr
      return a.monat - b.monat
    }),
    [monatsdaten]
  )

  // Chart-Daten
  const chartData = useMemo(() =>
    sortedMonatsdaten.map(m => ({
      monat: `${monatsnamen[m.monat]} ${m.jahr}`,
      einsparung: m.einsparung_monat_euro || 0,
      km: m.verbrauch_daten.km_gefahren || 0,
      kwh: m.verbrauch_daten.strom_kwh || 0,
      verbrauch: m.verbrauch_daten.verbrauch_kwh_100km || 0,
      pvAnteil: m.verbrauch_daten.strom_kwh && m.verbrauch_daten.strom_pv_kwh
        ? (m.verbrauch_daten.strom_pv_kwh / m.verbrauch_daten.strom_kwh) * 100
        : 0
    })),
    [sortedMonatsdaten]
  )

  // Durchschnittswerte berechnen
  const stats = useMemo(() => {
    if (monatsdaten.length === 0) return null

    const totalKm = monatsdaten.reduce((sum, m) => sum + (m.verbrauch_daten.km_gefahren || 0), 0)
    const totalKwh = monatsdaten.reduce((sum, m) => sum + (m.verbrauch_daten.strom_kwh || 0), 0)
    const totalPvKwh = monatsdaten.reduce((sum, m) => sum + (m.verbrauch_daten.strom_pv_kwh || 0), 0)
    const totalEinsparung = monatsdaten.reduce((sum, m) => sum + (m.einsparung_monat_euro || 0), 0)
    const totalCO2 = monatsdaten.reduce((sum, m) => sum + (m.co2_einsparung_kg || 0), 0)

    const avgVerbrauch = totalKm > 0 ? (totalKwh / totalKm) * 100 : 0
    const avgPvAnteil = totalKwh > 0 ? (totalPvKwh / totalKwh) * 100 : 0

    return {
      totalKm,
      totalKwh,
      totalPvKwh,
      totalEinsparung,
      totalCO2,
      avgVerbrauch,
      avgPvAnteil,
      avgKmMonat: totalKm / monatsdaten.length,
      avgEinsparungMonat: totalEinsparung / monatsdaten.length
    }
  }, [monatsdaten])

  // Prognose-Parameter
  const prognoseKmJahr = investition.parameter?.km_jahr || 0
  const prognosePvAnteil = investition.parameter?.pv_anteil_prozent || 70
  const prognoseVerbrauch = investition.parameter?.verbrauch_kwh_100km || 0

  // Bewertungstext ermitteln
  const getBewertung = () => {
    if (!prognoseVergleich || prognoseVergleich.anzahl_monate_erfasst < 3) {
      return 'Zu wenig Daten'
    }
    const abweichung = prognoseVergleich.abweichung_prozent || 0
    if (abweichung > 10) return 'Besser als Prognose'
    if (abweichung >= -10) return 'Im Rahmen der Prognose'
    return 'Schlechter als Prognose'
  }

  // Hints generieren basierend auf Daten
  const hints = useMemo(() => {
    const result: Array<{ type: 'info' | 'success' | 'warning' | 'tip', title: string, content: string }> = []

    if (!stats) return result

    // PV-Anteil Analyse
    if (stats.avgPvAnteil < 50 && prognosePvAnteil >= 70) {
      result.push({
        type: 'warning',
        title: 'PV-Anteil unter Erwartung',
        content: `Dein durchschnittlicher PV-Anteil liegt bei ${fmt(stats.avgPvAnteil)}%, prognostiziert waren ${prognosePvAnteil}%. Tipp: Versuche häufiger tagsüber zu laden, wenn die PV-Anlage Strom produziert.`
      })
    } else if (stats.avgPvAnteil > prognosePvAnteil) {
      result.push({
        type: 'success',
        title: 'Hervorragender PV-Anteil!',
        content: `Mit ${fmt(stats.avgPvAnteil)}% PV-Anteil übertrifft dein E-Auto die Prognose von ${prognosePvAnteil}%. Weiter so!`
      })
    }

    // Verbrauch Analyse
    if (prognoseVerbrauch > 0 && stats.avgVerbrauch > prognoseVerbrauch * 1.2) {
      result.push({
        type: 'warning',
        title: 'Erhöhter Verbrauch',
        content: `Dein Durchschnittsverbrauch von ${fmtDec(stats.avgVerbrauch)} kWh/100km liegt über der Prognose (${prognoseVerbrauch} kWh/100km). Mögliche Ursachen: Kaltes Wetter, sportliche Fahrweise, häufiges Schnellladen.`
      })
    }

    // km-Analyse
    if (prognoseKmJahr > 0 && stats.avgKmMonat > 0) {
      const hochrechnungKm = stats.avgKmMonat * 12
      if (hochrechnungKm > prognoseKmJahr * 1.3) {
        result.push({
          type: 'info',
          title: 'Mehr gefahren als geplant',
          content: `Hochgerechnet fährst du ca. ${fmt(hochrechnungKm)} km/Jahr - mehr als die prognostizierten ${fmt(prognoseKmJahr)} km. Das bedeutet mehr Einsparung, aber auch mehr Verschleiß.`
        })
      }
    }

    // Positive Einsparung
    if (prognoseVergleich && prognoseVergleich.abweichung_prozent && prognoseVergleich.abweichung_prozent > 20) {
      result.push({
        type: 'tip',
        title: 'Überdurchschnittliche Einsparung',
        content: `Du sparst ${fmtDec(prognoseVergleich.abweichung_prozent)}% mehr als prognostiziert. Falls du noch einen Verbrenner hast, überlege ob ein zweites E-Auto sinnvoll wäre.`
      })
    }

    return result
  }, [stats, prognosePvAnteil, prognoseVerbrauch, prognoseKmJahr, prognoseVergleich])

  if (monatsdaten.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <SimpleIcon type="car" className="w-6 h-6 text-green-600" />
              {investition.bezeichnung}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {investition.alternativ_beschreibung && `vs. ${investition.alternativ_beschreibung} • `}
              seit {new Date(investition.anschaffungsdatum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        <EmptyState
          message="Noch keine Monatsdaten erfasst."
          actionLabel="Ersten Monat erfassen"
          actionLink="/eingabe?tab=e-auto"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SimpleIcon type="car" className="w-6 h-6 text-green-600" />
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

      {/* Header KPIs */}
      <HeaderKPIs kpis={[
        {
          label: 'Gesamtersparnis',
          value: `${fmt(stats?.totalEinsparung)} €`,
          subtext: `${monatsdaten.length} Monate erfasst`,
          colorClass: 'text-green-700 dark:text-green-400'
        },
        {
          label: 'Ø PV-Anteil',
          value: `${fmt(stats?.avgPvAnteil)}%`,
          subtext: `Prognose: ${prognosePvAnteil}%`,
          colorClass: (stats?.avgPvAnteil || 0) >= prognosePvAnteil ? 'text-green-700' : 'text-orange-600'
        },
        {
          label: 'Ø Verbrauch',
          value: `${fmtDec(stats?.avgVerbrauch)} kWh`,
          subtext: 'pro 100km',
          colorClass: 'text-gray-900 dark:text-gray-100'
        },
        {
          label: 'CO₂ eingespart',
          value: `${fmt((stats?.totalCO2 || 0) / 1000)} t`,
          subtext: `${fmt(stats?.totalKm)} km gefahren`,
          colorClass: 'text-emerald-700 dark:text-emerald-400'
        }
      ]} />

      {/* Prognose vs. Ist */}
      {prognoseVergleich && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <SimpleIcon type="chart" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Prognose vs. Ist
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Prognose (Jahr)</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {fmt(prognoseVergleich.prognose_jahr_euro)} €
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ist ({prognoseVergleich.anzahl_monate_erfasst} Monate)</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {fmt(prognoseVergleich.ist_gesamt_euro)} €
              </div>
            </div>

            {prognoseVergleich.ist_hochrechnung_jahr_euro && (
              <>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Hochrechnung (Jahr)</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {fmt(prognoseVergleich.ist_hochrechnung_jahr_euro)} €
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Abweichung</div>
                  <div className={`text-2xl font-bold ${
                    (prognoseVergleich.abweichung_prozent || 0) >= 0
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}>
                    {prognoseVergleich.abweichung_prozent &&
                      (prognoseVergleich.abweichung_prozent > 0 ? '+' : '')
                    }
                    {fmtDec(prognoseVergleich.abweichung_prozent)}%
                  </div>
                </div>
              </>
            )}
          </div>

          <BewertungsBox
            bewertung={getBewertung()}
            details={
              getBewertung() === 'Besser als Prognose'
                ? 'Du sparst mehr als prognostiziert!'
                : getBewertung() === 'Zu wenig Daten'
                ? 'Erfasse mindestens 3 Monate für eine Hochrechnung'
                : undefined
            }
          />
        </div>
      )}

      {/* Hints & Tips */}
      {hints.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SimpleIcon type="lightbulb" className="w-5 h-5 text-yellow-500" />
            Hinweise & Tipps
          </h3>
          {hints.map((hint, index) => (
            <HintBox key={index} {...hint} />
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Einsparung Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <SimpleIcon type="money" className="w-5 h-5 text-green-600" />
            Einsparung pro Monat
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)} €`, 'Einsparung']}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
              />
              {prognoseVergleich && (
                <ReferenceLine
                  y={prognoseVergleich.prognose_jahr_euro / 12}
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  label={{ value: 'Prognose', position: 'right', fontSize: 10 }}
                />
              )}
              <Bar dataKey="einsparung" fill="#10b981" name="Einsparung" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Verbrauch Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <SimpleIcon type="lightning" className="w-5 h-5 text-blue-600" />
            Verbrauch (kWh/100km)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)} kWh/100km`, 'Verbrauch']}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
              />
              {prognoseVerbrauch > 0 && (
                <ReferenceLine
                  y={prognoseVerbrauch}
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  label={{ value: 'Prognose', position: 'right', fontSize: 10 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="verbrauch"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PV-Anteil Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <SimpleIcon type="sun" className="w-5 h-5 text-yellow-500" />
          PV-Anteil beim Laden
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'PV-Anteil']}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
            />
            <ReferenceLine
              y={prognosePvAnteil}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              label={{ value: `Ziel: ${prognosePvAnteil}%`, position: 'right', fontSize: 10 }}
            />
            <Bar dataKey="pvAnteil" fill="#fbbf24" name="PV-Anteil" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monatsdaten Tabelle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Alle erfassten Monate ({monatsdaten.length})
          </h3>
        </div>

        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monat</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">km</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">kWh</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">PV-Anteil</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Verbrauch</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Einsparung</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CO₂</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aktion</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {[...monatsdaten]
                .sort((a, b) => {
                  if (a.jahr !== b.jahr) return b.jahr - a.jahr
                  return b.monat - a.monat
                })
                .map((m) => {
                  const pvAnteil = m.verbrauch_daten.strom_kwh && m.verbrauch_daten.strom_pv_kwh
                    ? (m.verbrauch_daten.strom_pv_kwh / m.verbrauch_daten.strom_kwh) * 100
                    : 0

                  return (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {monatsnamen[m.monat]} {m.jahr}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                        {fmt(m.verbrauch_daten.km_gefahren)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                        {fmtDec(m.verbrauch_daten.strom_kwh)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          pvAnteil >= prognosePvAnteil
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}>
                          {fmtDec(pvAnteil)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                        {fmtDec(m.verbrauch_daten.verbrauch_kwh_100km)} kWh
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-green-600 dark:text-green-400">
                        {fmt(m.einsparung_monat_euro)} €
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                        {fmtDec((m.co2_einsparung_kg || 0) / 1000)} t
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Link
                          href={`/eingabe?tab=e-auto&edit=${m.id}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Bearbeiten"
                        >
                          <SimpleIcon type="edit" className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
