'use client'

interface Props {
  investition: any
  prognoseVergleich: any
  monatsdaten: any[]
}

export default function EAutoAuswertung({ investition, prognoseVergleich, monatsdaten }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">
          🚗 {investition.bezeichnung} - Details
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600">Erfasste Monate</p>
            <p className="text-2xl font-bold">{monatsdaten.length}</p>
          </div>
          
          {prognoseVergleich && (
            <div>
              <p className="text-sm text-gray-600">Prognose vs. Ist</p>
              <p className="text-2xl font-bold text-green-600">✓ Verfügbar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
