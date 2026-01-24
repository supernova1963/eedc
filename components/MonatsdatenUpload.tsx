// components/MonatsdatenUpload.tsx
// Upload-Komponente für Monatsdaten-Import aus CSV/Excel

'use client'

import { useState, useRef } from 'react'
import SimpleIcon from './SimpleIcon'

interface ValidationError {
  row: number
  field: string
  message: string
}

interface ParsedMonatsdaten {
  jahr: number
  monat: number
  gesamtverbrauch_kwh?: number
  pv_erzeugung_kwh?: number
  direktverbrauch_kwh?: number
  batterieentladung_kwh?: number
  batterieladung_kwh?: number
  netzbezug_kwh?: number
  einspeisung_kwh?: number
  ekfz_ladung_kwh?: number
  netzbezug_kosten_euro?: number
  einspeisung_ertrag_euro?: number
  grundpreis_euro?: number
  netzbezugspreis_cent_kwh?: number
  einspeiseverguetung_cent_kwh?: number
  betriebsausgaben_monat_euro?: number
  notizen?: string
}

interface UploadResponse {
  success: boolean
  data?: ParsedMonatsdaten[]
  errors?: ValidationError[]
  warnings?: ValidationError[]
  message?: string
}

interface MonatsdatenUploadProps {
  anlageId: string
  onSuccess?: () => void
}

export default function MonatsdatenUpload({ anlageId, onSuccess }: MonatsdatenUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [previewData, setPreviewData] = useState<ParsedMonatsdaten[] | null>(null)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [warnings, setWarnings] = useState<ValidationError[]>([])
  const [uploadComplete, setUploadComplete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    // Überprüfe Dateityp
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    const isValidType = validTypes.includes(selectedFile.type) ||
                       selectedFile.name.endsWith('.csv') ||
                       selectedFile.name.endsWith('.xlsx') ||
                       selectedFile.name.endsWith('.xls')

    if (!isValidType) {
      setErrors([{ row: 0, field: 'file', message: 'Bitte wähle eine CSV- oder Excel-Datei (.csv, .xlsx, .xls)' }])
      return
    }

    // Überprüfe Dateigröße (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrors([{ row: 0, field: 'file', message: 'Datei ist zu groß. Maximal 5 MB erlaubt.' }])
      return
    }

    setFile(selectedFile)
    setErrors([])
    setWarnings([])
    setPreviewData(null)
    setUploadComplete(false)
  }

  const parseAndPreview = async () => {
    if (!file) return

    setIsUploading(true)
    setErrors([])
    setWarnings([])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('anlageId', anlageId)
      formData.append('preview', 'true')

      const response = await fetch('/api/upload-monatsdaten', {
        method: 'POST',
        body: formData
      })

      const result: UploadResponse = await response.json()

      if (result.success && result.data) {
        setPreviewData(result.data)
        setErrors(result.errors || [])
        setWarnings(result.warnings || [])
      } else {
        setErrors(result.errors || [{ row: 0, field: 'general', message: result.message || 'Fehler beim Parsen' }])
      }
    } catch (error) {
      console.error('Upload error:', error)
      setErrors([{ row: 0, field: 'general', message: 'Netzwerkfehler beim Upload' }])
    } finally {
      setIsUploading(false)
    }
  }

  const confirmImport = async () => {
    if (!file || !previewData) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('anlageId', anlageId)
      formData.append('preview', 'false')

      const response = await fetch('/api/upload-monatsdaten', {
        method: 'POST',
        body: formData
      })

      const result: UploadResponse = await response.json()

      if (result.success) {
        setUploadComplete(true)
        setPreviewData(null)
        setFile(null)

        // Seite nach 2 Sekunden neu laden
        setTimeout(() => {
          if (onSuccess) {
            onSuccess()
          } else {
            window.location.reload()
          }
        }, 2000)
      } else {
        setErrors(result.errors || [{ row: 0, field: 'general', message: result.message || 'Fehler beim Import' }])
      }
    } catch (error) {
      console.error('Import error:', error)
      setErrors([{ row: 0, field: 'general', message: 'Netzwerkfehler beim Import' }])
    } finally {
      setIsUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreviewData(null)
    setErrors([])
    setWarnings([])
    setUploadComplete(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  return (
    <div className="space-y-4">
      {/* Upload-Bereich */}
      {!file && !uploadComplete && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
        >
          <SimpleIcon type="upload" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Datei hierher ziehen oder klicken zum Auswählen
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Unterstützte Formate: CSV, Excel (.xlsx, .xls) • Max. 5 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
          >
            <SimpleIcon type="file" className="w-4 h-4" />
            Datei auswählen
          </label>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <a
              href={`/api/csv-template?anlageId=${anlageId}`}
              download
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <SimpleIcon type="download" className="w-4 h-4" />
              Personalisierte CSV-Vorlage herunterladen
            </a>
            <p className="text-xs text-gray-500 mt-2">
              Enthält nur für deine Anlage relevante Felder
            </p>
          </div>
        </div>
      )}

      {/* Fehler-Anzeige */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <SimpleIcon type="alert" className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900 mb-2">Fehler beim Import</h4>
              <ul className="space-y-1 text-sm text-red-700">
                {errors.map((err, i) => (
                  <li key={i}>
                    {err.row > 0 && `Zeile ${err.row}: `}
                    {err.field && `${err.field} - `}
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Neue Datei auswählen
          </button>
        </div>
      )}

      {/* Warnungen */}
      {warnings.length > 0 && !errors.length && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <SimpleIcon type="alert" className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900 mb-2">Warnungen</h4>
              <ul className="space-y-1 text-sm text-yellow-700">
                {warnings.map((warn, i) => (
                  <li key={i}>
                    {warn.row > 0 && `Zeile ${warn.row}: `}
                    {warn.field && `${warn.field} - `}
                    {warn.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Datei ausgewählt */}
      {file && !previewData && !uploadComplete && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SimpleIcon type="file" className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={reset}
              className="text-gray-400 hover:text-gray-600"
              title="Datei entfernen"
            >
              <SimpleIcon type="close" className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={parseAndPreview}
            disabled={isUploading}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors
              ${isUploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Analysiere Datei...
              </>
            ) : (
              <>
                <SimpleIcon type="eye" className="w-5 h-5" />
                Vorschau laden
              </>
            )}
          </button>
        </div>
      )}

      {/* Preview */}
      {previewData && !uploadComplete && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Vorschau: {previewData.length} Datensätze gefunden
          </h3>

          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Jahr</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Monat</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">PV (kWh)</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Verbrauch (kWh)</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Einspeisung (kWh)</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Netzbezug (kWh)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.slice(0, 10).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-sm text-gray-900">{row.jahr}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{monatsnamen[row.monat]}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {row.pv_erzeugung_kwh?.toFixed(1) || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {row.gesamtverbrauch_kwh?.toFixed(1) || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {row.einspeisung_kwh?.toFixed(1) || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right">
                      {row.netzbezug_kwh?.toFixed(1) || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 10 && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                ... und {previewData.length - 10} weitere Datensätze
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={confirmImport}
              disabled={isUploading || errors.length > 0}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors
                ${isUploading || errors.length > 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                }
              `}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Importiere...
                </>
              ) : (
                <>
                  <SimpleIcon type="check" className="w-5 h-5" />
                  Daten importieren
                </>
              )}
            </button>
            <button
              onClick={reset}
              disabled={isUploading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Erfolg */}
      {uploadComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <SimpleIcon type="check" className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-green-900 mb-2">
            Import erfolgreich!
          </h3>
          <p className="text-sm text-green-700 mb-4">
            Die Monatsdaten wurden erfolgreich importiert.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <SimpleIcon type="upload" className="w-4 h-4" />
            Weitere Daten hochladen
          </button>
        </div>
      )}
    </div>
  )
}
