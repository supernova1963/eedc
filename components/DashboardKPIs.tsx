// components/DashboardKPIs.tsx
// Dashboard KPI-Grid mit Tooltips für Berechnungserklärungen

'use client'

import SimpleIcon from './SimpleIcon'
import FormelTooltip, { fmtCalc } from './FormelTooltip'

interface DashboardKPIsProps {
  // Energie-Werte
  gesamtVerbrauch: number
  gesamtErzeugung: number
  gesamtEigenverbrauch: number
  gesamtEinspeisung: number
  // Kennzahlen
  autarkiegrad: number
  eigenverbrauchsquote: number
  // Finanzen
  gesamtEinspeiseErloese: number
  eigenverbrauchEinsparung: number
  gesamtErsparnisPV: number
  gesamtBetriebsausgaben: number
  // Preise für Berechnung
  durchschnittNetzbezugPreis: number
  durchschnittEinspeisePreis: number
}

export default function DashboardKPIs({
  gesamtVerbrauch,
  gesamtErzeugung,
  gesamtEigenverbrauch,
  gesamtEinspeisung,
  autarkiegrad,
  eigenverbrauchsquote,
  gesamtEinspeiseErloese,
  eigenverbrauchEinsparung,
  gesamtErsparnisPV,
  gesamtBetriebsausgaben,
  durchschnittNetzbezugPreis,
  durchschnittEinspeisePreis
}: DashboardKPIsProps) {

  const fmt = (num: number) => num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  const fmtDec = (num: number) => num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      {/* Erste Reihe: Energie */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gesamt-Verbrauch */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gesamt-Verbrauch</p>
              <FormelTooltip
                formel="Eigenverbrauch + Netzbezug"
                berechnung={`${fmtCalc(gesamtEigenverbrauch, 0)} kWh + (Σ Netzbezug)`}
                ergebnis={`= ${fmtCalc(gesamtVerbrauch, 0)} kWh`}
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {fmt(gesamtVerbrauch)} kWh
                </p>
              </FormelTooltip>
            </div>
            <SimpleIcon type="plug" className="w-12 h-12 text-gray-400" />
          </div>
        </div>

        {/* PV-Erzeugung */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">PV-Erzeugung</p>
              <FormelTooltip
                formel="Einspeisung + Eigenverbrauch"
                berechnung={`${fmtCalc(gesamtEinspeisung, 0)} kWh + ${fmtCalc(gesamtEigenverbrauch, 0)} kWh`}
                ergebnis={`= ${fmtCalc(gesamtErzeugung, 0)} kWh`}
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {fmt(gesamtErzeugung)} kWh
                </p>
              </FormelTooltip>
            </div>
            <SimpleIcon type="sun" className="w-12 h-12 text-yellow-500" />
          </div>
        </div>

        {/* Eigenverbrauch */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Eigenverbrauch</p>
              <FormelTooltip
                formel="Σ (Direktverbrauch + Batterieentladung)"
                berechnung="Summe aller Monate"
                ergebnis={`= ${fmtCalc(gesamtEigenverbrauch, 0)} kWh (selbst genutzter PV-Strom)`}
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {fmt(gesamtEigenverbrauch)} kWh
                </p>
              </FormelTooltip>
            </div>
            <SimpleIcon type="home" className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        {/* Einspeisung */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Einspeisung</p>
              <FormelTooltip
                formel="Σ Einspeisung aller Monate"
                berechnung="Summe aus Zählerständen"
                ergebnis={`= ${fmtCalc(gesamtEinspeisung, 0)} kWh (ins Netz eingespeist)`}
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {fmt(gesamtEinspeisung)} kWh
                </p>
              </FormelTooltip>
            </div>
            <SimpleIcon type="lightning" className="w-12 h-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Zweite Reihe: Kennzahlen & Finanzen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Autarkie */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Ø Autarkie</p>
              <FormelTooltip
                formel="Eigenverbrauch ÷ Gesamtverbrauch × 100"
                berechnung={`${fmtCalc(gesamtEigenverbrauch, 0)} kWh ÷ ${fmtCalc(gesamtVerbrauch, 0)} kWh × 100`}
                ergebnis={`= ${fmtCalc(autarkiegrad, 1)}% (Anteil Selbstversorgung)`}
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {autarkiegrad.toFixed(0)}%
                </p>
              </FormelTooltip>
            </div>
            <SimpleIcon type="chart" className="w-12 h-12 text-purple-500" />
          </div>
        </div>

        {/* Einspeise-Erlöse */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Einspeise-Erlöse</p>
              <FormelTooltip
                formel="Σ (Einspeisung × Einspeisevergütung)"
                berechnung={`Summe aller Monate (Ø ${fmtCalc(durchschnittEinspeisePreis, 2)} ct/kWh)`}
                ergebnis={`= ${fmtCalc(gesamtEinspeiseErloese)} € (Vergütung vom Netzbetreiber)`}
              >
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                  {fmtDec(gesamtEinspeiseErloese)} €
                </p>
              </FormelTooltip>
            </div>
            <SimpleIcon type="money" className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        {/* Ersparnis PV */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Ersparnis PV</p>
              <FormelTooltip
                formel="EV-Einsparung + Einspeise-Erlöse − Betriebsausgaben"
                berechnung={`${fmtCalc(eigenverbrauchEinsparung)} € + ${fmtCalc(gesamtEinspeiseErloese)} € − ${fmtCalc(gesamtBetriebsausgaben)} €`}
                ergebnis={`= ${fmtCalc(gesamtErsparnisPV)} € (OHNE Netzbezugskosten!)`}
              >
                <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">
                  {fmtDec(gesamtErsparnisPV)} €
                </p>
              </FormelTooltip>
            </div>
            <SimpleIcon type="gem" className="w-12 h-12 text-green-500" />
          </div>
        </div>
      </div>

      {/* Info-Box zur Erklärung */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <SimpleIcon type="info" className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Hinweis zur Ersparnis:</strong> Die Eigenverbrauch-Einsparung von {fmtDec(eigenverbrauchEinsparung)} €
            errechnet sich aus {fmt(gesamtEigenverbrauch)} kWh × Ø {fmtCalc(durchschnittNetzbezugPreis, 2)} ct/kWh.
            Netzbezugskosten werden nicht abgezogen, da sie allgemeiner Haushaltsverbrauch sind.
          </div>
        </div>
      </div>
    </div>
  )
}
