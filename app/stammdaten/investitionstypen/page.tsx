// app/stammdaten/investitionstypen/page.tsx
// Verwaltung von Investitionstyp-Konfigurationen

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied } from '@/lib/anlagen-helpers'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import Breadcrumb from '@/components/Breadcrumb'

interface InvestitionsTypConfig {
  typ: string
  anlagen_zuordnung_empfohlen: boolean
  standardparameter?: Record<string, any>
}

// Konfiguration für jeden Investitionstyp
const TYP_CONFIGS: Record<string, InvestitionsTypConfig> = {
  'e-auto': {
    typ: 'E-Auto',
    anlagen_zuordnung_empfohlen: false, // E-Autos gehören zum Haushalt, nicht zur Anlage
    standardparameter: {
      nutzungsart: 'privat',
      jahresfahrleistung_km: 15000,
    }
  },
  'waermepumpe': {
    typ: 'Wärmepumpe',
    anlagen_zuordnung_empfohlen: false, // Wärmepumpen gehören zum Haushalt
    standardparameter: {
      heizleistung_kw: 8,
      cop: 3.5,
    }
  },
  'speicher': {
    typ: 'Batteriespeicher',
    anlagen_zuordnung_empfohlen: true, // Speicher gehören zur PV-Anlage
    standardparameter: {
      kapazitaet_kwh: 10,
      entladetiefe: 0.9,
    }
  },
  'pv-module': {
    typ: 'PV-Module',
    anlagen_zuordnung_empfohlen: true, // Module sind Teil der Anlage
    standardparameter: {
      modulleistung_wp: 400,
      wirkungsgrad: 0.2,
    }
  },
  'wechselrichter': {
    typ: 'Wechselrichter',
    anlagen_zuordnung_empfohlen: true, // Wechselrichter gehören zur Anlage
    standardparameter: {
      nennleistung_kw: 5,
      wirkungsgrad: 0.97,
    }
  },
  'wallbox': {
    typ: 'Wallbox',
    anlagen_zuordnung_empfohlen: false, // Wallbox kann mit/ohne PV betrieben werden
    standardparameter: {
      ladeleistung_kw: 11,
      phasen: 3,
    }
  },
  'optimierer': {
    typ: 'Optimierer',
    anlagen_zuordnung_empfohlen: true, // Optimierer gehören zur Anlage
    standardparameter: {}
  },
  'sonstiges': {
    typ: 'Sonstiges',
    anlagen_zuordnung_empfohlen: false,
    standardparameter: {}
  },
}

export default async function InvestitionstypenPage() {
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

  // mitglied.data enthält bereits die Mitgliedsdaten
  const mitgliedData = mitglied.data

  // Statistik: Anzahl Investitionen pro Typ
  const { data: investitionen } = await supabase
    .from('alternative_investitionen')
    .select('typ')
    .eq('mitglied_id', mitgliedData.id)
    .eq('aktiv', true)

  const typCounts = investitionen?.reduce((acc, inv) => {
    acc[inv.typ] = (acc[inv.typ] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Investitionstypen-Konfiguration
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Übersicht der verfügbaren Investitionstypen und deren Zuordnungsempfehlungen
        </p>
      </div>

      {/* Info-Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <SimpleIcon type="info" className="w-6 h-6 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">
              Anlagen-Zuordnung vs. Haushalt-Zuordnung
            </h3>
            <p className="text-sm text-blue-800 mb-2">
              <strong>Zur Anlage zuordnen:</strong> PV-Module, Wechselrichter, Batteriespeicher, Optimierer
              <br />
              Diese Komponenten sind direkt Teil der PV-Anlage.
            </p>
            <p className="text-sm text-blue-800">
              <strong>Zum Haushalt zuordnen:</strong> E-Auto, Wärmepumpe, Wallbox
              <br />
              Diese Investitionen werden vom Haushalt genutzt und können mit/ohne PV betrieben werden.
            </p>
          </div>
        </div>
      </div>

      {/* Typ-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(TYP_CONFIGS).map(([key, config]) => {
          const count = typCounts[key] || 0
          const isAnlagenTyp = config.anlagen_zuordnung_empfohlen

          return (
            <div
              key={key}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 p-6 ${
                isAnlagenTyp ? 'border-green-500' : 'border-purple-500'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {config.typ}
                  </h3>
                  <span
                    className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                      isAnlagenTyp
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {isAnlagenTyp ? 'Anlagen-Komponente' : 'Haushalt-Komponente'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{count}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">erfasst</div>
                </div>
              </div>

              {/* Empfehlung */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-2">
                  <SimpleIcon
                    type={isAnlagenTyp ? 'solar' : 'home'}
                    className="w-4 h-4 text-gray-500 mt-0.5"
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isAnlagenTyp
                      ? 'Sollte einer PV-Anlage zugeordnet werden'
                      : 'Wird dem Haushalt zugeordnet (keine Anlagen-Zuordnung nötig)'}
                  </p>
                </div>
              </div>

              {/* Standardparameter (falls vorhanden) */}
              {Object.keys(config.standardparameter || {}).length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Standardparameter:</p>
                  <div className="space-y-1">
                    {Object.entries(config.standardparameter || {}).map(([param, value]) => (
                      <div key={param} className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span className="capitalize">{param.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Hinweise */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
            <SimpleIcon type="solar" className="w-5 h-5" />
            Anlagen-Komponenten
          </h3>
          <p className="text-sm text-green-800">
            Diese Investitionen sind direkt Teil einer PV-Anlage und sollten zugeordnet werden.
            Dies ermöglicht anlagenbezogene ROI-Berechnungen und Gesamtbilanzen.
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
            <SimpleIcon type="home" className="w-5 h-5" />
            Haushalt-Komponenten
          </h3>
          <p className="text-sm text-purple-800">
            Diese Investitionen werden vom Haushalt genutzt und können unabhängig von
            einzelnen PV-Anlagen betrieben werden. Sie werden separat ausgewertet.
          </p>
        </div>
      </div>

      {/* Aktionen */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/stammdaten"
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
        >
          ← Zurück zu Stammdaten
        </Link>
        <Link
          href="/investitionen"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Investitionen verwalten
        </Link>
        <Link
          href="/stammdaten/zuordnung"
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
        >
          Zuordnungen bearbeiten
        </Link>
      </div>
    </div>
  )
}
