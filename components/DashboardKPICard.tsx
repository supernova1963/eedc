// components/DashboardKPICard.tsx
// KPI-Karte für Dashboard mit Tooltip-Unterstützung

'use client'

import { ReactNode } from 'react'
import FormelTooltip, { fmtCalc } from './FormelTooltip'
import SimpleIcon from './SimpleIcon'

interface DashboardKPICardProps {
  label: string
  value: string | number
  unit?: string
  icon: string
  iconColor: string
  textColor?: string
  // Tooltip für Berechnungserklärung
  formel?: string
  berechnung?: string
  ergebnis?: string
}

export default function DashboardKPICard({
  label,
  value,
  unit = '',
  icon,
  iconColor,
  textColor = 'text-gray-900',
  formel,
  berechnung,
  ergebnis
}: DashboardKPICardProps) {
  const displayValue = typeof value === 'number'
    ? value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : value

  const content = (
    <p className={`text-2xl font-bold ${textColor} mt-1`}>
      {displayValue}{unit && ` ${unit}`}
    </p>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          {formel ? (
            <FormelTooltip
              formel={formel}
              berechnung={berechnung}
              ergebnis={ergebnis}
            >
              {content}
            </FormelTooltip>
          ) : (
            content
          )}
        </div>
        <SimpleIcon type={icon} className={`w-12 h-12 ${iconColor}`} />
      </div>
    </div>
  )
}

// Spezielle Variante für Finanzkennzahlen (mit grüner/roter Farbe)
interface FinanceKPICardProps {
  label: string
  value: number
  icon: string
  iconColor: string
  formel?: string
  berechnung?: string
  ergebnis?: string
}

export function FinanceKPICard({
  label,
  value,
  icon,
  iconColor,
  formel,
  berechnung,
  ergebnis
}: FinanceKPICardProps) {
  const isPositive = value >= 0
  const textColor = isPositive ? 'text-green-700' : 'text-red-700'
  const displayValue = `${isPositive ? '+' : ''}${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

  const content = (
    <p className={`text-2xl font-bold ${textColor} mt-1`}>
      {displayValue}
    </p>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          {formel ? (
            <FormelTooltip
              formel={formel}
              berechnung={berechnung}
              ergebnis={ergebnis}
            >
              {content}
            </FormelTooltip>
          ) : (
            content
          )}
        </div>
        <SimpleIcon type={icon} className={`w-12 h-12 ${iconColor}`} />
      </div>
    </div>
  )
}
