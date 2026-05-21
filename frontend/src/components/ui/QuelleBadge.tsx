/**
 * QuelleBadge — kleines Herkunfts-Etikett für Speicher-KPIs (Etappe C, #264).
 *
 * Macht für effektiven Ladepreis und η-IST transparent, woher der Wert stammt
 * bzw. warum er nur informativ ist. Roh-Enum-Werte gehören nie in die UI —
 * die Labels kommen aus `lib/constants`. Belastbare Quellen bekommen ein
 * neutrales Grau, weniger belastbare ein Amber-Badge.
 */

import {
  LADEPREIS_QUELLE_LABELS,
  WIRKUNGSGRAD_QUELLE_LABELS,
  QUELLE_BELASTBAR,
} from '../../lib/constants'

interface QuelleBadgeProps {
  quelle: string
  kind: 'ladepreis' | 'wirkungsgrad'
  className?: string
}

export default function QuelleBadge({ quelle, kind, className = '' }: QuelleBadgeProps) {
  const labels = kind === 'ladepreis' ? LADEPREIS_QUELLE_LABELS : WIRKUNGSGRAD_QUELLE_LABELS
  const belastbar = QUELLE_BELASTBAR.has(quelle)
  return (
    <span
      className={`inline-block text-[10px] leading-tight px-1.5 py-0.5 rounded font-medium ${
        belastbar
          ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      } ${className}`}
    >
      {labels[quelle] ?? quelle}
    </span>
  )
}
