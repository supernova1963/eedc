// components/PublicHeader.tsx
// Header für öffentliche Seiten mit Login-Status

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase-browser'
import SimpleIcon from './SimpleIcon'

export default function PublicHeader() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    loadUser()
  }, [])

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <SimpleIcon type="solar" className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">PV Community</span>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/community"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Anlagen
            </Link>

            {loading ? (
              <div className="w-20 h-8 bg-gray-100 rounded animate-pulse" />
            ) : user ? (
              <Link
                href="/meine-anlage"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <SimpleIcon type="home" className="w-4 h-4" />
                Meine Anlage
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Anmelden
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Registrieren
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
