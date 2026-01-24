// app/stammdaten/zuordnung/page.tsx
// Seite für Anlage-Investition-Zuordnung

import { supabase } from '@/lib/supabase'
import InvestitionAnlageZuordnung from '@/components/InvestitionAnlageZuordnung'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'

export default async function ZuordnungPage() {
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/stammdaten"
          className="text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-2"
        >
          <SimpleIcon type="back" className="w-4 h-4" />
          Zurück zu Stammdaten
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Anlage-Investition-Zuordnung
        </h1>
        <p className="text-gray-600">
          Ordne deine Investitionen den zugehörigen Anlagen zu
        </p>
      </div>

      <InvestitionAnlageZuordnung mitglied_id={mitgliedData.id} />
    </div>
  )
}
