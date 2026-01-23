// components/investitionen/WechselrichterFields.tsx
// Wechselrichter-spezifische Formularfelder

import FormInput from '@/components/ui/FormInput'

interface WechselrichterFieldsProps {
  parameterData: {
    leistung_ac_kw: string
    leistung_dc_kw: string
    hersteller_wr: string
    modell_wr: string
    wirkungsgrad_prozent_wr: string
    betriebskosten_jahr_euro: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function WechselrichterFields({ parameterData, onChange }: WechselrichterFieldsProps) {
  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Wechselrichter Parameter</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FormInput
          label="AC-Leistung (kW)"
          name="leistung_ac_kw"
          value={parameterData.leistung_ac_kw}
          onChange={onChange}
          type="number"
          required
          step="0.1"
          placeholder="z.B. 5.0"
          hint="Ausgangsseitige Leistung"
        />
        <FormInput
          label="DC-Leistung (kW)"
          name="leistung_dc_kw"
          value={parameterData.leistung_dc_kw}
          onChange={onChange}
          type="number"
          required
          step="0.1"
          placeholder="z.B. 6.0"
          hint="Eingangsseitige Leistung"
        />
        <FormInput
          label="Wirkungsgrad (%)"
          name="wirkungsgrad_prozent_wr"
          value={parameterData.wirkungsgrad_prozent_wr}
          onChange={onChange}
          type="number"
          step="0.1"
          placeholder="98"
        />
        <FormInput
          label="Hersteller"
          name="hersteller_wr"
          value={parameterData.hersteller_wr}
          onChange={onChange}
          placeholder="z.B. Huawei, SolarEdge"
        />
        <div className="col-span-2">
          <FormInput
            label="Modell"
            name="modell_wr"
            value={parameterData.modell_wr}
            onChange={onChange}
            placeholder="z.B. SUN2000-5KTL-L1"
          />
        </div>
        <div className="col-span-2 md:col-span-3 mt-4 pt-4 border-t">
          <FormInput
            label="Jahrliche Betriebskosten (Euro/Jahr) - Prognose"
            name="betriebskosten_jahr_euro"
            value={parameterData.betriebskosten_jahr_euro}
            onChange={onChange}
            type="number"
            step="0.01"
            placeholder="z.B. 0"
            hint="Wartung, laufende Kosten (Schatzung)"
          />
        </div>
      </div>
    </div>
  )
}
