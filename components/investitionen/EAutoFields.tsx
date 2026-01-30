// components/investitionen/EAutoFields.tsx
// E-Auto-spezifische Formularfelder

import { useMemo } from 'react'
import FormInput from '@/components/ui/FormInput'
import SimpleIcon from '@/components/SimpleIcon'

interface EAutoFieldsProps {
  parameterData: {
    km_jahr: string
    verbrauch_kwh_100km: string
    pv_anteil_prozent: string
    vergleich_verbrenner_l_100km: string
    benzinpreis_euro_liter: string
    betriebskosten_jahr_euro: string
    strompreis_cent_kwh?: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function EAutoFields({ parameterData, onChange }: EAutoFieldsProps) {
  // Berechnete Werte für Kostenvorschau
  const berechneteWerte = useMemo(() => {
    const kmJahr = parseFloat(parameterData.km_jahr) || 0
    const verbrauchKwh100 = parseFloat(parameterData.verbrauch_kwh_100km) || 0
    const pvAnteil = parseFloat(parameterData.pv_anteil_prozent) || 70
    const strompreis = parseFloat(parameterData.strompreis_cent_kwh) || 30
    const benzinpreis = parseFloat(parameterData.benzinpreis_euro_liter) || 1.69
    const verbrauchLiter100 = parseFloat(parameterData.vergleich_verbrenner_l_100km) || 0
    const betriebskosten = parseFloat(parameterData.betriebskosten_jahr_euro) || 0

    // Stromverbrauch E-Auto
    const stromGesamt = (kmJahr / 100) * verbrauchKwh100
    const stromPV = stromGesamt * (pvAnteil / 100)
    const stromNetz = stromGesamt - stromPV

    // Stromkosten (nur Netzstrom kostet)
    const stromkosten = (stromNetz * strompreis) / 100

    // Gesamtkosten E-Auto
    const gesamtkostenEAuto = stromkosten + betriebskosten

    // Kosten Verbrenner
    const benzinverbrauch = (kmJahr / 100) * verbrauchLiter100
    const benzinkosten = benzinverbrauch * benzinpreis

    return {
      stromGesamt: Math.round(stromGesamt),
      stromPV: Math.round(stromPV),
      stromNetz: Math.round(stromNetz),
      stromkosten: Math.round(stromkosten),
      gesamtkostenEAuto: Math.round(gesamtkostenEAuto),
      benzinverbrauch: Math.round(benzinverbrauch),
      benzinkosten: Math.round(benzinkosten)
    }
  }, [parameterData])

  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">E-Auto Parameter</h3>

      {/* Fahrdaten */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <FormInput
          label="km/Jahr"
          name="km_jahr"
          value={parameterData.km_jahr}
          onChange={onChange}
          type="number"
          required
          placeholder="15000"
        />
        <FormInput
          label="Verbrauch (kWh/100km)"
          name="verbrauch_kwh_100km"
          value={parameterData.verbrauch_kwh_100km}
          onChange={onChange}
          type="number"
          required
          step="0.1"
          placeholder="20"
        />
        <FormInput
          label="PV-Anteil Ladung (%)"
          name="pv_anteil_prozent"
          value={parameterData.pv_anteil_prozent}
          onChange={onChange}
          type="number"
          placeholder="70"
          hint="Anteil PV-Strom beim Laden"
        />
      </div>

      {/* Stromkosten-Berechnung */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <SimpleIcon type="lightning" className="w-4 h-4" />
          Berechnete Stromkosten E-Auto
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-blue-700">Stromverbrauch/Jahr:</span>
            <span className="block font-semibold text-blue-900">{berechneteWerte.stromGesamt} kWh</span>
          </div>
          <div>
            <span className="text-blue-700">Davon PV ({parameterData.pv_anteil_prozent || 70}%):</span>
            <span className="block font-semibold text-green-700">{berechneteWerte.stromPV} kWh (kostenlos)</span>
          </div>
          <div>
            <span className="text-blue-700">Davon Netz:</span>
            <span className="block font-semibold text-blue-900">{berechneteWerte.stromNetz} kWh</span>
          </div>
          <div>
            <span className="text-blue-700">Stromkosten/Jahr:</span>
            <span className="block font-semibold text-blue-900">{berechneteWerte.stromkosten} €</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <FormInput
            label="Strompreis Netz (Cent/kWh)"
            name="strompreis_cent_kwh"
            value={parameterData.strompreis_cent_kwh || '30'}
            onChange={onChange}
            type="number"
            step="0.1"
            placeholder="30"
            hint="Aktueller Strompreis für Netzbezug"
          />
        </div>
      </div>

      {/* Betriebskosten (ohne Strom) */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Betriebskosten E-Auto (ohne Strom)
        </h4>
        <FormInput
          label="Versicherung + Wartung + Steuer (€/Jahr)"
          name="betriebskosten_jahr_euro"
          value={parameterData.betriebskosten_jahr_euro}
          onChange={onChange}
          type="number"
          step="0.01"
          placeholder="z.B. 800"
          hint="Versicherung (~500€) + Wartung (~200€) + KFZ-Steuer (0€)"
        />
        {berechneteWerte.gesamtkostenEAuto > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between items-center">
            <span className="font-medium text-gray-700">Gesamtkosten E-Auto/Jahr:</span>
            <span className="text-lg font-bold text-gray-900">
              {berechneteWerte.gesamtkostenEAuto.toLocaleString('de-DE')} €
            </span>
          </div>
        )}
      </div>

      {/* Vergleich Verbrenner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
          <SimpleIcon type="car" className="w-4 h-4" />
          Vergleich: Alternative Verbrenner
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FormInput
            label="Verbrenner (l/100km)"
            name="vergleich_verbrenner_l_100km"
            value={parameterData.vergleich_verbrenner_l_100km}
            onChange={onChange}
            type="number"
            step="0.1"
            placeholder="8"
          />
          <FormInput
            label="Benzinpreis (€/l)"
            name="benzinpreis_euro_liter"
            value={parameterData.benzinpreis_euro_liter}
            onChange={onChange}
            type="number"
            step="0.01"
            placeholder="1.69"
          />
          {berechneteWerte.benzinkosten > 0 && (
            <div className="flex flex-col justify-center">
              <span className="text-sm text-amber-700">Spritkosten/Jahr:</span>
              <span className="text-lg font-bold text-amber-900">
                {berechneteWerte.benzinkosten.toLocaleString('de-DE')} €
              </span>
              <span className="text-xs text-amber-600">
                ({berechneteWerte.benzinverbrauch} Liter)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
