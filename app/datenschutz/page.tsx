// app/datenschutz/page.tsx

import Link from 'next/link'
import SimpleIcon from '@/components/SimpleIcon'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <PublicHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <SimpleIcon type="shield" className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Datenschutzerklärung</h1>
              <p className="text-gray-600 mt-1">EEDC - Electronic Energy Data Collection</p>
            </div>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Übersicht</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Diese Datenschutzerklärung informiert Sie über die Verarbeitung Ihrer personenbezogenen Daten
                bei der Nutzung der EEDC-Plattform zur Verwaltung und Auswertung von PV-Anlagen-Daten.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Wichtig:</strong> Alle Daten werden verschlüsselt in Ihrer Supabase-Datenbank gespeichert.
                  Sie haben die volle Kontrolle über Ihre Daten und können jederzeit entscheiden, welche Informationen
                  Sie öffentlich teilen möchten.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Verantwortlicher</h2>
              <p className="text-gray-700 leading-relaxed">
                Verantwortlich für die Datenverarbeitung ist der jeweilige Betreiber der EEDC-Instanz.
                Da EEDC eine selbst-gehostete Lösung ist, liegt die Verantwortung beim Betreiber der
                jeweiligen Installation.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Welche Daten werden erfasst?</h2>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.1 Pflichtdaten (bei Registrierung)</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                <li>E-Mail-Adresse (für Authentifizierung)</li>
                <li>Vorname und Nachname</li>
                <li>Passwort (verschlüsselt gespeichert)</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.2 Optionale Daten</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                <li>Standort (PLZ, Ort, Koordinaten)</li>
                <li>Telefonnummer</li>
                <li>Anlagen-Daten (PV-Leistung, Hersteller, Modell, etc.)</li>
                <li>Monatsdaten (Erzeugung, Verbrauch, Eigenverbrauch, etc.)</li>
                <li>Investitions-Daten (E-Auto, Wärmepumpe, Speicher)</li>
                <li>Profilbeschreibung Ihrer Anlage</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.3 Automatisch erfasste Daten</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Zeitstempel bei Datenerstellung und -änderung</li>
                <li>Session-Cookies für Authentifizierung</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Zweck der Datenverarbeitung</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Bereitstellung und Betrieb der EEDC-Plattform</li>
                <li>Authentifizierung und Nutzerverwaltung</li>
                <li>Speicherung und Auswertung Ihrer Anlagen-Daten</li>
                <li>Berechnung von Kennzahlen (Autarkiegrad, ROI, CO₂-Einsparung, etc.)</li>
                <li>Ermöglichung des Community-Austauschs (nur mit Ihrer Einwilligung)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Community-Funktion und öffentliche Daten</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Sie können entscheiden, welche Daten Sie mit der Community teilen möchten. Folgende Freigabe-Stufen
                stehen zur Verfügung:
              </p>

              <div className="bg-gray-50 rounded-lg p-6 mb-4">
                <h3 className="font-semibold text-gray-900 mb-3">Freigabe-Optionen (in Anlagen-Profil):</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <SimpleIcon type="check" className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 dark:text-gray-100">Profil öffentlich:</strong>
                      <span className="text-gray-700 ml-2">Name, Standort, Komponenten der Anlage</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <SimpleIcon type="check" className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 dark:text-gray-100">Kennzahlen öffentlich:</strong>
                      <span className="text-gray-700 ml-2">Autarkiegrad, Eigenverbrauch, CO₂-Einsparung</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <SimpleIcon type="check" className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 dark:text-gray-100">Monatsdaten öffentlich:</strong>
                      <span className="text-gray-700 ml-2">Detaillierte monatliche Verbrauchs- und Erzeugungsdaten</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <SimpleIcon type="check" className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 dark:text-gray-100">Investitionen öffentlich:</strong>
                      <span className="text-gray-700 ml-2">Kosten und Einsparungen Ihrer Investitionen</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <SimpleIcon type="check" className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 dark:text-gray-100">Auswertungen öffentlich:</strong>
                      <span className="text-gray-700 ml-2">ROI-Berechnungen und Amortisationszeiten</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <SimpleIcon type="check" className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 dark:text-gray-100">Standort genau:</strong>
                      <span className="text-gray-700 ml-2">Exakte Koordinaten vs. anonymisierte PLZ (XX000)</span>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900">
                  <strong>Hinweis:</strong> Alle Freigaben sind standardmäßig deaktiviert. Sie müssen aktiv
                  entscheiden, welche Daten Sie teilen möchten. Sie können Ihre Freigaben jederzeit in den
                  Anlagen-Einstellungen ändern oder vollständig zurückziehen.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Rechtsgrundlage</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Art. 6 Abs. 1 lit. b DSGVO:</strong> Vertragserfüllung (Bereitstellung der Plattform)</li>
                <li><strong>Art. 6 Abs. 1 lit. a DSGVO:</strong> Einwilligung (für Community-Freigaben)</li>
                <li><strong>Art. 6 Abs. 1 lit. f DSGVO:</strong> Berechtigtes Interesse (Systemsicherheit)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Datenspeicherung</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Ihre Daten werden in einer Supabase-Datenbank gespeichert. Supabase nutzt PostgreSQL und
                bietet folgende Sicherheitsmaßnahmen:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Verschlüsselte Datenübertragung (TLS/SSL)</li>
                <li>Verschlüsselte Datenspeicherung (AES-256)</li>
                <li>Regelmäßige Backups</li>
                <li>Row Level Security (RLS) für Datenisolation</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Ihre Rechte</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Auskunftsrecht (Art. 15 DSGVO):</strong> Sie können Auskunft über Ihre gespeicherten Daten verlangen</li>
                <li><strong>Berichtigungsrecht (Art. 16 DSGVO):</strong> Sie können falsche Daten korrigieren lassen</li>
                <li><strong>Löschungsrecht (Art. 17 DSGVO):</strong> Sie können die Löschung Ihrer Daten verlangen</li>
                <li><strong>Einschränkungsrecht (Art. 18 DSGVO):</strong> Sie können die Verarbeitung einschränken lassen</li>
                <li><strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Sie können Ihre Daten in einem maschinenlesbaren Format erhalten</li>
                <li><strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Sie können der Verarbeitung widersprechen</li>
                <li><strong>Widerrufsrecht:</strong> Erteilte Einwilligungen können Sie jederzeit widerrufen</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Datenlöschung</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Sie können Ihre Daten jederzeit selbstständig löschen:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Einzelne Monatsdaten können in der Übersicht gelöscht werden</li>
                <li>Investitionen können deaktiviert oder gelöscht werden</li>
                <li>Anlagen können gelöscht werden</li>
                <li>Ihr gesamtes Konto kann auf Anfrage gelöscht werden</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Nach Löschung Ihres Kontos werden alle personenbezogenen Daten unwiderruflich entfernt,
                außer wenn gesetzliche Aufbewahrungspflichten bestehen.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Cookies und Session-Management</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                EEDC verwendet nur technisch notwendige Cookies für die Authentifizierung:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Session-Cookies für den Login-Status (erforderlich)</li>
                <li>Keine Tracking-Cookies</li>
                <li>Keine Werbe-Cookies</li>
                <li>Keine Cookies von Drittanbietern</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Änderungen dieser Datenschutzerklärung</h2>
              <p className="text-gray-700 leading-relaxed">
                Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen, um sie an geänderte
                Rechtsvorgaben oder Änderungen unserer Datenverarbeitung anzupassen. Sie werden über
                Änderungen informiert.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Kontakt</h2>
              <p className="text-gray-700 leading-relaxed">
                Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich bitte an den
                Betreiber Ihrer EEDC-Instanz.
              </p>
            </section>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
              <div className="flex items-start gap-3">
                <SimpleIcon type="shield" className="w-6 h-6 text-green-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-2">Ihre Daten gehören Ihnen</h3>
                  <p className="text-sm text-green-800 leading-relaxed">
                    EEDC ist so konzipiert, dass Sie die volle Kontrolle über Ihre Daten behalten.
                    Alle Daten werden in Ihrer eigenen Datenbank gespeichert, und Sie entscheiden,
                    was Sie teilen möchten.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <SimpleIcon type="back" className="w-5 h-5" />
            Zurück zur Startseite
          </Link>
          <Link
            href="/impressum"
            className="inline-flex items-center gap-2 px-6 py-3 text-blue-600 hover:text-blue-700"
          >
            Impressum →
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
