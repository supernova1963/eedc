// components/ModernSidebar.tsx
// Moderne, skalierbare Sidebar mit Baumstruktur

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SimpleIcon from './SimpleIcon'
import { createBrowserClient } from '@/lib/supabase-browser'

interface NavItem {
  label: string
  href?: string
  icon: string
  children?: NavItem[]
  badge?: number
}

interface ModernSidebarProps {
  userName?: string
  userEmail?: string
}

export default function ModernSidebar({ userName, userEmail }: ModernSidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Meine Anlage', 'Community']))

  // Dynamische Investitionen
  const [eAutos, setEAutos] = useState<any[]>([])
  const [waermepumpen, setWaermepumpen] = useState<any[]>([])
  const [speicher, setSpeicher] = useState<any[]>([])

  // Lade Komponenten für dynamisches Menü (FRESH-START Schema)
  useEffect(() => {
    const loadKomponenten = async () => {
      const supabase = createBrowserClient()

      // E-Autos und Wärmepumpen aus haushalt_komponenten
      const { data: eAutosData } = await supabase
        .from('haushalt_komponenten')
        .select('id, bezeichnung')
        .eq('typ', 'e-auto')
        .eq('aktiv', true)
        .order('bezeichnung')

      const { data: wpData } = await supabase
        .from('haushalt_komponenten')
        .select('id, bezeichnung')
        .eq('typ', 'waermepumpe')
        .eq('aktiv', true)
        .order('bezeichnung')

      // Speicher aus anlagen_komponenten
      const { data: speicherData } = await supabase
        .from('anlagen_komponenten')
        .select('id, bezeichnung')
        .eq('typ', 'speicher')
        .eq('aktiv', true)
        .order('bezeichnung')

      setEAutos(eAutosData || [])
      setWaermepumpen(wpData || [])
      setSpeicher(speicherData || [])
    }

    loadKomponenten()
  }, [])

  // Navigation Structure
  const navItems: NavItem[] = [
    // === COMMUNITY (ÖFFENTLICH) ===
    {
      label: 'Community',
      icon: 'users',
      children: [
        { label: 'Dashboard', href: '/', icon: 'home' },
        { label: 'Alle Anlagen', href: '/community', icon: 'globe' },
        { label: 'Vergleich', href: '/community/vergleich', icon: 'chart' },
        { label: 'Regional', href: '/community/regional', icon: 'map' },
        { label: 'Bestenliste', href: '/community/bestenliste', icon: 'trophy' },
      ]
    },

    // === MEINE ANLAGE (AUTH REQUIRED) ===
    {
      label: 'Meine Anlage',
      icon: 'solar',
      children: [
        { label: 'Dashboard', href: '/meine-anlage', icon: 'home' },
        { label: 'Daten erfassen', href: '/eingabe', icon: 'edit' },
        { label: 'Daten Import', href: '/daten-import', icon: 'upload' },
        { label: 'Übersicht', href: '/uebersicht', icon: 'list' },
        { label: 'Investitionen', href: '/investitionen', icon: 'briefcase' },
        {
          label: 'Auswertungen',
          icon: 'chart',
          children: [
            { label: 'Gesamt', href: '/auswertung?tab=gesamt', icon: 'home' },
            { label: 'PV-Anlage', href: '/auswertung?tab=pv', icon: 'solar' },
            ...(eAutos.length > 0 ? [{
              label: 'E-Auto',
              icon: 'car',
              children: eAutos.map(auto => ({
                label: auto.bezeichnung,
                href: `/auswertung?tab=e-auto&auto=${auto.id}`,
                icon: 'car'
              }))
            }] : []),
            ...(waermepumpen.length > 0 ? [{
              label: 'Wärmepumpe',
              icon: 'heat',
              children: waermepumpen.map(wp => ({
                label: wp.bezeichnung,
                href: `/auswertung?tab=waermepumpe&wp=${wp.id}`,
                icon: 'heat'
              }))
            }] : []),
            ...(speicher.length > 0 ? [{
              label: 'Speicher',
              icon: 'battery',
              children: speicher.map(sp => ({
                label: sp.bezeichnung,
                href: `/auswertung?tab=speicher&speicher=${sp.id}`,
                icon: 'battery'
              }))
            }] : []),
            { label: 'ROI-Analyse', href: '/auswertung?tab=roi', icon: 'chart' },
            { label: 'CO₂-Impact', href: '/auswertung?tab=co2', icon: 'leaf' },
            { label: 'Prognose vs. IST', href: '/auswertung?tab=prognose', icon: 'trend' },
          ]
        },
        {
          label: 'Stammdaten',
          icon: 'clipboard',
          children: [
            { label: 'Übersicht', href: '/stammdaten', icon: 'list' },
            { label: 'Strompreise', href: '/stammdaten/strompreise', icon: 'lightning' },
            { label: 'Zuordnung', href: '/stammdaten/zuordnung', icon: 'link' },
            { label: 'Anlage', href: '/anlage', icon: 'settings' },
          ]
        },
      ]
    },
  ]

  const toggleSection = (label: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  const isActive = (href?: string) => {
    if (!href) return false
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const renderNavItem = (item: NavItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedSections.has(item.label)
    const active = isActive(item.href)

    const paddingLeft = `${(level + 1) * 0.75}rem`

    if (hasChildren) {
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleSection(item.label)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            style={{ paddingLeft }}
          >
            <div className="flex items-center gap-3">
              <SimpleIcon type={item.icon} className="w-5 h-5" />
              <span>{item.label}</span>
            </div>
            <SimpleIcon
              type="chevron-down"
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {isExpanded && (
            <div className="mt-1 space-y-1">
              {item.children?.map(child => renderNavItem(child, level + 1))}
            </div>
          )}
        </div>
      )
    }

    if (!item.href) return null

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
          active
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft }}
        onClick={() => setIsOpen(false)}
      >
        <SimpleIcon type={item.icon} className="w-5 h-5" />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-lg"
      >
        <SimpleIcon type={isOpen ? 'close' : 'menu'} className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static
          flex flex-col
        `}
      >
        {/* User Section */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {userName || 'Benutzer'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {userEmail}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map(item => renderNavItem(item))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <Link
            href="/logout"
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <SimpleIcon type="logout" className="w-5 h-5" />
            <span>Abmelden</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
