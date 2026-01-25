// components/OptimierungsvorschlaegeDashboard.tsx
// KI-gestützte (regelbasierte) Optimierungsvorschläge

'use client'

import SimpleIcon from './SimpleIcon'

interface OptimierungsvorschlaegeDashboardProps {
  monatsdaten: any[]
  anlage: any
  investitionen: any[]
}

interface Vorschlag {
  kategorie: 'eigenverbrauch' | 'speicher' | 'wirtschaftlich' | 'technisch' | 'verhalten'
  prioritaet: 'hoch' | 'mittel' | 'niedrig'
  titel: string
  beschreibung: string
  potenzial: string
  massnahmen: string[]
  icon: string
  color: string
}

export default function OptimierungsvorschlaegeDashboard({
  monatsdaten,
  anlage,
  investitionen
}: OptimierungsvorschlaegeDashboardProps) {

  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0
    return parseFloat(String(val)) || 0
  }

  const fmt = (num: number): string => {
    return num.toLocaleString('de-DE', { maximumFractionDigits: 0 })
  }

  const fmtDec = (num: number): string => {
    return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Berechne Gesamt-Kennzahlen
  const gesamtErzeugung = monatsdaten.reduce((sum, m) => sum + toNum(m.pv_erzeugung_kwh), 0)
  const gesamtDirektverbrauch = monatsdaten.reduce((sum, m) => sum + toNum(m.direktverbrauch_kwh), 0)
  const gesamtBatterieentladung = monatsdaten.reduce((sum, m) => sum + toNum(m.batterieentladung_kwh), 0)
  const gesamtBatterieladung = monatsdaten.reduce((sum, m) => sum + toNum(m.batterieladung_kwh), 0)
  const gesamtEinspeisung = monatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_kwh), 0)
  const gesamtNetzbezug = monatsdaten.reduce((sum, m) => sum + toNum(m.netzbezug_kwh), 0)
  const gesamtVerbrauch = monatsdaten.reduce((sum, m) => sum + toNum(m.gesamtverbrauch_kwh), 0)

  const eigenverbrauch = gesamtDirektverbrauch + gesamtBatterieentladung
  const eigenverbrauchsquote = gesamtErzeugung > 0 ? (eigenverbrauch / gesamtErzeugung) * 100 : 0
  const autarkiegrad = gesamtVerbrauch > 0 ? (eigenverbrauch / gesamtVerbrauch) * 100 : 0
  const batterieEffizienz = gesamtBatterieladung > 0 ? (gesamtBatterieentladung / gesamtBatterieladung) * 100 : 0

  const gesamtErloese = monatsdaten.reduce((sum, m) => sum + toNum(m.einspeisung_ertrag_euro), 0)
  const gesamtKosten = monatsdaten.reduce((sum, m) => sum + toNum(m.netzbezug_kosten_euro), 0)
  const gesamtBetriebsausgaben = monatsdaten.reduce((sum, m) => sum + toNum(m.betriebsausgaben_monat_euro), 0)

  // Durchschnittlicher spezifischer Ertrag (kWh/kWp/Jahr)
  const anzahlJahre = monatsdaten.length > 0
    ? Math.max(...monatsdaten.map(m => m.jahr)) - Math.min(...monatsdaten.map(m => m.jahr)) + 1
    : 1
  const jahrErzeugung = gesamtErzeugung / anzahlJahre
  const spezifischerErtrag = anlage?.leistung_kwp > 0
    ? jahrErzeugung / toNum(anlage.leistung_kwp)
    : 0

  // Analyse-Funktionen
  const vorschlaege: Vorschlag[] = []

  // 1. EIGENVERBRAUCH-OPTIMIERUNG
  if (eigenverbrauchsquote < 40) {
    vorschlaege.push({
      kategorie: 'eigenverbrauch',
      prioritaet: 'hoch',
      titel: 'Eigenverbrauch stark verbesserbar',
      beschreibung: `Deine Eigenverbrauchsquote liegt bei nur ${fmtDec(eigenverbrauchsquote)}%. Das bedeutet, dass du einen Großteil deiner selbst erzeugten Energie ins Netz einspeist, anstatt sie selbst zu nutzen.`,
      potenzial: `Bis zu ${fmt((gesamtEinspeisung * 0.3) * 0.30)} € pro Jahr durch höheren Eigenverbrauch`,
      massnahmen: [
        'Verbrauchszeiten in sonnenreiche Stunden verschieben (Waschmaschine, Spülmaschine tagsüber)',
        'Smarte Steuerung für Großverbraucher installieren',
        'Batteriespeicher installieren oder erweitern',
        'Warmwasser-Bereitung mit PV-Überschuss (elektrischer Heizstab)'
      ],
      icon: 'bulb',
      color: 'orange'
    })
  } else if (eigenverbrauchsquote < 60) {
    vorschlaege.push({
      kategorie: 'eigenverbrauch',
      prioritaet: 'mittel',
      titel: 'Eigenverbrauch weiter optimierbar',
      beschreibung: `Mit ${fmtDec(eigenverbrauchsquote)}% Eigenverbrauchsquote bist du auf einem guten Weg, aber es gibt noch Luft nach oben.`,
      potenzial: `Weitere ${fmt((gesamtEinspeisung * 0.2) * 0.30)} € pro Jahr möglich`,
      massnahmen: [
        'Lastmanagement: Verbrauch in Hochproduktionszeiten',
        'Smart Home Integration für automatische Steuerung',
        'E-Auto tagsüber laden (falls vorhanden)',
        'Speicherkapazität prüfen'
      ],
      icon: 'trend-up',
      color: 'blue'
    })
  } else if (eigenverbrauchsquote >= 70) {
    vorschlaege.push({
      kategorie: 'eigenverbrauch',
      prioritaet: 'niedrig',
      titel: 'Eigenverbrauch sehr gut optimiert',
      beschreibung: `Ausgezeichnet! Mit ${fmtDec(eigenverbrauchsquote)}% Eigenverbrauchsquote nutzt du deine PV-Anlage bereits sehr effizient.`,
      potenzial: 'Weiter so! Aktuelle Optimierung beibehalten',
      massnahmen: [
        'Bestehende Nutzungsmuster beibehalten',
        'Regelmäßige Kontrolle der Kennzahlen',
        'Bei Änderungen im Haushalt neu bewerten'
      ],
      icon: 'trophy',
      color: 'green'
    })
  }

  // 2. SPEICHER-ANALYSE
  if (anlage?.batteriekapazitaet_kwh) {
    const batterieKapazitaet = toNum(anlage.batteriekapazitaet_kwh)
    const durchschnittTagErzeugung = jahrErzeugung / 365
    const speicherVerhaeltnis = batterieKapazitaet / durchschnittTagErzeugung

    if (batterieEffizienz < 75) {
      vorschlaege.push({
        kategorie: 'speicher',
        prioritaet: 'hoch',
        titel: 'Batterie-Effizienz zu niedrig',
        beschreibung: `Die Batterie-Effizienz liegt bei nur ${fmtDec(batterieEffizienz)}%. Dies deutet auf Probleme hin.`,
        potenzial: 'Bis zu 15-20% mehr nutzbare Speicherkapazität',
        massnahmen: [
          'Batteriezustand vom Fachmann prüfen lassen',
          'Ladestrategie optimieren (Tiefentladung vermeiden)',
          'Temperatur-Überwachung der Batterie',
          'Software-Updates des Batterie-Management-Systems'
        ],
        icon: 'alert',
        color: 'red'
      })
    } else if (speicherVerhaeltnis < 0.3) {
      vorschlaege.push({
        kategorie: 'speicher',
        prioritaet: 'mittel',
        titel: 'Speicher könnte größer sein',
        beschreibung: `Mit ${fmtDec(batterieKapazitaet)} kWh Kapazität bei durchschnittlich ${fmtDec(durchschnittTagErzeugung)} kWh Tageserzeugung ist dein Speicher eher klein dimensioniert.`,
        potenzial: `Autarkie von ${fmtDec(autarkiegrad)}% auf bis zu ${fmtDec(Math.min(autarkiegrad + 15, 85))}% steigerbar`,
        massnahmen: [
          'Speichererweiterung prüfen (Wirtschaftlichkeit berechnen)',
          'Aktuelle Nutzung maximieren durch Lastverschiebung',
          'Nachtverbrauch optimieren'
        ],
        icon: 'battery',
        color: 'blue'
      })
    } else if (speicherVerhaeltnis > 0.8) {
      vorschlaege.push({
        kategorie: 'speicher',
        prioritaet: 'niedrig',
        titel: 'Speicher möglicherweise überdimensioniert',
        beschreibung: `Dein Speicher mit ${fmtDec(batterieKapazitaet)} kWh ist sehr groß im Verhältnis zur Erzeugung. Er wird vermutlich nicht voll genutzt.`,
        potenzial: 'Investitionskosten bei Neuanschaffung optimieren',
        massnahmen: [
          'Nutzung von Großverbrauchern in den Abend legen',
          'E-Auto nachts aus Batterie laden',
          'Warmwasser-Bereitung nachts',
          'Bei Neuinvestition: Kleinere Kapazität in Betracht ziehen'
        ],
        icon: 'info',
        color: 'gray'
      })
    }
  } else {
    // Kein Speicher vorhanden
    if (eigenverbrauchsquote < 50 && gesamtEinspeisung > gesamtVerbrauch) {
      vorschlaege.push({
        kategorie: 'speicher',
        prioritaet: 'hoch',
        titel: 'Batteriespeicher sehr empfehlenswert',
        beschreibung: `Du speist ${fmt(gesamtEinspeisung)} kWh ein, während du ${fmt(gesamtNetzbezug)} kWh aus dem Netz beziehst. Ein Speicher könnte das ausgleichen.`,
        potenzial: `Bis zu ${fmt(gesamtNetzbezug * 0.5 * 0.30)} € pro Jahr Einsparung möglich`,
        massnahmen: [
          `Speicher mit ca. ${fmtDec((jahrErzeugung / 365) * 0.5)} kWh Kapazität in Betracht ziehen`,
          'Fördermöglichkeiten prüfen (KfW, regionale Programme)',
          'Wirtschaftlichkeitsrechnung durchführen',
          'Angebote von mindestens 3 Anbietern einholen'
        ],
        icon: 'battery',
        color: 'orange'
      })
    }
  }

  // 3. WIRTSCHAFTLICHKEIT
  const nettoErtrag = gesamtErloese - gesamtKosten - gesamtBetriebsausgaben
  const durchschnittNettoErtragJahr = nettoErtrag / anzahlJahre

  if (gesamtBetriebsausgaben / anzahlJahre > 200) {
    vorschlaege.push({
      kategorie: 'wirtschaftlich',
      prioritaet: 'mittel',
      titel: 'Betriebsausgaben überprüfen',
      beschreibung: `Die Betriebsausgaben liegen bei ${fmtDec(gesamtBetriebsausgaben / anzahlJahre)} € pro Jahr. Das erscheint hoch für eine PV-Anlage.`,
      potenzial: 'Bis zu 100-150 € pro Jahr Einsparung',
      massnahmen: [
        'Versicherungen vergleichen und wechseln',
        'Wartungsverträge auf Notwendigkeit prüfen',
        'Eigenreinigung der Module (bei sicherer Zugänglichkeit)',
        'Monitoring-Kosten optimieren'
      ],
      icon: 'money',
      color: 'green'
    })
  }

  if (durchschnittNettoErtragJahr < 0) {
    vorschlaege.push({
      kategorie: 'wirtschaftlich',
      prioritaet: 'hoch',
      titel: 'Negativer Ertrag - Dringend optimieren',
      beschreibung: `Deine Anlage erwirtschaftet durchschnittlich ${fmtDec(durchschnittNettoErtragJahr)} € pro Jahr. Die Kosten übersteigen die Erlöse.`,
      potenzial: 'Wirtschaftlichkeit fundamental verbessern',
      massnahmen: [
        'PRIORITÄT: Eigenverbrauch massiv erhöhen',
        'Alle Großverbraucher tagsüber betreiben',
        'Stromtarif wechseln (günstigerer Bezugspreis)',
        'Technische Probleme prüfen (Erzeugung zu niedrig?)',
        'Falls möglich: Direktvermarktung statt Einspeisevergütung prüfen'
      ],
      icon: 'alert',
      color: 'red'
    })
  }

  // 4. TECHNISCHE PERFORMANCE
  if (spezifischerErtrag > 0 && spezifischerErtrag < 700) {
    vorschlaege.push({
      kategorie: 'technisch',
      prioritaet: 'hoch',
      titel: 'Erzeugung unter Erwartung',
      beschreibung: `Der spezifische Ertrag liegt bei ${fmtDec(spezifischerErtrag)} kWh/kWp/Jahr. In Deutschland sind 850-1100 kWh/kWp/Jahr üblich.`,
      potenzial: `Bis zu ${fmt((900 - spezifischerErtrag) * toNum(anlage?.leistung_kwp || 0))} kWh pro Jahr mehr Ertrag möglich`,
      massnahmen: [
        'Module auf Verschmutzung prüfen und reinigen',
        'Verschattung überprüfen (neue Bäume/Gebäude?)',
        'Wechselrichter auf Fehler prüfen',
        'Fachmann zur Inspektion beauftragen',
        'String-Monitoring installieren (falls nicht vorhanden)'
      ],
      icon: 'alert',
      color: 'orange'
    })
  } else if (spezifischerErtrag >= 1000) {
    vorschlaege.push({
      kategorie: 'technisch',
      prioritaet: 'niedrig',
      titel: 'Hervorragende technische Performance',
      beschreibung: `Exzellent! Deine Anlage erzielt ${fmtDec(spezifischerErtrag)} kWh/kWp/Jahr - das ist überdurchschnittlich.`,
      potenzial: 'Aktuelle Performance beibehalten',
      massnahmen: [
        'Regelmäßige Sichtkontrolle',
        'Monitoring weiterhin aktiv nutzen',
        'Jährliche Reinigung',
        'Dokumentation der guten Performance für Versicherung'
      ],
      icon: 'check',
      color: 'green'
    })
  }

  // 5. VERHALTENSTIPPS
  const sommerMonate = monatsdaten.filter(m => m.monat >= 5 && m.monat <= 8)
  const winterMonate = monatsdaten.filter(m => m.monat >= 11 || m.monat <= 2)

  const sommerEigenverbrauch = sommerMonate.length > 0
    ? sommerMonate.reduce((sum, m) => sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0) /
      sommerMonate.reduce((sum, m) => sum + toNum(m.pv_erzeugung_kwh), 0) * 100
    : 0

  const winterAutarkie = winterMonate.length > 0 && winterMonate.reduce((sum, m) => sum + toNum(m.gesamtverbrauch_kwh), 0) > 0
    ? winterMonate.reduce((sum, m) => sum + toNum(m.direktverbrauch_kwh) + toNum(m.batterieentladung_kwh), 0) /
      winterMonate.reduce((sum, m) => sum + toNum(m.gesamtverbrauch_kwh), 0) * 100
    : 0

  if (sommerEigenverbrauch < 50) {
    vorschlaege.push({
      kategorie: 'verhalten',
      prioritaet: 'mittel',
      titel: 'Sommer-Überschuss besser nutzen',
      beschreibung: `Im Sommer nutzt du nur ${fmtDec(sommerEigenverbrauch)}% deiner PV-Erzeugung selbst. Hier liegt großes Potenzial.`,
      potenzial: `Bis zu ${fmt((sommerMonate.reduce((s,m) => s + toNum(m.einspeisung_kwh), 0) * 0.3) * 0.30)} € pro Sommer-Saison`,
      massnahmen: [
        'Pool-Pumpe/Klimaanlage tagsüber betreiben',
        'Große Wäschen in den Sommer legen',
        'E-Auto im Sommer vollständig mit PV laden',
        'Eis-/Gefrierschrank-Abtauen und Neubefüllen tagsüber',
        'Gartenbewässerung mit PV-Überschuss'
      ],
      icon: 'sun',
      color: 'yellow'
    })
  }

  if (winterAutarkie < 30) {
    vorschlaege.push({
      kategorie: 'verhalten',
      prioritaet: 'niedrig',
      titel: 'Winter-Autarkie erhöhen',
      beschreibung: `Im Winter liegt deine Autarkie nur bei ${fmtDec(winterAutarkie)}%. Das ist normal, aber optimierbar.`,
      potenzial: 'Netzbezugskosten im Winter reduzieren',
      massnahmen: [
        'Heizungs-Zeitschaltung: Aufheizen tagsüber bei Sonnenschein',
        'Backofen, Herd nur mittags nutzen',
        'Warmwasser tagsüber erhitzen (falls elektrisch)',
        'Batteriespeicher im Winter voll nutzen',
        'Realistische Erwartung: 100% Autarkie im Winter unrealistisch'
      ],
      icon: 'home',
      color: 'blue'
    })
  }

  // Sortiere nach Priorität
  const prioritaetWert = { 'hoch': 3, 'mittel': 2, 'niedrig': 1 }
  vorschlaege.sort((a, b) => prioritaetWert[b.prioritaet] - prioritaetWert[a.prioritaet])

  const kategorieInfo = {
    eigenverbrauch: { name: 'Eigenverbrauch', icon: 'bulb', color: 'blue' },
    speicher: { name: 'Batteriespeicher', icon: 'battery', color: 'purple' },
    wirtschaftlich: { name: 'Wirtschaftlichkeit', icon: 'money', color: 'green' },
    technisch: { name: 'Technische Performance', icon: 'settings', color: 'gray' },
    verhalten: { name: 'Nutzungsverhalten', icon: 'home', color: 'orange' }
  }

  const prioritaetStyle = {
    hoch: 'bg-red-50 border-red-300 text-red-900',
    mittel: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    niedrig: 'bg-green-50 border-green-300 text-green-900'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-6 border-2 border-blue-300">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
              <SimpleIcon type="bulb" className="w-6 h-6 text-blue-600" />
              Optimierungsvorschläge
            </h2>
            <p className="text-sm text-gray-600">
              Intelligente Analyse deiner PV-Anlage mit konkreten Verbesserungsvorschlägen
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Gefunden</div>
            <div className="text-3xl font-bold text-blue-600">{vorschlaege.length}</div>
            <div className="text-xs text-gray-500">Vorschläge</div>
          </div>
        </div>
      </div>

      {/* Zusammenfassung nach Kategorie */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(kategorieInfo).map(([key, info]) => {
          const count = vorschlaege.filter(v => v.kategorie === key).length
          return (
            <div key={key} className="bg-white rounded-lg shadow p-4 text-center">
              <SimpleIcon type={info.icon} className={`w-8 h-8 mx-auto mb-2 text-${info.color}-600`} />
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-600 mt-1">{info.name}</div>
            </div>
          )
        })}
      </div>

      {/* Vorschläge */}
      {vorschlaege.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <SimpleIcon type="trophy" className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Perfekt optimiert!
          </h3>
          <p className="text-gray-600">
            Deine PV-Anlage läuft bereits sehr effizient. Weiter so!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vorschlaege.map((vorschlag, index) => (
            <div
              key={index}
              className={`bg-white rounded-lg shadow-md border-l-4 overflow-hidden transition-all hover:shadow-lg ${
                vorschlag.prioritaet === 'hoch' ? 'border-red-500' :
                vorschlag.prioritaet === 'mittel' ? 'border-yellow-500' :
                'border-green-500'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full bg-${vorschlag.color}-100`}>
                      <SimpleIcon type={vorschlag.icon} className={`w-6 h-6 text-${vorschlag.color}-600`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {vorschlag.titel}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${prioritaetStyle[vorschlag.prioritaet]}`}>
                          {vorschlag.prioritaet === 'hoch' ? '🔴' : vorschlag.prioritaet === 'mittel' ? '🟡' : '🟢'} {vorschlag.prioritaet.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {kategorieInfo[vorschlag.kategorie].name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 mb-4">
                  {vorschlag.beschreibung}
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <SimpleIcon type="trend-up" className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Einsparpotenzial</span>
                  </div>
                  <p className="text-sm text-blue-800 font-semibold">{vorschlag.potenzial}</p>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Empfohlene Maßnahmen:</div>
                  <ul className="space-y-2">
                    {vorschlag.massnahmen.map((massnahme, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-blue-600 mt-0.5">▸</span>
                        <span>{massnahme}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <SimpleIcon type="info" className="w-5 h-5 text-gray-600 mt-0.5" />
          <div className="text-sm text-gray-600">
            <strong>Hinweis:</strong> Diese Vorschläge basieren auf einer automatisierten Analyse deiner Daten.
            Für konkrete Investitionsentscheidungen (z.B. Batteriespeicher) empfehlen wir, einen Fachmann zu konsultieren
            und eine detaillierte Wirtschaftlichkeitsrechnung durchzuführen.
          </div>
        </div>
      </div>
    </div>
  )
}
