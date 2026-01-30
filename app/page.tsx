// app/page.tsx
// Community Dashboard - Öffentliche Startseite

import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'

async function getCommunityStats() {
  const supabase = await createClient()

  // Nutze die FRESH-START RPC-Funktionen
  const { data: publicAnlagen, error: anlagenError } = await supabase.rpc('get_public_anlagen')
  const { data: stats, error: statsError } = await supabase.rpc('get_community_stats')

  if (anlagenError) {
    console.error('Fehler beim Laden der Anlagen:', anlagenError)
  }
  if (statsError) {
    console.error('Fehler beim Laden der Stats:', statsError)
  }

  // Stats aus der RPC-Funktion verwenden
  const communityStats = stats?.[0] || {}
  const anlagenCount = communityStats.anzahl_anlagen || publicAnlagen?.length || 0
  const gesamtLeistung = communityStats.gesamtleistung_kwp || 0

  // Top 5 Anlagen nach Leistung sortieren
  const topAnlagen = publicAnlagen
    ?.sort((a: any, b: any) => (b.leistung_kwp || 0) - (a.leistung_kwp || 0))
    .slice(0, 5)
    .map((a: any) => ({
      id: a.anlage_id,
      anlagenname: a.anlagenname,
      leistung_kwp: a.leistung_kwp,
      standort_plz: a.standort_plz,
      standort_ort: a.standort_ort,
      inbetriebnahme: a.installationsdatum,
      mitglied_display_name: a.mitglied_display_name
    })) || []

  return {
    anlagenCount,
    gesamtLeistung,
    topAnlagen
  }
}

export const dynamic = 'force-dynamic'

export default async function CommunityDashboardPage() {
  const { anlagenCount, gesamtLeistung, topAnlagen } = await getCommunityStats()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Public Header */}
      <PublicHeader />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4">
              🌍 PV-Anlagen Community
            </h1>
            <p className="text-xl mb-8 text-blue-100">
              Gemeinsam für mehr Transparenz und bessere Energiewende
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/login"
                className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                Anmelden
              </Link>
              <Link
                href="/register"
                className="px-8 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors border-2 border-white"
              >
                Jetzt mitmachen
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <SimpleIcon type="solar" className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-4xl font-bold text-gray-900">{anlagenCount}</p>
            <p className="text-gray-600 mt-2">Öffentliche Anlagen</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <SimpleIcon type="lightning" className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <p className="text-4xl font-bold text-gray-900">{gesamtLeistung.toFixed(1)} kWp</p>
            <p className="text-gray-600 mt-2">Gesamtleistung</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <SimpleIcon type="leaf" className="w-12 h-12 text-green-500 mx-auto mb-4" />
            {(() => {
              // ca. 1000 kWh/kWp Ertrag * 0.4 kg CO2/kWh (deutscher Strommix)
              const co2Kg = gesamtLeistung * 1000 * 0.4
              if (co2Kg >= 1000) {
                return <p className="text-4xl font-bold text-gray-900">{(co2Kg / 1000).toFixed(1)} t</p>
              }
              return <p className="text-4xl font-bold text-gray-900">{co2Kg.toFixed(0)} kg</p>
            })()}
            <p className="text-gray-600 mt-2">CO₂ Einsparung/Jahr (geschätzt)</p>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link
            href="/community"
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
              <SimpleIcon type="globe" className="w-6 h-6 text-blue-600" />
            </div>
            <span className="font-medium text-gray-900">Alle Anlagen</span>
            <span className="text-sm text-gray-500">{anlagenCount} Anlagen</span>
          </Link>

          <Link
            href="/community/vergleich"
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-200 transition-colors">
              <SimpleIcon type="chart" className="w-6 h-6 text-purple-600" />
            </div>
            <span className="font-medium text-gray-900">Vergleich</span>
            <span className="text-sm text-gray-500">Anlagen vergleichen</span>
          </Link>

          <Link
            href="/community/regional"
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
              <SimpleIcon type="map" className="w-6 h-6 text-green-600" />
            </div>
            <span className="font-medium text-gray-900">Regional</span>
            <span className="text-sm text-gray-500">Nach PLZ filtern</span>
          </Link>

          <Link
            href="/community/bestenliste"
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-yellow-200 transition-colors">
              <SimpleIcon type="trophy" className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="font-medium text-gray-900">Bestenliste</span>
            <span className="text-sm text-gray-500">Top Anlagen</span>
          </Link>
        </div>

        {/* Top Anlagen */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <SimpleIcon type="trophy" className="w-6 h-6 text-yellow-500" />
            Top 5 Anlagen nach Leistung
          </h2>
          {topAnlagen.length > 0 ? (
            <div className="space-y-4">
              {topAnlagen.map((anlage: any, idx: number) => (
                <Link
                  key={anlage.id}
                  href={`/community/${anlage.id}`}
                  className="block p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{anlage.anlagenname || 'Anlage'}</p>
                        <p className="text-sm text-gray-600">
                          {anlage.standort_plz} {anlage.standort_ort}
                          {anlage.mitglied_display_name && ` • ${anlage.mitglied_display_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">{anlage.leistung_kwp} kWp</p>
                      <p className="text-xs text-gray-500">
                        seit {new Date(anlage.inbetriebnahme).getFullYear()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Noch keine öffentlichen Anlagen verfügbar
            </p>
          )}
        </div>

        {/* Features Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <SimpleIcon type="chart" className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Transparente Daten</h3>
            <p className="text-gray-600">
              Vergleiche deine Anlage mit anderen und lerne von den Besten
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <SimpleIcon type="users" className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Starke Community</h3>
            <p className="text-gray-600">
              Tausche dich aus und profitiere vom Wissen der Community
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <SimpleIcon type="target" className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Optimierung</h3>
            <p className="text-gray-600">
              Erkenne Potenziale und optimiere deine Anlage kontinuierlich
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Werde Teil der Community!</h2>
          <p className="text-lg mb-6 text-blue-100">
            Teile deine PV-Daten und hilf anderen bei der Energiewende
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            Kostenlos registrieren
          </Link>
        </div>
      </div>

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}
