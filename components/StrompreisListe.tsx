// components/StrompreisListe.tsx
// Übersicht der erfassten Strompreise mit Gültigkeitszeiträumen

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import Link from 'next/link'

interface Strompreis {
  id: string
  anlage_id: string | null
  gueltig_ab: string
  gueltig_bis: string | null
  netzbezug_arbeitspreis_cent_kwh: number
  netzbezug_grundpreis_euro_monat: number
  einspeiseverguetung_cent_kwh: number
  anbieter_name: string | null
  vertragsart: string
  anlage?: {
    anlagenname: string
    leistung_kwp: number
  }
}

interface StrompreisListeProps {
  mitglied_id: string
}

export default function StrompreisListe({ mitglied_id }: StrompreisListeProps) {
  const [strompreise, setStrompreise] = useState<Strompreis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStrompreise()
  }, [mitglied_id])

  const loadStrompreise = async () => {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('strompreise')
        .select(`
          *,
          anlage:anlage_id (
            anlagenname,
            leistung_kwp
          )
        `)
        .eq('mitglied_id', mitglied_id)
        .order('gueltig_ab', { ascending: false })

      if (error) throw error
      setStrompreise(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteStrompreis = async (id: string) => {
    if (!confirm('Strompreis wirklich löschen?')) return

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('strompreise')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadStrompreise()
    } catch (err: any) {
      alert('Fehler beim Löschen: ' + err.message)
    }
  }

  const isAktuell = (preis: Strompreis) => {
    const heute = new Date().toISOString().split('T')[0]
    return preis.gueltig_ab <= heute && (!preis.gueltig_bis || preis.gueltig_bis >= heute)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Lade Strompreise...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
        Fehler: {error}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Strompreise ({strompreise.length})
        </h2>
        <Link
          href="/stammdaten/strompreise/neu"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Neuer Strompreis
        </Link>
      </div>

      {strompreise.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p className="mb-4">Noch keine Strompreise erfasst.</p>
          <Link
            href="/stammdaten/strompreise/neu"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Jetzt ersten Strompreis erfassen →
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {strompreise.map(preis => (
            <div
              key={preis.id}
              className={`p-6 hover:bg-gray-50 ${
                isAktuell(preis) ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {preis.anlage
                        ? `${preis.anlage.anlagenname} (${preis.anlage.leistung_kwp} kWp)`
                        : 'Alle Anlagen (Standard)'}
                    </h3>
                    {isAktuell(preis) && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        Aktuell
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <span className="text-sm text-gray-500">Netzbezug:</span>
                      <div className="font-semibold text-gray-900">
                        {preis.netzbezug_arbeitspreis_cent_kwh.toFixed(2)} ct/kWh
                      </div>
                      {preis.netzbezug_grundpreis_euro_monat > 0 && (
                        <div className="text-xs text-gray-600">
                          + {preis.netzbezug_grundpreis_euro_monat.toFixed(2)} €/Monat
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Einspeisung:</span>
                      <div className="font-semibold text-gray-900">
                        {preis.einspeiseverguetung_cent_kwh.toFixed(2)} ct/kWh
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Gültig ab:</span>
                      <div className="font-medium text-gray-900">
                        {new Date(preis.gueltig_ab).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Gültig bis:</span>
                      <div className="font-medium text-gray-900">
                        {preis.gueltig_bis
                          ? new Date(preis.gueltig_bis).toLocaleDateString('de-DE')
                          : 'Unbegrenzt'}
                      </div>
                    </div>
                  </div>

                  {(preis.anbieter_name || preis.vertragsart) && (
                    <div className="flex gap-4 text-sm text-gray-600">
                      {preis.anbieter_name && (
                        <span>Anbieter: {preis.anbieter_name}</span>
                      )}
                      {preis.vertragsart && (
                        <span>Vertragsart: {preis.vertragsart}</span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-gray-200 text-sm">
                    <span className="text-gray-600">Eigenverbrauch lohnt sich: </span>
                    <span className="font-semibold text-green-700">
                      {(preis.netzbezug_arbeitspreis_cent_kwh - preis.einspeiseverguetung_cent_kwh).toFixed(2)} ct/kWh mehr
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Link
                    href={`/stammdaten/strompreise/${preis.id}/bearbeiten`}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-600 rounded"
                  >
                    Bearbeiten
                  </Link>
                  <button
                    onClick={() => deleteStrompreis(preis.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-600 rounded"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hinweis */}
      <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Tipp:</strong> Erfasse deine Strompreise mit Gültigkeitszeiträumen, um historische
          Auswertungen und korrekte Einsparungsberechnungen zu ermöglichen. Bei Preisänderungen
          einfach einen neuen Eintrag mit neuem Gültig-Ab-Datum anlegen.
        </p>
      </div>
    </div>
  )
}
