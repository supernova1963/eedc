// components/StrompreisForm.tsx
// Formular zur Erfassung von Strompreisen mit Gültigkeitszeiträumen

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface StrompreisFormProps {
  mitglied_id: string
  anlage_id?: string
  editData?: any
}

export default function StrompreisForm({ mitglied_id, anlage_id, editData }: StrompreisFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anlagen, setAnlagen] = useState<any[]>([])

  const [formData, setFormData] = useState({
    anlage_id: anlage_id || editData?.anlage_id || '',
    gueltig_ab: editData?.gueltig_ab || new Date().toISOString().split('T')[0],
    gueltig_bis: editData?.gueltig_bis || '',
    netzbezug_arbeitspreis_cent_kwh: editData?.netzbezug_arbeitspreis_cent_kwh?.toString() || '',
    netzbezug_grundpreis_euro_monat: editData?.netzbezug_grundpreis_euro_monat?.toString() || '',
    einspeiseverguetung_cent_kwh: editData?.einspeiseverguetung_cent_kwh?.toString() || '',
    anbieter_name: editData?.anbieter_name || '',
    vertragsart: editData?.vertragsart || 'Sondervertrag',
    notizen: editData?.notizen || ''
  })

  // Lade Anlagen des Mitglieds
  useEffect(() => {
    const loadAnlagen = async () => {
      const { data } = await supabase
        .from('anlagen')
        .select('id, anlagenname, leistung_kwp')
        .eq('mitglied_id', mitglied_id)
        .eq('aktiv', true)
        .order('anlagenname')

      setAnlagen(data || [])
    }
    loadAnlagen()
  }, [mitglied_id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validierung
      if (formData.gueltig_bis && formData.gueltig_bis < formData.gueltig_ab) {
        throw new Error('Gültig-Bis darf nicht vor Gültig-Ab liegen')
      }

      const strompreis = {
        mitglied_id,
        anlage_id: formData.anlage_id || null,
        gueltig_ab: formData.gueltig_ab,
        gueltig_bis: formData.gueltig_bis || null,
        netzbezug_arbeitspreis_cent_kwh: parseFloat(formData.netzbezug_arbeitspreis_cent_kwh),
        netzbezug_grundpreis_euro_monat: parseFloat(formData.netzbezug_grundpreis_euro_monat) || 0,
        einspeiseverguetung_cent_kwh: parseFloat(formData.einspeiseverguetung_cent_kwh),
        anbieter_name: formData.anbieter_name || null,
        vertragsart: formData.vertragsart,
        notizen: formData.notizen || null
      }

      let result
      if (editData?.id) {
        result = await supabase
          .from('strompreise')
          .update({ ...strompreis, aktualisiert_am: new Date().toISOString() })
          .eq('id', editData.id)
      } else {
        result = await supabase
          .from('strompreise')
          .insert(strompreis)
      }

      if (result.error) throw result.error

      router.push('/stammdaten/strompreise')
      router.refresh()

    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {editData ? 'Strompreis bearbeiten' : 'Neuer Strompreis'}
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Gültigkeitszeitraum */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Gültigkeitszeitraum</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gültig ab *
              </label>
              <input
                type="date"
                name="gueltig_ab"
                value={formData.gueltig_ab}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Ab wann gelten diese Preise?
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gültig bis
              </label>
              <input
                type="date"
                name="gueltig_bis"
                value={formData.gueltig_bis}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leer lassen = aktuell gültig
              </p>
            </div>
          </div>
        </div>

        {/* Zuordnung */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Zuordnung</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anlage (optional)
            </label>
            <select
              name="anlage_id"
              value={formData.anlage_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Anlagen (Standard-Strompreis)</option>
              {anlagen.map(anlage => (
                <option key={anlage.id} value={anlage.id}>
                  {anlage.anlagenname} ({anlage.leistung_kwp} kWp)
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Anlagenspezifischer Preis oder leer lassen für allgemeinen Preis
            </p>
          </div>
        </div>

        {/* Netzbezug */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Netzbezug (Strombezug)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Arbeitspreis (ct/kWh) *
              </label>
              <input
                type="number"
                name="netzbezug_arbeitspreis_cent_kwh"
                value={formData.netzbezug_arbeitspreis_cent_kwh}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                placeholder="z.B. 32.50"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Preis pro kWh Strombezug aus dem Netz
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grundpreis (€/Monat)
              </label>
              <input
                type="number"
                name="netzbezug_grundpreis_euro_monat"
                value={formData.netzbezug_grundpreis_euro_monat}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="z.B. 12.50"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Monatlicher Grundpreis (optional)
              </p>
            </div>
          </div>
        </div>

        {/* Einspeisung */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Einspeisevergütung</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vergütung (ct/kWh) *
            </label>
            <input
              type="number"
              name="einspeiseverguetung_cent_kwh"
              value={formData.einspeiseverguetung_cent_kwh}
              onChange={handleChange}
              required
              step="0.01"
              min="0"
              placeholder="z.B. 8.20"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Vergütung pro kWh eingespeisten Strom
            </p>
          </div>
        </div>

        {/* Zusatzinformationen */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Zusatzinformationen</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stromanbieter
              </label>
              <input
                type="text"
                name="anbieter_name"
                value={formData.anbieter_name}
                onChange={handleChange}
                placeholder="z.B. Stadtwerke, E.ON"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vertragsart
              </label>
              <select
                name="vertragsart"
                value={formData.vertragsart}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Grundversorgung">Grundversorgung</option>
                <option value="Sondervertrag">Sondervertrag</option>
                <option value="Dynamisch">Dynamischer Tarif</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notizen
            </label>
            <textarea
              name="notizen"
              value={formData.notizen}
              onChange={handleChange}
              rows={3}
              placeholder="z.B. Vertragsnummer, Besonderheiten..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Vorschau Berechnung */}
        {formData.netzbezug_arbeitspreis_cent_kwh && formData.einspeiseverguetung_cent_kwh && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Beispiel-Berechnung:</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-blue-700">Netzbezug 100 kWh:</span>
                <span className="float-right font-medium">
                  {(parseFloat(formData.netzbezug_arbeitspreis_cent_kwh) || 0).toFixed(2)} €
                </span>
              </div>
              <div>
                <span className="text-blue-700">Einspeisung 100 kWh:</span>
                <span className="float-right font-medium">
                  {(parseFloat(formData.einspeiseverguetung_cent_kwh) || 0).toFixed(2)} €
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-blue-300">
                <span className="text-blue-700">Eigenverbrauch lohnt sich:</span>
                <span className="float-right font-bold text-green-700">
                  {((parseFloat(formData.netzbezug_arbeitspreis_cent_kwh) || 0) -
                    (parseFloat(formData.einspeiseverguetung_cent_kwh) || 0)).toFixed(2)} ct/kWh mehr
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
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
            {loading ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
