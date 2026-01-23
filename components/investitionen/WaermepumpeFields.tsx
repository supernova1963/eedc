// components/investitionen/WaermepumpeFields.tsx
// Warmepumpe-spezifische Formularfelder

import FormInput from '@/components/ui/FormInput'
import FormSelect from '@/components/ui/FormSelect'

interface WaermepumpeFieldsProps {
  parameterData: {
    heizlast_kw: string
    jaz: string
    waermebedarf_kwh_jahr: string
    pv_anteil_prozent: string
    alter_energietraeger: string
    alter_preis_cent_kwh: string
    betriebskosten_jahr_euro: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

const energietraegerOptions = [
  { value: 'Gas', label: 'Gas' },
  { value: 'Ol', label: 'Ol' },
  { value: 'Strom', label: 'Strom' }
]

export default function WaermepumpeFields({ parameterData, onChange }: WaermepumpeFieldsProps) {
  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Warmepumpe Parameter</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FormInput
          label="Heizlast (kW)"
          name="heizlast_kw"
          value={parameterData.heizlast_kw}
          onChange={onChange}
          type="number"
          required
          step="0.1"
          placeholder="10"
        />
        <FormInput
          label="JAZ"
          name="jaz"
          value={parameterData.jaz}
          onChange={onChange}
          type="number"
          required
          step="0.1"
          placeholder="3.5"
        />
        <FormInput
          label="Warmebedarf (kWh/Jahr)"
          name="waermebedarf_kwh_jahr"
          value={parameterData.waermebedarf_kwh_jahr}
          onChange={onChange}
          type="number"
          required
          placeholder="20000"
        />
        <FormInput
          label="PV-Anteil (%)"
          name="pv_anteil_prozent"
          value={parameterData.pv_anteil_prozent}
          onChange={onChange}
          type="number"
          placeholder="40"
        />
        <FormSelect
          label="Alter Energietrager"
          name="alter_energietraeger"
          value={parameterData.alter_energietraeger}
          onChange={onChange}
          options={energietraegerOptions}
          id="alter-energietraeger"
        />
        <FormInput
          label="Alter Preis (ct/kWh)"
          name="alter_preis_cent_kwh"
          value={parameterData.alter_preis_cent_kwh}
          onChange={onChange}
          type="number"
          step="0.1"
          placeholder="8"
        />
        <div className="col-span-2 md:col-span-3 mt-4 pt-4 border-t">
          <FormInput
            label="Betriebskosten (Euro/Jahr) - Prognose"
            name="betriebskosten_jahr_euro"
            value={parameterData.betriebskosten_jahr_euro}
            onChange={onChange}
            type="number"
            step="0.01"
            placeholder="z.B. 150"
            hint="Wartung, Versicherung (Schatzung)"
          />
        </div>
      </div>
    </div>
  )
}
