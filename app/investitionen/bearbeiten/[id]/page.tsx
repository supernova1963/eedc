// app/investitionen/bearbeiten/[id]/page.tsx
import { createClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth'
import InvestitionFormSimple from '@/components/InvestitionFormSimple'

async function getInvestition(userId: string, id: string) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('alternative_investitionen')
    .select('*')
    .eq('id', id)
    .eq('mitglied_id', userId)
    .single()
  return data
}

export default async function BearbeitenPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Nicht authentifiziert</p>
        </div>
      </div>
    )
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: mitglied } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('id', user.id)
    .single()

  const investition = await getInvestition(user.id, id)

  if (!mitglied || !investition) {
    return <div className="p-8 text-center">Nicht gefunden</div>
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <InvestitionFormSimple mitgliedId={mitglied.id} editData={investition} />
      </div>
    </main>
  )
}
