// components/ui/Alert.tsx
// Wiederverwendbare Alert-Komponente für Fehler, Erfolg und Info

import { ReactNode } from 'react'

interface AlertProps {
  type: 'error' | 'success' | 'info' | 'warning'
  children: ReactNode
  className?: string
}

const alertStyles = {
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
  info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300'
}

const alertIcons = {
  error: '',
  success: '',
  info: '',
  warning: ''
}

export default function Alert({ type, children, className = '' }: AlertProps) {
  return (
    <div className={`border px-4 py-3 rounded ${alertStyles[type]} ${className}`}>
      {alertIcons[type]} {children}
    </div>
  )
}
