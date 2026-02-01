// components/KIInsightsDashboard.tsx
// KI-gestützte Analyse mit Verbesserungs- und Erweiterungsvorschlägen

'use client'

import { useMemo } from 'react'
import SimpleIcon from './SimpleIcon'
import { text, card, border, gradient, colors, badge } from '@/lib/styles'

interface KIInsightsDashboardProps {
  monatsdaten: any[]
  anlage: any
  investitionen: any[]
  communityStats?: {
    avgEigenverbrauchsquote: number
    avgAutarkie: number
    avgErtragProKwp: number
    avgAmortisationszeit: number
  }
}

interface Insight {
  id: string
  kategorie: 'optimierung' | 'warnung' | 'erfolg' | 'erweiterung' | 'info'
  titel: string
  beschreibung: string
  details?: string
  handlungsempfehlung?: string
  prioritaet: 1 | 2 | 3 // 1 = hoch, 3 = niedrig
  potenzial?: string // z.B. "+50€/Jahr"
}

export default function KIInsightsDashboard({
  monatsdaten,
  anlage,
  investitionen,
  communityStats
}: KIInsightsDashboardProps) {

  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  const fmt = (num: number): string => {
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num: number): string => {
    return num.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }

  // Berechne Kennzahlen für Analyse
  const analyseDaten = useMemo(() => {
    if (!monatsdaten || monatsdaten.length === 0) return null

    const gesamtErzeugung = monatsdaten.reduce((sum, m) => sum + toNum(m.pv_erzeugung_kwh), 0)
    const gesamtEigenverbrauch = monatsdaten.reduce((sum, m) =>
      sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0)
    const gesamtEinspeisung = monatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_kwh), 0)
    const gesamtNetzbezug = monatsdaten.reduce((sum, m) => sum + toNum(m.netzbezug_kwh), 0)
    const gesamtVerbrauch = monatsdaten.reduce((sum, m) => sum + toNum(m.gesamtverbrauch_kwh), 0)
    const gesamtBatterieladung = monatsdaten.reduce((sum, m) => sum + toNum(m.batterieladung_kwh), 0)
    const gesamtBatterieentladung = monatsdaten.reduce((sum, m) => sum + toNum(m.batterieentladung_kwh), 0)

    const eigenverbrauchsquote = gesamtErzeugung > 0 ? (gesamtEigenverbrauch / gesamtErzeugung) * 100 : 0
    const autarkiegrad = gesamtVerbrauch > 0 ? (gesamtEigenverbrauch / gesamtVerbrauch) * 100 : 0

    const anzahlMonate = monatsdaten.length
    const durchschnittNetzbezugPreis = monatsdaten.reduce((sum, m) => sum + toNum(m.netzbezug_preis_cent_kwh), 0) / anzahlMonate
    const durchschnittEinspeisePreis = monatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_preis_cent_kwh), 0) / anzahlMonate

    // Jahres-Hochrechnung
    const ertragProMonat = gesamtErzeugung / anzahlMonate
    const jahresErzeugung = ertragProMonat * 12
    const ertragProKwp = anlage?.leistung_kwp > 0 ? jahresErzeugung / toNum(anlage.leistung_kwp) : 0

    // Saisonale Analyse - Sommer vs Winter
    const sommerMonate = monatsdaten.filter(m => [4, 5, 6, 7, 8, 9].includes(m.monat))
    const winterMonate = monatsdaten.filter(m => [1, 2, 3, 10, 11, 12].includes(m.monat))

    const sommerEVQuote = sommerMonate.length > 0
      ? sommerMonate.reduce((sum, m) => {
          const ev = toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh)
          const erz = toNum(m.pv_erzeugung_kwh)
          return sum + (erz > 0 ? ev / erz : 0)
        }, 0) / sommerMonate.length * 100
      : 0

    const winterEVQuote = winterMonate.length > 0
      ? winterMonate.reduce((sum, m) => {
          const ev = toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh)
          const erz = toNum(m.pv_erzeugung_kwh)
          return sum + (erz > 0 ? ev / erz : 0)
        }, 0) / winterMonate.length * 100
      : 0

    // Hat Batterie?
    const hatBatterie = gesamtBatterieladung > 0 || gesamtBatterieentladung > 0

    // Batterie-Effizienz
    const batterieEffizienz = gesamtBatterieladung > 0
      ? (gesamtBatterieentladung / gesamtBatterieladung) * 100
      : 0

    // Preis-Spread (Differenz Bezugspreis - Einspeisepreis)
    const preisSpread = durchschnittNetzbezugPreis - durchschnittEinspeisePreis

    // Verlorenes Potenzial durch Einspeisung statt Eigenverbrauch
    const verlorenesPotenzial = gesamtEinspeisung * (preisSpread / 100) // in Euro

    // Investitionen analysieren
    const hatWallbox = investitionen.some(i =>
      i.typ?.toLowerCase().includes('wallbox') || i.typ?.toLowerCase().includes('e-auto'))
    const hatWaermepumpe = investitionen.some(i =>
      i.typ?.toLowerCase().includes('wärmepumpe') || i.typ?.toLowerCase().includes('waermepumpe'))

    return {
      gesamtErzeugung,
      gesamtEigenverbrauch,
      gesamtEinspeisung,
      gesamtNetzbezug,
      gesamtVerbrauch,
      eigenverbrauchsquote,
      autarkiegrad,
      ertragProKwp,
      durchschnittNetzbezugPreis,
      durchschnittEinspeisePreis,
      preisSpread,
      verlorenesPotenzial,
      sommerEVQuote,
      winterEVQuote,
      hatBatterie,
      batterieEffizienz,
      hatWallbox,
      hatWaermepumpe,
      anzahlMonate,
      leistungKwp: toNum(anlage?.leistung_kwp),
      batterieKwh: toNum(anlage?.batterie_kwh)
    }
  }, [monatsdaten, anlage, investitionen])

  // Generiere Insights basierend auf Analyse
  const insights = useMemo((): Insight[] => {
    if (!analyseDaten) return []

    const result: Insight[] = []
    const {
      eigenverbrauchsquote,
      autarkiegrad,
      ertragProKwp,
      preisSpread,
      verlorenesPotenzial,
      gesamtEinspeisung,
      gesamtNetzbezug,
      sommerEVQuote,
      winterEVQuote,
      hatBatterie,
      batterieEffizienz,
      hatWallbox,
      hatWaermepumpe,
      leistungKwp,
      batterieKwh,
      durchschnittNetzbezugPreis
    } = analyseDaten

    // Community-Vergleich (Fallback-Werte wenn keine Community-Stats)
    const communityEVQuote = communityStats?.avgEigenverbrauchsquote || 45
    const communityAutarkie = communityStats?.avgAutarkie || 40
    const communityErtragProKwp = communityStats?.avgErtragProKwp || 950

    // === ERFOLGE ===
    if (eigenverbrauchsquote >= 50) {
      result.push({
        id: 'erfolg-ev-hoch',
        kategorie: 'erfolg',
        titel: 'Hohe Eigenverbrauchsquote',
        beschreibung: `Mit ${fmtDec(eigenverbrauchsquote)}% Eigenverbrauch nutzt du deinen Solarstrom sehr effizient.`,
        details: `Der Durchschnitt liegt bei ca. ${communityEVQuote}%. Du liegst ${fmtDec(eigenverbrauchsquote - communityEVQuote)} Prozentpunkte darüber.`,
        prioritaet: 3
      })
    }

    if (autarkiegrad >= 50) {
      result.push({
        id: 'erfolg-autarkie',
        kategorie: 'erfolg',
        titel: 'Gute Autarkie erreicht',
        beschreibung: `${fmtDec(autarkiegrad)}% deines Strombedarfs deckst du selbst.`,
        details: 'Das bedeutet weniger Abhängigkeit vom Strompreis und mehr Unabhängigkeit.',
        prioritaet: 3
      })
    }

    if (ertragProKwp >= 1000) {
      result.push({
        id: 'erfolg-ertrag',
        kategorie: 'erfolg',
        titel: 'Überdurchschnittlicher Ertrag',
        beschreibung: `Mit ${fmt(ertragProKwp)} kWh/kWp liegst du über dem deutschen Durchschnitt.`,
        details: `Typische Werte liegen bei 850-1000 kWh/kWp. Deine Anlage performt sehr gut!`,
        prioritaet: 3
      })
    }

    // === WARNUNGEN ===
    if (eigenverbrauchsquote < 30) {
      result.push({
        id: 'warnung-ev-niedrig',
        kategorie: 'warnung',
        titel: 'Niedrige Eigenverbrauchsquote',
        beschreibung: `Nur ${fmtDec(eigenverbrauchsquote)}% deiner PV-Erzeugung nutzt du selbst.`,
        details: `Bei einer Differenz von ${fmtDec(preisSpread)} ct/kWh zwischen Bezugs- und Einspeisepreis verschenkst du Potenzial.`,
        handlungsempfehlung: hatBatterie
          ? 'Prüfe, ob die Batterie optimal konfiguriert ist oder ob Verbraucher in die Mittagszeit verschoben werden können.'
          : 'Ein Batteriespeicher könnte den Eigenverbrauch deutlich steigern.',
        potenzial: `+${fmt(verlorenesPotenzial * 0.3)}€/Jahr möglich`,
        prioritaet: 1
      })
    }

    if (ertragProKwp < 800 && ertragProKwp > 0) {
      result.push({
        id: 'warnung-ertrag-niedrig',
        kategorie: 'warnung',
        titel: 'Ertrag unter Erwartung',
        beschreibung: `Mit ${fmt(ertragProKwp)} kWh/kWp liegt der Ertrag unter dem Durchschnitt von ~${communityErtragProKwp} kWh/kWp.`,
        details: 'Mögliche Ursachen: Verschattung, Verschmutzung, suboptimale Ausrichtung oder technisches Problem.',
        handlungsempfehlung: 'Prüfe die Module auf Verschmutzung und lass ggf. die Anlage vom Fachmann checken.',
        prioritaet: 1
      })
    }

    if (hatBatterie && batterieEffizienz < 85 && batterieEffizienz > 0) {
      result.push({
        id: 'warnung-batterie-effizienz',
        kategorie: 'warnung',
        titel: 'Batterie-Effizienz prüfen',
        beschreibung: `Die Batterie-Effizienz liegt bei ${fmtDec(batterieEffizienz)}% (Entladung/Ladung).`,
        details: 'Normale Lithium-Speicher erreichen 90-95%. Niedrigere Werte können auf Alterung oder falsche Konfiguration hindeuten.',
        handlungsempfehlung: 'Lass die Batterie-Einstellungen vom Installateur prüfen.',
        prioritaet: 2
      })
    }

    // Sommer vs Winter Unterschied
    if (sommerEVQuote > 0 && winterEVQuote > 0 && (sommerEVQuote - winterEVQuote) > 20) {
      result.push({
        id: 'warnung-saisonal',
        kategorie: 'warnung',
        titel: 'Starke saisonale Schwankung',
        beschreibung: `Eigenverbrauch im Sommer ${fmtDec(sommerEVQuote)}%, im Winter nur ${fmtDec(winterEVQuote)}%.`,
        details: 'Im Winter wird weniger produziert, aber der Verbrauch bleibt ähnlich. Das führt zu mehr Netzbezug.',
        handlungsempfehlung: 'Eine Wärmepumpe oder Heizstab könnte im Winter überschüssigen PV-Strom nutzen.',
        prioritaet: 2
      })
    }

    // === OPTIMIERUNGSVORSCHLÄGE ===
    if (eigenverbrauchsquote < 45 && eigenverbrauchsquote >= 30) {
      result.push({
        id: 'optimierung-ev',
        kategorie: 'optimierung',
        titel: 'Eigenverbrauch optimieren',
        beschreibung: `Deine EV-Quote von ${fmtDec(eigenverbrauchsquote)}% hat noch Potenzial.`,
        details: 'Durch gezielte Lastverschiebung (Waschmaschine, Geschirrspüler, Warmwasser) in die Mittagszeit kannst du mehr Solarstrom selbst nutzen.',
        handlungsempfehlung: 'Nutze Zeitschaltuhren oder smarte Steckdosen für zeitgesteuerte Verbraucher.',
        potenzial: `+${fmt(verlorenesPotenzial * 0.15)}€/Jahr`,
        prioritaet: 2
      })
    }

    // === ERWEITERUNGSVORSCHLÄGE ===
    if (!hatBatterie && eigenverbrauchsquote < 40 && leistungKwp >= 5) {
      const potenziellerMehrertrag = gesamtEinspeisung * 0.3 * (preisSpread / 100)
      result.push({
        id: 'erweiterung-batterie',
        kategorie: 'erweiterung',
        titel: 'Batteriespeicher erwägen',
        beschreibung: 'Ein Speicher könnte deinen Eigenverbrauch deutlich steigern.',
        details: `Bei ${fmt(gesamtEinspeisung)} kWh Einspeisung pro Jahr könntest du etwa 30% davon selbst nutzen.`,
        handlungsempfehlung: `Empfohlene Größe: ${Math.round(leistungKwp * 1.2)}-${Math.round(leistungKwp * 1.5)} kWh basierend auf ${fmtDec(leistungKwp)} kWp Anlagenleistung.`,
        potenzial: `+${fmt(potenziellerMehrertrag)}€/Jahr Einsparung`,
        prioritaet: 2
      })
    }

    if (!hatWallbox && leistungKwp >= 5 && eigenverbrauchsquote < 50) {
      result.push({
        id: 'erweiterung-wallbox',
        kategorie: 'erweiterung',
        titel: 'E-Auto & Wallbox',
        beschreibung: 'Ein E-Auto ist der perfekte "Stromspeicher" für überschüssigen Solarstrom.',
        details: `Bei ${fmtDec(durchschnittNetzbezugPreis)} ct/kWh Strompreis sparst du mit jedem selbst "getankten" kWh gegenüber der Tankstelle.`,
        handlungsempfehlung: 'Eine solaroptimierte Wallbox lädt bevorzugt bei Überschuss.',
        potenzial: 'Hohe Einsparung bei E-Mobilität',
        prioritaet: 2
      })
    }

    if (!hatWaermepumpe && gesamtNetzbezug > 3000 && leistungKwp >= 8) {
      result.push({
        id: 'erweiterung-waermepumpe',
        kategorie: 'erweiterung',
        titel: 'Wärmepumpe prüfen',
        beschreibung: 'Bei hohem Netzbezug könnte eine Wärmepumpe sinnvoll sein.',
        details: 'Wärmepumpen nutzen Umweltwärme und können durch PV-Strom sehr günstig betrieben werden.',
        handlungsempfehlung: 'Lass prüfen, ob dein Haus für eine Wärmepumpe geeignet ist.',
        prioritaet: 3
      })
    }

    if (hatBatterie && batterieKwh > 0 && batterieKwh < leistungKwp * 0.8) {
      result.push({
        id: 'erweiterung-batterie-groesser',
        kategorie: 'erweiterung',
        titel: 'Batteriekapazität erweitern',
        beschreibung: `Dein Speicher mit ${fmtDec(batterieKwh)} kWh ist relativ klein für ${fmtDec(leistungKwp)} kWp.`,
        details: 'Eine Faustformel: 1-1,5 kWh Speicher pro kWp Anlagenleistung.',
        handlungsempfehlung: 'Prüfe, ob dein Speicher erweiterbar ist.',
        prioritaet: 3
      })
    }

    // === INFO ===
    result.push({
      id: 'info-preisverhaeltnis',
      kategorie: 'info',
      titel: 'Preisverhältnis Bezug/Einspeisung',
      beschreibung: `Bezugspreis: ${fmtDec(analyseDaten.durchschnittNetzbezugPreis)} ct | Einspeisepreis: ${fmtDec(analyseDaten.durchschnittEinspeisePreis)} ct`,
      details: `Differenz: ${fmtDec(preisSpread)} ct/kWh – jede selbst genutzte kWh spart diesen Betrag.`,
      prioritaet: 3
    })

    // Sortiere nach Priorität
    return result.sort((a, b) => a.prioritaet - b.prioritaet)
  }, [analyseDaten, communityStats])

  if (!analyseDaten) {
    return (
      <div className={`${card.padded} p-8 text-center`}>
        <SimpleIcon type="info" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className={text.muted}>Keine Daten für KI-Analyse vorhanden</p>
      </div>
    )
  }

  const kategorieIcon = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'check'
      case 'warnung': return 'alert'
      case 'optimierung': return 'tool'
      case 'erweiterung': return 'add'
      case 'info': return 'info'
    }
  }

  const kategorieStyle = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
      case 'warnung': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
      case 'optimierung': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
      case 'erweiterung': return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700'
      case 'info': return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }
  }

  const kategorieIconColor = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'text-green-600 dark:text-green-400'
      case 'warnung': return 'text-orange-600 dark:text-orange-400'
      case 'optimierung': return 'text-blue-600 dark:text-blue-400'
      case 'erweiterung': return 'text-purple-600 dark:text-purple-400'
      case 'info': return 'text-gray-600 dark:text-gray-400'
    }
  }

  const kategorieTitelColor = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'text-green-800 dark:text-green-200'
      case 'warnung': return 'text-orange-800 dark:text-orange-200'
      case 'optimierung': return 'text-blue-800 dark:text-blue-200'
      case 'erweiterung': return 'text-purple-800 dark:text-purple-200'
      case 'info': return 'text-gray-800 dark:text-gray-200'
    }
  }

  const kategorieLabel = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'Erfolg'
      case 'warnung': return 'Achtung'
      case 'optimierung': return 'Optimierung'
      case 'erweiterung': return 'Erweiterung'
      case 'info': return 'Info'
    }
  }

  const kategorieBadge = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return badge.success
      case 'warnung': return badge.warning
      case 'optimierung': return badge.info
      case 'erweiterung': return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
      case 'info': return badge.neutral
    }
  }

  // Gruppiere Insights nach Kategorie
  const warnungen = insights.filter(i => i.kategorie === 'warnung')
  const optimierungen = insights.filter(i => i.kategorie === 'optimierung')
  const erweiterungen = insights.filter(i => i.kategorie === 'erweiterung')
  const erfolge = insights.filter(i => i.kategorie === 'erfolg')
  const infos = insights.filter(i => i.kategorie === 'info')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className={`${text.h1} flex items-center gap-2 mb-2`}>
            <SimpleIcon type="bulb" className="w-6 h-6 text-yellow-500" />
            KI-Analyse & Empfehlungen
          </h2>
          <p className={text.sm}>
            Automatische Analyse deiner PV-Anlage mit konkreten Verbesserungsvorschlägen
          </p>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={`${card.padded} text-center`}>
          <div className="text-2xl font-bold text-orange-600">{warnungen.length}</div>
          <div className={text.xs}>Warnungen</div>
        </div>
        <div className={`${card.padded} text-center`}>
          <div className="text-2xl font-bold text-blue-600">{optimierungen.length}</div>
          <div className={text.xs}>Optimierungen</div>
        </div>
        <div className={`${card.padded} text-center`}>
          <div className="text-2xl font-bold text-purple-600">{erweiterungen.length}</div>
          <div className={text.xs}>Erweiterungen</div>
        </div>
        <div className={`${card.padded} text-center`}>
          <div className="text-2xl font-bold text-green-600">{erfolge.length}</div>
          <div className={text.xs}>Erfolge</div>
        </div>
        <div className={`${card.padded} text-center`}>
          <div className="text-2xl font-bold text-gray-600">{infos.length}</div>
          <div className={text.xs}>Infos</div>
        </div>
      </div>

      {/* Warnungen zuerst */}
      {warnungen.length > 0 && (
        <div className="space-y-3">
          <h3 className={`${text.h3} flex items-center gap-2 text-orange-700 dark:text-orange-400`}>
            <SimpleIcon type="alert" className="w-5 h-5" />
            Warnungen prüfen
          </h3>
          {warnungen.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Optimierungen */}
      {optimierungen.length > 0 && (
        <div className="space-y-3">
          <h3 className={`${text.h3} flex items-center gap-2 text-blue-700 dark:text-blue-400`}>
            <SimpleIcon type="tool" className="w-5 h-5" />
            Optimierungspotenzial
          </h3>
          {optimierungen.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Erweiterungen */}
      {erweiterungen.length > 0 && (
        <div className="space-y-3">
          <h3 className={`${text.h3} flex items-center gap-2 text-purple-700 dark:text-purple-400`}>
            <SimpleIcon type="add" className="w-5 h-5" />
            Erweiterungsmöglichkeiten
          </h3>
          {erweiterungen.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Erfolge */}
      {erfolge.length > 0 && (
        <div className="space-y-3">
          <h3 className={`${text.h3} flex items-center gap-2 text-green-700 dark:text-green-400`}>
            <SimpleIcon type="check" className="w-5 h-5" />
            Das läuft gut
          </h3>
          {erfolge.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Infos */}
      {infos.length > 0 && (
        <div className="space-y-3">
          <h3 className={`${text.h3} flex items-center gap-2 text-gray-700 dark:text-gray-400`}>
            <SimpleIcon type="info" className="w-5 h-5" />
            Informationen
          </h3>
          {infos.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Hinweis */}
      <div className={`${gradient.infoBox} rounded-lg p-4 border-2 text-sm`}>
        <div className="flex items-start gap-3">
          <SimpleIcon type="info" className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">Hinweis zur Analyse</p>
            <p className="text-blue-700 dark:text-blue-300">
              Diese Analyse basiert auf deinen erfassten Daten und allgemeinen Erfahrungswerten.
              Die Empfehlungen sind Anhaltspunkte – für konkrete Maßnahmen empfehlen wir die Beratung durch einen Fachbetrieb.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Einzelne Insight-Karte
function InsightCard({ insight }: { insight: Insight }) {
  const kategorieStyle = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
      case 'warnung': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
      case 'optimierung': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
      case 'erweiterung': return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700'
      case 'info': return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }
  }

  const kategorieIconColor = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'text-green-600 dark:text-green-400'
      case 'warnung': return 'text-orange-600 dark:text-orange-400'
      case 'optimierung': return 'text-blue-600 dark:text-blue-400'
      case 'erweiterung': return 'text-purple-600 dark:text-purple-400'
      case 'info': return 'text-gray-600 dark:text-gray-400'
    }
  }

  const kategorieTitelColor = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'text-green-800 dark:text-green-200'
      case 'warnung': return 'text-orange-800 dark:text-orange-200'
      case 'optimierung': return 'text-blue-800 dark:text-blue-200'
      case 'erweiterung': return 'text-purple-800 dark:text-purple-200'
      case 'info': return 'text-gray-800 dark:text-gray-200'
    }
  }

  const kategorieIcon = (kategorie: Insight['kategorie']) => {
    switch (kategorie) {
      case 'erfolg': return 'check'
      case 'warnung': return 'alert'
      case 'optimierung': return 'tool'
      case 'erweiterung': return 'add'
      case 'info': return 'info'
    }
  }

  return (
    <div className={`rounded-lg border p-4 ${kategorieStyle(insight.kategorie)}`}>
      <div className="flex items-start gap-3">
        <SimpleIcon
          type={kategorieIcon(insight.kategorie) as any}
          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${kategorieIconColor(insight.kategorie)}`}
        />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className={`font-semibold ${kategorieTitelColor(insight.kategorie)}`}>
              {insight.titel}
            </h4>
            {insight.potenzial && (
              <span className="text-xs font-medium px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 rounded-full">
                {insight.potenzial}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            {insight.beschreibung}
          </p>
          {insight.details && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {insight.details}
            </p>
          )}
          {insight.handlungsempfehlung && (
            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-current/10">
              <SimpleIcon type="arrow-right" className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500" />
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {insight.handlungsempfehlung}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
