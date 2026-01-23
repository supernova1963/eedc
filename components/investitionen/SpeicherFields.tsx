// components/investitionen/SpeicherFields.tsx
// Batteriespeicher-spezifische Formularfelder

import FormInput from '@/components/ui/FormInput'

interface SpeicherFieldsProps {
  parameterData: {
    kapazitaet_kwh: string
    wirkungsgrad_prozent: string
    betriebskosten_jahr_euro: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function SpeicherFields({ parameterData, onChange }: SpeicherFieldsProps) {
  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Speicher Parameter</h3>
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Kapazitat (kWh)"
          name="kapazitaet_kwh"
          value={parameterData.kapazitaet_kwh}
          onChange={onChange}
          type="number"
          required
          step="0.1"
          placeholder="10"
        />
        <FormInput
          label="Wirkungsgrad (%)"
          name="wirkungsgrad_prozent"
          value={parameterData.wirkungsgrad_prozent}
          onChange={onChange}
          type="number"
          step="0.1"
          placeholder="95"
        />
        <div className="col-span-2 mt-4 pt-4 border-t">
          <FormInput
            label="Betriebskosten (Euro/Jahr) - Prognose"
            name="betriebskosten_jahr_euro"
            value={parameterData.betriebskosten_jahr_euro}
            onChange={onChange}
            type="number"
            step="0.01"
            placeholder="z.B. 0"
            hint="Versicherung, Wartung, ... (Schatzung)"
          />
        </div>
      </div>
    </div>
  )
}
