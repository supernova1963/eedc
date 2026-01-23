// components/ui/Alert.tsx
// Wiederverwendbare Alert-Komponente für Fehler, Erfolg und Info

import { ReactNode } from 'react'

interface AlertProps {
  type: 'error' | 'success' | 'info'
  children: ReactNode
  className?: string
}

const alertStyles = {
  error: 'bg-red-50 border-red-200 text-red-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  info: 'bg-blue-50 border-blue-200 text-blue-900'
}

const alertIcons = {
  error: '',
  success: '',
  info: ''
}

export default function Alert({ type, children, className = '' }: AlertProps) {
  return (
    <div className={`border px-4 py-3 rounded ${alertStyles[type]} ${className}`}>
      {alertIcons[type]} {children}
    </div>
  )
}
