'use client'

interface Monatsdaten {
  id: number
  jahr: number
  monat: number
  stromverbrauch_kwh: number
  pv_erzeugung_kwh: number
  einspeisung_kwh: number
  netzbezug_kwh: number
  eigenverbrauch_kwh: number
  autarkie_prozent: number
  eigenverbrauchsquote_prozent: number
}

interface Props {
  monatsdaten: Monatsdaten[]
}

export default function DashboardStats({ monatsdaten }: Props) {
  if (monatsdaten.length === 0) return null

  const gesamtVerbrauch = monatsdaten.reduce((sum, d) => sum + d.stromverbrauch_kwh, 0)
  const gesamtErzeugung = monatsdaten.reduce((sum, d) => sum + d.pv_erzeugung_kwh, 0)
  const gesamtEigenverbrauch = monatsdaten.reduce((sum, d) => sum + d.eigenverbrauch_kwh, 0)
  const durchschnittAutarkie = monatsdaten.reduce((sum, d) => sum + d.autarkie_prozent, 0) / monatsdaten.length

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Gesamt-Verbrauch"
        value={`${gesamtVerbrauch.toFixed(0)} kWh`}
        icon="⚡"
        color="blue"
      />
      <StatCard
        title="PV-Erzeugung"
        value={`${gesamtErzeugung.toFixed(0)} kWh`}
        icon="☀️"
        color="yellow"
      />
      <StatCard
        title="Eigenverbrauch"
        value={`${gesamtEigenverbrauch.toFixed(0)} kWh`}
        icon="🏠"
        color="green"
      />
      <StatCard
        title="Ø Autarkie"
        value={`${durchschnittAutarkie.toFixed(1)}%`}
        icon="📊"
        color="purple"
      />
    </div>
  )
}

function StatCard({ title, value, icon, color }: {
  title: string
  value: string
  icon: string
  color: 'blue' | 'yellow' | 'green' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`text-4xl ${colorClasses[color]} rounded-full p-3`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
