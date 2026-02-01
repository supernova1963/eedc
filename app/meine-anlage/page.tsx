// app/meine-anlage/page.tsx
// Persönliches Dashboard - Meine Anlage (Multi-Anlage Support)

import { createClient } from '@/lib/supabase-server'
import { getCurrentMitglied, getUserAnlagen, resolveAnlageId } from '@/lib/anlagen-helpers'
import Link from 'next/link'
import DashboardChart from '@/components/DashboardChart'
import SimpleIcon from '@/components/SimpleIcon'
import { AnlagenSelector } from '@/components/AnlagenSelector'
import DashboardKPIs from '@/components/DashboardKPIs'

async function getDashboardData(anlageId: string) {
  const supabase = await createClient()

  // Monatsdaten für diese Anlage holen
  const { data: monatsdaten } = await supabase
    .from('monatsdaten')
    .select('*')
    .eq('anlage_id', anlageId)
    .order('jahr', { ascending: true })
    .order('monat', { ascending: true })

  return { monatsdaten: monatsdaten || [] }
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ anlageId?: string }>
}) {
  const mitglied = await getCurrentMitglied()

  if (!mitglied.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Nicht authentifiziert</p>
        </div>
      </div>
    )
  }

  // Alle Anlagen des Users holen
  const { data: alleAnlagen } = await getUserAnlagen()

  // Bestimme welche Anlage angezeigt werden soll
  const params = await searchParams
  const { anlageId, anlage } = await resolveAnlageId(params.anlageId)

  if (!anlage) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <SimpleIcon type="sun" className="w-8 h-8 text-yellow-500" /> Dashboard
          </h1>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">Keine Anlage gefunden</p>
          <Link
            href="/anlage"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Jetzt Anlage anlegen
          </Link>
        </div>
      </div>
    )
  }

  const { monatsdaten } = await getDashboardData(anlage.id)

  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  const gesamtErzeugung = monatsdaten.reduce((sum, m) =>
    sum + toNum(m.pv_erzeugung_kwh), 0
  )

  const gesamtEigenverbrauch = monatsdaten.reduce((sum, m) =>
    sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0
  )

  const gesamtVerbrauch = monatsdaten.reduce((sum, m) =>
    sum + toNum(m.gesamtverbrauch_kwh), 0
  )

  const gesamtEinspeisung = monatsdaten.reduce((sum, m) =>
    sum + toNum(m.einspeisung_kwh), 0
  )

  const gesamtEinspeiseErloese = monatsdaten.reduce((sum, m) =>
    sum + toNum(m.einspeisung_ertrag_euro), 0
  )

  const gesamtNetzbezugKosten = monatsdaten.reduce((sum, m) =>
    sum + toNum(m.netzbezug_kosten_euro), 0
  )

  const gesamtBetriebsausgaben = monatsdaten.reduce((sum, m) =>
    sum + toNum(m.betriebsausgaben_monat_euro), 0
  )

  // Eigenverbrauch-Einsparung = Was durch Eigenverbrauch an Netzbezug gespart wurde
  // Vereinfachte Berechnung: Eigenverbrauch * durchschnittlicher Netzbezugspreis
  const durchschnittNetzbezugPreis = monatsdaten.length > 0
    ? monatsdaten.reduce((sum, m) => sum + toNum(m.netzbezug_preis_cent_kwh), 0) / monatsdaten.length
    : 0
  const eigenverbrauchEinsparung = gesamtEigenverbrauch * durchschnittNetzbezugPreis / 100

  // Gesamtersparnis durch PV = Eigenverbrauch-Einsparung + Einspeise-Erlöse
  // OHNE Netzbezugskosten - diese sind allgemeiner Haushaltsverbrauch!
  const gesamtErsparnisPV = eigenverbrauchEinsparung + gesamtEinspeiseErloese - gesamtBetriebsausgaben

  const eigenverbrauchsquote = gesamtErzeugung > 0
    ? (gesamtEigenverbrauch / gesamtErzeugung) * 100
    : 0

  const autarkiegrad = gesamtVerbrauch > 0
    ? (gesamtEigenverbrauch / gesamtVerbrauch) * 100
    : 0

  // Durchschnittlicher Einspeisepreis berechnen
  const durchschnittEinspeisePreis = monatsdaten.length > 0
    ? monatsdaten.reduce((sum, m) => sum + toNum(m.einspeise_verguetung_cent_kwh), 0) / monatsdaten.length
    : 0

  const monatsnamen = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const chartData = monatsdaten.map(m => ({
    monat: `${monatsnamen[m.monat]} ${m.jahr}`,
    eigenverbrauch: toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh),
    erzeugung: toNum(m.pv_erzeugung_kwh),
    verbrauch: toNum(m.gesamtverbrauch_kwh),
    einspeisung: toNum(m.einspeisung_kwh)
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <SimpleIcon type="sun" className="w-8 h-8 text-yellow-500" /> Dashboard
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {anlage.anlagenname} - {anlage.leistung_kwp} kWp
            </p>
          </div>
          {alleAnlagen && alleAnlagen.length > 0 && (
            <AnlagenSelector
              anlagen={alleAnlagen}
              currentAnlageId={anlageId}
            />
          )}
        </div>
      </div>

      <div className="space-y-6">
        <DashboardKPIs
          gesamtVerbrauch={gesamtVerbrauch}
          gesamtErzeugung={gesamtErzeugung}
          gesamtEigenverbrauch={gesamtEigenverbrauch}
          gesamtEinspeisung={gesamtEinspeisung}
          autarkiegrad={autarkiegrad}
          eigenverbrauchsquote={eigenverbrauchsquote}
          gesamtEinspeiseErloese={gesamtEinspeiseErloese}
          eigenverbrauchEinsparung={eigenverbrauchEinsparung}
          gesamtErsparnisPV={gesamtErsparnisPV}
          gesamtBetriebsausgaben={gesamtBetriebsausgaben}
          durchschnittNetzbezugPreis={durchschnittNetzbezugPreis}
          durchschnittEinspeisePreis={durchschnittEinspeisePreis}
        />

        {chartData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <SimpleIcon type="trend" className="w-6 h-6 text-blue-600" />
              Monatlicher Verlauf
            </h2>
            <DashboardChart data={chartData} />
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SimpleIcon type="rocket" className="w-6 h-6 text-blue-600" />
            Schnellzugriff
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/eingabe"
              className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <SimpleIcon type="plus" className="w-8 h-8 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Daten erfassen</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Monatsdaten</div>
              </div>
            </Link>

            <Link
              href="/investitionen"
              className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <SimpleIcon type="briefcase" className="w-8 h-8 text-purple-600" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Investitionen</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Verwalten</div>
              </div>
            </Link>

            <Link
              href="/stammdaten"
              className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow border-2 border-green-500"
            >
              <SimpleIcon type="clipboard" className="w-8 h-8 text-green-600" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Stammdaten</div>
                <div className="text-sm text-green-600 font-semibold">NEU</div>
              </div>
            </Link>

            <Link
              href="/auswertung"
              className="flex items-center gap-3 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <SimpleIcon type="chart" className="w-8 h-8 text-orange-600" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Auswertungen</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">ROI & Charts</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
