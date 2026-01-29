// components/ConditionalLayout.tsx
// Conditionally renders AppLayout based on the current route

'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import AppLayout from './AppLayout'
import { createBrowserClient } from '@/lib/supabase-browser'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

// Routes that should NOT have the AppLayout (sidebar, etc.)
const PUBLIC_ROUTES = [
  '/',  // Community Dashboard (öffentlich)
  '/login',
  '/register',
  '/test-register',
  '/community',  // Community Seiten öffentlich
]

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()
  const [userName, setUserName] = useState<string>()
  const [userEmail, setUserEmail] = useState<string>()

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUserEmail(user.email)

        // Lade Mitgliedsdaten für vollen Namen (RLS filtert automatisch auf auth_user_id)
        const { data: mitglied, error } = await supabase
          .from('mitglieder')
          .select('vorname, nachname')
          .eq('auth_user_id', user.id)
          .single()

        if (error) {
          console.error('Fehler beim Laden der Mitgliedsdaten:', error)
        }

        if (mitglied) {
          setUserName(`${mitglied.vorname} ${mitglied.nachname}`)
        }
      }
    }

    loadUser()
  }, [])

  // Check if current route is a public route
  const isPublicRoute = PUBLIC_ROUTES.some(route => {
    // Exact match for root
    if (route === '/' && pathname === '/') return true
    // Prefix match for others
    if (route !== '/' && pathname.startsWith(route)) return true
    return false
  })

  // For public routes, render children directly without AppLayout
  if (isPublicRoute) {
    return <>{children}</>
  }

  // For all other routes, wrap with AppLayout
  return (
    <AppLayout userName={userName} userEmail={userEmail}>
      {children}
    </AppLayout>
  )
}
