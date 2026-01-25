// app/community/[id]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import Breadcrumb from '@/components/Breadcrumb'

interface PublicAnlageDetail {
  id: string
  anlagenname: string
  anlagentyp: string
  installationsdatum: string
  leistung_kwp: number
  standort_ort?: string
  standort_plz?: string
  profilbeschreibung?: string
  hersteller?: string
  modell?: string
  anzahl_module?: number
  wechselrichter_modell?: string
  ausrichtung?: string
  neigungswinkel_grad?: number
  batteriekapazitaet_kwh?: number
  batterie_hersteller?: string
  batterie_modell?: string
  ekfz_vorhanden?: boolean
  ekfz_bezeichnung?: string
  waermepumpe_vorhanden?: boolean
  waermepumpe_bezeichnung?: string
  mitglied_vorname?: string
  mitglied_ort?: string
  freigaben: {
    kennzahlen_oeffentlich: boolean
    monatsdaten_oeffentlich: boolean
    auswertungen_oeffentlich: boolean
  }
}

interface Kennzahlen {
  gesamterzeugung_kwh: number
  gesamteinspeisung_kwh: number
  gesamtverbrauch_kwh: number
  autarkiegrad_prozent: number
  eigenverbrauchsquote_prozent: number
  co2_einsparung_kg: number
}

export default function CommunityAnlageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [anlage, setAnlage] = useState<PublicAnlageDetail | null>(null)
  const [kennzahlen, setKennzahlen] = useState<Kennzahlen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAnlage()
  }, [id])

  async function loadAnlage() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/community/anlagen/${id}?kennzahlen=true`)
      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Anlage nicht gefunden')
        return
      }

      setAnlage(data.data)
      setKennzahlen(data.kennzahlen || null)
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
          <p className="mt-4 text-gray-600">Lade Anlage...</p>
        </div>
      </div>
    )
  }

  if (error || !anlage) {
    return (
      <div className="min-h-screen bg-gray-50">
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
    <div className="min-h-screen bg-gray-50">
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

          {anlage.mitglied_vorname && (
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-white/90">
                Geteilt von <span className="font-semibold">{anlage.mitglied_vorname}</span> aus {anlage.mitglied_ort}
              </p>
            </div>
          )}
        </div>

        {/* Kennzahlen */}
        {kennzahlen && anlage.freigaben.kennzahlen_oeffentlich && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <SimpleIcon type="sun" className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="text-sm text-gray-600">Gesamterzeugung</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {(kennzahlen.gesamterzeugung_kwh / 1000).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">MWh</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <SimpleIcon type="target" className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-sm text-gray-600">Autarkiegrad</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {kennzahlen.autarkiegrad_prozent?.toFixed(1) || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">%</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <SimpleIcon type="tree" className="w-6 h-6 text-green-700" />
                </div>
                <div className="text-sm text-gray-600">CO₂-Einsparung</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {(kennzahlen.co2_einsparung_kg / 1000).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Tonnen</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hauptinfos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Beschreibung */}
            {anlage.profilbeschreibung && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <SimpleIcon type="info" className="w-5 h-5 text-blue-600" />
                  Beschreibung
                </h2>
                <p className="text-gray-700 leading-relaxed">{anlage.profilbeschreibung}</p>
              </div>
            )}

            {/* Technische Daten */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <SimpleIcon type="settings" className="w-5 h-5 text-blue-600" />
                Technische Daten
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Anlagentyp</div>
                  <div className="font-medium text-gray-900">{anlage.anlagentyp}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Leistung</div>
                  <div className="font-medium text-gray-900">{anlage.leistung_kwp} kWp</div>
                </div>
                {anlage.hersteller && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Hersteller</div>
                    <div className="font-medium text-gray-900">{anlage.hersteller}</div>
                  </div>
                )}
                {anlage.modell && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Modell</div>
                    <div className="font-medium text-gray-900">{anlage.modell}</div>
                  </div>
                )}
                {anlage.anzahl_module && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Anzahl Module</div>
                    <div className="font-medium text-gray-900">{anlage.anzahl_module}</div>
                  </div>
                )}
                {anlage.wechselrichter_modell && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Wechselrichter</div>
                    <div className="font-medium text-gray-900">{anlage.wechselrichter_modell}</div>
                  </div>
                )}
                {anlage.ausrichtung && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Ausrichtung</div>
                    <div className="font-medium text-gray-900">{anlage.ausrichtung}</div>
                  </div>
                )}
                {anlage.neigungswinkel_grad && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Neigungswinkel</div>
                    <div className="font-medium text-gray-900">{anlage.neigungswinkel_grad}°</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Komponenten */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <SimpleIcon type="briefcase" className="w-5 h-5 text-blue-600" />
                Komponenten
              </h2>
              <div className="space-y-3">
                {anlage.batteriekapazitaet_kwh && anlage.batteriekapazitaet_kwh > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <SimpleIcon type="battery" className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Batteriespeicher</div>
                      <div className="text-sm text-gray-600">{anlage.batteriekapazitaet_kwh} kWh</div>
                      {anlage.batterie_hersteller && (
                        <div className="text-xs text-gray-500 mt-1">
                          {anlage.batterie_hersteller} {anlage.batterie_modell}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {anlage.ekfz_vorhanden && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <SimpleIcon type="car" className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">E-Fahrzeug</div>
                      {anlage.ekfz_bezeichnung && (
                        <div className="text-sm text-gray-600">{anlage.ekfz_bezeichnung}</div>
                      )}
                    </div>
                  </div>
                )}

                {anlage.waermepumpe_vorhanden && (
                  <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                    <SimpleIcon type="heat" className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Wärmepumpe</div>
                      {anlage.waermepumpe_bezeichnung && (
                        <div className="text-sm text-gray-600">{anlage.waermepumpe_bezeichnung}</div>
                      )}
                    </div>
                  </div>
                )}

                {!anlage.batteriekapazitaet_kwh && !anlage.ekfz_vorhanden && !anlage.waermepumpe_vorhanden && (
                  <p className="text-sm text-gray-500">Keine zusätzlichen Komponenten</p>
                )}
              </div>
            </div>

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
