// app/uebersicht/MonatsdatenTable.tsx
'use client'

import { useState, useMemo } from 'react'
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

interface Investition {
  id: string
  typ: string
  bezeichnung: string
}

interface InvestitionMonatsdaten {
  id: string
  investition_id: string
  jahr: number
  monat: number
  verbrauch_daten: any
}

interface Props {
  initialData: Monatsdaten[]
  anlageId: string
  investitionen?: Investition[]
  investitionMonatsdaten?: InvestitionMonatsdaten[]
  vorhandeneTypen?: string[]
}

const MONATSNAMEN = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// Spalten-Typ Definition
interface Spalte {
  key: string
  label: string
  group: string
  unit?: string
  color?: string
  align?: string
  sticky?: boolean
  computed?: boolean
}

// Basis-Spalten-Definition
const BASIS_SPALTEN: Spalte[] = [
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
  { key: 'eigenverbrauch_einsparung_euro', label: 'EV-Einsparung', group: 'finanzen', unit: '€', color: 'text-green-700', computed: true },
  { key: 'einspeisung_ertrag_euro', label: 'Einspeise-Erlös', group: 'finanzen', unit: '€', color: 'text-green-600' },
  { key: 'netzbezug_kosten_euro', label: 'Bezugskosten', group: 'finanzen', unit: '€', color: 'text-red-600' },
  { key: 'gesamt_ersparnis_euro', label: 'Ersparnis', group: 'finanzen', unit: '€', color: 'text-green-800', computed: true },
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
]

// Investitions-spezifische Spalten
const INVESTITIONS_SPALTEN: Record<string, Spalte[]> = {
  speicher: [
    { key: 'speicher_ladung', label: 'Ladung', group: 'speicher', unit: 'kWh', color: 'text-blue-500' },
    { key: 'speicher_entladung', label: 'Entladung', group: 'speicher', unit: 'kWh', color: 'text-blue-600' },
    { key: 'speicher_zyklen', label: 'Zyklen', group: 'speicher', color: 'text-blue-700' },
  ],
  'e-auto': [
    { key: 'eauto_km', label: 'km gefahren', group: 'e-auto', unit: 'km', color: 'text-green-600' },
    { key: 'eauto_verbrauch', label: 'Verbrauch', group: 'e-auto', unit: 'kWh', color: 'text-green-500' },
    { key: 'eauto_ladung_pv', label: 'Ladung PV', group: 'e-auto', unit: 'kWh', color: 'text-green-600' },
    { key: 'eauto_ladung_netz', label: 'Ladung Netz', group: 'e-auto', unit: 'kWh', color: 'text-red-400' },
  ],
  wallbox: [
    { key: 'wallbox_ladung', label: 'Geladen', group: 'wallbox', unit: 'kWh', color: 'text-purple-600' },
    { key: 'wallbox_ladevorgaenge', label: 'Ladevorgänge', group: 'wallbox', color: 'text-purple-500' },
  ],
  waermepumpe: [
    { key: 'wp_heizenergie', label: 'Heizenergie', group: 'waermepumpe', unit: 'kWh', color: 'text-orange-500' },
    { key: 'wp_warmwasser', label: 'Warmwasser', group: 'waermepumpe', unit: 'kWh', color: 'text-orange-400' },
    { key: 'wp_stromverbrauch', label: 'Stromverbr.', group: 'waermepumpe', unit: 'kWh', color: 'text-orange-600' },
    { key: 'wp_cop', label: 'COP', group: 'waermepumpe', color: 'text-orange-700' },
  ],
}

// Gruppen-Konfiguration mit Farben
const GRUPPEN_CONFIG: Record<string, { label: string; color: string; activeColor: string }> = {
  basis: { label: 'Basis', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-gray-200 text-gray-700' },
  energie: { label: 'Energie', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-yellow-100 text-yellow-700' },
  finanzen: { label: 'Finanzen', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-green-100 text-green-700' },
  wetter: { label: 'Wetter', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-sky-100 text-sky-700' },
  berechnet: { label: 'Kennzahlen', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-indigo-100 text-indigo-700' },
  meta: { label: 'Meta', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-gray-200 text-gray-600' },
  speicher: { label: 'Speicher', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-blue-100 text-blue-700' },
  'e-auto': { label: 'E-Auto', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-green-100 text-green-700' },
  wallbox: { label: 'Wallbox', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-purple-100 text-purple-700' },
  waermepumpe: { label: 'Wärmepumpe', color: 'bg-gray-100 text-gray-500', activeColor: 'bg-orange-100 text-orange-700' },
}

type SpaltenKey = string

export default function MonatsdatenTable({
  initialData,
  anlageId,
  investitionen = [],
  investitionMonatsdaten = [],
  vorhandeneTypen = []
}: Props) {
  const router = useRouter()
  const [data, setData] = useState<Monatsdaten[]>(initialData)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set(['basis', 'energie', 'finanzen', 'berechnet'])
  )

  // Spalten dynamisch zusammenstellen basierend auf vorhandenen Investitionstypen
  const SPALTEN = useMemo(() => {
    const spalten = [...BASIS_SPALTEN]

    // Investitions-Spalten nur hinzufügen wenn Typ vorhanden
    vorhandeneTypen.forEach(typ => {
      const typSpalten = INVESTITIONS_SPALTEN[typ]
      if (typSpalten) {
        spalten.push(...typSpalten)
      }
    })

    return spalten
  }, [vorhandeneTypen])

  // Investitions-Monatsdaten nach Jahr/Monat indexieren für schnellen Zugriff
  const investitionsDatenIndex = useMemo(() => {
    const index: Record<string, Record<string, any>> = {}

    investitionMonatsdaten.forEach(imd => {
      const key = `${imd.jahr}-${imd.monat}`
      if (!index[key]) index[key] = {}

      const inv = investitionen.find(i => i.id === imd.investition_id)
      if (inv && imd.verbrauch_daten) {
        // Daten nach Typ zusammenführen (falls mehrere Investitionen gleichen Typs)
        if (!index[key][inv.typ]) {
          index[key][inv.typ] = { ...imd.verbrauch_daten }
        } else {
          // Werte addieren für gleiche Typen
          Object.keys(imd.verbrauch_daten).forEach(k => {
            const val = parseFloat(imd.verbrauch_daten[k]) || 0
            index[key][inv.typ][k] = (parseFloat(index[key][inv.typ][k]) || 0) + val
          })
        }
      }
    })

    return index
  }, [investitionMonatsdaten, investitionen])

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

    // Berechnete Finanzwerte
    if (key === 'eigenverbrauch_einsparung_euro') {
      const eigenverbrauch = toNum(row.direktverbrauch_kwh) + toNum(row.batterieentladung_kwh)
      const preis = toNum(row.netzbezug_preis_cent_kwh)
      return preis > 0 ? eigenverbrauch * preis / 100 : 0
    }
    if (key === 'gesamt_ersparnis_euro') {
      const eigenverbrauch = toNum(row.direktverbrauch_kwh) + toNum(row.batterieentladung_kwh)
      const preis = toNum(row.netzbezug_preis_cent_kwh)
      const evEinsparung = preis > 0 ? eigenverbrauch * preis / 100 : 0
      const einspeiseErtrag = toNum(row.einspeisung_ertrag_euro)
      const netzbezugKosten = toNum(row.netzbezug_kosten_euro)
      return evEinsparung + einspeiseErtrag - netzbezugKosten
    }

    // Investitions-spezifische Werte
    const indexKey = `${row.jahr}-${row.monat}`
    const invData = investitionsDatenIndex[indexKey]

    // Speicher
    if (key === 'speicher_ladung' && invData?.speicher) {
      return parseFloat(invData.speicher.ladung_kwh) || 0
    }
    if (key === 'speicher_entladung' && invData?.speicher) {
      return parseFloat(invData.speicher.entladung_kwh) || 0
    }
    if (key === 'speicher_zyklen' && invData?.speicher) {
      const ladung = parseFloat(invData.speicher.ladung_kwh) || 0
      // Annahme: 10 kWh Kapazität pro Zyklus (vereinfacht)
      return ladung > 0 ? Math.round(ladung / 10 * 10) / 10 : 0
    }

    // E-Auto
    if (key === 'eauto_km' && invData?.['e-auto']) {
      return parseFloat(invData['e-auto'].km_gefahren) || 0
    }
    if (key === 'eauto_verbrauch' && invData?.['e-auto']) {
      return parseFloat(invData['e-auto'].verbrauch_kwh) || 0
    }
    if (key === 'eauto_ladung_pv' && invData?.['e-auto']) {
      return parseFloat(invData['e-auto'].ladung_pv_kwh) || 0
    }
    if (key === 'eauto_ladung_netz' && invData?.['e-auto']) {
      return parseFloat(invData['e-auto'].ladung_netz_kwh) || 0
    }

    // Wallbox
    if (key === 'wallbox_ladung' && invData?.wallbox) {
      return parseFloat(invData.wallbox.ladung_kwh) || 0
    }
    if (key === 'wallbox_ladevorgaenge' && invData?.wallbox) {
      return parseInt(invData.wallbox.ladevorgaenge) || 0
    }

    // Wärmepumpe
    if (key === 'wp_heizenergie' && invData?.waermepumpe) {
      return parseFloat(invData.waermepumpe.heizenergie_kwh) || 0
    }
    if (key === 'wp_warmwasser' && invData?.waermepumpe) {
      return parseFloat(invData.waermepumpe.warmwasser_kwh) || 0
    }
    if (key === 'wp_stromverbrauch' && invData?.waermepumpe) {
      return parseFloat(invData.waermepumpe.stromverbrauch_kwh) || 0
    }
    if (key === 'wp_cop' && invData?.waermepumpe) {
      const heiz = parseFloat(invData.waermepumpe.heizenergie_kwh) || 0
      const ww = parseFloat(invData.waermepumpe.warmwasser_kwh) || 0
      const strom = parseFloat(invData.waermepumpe.stromverbrauch_kwh) || 0
      return strom > 0 ? Math.round((heiz + ww) / strom * 10) / 10 : 0
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

  // Dynamische Gruppen basierend auf vorhandenen Spalten
  const groups = useMemo(() => {
    const basisGruppen = [
      { key: 'basis', label: 'Basis' },
      { key: 'energie', label: 'Energie' },
      { key: 'finanzen', label: 'Finanzen' },
      { key: 'wetter', label: 'Wetter' },
      { key: 'berechnet', label: 'Kennzahlen' },
    ]

    // Investitions-Gruppen nur hinzufügen wenn vorhanden
    const invGruppen = vorhandeneTypen
      .filter(typ => INVESTITIONS_SPALTEN[typ])
      .map(typ => ({
        key: typ,
        label: GRUPPEN_CONFIG[typ]?.label || typ,
      }))

    return [...basisGruppen, ...invGruppen, { key: 'meta', label: 'Meta' }]
  }, [vorhandeneTypen])

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
          {groups.map(g => {
            const config = GRUPPEN_CONFIG[g.key] || { color: 'bg-gray-100 text-gray-500', activeColor: 'bg-blue-100 text-blue-700' }
            return (
              <button
                key={g.key}
                onClick={() => toggleGroup(g.key)}
                className={`px-3 py-1 text-xs rounded-full transition ${
                  visibleGroups.has(g.key) ? config.activeColor : config.color
                }`}
              >
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabelle mit horizontalem und vertikalem Scrollen - dynamische Höhe bis Bildschirmende */}
      {/* 280px = Header (~180px) + Filter (~60px) + Legende (~40px) */}
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-30">
            <tr>
              {/* Sticky Aktionen-Spalte (horizontal + vertikal) */}
              <th className="sticky left-0 top-0 z-40 bg-gray-50 dark:bg-gray-700 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">
                Aktion
              </th>
              {visibleSpalten.map(spalte => (
                <th
                  key={spalte.key}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap bg-gray-50 dark:bg-gray-700 ${
                    'align' in spalte && spalte.align === 'left' ? 'text-left' : 'text-right'
                  } ${'sticky' in spalte && spalte.sticky ? 'sticky left-24 z-40 bg-gray-50 dark:bg-gray-700' : ''}`}
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
