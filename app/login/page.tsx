// app/login/page.tsx
'use client'

import { useState } from 'react'
import { signIn } from '@/lib/auth-actions'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn(email, password)
      if (result?.error) {
        // Benutzerfreundliche Fehlermeldungen
        let errorMessage = result.error

        if (result.error.includes('Invalid login credentials') || result.error.includes('Invalid email or password')) {
          errorMessage = 'E-Mail oder Passwort ist falsch. Bitte überprüfen Sie Ihre Eingaben.'
        } else if (result.error.includes('Email not confirmed')) {
          errorMessage = 'Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse.'
        } else if (result.error.includes('Email rate limit exceeded')) {
          errorMessage = 'Zu viele Login-Versuche. Bitte warten Sie einen Moment.'
        } else if (result.error.includes('User not found')) {
          errorMessage = 'Kein Konto mit dieser E-Mail-Adresse gefunden.'
        }

        setError(errorMessage)
      }
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4">
              <span className="text-3xl">🌞</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              eedc Login
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Electronic Energy Data Collection
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="ihre@email.de"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Anmeldung läuft...' : 'Anmelden'}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Noch kein Konto?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Jetzt registrieren
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Verwalten Sie Ihre PV-Anlage, E-Auto und Wärmepumpe</p>
          <p className="mt-1">Profitieren Sie von detaillierten Auswertungen und ROI-Berechnungen</p>
        </div>
      </div>
    </div>
  )
}
