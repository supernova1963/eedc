// components/Breadcrumb.tsx
// Breadcrumb-Navigation für Orientierung

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { text } from '@/lib/styles'

const routeNames: Record<string, string> = {
  '': 'Dashboard',
  'eingabe': 'Daten erfassen',
  'investitionen': 'Investitionen',
  'neu': 'Neu',
  'bearbeiten': 'Bearbeiten',
  'stammdaten': 'Stammdaten',
  'strompreise': 'Strompreise',
  'zuordnung': 'Investitions-Zuordnung',
  'investitionstypen': 'Investitionstypen',
  'auswertung': 'Auswertungen',
  'anlage': 'Anlagen',
  'uebersicht': 'Übersicht',
  'community': 'Community',
  'datenschutz': 'Datenschutz',
  'debug': 'Debug',
  'meine-anlage': 'Meine Anlage',
  'daten-import': 'Daten Import',
}

export default function Breadcrumb() {
  const pathname = usePathname()

  // Split path und filtere leere Segmente
  const segments = pathname.split('/').filter(Boolean)

  // Wenn wir auf der Startseite sind
  if (segments.length === 0) {
    return null // Kein Breadcrumb auf Dashboard
  }

  // Erstelle Breadcrumb-Items
  const breadcrumbs = [
    { label: 'Dashboard', href: '/' },
    ...segments.map((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/')
      const label = routeNames[segment] || segment
      return { label, href }
    })
  ]

  return (
    <nav className={`flex items-center space-x-2 ${text.sm} mb-4`}>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center">
          {index > 0 && (
            <span className={`mx-2 ${text.muted}`}>›</span>
          )}
          {index === breadcrumbs.length - 1 ? (
            // Letzter Breadcrumb (aktuelle Seite)
            <span className={`${text.primary} font-medium`}>
              {crumb.label}
            </span>
          ) : (
            // Link für vorherige Breadcrumbs
            <Link
              href={crumb.href}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
