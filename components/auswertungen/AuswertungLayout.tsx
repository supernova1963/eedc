// components/auswertungen/AuswertungLayout.tsx
// Gemeinsames Layout für alle Investitions-Auswertungen

'use client'

import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'

interface AuswertungLayoutProps {
  title: string
  subtitle?: string
  icon: string
  iconColor: string
  erfassungsLink: string
  children: React.ReactNode
}

export default function AuswertungLayout({
  title,
  subtitle,
  icon,
  iconColor,
  erfassungsLink,
  children
}: AuswertungLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SimpleIcon type={icon} className={`w-6 h-6 ${iconColor}`} />
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <Link
          href={erfassungsLink}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white flex items-center gap-2"
        >
          <SimpleIcon type="plus" className="w-4 h-4" />
          Monat erfassen
        </Link>
      </div>

      {children}
    </div>
  )
}

// Gemeinsame KPI-Karte Komponente
interface KPICardProps {
  label: string
  value: string
  subtext?: string
  colorClass?: string
  bgClass?: string
}

export function KPICard({ label, value, subtext, colorClass = 'text-gray-900 dark:text-gray-100', bgClass = 'bg-white dark:bg-gray-800' }: KPICardProps) {
  return (
    <div className={`${bgClass} rounded-lg shadow p-4`}>
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  )
}

// Gemeinsame Header-KPI Komponente (4er Grid)
interface HeaderKPIsProps {
  kpis: Array<{
    label: string
    value: string
    subtext?: string
    colorClass?: string
  }>
}

export function HeaderKPIs({ kpis }: HeaderKPIsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  )
}

// Gemeinsame Bewertungs-Box
interface BewertungsBoxProps {
  bewertung: string
  details?: string
}

export function BewertungsBox({ bewertung, details }: BewertungsBoxProps) {
  const getColors = () => {
    if (bewertung === 'Besser als Prognose') return 'bg-green-50 border-green-200 text-green-900'
    if (bewertung === 'Im Rahmen der Prognose') return 'bg-blue-50 border-blue-200 text-blue-900'
    if (bewertung === 'Schlechter als Prognose') return 'bg-yellow-50 border-yellow-200 text-yellow-900'
    return 'bg-gray-50 border-gray-200 text-gray-900'
  }

  const getIcon = () => {
    if (bewertung === 'Besser als Prognose') return { type: 'check', color: 'text-green-600' }
    if (bewertung === 'Im Rahmen der Prognose') return { type: 'check', color: 'text-blue-600' }
    if (bewertung === 'Schlechter als Prognose') return { type: 'error', color: 'text-yellow-600' }
    return { type: 'info', color: 'text-gray-600' }
  }

  const icon = getIcon()

  return (
    <div className={`p-4 rounded-lg border ${getColors()}`}>
      <div className="flex items-center gap-2">
        <SimpleIcon type={icon.type} className={`w-6 h-6 ${icon.color}`} />
        <div>
          <div className="font-medium">{bewertung}</div>
          {details && <div className="text-sm opacity-80">{details}</div>}
        </div>
      </div>
    </div>
  )
}

// Hint/Tip Box
interface HintBoxProps {
  type: 'info' | 'success' | 'warning' | 'tip'
  title: string
  content: string
}

export function HintBox({ type, title, content }: HintBoxProps) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    tip: 'bg-purple-50 border-purple-200 text-purple-900'
  }

  const icons = {
    info: { type: 'info', color: 'text-blue-600' },
    success: { type: 'check', color: 'text-green-600' },
    warning: { type: 'error', color: 'text-yellow-600' },
    tip: { type: 'lightbulb', color: 'text-purple-600' }
  }

  const icon = icons[type]

  return (
    <div className={`p-4 rounded-lg border ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <SimpleIcon type={icon.type} className={`w-5 h-5 ${icon.color} mt-0.5`} />
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm mt-1">{content}</div>
        </div>
      </div>
    </div>
  )
}

// Leere Daten Anzeige
interface EmptyStateProps {
  message: string
  actionLabel: string
  actionLink: string
}

export function EmptyState({ message, actionLabel, actionLink }: EmptyStateProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
      <p className="text-gray-500 dark:text-gray-400 mb-4">{message}</p>
      <Link
        href={actionLink}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
      >
        <SimpleIcon type="plus" className="w-4 h-4" />
        {actionLabel}
      </Link>
    </div>
  )
}
