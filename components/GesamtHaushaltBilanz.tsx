'use client'

interface Props {
  monatsdaten: any[]
  anlage: any
  investitionen: any[]
}

export default function GesamtHaushaltBilanz({ monatsdaten, anlage, investitionen }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">💎 Gesamtbilanz Haushalt</h2>
      <p className="text-gray-600">
        Übersicht über alle Investitionen ({investitionen.length} gesamt)
      </p>
      
      <div className="mt-6 space-y-4">
        {investitionen.map((inv) => (
          <div key={inv.id} className="border rounded-lg p-4">
            <h3 className="font-medium">{inv.bezeichnung}</h3>
            <p className="text-sm text-gray-600">{inv.typ}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
