// components/AnlagenProfilForm.tsx
// Vereinfachtes Profil: Name, Standort, Komponenten

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import SimpleIcon from './SimpleIcon'

interface AnlagenProfilFormProps {
  anlage: any
  mitglied: any
}

export default function AnlagenProfilForm({ anlage, mitglied }: AnlagenProfilFormProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    anlagenname: anlage.anlagenname || '',
    standort_ort: anlage.standort_ort || '',
    standort_plz: anlage.standort_plz || '',
    profilbeschreibung: anlage.profilbeschreibung || '',
    batterie_bezeichnung: anlage.batterie_bezeichnung || '',
    ekfz_bezeichnung: anlage.ekfz_bezeichnung || '',
    waermepumpe_bezeichnung: anlage.waermepumpe_bezeichnung || '',
    sonstiges: anlage.sonstiges || ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const updateData = {
        anlagenname: formData.anlagenname,
        standort_ort: formData.standort_ort,
        standort_plz: formData.standort_plz,
        profilbeschreibung: formData.profilbeschreibung || null,
        batterie_bezeichnung: formData.batterie_bezeichnung || null,
        ekfz_bezeichnung: formData.ekfz_bezeichnung || null,
        waermepumpe_bezeichnung: formData.waermepumpe_bezeichnung || null,
        sonstiges: formData.sonstiges || null
      }

      const { error: dbError } = await supabase
        .from('anlagen')
        .update(updateData)
        .eq('id', anlage.id)

      if (dbError) throw dbError

      setSuccess(true)
      setIsEditing(false)
      router.refresh()

      setTimeout(() => setSuccess(false), 3000)

    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      anlagenname: anlage.anlagenname || '',
      standort_ort: anlage.standort_ort || '',
      standort_plz: anlage.standort_plz || '',
      profilbeschreibung: anlage.profilbeschreibung || '',
      batterie_bezeichnung: anlage.batterie_bezeichnung || '',
      ekfz_bezeichnung: anlage.ekfz_bezeichnung || '',
      waermepumpe_bezeichnung: anlage.waermepumpe_bezeichnung || '',
      sonstiges: anlage.sonstiges || ''
    })
    setIsEditing(false)
    setError(null)
  }

  if (!isEditing) {
    return (
      <div className="space-y-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded flex items-center gap-2">
            <SimpleIcon type="check" className="w-5 h-5" />
            Profil erfolgreich aktualisiert!
          </div>
        )}

        {/* Profil-Übersicht */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="clipboard" className="w-5 h-5 text-gray-600" />
              Öffentliches Profil
            </h2>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-white text-sm flex items-center gap-2"
            >
              <SimpleIcon type="edit" className="w-4 h-4" />
              Bearbeiten
            </button>
          </div>

          <div className="space-y-4">
            {/* Mitglied */}
            <div>
              <div className="text-sm text-gray-600">Mitglied</div>
              <div className="text-lg font-medium text-gray-900">
                {mitglied ? `${mitglied.vorname} ${mitglied.nachname}` : '-'}
              </div>
            </div>

            {/* Anlagenname */}
            <div>
              <div className="text-sm text-gray-600">Anlagenname</div>
              <div className="text-lg font-medium text-gray-900">{anlage.anlagenname || '-'}</div>
            </div>

            {/* Standort */}
            <div>
              <div className="text-sm text-gray-600">Standort</div>
              <div className="text-lg font-medium text-gray-900">
                {anlage.standort_plz && anlage.standort_ort 
                  ? `${anlage.standort_plz} ${anlage.standort_ort}`
                  : '-'
                }
              </div>
            </div>

            {/* Beschreibung */}
            {anlage.profilbeschreibung && (
              <div>
                <div className="text-sm text-gray-600">Beschreibung</div>
                <div className="text-gray-900 whitespace-pre-wrap">{anlage.profilbeschreibung}</div>
              </div>
            )}

            {/* Komponenten */}
            <div className="pt-4 border-t">
              <div className="text-sm font-medium text-gray-900 mb-3">Komponenten:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {anlage.batterie_bezeichnung && (
                  <div className="flex items-center gap-2">
                    <SimpleIcon type="battery" className="w-5 h-5 text-gray-600" />
                    <span className="text-gray-900">{anlage.batterie_bezeichnung}</span>
                  </div>
                )}
                {anlage.ekfz_bezeichnung && (
                  <div className="flex items-center gap-2">
                    <SimpleIcon type="car" className="w-5 h-5 text-gray-600" />
                    <span className="text-gray-900">{anlage.ekfz_bezeichnung}</span>
                  </div>
                )}
                {anlage.waermepumpe_bezeichnung && (
                  <div className="flex items-center gap-2">
                    <SimpleIcon type="heat" className="w-5 h-5 text-orange-500" />
                    <span className="text-gray-900">{anlage.waermepumpe_bezeichnung}</span>
                  </div>
                )}
                {!anlage.batterie_bezeichnung && !anlage.ekfz_bezeichnung && !anlage.waermepumpe_bezeichnung && (
                  <div className="text-gray-500 text-sm">Keine Komponenten angegeben</div>
                )}
              </div>
            </div>

            {/* Sonstiges */}
            {anlage.sonstiges && (
              <div>
                <div className="text-sm text-gray-600">Sonstiges</div>
                <div className="text-gray-900">{anlage.sonstiges}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <SimpleIcon type="edit" className="w-5 h-5 text-gray-700" />
        Profil bearbeiten
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded flex items-center gap-2">
          <SimpleIcon type="error" className="w-5 h-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pflichtfelder */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anlagenname *
            </label>
            <input
              type="text"
              name="anlagenname"
              value={formData.anlagenname}
              onChange={handleChange}
              required
              placeholder="z.B. PV-Anlage Musterstraße"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PLZ *
              </label>
              <input
                type="text"
                name="standort_plz"
                value={formData.standort_plz}
                onChange={handleChange}
                required
                placeholder="51588"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ort *
              </label>
              <input
                type="text"
                name="standort_ort"
                value={formData.standort_ort}
                onChange={handleChange}
                required
                placeholder="Nümbrecht"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beschreibung (optional)
            </label>
            <textarea
              name="profilbeschreibung"
              value={formData.profilbeschreibung}
              onChange={handleChange}
              rows={3}
              placeholder="Beschreibe deine Anlage für die Community..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Komponenten */}
        <div className="pt-6 border-t">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Komponenten</h3>
          <p className="text-sm text-gray-600 mb-4">
            Gib nur eine Bezeichnung an. Detaillierte Daten erfasst du als Investition.
          </p>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <SimpleIcon type="battery" className="w-4 h-4 text-gray-600" />
                Batterie (optional)
              </label>
              <input
                type="text"
                name="batterie_bezeichnung"
                value={formData.batterie_bezeichnung}
                onChange={handleChange}
                placeholder="z.B. Huawei Luna 10 kWh (leer = keine Batterie)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <SimpleIcon type="car" className="w-4 h-4 text-gray-600" />
                E-Fahrzeug (optional)
              </label>
              <input
                type="text"
                name="ekfz_bezeichnung"
                value={formData.ekfz_bezeichnung}
                onChange={handleChange}
                placeholder="z.B. Tesla Model 3 (leer = kein E-Fahrzeug)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <SimpleIcon type="heat" className="w-4 h-4 text-orange-500" />
                Wärmepumpe (optional)
              </label>
              <input
                type="text"
                name="waermepumpe_bezeichnung"
                value={formData.waermepumpe_bezeichnung}
                onChange={handleChange}
                placeholder="z.B. Vaillant aroTHERM (leer = keine Wärmepumpe)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sonstiges (optional)
              </label>
              <input
                type="text"
                name="sonstiges"
                value={formData.sonstiges}
                onChange={handleChange}
                placeholder="Weitere Komponenten..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-6 py-3 rounded-md font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3 rounded-md font-medium text-white flex items-center gap-2 ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Speichert...' : (
              <>
                <SimpleIcon type="save" className="w-4 h-4" />
                Speichern
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
