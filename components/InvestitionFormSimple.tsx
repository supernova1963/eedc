// components/InvestitionFormSimple.tsx
// Vereinfachtes Formular mit Gesamt-Kosten statt Einzel-Kosten

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface InvestitionFormSimpleProps {
  mitgliedId: string
  editData?: any
  onSuccess?: () => void
}

type InvestitionsTyp = 'e-auto' | 'waermepumpe' | 'speicher' | 'balkonkraftwerk' | 'wallbox' | 'sonstiges'

export default function InvestitionFormSimple({ mitgliedId, editData, onSuccess }: InvestitionFormSimpleProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!editData
  const [typ, setTyp] = useState<InvestitionsTyp>(editData?.typ || 'e-auto')
  
  // Basis-Felder
  const [formData, setFormData] = useState({
    bezeichnung: editData?.bezeichnung || '',
    anschaffungsdatum: editData?.anschaffungsdatum || new Date().toISOString().split('T')[0],
    anschaffungskosten_gesamt: editData?.anschaffungskosten_gesamt?.toString() || '',
    anschaffungskosten_alternativ: editData?.anschaffungskosten_alternativ?.toString() || '',
    alternativ_beschreibung: editData?.alternativ_beschreibung || '',
    
    // Vereinfacht: Gesamt-Kosten pro Jahr
    kosten_jahr_gesamt: editData?.kosten_jahr_aktuell ? 
      Object.values(editData.kosten_jahr_aktuell).reduce((a: number, b: any) => a + (parseFloat(b) || 0), 0).toString() : '',
    kosten_jahr_alternativ_gesamt: editData?.kosten_jahr_alternativ ?
      Object.values(editData.kosten_jahr_alternativ).reduce((a: number, b: any) => a + (parseFloat(b) || 0), 0).toString() : '',
    
    notizen: editData?.notizen || ''
  })

  // Typ-spezifische Parameter (vereinfacht)
  const [parameterData, setParameterData] = useState({
    // E-Auto
    km_jahr: editData?.parameter?.km_jahr?.toString() || '',
    verbrauch_kwh_100km: editData?.parameter?.verbrauch_kwh_100km?.toString() || '',
    pv_anteil_prozent: editData?.parameter?.pv_anteil_prozent?.toString() || '70',
    vergleich_verbrenner_l_100km: editData?.parameter?.vergleich_verbrenner_l_100km?.toString() || '',
    benzinpreis_euro_liter: editData?.parameter?.benzinpreis_euro_liter?.toString() || '1.69',
    
    // Wärmepumpe
    heizlast_kw: editData?.parameter?.heizlast_kw?.toString() || '',
    jaz: editData?.parameter?.jaz?.toString() || '3.5',
    waermebedarf_kwh_jahr: editData?.parameter?.waermebedarf_kwh_jahr?.toString() || '',
    alter_energietraeger: editData?.parameter?.alter_energietraeger || 'Gas',
    alter_preis_cent_kwh: editData?.parameter?.alter_preis_cent_kwh?.toString() || '8',
    
    // Speicher
    kapazitaet_kwh: editData?.parameter?.kapazitaet_kwh?.toString() || '',
    wirkungsgrad_prozent: editData?.parameter?.wirkungsgrad_prozent?.toString() || '95',
    
    // Balkonkraftwerk
    leistung_kwp: editData?.parameter?.leistung_kwp?.toString() || '',
    jahresertrag_kwh_prognose: editData?.parameter?.jahresertrag_kwh_prognose?.toString() || ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleParamChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setParameterData(prev => ({ ...prev, [name]: value }))
  }

  // Mehrkosten berechnen
  const mehrkosten = formData.anschaffungskosten_gesamt && formData.anschaffungskosten_alternativ
    ? parseFloat(formData.anschaffungskosten_gesamt) - parseFloat(formData.anschaffungskosten_alternativ)
    : parseFloat(formData.anschaffungskosten_gesamt) || 0

  // Einsparungen berechnen
  const berechneEinsparungen = () => {
    const kostenGesamt = parseFloat(formData.kosten_jahr_gesamt) || 0
    const kostenAlternativ = parseFloat(formData.kosten_jahr_alternativ_gesamt) || 0
    const jahresEinsparung = kostenAlternativ - kostenGesamt

    let co2Einsparung = 0
    let parameter = {}

    if (typ === 'e-auto') {
      const kmJahr = parseFloat(parameterData.km_jahr) || 0
      const verbrauchKwh = parseFloat(parameterData.verbrauch_kwh_100km) || 0
      const pvAnteil = parseFloat(parameterData.pv_anteil_prozent) || 0
      const verbrauchL = parseFloat(parameterData.vergleich_verbrenner_l_100km) || 0
      
      const stromGesamt = (kmJahr / 100) * verbrauchKwh
      const stromPV = stromGesamt * (pvAnteil / 100)
      const stromNetz = stromGesamt - stromPV
      
      // CO2: Verbrenner vs E-Auto mit PV
      const co2Benzin = (kmJahr / 100) * verbrauchL * 2.37
      const co2Strom = stromNetz * 0.38
      co2Einsparung = co2Benzin - co2Strom
      
      parameter = {
        km_jahr: kmJahr,
        verbrauch_kwh_100km: verbrauchKwh,
        verbrauch_gesamt_kwh_jahr: Math.round(stromGesamt),
        pv_anteil_prozent: pvAnteil,
        pv_ladung_kwh_jahr: Math.round(stromPV),
        netz_ladung_kwh_jahr: Math.round(stromNetz),
        vergleich_verbrenner_l_100km: verbrauchL,
        benzinpreis_euro_liter: parseFloat(parameterData.benzinpreis_euro_liter) || 0
      }
    } 
    else if (typ === 'waermepumpe') {
      const waermebedarf = parseFloat(parameterData.waermebedarf_kwh_jahr) || 0
      const jaz = parseFloat(parameterData.jaz) || 3.5
      const pvAnteil = parseFloat(parameterData.pv_anteil_prozent) || 40
      
      const stromVerbrauch = waermebedarf / jaz
      const stromPV = stromVerbrauch * (pvAnteil / 100)
      const stromNetz = stromVerbrauch - stromPV
      
      let co2Alt = 0
      if (parameterData.alter_energietraeger === 'Gas') co2Alt = waermebedarf * 0.201
      else if (parameterData.alter_energietraeger === 'Öl') co2Alt = waermebedarf * 0.266
      
      const co2Neu = stromNetz * 0.38
      co2Einsparung = co2Alt - co2Neu
      
      parameter = {
        heizlast_kw: parseFloat(parameterData.heizlast_kw) || 0,
        jaz: jaz,
        waermebedarf_kwh_jahr: waermebedarf,
        strom_verbrauch_kwh_jahr: Math.round(stromVerbrauch),
        pv_anteil_prozent: pvAnteil,
        alter_energietraeger: parameterData.alter_energietraeger,
        alter_preis_cent_kwh: parseFloat(parameterData.alter_preis_cent_kwh) || 0
      }
    }
    else if (typ === 'speicher') {
      const kapazitaet = parseFloat(parameterData.kapazitaet_kwh) || 0
      const wirkungsgrad = parseFloat(parameterData.wirkungsgrad_prozent) || 95
      const jahreszyklen = 250
      
      const nutzbareSpeicherung = kapazitaet * jahreszyklen * (wirkungsgrad / 100)
      co2Einsparung = nutzbareSpeicherung * 0.38
      
      parameter = {
        kapazitaet_kwh: kapazitaet,
        wirkungsgrad_prozent: wirkungsgrad,
        jahreszyklen: jahreszyklen,
        nutzbare_speicherung_kwh_jahr: Math.round(nutzbareSpeicherung)
      }
    }
    else if (typ === 'balkonkraftwerk') {
      const ertrag = parseFloat(parameterData.jahresertrag_kwh_prognose) || 0
      co2Einsparung = ertrag * 0.38
      
      parameter = {
        leistung_kwp: parseFloat(parameterData.leistung_kwp) || 0,
        jahresertrag_kwh_prognose: ertrag
      }
    }

    return {
      jahresEinsparung: Math.round(jahresEinsparung),
      co2Einsparung: Math.round(co2Einsparung),
      parameter
    }
  }

  const berechneteWerte = berechneEinsparungen()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const investitionData = {
        mitglied_id: mitgliedId,
        typ: typ,
        bezeichnung: formData.bezeichnung,
        anschaffungsdatum: formData.anschaffungsdatum,
        anschaffungskosten_gesamt: parseFloat(formData.anschaffungskosten_gesamt),
        anschaffungskosten_alternativ: formData.anschaffungskosten_alternativ 
          ? parseFloat(formData.anschaffungskosten_alternativ) 
          : null,
        alternativ_beschreibung: formData.alternativ_beschreibung || null,
        kosten_jahr_aktuell: { gesamt: parseFloat(formData.kosten_jahr_gesamt) || 0 },
        kosten_jahr_alternativ: { gesamt: parseFloat(formData.kosten_jahr_alternativ_gesamt) || 0 },
        einsparungen_jahr: { gesamt: berechneteWerte.jahresEinsparung },
        einsparung_gesamt_jahr: berechneteWerte.jahresEinsparung,
        parameter: berechneteWerte.parameter,
        co2_einsparung_kg_jahr: berechneteWerte.co2Einsparung,
        notizen: formData.notizen || null,
        aktiv: true
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('alternative_investitionen')
          .update(investitionData)
          .eq('id', editData.id)
        
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('alternative_investitionen')
          .insert(investitionData)
        
        if (insertError) throw insertError
      }

      router.push('/investitionen')
      router.refresh()

      if (onSuccess) onSuccess()

    } catch (err: any) {
      console.error('Fehler beim Speichern:', err)
      setError(err.message || 'Fehler beim Speichern der Investition')
    } finally {
      setLoading(false)
    }
  }

  const typen = [
    { value: 'e-auto', label: '🚗 E-Auto' },
    { value: 'waermepumpe', label: '🔥 Wärmepumpe' },
    { value: 'speicher', label: '🔋 Batteriespeicher' },
    { value: 'balkonkraftwerk', label: '☀️ Balkonkraftwerk' },
    { value: 'wallbox', label: '⚡ Wallbox' },
    { value: 'sonstiges', label: '📦 Sonstiges' }
  ]

  // Hilfe-Texte für Kosten
  const kostenHilfeTexte = {
    'e-auto': {
      aktuell: 'z.B. Versicherung (800€) + Steuer (0€) + Wartung (200€) + Strom-Anteil vom Netz (ca. 300€) = 1.300€',
      alternativ: 'z.B. Versicherung (900€) + Steuer (200€) + Wartung (600€) + Benzin (2.000€) = 3.700€'
    },
    'waermepumpe': {
      aktuell: 'z.B. Wartung (150€) + Strom-Anteil vom Netz (ca. 1.100€) = 1.250€',
      alternativ: 'z.B. Wartung (200€) + Schornsteinfeger (80€) + Gas/Öl (1.600€) = 1.880€'
    },
    'speicher': {
      aktuell: 'Meist keine laufenden Kosten (0€)',
      alternativ: 'Ohne Speicher: Höhere Netzbezugskosten (wird automatisch berechnet)'
    },
    'balkonkraftwerk': {
      aktuell: 'Meist keine laufenden Kosten (0€)',
      alternativ: 'Ohne BKW: Höhere Netzbezugskosten'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {isEditing ? '✏️ Investition bearbeiten' : '➕ Neue Investition erfassen'}
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Typ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Investitions-Typ *
          </label>
          <select
            value={typ}
            onChange={(e) => setTyp(e.target.value as InvestitionsTyp)}
            required
            disabled={isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {typen.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Basis-Felder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bezeichnung *
            </label>
            <input
              type="text"
              name="bezeichnung"
              value={formData.bezeichnung}
              onChange={handleChange}
              required
              placeholder="z.B. Tesla Model 3 Long Range"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anschaffungsdatum *
            </label>
            <input
              type="date"
              name="anschaffungsdatum"
              value={formData.anschaffungsdatum}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anschaffungskosten *
            </label>
            <input
              type="number"
              name="anschaffungskosten_gesamt"
              value={formData.anschaffungskosten_gesamt}
              onChange={handleChange}
              required
              step="0.01"
              placeholder="z.B. 45000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alternative Anschaffungskosten
            </label>
            <input
              type="number"
              name="anschaffungskosten_alternativ"
              value={formData.anschaffungskosten_alternativ}
              onChange={handleChange}
              step="0.01"
              placeholder="z.B. 35000 (Verbrenner)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Was hätte die Alternative gekostet?
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alternative Beschreibung
            </label>
            <input
              type="text"
              name="alternativ_beschreibung"
              value={formData.alternativ_beschreibung}
              onChange={handleChange}
              placeholder="z.B. VW Golf Benziner"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Mehrkosten */}
        {mehrkosten > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-900">
                💰 Relevante Mehrkosten (für ROI):
              </span>
              <span className="text-lg font-bold text-blue-700">
                {mehrkosten.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
              </span>
            </div>
          </div>
        )}

        {/* Laufende Kosten (vereinfacht) */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">💸 Jährliche Kosten</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gesamt-Kosten pro Jahr (aktuell)
              </label>
              <input
                type="number"
                name="kosten_jahr_gesamt"
                value={formData.kosten_jahr_gesamt}
                onChange={handleChange}
                step="0.01"
                placeholder="z.B. 1300"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {kostenHilfeTexte[typ as keyof typeof kostenHilfeTexte]?.aktuell || 'Alle laufenden Kosten zusammen'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gesamt-Kosten pro Jahr (Alternative)
              </label>
              <input
                type="number"
                name="kosten_jahr_alternativ_gesamt"
                value={formData.kosten_jahr_alternativ_gesamt}
                onChange={handleChange}
                step="0.01"
                placeholder="z.B. 3700"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {kostenHilfeTexte[typ as keyof typeof kostenHilfeTexte]?.alternativ || 'Kosten der Alternative'}
              </p>
            </div>
          </div>
        </div>

        {/* Typ-spezifische Parameter (kompakt) */}
        {typ === 'e-auto' && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">🚗 E-Auto Parameter</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">km/Jahr *</label>
                <input type="number" name="km_jahr" value={parameterData.km_jahr} onChange={handleParamChange} required placeholder="15000" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verbrauch (kWh/100km) *</label>
                <input type="number" name="verbrauch_kwh_100km" value={parameterData.verbrauch_kwh_100km} onChange={handleParamChange} required step="0.1" placeholder="20" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PV-Anteil (%)</label>
                <input type="number" name="pv_anteil_prozent" value={parameterData.pv_anteil_prozent} onChange={handleParamChange} placeholder="70" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verbrenner (l/100km)</label>
                <input type="number" name="vergleich_verbrenner_l_100km" value={parameterData.vergleich_verbrenner_l_100km} onChange={handleParamChange} step="0.1" placeholder="8" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Benzinpreis (€/l)</label>
                <input type="number" name="benzinpreis_euro_liter" value={parameterData.benzinpreis_euro_liter} onChange={handleParamChange} step="0.01" placeholder="1.69" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>
        )}

        {typ === 'waermepumpe' && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">🔥 Wärmepumpe Parameter</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Heizlast (kW) *</label>
                <input type="number" name="heizlast_kw" value={parameterData.heizlast_kw} onChange={handleParamChange} required step="0.1" placeholder="10" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">JAZ *</label>
                <input type="number" name="jaz" value={parameterData.jaz} onChange={handleParamChange} required step="0.1" placeholder="3.5" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Wärmebedarf (kWh/Jahr) *</label>
                <input type="number" name="waermebedarf_kwh_jahr" value={parameterData.waermebedarf_kwh_jahr} onChange={handleParamChange} required placeholder="20000" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PV-Anteil (%)</label>
                <input type="number" name="pv_anteil_prozent" value={parameterData.pv_anteil_prozent} onChange={handleParamChange} placeholder="40" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alter Energieträger</label>
                <select name="alter_energietraeger" value={parameterData.alter_energietraeger} onChange={handleParamChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="Gas">Gas</option>
                  <option value="Öl">Öl</option>
                  <option value="Strom">Strom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alter Preis (ct/kWh)</label>
                <input type="number" name="alter_preis_cent_kwh" value={parameterData.alter_preis_cent_kwh} onChange={handleParamChange} step="0.1" placeholder="8" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>
        )}

        {typ === 'speicher' && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">🔋 Speicher Parameter</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kapazität (kWh) *</label>
                <input type="number" name="kapazitaet_kwh" value={parameterData.kapazitaet_kwh} onChange={handleParamChange} required step="0.1" placeholder="10" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Wirkungsgrad (%)</label>
                <input type="number" name="wirkungsgrad_prozent" value={parameterData.wirkungsgrad_prozent} onChange={handleParamChange} step="0.1" placeholder="95" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>
        )}

        {typ === 'balkonkraftwerk' && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">☀️ Balkonkraftwerk Parameter</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Leistung (kWp) *</label>
                <input type="number" name="leistung_kwp" value={parameterData.leistung_kwp} onChange={handleParamChange} required step="0.01" placeholder="0.8" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jahresertrag (kWh) *</label>
                <input type="number" name="jahresertrag_kwh_prognose" value={parameterData.jahresertrag_kwh_prognose} onChange={handleParamChange} required placeholder="800" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>
        )}

        {/* Berechnete Werte */}
        {berechneteWerte.jahresEinsparung > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-3">🧮 Automatisch berechnet:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-green-700">Jährliche Einsparung:</span>
                <div className="font-bold text-green-900 text-lg">
                  {berechneteWerte.jahresEinsparung.toLocaleString('de-DE')} €
                </div>
              </div>
              {mehrkosten > 0 && (
                <>
                  <div>
                    <span className="text-green-700">ROI:</span>
                    <div className="font-bold text-green-900 text-lg">
                      {((berechneteWerte.jahresEinsparung / mehrkosten) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-green-700">Amortisation:</span>
                    <div className="font-bold text-green-900 text-lg">
                      {(mehrkosten / berechneteWerte.jahresEinsparung).toFixed(1)} Jahre
                    </div>
                  </div>
                </>
              )}
              <div>
                <span className="text-green-700">CO₂-Einsparung:</span>
                <div className="font-bold text-green-900 text-lg">
                  {(berechneteWerte.co2Einsparung / 1000).toFixed(2)} t/Jahr
                </div>
              </div>
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
            rows={3}
            placeholder="Zusätzliche Informationen..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
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
            className={`px-6 py-3 rounded-md font-medium text-white ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Speichert...' : isEditing ? '💾 Änderungen speichern' : '💾 Investition speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
