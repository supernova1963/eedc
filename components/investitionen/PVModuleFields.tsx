// components/investitionen/PVModuleFields.tsx
// PV-Module-spezifische Formularfelder

import FormInput from '@/components/ui/FormInput'
import FormSelect from '@/components/ui/FormSelect'

interface Wechselrichter {
  id: string
  bezeichnung: string
  parameter?: {
    leistung_ac_kw?: number
  }
}

interface PVModuleFieldsProps {
  parameterData: {
    leistung_kwp_pv: string
    anzahl_module: string
    hersteller_pv: string
    modell_pv: string
    ausrichtung: string
    neigung_grad: string
    geokoordinaten_lat: string
    geokoordinaten_lon: string
    jahresertrag_prognose_kwh_pv: string
    betriebskosten_jahr_euro: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  wechselrichter: Wechselrichter[]
  parentInvestitionId: string
  onParentChange: (id: string) => void
}

const ausrichtungOptions = [
  { value: 'Sud', label: 'Sud' },
  { value: 'Sudost', label: 'Sudost' },
  { value: 'Sudwest', label: 'Sudwest' },
  { value: 'Ost', label: 'Ost' },
  { value: 'West', label: 'West' },
  { value: 'Ost-West', label: 'Ost-West' }
]

export default function PVModuleFields({
  parameterData,
  onChange,
  wechselrichter,
  parentInvestitionId,
  onParentChange
}: PVModuleFieldsProps) {
  const wechselrichterOptions = [
    { value: '', label: '-- Wechselrichter wahlen --' },
    ...wechselrichter.map(wr => ({
      value: wr.id,
      label: `${wr.bezeichnung} (${wr.parameter?.leistung_ac_kw || '?'} kW AC)`
    }))
  ]

  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">PV-Module Parameter</h3>

      {/* Wechselrichter Zuordnung */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <FormSelect
          label="Wechselrichter zuordnen"
          name="parent_investition_id"
          value={parentInvestitionId}
          onChange={(e) => onParentChange(e.target.value)}
          options={wechselrichterOptions}
          required
          id="parent-wechselrichter"
        />
        {wechselrichter.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">
            Bitte lege zuerst einen Wechselrichter an!
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FormInput
          label="Leistung (kWp)"
          name="leistung_kwp_pv"
          value={parameterData.leistung_kwp_pv}
          onChange={onChange}
          type="number"
          required
          step="0.01"
          placeholder="z.B. 3.5"
        />
        <FormInput
          label="Anzahl Module"
          name="anzahl_module"
          value={parameterData.anzahl_module}
          onChange={onChange}
          type="number"
          placeholder="z.B. 10"
        />
        <FormSelect
          label="Ausrichtung"
          name="ausrichtung"
          value={parameterData.ausrichtung}
          onChange={onChange}
          options={ausrichtungOptions}
          id="ausrichtung"
        />
        <FormInput
          label="Neigung (Grad)"
          name="neigung_grad"
          value={parameterData.neigung_grad}
          onChange={onChange}
          type="number"
          placeholder="30"
        />
        <FormInput
          label="Hersteller"
          name="hersteller_pv"
          value={parameterData.hersteller_pv}
          onChange={onChange}
          placeholder="z.B. Longi, JA Solar"
        />
        <FormInput
          label="Modell"
          name="modell_pv"
          value={parameterData.modell_pv}
          onChange={onChange}
          placeholder="z.B. LR5-54HPH"
        />
      </div>

      {/* Geokoordinaten */}
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Geokoordinaten (optional)</h4>
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Breitengrad (Latitude)"
            name="geokoordinaten_lat"
            value={parameterData.geokoordinaten_lat}
            onChange={onChange}
            type="number"
            step="0.000001"
            placeholder="z.B. 50.9"
          />
          <FormInput
            label="Langengrad (Longitude)"
            name="geokoordinaten_lon"
            value={parameterData.geokoordinaten_lon}
            onChange={onChange}
            type="number"
            step="0.000001"
            placeholder="z.B. 7.6"
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Wird automatisch aus Anlagen-Standort vorgeschlagen
        </p>
      </div>

      {/* Jahresertrag Prognose */}
      <div className="mt-4">
        <FormInput
          label="Jahresertrag Prognose (kWh/Jahr)"
          name="jahresertrag_prognose_kwh_pv"
          value={parameterData.jahresertrag_prognose_kwh_pv}
          onChange={onChange}
          type="number"
          placeholder="z.B. 3500 (spater automatisch via PVGIS)"
          hint="Manuell eingeben oder spater automatisch via PVGIS berechnen"
        />
      </div>

      {/* Betriebskosten */}
      <div className="mt-4 pt-4 border-t">
        <FormInput
          label="Jahrliche Betriebskosten (Euro/Jahr) - Prognose"
          name="betriebskosten_jahr_euro"
          value={parameterData.betriebskosten_jahr_euro}
          onChange={onChange}
          type="number"
          step="0.01"
          placeholder="z.B. 50"
          hint="Wartung, Reinigung, laufende Kosten (Schatzung)"
        />
      </div>
    </div>
  )
}
