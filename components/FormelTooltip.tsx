// components/FormelTooltip.tsx
// Tooltip-Komponente zur Anzeige von Berechnungsformeln

'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface FormelTooltipProps {
  children: ReactNode
  formel: string           // Die Formel als Text, z.B. "Eigenverbrauch × Netzbezugspreis"
  berechnung?: string      // Konkrete Berechnung, z.B. "150 kWh × 0,30 €/kWh"
  ergebnis?: string        // Ergebnis, z.B. "= 45,00 €"
  className?: string
}

export default function FormelTooltip({
  children,
  formel,
  berechnung,
  ergebnis,
  className = ''
}: FormelTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom'>('top')
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // Wenn weniger als 120px Platz oben, zeige unten
      setPosition(rect.top < 120 ? 'bottom' : 'top')
    }
  }, [isVisible])

  return (
    <span
      ref={triggerRef}
      className={`relative inline-block cursor-help ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {/* Info-Icon als Hinweis */}
      <svg
        className="inline-block w-3.5 h-3.5 ml-1 text-gray-400 opacity-60"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg whitespace-nowrap
            ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            left-1/2 -translate-x-1/2
          `}
          style={{ minWidth: '200px', maxWidth: '350px', whiteSpace: 'normal' }}
        >
          {/* Pfeil */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0
              border-l-[6px] border-l-transparent
              border-r-[6px] border-r-transparent
              ${position === 'top'
                ? 'top-full border-t-[6px] border-t-gray-900'
                : 'bottom-full border-b-[6px] border-b-gray-900'
              }
            `}
          />

          {/* Inhalt */}
          <div className="space-y-1">
            <div className="font-medium text-yellow-300 text-xs uppercase tracking-wide">
              Formel
            </div>
            <div className="text-gray-100">
              {formel}
            </div>

            {berechnung && (
              <>
                <div className="font-medium text-blue-300 text-xs uppercase tracking-wide mt-2">
                  Berechnung
                </div>
                <div className="text-gray-200 font-mono text-xs">
                  {berechnung}
                </div>
              </>
            )}

            {ergebnis && (
              <div className="text-green-300 font-semibold mt-1 border-t border-gray-700 pt-1">
                {ergebnis}
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  )
}

// Hilfsfunktion zum Formatieren von Zahlen in Tooltips
export function fmtCalc(num: number | null | undefined, decimals = 2): string {
  if (num === null || num === undefined) return '?'
  return num.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

// Vereinfachte Variante nur mit Formel
interface SimpleTooltipProps {
  children: ReactNode
  text: string
  className?: string
  position?: 'auto' | 'top' | 'bottom'
}

export function SimpleTooltip({ children, text, className = '', position: fixedPosition = 'auto' }: SimpleTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom')
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()

      // Berechne Position - im Header immer unten anzeigen
      if (fixedPosition === 'auto') {
        // Wenn weniger als 60px Platz oben, zeige unten
        setPosition(rect.top < 60 ? 'bottom' : 'top')
      } else {
        setPosition(fixedPosition)
      }

      // Fixed positioning für Portal-ähnliches Verhalten
      setCoords({
        top: position === 'bottom' ? rect.bottom + 6 : rect.top - 6,
        left: rect.left + rect.width / 2
      })
    }
  }, [isVisible, fixedPosition, position])

  return (
    <span
      ref={triggerRef}
      className={`relative inline-block cursor-help ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {isVisible && (
        <div
          className="fixed z-[9999] px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg whitespace-nowrap"
          style={{
            top: position === 'bottom' ? coords.top : 'auto',
            bottom: position === 'top' ? `calc(100vh - ${coords.top}px)` : 'auto',
            left: coords.left,
            transform: 'translateX(-50%)'
          }}
        >
          {text}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0
              border-l-[4px] border-l-transparent
              border-r-[4px] border-r-transparent
              ${position === 'top'
                ? 'top-full border-t-[4px] border-t-gray-800'
                : 'bottom-full border-b-[4px] border-b-gray-800'
              }`}
          />
        </div>
      )}
    </span>
  )
}
