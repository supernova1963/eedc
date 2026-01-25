// components/ConditionalLayout.tsx
// Conditionally renders AppLayout based on the current route

'use client'

import { usePathname } from 'next/navigation'
import AppLayout from './AppLayout'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

// Routes that should NOT have the AppLayout (sidebar, etc.)
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/test-register',
]

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()

  // Check if current route is a public route
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  // For public routes, render children directly without AppLayout
  if (isPublicRoute) {
    return <>{children}</>
  }

  // For all other routes, wrap with AppLayout
  return <AppLayout>{children}</AppLayout>
}
