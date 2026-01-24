// components/MobileHeader.tsx
// Mobile Header mit Hamburger-Button

'use client'

import SimpleIcon from './SimpleIcon'

interface MobileHeaderProps {
  onMenuClick: () => void
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-16 bg-white border-b border-gray-200">
      <div className="h-full flex items-center justify-between px-4">
        {/* Hamburger Button */}
        <button
          onClick={onMenuClick}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
          aria-label="Menü öffnen"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <SimpleIcon type="sun" className="w-6 h-6 text-yellow-500" />
          <span className="text-lg font-bold text-gray-900">EEDC</span>
        </div>

        {/* Platzhalter für Balance (optional) */}
        <div className="w-10"></div>
      </div>
    </header>
  )
}
