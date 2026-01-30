// components/ui/Alert.tsx
// Wiederverwendbare Alert-Komponente für Fehler, Erfolg und Info

import { ReactNode } from 'react'
import { alert as alertStyles } from '@/lib/styles'

interface AlertProps {
  type: 'error' | 'success' | 'info' | 'warning'
  children: ReactNode
  className?: string
  inline?: boolean
}

export default function Alert({ type, children, className = '', inline = false }: AlertProps) {
  const styleKey = inline ? `${type}Inline` as const : type
  const baseStyle = alertStyles[styleKey]

  return (
    <div className={`${baseStyle} ${className}`}>
      {children}
    </div>
  )
}
