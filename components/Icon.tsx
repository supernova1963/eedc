// components/Icon.tsx
// Einfache Icon-Komponente mit Unicode-Symbolen

interface IconProps {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const iconMap: Record<string, string> = {
  // Dashboard & Navigation
  sun: '☀',
  dashboard: '▣',
  home: '⌂',

  // Daten
  plus: '➕',
  input: '📥',
  briefcase: '💼',
  clipboard: '📋',
  chart: '📊',
  settings: '⚙',

  // Energie
  plug: '🔌',
  battery: '🔋',
  lightning: '⚡',

  // Finanzen
  money: '💰',
  gem: '💎',

  // Andere
  rocket: '🚀',
  file: '📄',
  link: '🔗',
  trend: '📈',
}

const sizeMap = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-4xl',
}

export default function Icon({ name, size = 'md' }: IconProps) {
  const symbol = iconMap[name] || '•'

  return (
    <span
      className={`inline-block ${sizeMap[size]}`}
      style={{
        fontFamily: "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif",
        fontStyle: 'normal'
      }}
    >
      {symbol}
    </span>
  )
}
