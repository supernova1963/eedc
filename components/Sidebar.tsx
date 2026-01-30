// components/Sidebar.tsx
// Globale Sidebar-Navigation

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useMemo } from 'react'
import SimpleIcon from './SimpleIcon'
import { useInvestitionsFilter } from '@/hooks/useInvestitionsFilter'
import { signOut } from '@/lib/auth-actions'

interface NavItem {
  icon: string
  label: string
  href: string
  badge?: string
  children?: NavItem[]
}

// Basis-Navigation (wird dynamisch gefiltert basierend auf Investitionen)
const getNavigation = (hasEAutos: boolean, hasWaermepumpen: boolean, hasSpeicher: boolean, hasInvestitionen: boolean): NavItem[] => {
  // Auswertungen-Untermenü dynamisch zusammenstellen
  const auswertungenChildren: NavItem[] = [
    { icon: 'sun', label: 'PV-Anlage', href: '/auswertung?tab=pv' },
  ]

  // Nur wenn entsprechende Investitionen vorhanden sind
  if (hasEAutos) {
    auswertungenChildren.push({ icon: 'car', label: 'E-Auto', href: '/auswertung?tab=e-auto' })
  }
  if (hasWaermepumpen) {
    auswertungenChildren.push({ icon: 'heat', label: 'Wärmepumpe', href: '/auswertung?tab=waermepumpe' })
  }
  if (hasSpeicher) {
    auswertungenChildren.push({ icon: 'battery', label: 'Speicher', href: '/auswertung?tab=speicher' })
  }
  if (hasInvestitionen) {
    auswertungenChildren.push({ icon: 'gem', label: 'Gesamtbilanz', href: '/auswertung?tab=gesamt' })
  }

  // Immer verfügbare Auswertungen
  auswertungenChildren.push(
    { icon: 'trend', label: 'ROI-Analyse', href: '/auswertung?tab=roi' },
    { icon: 'globe', label: 'CO₂-Impact', href: '/auswertung?tab=co2' },
    { icon: 'target', label: 'Prognose vs. IST', href: '/auswertung?tab=prognose' },
    { icon: 'calendar', label: 'Monats-Details', href: '/auswertung?tab=monatsdetail' },
    { icon: 'bulb', label: 'Optimierung', href: '/auswertung?tab=optimierung' }
  )

  return [
    {
      icon: 'dashboard',
      label: 'Dashboard',
      href: '/'
    },
    {
      icon: 'input',
      label: 'Daten erfassen',
      href: '/eingabe'
    },
    {
      icon: 'upload',
      label: 'Daten importieren',
      href: '/daten-import',
      badge: 'NEU'
    },
    {
      icon: 'briefcase',
      label: 'Investitionen',
      href: '/investitionen'
    },
    {
      icon: 'clipboard',
      label: 'Stammdaten',
      href: '/stammdaten',
      children: [
        { icon: 'file', label: 'Übersicht', href: '/stammdaten' },
        { icon: 'lightning', label: 'Strompreise', href: '/stammdaten/strompreise' },
        { icon: 'link', label: 'Zuordnung', href: '/stammdaten/zuordnung' },
      ]
    },
    {
      icon: 'trend',
      label: 'Auswertungen',
      href: '/auswertung',
      children: auswertungenChildren
    },
    {
      icon: 'globe',
      label: 'Community',
      href: '/community',
      badge: 'NEU'
    },
    {
      icon: 'settings',
      label: 'Anlagen',
      href: '/anlage'
    },
  ]
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(['/stammdaten', '/auswertung'])

  // Dynamische Investitions-Filter laden
  const { hasEAutos, hasWaermepumpen, hasSpeicher, hasInvestitionen } = useInvestitionsFilter()

  // Navigation basierend auf vorhandenen Investitionen generieren
  const navigation = useMemo(
    () => getNavigation(hasEAutos, hasWaermepumpen, hasSpeicher, hasInvestitionen),
    [hasEAutos, hasWaermepumpen, hasSpeicher, hasInvestitionen]
  )

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    // Bei Untermenü-Items mit Query-Parametern auch die aktuelle URL prüfen
    if (href.includes('?')) {
      return (typeof window !== 'undefined' && window.location.href.includes(href))
    }
    return pathname.startsWith(href)
  }

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev =>
      prev.includes(href)
        ? prev.filter(item => item !== href)
        : [...prev, href]
    )
  }

  const isExpanded = (href: string) => {
    return expandedItems.includes(href) || pathname.startsWith(href)
  }

  return (
    <>
      {/* Overlay für Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative top-0 left-0 z-50 lg:z-0 h-full w-64 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out lg:transform-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
          <Link href="/" className="flex items-center gap-2">
            <SimpleIcon type="sun" className="w-7 h-7 text-yellow-500" />
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">EEDC</span>
          </Link>
          {/* Close Button (nur Mobile) */}
          <button
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.href}>
                {/* Haupt-Item */}
                <div>
                  {item.children ? (
                    // Item mit Untermenü
                    <button
                      onClick={() => toggleExpanded(item.href)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium
                        transition-colors
                        ${isActive(item.href)
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <span className="flex items-center gap-3">
                        <SimpleIcon type={item.icon} className="w-5 h-5" />
                        <span>{item.label}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {item.badge && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded-full">
                            {item.badge}
                          </span>
                        )}
                        <span className={`text-xs transition-transform ${isExpanded(item.href) ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                      </span>
                    </button>
                  ) : (
                    // Normaler Link
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose()
                      }}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                        transition-colors
                        ${isActive(item.href)
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <SimpleIcon type={item.icon} className="w-5 h-5" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )}
                </div>

                {/* Untermenü */}
                {item.children && isExpanded(item.href) && (
                  <ul className="mt-1 ml-4 pl-4 border-l-2 border-gray-200 space-y-1">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={() => {
                            if (window.innerWidth < 1024) onClose()
                          }}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-md text-sm
                            transition-colors
                            ${pathname === child.href
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }
                          `}
                        >
                          <SimpleIcon type={child.icon} className="w-4 h-4" />
                          <span>{child.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 space-y-2">
          <button
            onClick={async () => {
              await signOut()
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <SimpleIcon type="logout" className="w-4 h-4" />
            <span>Abmelden</span>
          </button>
          <div className="text-xs text-gray-500 text-center">
            EEDC v1.0
          </div>
        </div>
      </aside>
    </>
  )
}
