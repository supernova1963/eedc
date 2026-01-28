// components/AnlagenProfilForm.tsx
// Vereinfachtes Profil: Name, Standort, Komponenten

'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
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
    motivation: anlage.motivation || '',
    erfahrungen: anlage.erfahrungen || '',
    tipps_fuer_andere: anlage.tipps_fuer_andere || '',
    wechselrichter_bezeichnung: anlage.wechselrichter_bezeichnung || '',
    pv_module_bezeichnung: anlage.pv_module_bezeichnung || '',
    batterie_bezeichnung: anlage.batterie_bezeichnung || '',
    ekfz_bezeichnung: anlage.ekfz_bezeichnung || '',
    waermepumpe_bezeichnung: anlage.waermepumpe_bezeichnung || '',
    solarteur_name: anlage.solarteur_name || '',
    sonstiges: anlage.sonstiges || '',
    kontakt_erwuenscht: anlage.kontakt_erwuenscht || false
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createBrowserClient()

      const updateData = {
        anlagenname: formData.anlagenname,
        standort_ort: formData.standort_ort,
        standort_plz: formData.standort_plz,
        profilbeschreibung: formData.profilbeschreibung || null,
        motivation: formData.motivation || null,
        erfahrungen: formData.erfahrungen || null,
        tipps_fuer_andere: formData.tipps_fuer_andere || null,
        wechselrichter_bezeichnung: formData.wechselrichter_bezeichnung || null,
        pv_module_bezeichnung: formData.pv_module_bezeichnung || null,
        batterie_bezeichnung: formData.batterie_bezeichnung || null,
        ekfz_bezeichnung: formData.ekfz_bezeichnung || null,
        waermepumpe_bezeichnung: formData.waermepumpe_bezeichnung || null,
        solarteur_name: formData.solarteur_name || null,
        sonstiges: formData.sonstiges || null,
        kontakt_erwuenscht: formData.kontakt_erwuenscht
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
      motivation: anlage.motivation || '',
      erfahrungen: anlage.erfahrungen || '',
      tipps_fuer_andere: anlage.tipps_fuer_andere || '',
      wechselrichter_bezeichnung: anlage.wechselrichter_bezeichnung || '',
      pv_module_bezeichnung: anlage.pv_module_bezeichnung || '',
      batterie_bezeichnung: anlage.batterie_bezeichnung || '',
      ekfz_bezeichnung: anlage.ekfz_bezeichnung || '',
      waermepumpe_bezeichnung: anlage.waermepumpe_bezeichnung || '',
      solarteur_name: anlage.solarteur_name || '',
      sonstiges: anlage.sonstiges || '',
      kontakt_erwuenscht: anlage.kontakt_erwuenscht || false
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

            {/* Community-Profil Felder */}
            {anlage.motivation && (
              <div className="pt-4 border-t">
                <div className="text-sm font-medium text-gray-600 mb-1">💡 Motivation</div>
                <div className="text-gray-900 whitespace-pre-wrap">{anlage.motivation}</div>
              </div>
            )}

            {anlage.erfahrungen && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">📝 Erfahrungen</div>
                <div className="text-gray-900 whitespace-pre-wrap">{anlage.erfahrungen}</div>
              </div>
            )}

            {anlage.tipps_fuer_andere && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">💭 Tipps für andere</div>
                <div className="text-gray-900 whitespace-pre-wrap">{anlage.tipps_fuer_andere}</div>
              </div>
            )}

            {anlage.kontakt_erwuenscht && (
              <div className="flex items-center gap-2 text-sm">
                <SimpleIcon type="check" className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Kontakt von anderen Community-Mitgliedern erwünscht</span>
              </div>
            )}

            {/* Komponenten */}
            <div className="pt-4 border-t">
              <div className="text-sm font-medium text-gray-900 mb-3">Komponenten:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {anlage.wechselrichter_bezeichnung && (
                  <div className="flex items-center gap-2">
                    <SimpleIcon type="settings" className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="text-xs text-gray-500">Wechselrichter</div>
                      <div className="text-gray-900">{anlage.wechselrichter_bezeichnung}</div>
                    </div>
                  </div>
                )}
                {anlage.pv_module_bezeichnung && (
                  <div className="flex items-center gap-2">
                    <SimpleIcon type="solar" className="w-5 h-5 text-yellow-500" />
                    <div>
                      <div className="text-xs text-gray-500">PV-Module</div>
                      <div className="text-gray-900">{anlage.pv_module_bezeichnung}</div>
                    </div>
                  </div>
                )}
                {anlage.batterie_bezeichnung && (
                  <div className="flex items-center gap-2">
                    <SimpleIcon type="battery" className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-xs text-gray-500">Batteriespeicher</div>
                      <div className="text-gray-900">{anlage.batterie_bezeichnung}</div>
                    </div>
                  </div>
                )}
                {anlage.ekfz_bezeichnung && (
                  <div className="flex items-center gap-2">
                    <SimpleIcon type="car" className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-xs text-gray-500">E-Fahrzeug</div>
                      <div className="text-gray-900">{anlage.ekfz_bezeichnung}</div>
                    </div>
                  </div>
                )}
                {anlage.waermepumpe_bezeichnung && (
                  <div className="flex items-center gap-2">
                    <SimpleIcon type="heat" className="w-5 h-5 text-orange-500" />
                    <div>
                      <div className="text-xs text-gray-500">Wärmepumpe</div>
                      <div className="text-gray-900">{anlage.waermepumpe_bezeichnung}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Solarteur */}
              {anlage.solarteur_name && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-gray-500">Installateur / Solarteur</div>
                  <div className="text-gray-900">{anlage.solarteur_name}</div>
                </div>
              )}

              {/* Keine Komponenten */}
              {!anlage.wechselrichter_bezeichnung && !anlage.pv_module_bezeichnung &&
               !anlage.batterie_bezeichnung && !anlage.ekfz_bezeichnung &&
               !anlage.waermepumpe_bezeichnung && !anlage.solarteur_name && (
                <div className="text-gray-500 text-sm">Keine Komponenten angegeben</div>
              )}
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
              Kurzbeschreibung (optional)
            </label>
            <textarea
              name="profilbeschreibung"
              value={formData.profilbeschreibung}
              onChange={handleChange}
              rows={2}
              maxLength={500}
              placeholder="Kurze Beschreibung deiner Anlage (max. 500 Zeichen)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.profilbeschreibung.length}/500 Zeichen
            </p>
          </div>
        </div>

        {/* Community-Profil (optional, öffentlich) */}
        <div className="pt-6 border-t">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-medium text-blue-900 mb-2 flex items-center gap-2">
              <SimpleIcon type="users" className="w-5 h-5" />
              Community-Profil (freiwillig & öffentlich)
            </h3>
            <p className="text-sm text-blue-800">
              Diese Informationen sind <strong>öffentlich sichtbar</strong>, wenn du deine Anlage
              für die Community freigibst. Teile deine Erfahrungen und hilf anderen bei der Entscheidung für PV!
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💡 Warum hast du dich für PV entschieden?
              </label>
              <textarea
                name="motivation"
                value={formData.motivation}
                onChange={handleChange}
                rows={3}
                placeholder="Z.B. Umweltschutz, Unabhängigkeit vom Stromnetz, Kosteneinsparung..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Deine Erfahrungen mit der Anlage
              </label>
              <textarea
                name="erfahrungen"
                value={formData.erfahrungen}
                onChange={handleChange}
                rows={4}
                placeholder="Was waren deine wichtigsten Erfahrungen? Wie läuft die Anlage? Gab es Überraschungen?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💭 Tipps für andere PV-Interessierte
              </label>
              <textarea
                name="tipps_fuer_andere"
                value={formData.tipps_fuer_andere}
                onChange={handleChange}
                rows={3}
                placeholder="Was würdest du anderen empfehlen? Worauf sollte man achten?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                name="kontakt_erwuenscht"
                checked={formData.kontakt_erwuenscht}
                onChange={handleChange}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700">
                <span className="font-medium">Kontakt erwünscht</span>
                <p className="text-gray-600 mt-1">
                  Ich bin offen dafür, von anderen Community-Mitgliedern kontaktiert zu werden
                  (z.B. für Erfahrungsaustausch oder Fragen zur Anlage)
                </p>
              </label>
            </div>
          </div>
        </div>

        {/* Komponenten */}
        <div className="pt-6 border-t">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Komponenten</h3>
          <p className="text-sm text-gray-600 mb-4">
            Gib nur eine Bezeichnung an. Detaillierte Daten erfasst du als Investition.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <SimpleIcon type="settings" className="w-4 h-4 text-gray-600" />
                  Wechselrichter
                </label>
                <input
                  type="text"
                  name="wechselrichter_bezeichnung"
                  value={formData.wechselrichter_bezeichnung}
                  onChange={handleChange}
                  placeholder="z.B. SMA Sunny Tripower"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <SimpleIcon type="solar" className="w-4 h-4 text-yellow-500" />
                  PV-Module
                </label>
                <input
                  type="text"
                  name="pv_module_bezeichnung"
                  value={formData.pv_module_bezeichnung}
                  onChange={handleChange}
                  placeholder="z.B. Trina Solar Vertex 410W"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <SimpleIcon type="battery" className="w-4 h-4 text-green-600" />
                Batteriespeicher
              </label>
              <input
                type="text"
                name="batterie_bezeichnung"
                value={formData.batterie_bezeichnung}
                onChange={handleChange}
                placeholder="z.B. Huawei Luna 10 kWh (leer lassen wenn keine Batterie)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <SimpleIcon type="car" className="w-4 h-4 text-blue-600" />
                  E-Fahrzeug
                </label>
                <input
                  type="text"
                  name="ekfz_bezeichnung"
                  value={formData.ekfz_bezeichnung}
                  onChange={handleChange}
                  placeholder="z.B. Tesla Model 3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <SimpleIcon type="heat" className="w-4 h-4 text-orange-500" />
                  Wärmepumpe
                </label>
                <input
                  type="text"
                  name="waermepumpe_bezeichnung"
                  value={formData.waermepumpe_bezeichnung}
                  onChange={handleChange}
                  placeholder="z.B. Vaillant aroTHERM"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <SimpleIcon type="user" className="w-4 h-4 text-gray-600" />
                Installateur / Solarteur
              </label>
              <input
                type="text"
                name="solarteur_name"
                value={formData.solarteur_name}
                onChange={handleChange}
                placeholder="z.B. Mustermann Solar GmbH"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sonstiges
              </label>
              <input
                type="text"
                name="sonstiges"
                value={formData.sonstiges}
                onChange={handleChange}
                placeholder="Weitere Komponenten oder Anmerkungen..."
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
