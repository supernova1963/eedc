// app/stammdaten/strompreise/[id]/bearbeiten/page.tsx
// Seite zum Bearbeiten eines bestehenden Strompreises

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied } from '@/lib/anlagen-helpers'
import StrompreisForm from '@/components/StrompreisForm'
import SimpleIcon from '@/components/SimpleIcon'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface BearbeitenPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function StrompreisBearbeitenPage({ params }: BearbeitenPageProps) {
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

  const { id } = await params
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

  // Hole Strompreis-Daten
  const { data: strompreis, error } = await supabase
    .from('strompreise')
    .select('*')
    .eq('id', id)
    .eq('mitglied_id', mitgliedData.id)
    .single()

  if (error || !strompreis) {
    notFound()
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
          Strompreis bearbeiten
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Aktualisiere die Strompreis-Informationen
        </p>
      </div>

      <StrompreisForm
        mitglied_id={mitgliedData.id}
        editData={strompreis}
      />
    </div>
  )
}
