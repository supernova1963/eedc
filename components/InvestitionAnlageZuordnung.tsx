// components/InvestitionAnlageZuordnung.tsx
// Zuordnung von Investitionen zu Anlagen

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import SimpleIcon from './SimpleIcon'

interface InvestitionAnlageZuordnungProps {
  mitglied_id: string
}

interface Investition {
  id: string
  typ: string
  bezeichnung: string
  anlage_id: string | null
  anschaffungsdatum: string
}

interface Anlage {
  id: string
  anlagenname: string
  leistung_kwp: number
  installationsdatum: string
}

export default function InvestitionAnlageZuordnung({ mitglied_id }: InvestitionAnlageZuordnungProps) {
  const [investitionen, setInvestitionen] = useState<Investition[]>([])
  const [anlagen, setAnlagen] = useState<Anlage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [mitglied_id])

  const loadData = async () => {
    try {
      const supabase = createBrowserClient()

      // Lade Investitionen
      const { data: invData } = await supabase
        .from('alternative_investitionen')
        .select('id, typ, bezeichnung, anlage_id, anschaffungsdatum')
        .eq('mitglied_id', mitglied_id)
        .eq('aktiv', true)
        .order('anschaffungsdatum', { ascending: false })

      setInvestitionen(invData || [])

      // Lade Anlagen
      const { data: anlData } = await supabase
        .from('anlagen')
        .select('id, anlagenname, leistung_kwp, installationsdatum')
        .eq('mitglied_id', mitglied_id)
        .eq('aktiv', true)
        .order('anlagenname')

      setAnlagen(anlData || [])
    } catch (err) {
      console.error('Fehler beim Laden:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateZuordnung = async (investition_id: string, anlage_id: string | null) => {
    setSaving(investition_id)
    try {
      const supabase = createBrowserClient()

      const { error } = await supabase
        .from('alternative_investitionen')
        .update({
          anlage_id: anlage_id || null,
          aktualisiert_am: new Date().toISOString()
        })
        .eq('id', investition_id)

      if (error) throw error

      // Update local state
      setInvestitionen(prev =>
        prev.map(inv =>
          inv.id === investition_id ? { ...inv, anlage_id } : inv
        )
      )
    } catch (err: any) {
      alert('Fehler beim Speichern: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  const getTypIconType = (typ: string) => {
    const iconTypes: Record<string, string> = {
      'pv-module': 'solar',
      'wechselrichter': 'inverter',
      'speicher': 'battery',
      'waermepumpe': 'heat',
      'e-auto': 'car',
      'balkonkraftwerk': 'solar',
      'wallbox': 'wallbox',
      'sonstiges': 'box'
    }
    return iconTypes[typ] || 'box'
  }

  const getTypLabel = (typ: string) => {
    const labels: Record<string, string> = {
      'pv-module': 'PV-Module',
      'wechselrichter': 'Wechselrichter',
      'speicher': 'Batteriespeicher',
      'waermepumpe': 'Wärmepumpe',
      'e-auto': 'E-Auto',
      'balkonkraftwerk': 'Balkonkraftwerk',
      'wallbox': 'Wallbox',
      'sonstiges': 'Sonstiges'
    }
    return labels[typ] || typ
  }

  // Gruppiere Investitionen nach Zuordnung
  const zugeordnet = investitionen.filter(inv => inv.anlage_id)
  const nichtzugeordnet = investitionen.filter(inv => !inv.anlage_id)

  // Gruppiere nach Anlage
  const nachAnlage = anlagen.map(anlage => ({
    anlage,
    investitionen: investitionen.filter(inv => inv.anlage_id === anlage.id)
  }))

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Lade Daten...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Investitionen zu Anlagen zuordnen
        </h2>
        <p className="text-gray-600">
          Ordne deine Investitionen den zugehörigen Anlagen zu, um anlagenbezogene Auswertungen zu ermöglichen.
        </p>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-700">Gesamt</div>
          <div className="text-2xl font-bold text-blue-900">{investitionen.length}</div>
          <div className="text-xs text-blue-600">Investitionen</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-700">Zugeordnet</div>
          <div className="text-2xl font-bold text-green-900">{zugeordnet.length}</div>
          <div className="text-xs text-green-600">
            {investitionen.length > 0
              ? `${((zugeordnet.length / investitionen.length) * 100).toFixed(0)}%`
              : '0%'}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-sm text-amber-700">Nicht zugeordnet</div>
          <div className="text-2xl font-bold text-amber-900">{nichtzugeordnet.length}</div>
          <div className="text-xs text-amber-600">Noch offen</div>
        </div>
      </div>

      {/* Nicht zugeordnete Investitionen */}
      {nichtzugeordnet.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
            <h3 className="text-lg font-semibold text-amber-900">
              Nicht zugeordnete Investitionen ({nichtzugeordnet.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {nichtzugeordnet.map(inv => (
              <div key={inv.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <SimpleIcon type={getTypIconType(inv.typ)} className="w-6 h-6 text-gray-600" />
                      <div>
                        <h4 className="font-medium text-gray-900">{inv.bezeichnung}</h4>
                        <p className="text-sm text-gray-500">
                          {getTypLabel(inv.typ)} · Anschaffung:{' '}
                          {new Date(inv.anschaffungsdatum).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 w-64">
                    <select
                      value={inv.anlage_id || ''}
                      onChange={(e) => updateZuordnung(inv.id, e.target.value)}
                      disabled={saving === inv.id}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Keine Anlage zuordnen</option>
                      {anlagen.map(anlage => (
                        <option key={anlage.id} value={anlage.id}>
                          {anlage.anlagenname} ({anlage.leistung_kwp} kWp)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nach Anlage gruppiert */}
      {nachAnlage.map(({ anlage, investitionen: invs }) => (
        <div key={anlage.id} className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-green-900">
                  {anlage.anlagenname}
                </h3>
                <p className="text-sm text-green-700">
                  {anlage.leistung_kwp} kWp · Inbetriebnahme:{' '}
                  {new Date(anlage.installationsdatum).toLocaleDateString('de-DE')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-900">{invs.length}</div>
                <div className="text-xs text-green-700">Investitionen</div>
              </div>
            </div>
          </div>

          {invs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Dieser Anlage sind noch keine Investitionen zugeordnet.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {invs.map(inv => (
                <div key={inv.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <SimpleIcon type={getTypIconType(inv.typ)} className="w-6 h-6 text-gray-600" />
                        <div>
                          <h4 className="font-medium text-gray-900">{inv.bezeichnung}</h4>
                          <p className="text-sm text-gray-500">
                            {getTypLabel(inv.typ)} · Anschaffung:{' '}
                            {new Date(inv.anschaffungsdatum).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => updateZuordnung(inv.id, null)}
                        disabled={saving === inv.id}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                      >
                        {saving === inv.id ? 'Speichert...' : 'Zuordnung entfernen'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Wenn keine Anlagen vorhanden */}
      {anlagen.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-amber-900 mb-2">
            Keine Anlagen vorhanden
          </h3>
          <p className="text-amber-700 mb-4">
            Du hast noch keine Anlagen angelegt. Lege zuerst eine Anlage an, um Investitionen
            zuordnen zu können.
          </p>
          <a
            href="/anlage/neu"
            className="inline-block px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
          >
            Neue Anlage anlegen
          </a>
        </div>
      )}
    </div>
  )
}
