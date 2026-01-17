'use client'

interface Props {
  monatsdaten: any[]
  anlage: any
}

export default function WirtschaftlichkeitStats({ monatsdaten, anlage }: Props) {
  const gesamtErzeugung = monatsdaten.reduce((sum, d) => sum + d.pv_erzeugung_kwh, 0)
  const gesamtEigenverbrauch = monatsdaten.reduce((sum, d) => sum + d.eigenverbrauch_kwh, 0)
  const durchschnittAutarkie = monatsdaten.reduce((sum, d) => sum + d.autarkie_prozent, 0) / monatsdaten.length

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">📈 Wirtschaftlichkeit PV-Anlage</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600">Gesamt-Erzeugung</p>
            <p className="text-2xl font-bold text-yellow-600">{gesamtErzeugung.toFixed(0)} kWh</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Eigenverbrauch</p>
            <p className="text-2xl font-bold text-green-600">{gesamtEigenverbrauch.toFixed(0)} kWh</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Ø Autarkie</p>
            <p className="text-2xl font-bold text-purple-600">{durchschnittAutarkie.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}
