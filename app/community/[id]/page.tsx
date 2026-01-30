// app/community/[id]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import Breadcrumb from '@/components/Breadcrumb'

interface PublicAnlageDetail {
  anlage_id: string
  anlagenname: string
  beschreibung?: string
  installationsdatum: string
  leistung_kwp: number
  standort_ort?: string
  standort_plz?: string
  ausrichtung?: string
  neigungswinkel_grad?: number
  mitglied_display_name?: string
  mitglied_bio?: string
  profilbeschreibung?: string
  motivation?: string
  erfahrungen?: string
  tipps_fuer_andere?: string
  kontakt_erwuenscht?: boolean
  komponenten_oeffentlich?: boolean
  monatsdaten_oeffentlich?: boolean
  kennzahlen_oeffentlich?: boolean
}

interface Komponente {
  id: string
  typ: string
  bezeichnung: string
  anschaffungsdatum: string
  parameter: Record<string, any>
}

interface Monatsdaten {
  jahr: number
  monat: number
  pv_erzeugung_kwh: number
  direktverbrauch_kwh: number
  einspeisung_kwh: number
  netzbezug_kwh: number
  autarkiegrad_prozent: number
}

export default function CommunityAnlageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [anlage, setAnlage] = useState<PublicAnlageDetail | null>(null)
  const [komponenten, setKomponenten] = useState<Komponente[]>([])
  const [monatsdaten, setMonatsdaten] = useState<Monatsdaten[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAnlage()
  }, [id])

  async function loadAnlage() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/community/anlagen/${id}`)
      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Anlage nicht gefunden')
        return
      }

      setAnlage(data.data)

      // Lade Komponenten wenn freigegeben
      if (data.data.komponenten_oeffentlich) {
        try {
          const kompRes = await fetch(`/api/community/anlagen/${id}/komponenten`)
          const kompData = await kompRes.json()
          if (kompData.success) {
            setKomponenten(kompData.data || [])
          }
        } catch (e) {
          console.log('Keine Komponenten verfügbar')
        }
      }

      // Lade Monatsdaten wenn freigegeben
      if (data.data.monatsdaten_oeffentlich) {
        try {
          const mdRes = await fetch(`/api/community/anlagen/${id}/monatsdaten`)
          const mdData = await mdRes.json()
          if (mdData.success) {
            setMonatsdaten(mdData.data || [])
          }
        } catch (e) {
          console.log('Keine Monatsdaten verfügbar')
        }
      }
    } catch (err) {
      setError('Fehler beim Laden der Anlage')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Lade Anlage...</p>
        </div>
      </div>
    )
  }

  if (error || !anlage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <SimpleIcon type="error" className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Anlage nicht gefunden</h3>
            <p className="text-gray-600 mb-6">{error || 'Diese Anlage ist nicht öffentlich verfügbar.'}</p>
            <Link
              href="/community"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <SimpleIcon type="back" className="w-5 h-5" />
              Zurück zur Community
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const betriebsjahre = new Date().getFullYear() - new Date(anlage.installationsdatum).getFullYear()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white mb-8 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <SimpleIcon type="sun" className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{anlage.anlagenname}</h1>
              <div className="flex flex-wrap gap-4 text-white/90">
                <div className="flex items-center gap-2">
                  <SimpleIcon type="lightning" className="w-5 h-5" />
                  <span>{anlage.leistung_kwp} kWp</span>
                </div>
                <div className="flex items-center gap-2">
                  <SimpleIcon type="globe" className="w-5 h-5" />
                  <span>{anlage.standort_ort} ({anlage.standort_plz})</span>
                </div>
                <div className="flex items-center gap-2">
                  <SimpleIcon type="calendar" className="w-5 h-5" />
                  <span>Seit {new Date(anlage.installationsdatum).getFullYear()} ({betriebsjahre} Jahre)</span>
                </div>
              </div>
            </div>
          </div>

          {anlage.mitglied_display_name && (
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-white/90">
                Geteilt von <span className="font-semibold">{anlage.mitglied_display_name}</span>
              </p>
            </div>
          )}
        </div>

        {/* Kennzahlen (berechnet aus Monatsdaten) */}
        {monatsdaten.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <SimpleIcon type="sun" className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Gesamterzeugung</div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {(monatsdaten.reduce((sum, m) => sum + (m.pv_erzeugung_kwh || 0), 0) / 1000).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">MWh</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <SimpleIcon type="target" className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Durchschn. Autarkie</div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {(monatsdaten.reduce((sum, m) => sum + (m.autarkiegrad_prozent || 0), 0) / monatsdaten.length).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">%</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <SimpleIcon type="lightning" className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Erfasste Monate</div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {monatsdaten.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Monate</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hauptinfos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Beschreibung */}
            {(anlage.profilbeschreibung || anlage.beschreibung) && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <SimpleIcon type="info" className="w-5 h-5 text-blue-600" />
                  Beschreibung
                </h2>
                <p className="text-gray-700 leading-relaxed">{anlage.profilbeschreibung || anlage.beschreibung}</p>
              </div>
            )}

            {/* Motivation & Erfahrungen */}
            {(anlage.motivation || anlage.erfahrungen) && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <SimpleIcon type="lightbulb" className="w-5 h-5 text-yellow-600" />
                  Motivation & Erfahrungen
                </h2>
                {anlage.motivation && (
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Warum PV?</h3>
                    <p className="text-gray-700 dark:text-gray-300">{anlage.motivation}</p>
                  </div>
                )}
                {anlage.erfahrungen && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Erfahrungen</h3>
                    <p className="text-gray-700 dark:text-gray-300">{anlage.erfahrungen}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tipps */}
            {anlage.tipps_fuer_andere && (
              <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                <h2 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <SimpleIcon type="lightbulb" className="w-5 h-5 text-green-600" />
                  Tipps für andere
                </h2>
                <p className="text-green-800 leading-relaxed">{anlage.tipps_fuer_andere}</p>
              </div>
            )}

            {/* Technische Daten */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <SimpleIcon type="settings" className="w-5 h-5 text-blue-600" />
                Technische Daten
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Leistung</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{anlage.leistung_kwp} kWp</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Inbetriebnahme</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{new Date(anlage.installationsdatum).toLocaleDateString('de-DE')}</div>
                </div>
                {anlage.ausrichtung && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Ausrichtung</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{anlage.ausrichtung}</div>
                  </div>
                )}
                {anlage.neigungswinkel_grad && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Neigungswinkel</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{anlage.neigungswinkel_grad}°</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Komponenten */}
            {komponenten.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <SimpleIcon type="briefcase" className="w-5 h-5 text-blue-600" />
                  Komponenten
                </h2>
                <div className="space-y-3">
                  {komponenten.map((komp) => (
                    <div
                      key={komp.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        komp.typ === 'speicher' ? 'bg-blue-50' :
                        komp.typ === 'e-auto' ? 'bg-green-50' :
                        komp.typ === 'waermepumpe' ? 'bg-orange-50' :
                        komp.typ === 'wechselrichter' ? 'bg-purple-50' :
                        'bg-gray-50'
                      }`}
                    >
                      <SimpleIcon
                        type={
                          komp.typ === 'speicher' ? 'battery' :
                          komp.typ === 'e-auto' ? 'car' :
                          komp.typ === 'waermepumpe' ? 'heat' :
                          komp.typ === 'wechselrichter' ? 'lightning' :
                          'settings'
                        }
                        className={`w-5 h-5 mt-0.5 ${
                          komp.typ === 'speicher' ? 'text-blue-600' :
                          komp.typ === 'e-auto' ? 'text-green-600' :
                          komp.typ === 'waermepumpe' ? 'text-orange-600' :
                          komp.typ === 'wechselrichter' ? 'text-purple-600' :
                          'text-gray-600'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{komp.bezeichnung}</div>
                        <div className="text-xs text-gray-500 capitalize">{komp.typ.replace('-', ' ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mitglied-Bio */}
            {anlage.mitglied_bio && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <SimpleIcon type="user" className="w-5 h-5 text-blue-600" />
                  Über {anlage.mitglied_display_name}
                </h2>
                <p className="text-gray-700 text-sm">{anlage.mitglied_bio}</p>
              </div>
            )}

            {/* Kontakt erwünscht */}
            {anlage.kontakt_erwuenscht && (
              <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                <div className="flex items-start gap-3">
                  <SimpleIcon type="message" className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-green-900 mb-2">Kontakt erwünscht</h3>
                    <p className="text-sm text-green-800">
                      Der Betreiber freut sich über Austausch mit anderen PV-Interessierten.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Datenschutz-Hinweis */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-start gap-3">
                <SimpleIcon type="shield" className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">Datenschutz</h3>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    Diese Anlage wurde vom Eigentümer öffentlich geteilt. Es werden nur die freigegebenen Daten angezeigt.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <Link
            href="/community"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <SimpleIcon type="back" className="w-5 h-5" />
            Zurück zur Community
          </Link>
        </div>
      </div>
    </div>
  )
}
