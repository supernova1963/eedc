// components/InvestitionFormSimple.tsx
// Vereinfachtes Formular mit Gesamt-Kosten statt Einzel-Kosten
// Refaktoriert: Logik in Hook, Typ-Felder in Subkomponenten

'use client'

import { useInvestitionForm } from '@/hooks/useInvestitionForm'
import { INVESTITION_TYP_OPTIONS, INVESTITION_TYPEN, InvestitionsTyp } from '@/lib/investitionTypes'
import FormInput from '@/components/ui/FormInput'
import FormSelect from '@/components/ui/FormSelect'
import Alert from '@/components/ui/Alert'
import EAutoFields from '@/components/investitionen/EAutoFields'
import WaermepumpeFields from '@/components/investitionen/WaermepumpeFields'
import SpeicherFields from '@/components/investitionen/SpeicherFields'
import BalkonkraftwerkFields from '@/components/investitionen/BalkonkraftwerkFields'
import WechselrichterFields from '@/components/investitionen/WechselrichterFields'
import PVModuleFields from '@/components/investitionen/PVModuleFields'
import ResultsPreview from '@/components/investitionen/ResultsPreview'

interface InvestitionFormSimpleProps {
  mitgliedId: string
  editData?: any
  onSuccess?: () => void
}

export default function InvestitionFormSimple({ mitgliedId, editData, onSuccess }: InvestitionFormSimpleProps) {
  const {
    typ,
    setTyp,
    formData,
    parameterData,
    loading,
    error,
    isEditing,
    parentInvestitionId,
    setParentInvestitionId,
    wechselrichter,
    handleChange,
    handleParamChange,
    handleSubmit,
    mehrkosten,
    berechneteWerte,
    goBack
  } = useInvestitionForm({ mitgliedId, editData, onSuccess })

  const typConfig = INVESTITION_TYPEN[typ]
  const showAlternative = typConfig?.hasAlternative ?? false

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {isEditing ? '✏️ Investition bearbeiten' : '➕ Neue Investition erfassen'}
      </h2>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Typ-Auswahl */}
        <FormSelect
          label="Investitions-Typ"
          name="typ"
          value={typ}
          onChange={(e) => setTyp(e.target.value as InvestitionsTyp)}
          options={INVESTITION_TYP_OPTIONS}
          required
          disabled={isEditing}
          id="investitions-typ"
        />

        {/* Basis-Felder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Bezeichnung"
            name="bezeichnung"
            value={formData.bezeichnung}
            onChange={handleChange}
            required
            placeholder="z.B. Tesla Model 3 Long Range"
            className="md:col-span-2"
          />

          <FormInput
            label="Anschaffungsdatum"
            name="anschaffungsdatum"
            value={formData.anschaffungsdatum}
            onChange={handleChange}
            type="date"
            required
          />

          <FormInput
            label="Anschaffungskosten"
            name="anschaffungskosten_gesamt"
            value={formData.anschaffungskosten_gesamt}
            onChange={handleChange}
            type="number"
            required
            step="0.01"
            placeholder="z.B. 45000"
          />

          {/* Alternative nur bei E-Auto & Wärmepumpe */}
          {showAlternative && (
            <>
              <FormInput
                label="Alternative Anschaffungskosten"
                name="anschaffungskosten_alternativ"
                value={formData.anschaffungskosten_alternativ}
                onChange={handleChange}
                type="number"
                step="0.01"
                placeholder={typ === 'e-auto' ? 'z.B. 35000 (Verbrenner)' : 'z.B. 15000 (Gasheizung)'}
                hint="Was hätte die Alternative gekostet?"
              />
              <FormInput
                label="Alternative Beschreibung"
                name="alternativ_beschreibung"
                value={formData.alternativ_beschreibung}
                onChange={handleChange}
                placeholder={typ === 'e-auto' ? 'z.B. VW Golf Benziner' : 'z.B. Gasheizung'}
              />
            </>
          )}
        </div>

        {/* Mehrkosten-Anzeige */}
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

        {/* Jährliche Kosten */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">💸 Jährliche Kosten</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Gesamt-Kosten pro Jahr (aktuell)"
              name="kosten_jahr_gesamt"
              value={formData.kosten_jahr_gesamt}
              onChange={handleChange}
              type="number"
              step="0.01"
              placeholder="z.B. 1300"
              hint={typConfig?.kostenHilfe?.aktuell}
            />
            <FormInput
              label="Gesamt-Kosten pro Jahr (Alternative)"
              name="kosten_jahr_alternativ_gesamt"
              value={formData.kosten_jahr_alternativ_gesamt}
              onChange={handleChange}
              type="number"
              step="0.01"
              placeholder="z.B. 3700"
              hint={typConfig?.kostenHilfe?.alternativ}
            />
          </div>
        </div>

        {/* Typ-spezifische Parameter */}
        {typ === 'e-auto' && (
          <EAutoFields parameterData={parameterData} onChange={handleParamChange} />
        )}
        {typ === 'waermepumpe' && (
          <WaermepumpeFields parameterData={parameterData} onChange={handleParamChange} />
        )}
        {typ === 'speicher' && (
          <SpeicherFields parameterData={parameterData} onChange={handleParamChange} />
        )}
        {typ === 'balkonkraftwerk' && (
          <BalkonkraftwerkFields parameterData={parameterData} onChange={handleParamChange} />
        )}
        {typ === 'wechselrichter' && (
          <WechselrichterFields parameterData={parameterData} onChange={handleParamChange} />
        )}
        {typ === 'pv-module' && (
          <PVModuleFields
            parameterData={parameterData}
            onChange={handleParamChange}
            wechselrichter={wechselrichter}
            parentInvestitionId={parentInvestitionId}
            onParentChange={setParentInvestitionId}
          />
        )}

        {/* Berechnete Werte */}
        <ResultsPreview
          jahresEinsparung={berechneteWerte.jahresEinsparung}
          co2Einsparung={berechneteWerte.co2Einsparung}
          mehrkosten={mehrkosten}
        />

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
            onClick={goBack}
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
