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
          <p className="text-gray-600">Nicht authentifiziert</p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  const { data: mitglied } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('id', mitglied.data.id)
    .single()

  if (!mitglied) {
    return <div className="p-8 text-center">Mitglied nicht gefunden</div>
  }
  
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <InvestitionFormSimple mitgliedId={mitglied.id} />
      </div>
    </main>
  )
}
