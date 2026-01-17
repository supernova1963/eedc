// app/investitionen/page.tsx
// Korrigierte Version mit DeleteButton als Client Component

import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import DeleteButton from '@/components/DeleteButton'

async function getInvestitionen() {
  const { data } = await supabase
    .from('investitionen_uebersicht')
    .select('*')
    .order('anschaffungsdatum', { ascending: false })

  return data || []
}

async function deleteInvestition(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  
  await supabase
    .from('alternative_investitionen')
    .delete()
    .eq('id', id)
  
  revalidatePath('/investitionen')
}

export const dynamic = 'force-dynamic'

export default async function InvestitionenPage() {
  const investitionen = await getInvestitionen()

  const formatCurrency = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'
  }

  const formatPercent = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toFixed(1) + '%'
  }

  const getIcon = (typ: string) => {
    const icons: Record<string, string> = {
      'e-auto': '🚗',
      'waermepumpe': '🔥',
      'speicher': '🔋',
      'balkonkraftwerk': '☀️',
      'wallbox': '⚡',
      'sonstiges': '📦'
    }
    return icons[typ] || '📦'
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                💼 Verwaltung Investitionen
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Alle Energie-Investitionen verwalten, bearbeiten und löschen
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/auswertung?tab=gesamt"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
              >
                📊 Zur Auswertung
              </Link>
              <Link
                href="/investitionen/neu"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
              >
                ➕ Neue Investition
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {investitionen.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">
              Noch keine Investitionen erfasst.
            </p>
            <Link
              href="/investitionen/neu"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white"
            >
              ➕ Erste Investition erfassen
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
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
              <tbody className="bg-white divide-y divide-gray-200">
                {investitionen.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{getIcon(inv.typ)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {inv.bezeichnung}
                          </div>
                          <div className="text-xs text-gray-500">
                            {inv.alternativ_beschreibung && `vs. ${inv.alternativ_beschreibung} • `}
                            seit {new Date(inv.anschaffungsdatum).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {formatCurrency(inv.anschaffungskosten_gesamt)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-blue-600">
                      +{formatCurrency(inv.anschaffungskosten_relevant)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                      {formatCurrency(inv.einsparung_gesamt_jahr)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {formatPercent(inv.roi_prozent)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {inv.amortisation_jahre ? `${inv.amortisation_jahre.toFixed(1)} J.` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/investitionen/bearbeiten/${inv.id}`}
                          className="text-blue-600 hover:text-blue-900"
                          title="Bearbeiten"
                        >
                          ✏️
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
