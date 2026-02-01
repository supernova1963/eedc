// components/ROIDashboard.tsx
// Enhanced ROI Dashboard with yearly trends and cumulative analysis

'use client'

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import SimpleIcon from './SimpleIcon'
import ExportButton from './ExportButton'
import PDFExportButton from './PDFExportButton'
import { text, card, border, table, gradient, colors, badge } from '@/lib/styles'
import FormelTooltip from './FormelTooltip'

interface ROIDashboardProps {
  anlage: any
  monatsdaten: any[]
  investitionen: any[]
}

interface YearlyStats {
  jahr: number
  anzahlMonate: number // Für Unterjährigkeit
  erzeugung: number
  eigenverbrauch: number
  einspeisung: number
  einspeiseErloese: number
  eigenverbrauchEinsparung: number
  erloese: number // Gesamt: Einspeisung + EV-Einsparung
  kosten: number // Nur Betriebsausgaben
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

  // Gesamtinvestition berechnen aus Investitionen-Tabelle (nicht aus anlage!)
  // Nur Investitionen die zur aktuellen Anlage gehören (anlage_id)
  const anlageInvestitionen = investitionen.filter(inv => inv.anlage_id === anlage?.id)
  const gesamtInvestition = anlageInvestitionen.reduce((sum, inv) =>
    sum + toNum(inv.anschaffungskosten_gesamt), 0)

  // Gruppiere Monatsdaten nach Jahr
  const yearlyData: Record<number, any[]> = {}
  monatsdaten.forEach(m => {
    if (!yearlyData[m.jahr]) {
      yearlyData[m.jahr] = []
    }
    yearlyData[m.jahr].push(m)
  })

  // Gesamtzahl der erfassten Monate für korrekte Durchschnittsberechnung
  const gesamtMonate = monatsdaten.length

  // Berechne Jahresstatistiken
  const yearlyStats: YearlyStats[] = []
  let kumuliertErtrag = 0

  Object.keys(yearlyData)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(jahr => {
      const jahresMonatsdaten = yearlyData[parseInt(jahr)]
      const anzahlMonate = jahresMonatsdaten.length // Für Unterjährigkeits-Anzeige

      const erzeugung = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.pv_erzeugung_kwh), 0)
      const eigenverbrauch = jahresMonatsdaten.reduce((sum, m) =>
        sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0)
      const einspeisung = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_kwh), 0)

      // Einspeise-Erlöse
      const einspeiseErloese = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_ertrag_euro), 0)

      // Eigenverbrauch-Einsparung = gesparter Netzbezug durch Eigenverbrauch
      // Berechnung: Eigenverbrauch * durchschnittlicher Netzbezugspreis
      const durchschnittNetzbezugPreis = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.netzbezug_preis_cent_kwh), 0) / anzahlMonate
      const eigenverbrauchEinsparung = eigenverbrauch * durchschnittNetzbezugPreis / 100

      // Gesamterlöse = Einspeise-Erlöse + Eigenverbrauch-Einsparung
      const erloese = einspeiseErloese + eigenverbrauchEinsparung

      // Nur Betriebsausgaben als Kosten (NICHT Netzbezugskosten!)
      const betriebsausgaben = jahresMonatsdaten.reduce((sum, m) => sum + toNum(m.betriebsausgaben_monat_euro), 0)

      // Netto-Ertrag = Erlöse - Betriebsausgaben
      const nettoErtrag = erloese - betriebsausgaben
      kumuliertErtrag += nettoErtrag

      const paybackProgress = gesamtInvestition > 0
        ? (kumuliertErtrag / gesamtInvestition) * 100
        : 0

      yearlyStats.push({
        jahr: parseInt(jahr),
        anzahlMonate,
        erzeugung,
        eigenverbrauch,
        einspeisung,
        einspeiseErloese,
        eigenverbrauchEinsparung,
        erloese,
        kosten: betriebsausgaben,
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

  // Amortisationsfortschritt in Prozent
  const paybackProgress = gesamtInvestition > 0
    ? Math.min((gesamtErtrag / gesamtInvestition) * 100, 100)
    : 0

  // Hochrechnung bis Amortisation - basierend auf Monaten für korrekte Unterjährigkeitsberechnung
  const durchschnittErtragProMonat = gesamtMonate > 0
    ? yearlyStats.reduce((sum, y) => sum + y.nettoErtrag, 0) / gesamtMonate
    : 0
  const durchschnittErtragProJahr = durchschnittErtragProMonat * 12

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
          <h2 className={`${text.h1} flex items-center gap-2 mb-2`}>
            <SimpleIcon type="trend" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            ROI-Analyse & Wirtschaftlichkeit
          </h2>
          <p className={text.sm}>
            Detaillierte Analyse der Investitionsrendite seit {yearlyStats[0]?.jahr || 'Inbetriebnahme'}
          </p>
        </div>
        <div className="flex gap-2">
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
          <PDFExportButton
            data={yearlyStats}
            filename={`ROI_Analyse_${new Date().toISOString().split('T')[0]}`}
            title="ROI-Analyse & Wirtschaftlichkeit"
            headers={['Jahr', 'Erzeugung (kWh)', 'Erlöse (€)', 'Kosten (€)', 'Netto-Ertrag (€)', 'Kumuliert (€)', 'Fortschritt (%)']}
            mapDataToRow={(year) => [
              year.jahr.toString(),
              year.erzeugung.toFixed(2),
              year.erloese.toFixed(2),
              year.kosten.toFixed(2),
              year.nettoErtrag.toFixed(2),
              year.kumuliertErtrag.toFixed(2),
              year.paybackProgress.toFixed(2) + '%'
            ]}
            summary={[
              { label: 'Gesamtertrag', value: fmtDec(gesamtErtrag) + ' €' },
              { label: 'Investition', value: fmtDec(gesamtInvestition) + ' €' },
              { label: 'Amortisation', value: fmtDec(paybackProgress) + '%' },
            ]}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={card.padded}>
          <FormelTooltip
            formel="Summe aller Jahres-Nettoerträge"
            berechnung={`${yearlyStats.length} Jahre × Ø ${fmt(durchschnittErtragProJahr)} €`}
            ergebnis={`= ${fmtDec(gesamtErtrag)} €`}
          >
            <div className={`${text.sm} mb-1`}>Gesamtertrag</div>
            <div className={`text-2xl ${colors.positiveBold}`}>{fmtDec(gesamtErtrag)} €</div>
            <div className={`${text.xs} mt-1`}>
              seit {yearlyStats.length} Jahr{yearlyStats.length !== 1 ? 'en' : ''} ({gesamtMonate} Monate)
            </div>
          </FormelTooltip>
        </div>

        <div className={card.padded}>
          <FormelTooltip
            formel="Verbleibende Investition ÷ Ø Ertrag/Jahr"
            berechnung={`${fmtDec(verbleibendeInvestition)} € ÷ ${fmt(durchschnittErtragProJahr)} €`}
            ergebnis={istAmortisiert ? 'Bereits amortisiert!' : `= ${fmtDec(verbleibendeJahre)} Jahre`}
          >
            <div className={`${text.sm} mb-1`}>Amortisation</div>
            <div className={`text-2xl font-bold ${istAmortisiert ? 'text-green-700 dark:text-green-400' : colors.accent}`}>
              {istAmortisiert ? '✓ Erreicht' : `${fmtDec(verbleibendeJahre)} J.`}
            </div>
            <div className={`${text.xs} mt-1`}>
              {istAmortisiert ? `+${fmtDec(gesamtErtrag - gesamtInvestition)} € Gewinn` : 'bis Payback'}
            </div>
          </FormelTooltip>
        </div>

        <div className={card.padded}>
          <FormelTooltip
            formel="Gesamtertrag ÷ Anzahl Monate × 12"
            berechnung={`${fmtDec(gesamtErtrag)} € ÷ ${gesamtMonate} × 12`}
            ergebnis={`= ${fmt(durchschnittErtragProJahr)} €/Jahr`}
          >
            <div className={`${text.sm} mb-1`}>Ø Ertrag/Jahr</div>
            <div className={`text-2xl ${colors.accentBold}`}>{fmt(durchschnittErtragProJahr)} €</div>
            <div className={`${text.xs} mt-1`}>
              {yoyWachstum !== 0 && letzesJahr ? (
                <span className={yoyWachstum > 0 ? colors.positive : colors.negative}>
                  {yoyWachstum > 0 ? '+' : ''}{fmtDec(yoyWachstum)}% YoY
                </span>
              ) : (
                'Durchschnitt'
              )}
            </div>
          </FormelTooltip>
        </div>

        <div className={card.padded}>
          <FormelTooltip
            formel="Gesamtertrag ÷ Investition × 100"
            berechnung={`${fmtDec(gesamtErtrag)} € ÷ ${fmt(gesamtInvestition)} € × 100`}
            ergebnis={`= ${fmtDec((gesamtErtrag / gesamtInvestition) * 100)}%`}
          >
            <div className={`${text.sm} mb-1`}>ROI aktuell</div>
            <div className={`text-2xl ${colors.specialBold}`}>
              {fmtDec((gesamtErtrag / gesamtInvestition) * 100)}%
            </div>
            <div className={`${text.xs} mt-1`}>
              von {fmt(gesamtInvestition)} €
            </div>
          </FormelTooltip>
        </div>
      </div>

      {/* Payback Progress Bar */}
      <div className={card.padded}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={text.h3}>Amortisations-Fortschritt</h3>
          <span className={`text-sm font-medium ${text.secondary}`}>
            {fmtDec(Math.min((gesamtErtrag / gesamtInvestition) * 100, 100))}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
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
          <div className={`mt-3 flex items-center gap-2 ${colors.positive}`}>
            <SimpleIcon type="check" className="w-5 h-5" />
            <span className="font-medium">
              Investition amortisiert! {fmtDec(gesamtErtrag - gesamtInvestition)} € Gewinn
            </span>
          </div>
        )}
      </div>

      {/* Cumulative Savings Chart */}
      <div className={card.padded}>
        <h3 className={`${text.h3} mb-4 flex items-center gap-2`}>
          <SimpleIcon type="chart" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
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
      <div className={card.padded}>
        <h3 className={`${text.h3} mb-4 flex items-center gap-2`}>
          <SimpleIcon type="trend" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
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
      <div className={card.overflow}>
        <div className={`px-6 py-4 border-b ${border.default}`}>
          <h3 className={`${text.h3} flex items-center gap-2`}>
            <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Jahresübersicht
          </h3>
        </div>
        <div className={table.wrapper}>
          <table className={table.base}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Jahr</th>
                <th className={table.thRight}>Monate</th>
                <th className={table.thRight}>Erzeugung</th>
                <th className={table.thRight}>EV-Einsparung</th>
                <th className={table.thRight}>Einspeisung</th>
                <th className={table.thRight}>Betriebsk.</th>
                <th className={table.thRight}>Netto</th>
                <th className={table.thRight}>Kumuliert</th>
                <th className={table.thRight}>Fortschritt</th>
              </tr>
            </thead>
            <tbody className={table.tbody}>
              {yearlyStats.map((year) => (
                <tr key={year.jahr} className={table.tr}>
                  <td className={`${table.td} font-medium`}>
                    {year.jahr}
                  </td>
                  <td className={`${table.tdRight} ${year.anzahlMonate < 12 ? 'text-orange-600' : ''}`}>
                    {year.anzahlMonate}{year.anzahlMonate < 12 ? '*' : ''}
                  </td>
                  <td className={table.tdRight}>
                    {fmt(year.erzeugung)} kWh
                  </td>
                  <td className={`${table.tdRight} ${colors.positive}`}>
                    {fmtDec(year.eigenverbrauchEinsparung)} €
                  </td>
                  <td className={`${table.tdRight} ${colors.positive}`}>
                    {fmtDec(year.einspeiseErloese)} €
                  </td>
                  <td className={`${table.tdRight} ${colors.negative}`}>
                    {fmtDec(year.kosten)} €
                  </td>
                  <td className={`${table.tdRight} ${colors.accentBold}`}>
                    {fmtDec(year.nettoErtrag)} €
                  </td>
                  <td className={`${table.tdRight} font-medium`}>
                    {fmtDec(year.kumuliertErtrag)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className={year.paybackProgress >= 100 ? badge.success : badge.info}>
                      {fmtDec(year.paybackProgress)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Legende für unterjährige Jahre */}
        {yearlyStats.some(y => y.anzahlMonate < 12) && (
          <div className={`px-6 py-3 border-t ${border.default} ${text.xs}`}>
            <span className="text-orange-600">*</span> Unterjährig erfasst (weniger als 12 Monate). Der Ø Ertrag/Jahr wird korrekt auf Basis aller erfassten Monate hochgerechnet.
          </div>
        )}
      </div>

      {/* Berechnungs-Erläuterung */}
      <div className={`${gradient.infoBox} rounded-lg p-4`}>
        <h4 className={`${text.sm} font-medium mb-2`}>Berechnungsgrundlage</h4>
        <div className={`${text.xs} space-y-1`}>
          <div><strong>EV-Einsparung:</strong> Eigenverbrauch × Netzbezugspreis (gesparter Stromeinkauf)</div>
          <div><strong>Einspeisung:</strong> Eingespeiste kWh × Einspeisevergütung</div>
          <div><strong>Netto-Ertrag:</strong> EV-Einsparung + Einspeisung − Betriebskosten</div>
          <div className="text-gray-500 italic mt-2">Netzbezugskosten werden nicht abgezogen, da diese auch ohne PV-Anlage anfallen würden.</div>
        </div>
      </div>

      {/* Investment Breakdown */}
      {investitionen.length > 0 && (
        <div className={`${gradient.infoBox} rounded-lg p-6`}>
          <h3 className={`${text.h3} mb-4 flex items-center gap-2`}>
            <SimpleIcon type="gem" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Investitionsübersicht
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={card.inner}>
              <div className={text.sm}>PV-Anlage</div>
              <div className={`text-xl font-bold ${text.primary}`}>{fmt(gesamtInvestition)} €</div>
              <div className={`${text.xs} mt-1`}>Hauptinvestition</div>
            </div>
            <div className={card.inner}>
              <div className={text.sm}>Zusatzinvestitionen</div>
              <div className={`text-xl font-bold ${text.primary}`}>
                {fmt(investitionen.reduce((sum, inv) => sum + (inv.anschaffungskosten_relevant || 0), 0))} €
              </div>
              <div className={`${text.xs} mt-1`}>{investitionen.length} Positionen</div>
            </div>
            <div className={card.inner}>
              <div className={text.sm}>Gesamtinvestition</div>
              <div className={`text-xl ${colors.accentBold}`}>
                {fmt(
                  gesamtInvestition +
                  investitionen.reduce((sum, inv) => sum + (inv.anschaffungskosten_relevant || 0), 0)
                )} €
              </div>
              <div className={`${text.xs} mt-1`}>Inklusive Zusätze</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
