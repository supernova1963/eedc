// app/anlage/page.tsx
// Vereinfachtes Anlagen-Profil mit Tabs

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getUserAnlagen, resolveAnlageId } from '@/lib/anlagen-helpers'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'
import AnlagenProfilForm from '@/components/AnlagenProfilForm'
import AnlagenFreigabeForm from '@/components/AnlagenFreigabeForm'
import { AnlagenSelector } from '@/components/AnlagenSelector'

async function getAnlageFreigaben(anlageId: string) {
  const supabase = await createClient()

  // FRESH-START: Freigaben sind jetzt direkt in der anlagen Tabelle
  const { data: anlage } = await supabase
    .from('anlagen')
    .select('oeffentlich, standort_genau_anzeigen, kennzahlen_oeffentlich, monatsdaten_oeffentlich, komponenten_oeffentlich')
    .eq('id', anlageId)
    .single()

  if (!anlage) return null

  // Rückgabe im alten Format für Kompatibilität mit AnlagenFreigabeForm
  return {
    anlage_id: anlageId,
    profil_oeffentlich: anlage.oeffentlich,
    standort_genau: anlage.standort_genau_anzeigen,
    kennzahlen_oeffentlich: anlage.kennzahlen_oeffentlich,
    monatsdaten_oeffentlich: anlage.monatsdaten_oeffentlich,
    investitionen_oeffentlich: anlage.komponenten_oeffentlich, // Mapping: komponenten → investitionen (für alte Form)
    auswertungen_oeffentlich: false, // Deprecated, wird nicht mehr verwendet
  }
}

export const dynamic = 'force-dynamic'

export default async function AnlagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; anlageId?: string }>
}) {
  const mitglied = await getCurrentMitglied()

  if (!mitglied.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Nicht authentifiziert</p>
        </div>
      </div>
    )
  }

  const params = await searchParams
  const { data: alleAnlagen } = await getUserAnlagen()
  const { anlageId, anlage } = await resolveAnlageId(params.anlageId)
  const activeTab = params.tab || 'profil'

  const freigaben = anlage ? await getAnlageFreigaben(anlage.id) : null

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="sun" className="w-8 h-8 text-yellow-500" />
              Meine Anlagen
            </h1>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-dashed border-gray-300">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                <SimpleIcon type="sun" className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Willkommen bei EEDC!
              </h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Sie haben noch keine PV-Anlage erfasst. Legen Sie jetzt Ihre erste Anlage an,
                um mit der Erfassung und Auswertung Ihrer Energiedaten zu beginnen.
              </p>
            </div>

            <div className="space-y-4">
              <Link
                href="/anlage/neu"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition shadow-lg font-semibold text-lg"
              >
                <SimpleIcon type="plus" className="w-6 h-6" />
                Erste Anlage erstellen
              </Link>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Nächste Schritte:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Anlage erfassen</h4>
                      <p className="text-sm text-gray-600">
                        Geben Sie die Stammdaten Ihrer PV-Anlage ein
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Daten erfassen</h4>
                      <p className="text-sm text-gray-600">
                        Erfassen Sie Ihre monatlichen Energiedaten
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Auswerten</h4>
                      <p className="text-sm text-gray-600">
                        Analysieren Sie Ihre Kennzahlen und ROI
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SimpleIcon type="home" className="w-8 h-8 text-blue-600" />
                {anlage.anlagenname || 'PV-Anlage'}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {mitglied.data ? `${mitglied.data.vorname} ${mitglied.data.nachname}` : 'Mitglied'} · {anlage.standort_ort || 'Standort'}
              </p>
            </div>
            <div className="flex gap-3">
              {alleAnlagen && alleAnlagen.length > 1 && (
                <AnlagenSelector
                  anlagen={alleAnlagen}
                  currentAnlageId={anlageId}
                />
              )}
              <Link
                href="/investitionen"
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md font-medium flex items-center gap-2"
              >
                <SimpleIcon type="briefcase" className="w-4 h-4 text-purple-600" />
                Investitionen
              </Link>
              <Link
                href="/meine-anlage"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 flex items-center gap-2"
              >
                <SimpleIcon type="back" className="w-4 h-4" />
                Dashboard
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <Link
                href={`/anlage?tab=profil${anlageId ? `&anlageId=${anlageId}` : ''}`}
                className={`${
                  activeTab === 'profil'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="file" className="w-4 h-4" />
                Profil
              </Link>

              <Link
                href={`/anlage?tab=freigabe${anlageId ? `&anlageId=${anlageId}` : ''}`}
                className={`${
                  activeTab === 'freigabe'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="link" className="w-4 h-4" />
                Freigabe & Vorschau
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'profil' && (
          <AnlagenProfilForm anlage={anlage} mitglied={mitglied.data} />
        )}

        {activeTab === 'freigabe' && (
          <AnlagenFreigabeForm anlage={anlage} freigaben={freigaben} />
        )}
      </div>
    </main>
  )
}
