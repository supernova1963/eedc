// app/investitionen/bearbeiten/[id]/page.tsx
import { supabase } from '@/lib/supabase'
import InvestitionFormSimple from '@/components/InvestitionFormSimple'

async function getInvestition(id: string) {
  const { data } = await supabase.from('alternative_investitionen').select('*').eq('id', id).single()
  return data
}

async function getUserData() {
  const { data } = await supabase.from('mitglieder').select('*').limit(1).single()
  return data
}

export default async function BearbeitenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mitglied = await getUserData()
  const investition = await getInvestition(id)
  
  if (!mitglied || !investition) return <div>Nicht gefunden</div>

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <InvestitionFormSimple mitgliedId={mitglied.id} editData={investition} />
      </div>
    </main>
  )
}
