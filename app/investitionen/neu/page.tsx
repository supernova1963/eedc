// app/investitionen/neu/page.tsx
import { supabase } from '@/lib/supabase'
import InvestitionFormSimple from '@/components/InvestitionFormSimple'

async function getUserData() {
  const { data } = await supabase.from('mitglieder').select('*').limit(1).single()
  return data
}

export default async function NeueInvestitionPage() {
  const mitglied = await getUserData()
  if (!mitglied) return <div>Kein Mitglied gefunden</div>
  
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <InvestitionFormSimple mitgliedId={mitglied.id} />
      </div>
    </main>
  )
}
