// components/DashboardChart.tsx
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DashboardChartProps {
  data: Array<{
    monat: string
    eigenverbrauch: number
    erzeugung: number
    verbrauch: number
  }>
}

export default function DashboardChart({ data }: DashboardChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="monat" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="eigenverbrauch" 
          stroke="#10b981" 
          name="Eigenverbrauch"
          strokeWidth={2}
        />
        <Line 
          type="monotone" 
          dataKey="erzeugung" 
          stroke="#f59e0b" 
          name="Erzeugung"
          strokeWidth={2}
        />
        <Line 
          type="monotone" 
          dataKey="verbrauch" 
          stroke="#3b82f6" 
          name="Verbrauch"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
