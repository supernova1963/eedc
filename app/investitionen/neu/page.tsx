// app/investitionen/neu/page.tsx
import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied } from '@/lib/anlagen-helpers'
import InvestitionFormSimple from '@/components/InvestitionFormSimple'

export default async function NeueInvestitionPage() {
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

  if (!mitglied.data) {
    return <div className="p-8 text-center">Mitglied nicht gefunden</div>
  }
  
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-700">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <InvestitionFormSimple mitgliedId={mitglied.data.id} />
      </div>
    </main>
  )
}
