// components/WaermepumpeMonatsdatenForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SimpleIcon from './SimpleIcon'

interface WaermepumpeMonatsdatenFormProps {
  investition: any
}

export default function WaermepumpeMonatsdatenForm({ investition }: WaermepumpeMonatsdatenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vormonatPreis, setVormonatPreis] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    jahr: new Date().getFullYear(),
    monat: new Date().getMonth() + 1,
    strom_kwh: '',
    waerme_kwh: '',
    pv_anteil_prozent: '',
    strom_preis_cent_kwh: '',
    betriebsausgaben_monat_euro: ''  // NEU
  })

  // Berechnung für Vorschau
  const stromKwh = parseFloat(formData.strom_kwh) || 0
  const waermeKwh = parseFloat(formData.waerme_kwh) || 0
  const pvAnteil = parseFloat(formData.pv_anteil_prozent) || 0
  const stromPreis = parseFloat(formData.strom_preis_cent_kwh) || 0

  const stromPV = stromKwh * (pvAnteil / 100)
  const stromNetz = stromKwh * (1 - pvAnteil / 100)
  const kosten = stromNetz * (stromPreis / 100)
  const jaz = stromKwh > 0 ? waermeKwh / stromKwh : 0

  // Prognose-Werte aus Investition
  const prognoseStromJahr = investition.parameter?.strom_kwh_jahr || 0
  const prognoseWaermeJahr = investition.parameter?.waerme_kwh_jahr || 0
  const prognoseJAZ = investition.parameter?.jaz || 0

  const prognoseStromMonat = prognoseStromJahr / 12
  const prognoseWaermeMonat = prognoseWaermeJahr / 12

  // Vormonat-Preis laden
  useEffect(() => {
    async function loadVormonatPreis() {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('investition_monatsdaten')
        .select('kosten_daten')
        .eq('investition_id', investition.id)
        .order('jahr', { ascending: false })
        .order('monat', { ascending: false })
        .limit(1)
        .single()

      if (data?.kosten_daten?.strom_preis_cent_kwh) {
        setVormonatPreis(data.kosten_daten.strom_preis_cent_kwh)
        setFormData(prev => ({
          ...prev,
          strom_preis_cent_kwh: data.kosten_daten.strom_preis_cent_kwh.toString()
        }))
      }
    }

    loadVormonatPreis()
  }, [investition.id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createBrowserClient()

      const monatsdaten = {
        investition_id: investition.id,
        jahr: formData.jahr,
        monat: formData.monat,
        verbrauch_daten: {
          strom_kwh: parseFloat(formData.strom_kwh),
          waerme_kwh: parseFloat(formData.waerme_kwh),
          pv_anteil_prozent: parseFloat(formData.pv_anteil_prozent),
          strom_pv_kwh: stromPV,
          strom_netz_kwh: stromNetz,
          jaz: jaz
        },
        kosten_daten: {
          strom_preis_cent_kwh: parseFloat(formData.strom_preis_cent_kwh),
          kosten_gesamt_euro: kosten
        },
        einsparung_monat_euro: kosten, // vs. konventionelle Heizung (aus Prognose)
        co2_einsparung_kg: 0,  // TODO: Berechnung
        betriebsausgaben_monat_euro: parseFloat(formData.betriebsausgaben_monat_euro) || 0  // NEU
      }

      const { error: dbError } = await supabase
        .from('investition_monatsdaten')
        .insert(monatsdaten)

      if (dbError) throw dbError

      router.push('/auswertung?tab=waermepumpe')
      router.refresh()

    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const monate = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <SimpleIcon type="heat" className="w-5 h-5 text-orange-500" />
        {investition.bezeichnung}
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded flex items-center gap-2">
          <SimpleIcon type="error" className="w-5 h-5" />
          {error}
        </div>
      )}

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

        {/* Verbrauch */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strom verbraucht (kWh) *
            </label>
            <input
              type="number"
              name="strom_kwh"
              value={formData.strom_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 150"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">
              Prognose: ~{prognoseStromMonat.toFixed(0)} kWh/Monat
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wärme erzeugt (kWh) *
            </label>
            <input
              type="number"
              name="waerme_kwh"
              value={formData.waerme_kwh}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 600"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">
              Prognose: ~{prognoseWaermeMonat.toFixed(0)} kWh/Monat
            </p>
          </div>
        </div>

        {/* PV-Anteil */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PV-Anteil (%) *
          </label>
          <input
            type="number"
            name="pv_anteil_prozent"
            value={formData.pv_anteil_prozent}
            onChange={handleChange}
            required
            step="1"
            min="0"
            max="100"
            placeholder="z.B. 60"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="mt-1 text-xs text-gray-500">
            Wie viel des Stroms kam von der PV-Anlage?
          </p>
        </div>

        {/* Strompreis */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Strompreis Netz (ct/kWh) *
          </label>
          <input
            type="number"
            name="strom_preis_cent_kwh"
            value={formData.strom_preis_cent_kwh}
            onChange={handleChange}
            required
            step="0.01"
            placeholder="z.B. 32"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          {vormonatPreis && (
            <p className="mt-1 text-xs text-gray-500">
              Vormonat: {vormonatPreis} ct/kWh
            </p>
          )}
        </div>

        {/* Berechnete Werte - Vorschau */}
        {stromKwh > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <SimpleIcon type="chart" className="w-4 h-4 text-blue-700" />
              Berechnete Werte:
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-blue-700">Strom von PV:</span>
                <span className="float-right font-medium">{stromPV.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-blue-700">Strom vom Netz:</span>
                <span className="float-right font-medium">{stromNetz.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-blue-700">JAZ (aktuell):</span>
                <span className="float-right font-medium">{jaz.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-blue-700">JAZ (Prognose):</span>
                <span className="float-right font-medium">{prognoseJAZ.toFixed(2)}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-blue-300">
                <span className="text-blue-900 font-medium">Kosten:</span>
                <span className="float-right font-bold text-lg">{kosten.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}
        {/* Betriebsausgaben */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Betriebsausgaben diesen Monat (€)
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
          <p className="mt-1 text-xs text-gray-500">
            Wartung, Reparatur, Versicherung - falls angefallen
          </p>
        </div>

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
            disabled={loading}
            className={`px-6 py-3 rounded-md font-medium text-white flex items-center gap-2 ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Speichert...' : (
              <>
                <SimpleIcon type="save" className="w-4 h-4" />
                Speichern
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
