// components/EAutoMonatsdatenForm.tsx
// Version 2: Mit automatischer Kostenberechnung aus Preis/kWh

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SimpleIcon from './SimpleIcon'

interface EAutoMonatsdatenFormProps {
  investition: any
  existingData?: any
}

export default function EAutoMonatsdatenForm({ investition, existingData }: EAutoMonatsdatenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingVormonat, setLoadingVormonat] = useState(false)

  const isEditing = !!existingData
  
  const [formData, setFormData] = useState({
    jahr: existingData?.jahr || new Date().getFullYear(),
    monat: existingData?.monat || new Date().getMonth() + 1,
    km_gefahren: existingData?.verbrauch_daten?.km_gefahren?.toString() || '',
    strom_kwh: existingData?.verbrauch_daten?.strom_kwh?.toString() || '',
    strom_pv_prozent: existingData?.verbrauch_daten?.strom_pv_kwh && existingData?.verbrauch_daten?.strom_kwh
      ? ((existingData.verbrauch_daten.strom_pv_kwh / existingData.verbrauch_daten.strom_kwh) * 100).toString()
      : investition.parameter?.pv_anteil_prozent?.toString() || '70',
    
    // GEÄNDERT: Preis statt Kosten direkt
    strom_preis_cent_kwh: '',
    
    kosten_wartung: existingData?.kosten_daten?.wartung?.toString() || '0',
    kosten_reparatur: existingData?.kosten_daten?.reparatur?.toString() || '0',
    notizen: existingData?.notizen || '',
    betriebsausgaben_monat_euro: ''
  })

  // Vormonat-Preis laden
  useEffect(() => {
    if (!isEditing) {
      loadVormonatPreis()
    } else {
      // Bei Bearbeitung: Preis aus bestehenden Kosten berechnen
      if (existingData?.verbrauch_daten?.strom_netz_kwh > 0 && existingData?.kosten_daten?.strom > 0) {
        const preis = (existingData.kosten_daten.strom / existingData.verbrauch_daten.strom_netz_kwh) * 100
        setFormData(prev => ({ ...prev, strom_preis_cent_kwh: preis.toFixed(2) }))
      }
    }
  }, [])

  const loadVormonatPreis = async () => {
    setLoadingVormonat(true)
    try {
      // Vormonat berechnen
      let vormonatJahr = formData.jahr
      let vormonat = formData.monat - 1
      if (vormonat === 0) {
        vormonat = 12
        vormonatJahr = formData.jahr - 1
      }

      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('investition_monatsdaten')
        .select('verbrauch_daten, kosten_daten')
        .eq('investition_id', investition.id)
        .eq('jahr', vormonatJahr)
        .eq('monat', vormonat)
        .single()

      if (data && data.verbrauch_daten?.strom_netz_kwh > 0 && data.kosten_daten?.strom > 0) {
        const preis = (data.kosten_daten.strom / data.verbrauch_daten.strom_netz_kwh) * 100
        setFormData(prev => ({ 
          ...prev, 
          strom_preis_cent_kwh: preis.toFixed(2)
        }))
      } else {
        // Fallback: 32 ct/kWh
        setFormData(prev => ({ ...prev, strom_preis_cent_kwh: '32' }))
      }
    } catch (err) {
      // Kein Vormonat → Fallback
      setFormData(prev => ({ ...prev, strom_preis_cent_kwh: '32' }))
    } finally {
      setLoadingVormonat(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Berechnungen
  const km = parseFloat(formData.km_gefahren) || 0
  const stromKwh = parseFloat(formData.strom_kwh) || 0
  const pvProzent = parseFloat(formData.strom_pv_prozent) || 0
  const stromPreis = parseFloat(formData.strom_preis_cent_kwh) || 0
  const kostenWartung = parseFloat(formData.kosten_wartung) || 0
  const kostenReparatur = parseFloat(formData.kosten_reparatur) || 0

  const stromPvKwh = stromKwh * (pvProzent / 100)
  const stromNetzKwh = stromKwh - stromPvKwh
  
  // GEÄNDERT: Kosten aus Preis × Netz-kWh berechnen
  const kostenStrom = (stromNetzKwh * stromPreis) / 100
  
  const verbrauchPro100km = km > 0 ? (stromKwh / km) * 100 : 0

  // Vergleich mit Verbrenner
  const verbrennerLPro100km = investition.parameter?.vergleich_verbrenner_l_100km || 8
  const benzinpreis = investition.parameter?.benzinpreis_euro_liter || 1.69
  const kostenVerbrenner = (km / 100) * verbrennerLPro100km * benzinpreis

  const kostenGesamt = kostenStrom + kostenWartung + kostenReparatur
  const einsparungMonat = kostenVerbrenner - kostenGesamt

  // CO2
  const co2Benzin = (km / 100) * verbrennerLPro100km * 2.37
  const co2Strom = stromNetzKwh * 0.38
  const co2Einsparung = co2Benzin - co2Strom

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createBrowserClient()

      const monatsdatenData = {
        investition_id: investition.id,
        jahr: formData.jahr,
        monat: formData.monat,
        verbrauch_daten: {
          km_gefahren: km,
          strom_kwh: stromKwh,
          strom_pv_kwh: Math.round(stromPvKwh * 100) / 100,
          strom_netz_kwh: Math.round(stromNetzKwh * 100) / 100,
          verbrauch_kwh_100km: Math.round(verbrauchPro100km * 100) / 100,
          betriebsausgaben_monat_euro: parseFloat(formData.betriebsausgaben_monat_euro) || 0  
        },
        kosten_daten: {
          strom: Math.round(kostenStrom * 100) / 100,
          strom_preis_cent_kwh: stromPreis,  // Preis speichern für Vormonat
          wartung: kostenWartung,
          reparatur: kostenReparatur
        },
        einsparung_monat_euro: Math.round(einsparungMonat * 100) / 100,
        co2_einsparung_kg: Math.round(co2Einsparung * 100) / 100,
        notizen: formData.notizen || null
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('investition_monatsdaten')
          .update(monatsdatenData)
          .eq('id', existingData.id)
        
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('investition_monatsdaten')
          .insert(monatsdatenData)
        
        if (insertError) throw insertError
      }

      router.push('/eingabe?tab=e-auto')
      router.refresh()

    } catch (err: any) {
      console.error('Fehler beim Speichern:', err)
      setError(err.message || 'Fehler beim Speichern der Monatsdaten')
    } finally {
      setLoading(false)
    }
  }

  const monate = [
    { value: 1, label: 'Januar' },
    { value: 2, label: 'Februar' },
    { value: 3, label: 'März' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Dezember' }
  ]

  const currentYear = new Date().getFullYear()
  const jahre = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <SimpleIcon type="car" className="w-5 h-5 text-gray-700" />
          {investition.bezeichnung}
        </h3>
        <p className="text-sm text-gray-600">
          Monatsdaten erfassen
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded flex items-center gap-2">
          <SimpleIcon type="error" className="w-5 h-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Zeitraum */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jahr *
            </label>
            <select
              name="jahr"
              value={formData.jahr}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {jahre.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monat *
            </label>
            <select
              name="monat"
              value={formData.monat}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {monate.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Verbrauchsdaten */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <SimpleIcon type="chart" className="w-4 h-4 text-gray-600" />
            Verbrauchsdaten
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                km gefahren *
              </label>
              <input
                type="number"
                name="km_gefahren"
                value={formData.km_gefahren}
                onChange={handleChange}
                required
                step="1"
                placeholder="z.B. 1200"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Strom geladen (kWh) *
              </label>
              <input
                type="number"
                name="strom_kwh"
                value={formData.strom_kwh}
                onChange={handleChange}
                required
                step="0.1"
                placeholder="z.B. 240"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                davon PV-Anteil (%)
              </label>
              <input
                type="number"
                name="strom_pv_prozent"
                value={formData.strom_pv_prozent}
                onChange={handleChange}
                step="1"
                min="0"
                max="100"
                placeholder="z.B. 70"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="mt-1 text-xs text-gray-500">
                Wie viel % des Stroms kam von deiner PV-Anlage?
              </p>
            </div>
          </div>
        </div>

        {/* Strompreis + Kosten */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <SimpleIcon type="money" className="w-4 h-4 text-gray-600" />
            Preise & Kosten
          </h4>
          
          {/* NEU: Strompreis */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strompreis (ct/kWh) *
            </label>
            <input
              type="number"
              name="strom_preis_cent_kwh"
              value={formData.strom_preis_cent_kwh}
              onChange={handleChange}
              required
              step="0.1"
              placeholder="z.B. 32"
              disabled={loadingVormonat}
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              {loadingVormonat 
                ? '⏳ Lade Vormonat-Preis...' 
                : `Dein Netzstrom-Preis (Vorschlag: ${formData.strom_preis_cent_kwh || '32'} ct/kWh)`
              }
            </p>
          </div>

          {/* Berechnete Stromkosten Vorschau */}
          {stromNetzKwh > 0 && stromPreis > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm text-blue-900">
                <strong>Stromkosten berechnet:</strong>
                <div className="mt-1">
                  {stromNetzKwh.toFixed(1)} kWh (Netz) × {stromPreis} ct/kWh = 
                  <strong className="ml-2">{kostenStrom.toFixed(2)} €</strong>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wartung (€)
              </label>
              <input
                type="number"
                name="kosten_wartung"
                value={formData.kosten_wartung}
                onChange={handleChange}
                step="0.01"
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reparatur (€)
              </label>
              <input
                type="number"
                name="kosten_reparatur"
                value={formData.kosten_reparatur}
                onChange={handleChange}
                step="0.01"
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Berechnete Werte */}
        {km > 0 && stromKwh > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
              <SimpleIcon type="chart" className="w-4 h-4 text-green-700" />
              Automatisch berechnet:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-green-700">Verbrauch:</span>
                <div className="font-bold text-green-900">
                  {verbrauchPro100km.toFixed(1)} kWh/100km
                </div>
              </div>
              <div>
                <span className="text-green-700">PV-Strom:</span>
                <div className="font-bold text-green-900">
                  {stromPvKwh.toFixed(1)} kWh
                </div>
              </div>
              <div>
                <span className="text-green-700">Einsparung:</span>
                <div className="font-bold text-green-900">
                  {einsparungMonat.toFixed(0)} €
                </div>
              </div>
              <div>
                <span className="text-green-700">CO₂:</span>
                <div className="font-bold text-green-900">
                  {(co2Einsparung / 1000).toFixed(2)} t
                </div>
              </div>
            </div>
            
            <div className="mt-3 text-xs text-green-700">
              Vergleich Verbrenner: {kostenVerbrenner.toFixed(0)} € 
              ({verbrennerLPro100km}l/100km × {benzinpreis}€/l)
            </div>
          </div>
        )}

        {/* Notizen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notizen (optional)
          </label>
          <textarea
            name="notizen"
            value={formData.notizen}
            onChange={handleChange}
            rows={2}
            placeholder="Besonderheiten diesen Monat..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

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
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-md font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 rounded-md font-medium text-white flex items-center gap-2 ${
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
