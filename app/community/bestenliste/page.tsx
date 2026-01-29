// app/community/bestenliste/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import Breadcrumb from '@/components/Breadcrumb'

interface AnlageMitStats {
  anlage_id: string
  anlagenname: string
  leistung_kwp: number
  standort_ort?: string
  mitglied_display_name?: string
  hat_speicher: boolean
  hat_wallbox: boolean
  // Berechnete Stats
  gesamt_erzeugung_kwh?: number
  durchschnitt_autarkie?: number
  durchschnitt_eigenverbrauch?: number
  spezifischer_ertrag?: number // kWh pro kWp
  anzahl_monate?: number
}

type SortierKriterium = 'leistung' | 'erzeugung' | 'autarkie' | 'eigenverbrauch' | 'spezifisch'

export default function CommunityBestenlistePage() {
  const [anlagen, setAnlagen] = useState<AnlageMitStats[]>([])
  const [loading, setLoading] = useState(true)
  const [sortierung, setSortierung] = useState<SortierKriterium>('leistung')

  useEffect(() => {
    loadAnlagenMitStats()
  }, [])

  async function loadAnlagenMitStats() {
    setLoading(true)
    try {
      // Anlagen laden
      const anlagenRes = await fetch('/api/community/anlagen')
      const anlagenData = await anlagenRes.json()

      if (!anlagenData.success) {
        setLoading(false)
        return
      }

      // Für jede Anlage die Monatsdaten laden und Stats berechnen
      const anlagenMitStats = await Promise.all(
        anlagenData.data.map(async (anlage: any) => {
          try {
            const mdRes = await fetch(`/api/community/anlagen/${anlage.anlage_id}/monatsdaten`)
            const mdData = await mdRes.json()

            if (mdData.success && mdData.data?.length > 0) {
              const monatsdaten = mdData.data

              const gesamtErzeugung = monatsdaten.reduce(
                (sum: number, m: any) => sum + (m.pv_erzeugung_kwh || 0),
                0
              )
              const durchschnittAutarkie = monatsdaten.reduce(
                (sum: number, m: any) => sum + (m.autarkiegrad_prozent || 0),
                0
              ) / monatsdaten.length
              const durchschnittEigenverbrauch = monatsdaten.reduce(
                (sum: number, m: any) => sum + (m.eigenverbrauchsquote_prozent || 0),
                0
              ) / monatsdaten.length

              // Spezifischer Ertrag: kWh pro kWp pro Monat (Durchschnitt)
              const spezifischerErtrag = anlage.leistung_kwp > 0
                ? (gesamtErzeugung / monatsdaten.length) / anlage.leistung_kwp
                : 0

              return {
                ...anlage,
                gesamt_erzeugung_kwh: Math.round(gesamtErzeugung),
                durchschnitt_autarkie: Math.round(durchschnittAutarkie * 10) / 10,
                durchschnitt_eigenverbrauch: Math.round(durchschnittEigenverbrauch * 10) / 10,
                spezifischer_ertrag: Math.round(spezifischerErtrag * 10) / 10,
                anzahl_monate: monatsdaten.length
              }
            }

            return {
              ...anlage,
              gesamt_erzeugung_kwh: 0,
              durchschnitt_autarkie: 0,
              durchschnitt_eigenverbrauch: 0,
              spezifischer_ertrag: 0,
              anzahl_monate: 0
            }
          } catch {
            return {
              ...anlage,
              gesamt_erzeugung_kwh: 0,
              durchschnitt_autarkie: 0,
              durchschnitt_eigenverbrauch: 0,
              spezifischer_ertrag: 0,
              anzahl_monate: 0
            }
          }
        })
      )

      setAnlagen(anlagenMitStats)
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  // Sortierte Anlagen
  const sortierteAnlagen = [...anlagen].sort((a, b) => {
    switch (sortierung) {
      case 'leistung':
        return (b.leistung_kwp || 0) - (a.leistung_kwp || 0)
      case 'erzeugung':
        return (b.gesamt_erzeugung_kwh || 0) - (a.gesamt_erzeugung_kwh || 0)
      case 'autarkie':
        return (b.durchschnitt_autarkie || 0) - (a.durchschnitt_autarkie || 0)
      case 'eigenverbrauch':
        return (b.durchschnitt_eigenverbrauch || 0) - (a.durchschnitt_eigenverbrauch || 0)
      case 'spezifisch':
        return (b.spezifischer_ertrag || 0) - (a.spezifischer_ertrag || 0)
      default:
        return 0
    }
  })

  const sortierKriterien: { key: SortierKriterium; label: string; icon: string; einheit: string }[] = [
    { key: 'leistung', label: 'Größte Anlagen', icon: 'sun', einheit: 'kWp' },
    { key: 'spezifisch', label: 'Beste Effizienz', icon: 'chart', einheit: 'kWh/kWp/Mo' },
    { key: 'autarkie', label: 'Höchste Autarkie', icon: 'home', einheit: '%' },
    { key: 'eigenverbrauch', label: 'Bester Eigenverbrauch', icon: 'lightning', einheit: '%' },
    { key: 'erzeugung', label: 'Meiste Erzeugung', icon: 'battery', einheit: 'kWh' },
  ]

  function getRangColor(index: number): string {
    if (index === 0) return 'bg-gradient-to-br from-yellow-400 to-yellow-600' // Gold
    if (index === 1) return 'bg-gradient-to-br from-gray-300 to-gray-500' // Silber
    if (index === 2) return 'bg-gradient-to-br from-amber-600 to-amber-800' // Bronze
    return 'bg-gray-200'
  }

  function getWert(anlage: AnlageMitStats): string {
    switch (sortierung) {
      case 'leistung':
        return `${anlage.leistung_kwp} kWp`
      case 'erzeugung':
        return `${anlage.gesamt_erzeugung_kwh?.toLocaleString('de-DE')} kWh`
      case 'autarkie':
        return `${anlage.durchschnitt_autarkie}%`
      case 'eigenverbrauch':
        return `${anlage.durchschnitt_eigenverbrauch}%`
      case 'spezifisch':
        return `${anlage.spezifischer_ertrag} kWh/kWp`
      default:
        return ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bestenliste
          </h1>
          <p className="text-gray-600">
            Die Top-Anlagen der Community nach verschiedenen Kriterien
          </p>
        </div>

        {/* Sortierung */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Sortieren nach
          </h2>
          <div className="flex flex-wrap gap-3">
            {sortierKriterien.map((kriterium) => (
              <button
                key={kriterium.key}
                onClick={() => setSortierung(kriterium.key)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                  sortierung === kriterium.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <SimpleIcon type={kriterium.icon as any} className="w-5 h-5" />
                {kriterium.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bestenliste */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Lade Bestenliste...</p>
            </div>
          ) : sortierteAnlagen.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <SimpleIcon type="trophy" className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p>Keine Anlagen gefunden</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortierteAnlagen.map((anlage, index) => (
                <Link
                  key={anlage.anlage_id}
                  href={`/community/${anlage.anlage_id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition"
                >
                  {/* Rang */}
                  <div className={`w-12 h-12 ${getRangColor(index)} rounded-full flex items-center justify-center text-white font-bold text-lg shadow`}>
                    {index + 1}
                  </div>

                  {/* Anlage Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">
                        {anlage.anlagenname}
                      </span>
                      {index < 3 && (
                        <SimpleIcon
                          type="trophy"
                          className={`w-5 h-5 ${
                            index === 0 ? 'text-yellow-500' :
                            index === 1 ? 'text-gray-400' :
                            'text-amber-700'
                          }`}
                        />
                      )}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>{anlage.standort_ort || 'Unbekannt'}</span>
                      {anlage.mitglied_display_name && (
                        <>
                          <span>•</span>
                          <span>{anlage.mitglied_display_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="hidden md:flex gap-2">
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

                  {/* Wert */}
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600">
                      {getWert(anlage)}
                    </div>
                    {anlage.anzahl_monate && anlage.anzahl_monate > 0 && sortierung !== 'leistung' && (
                      <div className="text-xs text-gray-500">
                        {anlage.anzahl_monate} Monate Daten
                      </div>
                    )}
                  </div>

                  <SimpleIcon type="arrow-right" className="w-5 h-5 text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Info-Box */}
        {!loading && anlagen.some(a => !a.anzahl_monate || a.anzahl_monate === 0) && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
            <SimpleIcon type="info" className="w-4 h-4 inline mr-2" />
            Einige Anlagen haben noch keine freigegebenen Monatsdaten. Die Berechnung von Effizienz,
            Autarkie und Eigenverbrauch basiert nur auf Anlagen mit Daten.
          </div>
        )}

        {/* Link zurück */}
        <div className="mt-6">
          <Link
            href="/community"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
          >
            <SimpleIcon type="arrow-left" className="w-4 h-4" />
            Zurück zur Community-Übersicht
          </Link>
        </div>
      </div>
    </div>
  )
}
