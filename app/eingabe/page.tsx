// app/eingabe/page.tsx
// Monatsdaten-Erfassung mit dynamischem Formular
// Lädt Investitionen aus investitionen-Tabelle

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getUserAnlagen, resolveAnlageId } from '@/lib/anlagen-helpers'
import MonatsdatenFormDynamic from '@/components/MonatsdatenFormDynamic'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'
import { AnlagenSelector } from '@/components/AnlagenSelector'

async function getInvestitionen(mitgliedId: string) {
  const supabase = await createClient()

  // Alle aktiven Investitionen des Mitglieds holen
  const { data } = await supabase
    .from('investitionen')
    .select('id, typ, bezeichnung, parameter')
    .eq('mitglied_id', mitgliedId)
    .eq('aktiv', true)
    .order('typ')
    .order('bezeichnung')

  return data || []
}

export const dynamic = 'force-dynamic'

export default async function EingabePage({
  searchParams
}: {
  searchParams: Promise<{ anlageId?: string }>
}) {
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

  // Alle Anlagen des Users holen
  const { data: alleAnlagen } = await getUserAnlagen()

  // Bestimme welche Anlage verwendet werden soll
  const params = await searchParams
  const { anlageId, anlage } = await resolveAnlageId(params.anlageId)

  if (!anlage) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Keine Anlage gefunden</p>
            <Link
              href="/anlage"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Jetzt Anlage anlegen
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Investitionen laden
  const investitionen = await getInvestitionen(mitglied.data.id)

  // Gruppiere nach Typ für Info-Anzeige
  const investitionenNachTyp = {
    wechselrichter: investitionen.filter(i => i.typ === 'wechselrichter'),
    speicher: investitionen.filter(i => i.typ === 'speicher'),
    eAuto: investitionen.filter(i => i.typ === 'e-auto'),
    waermepumpe: investitionen.filter(i => i.typ === 'waermepumpe'),
    sonstige: investitionen.filter(i => !['wechselrichter', 'speicher', 'e-auto', 'waermepumpe'].includes(i.typ))
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SimpleIcon type="plus" className="w-8 h-8 text-blue-600" />
                Monatsdaten erfassen
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {anlage.anlagenname} - {anlage.leistung_kwp} kWp
              </p>
            </div>
            <div className="flex items-center gap-4">
              {alleAnlagen && alleAnlagen.length > 1 && (
                <AnlagenSelector
                  anlagen={alleAnlagen}
                  currentAnlageId={anlageId}
                />
              )}
              <Link
                href="/meine-anlage"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 flex items-center gap-2"
              >
                <SimpleIcon type="back" className="w-4 h-4" />
                Dashboard
              </Link>
            </div>
          </div>

          {/* Info über vorhandene Investitionen */}
          <div className="mt-4 flex flex-wrap gap-2">
            {investitionenNachTyp.wechselrichter.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                <SimpleIcon type="sun" className="w-4 h-4" />
                {investitionenNachTyp.wechselrichter.length} Wechselrichter
              </span>
            )}
            {investitionenNachTyp.speicher.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <SimpleIcon type="battery" className="w-4 h-4" />
                {investitionenNachTyp.speicher.length} Speicher
              </span>
            )}
            {investitionenNachTyp.eAuto.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                <SimpleIcon type="car" className="w-4 h-4" />
                {investitionenNachTyp.eAuto.length} E-Auto
              </span>
            )}
            {investitionenNachTyp.waermepumpe.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                <SimpleIcon type="heat" className="w-4 h-4" />
                {investitionenNachTyp.waermepumpe.length} Wärmepumpe
              </span>
            )}
            {investitionen.length === 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                Keine Investitionen erfasst - PV-Erzeugung direkt eingeben
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <MonatsdatenFormDynamic
          anlage={anlage}
          investitionen={investitionen}
        />

        {/* Hinweis wenn keine Investitionen */}
        {investitionen.length === 0 && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">Tipp: Investitionen erfassen</h3>
            <p className="text-sm text-amber-700 mb-3">
              Erfasse deine Komponenten (Wechselrichter, Speicher, E-Auto, Wärmepumpe) als Investitionen,
              um detailliertere Auswertungen und ROI-Berechnungen zu erhalten.
            </p>
            <Link
              href="/investitionen/neu"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm"
            >
              <SimpleIcon type="plus" className="w-4 h-4" />
              Investition erfassen
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
