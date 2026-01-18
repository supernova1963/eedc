// app/anlage/page.tsx
// Verwaltung der Haupt-PV-Anlage

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AnlageEditForm from '@/components/AnlageEditForm'

async function getAnlage() {
  const { data: anlage } = await supabase
    .from('anlagen')
    .select('*')
    .limit(1)
    .single()

  return anlage
}

export const dynamic = 'force-dynamic'

export default async function AnlagePage() {
  const anlage = await getAnlage()

  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">⚙️ PV-Anlage</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Keine Anlage gefunden.</p>
            <p className="text-sm text-gray-400">Bitte lege zunächst eine PV-Anlage in der Datenbank an.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                ⚙️ PV-Anlage Stammdaten
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Haupt-PV-Anlage verwalten und bearbeiten
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Aktuelle Daten */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            📊 Aktuelle Stammdaten
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-600">Standort</div>
              <div className="text-lg font-medium text-gray-900">{anlage.standort || '-'}</div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Inbetriebnahme</div>
              <div className="text-lg font-medium text-gray-900">
                {anlage.inbetriebnahme 
                  ? new Date(anlage.inbetriebnahme).toLocaleDateString('de-DE', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  : '-'
                }
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Nennleistung (kWp)</div>
              <div className="text-lg font-medium text-gray-900">{anlage.nennleistung_kwp || '-'} kWp</div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Anschaffungskosten</div>
              <div className="text-lg font-medium text-gray-900">{fmt(anlage.anschaffungskosten)} €</div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Einspeisevergütung</div>
              <div className="text-lg font-medium text-gray-900">
                {anlage.einspeisetarif_cent_kwh || '-'} ct/kWh
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Strompreis (Bezug)</div>
              <div className="text-lg font-medium text-gray-900">
                {anlage.strompreis_cent_kwh || '-'} ct/kWh
              </div>
            </div>

            {anlage.hersteller && (
              <div>
                <div className="text-sm text-gray-600">Hersteller</div>
                <div className="text-lg font-medium text-gray-900">{anlage.hersteller}</div>
              </div>
            )}

            {anlage.wechselrichter && (
              <div>
                <div className="text-sm text-gray-600">Wechselrichter</div>
                <div className="text-lg font-medium text-gray-900">{anlage.wechselrichter}</div>
              </div>
            )}
          </div>

          {anlage.notizen && (
            <div className="mt-6 pt-6 border-t">
              <div className="text-sm text-gray-600 mb-2">Notizen</div>
              <div className="text-gray-900 whitespace-pre-wrap">{anlage.notizen}</div>
            </div>
          )}
        </div>

        {/* Edit Form */}
        <AnlageEditForm anlage={anlage} />
      </div>
    </main>
  )
}
