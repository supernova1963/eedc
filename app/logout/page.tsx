// app/logout/page.tsx
// Logout Page - Signs out user and redirects to home

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-browser'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const logout = async () => {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      router.push('/')
    }
    logout()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 dark:text-gray-400">Abmelden...</p>
      </div>
    </div>
  )
}
