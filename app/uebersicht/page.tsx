// app/uebersicht/page.tsx
// Vollständige Monatsdaten-Übersicht mit Bearbeiten-Funktion

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, resolveAnlageId } from '@/lib/anlagen-helpers'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'
import MonatsdatenTable from './MonatsdatenTable'

async function getMonatsdaten(anlageId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('monatsdaten')
    .select('*')
    .eq('anlage_id', anlageId)
    .order('jahr', { ascending: false })
    .order('monat', { ascending: false })

  return data || []
}

async function getInvestitionenMitMonatsdaten(mitgliedId: string) {
  const supabase = await createClient()

  // Investitionen laden
  const { data: investitionen } = await supabase
    .from('investitionen')
    .select('id, typ, bezeichnung')
    .eq('mitglied_id', mitgliedId)
    .eq('aktiv', true)

  if (!investitionen || investitionen.length === 0) {
    return { investitionen: [], investitionMonatsdaten: [] }
  }

  // Investition-Monatsdaten laden
  const { data: investitionMonatsdaten } = await supabase
    .from('investition_monatsdaten')
    .select('id, investition_id, jahr, monat, verbrauch_daten')
    .in('investition_id', investitionen.map(i => i.id))
    .order('jahr', { ascending: false })
    .order('monat', { ascending: false })

  return {
    investitionen: investitionen || [],
    investitionMonatsdaten: investitionMonatsdaten || []
  }
}

export const dynamic = 'force-dynamic'

export default async function UebersichtPage() {
  const mitglied = await getCurrentMitglied()

  if (!mitglied.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Nicht authentifiziert</p>
        </div>
      </div>
    )
  }

  const { anlage } = await resolveAnlageId()
  if (!anlage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Keine Anlage gefunden</p>
          <Link
            href="/anlage"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Jetzt Anlage anlegen
          </Link>
        </div>
      </div>
    )
  }

  const monatsdaten = await getMonatsdaten(anlage.id)
  const { investitionen, investitionMonatsdaten } = await getInvestitionenMitMonatsdaten(mitglied.data.id)

  // Vorhandene Investitionstypen ermitteln
  const vorhandeneTypen = [...new Set(investitionen.map(i => i.typ))]

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
      <div className="bg-white shadow">
        <div className="max-w-full mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SimpleIcon type="file" className="w-8 h-8 text-blue-600" />
                PV-Monatsdaten Übersicht
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Alle erfassten Monatsdaten deiner PV-Anlage - {anlage.anlagenname}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/meine-anlage"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 flex items-center gap-2"
              >
                <SimpleIcon type="back" className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                href="/eingabe"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white flex items-center gap-2"
              >
                <SimpleIcon type="plus" className="w-4 h-4" />
                Daten erfassen
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 py-8">
        {monatsdaten.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Noch keine Monatsdaten erfasst</p>
            <Link
              href="/eingabe"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
            >
              <SimpleIcon type="plus" className="w-5 h-5" />
              Ersten Monat erfassen
            </Link>
          </div>
        ) : (
          <MonatsdatenTable
            initialData={monatsdaten}
            anlageId={anlage.id}
            investitionen={investitionen}
            investitionMonatsdaten={investitionMonatsdaten}
            vorhandeneTypen={vorhandeneTypen}
          />
        )}
      </div>
    </main>
  )
}
