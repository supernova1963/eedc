// app/stammdaten/strompreise/neu/page.tsx
// Seite zum Erfassen eines neuen Strompreises

import { supabase } from '@/lib/supabase'
import StrompreisForm from '@/components/StrompreisForm'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'

export default async function NeuerStrompreisPage() {
  // Hole Mitglied (vereinfacht - in Produktion mit Auth)
  const { data: mitgliedData } = await supabase
    .from('mitglieder')
    .select('id, vorname, nachname')
    .limit(1)
    .single()

  if (!mitgliedData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Kein Mitglied gefunden. Bitte zuerst Mitglied anlegen.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/stammdaten/strompreise"
          className="text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-2"
        >
          <SimpleIcon type="back" className="w-4 h-4" />
          Zurück zur Übersicht
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Neuer Strompreis
        </h1>
        <p className="text-gray-600">
          Erfasse einen neuen Strompreis mit Gültigkeitszeitraum
        </p>
      </div>

      <StrompreisForm mitglied_id={mitgliedData.id} />
    </div>
  )
}
