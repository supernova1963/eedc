// components/MonatsdatenUploadWrapper.tsx
// Wrapper mit Anlagen-Auswahl für Upload

'use client'

import { useState } from 'react'
import MonatsdatenUpload from './MonatsdatenUpload'
import SimpleIcon from './SimpleIcon'

interface Anlage {
  id: string
  anlagenname: string
  leistung_kwp: number
  standort_ort?: string
  installationsdatum: string
}

interface MonatsdatenCount {
  anlageId: string
  count: number
}

interface MonatsdatenUploadWrapperProps {
  anlagen: Anlage[]
  monatsdatenCounts: MonatsdatenCount[]
}

export default function MonatsdatenUploadWrapper({
  anlagen,
  monatsdatenCounts
}: MonatsdatenUploadWrapperProps) {
  const [selectedAnlageId, setSelectedAnlageId] = useState<string>(anlagen[0]?.id || '')

  const selectedAnlage = anlagen.find(a => a.id === selectedAnlageId)
  const selectedCount = monatsdatenCounts.find(c => c.anlageId === selectedAnlageId)?.count || 0

  if (!selectedAnlage) {
    return (
      <div className="text-center py-8 text-gray-500">
        Keine Anlage ausgewählt
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Anlagen-Auswahl */}
      {anlagen.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Anlage auswählen
          </label>
          <select
            value={selectedAnlageId}
            onChange={(e) => setSelectedAnlageId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {anlagen.map((anlage) => {
              const count = monatsdatenCounts.find(c => c.anlageId === anlage.id)?.count || 0
              return (
                <option key={anlage.id} value={anlage.id}>
                  {anlage.anlagenname} • {anlage.leistung_kwp} kWp
                  {count > 0 && ` • ${count} Datensätze`}
                </option>
              )
            })}
          </select>
        </div>
      )}

      {/* Anlagen-Info Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <SimpleIcon type="sun" className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">
              {selectedAnlage.anlagenname}
            </h3>
            <div className="space-y-1 text-sm text-blue-700">
              <p className="flex items-center gap-2">
                <SimpleIcon type="lightning" className="w-4 h-4" />
                <span>{selectedAnlage.leistung_kwp} kWp Leistung</span>
              </p>
              {selectedAnlage.standort_ort && (
                <p className="flex items-center gap-2">
                  <SimpleIcon type="home" className="w-4 h-4" />
                  <span>{selectedAnlage.standort_ort}</span>
                </p>
              )}
              <p className="flex items-center gap-2">
                <SimpleIcon type="calendar" className="w-4 h-4" />
                <span>
                  Installiert seit {new Date(selectedAnlage.installationsdatum).toLocaleDateString('de-DE', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </p>
              {selectedCount > 0 && (
                <p className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-300">
                  <SimpleIcon type="file" className="w-4 h-4" />
                  <span className="font-medium">
                    {selectedCount} Monatsdatensätze bereits vorhanden
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload-Komponente */}
      <div className="pt-4 border-t border-gray-200">
        <MonatsdatenUpload anlageId={selectedAnlageId} />
      </div>
    </div>
  )
}
