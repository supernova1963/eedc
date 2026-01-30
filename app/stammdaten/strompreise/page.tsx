// app/stammdaten/strompreise/page.tsx
// Übersichtsseite für Strompreise

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied } from '@/lib/anlagen-helpers'
import StrompreisListe from '@/components/StrompreisListe'

export default async function StrompreisePage() {
  const mitglied = await getCurrentMitglied()

  if (!mitglied.data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Nicht authentifiziert
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  const { data: mitgliedData } = await supabase
    .from('mitglieder')
    .select('id, vorname, nachname')
    .eq('id', mitglied.data.id)
    .single()

  if (!mitgliedData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Mitglied nicht gefunden
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Strompreise</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Verwalte deine Strompreise mit Gültigkeitszeiträumen
        </p>
      </div>

      <StrompreisListe mitglied_id={mitgliedData.id} />
    </div>
  )
}
