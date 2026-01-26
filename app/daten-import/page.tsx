// app/daten-import/page.tsx
// Seite für Monatsdaten-Import

import { getCurrentUser, getUserAnlagen } from '@/lib/auth'
import MonatsdatenUploadWrapper from '@/components/MonatsdatenUploadWrapper'
import SimpleIcon from '@/components/SimpleIcon'
import { createClient } from '@/lib/supabase-server'

export default async function DatenImportPage() {
  // User authentifizieren
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Daten importieren</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <SimpleIcon type="alert" className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 mb-2">Nicht angemeldet</h3>
              <p className="text-sm text-red-700">
                Du musst angemeldet sein, um Daten zu importieren.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Anlagen des Users laden
  const anlagen = await getUserAnlagen(user.id)

  if (!anlagen || anlagen.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Daten importieren</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <SimpleIcon type="alert" className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900 mb-2">Keine Anlage vorhanden</h3>
              <p className="text-sm text-yellow-700 mb-3">
                Du musst zuerst eine PV-Anlage anlegen, bevor du Monatsdaten importieren kannst.
              </p>
              <a
                href="/anlage-verwalten"
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                <SimpleIcon type="sun" className="w-4 h-4" />
                Anlage anlegen
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Supabase Client für Server-seitige Queries
  const supabase = await createClient()

  // Monatsdaten für alle Anlagen zählen
  const monatsdatenCounts = await Promise.all(
    anlagen.map(async (anlage) => {
      const { count } = await supabase
        .from('monatsdaten')
        .select('*', { count: 'exact', head: true })
        .eq('anlage_id', anlage.id)

      return { anlageId: anlage.id, count: count || 0 }
    })
  )

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <SimpleIcon type="upload" className="w-8 h-8 text-blue-600" />
          Monatsdaten importieren
        </h1>
        <p className="text-gray-600">
          Lade deine Monatsdaten aus einer CSV- oder Excel-Datei hoch
        </p>
      </div>

      {/* Anlagen-Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <SimpleIcon type="sun" className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 mb-2">
              {anlagen.length === 1
                ? 'Deine Anlage'
                : `Deine ${anlagen.length} Anlagen`}
            </p>
            <p className="text-xs text-blue-700">
              Wähle unten eine Anlage aus, für die du Daten importieren möchtest.
            </p>
          </div>
        </div>
      </div>

      {/* Anleitung */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
          <SimpleIcon type="bulb" className="w-5 h-5 text-yellow-600" />
          So funktioniert's
        </h2>
        <ol className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
            <span>
              <strong>Personalisierte CSV-Vorlage herunterladen</strong> (enthält nur relevante Felder für deine Anlage)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
            <span>
              <strong>Datei hochladen</strong> (Drag & Drop oder Klick)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
            <span>
              <strong>Vorschau prüfen</strong> und Daten validieren lassen
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
            <span>
              <strong>Import bestätigen</strong> - fertig!
            </span>
          </li>
        </ol>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            <strong>Hinweis:</strong> Duplikate (gleiche Jahr/Monat-Kombination) werden automatisch erkannt und übersprungen.
          </p>
        </div>
      </div>

      {/* Upload-Komponente mit Anlagen-Auswahl */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <MonatsdatenUploadWrapper
          anlagen={anlagen}
          monatsdatenCounts={monatsdatenCounts}
        />
      </div>

      {/* Weitere Infos */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h3 className="font-medium text-gray-900 mb-2">Unterstützte Datenfelder</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p className="font-medium text-gray-700 mb-1">Pflichtfelder:</p>
            <ul className="space-y-0.5 text-xs">
              <li>• Jahr (z.B. 2024)</li>
              <li>• Monat (1-12)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-1">Optional:</p>
            <ul className="space-y-0.5 text-xs">
              <li>• PV-Erzeugung, Verbrauch, Einspeisung</li>
              <li>• Batterie-Lade-/Entladung</li>
              <li>• Kosten, Erlöse, Tarife</li>
              <li>• Betriebsausgaben, Notizen</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-300">
          <p className="font-medium text-gray-700 mb-1 flex items-center gap-1">
            <SimpleIcon type="bulb" className="w-4 h-4 text-blue-600" />
            Automatische Berechnungen
          </p>
          <ul className="space-y-0.5 text-xs">
            <li>• <strong>Netzbezug Kosten</strong> = Netzbezug (kWh) × Netzbezugspreis + Grundpreis</li>
            <li>• <strong>Einspeisung Ertrag</strong> = Einspeisung (kWh) × Einspeisevergütung</li>
            <li className="text-gray-500 italic mt-1">→ Werden nur berechnet, wenn nicht manuell angegeben</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
