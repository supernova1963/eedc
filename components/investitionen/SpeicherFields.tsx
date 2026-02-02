// components/investitionen/SpeicherFields.tsx
// Batteriespeicher-spezifische Formularfelder

import FormInput from '@/components/ui/FormInput'
import SimpleIcon from '@/components/SimpleIcon'

interface SpeicherFieldsProps {
  parameterData: {
    kapazitaet_kwh: string
    wirkungsgrad_prozent: string
    betriebskosten_jahr_euro: string
    nutzt_arbitrage?: boolean
    lade_durchschnittspreis_cent?: string
    entlade_vermiedener_preis_cent?: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function SpeicherFields({ parameterData, onChange }: SpeicherFieldsProps) {
  // Checkbox-Handler für boolean-Wert
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        name: e.target.name,
        value: e.target.checked
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>
    onChange(syntheticEvent)
  }

  return (
    <div className="border-t pt-6 dark:border-gray-700">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Speicher Parameter</h3>
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
        <div className="col-span-2 mt-4 pt-4 border-t dark:border-gray-700">
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

        {/* Arbitrage-Sektion für dynamische Stromtarife */}
        <div className="col-span-2 mt-4 pt-4 border-t dark:border-gray-700">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              id="nutzt_arbitrage"
              name="nutzt_arbitrage"
              checked={parameterData.nutzt_arbitrage || false}
              onChange={handleCheckboxChange}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <label htmlFor="nutzt_arbitrage" className="flex-1">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                Nutzt dynamischen Stromtarif (Arbitrage)
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Aktivieren wenn der Speicher gezielt bei günstigen Strompreisen aus dem Netz geladen wird
                (z.B. mit Tibber, aWATTar oder anderem dynamischen Tarif).
              </p>
            </label>
          </div>

          {parameterData.nutzt_arbitrage && (
            <div className="ml-7 space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <SimpleIcon type="info" className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Diese Preise dienen als Standardwerte. Bei der monatlichen Erfassung können Sie
                    den tatsächlichen Durchschnittspreis des Monats eingeben (z.B. aus der Tibber-App).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Typischer Ladepreis (ct/kWh)"
                  name="lade_durchschnittspreis_cent"
                  value={parameterData.lade_durchschnittspreis_cent || ''}
                  onChange={onChange}
                  type="number"
                  step="0.1"
                  placeholder="z.B. 15"
                  hint="Durchschnittlicher Preis beim Laden aus dem Netz"
                />
                <FormInput
                  label="Typischer Entladepreis (ct/kWh)"
                  name="entlade_vermiedener_preis_cent"
                  value={parameterData.entlade_vermiedener_preis_cent || ''}
                  onChange={onChange}
                  type="number"
                  step="0.1"
                  placeholder="z.B. 35"
                  hint="Durchschnittlicher vermiedener Preis bei Entladung (optional)"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
