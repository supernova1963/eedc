// app/investition/erfassen/page.tsx
// Seite zum Erfassen neuer Investitionen

import { supabase } from '@/lib/supabase'
import InvestitionForm from '@/components/InvestitionForm'
import Link from 'next/link'

async function getUserData() {
  const { data: mitglieder } = await supabase
    .from('mitglieder')
    .select('*')
    .limit(1)
    .single()

  return mitglieder
}

export default async function InvestitionErfassenPage() {
  const mitglied = await getUserData()

  if (!mitglied) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              ➕ Investition erfassen
            </h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              Kein Mitglied gefunden.
            </p>
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
                ➕ Investition erfassen
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                E-Auto, Wärmepumpe, Speicher oder andere Energie-Investitionen
              </p>
            </div>
            <Link
              href="/auswertung?tab=gesamt"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md font-medium text-gray-700"
            >
              ← Zurück zur Auswertung
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InvestitionForm mitgliedId={mitglied.id} />
      </div>
    </main>
  )
}
