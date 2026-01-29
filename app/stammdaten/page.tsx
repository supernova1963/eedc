// app/stammdaten/page.tsx
// Übersichtsseite für alle Stammdaten

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied } from '@/lib/anlagen-helpers'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'

export default async function StammdatenPage() {
  const mitglied = await getCurrentMitglied()

  if (!mitglied.data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Nicht authentifiziert
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  // Statistiken laden
  const { data: strompreise } = await supabase
    .from('strompreise')
    .select('id')
    .eq('mitglied_id', mitglied.data.id)

  const { data: anlagen } = await supabase
    .from('anlagen')
    .select('id')
    .eq('mitglied_id', mitglied.data.id)
    .eq('aktiv', true)

  // Anlagen-Komponenten (Speicher, Wechselrichter, Wallbox) zählen
  const { data: anlagenKomponenten } = await supabase
    .from('anlagen_komponenten')
    .select('id, anlage_id')
    .in('anlage_id', anlagen?.map(a => a.id) || [])
    .eq('aktiv', true)

  // Haushalts-Komponenten (E-Auto, Wärmepumpe) zählen
  const { data: haushaltKomponenten } = await supabase
    .from('haushalt_komponenten')
    .select('id')
    .eq('mitglied_id', mitglied.data.id)
    .eq('aktiv', true)

  const gesamtKomponenten = (anlagenKomponenten?.length || 0) + (haushaltKomponenten?.length || 0)
  const zugeordneteKomponenten = anlagenKomponenten?.length || 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Stammdaten</h1>
        <p className="text-gray-600">
          Verwalte deine Stammdaten für aussagekräftige Auswertungen
        </p>
      </div>

      {/* Übersicht-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Strompreise */}
        <Link href="/stammdaten/strompreise" className="block">
          <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <SimpleIcon type="lightning" className="w-12 h-12 text-blue-500" />
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  {strompreise?.length || 0}
                </div>
                <div className="text-sm text-gray-500">erfasst</div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Strompreise
            </h3>
            <p className="text-sm text-gray-600">
              Netzbezug- und Einspeisepreise mit Gültigkeitszeiträumen
            </p>
            <div className="mt-4 text-blue-600 font-medium text-sm">
              Verwalten →
            </div>
          </div>
        </Link>

        {/* Anlage-Investition-Zuordnung */}
        <Link href="/stammdaten/zuordnung" className="block">
          <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <SimpleIcon type="link" className="w-12 h-12 text-green-500" />
              <div className="text-right">
                <div className="text-3xl font-bold text-green-600">
                  {zugeordneteKomponenten}/{gesamtKomponenten}
                </div>
                <div className="text-sm text-gray-500">Komponenten</div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Anlagen-Zuordnung
            </h3>
            <p className="text-sm text-gray-600">
              Ordne Investitionen ihren Anlagen zu
            </p>
            <div className="mt-4 text-green-600 font-medium text-sm">
              Zuordnen →
            </div>
          </div>
        </Link>

        {/* Investitionstyp-Konfiguration */}
        <Link href="/stammdaten/investitionstypen" className="block">
          <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <SimpleIcon type="settings" className="w-12 h-12 text-purple-500" />
              <div className="text-right">
                <div className="text-3xl font-bold text-purple-600">8</div>
                <div className="text-sm text-gray-500">Typen</div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Investitionstypen
            </h3>
            <p className="text-sm text-gray-600">
              Berechnungsparameter pro Investitionstyp
            </p>
            <div className="mt-4 text-purple-600 font-medium text-sm">
              Konfigurieren →
            </div>
          </div>
        </Link>
      </div>

      {/* Hinweise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Warum sind Strompreise wichtig?
          </h3>
          <p className="text-sm text-blue-800">
            Strompreise mit Gültigkeitszeiträumen ermöglichen historische Auswertungen
            und korrekte Einsparungsberechnungen. Bei Preisänderungen einfach einen neuen
            Eintrag mit neuem Gültigkeitsdatum anlegen.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-2">
            Warum Investitionen zuordnen?
          </h3>
          <p className="text-sm text-green-800">
            Die Zuordnung von Investitionen zu Anlagen ermöglicht anlagenbezogene
            Auswertungen und eine Gesamtbilanz pro Anlage. PV-Module, Wechselrichter
            und Speicher sollten der jeweiligen Anlage zugeordnet werden.
          </p>
        </div>
      </div>

      {/* Schnellzugriff */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Schnellzugriff</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/stammdaten/strompreise/neu"
            className="px-4 py-3 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-center text-sm font-medium text-gray-700"
          >
            + Strompreis erfassen
          </Link>
          <Link
            href="/anlage"
            className="px-4 py-3 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-center text-sm font-medium text-gray-700"
          >
            Anlagen verwalten
          </Link>
          <Link
            href="/investitionen"
            className="px-4 py-3 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-center text-sm font-medium text-gray-700"
          >
            Investitionen verwalten
          </Link>
          <Link
            href="/auswertung"
            className="px-4 py-3 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-center text-sm font-medium text-gray-700"
          >
            Zu Auswertungen
          </Link>
        </div>
      </div>
    </div>
  )
}
