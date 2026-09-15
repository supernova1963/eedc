import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * N-448 — Wer einen Registry-Eintrag hat, baut im Adapter keinen zweiten Block.
 *
 * `KomponentenTypV4` entscheidet für ④ Verlauf und ⑤ Vergleich die **Registry
 * zuerst**: `analyse?.verlauf ? analyse.verlauf(…) : g.verlauf ? <Generisch…>`.
 * Setzt `komponentenAnalyse.tsx` den Schlüssel, ist der gleichnamige
 * Adapter-Zweig unerreichbar — er wird gerechnet, nie gerendert.
 *
 * Warum das kein toter Code ist, sondern eine wartende Drift (Klasse N-137):
 * Der Wärmepumpen-Zweig bildete die **Jahressumme Wärme**, während die sichtbare
 * Registry-Sicht Strom bzw. Arbeitszahl zeigt — andere Größe, andere Achse.
 * Fällt ein Registry-Eintrag weg (Refactor, Tippfehler im Typ-Schlüssel),
 * wechselt der Block still Größe UND Achse, ohne dass eine Probe anschlägt.
 *
 * Die Probe ist bewusst **generisch über die Registry** formuliert: sie gilt
 * auch für einen Typ, den erst jemand später einträgt.
 */
const getSpeicherDashboard = vi.fn()
const getWaermepumpeDashboard = vi.fn()
const getEAutoDashboard = vi.fn()
const getWallboxDashboard = vi.fn()
const getBalkonkraftwerkDashboard = vi.fn()
const getSonstigesDashboard = vi.fn()
const list = vi.fn()
const getUebersicht = vi.fn()
const getPVStringsGesamtlaufzeit = vi.fn()
const listAggregiert = vi.fn()

vi.mock('../api/investitionen', () => ({
  investitionenApi: {
    getSpeicherDashboard: (...a: unknown[]) => getSpeicherDashboard(...a),
    getWaermepumpeDashboard: (...a: unknown[]) => getWaermepumpeDashboard(...a),
    getEAutoDashboard: (...a: unknown[]) => getEAutoDashboard(...a),
    getWallboxDashboard: (...a: unknown[]) => getWallboxDashboard(...a),
    getBalkonkraftwerkDashboard: (...a: unknown[]) => getBalkonkraftwerkDashboard(...a),
    getSonstigesDashboard: (...a: unknown[]) => getSonstigesDashboard(...a),
    list: (...a: unknown[]) => list(...a),
  },
}))
vi.mock('../api/cockpit', () => ({ cockpitApi: {
  getUebersicht: (...a: unknown[]) => getUebersicht(...a),
  getPVStringsGesamtlaufzeit: (...a: unknown[]) => getPVStringsGesamtlaufzeit(...a),
} }))
vi.mock('../api/monatsdaten', () => ({ monatsdatenApi: { listAggregiert: (...a: unknown[]) => listAggregiert(...a) } }))

import { KOMPONENTEN_ADAPTER } from './komponentenAdapter'
import { KOMPONENTEN_ANALYSE } from './komponentenAnalyse'

const inv = (typ: string) => ({ id: 1, anlage_id: 1, typ, bezeichnung: 'Gerät A', aktiv: true })

/** Zwei Monate mit allen Feldern, die irgendein Adapter-Zweig lesen könnte —
 *  damit ein noch vorhandener Zweig sicher `md.length > 0` sieht und ANSCHLÄGT.
 *  Eine leere Monatsliste würde jeden Zweig `undefined` machen und die Probe
 *  wäre grün, ohne etwas gemessen zu haben. */
const MD = [
  { jahr: 2025, monat: 10, verbrauch_daten: {
    ladung_kwh: 80, entladung_kwh: 70, heizenergie_kwh: 300, warmwasser_kwh: 100,
    ladung_pv_kwh: 40, ladung_netz_kwh: 20, pv_erzeugung_kwh: 90, eigenverbrauch_kwh: 60 } },
  { jahr: 2025, monat: 11, verbrauch_daten: {
    ladung_kwh: 100, entladung_kwh: 90, heizenergie_kwh: 400, warmwasser_kwh: 120,
    ladung_pv_kwh: 50, ladung_netz_kwh: 30, pv_erzeugung_kwh: 110, eigenverbrauch_kwh: 70 } },
]

const ANTWORT: Record<string, { mock: ReturnType<typeof vi.fn>; z: Record<string, unknown> }> = {
  speicher: { mock: getSpeicherDashboard, z: {
    vollzyklen: 312, effizienz_prozent: 90, gesamt_entladung_kwh: 4100,
    gesamt_ladung_kwh: 4500, arbitrage_kwh: 0, ersparnis_euro: 286, anzahl_monate: 2 } },
  waermepumpe: { mock: getWaermepumpeDashboard, z: {
    durchschnitt_cop: 3.8, gesamt_waerme_kwh: 12400, gesamt_stromverbrauch_kwh: 3300,
    gesamt_heizenergie_kwh: 9400, gesamt_warmwasser_kwh: 3000, ersparnis_euro: 500 } },
  'e-auto': { mock: getEAutoDashboard, z: {
    gesamt_km: 12000, gesamt_ladung_kwh: 2400, pv_anteil_prozent: 60,
    ersparnis_vs_benzin_euro: 900, verbrauch_kwh_100km: 20 } },
  balkonkraftwerk: { mock: getBalkonkraftwerkDashboard, z: {
    gesamt_erzeugung_kwh: 800, eigenverbrauch_quote_prozent: 70,
    gesamt_eigenverbrauch_kwh: 560, gesamt_einspeisung_kwh: 240, gesamt_ersparnis_euro: 168 } },
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([])
  listAggregiert.mockResolvedValue([])
  getPVStringsGesamtlaufzeit.mockResolvedValue(null)
})

describe('N-448 — kein zweiter Block neben der Registry', () => {
  for (const [typ, { mock, z }] of Object.entries(ANTWORT)) {
    it(`${typ}: Registry hat verlauf+vergleich ⇒ der Adapter liefert beides NICHT`, async () => {
      // Vorbedingung, nicht Annahme: die Probe misst nur, was die Registry
      // tatsächlich beansprucht. Verschwindet dort ein Schlüssel, wird diese
      // Zeile rot statt die Erwartung darunter still falsch zu werden.
      expect(KOMPONENTEN_ANALYSE[typ]?.verlauf, `Registry-Eintrag verlauf für ${typ}`).toBeTypeOf('function')
      expect(KOMPONENTEN_ANALYSE[typ]?.vergleich, `Registry-Eintrag vergleich für ${typ}`).toBeTypeOf('function')

      mock.mockResolvedValue([{ investition: inv(typ), zusammenfassung: z, monatsdaten: MD }])
      const [g] = await KOMPONENTEN_ADAPTER[typ].fetch(1)
      expect(g.monatswerte, 'Monatsdaten müssen ankommen — sonst misst die Probe nichts').toBe(2)
      expect(g.verlauf).toBeUndefined()
      expect(g.vergleich).toBeUndefined()
    })
  }

  it('Wallbox hat KEINEN Registry-Verlauf und behält ihren Adapter-Zweig', async () => {
    // Die Gegenprobe. Ohne sie wäre die Regel oben auch dann erfüllt, wenn
    // jemand `verlauf`/`vergleich` pauschal aus dem Adapter entfernte.
    expect(KOMPONENTEN_ANALYSE.wallbox?.verlauf).toBeUndefined()
    expect(KOMPONENTEN_ANALYSE.wallbox?.vergleich).toBeUndefined()
    getWallboxDashboard.mockResolvedValue([{
      investition: inv('wallbox'),
      zusammenfassung: { gesamt_heim_ladung_kwh: 180, pv_anteil_prozent: 60,
        gesamt_ladevorgaenge: 12, ersparnis_vs_extern_euro: 40, ladung_pv_kwh: 108, ladung_netz_kwh: 72 },
      monatsdaten: MD,
    }])
    const [g] = await KOMPONENTEN_ADAPTER.wallbox.fetch(1)
    expect(g.verlauf).toBeDefined()
    expect(g.vergleich).toBeDefined()
  })
})
