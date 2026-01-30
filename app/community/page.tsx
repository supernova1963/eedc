// app/community/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import Breadcrumb from '@/components/Breadcrumb'

interface PublicAnlage {
  anlage_id: string
  anlagenname: string
  installationsdatum: string
  leistung_kwp: number
  standort_ort?: string
  standort_plz?: string
  mitglied_display_name?: string
  hat_speicher?: boolean
  hat_wallbox?: boolean
  anzahl_komponenten?: number
}

interface CommunityStats {
  anzahl_anlagen: number
  gesamtleistung_kwp: number
  anzahl_mitglieder: number
}

export default function CommunityPage() {
  const [anlagen, setAnlagen] = useState<PublicAnlage[]>([])
  const [stats, setStats] = useState<CommunityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    ort: '',
    hatSpeicher: false,
    hatWallbox: false,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Statistiken laden
      const statsRes = await fetch('/api/community/stats')
      const statsData = await statsRes.json()
      if (statsData.success) {
        setStats(statsData.data)
      }

      // Anlagen laden
      const anlagenRes = await fetch('/api/community/anlagen')
      const anlagenData = await anlagenRes.json()
      if (anlagenData.success) {
        setAnlagen(anlagenData.data)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  async function applyFilter() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.ort) params.set('ort', filter.ort)
      if (filter.hatSpeicher) params.set('hat_speicher', 'true')
      if (filter.hatWallbox) params.set('hat_wallbox', 'true')

      const res = await fetch(`/api/community/anlagen?${params}`)
      const data = await res.json()
      if (data.success) {
        setAnlagen(data.data)
      }
    } catch (error) {
      console.error('Fehler beim Filtern:', error)
    } finally {
      setLoading(false)
    }
  }

  function resetFilter() {
    setFilter({
      ort: '',
      hatSpeicher: false,
      hatWallbox: false,
    })
    loadData()
  }

  const filteredAnlagen = anlagen

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Community-Anlagen
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Entdecken Sie öffentliche PV-Anlagen und deren Erfahrungen
          </p>
        </div>

        {/* Statistiken */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <SimpleIcon type="sun" className="w-8 h-8" />
                <div className="text-sm opacity-90">Öffentliche Anlagen</div>
              </div>
              <div className="text-4xl font-bold">{stats.anzahl_anlagen}</div>
              <div className="text-sm opacity-75 mt-1">von {stats.anzahl_mitglieder} Mitgliedern</div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <SimpleIcon type="lightning" className="w-8 h-8" />
                <div className="text-sm opacity-90">Gesamtleistung</div>
              </div>
              <div className="text-4xl font-bold">{stats.gesamtleistung_kwp}</div>
              <div className="text-sm opacity-75 mt-1">kWp installiert</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <SimpleIcon type="globe" className="w-8 h-8" />
                <div className="text-sm opacity-90">Community</div>
              </div>
              <div className="text-4xl font-bold">{filteredAnlagen.length}</div>
              <div className="text-sm opacity-75 mt-1">Anlagen gefunden</div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ort
              </label>
              <input
                type="text"
                value={filter.ort}
                onChange={(e) => setFilter({ ...filter, ort: e.target.value })}
                placeholder="z.B. München"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter.hatSpeicher}
                  onChange={(e) => setFilter({ ...filter, hatSpeicher: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mit Batteriespeicher</span>
              </label>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter.hatWallbox}
                  onChange={(e) => setFilter({ ...filter, hatWallbox: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mit E-Auto/Wallbox</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={applyFilter}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Filter anwenden
            </button>
            <button
              onClick={resetFilter}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Zurücksetzen
            </button>
          </div>
        </div>

        {/* Anlagen-Liste */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Lade Anlagen...</p>
          </div>
        ) : filteredAnlagen.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <SimpleIcon type="info" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Keine Anlagen gefunden</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Es wurden keine öffentlichen Anlagen mit den gewählten Filtern gefunden.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAnlagen.map((anlage) => (
              <Link
                key={anlage.anlage_id}
                href={`/community/${anlage.anlage_id}`}
                className="bg-white rounded-xl shadow-sm hover:shadow-lg transition p-6 border border-gray-200 hover:border-blue-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                      <SimpleIcon type="sun" className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{anlage.anlagenname}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{anlage.standort_ort || 'Standort nicht angegeben'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Leistung</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{anlage.leistung_kwp} kWp</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">In Betrieb seit</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(anlage.installationsdatum).getFullYear()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {anlage.hat_speicher && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                      <SimpleIcon type="battery" className="w-3 h-3" />
                      Speicher
                    </span>
                  )}
                  {anlage.hat_wallbox && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                      <SimpleIcon type="car" className="w-3 h-3" />
                      E-Auto
                    </span>
                  )}
                </div>

                {anlage.mitglied_display_name && (
                  <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600 dark:text-gray-400">
                    von {anlage.mitglied_display_name}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
