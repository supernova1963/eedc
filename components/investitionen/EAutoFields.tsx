// components/investitionen/EAutoFields.tsx
// E-Auto-spezifische Formularfelder

import FormInput from '@/components/ui/FormInput'

interface EAutoFieldsProps {
  parameterData: {
    km_jahr: string
    verbrauch_kwh_100km: string
    pv_anteil_prozent: string
    vergleich_verbrenner_l_100km: string
    benzinpreis_euro_liter: string
    betriebskosten_jahr_euro: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function EAutoFields({ parameterData, onChange }: EAutoFieldsProps) {
  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">E-Auto Parameter</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
          label="PV-Anteil (%)"
          name="pv_anteil_prozent"
          value={parameterData.pv_anteil_prozent}
          onChange={onChange}
          type="number"
          placeholder="70"
        />
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
          label="Benzinpreis (Euro/l)"
          name="benzinpreis_euro_liter"
          value={parameterData.benzinpreis_euro_liter}
          onChange={onChange}
          type="number"
          step="0.01"
          placeholder="1.69"
        />
        <div className="col-span-2 md:col-span-3 mt-4 pt-4 border-t">
          <FormInput
            label="Betriebskosten (Euro/Jahr) - Prognose"
            name="betriebskosten_jahr_euro"
            value={parameterData.betriebskosten_jahr_euro}
            onChange={onChange}
            type="number"
            step="0.01"
            placeholder="z.B. 800"
            hint="Versicherung, Wartung, Reifen (Schatzung)"
          />
        </div>
      </div>
    </div>
  )
}
