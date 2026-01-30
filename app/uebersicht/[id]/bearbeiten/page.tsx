// app/uebersicht/[id]/bearbeiten/page.tsx
// Monatsdaten bearbeiten - nutzt das gleiche Formular wie Eingabe

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, resolveAnlageId } from '@/lib/anlagen-helpers'
import MonatsdatenFormDynamic from '@/components/MonatsdatenFormDynamic'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'
import { redirect } from 'next/navigation'

async function getMonatsdaten(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('monatsdaten')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Fehler beim Laden:', error)
    return null
  }

  return data
}

async function getInvestitionen(mitgliedId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('alternative_investitionen')
    .select('id, typ, bezeichnung, parameter')
    .eq('mitglied_id', mitgliedId)
    .eq('aktiv', true)
    .order('typ')
    .order('bezeichnung')

  return data || []
}

export const dynamic = 'force-dynamic'

export default async function BearbeitenPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const mitglied = await getCurrentMitglied()

  if (!mitglied.data) {
    redirect('/login')
  }

  const monatsdaten = await getMonatsdaten(id)

  if (!monatsdaten) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <SimpleIcon type="warning" className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Monatsdaten nicht gefunden</p>
          <Link
            href="/uebersicht"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Zurück zur Übersicht
          </Link>
        </div>
      </main>
    )
  }

  // Anlage laden und prüfen ob sie dem User gehört
  const { anlage } = await resolveAnlageId(monatsdaten.anlage_id)

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <SimpleIcon type="warning" className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Keine Berechtigung</p>
          <Link
            href="/uebersicht"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Zurück zur Übersicht
          </Link>
        </div>
      </main>
    )
  }

  // Investitionen laden
  const investitionen = await getInvestitionen(mitglied.data.id)

  const monatsnamen = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SimpleIcon type="edit" className="w-8 h-8 text-blue-600" />
                Monatsdaten bearbeiten
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {monatsnamen[monatsdaten.monat]} {monatsdaten.jahr} - {anlage.anlagenname}
              </p>
            </div>
            <Link
              href="/uebersicht"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 flex items-center gap-2"
            >
              <SimpleIcon type="back" className="w-4 h-4" />
              Zur Übersicht
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <MonatsdatenFormDynamic
          anlage={anlage}
          investitionen={investitionen}
          existingData={monatsdaten}
        />
      </div>
    </main>
  )
}
