// app/register/page.tsx
'use client'

import { useState } from 'react'
import { signUp } from '@/lib/auth-actions'
import Link from 'next/link'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    vorname: '',
    nachname: '',
    plz: '',
    ort: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validierung
    if (formData.password !== formData.passwordConfirm) {
      setError('Passwörter stimmen nicht überein')
      return
    }

    if (formData.password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein')
      return
    }

    setLoading(true)

    try {
      const result = await signUp({
        email: formData.email,
        password: formData.password,
        vorname: formData.vorname,
        nachname: formData.nachname,
        plz: formData.plz || undefined,
        ort: formData.ort || undefined,
      })

      if (result?.error) {
        // Benutzerfreundliche Fehlermeldungen
        let errorMessage = result.error

        if (result.error.includes('User already registered')) {
          errorMessage = 'Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an oder verwenden Sie eine andere E-Mail.'
        } else if (result.error.includes('Password should be at least')) {
          errorMessage = 'Passwort muss mindestens 6 Zeichen lang sein'
        } else if (result.error.includes('invalid email')) {
          errorMessage = 'Bitte geben Sie eine gültige E-Mail-Adresse ein'
        } else if (result.error.includes('Email rate limit exceeded')) {
          errorMessage = 'Zu viele Registrierungsversuche. Bitte warten Sie einen Moment.'
        }

        setError(errorMessage)
      }
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4">
              <span className="text-3xl">🌞</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Registrierung
            </h1>
            <p className="text-gray-600">
              Erstellen Sie Ihr eedc Konto
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="vorname" className="block text-sm font-medium text-gray-700 mb-2">
                  Vorname *
                </label>
                <input
                  id="vorname"
                  type="text"
                  value={formData.vorname}
                  onChange={(e) => handleChange('vorname', e.target.value)}
                  required
                  autoComplete="given-name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Max"
                />
              </div>

              <div>
                <label htmlFor="nachname" className="block text-sm font-medium text-gray-700 mb-2">
                  Nachname *
                </label>
                <input
                  id="nachname"
                  type="text"
                  value={formData.nachname}
                  onChange={(e) => handleChange('nachname', e.target.value)}
                  required
                  autoComplete="family-name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Mustermann"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-Mail *
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="ihre@email.de"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="plz" className="block text-sm font-medium text-gray-700 mb-2">
                  PLZ
                </label>
                <input
                  id="plz"
                  type="text"
                  value={formData.plz}
                  onChange={(e) => handleChange('plz', e.target.value)}
                  autoComplete="postal-code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="12345"
                />
              </div>

              <div>
                <label htmlFor="ort" className="block text-sm font-medium text-gray-700 mb-2">
                  Ort
                </label>
                <input
                  id="ort"
                  type="text"
                  value={formData.ort}
                  onChange={(e) => handleChange('ort', e.target.value)}
                  autoComplete="address-level2"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Musterstadt"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Passwort *
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Mindestens 6 Zeichen"
              />
              <div className="mt-2 text-sm text-gray-600">
                <p className="font-medium mb-1">Passwort-Anforderungen:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li className={formData.password.length >= 6 ? 'text-green-600' : ''}>
                    Mindestens 6 Zeichen
                  </li>
                  <li className={/[A-Za-z]/.test(formData.password) && /[0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                    Empfohlen: Kombination aus Buchstaben und Zahlen
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-2">
                Passwort bestätigen *
              </label>
              <input
                id="passwordConfirm"
                type="password"
                value={formData.passwordConfirm}
                onChange={(e) => handleChange('passwordConfirm', e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Passwort wiederholen"
              />
              {formData.passwordConfirm && formData.password !== formData.passwordConfirm && (
                <p className="mt-2 text-sm text-red-600">Passwörter stimmen nicht überein</p>
              )}
              {formData.passwordConfirm && formData.password === formData.passwordConfirm && (
                <p className="mt-2 text-sm text-green-600">✓ Passwörter stimmen überein</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Registrierung läuft...' : 'Konto erstellen'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Bereits registriert?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Jetzt anmelden
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>* Pflichtfelder</p>
        </div>
      </div>
    </div>
  )
}
