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
import SimpleIcon from './SimpleIcon'
import { card, text, border, alert, btn, input } from '@/lib/styles'

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

  // Haushalt-Komponenten (keine Anlagen-Zuordnung erforderlich)
  const isHaushaltKomponente = typ === 'e-auto' || typ === 'waermepumpe' || typ === 'wallbox'
  // Anlagen-Komponenten (sollten einer Anlage zugeordnet werden)
  const isAnlagenKomponente = typ === 'pv-module' || typ === 'wechselrichter' || typ === 'speicher' || typ === 'balkonkraftwerk'

  return (
    <div className={card.padded}>
      <h2 className={`${text.h2} mb-6 flex items-center gap-2`}>
        {isEditing ? (
          <>
            <SimpleIcon type="edit" className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            Investition bearbeiten
          </>
        ) : (
          <>
            <SimpleIcon type="plus" className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            Neue Investition erfassen
          </>
        )}
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

        {/* Hinweis zur Zuordnung */}
        {!isEditing && isHaushaltKomponente && (
          <div className={`${alert.infoInline} flex items-start gap-2`}>
            <SimpleIcon type="info" className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>{typConfig?.label}</strong> wird als Haushalt-Komponente erfasst und muss keiner PV-Anlage zugeordnet werden.
            </p>
          </div>
        )}
        {!isEditing && isAnlagenKomponente && (
          <div className={`${alert.successInline} flex items-start gap-2`}>
            <SimpleIcon type="link" className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>{typConfig?.label}</strong> kann nach dem Speichern einer PV-Anlage zugeordnet werden (unter Stammdaten → Zuordnung).
            </p>
          </div>
        )}

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
          <div className={alert.info}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-300 flex items-center gap-2">
                <SimpleIcon type="money" className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                Relevante Mehrkosten (für ROI):
              </span>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {mehrkosten.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
              </span>
            </div>
          </div>
        )}

        {/* Jährliche Kosten */}
        <div className={`border-t ${border.default} pt-6`}>
          <h3 className={`${text.h3} mb-4 flex items-center gap-2`}>
            <SimpleIcon type="money" className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Jährliche Kosten
          </h3>
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
          <label className={input.label}>
            Notizen (optional)
          </label>
          <textarea
            name="notizen"
            value={formData.notizen}
            onChange={handleChange}
            rows={3}
            placeholder="Zusätzliche Informationen..."
            className={input.textarea}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={goBack}
            className={btn.secondaryLg}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`${loading ? btn.disabled : btn.primaryLg} flex items-center gap-2`}
          >
            {loading ? 'Speichert...' : (
              <>
                <SimpleIcon type="save" className="w-4 h-4" />
                {isEditing ? 'Änderungen speichern' : 'Investition speichern'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
