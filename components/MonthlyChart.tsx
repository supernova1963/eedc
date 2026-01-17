'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

export default function MonthlyChart({ monatsdaten }: Props) {
  const chartData = monatsdaten.map(d => ({
    name: `${d.monat}/${d.jahr}`,
    Verbrauch: d.stromverbrauch_kwh,
    Erzeugung: d.pv_erzeugung_kwh,
    Eigenverbrauch: d.eigenverbrauch_kwh,
  }))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Monatlicher Verlauf
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Verbrauch" stroke="#3b82f6" strokeWidth={2} />
          <Line type="monotone" dataKey="Erzeugung" stroke="#eab308" strokeWidth={2} />
          <Line type="monotone" dataKey="Eigenverbrauch" stroke="#22c55e" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
