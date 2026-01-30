// app/community/regional/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import Breadcrumb from '@/components/Breadcrumb'

interface RegionaleAnlage {
  anlage_id: string
  anlagenname: string
  leistung_kwp: number
  standort_ort?: string
  standort_plz?: string
  standort_latitude?: number
  standort_longitude?: number
  mitglied_display_name?: string
  hat_speicher: boolean
  hat_wallbox: boolean
}

interface RegionStats {
  plz_prefix: string
  anzahl: number
  gesamtleistung: number
}

export default function CommunityRegionalPage() {
  const [anlagen, setAnlagen] = useState<RegionaleAnlage[]>([])
  const [loading, setLoading] = useState(true)
  const [plzFilter, setPlzFilter] = useState('')
  const [regionStats, setRegionStats] = useState<RegionStats[]>([])

  useEffect(() => {
    loadAnlagen()
  }, [])

  async function loadAnlagen() {
    setLoading(true)
    try {
      const res = await fetch('/api/community/anlagen')
      const data = await res.json()
      if (data.success) {
        setAnlagen(data.data)
        berechneRegionStats(data.data)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  function berechneRegionStats(anlagenListe: RegionaleAnlage[]) {
    const statsMap = new Map<string, { anzahl: number; leistung: number }>()

    anlagenListe.forEach(anlage => {
      if (anlage.standort_plz) {
        // Erste 2 Ziffern der PLZ für regionale Gruppierung
        const prefix = anlage.standort_plz.substring(0, 2)
        const existing = statsMap.get(prefix) || { anzahl: 0, leistung: 0 }
        statsMap.set(prefix, {
          anzahl: existing.anzahl + 1,
          leistung: existing.leistung + (anlage.leistung_kwp || 0)
        })
      }
    })

    const stats: RegionStats[] = Array.from(statsMap.entries())
      .map(([prefix, data]) => ({
        plz_prefix: prefix,
        anzahl: data.anzahl,
        gesamtleistung: Math.round(data.leistung * 10) / 10
      }))
      .sort((a, b) => b.anzahl - a.anzahl)

    setRegionStats(stats)
  }

  // PLZ-Regionen in Deutschland
  const plzRegionen: Record<string, string> = {
    '01': 'Dresden, Ostsachsen',
    '02': 'Görlitz, Oberlausitz',
    '03': 'Cottbus, Spreewald',
    '04': 'Leipzig',
    '06': 'Halle (Saale)',
    '07': 'Gera, Ostthüringen',
    '08': 'Zwickau, Westsachsen',
    '09': 'Chemnitz',
    '10': 'Berlin-Mitte',
    '12': 'Berlin-Süd',
    '13': 'Berlin-Nord',
    '14': 'Berlin-West, Potsdam',
    '15': 'Frankfurt (Oder)',
    '16': 'Eberswalde, Uckermark',
    '17': 'Neubrandenburg',
    '18': 'Rostock',
    '19': 'Schwerin',
    '20': 'Hamburg-Mitte',
    '21': 'Hamburg-Harburg',
    '22': 'Hamburg-Nord',
    '23': 'Lübeck',
    '24': 'Kiel',
    '25': 'Husum, Nordfriesland',
    '26': 'Oldenburg, Ostfriesland',
    '27': 'Bremerhaven, Cuxhaven',
    '28': 'Bremen',
    '29': 'Celle, Lüneburger Heide',
    '30': 'Hannover',
    '31': 'Hildesheim',
    '32': 'Minden, Herford',
    '33': 'Bielefeld, Paderborn',
    '34': 'Kassel',
    '35': 'Gießen, Marburg',
    '36': 'Fulda, Bad Hersfeld',
    '37': 'Göttingen',
    '38': 'Braunschweig, Wolfsburg',
    '39': 'Magdeburg',
    '40': 'Düsseldorf',
    '41': 'Mönchengladbach',
    '42': 'Wuppertal, Solingen',
    '44': 'Dortmund',
    '45': 'Essen',
    '46': 'Oberhausen, Bottrop',
    '47': 'Duisburg',
    '48': 'Münster',
    '49': 'Osnabrück',
    '50': 'Köln',
    '51': 'Köln-Ost, Bergisch Gladbach',
    '52': 'Aachen',
    '53': 'Bonn',
    '54': 'Trier',
    '55': 'Mainz',
    '56': 'Koblenz',
    '57': 'Siegen',
    '58': 'Hagen',
    '59': 'Hamm, Unna',
    '60': 'Frankfurt am Main',
    '61': 'Bad Homburg, Friedberg',
    '63': 'Offenbach, Hanau',
    '64': 'Darmstadt',
    '65': 'Wiesbaden',
    '66': 'Saarbrücken',
    '67': 'Ludwigshafen, Kaiserslautern',
    '68': 'Mannheim',
    '69': 'Heidelberg',
    '70': 'Stuttgart',
    '71': 'Böblingen, Sindelfingen',
    '72': 'Tübingen, Reutlingen',
    '73': 'Esslingen, Göppingen',
    '74': 'Heilbronn',
    '75': 'Pforzheim',
    '76': 'Karlsruhe',
    '77': 'Offenburg',
    '78': 'Villingen-Schwenningen',
    '79': 'Freiburg im Breisgau',
    '80': 'München-Mitte',
    '81': 'München-Ost',
    '82': 'München-Süd',
    '83': 'Rosenheim',
    '84': 'Landshut',
    '85': 'Ingolstadt, Freising',
    '86': 'Augsburg',
    '87': 'Kempten, Kaufbeuren',
    '88': 'Ravensburg, Friedrichshafen',
    '89': 'Ulm',
    '90': 'Nürnberg',
    '91': 'Erlangen, Fürth',
    '92': 'Amberg, Weiden',
    '93': 'Regensburg',
    '94': 'Passau',
    '95': 'Bayreuth, Hof',
    '96': 'Bamberg, Coburg',
    '97': 'Würzburg',
    '98': 'Suhl, Meiningen',
    '99': 'Erfurt, Weimar'
  }

  const filteredAnlagen = plzFilter
    ? anlagen.filter(a => a.standort_plz?.startsWith(plzFilter))
    : anlagen

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Regionale Verteilung
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Entdecken Sie PV-Anlagen in Ihrer Region
          </p>
        </div>

        {/* Regionen-Übersicht */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Anlagen nach Region (PLZ-Bereich)
          </h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : regionStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Keine regionalen Daten verfügbar
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {regionStats.map((stat) => (
                <button
                  key={stat.plz_prefix}
                  onClick={() => setPlzFilter(plzFilter === stat.plz_prefix ? '' : stat.plz_prefix)}
                  className={`p-4 rounded-lg border-2 text-left transition ${
                    plzFilter === stat.plz_prefix
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.plz_prefix}xxx</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {stat.anzahl}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {plzRegionen[stat.plz_prefix] || 'Deutschland'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {stat.gesamtleistung} kWp gesamt
                  </div>
                </button>
              ))}
            </div>
          )}

          {plzFilter && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Filter aktiv: PLZ {plzFilter}xxx
              </span>
              <button
                onClick={() => setPlzFilter('')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Filter aufheben
              </button>
            </div>
          )}
        </div>

        {/* Gefilterte Anlagen */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {plzFilter
              ? `Anlagen in ${plzRegionen[plzFilter] || 'PLZ ' + plzFilter + 'xxx'} (${filteredAnlagen.length})`
              : `Alle Anlagen (${filteredAnlagen.length})`
            }
          </h2>

          {filteredAnlagen.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <SimpleIcon type="map" className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>Keine Anlagen in dieser Region gefunden</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnlagen.map((anlage) => (
                <Link
                  key={anlage.anlage_id}
                  href={`/community/${anlage.anlage_id}`}
                  className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                        <SimpleIcon type="sun" className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{anlage.anlagenname}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {anlage.standort_plz} {anlage.standort_ort || ''}
                          {anlage.mitglied_display_name && ` • ${anlage.mitglied_display_name}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-gray-100">{anlage.leistung_kwp} kWp</div>
                      <div className="flex gap-1 mt-1">
                        {anlage.hat_speicher && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            Speicher
                          </span>
                        )}
                        {anlage.hat_wallbox && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                            E-Auto
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Link zurück */}
        <div className="mt-6">
          <Link
            href="/community"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
          >
            <SimpleIcon type="arrow-left" className="w-4 h-4" />
            Zurück zur Community-Übersicht
          </Link>
        </div>
      </div>
    </div>
  )
}
