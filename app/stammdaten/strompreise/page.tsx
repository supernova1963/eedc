// app/stammdaten/strompreise/page.tsx
// Übersichtsseite für Strompreise

import { supabase } from '@/lib/supabase'
import StrompreisListe from '@/components/StrompreisListe'

export default async function StrompreisePage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Strompreise</h1>
        <p className="text-gray-600">
          Verwalte deine Strompreise mit Gültigkeitszeiträumen
        </p>
      </div>

      <StrompreisListe mitglied_id={mitgliedData.id} />
    </div>
  )
}
