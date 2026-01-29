// app/community/vergleich/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import Breadcrumb from '@/components/Breadcrumb'

interface AnlageVergleich {
  anlage_id: string
  anlagenname: string
  leistung_kwp: number
  standort_ort?: string
  mitglied_display_name?: string
  hat_speicher: boolean
  hat_wallbox: boolean
  // Monatsdaten-Aggregate
  durchschnitt_erzeugung_kwh?: number
  durchschnitt_autarkie?: number
  durchschnitt_eigenverbrauch?: number
}

export default function CommunityVergleichPage() {
  const [anlagen, setAnlagen] = useState<AnlageVergleich[]>([])
  const [selectedAnlagen, setSelectedAnlagen] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [vergleichsDaten, setVergleichsDaten] = useState<any[]>([])

  useEffect(() => {
    loadAnlagen()
  }, [])

  async function loadAnlagen() {
    setLoading(true)
    try {
      const res = await fetch('/api/community/anlagen')
      const data = await res.json()
      if (data.success) {
        setAnlagen(data.data)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleAnlage(anlageId: string) {
    setSelectedAnlagen(prev => {
      if (prev.includes(anlageId)) {
        return prev.filter(id => id !== anlageId)
      }
      if (prev.length >= 4) {
        return prev // Max 4 Anlagen
      }
      return [...prev, anlageId]
    })
  }

  async function loadVergleichsDaten() {
    if (selectedAnlagen.length < 2) return

    setLoading(true)
    try {
      const datenPromises = selectedAnlagen.map(async (id) => {
        const res = await fetch(`/api/community/anlagen/${id}/monatsdaten`)
        const data = await res.json()
        const anlage = anlagen.find(a => a.anlage_id === id)
        return {
          anlage,
          monatsdaten: data.success ? data.data : []
        }
      })

      const ergebnisse = await Promise.all(datenPromises)
      setVergleichsDaten(ergebnisse)
    } catch (error) {
      console.error('Fehler beim Laden der Vergleichsdaten:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedAnlagen.length >= 2) {
      loadVergleichsDaten()
    } else {
      setVergleichsDaten([])
    }
  }, [selectedAnlagen])

  // Berechne Durchschnittswerte für jede Anlage
  function berechneDurchschnitt(monatsdaten: any[]) {
    if (!monatsdaten || monatsdaten.length === 0) return null

    const sumErzeugung = monatsdaten.reduce((sum, m) => sum + (m.pv_erzeugung_kwh || 0), 0)
    const sumAutarkie = monatsdaten.reduce((sum, m) => sum + (m.autarkiegrad_prozent || 0), 0)
    const sumEigenverbrauch = monatsdaten.reduce((sum, m) => sum + (m.eigenverbrauchsquote_prozent || 0), 0)

    return {
      durchschnitt_erzeugung: Math.round(sumErzeugung / monatsdaten.length),
      durchschnitt_autarkie: Math.round(sumAutarkie / monatsdaten.length * 10) / 10,
      durchschnitt_eigenverbrauch: Math.round(sumEigenverbrauch / monatsdaten.length * 10) / 10,
      anzahl_monate: monatsdaten.length
    }
  }

  const selectedAnlagenData = anlagen.filter(a => selectedAnlagen.includes(a.anlage_id))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Anlagen-Vergleich
          </h1>
          <p className="text-gray-600">
            Vergleichen Sie bis zu 4 öffentliche Anlagen miteinander
          </p>
        </div>

        {/* Anlagen-Auswahl */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Anlagen auswählen ({selectedAnlagen.length}/4)
          </h2>

          {loading && anlagen.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {anlagen.map((anlage) => (
                <div
                  key={anlage.anlage_id}
                  onClick={() => toggleAnlage(anlage.anlage_id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                    selectedAnlagen.includes(anlage.anlage_id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedAnlagen.includes(anlage.anlage_id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <SimpleIcon type="sun" className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{anlage.anlagenname}</div>
                      <div className="text-sm text-gray-500">
                        {anlage.leistung_kwp} kWp • {anlage.standort_ort || 'Unbekannt'}
                      </div>
                    </div>
                    {selectedAnlagen.includes(anlage.anlage_id) && (
                      <SimpleIcon type="check" className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {anlagen.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <SimpleIcon type="info" className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>Keine öffentlichen Anlagen mit Monatsdaten-Freigabe gefunden</p>
            </div>
          )}
        </div>

        {/* Vergleichs-Ergebnis */}
        {selectedAnlagen.length >= 2 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Vergleich
            </h2>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Lade Vergleichsdaten...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Kennzahl</th>
                      {vergleichsDaten.map((item) => (
                        <th key={item.anlage?.anlage_id} className="text-center py-3 px-4 font-semibold text-gray-700">
                          {item.anlage?.anlagenname}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-600">Leistung (kWp)</td>
                      {vergleichsDaten.map((item) => (
                        <td key={item.anlage?.anlage_id} className="text-center py-3 px-4 font-medium">
                          {item.anlage?.leistung_kwp}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-600">Standort</td>
                      {vergleichsDaten.map((item) => (
                        <td key={item.anlage?.anlage_id} className="text-center py-3 px-4">
                          {item.anlage?.standort_ort || '-'}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-600">Speicher</td>
                      {vergleichsDaten.map((item) => (
                        <td key={item.anlage?.anlage_id} className="text-center py-3 px-4">
                          {item.anlage?.hat_speicher ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 text-gray-600">E-Auto/Wallbox</td>
                      {vergleichsDaten.map((item) => (
                        <td key={item.anlage?.anlage_id} className="text-center py-3 px-4">
                          {item.anlage?.hat_wallbox ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100 bg-yellow-50">
                      <td className="py-3 px-4 text-gray-700 font-medium">Ø Erzeugung/Monat (kWh)</td>
                      {vergleichsDaten.map((item) => {
                        const stats = berechneDurchschnitt(item.monatsdaten)
                        return (
                          <td key={item.anlage?.anlage_id} className="text-center py-3 px-4 font-bold text-yellow-700">
                            {stats?.durchschnitt_erzeugung || '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="border-b border-gray-100 bg-green-50">
                      <td className="py-3 px-4 text-gray-700 font-medium">Ø Autarkiegrad (%)</td>
                      {vergleichsDaten.map((item) => {
                        const stats = berechneDurchschnitt(item.monatsdaten)
                        return (
                          <td key={item.anlage?.anlage_id} className="text-center py-3 px-4 font-bold text-green-700">
                            {stats?.durchschnitt_autarkie || '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="border-b border-gray-100 bg-blue-50">
                      <td className="py-3 px-4 text-gray-700 font-medium">Ø Eigenverbrauch (%)</td>
                      {vergleichsDaten.map((item) => {
                        const stats = berechneDurchschnitt(item.monatsdaten)
                        return (
                          <td key={item.anlage?.anlage_id} className="text-center py-3 px-4 font-bold text-blue-700">
                            {stats?.durchschnitt_eigenverbrauch || '-'}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-gray-500 text-sm">Datenbasis (Monate)</td>
                      {vergleichsDaten.map((item) => {
                        const stats = berechneDurchschnitt(item.monatsdaten)
                        return (
                          <td key={item.anlage?.anlage_id} className="text-center py-3 px-4 text-gray-500 text-sm">
                            {stats?.anzahl_monate || 0}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {vergleichsDaten.some(item => !item.monatsdaten || item.monatsdaten.length === 0) && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                <SimpleIcon type="warning" className="w-4 h-4 inline mr-2" />
                Einige Anlagen haben keine freigegebenen Monatsdaten.
              </div>
            )}
          </div>
        )}

        {selectedAnlagen.length === 1 && (
          <div className="bg-blue-50 rounded-xl p-6 text-center">
            <SimpleIcon type="info" className="w-12 h-12 mx-auto mb-2 text-blue-500" />
            <p className="text-blue-800">Wählen Sie mindestens 2 Anlagen für einen Vergleich aus</p>
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
