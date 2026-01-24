// app/anlage/page.tsx
// Vereinfachtes Anlagen-Profil mit Tabs

import { supabase } from '@/lib/supabase'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'
import AnlagenProfilForm from '@/components/AnlagenProfilForm'
import AnlagenFreigabeForm from '@/components/AnlagenFreigabeForm'
import AnlagenTechnischesDaten from '@/components/AnlagenTechnischesDaten'

async function getAnlageData() {
  // Anlage holen
  const { data: anlage } = await supabase
    .from('anlagen')
    .select('*')
    .limit(1)
    .single()

  if (!anlage) return { anlage: null, freigaben: null, mitglied: null }

  // Freigaben holen
  const { data: freigaben } = await supabase
    .from('anlagen_freigaben')
    .select('*')
    .eq('anlage_id', anlage.id)
    .single()

  // Mitglied holen
  const { data: mitglied } = await supabase
    .from('mitglieder')
    .select('id, vorname, nachname, email')
    .eq('id', anlage.mitglied_id)
    .single()

  return { anlage, freigaben, mitglied }
}

export const dynamic = 'force-dynamic'

export default async function AnlagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { anlage, freigaben, mitglied } = await getAnlageData()
  const params = await searchParams
  const activeTab = params.tab || 'profil'

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="home" className="w-8 h-8 text-blue-600" />
              PV-Anlage
            </h1>
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

  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 2 })
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
                {mitglied ? `${mitglied.vorname} ${mitglied.nachname}` : 'Mitglied'} · {anlage.standort_ort || 'Standort'}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/investitionen"
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md font-medium flex items-center gap-2"
              >
                <SimpleIcon type="briefcase" className="w-4 h-4 text-purple-600" />
                Investitionen
              </Link>
              <Link
                href="/"
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
                href="/anlage?tab=profil"
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
                href="/anlage?tab=freigabe"
                className={`${
                  activeTab === 'freigabe'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="link" className="w-4 h-4" />
                Freigabe
              </Link>

              <Link
                href="/anlage?tab=technisch"
                className={`${
                  activeTab === 'technisch'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <SimpleIcon type="settings" className="w-4 h-4" />
                Technische Daten
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'profil' && (
          <AnlagenProfilForm anlage={anlage} mitglied={mitglied} />
        )}

        {activeTab === 'freigabe' && (
          <AnlagenFreigabeForm anlage={anlage} freigaben={freigaben} />
        )}

        {activeTab === 'technisch' && (
          <AnlagenTechnischesDaten anlage={anlage} />
        )}
      </div>
    </main>
  )
}
