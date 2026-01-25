// components/WechselrichterMonatsdatenForm.tsx
// Monatsdaten-Erfassung fur Wechselrichter mit SOLL/IST-Vergleich

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

interface WechselrichterMonatsdatenFormProps {
  investition: any
}

// Monatliche Verteilung der Jahresprognose (typisch fur Deutschland)
const MONATS_FAKTOREN = [
  0.04,  // Januar
  0.05,  // Februar
  0.08,  // Marz
  0.10,  // April
  0.12,  // Mai
  0.13,  // Juni
  0.13,  // Juli
  0.12,  // August
  0.09,  // September
  0.07,  // Oktober
  0.04,  // November
  0.03   // Dezember
]

export default function WechselrichterMonatsdatenForm({ investition }: WechselrichterMonatsdatenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pvModule, setPvModule] = useState<any[]>([])

  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    erzeugung_kwh: '',
    betriebsausgaben_monat_euro: ''
  })

  // PV-Module laden die diesem Wechselrichter zugeordnet sind
  useEffect(() => {
    const loadPvModule = async () => {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('alternative_investitionen')
        .select('id, bezeichnung, parameter')
        .eq('parent_investition_id', investition.id)
        .eq('typ', 'pv-module')
        .eq('aktiv', true)

      setPvModule(data || [])
    }
    loadPvModule()
  }, [investition.id])

  // Jahresprognose aus allen verknupften PV-Modulen
  const jahresPrognose = pvModule.reduce((sum, pv) => {
    return sum + (pv.parameter?.jahresertrag_prognose_kwh_pv || 0)
  }, 0)

  // Monatsprognose basierend auf typischer Verteilung
  const monatsPrognose = jahresPrognose * MONATS_FAKTOREN[formData.monat - 1]

  // IST-Wert
  const erzeugungIst = parseFloat(formData.erzeugung_kwh) || 0

  // SOLL/IST Abweichung
  const abweichungProzent = monatsPrognose > 0
    ? ((erzeugungIst - monatsPrognose) / monatsPrognose) * 100
    : 0

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // CO2-Einsparung berechnen (0.38 kg/kWh Netzstrom vermieden)
      const co2Einsparung = erzeugungIst * 0.38

      const monatsdaten = {
        investition_id: investition.id,
        jahr: formData.jahr,
        monat: formData.monat,
        verbrauch_daten: {
          erzeugung_kwh: erzeugungIst,
          prognose_kwh: monatsPrognose,
          jahresprognose_kwh: jahresPrognose,
          abweichung_prozent: abweichungProzent,
          pv_module_ids: pvModule.map(pv => pv.id)
        },
        kosten_daten: {
          betriebsausgaben_monat_euro: parseFloat(formData.betriebsausgaben_monat_euro) || 0
        },
        einsparung_monat_euro: 0,  // Wird spater mit Strompreis berechnet
        co2_einsparung_kg: co2Einsparung
      }

      const { error: dbError } = await supabase
        .from('investition_monatsdaten')
        .insert(monatsdaten)

      if (dbError) throw dbError

      router.push('/auswertung?tab=wechselrichter')
      router.refresh()

    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const monate = [
    'Januar', 'Februar', 'Marz', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Wechselrichter: {investition.bezeichnung}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {investition.parameter?.leistung_ac_kw} kW AC | {investition.parameter?.hersteller_wr} {investition.parameter?.modell_wr}
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Verknupfte PV-Module */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-yellow-900 mb-2">Verknupfte PV-Module:</h3>
        {pvModule.length === 0 ? (
          <p className="text-sm text-yellow-700">
            Keine PV-Module verknupft. Bitte zuerst PV-Module diesem Wechselrichter zuordnen.
          </p>
        ) : (
          <ul className="text-sm text-yellow-800 space-y-1">
            {pvModule.map(pv => (
              <li key={pv.id}>
                {pv.bezeichnung} - {pv.parameter?.leistung_kwp_pv} kWp
                (Prognose: {pv.parameter?.jahresertrag_prognose_kwh_pv?.toLocaleString('de-DE')} kWh/Jahr)
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 pt-2 border-t border-yellow-300">
          <span className="text-sm font-medium text-yellow-900">
            Gesamt-Jahresprognose: {jahresPrognose.toLocaleString('de-DE')} kWh
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Zeitraum */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jahr *</label>
            <input
              type="number"
              name="jahr"
              value={formData.jahr}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monat *</label>
            <select
              name="monat"
              value={formData.monat}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {monate.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Monats-Prognose anzeigen */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-900">
              Prognose fur {monate[formData.monat - 1]}:
            </span>
            <span className="text-lg font-bold text-blue-700">
              {monatsPrognose.toLocaleString('de-DE', { maximumFractionDigits: 0 })} kWh
            </span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            ({(MONATS_FAKTOREN[formData.monat - 1] * 100).toFixed(0)}% der Jahresprognose)
          </p>
        </div>

        {/* Erzeugung */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tatsachliche Erzeugung (kWh) *
          </label>
          <input
            type="number"
            name="erzeugung_kwh"
            value={formData.erzeugung_kwh}
            onChange={handleChange}
            required
            step="0.01"
            placeholder={`z.B. ${Math.round(monatsPrognose)}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="mt-1 text-xs text-gray-500">
            Vom Wechselrichter abgelesene Monatserzeugung
          </p>
        </div>

        {/* Betriebsausgaben */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Betriebsausgaben diesen Monat (Euro)
          </label>
          <input
            type="number"
            name="betriebsausgaben_monat_euro"
            value={formData.betriebsausgaben_monat_euro}
            onChange={handleChange}
            step="0.01"
            placeholder="z.B. 0 (oder Wartung, Reparatur)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* SOLL/IST Vergleich */}
        {erzeugungIst > 0 && (
          <div className={`rounded-lg p-4 ${
            abweichungProzent >= 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-orange-50 border border-orange-200'
          }`}>
            <h3 className={`text-sm font-semibold mb-3 ${
              abweichungProzent >= 0 ? 'text-green-900' : 'text-orange-900'
            }`}>
              SOLL/IST Vergleich:
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className={abweichungProzent >= 0 ? 'text-green-700' : 'text-orange-700'}>
                  SOLL (Prognose):
                </span>
                <div className="font-medium">
                  {monatsPrognose.toLocaleString('de-DE', { maximumFractionDigits: 0 })} kWh
                </div>
              </div>
              <div>
                <span className={abweichungProzent >= 0 ? 'text-green-700' : 'text-orange-700'}>
                  IST (Tatsachlich):
                </span>
                <div className="font-medium">
                  {erzeugungIst.toLocaleString('de-DE', { maximumFractionDigits: 0 })} kWh
                </div>
              </div>
              <div>
                <span className={abweichungProzent >= 0 ? 'text-green-700' : 'text-orange-700'}>
                  Abweichung:
                </span>
                <div className={`font-bold ${
                  abweichungProzent >= 0 ? 'text-green-800' : 'text-orange-800'
                }`}>
                  {abweichungProzent >= 0 ? '+' : ''}{abweichungProzent.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-opacity-30 text-xs">
              <span className={abweichungProzent >= 0 ? 'text-green-600' : 'text-orange-600'}>
                CO2-Einsparung: {(erzeugungIst * 0.38).toLocaleString('de-DE', { maximumFractionDigits: 0 })} kg
              </span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-md font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading || pvModule.length === 0}
            className={`px-6 py-3 rounded-md font-medium text-white ${
              loading || pvModule.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
