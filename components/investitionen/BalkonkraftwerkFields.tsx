// components/investitionen/BalkonkraftwerkFields.tsx
// Balkonkraftwerk-spezifische Formularfelder

import FormInput from '@/components/ui/FormInput'

interface BalkonkraftwerkFieldsProps {
  parameterData: {
    leistung_kwp: string
    jahresertrag_kwh_prognose: string
    betriebskosten_jahr_euro: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function BalkonkraftwerkFields({ parameterData, onChange }: BalkonkraftwerkFieldsProps) {
  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Balkonkraftwerk Parameter</h3>
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Leistung (kWp)"
          name="leistung_kwp"
          value={parameterData.leistung_kwp}
          onChange={onChange}
          type="number"
          required
          step="0.01"
          placeholder="0.8"
        />
        <FormInput
          label="Jahresertrag (kWh)"
          name="jahresertrag_kwh_prognose"
          value={parameterData.jahresertrag_kwh_prognose}
          onChange={onChange}
          type="number"
          required
          placeholder="800"
        />
        <div className="col-span-2 mt-4 pt-4 border-t">
          <FormInput
            label="Jahrliche Betriebskosten (Euro/Jahr) - Prognose"
            name="betriebskosten_jahr_euro"
            value={parameterData.betriebskosten_jahr_euro}
            onChange={onChange}
            type="number"
            step="0.01"
            placeholder="z.B. 50"
            hint="Versicherung, Wartung, ... (Schatzung)"
          />
        </div>
      </div>
    </div>
  )
}
