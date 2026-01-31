// app/investitionen/page.tsx
// Korrigierte Version mit DeleteButton als Client Component

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied } from '@/lib/anlagen-helpers'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import DeleteButton from '@/components/DeleteButton'
import SimpleIcon from '@/components/SimpleIcon'

async function getInvestitionen(mitgliedId: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('investitionen_uebersicht')
    .select('*')
    .eq('mitglied_id', mitgliedId)
    .order('anschaffungsdatum', { ascending: false })

  return data || []
}

async function deleteInvestition(formData: FormData) {
  'use server'
  const id = formData.get('id') as string

  const supabase = await createClient()

  // Lösche aus investitionen Tabelle (früher alternative_investitionen)
  // Die zugehörigen investition_monatsdaten werden via ON DELETE CASCADE gelöscht
  const { error } = await supabase
    .from('investitionen')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Fehler beim Löschen der Investition:', error)
  }

  revalidatePath('/investitionen')
}

export const dynamic = 'force-dynamic'

export default async function InvestitionenPage() {
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

  const investitionen = await getInvestitionen(mitglied.data.id)

  const formatCurrency = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'
  }

  const formatPercent = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toFixed(1) + '%'
  }

  const getIconType = (typ: string) => {
    const icons: Record<string, string> = {
      'e-auto': 'car',
      'waermepumpe': 'heat',
      'speicher': 'battery',
      'balkonkraftwerk': 'solar',
      'wallbox': 'wallbox',
      'wechselrichter': 'inverter',
      'sonstiges': 'box'
    }
    return icons[typ] || 'box'
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <SimpleIcon type="briefcase" className="w-8 h-8 text-purple-600" />
                Verwaltung Investitionen
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Alle Energie-Investitionen verwalten, bearbeiten und löschen
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/auswertung?tab=gesamt"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700 flex items-center gap-2"
              >
                <SimpleIcon type="chart" className="w-4 h-4" />
                Zur Auswertung
              </Link>
              <Link
                href="/investitionen/neu"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white flex items-center gap-2"
              >
                <SimpleIcon type="plus" className="w-4 h-4" />
                Neue Investition
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {investitionen.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">
              Noch keine Investitionen erfasst.
            </p>
            <Link
              href="/investitionen/neu"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
            >
              <SimpleIcon type="plus" className="w-5 h-5" />
              Erste Investition erfassen
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Investition
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Anschaffung
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mehrkosten
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Einsparung/Jahr
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ROI
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amortisation
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                {investitionen.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="mr-3">
                          <SimpleIcon type={getIconType(inv.typ)} className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {inv.bezeichnung}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {inv.alternativ_beschreibung && `vs. ${inv.alternativ_beschreibung} • `}
                            seit {new Date(inv.anschaffungsdatum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(inv.anschaffungskosten_gesamt)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-blue-600">
                      +{formatCurrency(inv.anschaffungskosten_relevant)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                      {formatCurrency(inv.einsparung_gesamt_jahr)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-gray-100">
                      {formatPercent(inv.roi_prozent)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-gray-100">
                      {inv.amortisation_jahre ? `${inv.amortisation_jahre.toFixed(1)} J.` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/investitionen/bearbeiten/${inv.id}`}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Bearbeiten"
                        >
                          <SimpleIcon type="edit" className="w-4 h-4" />
                        </Link>
                        <DeleteButton
                          investitionId={inv.id}
                          bezeichnung={inv.bezeichnung}
                          deleteAction={deleteInvestition}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
