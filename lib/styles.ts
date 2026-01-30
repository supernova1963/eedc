// lib/styles.ts
// Zentrale Style-Definitionen für konsistentes Dark Mode Theming
// EINE Stelle zum Ändern = konsistente UI

// =============================================================================
// CARDS & CONTAINERS
// =============================================================================
export const card = {
  base: 'bg-white dark:bg-gray-800 rounded-lg shadow',
  padded: 'bg-white dark:bg-gray-800 rounded-lg shadow p-6',
  paddedSm: 'bg-white dark:bg-gray-800 rounded-lg shadow p-4',
  bordered: 'bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700',
  overflow: 'bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden',
  inner: 'bg-white dark:bg-gray-700 rounded-lg p-4',
  innerSm: 'bg-white dark:bg-gray-700 rounded-lg p-3',
} as const

// =============================================================================
// TEXT
// =============================================================================
export const text = {
  // Primary text - für Überschriften und wichtigen Inhalt
  primary: 'text-gray-900 dark:text-gray-100',
  // Secondary text - für Beschreibungen
  secondary: 'text-gray-600 dark:text-gray-400',
  // Muted text - für weniger wichtige Infos
  muted: 'text-gray-500 dark:text-gray-500',
  // Label text - für Form Labels
  label: 'text-gray-700 dark:text-gray-300',

  // Headings
  h1: 'text-2xl font-bold text-gray-900 dark:text-gray-100',
  h2: 'text-xl font-semibold text-gray-900 dark:text-gray-100',
  h3: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
  h4: 'text-base font-medium text-gray-900 dark:text-gray-100',

  // Sizes with colors
  sm: 'text-sm text-gray-600 dark:text-gray-400',
  xs: 'text-xs text-gray-500 dark:text-gray-500',
} as const

// =============================================================================
// BORDERS & DIVIDERS
// =============================================================================
export const border = {
  default: 'border-gray-200 dark:border-gray-700',
  light: 'border-gray-100 dark:border-gray-800',
  input: 'border-gray-300 dark:border-gray-600',
} as const

export const divide = {
  y: 'divide-y divide-gray-200 dark:divide-gray-700',
  x: 'divide-x divide-gray-200 dark:divide-gray-700',
} as const

// =============================================================================
// BACKGROUNDS
// =============================================================================
export const bg = {
  page: 'bg-gray-50 dark:bg-gray-900',
  surface: 'bg-white dark:bg-gray-800',
  surfaceSecondary: 'bg-gray-50 dark:bg-gray-700',
  surfaceTertiary: 'bg-gray-100 dark:bg-gray-700',
  hover: 'hover:bg-gray-50 dark:hover:bg-gray-700',
  hoverStrong: 'hover:bg-gray-100 dark:hover:bg-gray-600',
} as const

// =============================================================================
// INPUTS & FORMS
// =============================================================================
export const input = {
  base: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
  select: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
  checkbox: 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700',
  textarea: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
  label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
  hint: 'mt-1 text-xs text-gray-500 dark:text-gray-400',
  disabled: 'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed',
} as const

// =============================================================================
// BUTTONS
// =============================================================================
export const btn = {
  primary: 'px-4 py-2 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
  primaryLg: 'px-6 py-3 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
  secondary: 'px-4 py-2 rounded-md font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
  secondaryLg: 'px-6 py-3 rounded-md font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
  danger: 'px-4 py-2 rounded-md font-medium text-white bg-red-600 hover:bg-red-700',
  ghost: 'px-4 py-2 rounded-md font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
  disabled: 'bg-gray-400 cursor-not-allowed',
  icon: 'p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
} as const

// =============================================================================
// ALERTS & STATUS BOXES
// =============================================================================
export const alert = {
  info: 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 rounded-lg p-4',
  success: 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-lg p-4',
  warning: 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 rounded-lg p-4',
  error: 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4',
  // Inline versions (ohne padding für Formulare)
  infoInline: 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 rounded px-4 py-3',
  successInline: 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded px-4 py-3',
  warningInline: 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 rounded px-4 py-3',
  errorInline: 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded px-4 py-3',
} as const

// Alert text colors for use inside alerts
export const alertText = {
  info: 'text-blue-900 dark:text-blue-300',
  infoIcon: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-800 dark:text-green-300',
  successIcon: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-800 dark:text-yellow-300',
  warningIcon: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-800 dark:text-red-300',
  errorIcon: 'text-red-600 dark:text-red-400',
} as const

// =============================================================================
// TABLES
// =============================================================================
export const table = {
  wrapper: 'overflow-x-auto',
  base: 'min-w-full divide-y divide-gray-200 dark:divide-gray-700',
  thead: 'bg-gray-50 dark:bg-gray-700',
  th: 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
  thRight: 'px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
  tbody: 'bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700',
  tr: 'hover:bg-gray-50 dark:hover:bg-gray-700',
  td: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100',
  tdRight: 'px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100',
  tdMuted: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400',
} as const

// =============================================================================
// SIDEBAR & NAVIGATION
// =============================================================================
export const nav = {
  sidebar: 'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700',
  item: 'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
  itemActive: 'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md transition-colors bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  header: 'bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
  link: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
  linkActive: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50',
} as const

// =============================================================================
// GRADIENTS (with Dark Mode support)
// =============================================================================
export const gradient = {
  // Info/Highlight boxes - Light hat Gradient, Dark hat solide Farbe
  infoBox: 'bg-gradient-to-r from-blue-50 to-purple-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-700',
  successBox: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:bg-gray-800 border border-green-200 dark:border-gray-700',
  funFacts: 'bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 dark:bg-gray-800 border-2 border-green-300 dark:border-gray-600',
  // KPI Cards mit Farb-Akzenten
  kpiGreen: 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/20 border border-green-200 dark:border-green-800',
  kpiBlue: 'bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/30 dark:to-sky-900/20 border border-blue-200 dark:border-blue-800',
  kpiPurple: 'bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800',
  kpiOrange: 'bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800',
} as const

// =============================================================================
// STATUS COLORS (für Badges, Tags, etc.)
// =============================================================================
export const status = {
  success: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
  warning: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
  error: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
  info: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
  neutral: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
} as const

// =============================================================================
// BADGES
// =============================================================================
export const badge = {
  success: 'px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
  warning: 'px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
  error: 'px-2 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
  info: 'px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
  neutral: 'px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
} as const

// =============================================================================
// SPECIAL COLORS (für spezifische Anwendungsfälle)
// =============================================================================
export const colors = {
  // Positive values (Erlöse, Gewinne, etc.)
  positive: 'text-green-600 dark:text-green-400',
  positiveBold: 'font-bold text-green-700 dark:text-green-400',
  // Negative values (Kosten, Verluste, etc.)
  negative: 'text-red-600 dark:text-red-400',
  negativeBold: 'font-bold text-red-600 dark:text-red-400',
  // Neutral/Blue (für neutrale Hervorhebungen)
  accent: 'text-blue-700 dark:text-blue-400',
  accentBold: 'font-bold text-blue-700 dark:text-blue-400',
  // Purple (für ROI, besondere Werte)
  special: 'text-purple-700 dark:text-purple-400',
  specialBold: 'font-bold text-purple-700 dark:text-purple-400',
} as const

// =============================================================================
// ICONS (innerhalb von Text-Kontexten)
// =============================================================================
export const icon = {
  muted: 'text-gray-400 dark:text-gray-500',
  default: 'text-gray-600 dark:text-gray-400',
  primary: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
} as const

// =============================================================================
// UTILITY: Combine classes helper
// =============================================================================
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// =============================================================================
// COMPONENT PRESETS (komplette Style-Sets für häufige Komponenten)
// =============================================================================
export const preset = {
  // Standard Card mit Header
  cardWithHeader: {
    wrapper: card.overflow,
    header: `px-6 py-4 border-b ${border.default}`,
    headerTitle: text.h3,
    body: 'p-6',
  },
  // KPI Card
  kpiCard: {
    wrapper: card.padded,
    label: 'text-sm text-gray-600 dark:text-gray-400 mb-1',
    value: 'text-2xl font-bold',
    hint: 'text-xs text-gray-500 dark:text-gray-500 mt-1',
  },
  // Form Section
  formSection: {
    wrapper: card.padded,
    title: text.h2,
    description: text.sm,
    fields: 'space-y-4',
    actions: 'flex justify-end gap-3 pt-4',
  },
} as const
