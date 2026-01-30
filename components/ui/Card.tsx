// components/ui/Card.tsx
// Wiederverwendbare Card-Komponente mit verschiedenen Varianten

import { ReactNode } from 'react'
import { card, border, text } from '@/lib/styles'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'base' | 'padded' | 'paddedSm' | 'bordered' | 'overflow'
}

export function Card({ children, className = '', variant = 'padded' }: CardProps) {
  return (
    <div className={`${card[variant]} ${className}`}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b ${border.default} ${className}`}>
      {children}
    </div>
  )
}

interface CardTitleProps {
  children: ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4'
}

export function CardTitle({ children, className = '', as = 'h3' }: CardTitleProps) {
  const Component = as
  return (
    <Component className={`${text[as]} ${className}`}>
      {children}
    </Component>
  )
}

interface CardBodyProps {
  children: ReactNode
  className?: string
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}

// Inner Card (für verschachtelte Karten)
interface CardInnerProps {
  children: ReactNode
  className?: string
  size?: 'default' | 'sm'
}

export function CardInner({ children, className = '', size = 'default' }: CardInnerProps) {
  const sizeClass = size === 'sm' ? card.innerSm : card.inner
  return (
    <div className={`${sizeClass} ${className}`}>
      {children}
    </div>
  )
}
