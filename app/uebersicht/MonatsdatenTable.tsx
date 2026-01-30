// app/uebersicht/MonatsdatenTable.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SimpleIcon from '@/components/SimpleIcon'

interface Monatsdaten {
  id: string
  anlage_id: string
  jahr: number
  monat: number
  // Energie
  pv_erzeugung_kwh: number | null
  direktverbrauch_kwh: number | null
  batterieladung_kwh: number | null
  batterieentladung_kwh: number | null
  einspeisung_kwh: number | null
  netzbezug_kwh: number | null
  gesamtverbrauch_kwh: number | null
  // Finanzen
  einspeisung_ertrag_euro: number | null
  netzbezug_kosten_euro: number | null
  betriebsausgaben_monat_euro: number | null
  netzbezug_preis_cent_kwh: number | null
  einspeisung_preis_cent_kwh: number | null
  // Wetter
  sonnenstunden: number | null
  globalstrahlung_kwh_m2: number | null
  // Meta
  notizen: string | null
  datenquelle: string | null
}

interface Props {
  initialData: Monatsdaten[]
  anlageId: string
}

const MONATSNAMEN = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// Spalten-Definition für bessere Wartbarkeit
const SPALTEN = [
  { key: 'monat', label: 'Monat', group: 'basis', align: 'left', sticky: true },
  // Energie
  { key: 'pv_erzeugung_kwh', label: 'PV-Erzeugung', group: 'energie', unit: 'kWh', color: 'text-yellow-600' },
  { key: 'gesamtverbrauch_kwh', label: 'Verbrauch', group: 'energie', unit: 'kWh' },
  { key: 'direktverbrauch_kwh', label: 'Direktverbr.', group: 'energie', unit: 'kWh', color: 'text-green-600' },
  { key: 'batterieladung_kwh', label: 'Batt. Ladung', group: 'energie', unit: 'kWh', color: 'text-blue-500' },
  { key: 'batterieentladung_kwh', label: 'Batt. Entladung', group: 'energie', unit: 'kWh', color: 'text-blue-600' },
  { key: 'einspeisung_kwh', label: 'Einspeisung', group: 'energie', unit: 'kWh', color: 'text-orange-500' },
  { key: 'netzbezug_kwh', label: 'Netzbezug', group: 'energie', unit: 'kWh', color: 'text-red-500' },
  // Finanzen
  { key: 'einspeisung_ertrag_euro', label: 'Einspeise-Erlös', group: 'finanzen', unit: '€', color: 'text-green-600' },
  { key: 'netzbezug_kosten_euro', label: 'Bezugskosten', group: 'finanzen', unit: '€', color: 'text-red-600' },
  { key: 'betriebsausgaben_monat_euro', label: 'Betriebsausg.', group: 'finanzen', unit: '€' },
  { key: 'netzbezug_preis_cent_kwh', label: 'Bezugspreis', group: 'finanzen', unit: 'ct/kWh' },
  { key: 'einspeisung_preis_cent_kwh', label: 'Einspeisepreis', group: 'finanzen', unit: 'ct/kWh' },
  // Wetter
  { key: 'sonnenstunden', label: 'Sonnenstd.', group: 'wetter', unit: 'h' },
  { key: 'globalstrahlung_kwh_m2', label: 'Strahlung', group: 'wetter', unit: 'kWh/m²' },
  // Berechnet
  { key: 'eigenverbrauchsquote', label: 'Eigenverbr.', group: 'berechnet', unit: '%', computed: true, color: 'text-green-700' },
  { key: 'autarkiegrad', label: 'Autarkie', group: 'berechnet', unit: '%', computed: true, color: 'text-blue-700' },
  // Meta
  { key: 'datenquelle', label: 'Quelle', group: 'meta' },
  { key: 'notizen', label: 'Notizen', group: 'meta' },
] as const

type SpaltenKey = typeof SPALTEN[number]['key']

export default function MonatsdatenTable({ initialData, anlageId }: Props) {
  const router = useRouter()
  const [data, setData] = useState<Monatsdaten[]>(initialData)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set(['basis', 'energie', 'finanzen', 'berechnet'])
  )

  const toNum = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0
    return parseFloat(String(val)) || 0
  }

  const fmt = (num: number | null | undefined, decimals = 2): string => {
    if (num === null || num === undefined) return '-'
    return num.toLocaleString('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    })
  }

  const berechneKennzahlen = (row: Monatsdaten) => {
    const eigenverbrauch = toNum(row.direktverbrauch_kwh) + toNum(row.batterieentladung_kwh)
    const erzeugung = toNum(row.pv_erzeugung_kwh)
    const verbrauch = toNum(row.gesamtverbrauch_kwh)

    return {
      eigenverbrauchsquote: erzeugung > 0 ? (eigenverbrauch / erzeugung) * 100 : 0,
      autarkiegrad: verbrauch > 0 ? (eigenverbrauch / verbrauch) * 100 : 0,
    }
  }

  const getValue = (row: Monatsdaten, key: SpaltenKey): string | number => {
    if (key === 'monat') {
      return `${MONATSNAMEN[row.monat]} ${row.jahr}`
    }
    if (key === 'eigenverbrauchsquote') {
      return berechneKennzahlen(row).eigenverbrauchsquote
    }
    if (key === 'autarkiegrad') {
      return berechneKennzahlen(row).autarkiegrad
    }
    const val = row[key as keyof Monatsdaten]
    return val !== null && val !== undefined ? val as string | number : ''
  }

  const deleteRow = async (id: string) => {
    if (!confirm('Monatsdaten wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return

    setDeleting(id)
    setError(null)

    try {
      const res = await fetch(`/api/monatsdaten/${id}`, {
        method: 'DELETE'
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Fehler beim Löschen')
      }

      setData(prev => prev.filter(row => row.id !== id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  const toggleGroup = (group: string) => {
    setVisibleGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  const visibleSpalten = SPALTEN.filter(s => visibleGroups.has(s.group))

  const groups = [
    { key: 'basis', label: 'Basis' },
    { key: 'energie', label: 'Energie' },
    { key: 'finanzen', label: 'Finanzen' },
    { key: 'wetter', label: 'Wetter' },
    { key: 'berechnet', label: 'Kennzahlen' },
    { key: 'meta', label: 'Meta' },
  ]

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header mit Filter */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Alle Monatsdaten ({data.length})
          </h2>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
              {error}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 mr-2">Spalten:</span>
          {groups.map(g => (
            <button
              key={g.key}
              onClick={() => toggleGroup(g.key)}
              className={`px-3 py-1 text-xs rounded-full transition ${
                visibleGroups.has(g.key)
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabelle mit horizontalem Scrollen */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {/* Sticky Aktionen-Spalte */}
              <th className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">
                Aktion
              </th>
              {visibleSpalten.map(spalte => (
                <th
                  key={spalte.key}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap ${
                    'align' in spalte && spalte.align === 'left' ? 'text-left' : 'text-right'
                  } ${'sticky' in spalte && spalte.sticky ? 'sticky left-24 z-10 bg-gray-50' : ''}`}
                >
                  {spalte.label}
                  {'unit' in spalte && spalte.unit && <span className="text-gray-400 ml-1">({spalte.unit})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row) => {
              const isDeleting = deleting === row.id

              return (
                <tr key={row.id} className={`hover:bg-gray-50 ${isDeleting ? 'opacity-50' : ''}`}>
                  {/* Aktionen */}
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      <Link
                        href={`/uebersicht/${row.id}/bearbeiten`}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                        title="Bearbeiten"
                      >
                        <SimpleIcon type="edit" className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => deleteRow(row.id)}
                        disabled={isDeleting}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
                        title="Löschen"
                      >
                        <SimpleIcon type="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                  {/* Daten-Spalten */}
                  {visibleSpalten.map(spalte => {
                    const value = getValue(row, spalte.key)
                    const isComputed = 'computed' in spalte && spalte.computed

                    // Monat
                    if (spalte.key === 'monat') {
                      return (
                        <td
                          key={spalte.key}
                          className="sticky left-24 z-10 bg-white px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100"
                        >
                          <Link
                            href={`/uebersicht/${row.id}/bearbeiten`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {value}
                          </Link>
                        </td>
                      )
                    }

                    // Berechnete Werte
                    if (isComputed) {
                      const numVal = typeof value === 'number' ? value : 0
                      return (
                        <td key={spalte.key} className="px-4 py-2 whitespace-nowrap text-sm text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            spalte.key === 'eigenverbrauchsquote' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {fmt(numVal, 1)}%
                          </span>
                        </td>
                      )
                    }

                    // Notizen - abgekürzt anzeigen
                    if (spalte.key === 'notizen') {
                      const text = value as string
                      return (
                        <td key={spalte.key} className="px-4 py-2 text-sm text-gray-600 max-w-[150px]">
                          {text ? (
                            <span className="truncate block" title={text}>
                              {text.length > 30 ? text.substring(0, 30) + '...' : text}
                            </span>
                          ) : '-'}
                        </td>
                      )
                    }

                    // Normale Anzeige
                    const unit = 'unit' in spalte ? spalte.unit : undefined
                    const color = 'color' in spalte ? spalte.color : undefined
                    const displayValue = typeof value === 'number'
                      ? fmt(value, unit === 'ct/kWh' ? 2 : 1)
                      : (value || '-')

                    return (
                      <td
                        key={spalte.key}
                        className={`px-4 py-2 whitespace-nowrap text-sm text-right ${color || 'text-gray-900'}`}
                      >
                        {displayValue}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legende */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 dark:text-gray-400">
        <span className="mr-4">Tipp: Horizontal scrollen für alle Spalten | Klick auf Monat oder Stift-Icon zum Bearbeiten</span>
        <span className="mr-4">|</span>
        <span className="text-yellow-600 mr-2">●</span> PV-Erzeugung
        <span className="text-green-600 ml-3 mr-2">●</span> Eigenverbrauch
        <span className="text-blue-600 ml-3 mr-2">●</span> Batterie
        <span className="text-orange-500 ml-3 mr-2">●</span> Einspeisung
        <span className="text-red-500 ml-3 mr-2">●</span> Netzbezug
      </div>
    </div>
  )
}
