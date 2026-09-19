/**
 * **WK-15c — die Bedarfs-Vorbelegung an einem Gerät ohne beide Wärme-Achsen.**
 *
 * N-87 hat die Vorbelegung 12.000/3.000 für die **Klimaanlage** abgeschaltet:
 * Sie wurde beim Speichern mitgenommen, sah danach aus wie eine Anwender-Eingabe
 * und erzeugte eine Ersparnis gegen eine Gasheizung, die es nie gab. Die Regel
 * hing an `istLuftLuft` — und ließ damit die **Brauchwasser**-Wärmepumpe zurück:
 * 12.000 kWh Heizwärme an einem Gerät, das keine abgibt, gemessen **714,29 €**
 * statt 142,86 € Jahresersparnis.
 *
 * Seit WK-15c entscheiden die **Achsen** (Registry-Spiegel `hatHeizAchse` /
 * `hatWarmwasserAchse`, nicht `wp_art`): Das Paar beschreibt ein Haus mit
 * Heizung UND Warmwasser — fehlt eine der beiden Achsen, wird **keine** der
 * beiden Zahlen gesetzt.
 *
 * ⚠ **Diese Datei ist neu, weil es für `getInitialParamData` keine einzige Probe
 * gab** — die N-87-Regel stand seit dem 16.08.2026 ungeprüft im Client.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { InvestitionTyp } from '../../../types'

import { getInitialParamData } from './investitionFormHelpers'

const bedarf = (params: Record<string, unknown>) => {
  const p = getInitialParamData('waermepumpe', params)
  return [p.heizwaermebedarf_kwh, p.warmwasserbedarf_kwh]
}

describe('getInitialParamData — Wärmebedarf wird nur vorbelegt, wo beide Achsen gelten', () => {
  it('belegt die klassische Wärmepumpe wie bisher vor (Bestand)', () => {
    expect(bedarf({ wp_art: 'luft_wasser' })).toEqual(['12000', '3000'])
  })

  it('gilt auch für Altbestand ohne gepflegte Bauart', () => {
    expect(bedarf({})).toEqual(['12000', '3000'])
  })

  it('belegt die Split-Klimaanlage nicht vor (N-87, unverändert)', () => {
    expect(bedarf({ wp_art: 'luft_luft' })).toEqual(['', ''])
  })

  it('belegt die Brauchwasser-Wärmepumpe nicht vor (WK-15c)', () => {
    expect(bedarf({ wp_art: 'brauchwasser' })).toEqual(['', ''])
  })

  it('behält einen gespeicherten Wert an jeder Bauart — es wird nur nichts erfunden', () => {
    expect(bedarf({ wp_art: 'brauchwasser', warmwasserbedarf_kwh: 1800 })).toEqual(['', '1800'])
    expect(bedarf({ wp_art: 'luft_luft', heizwaermebedarf_kwh: 7400 })).toEqual(['7400', ''])
    expect(bedarf({ wp_art: 'luft_wasser', heizwaermebedarf_kwh: 9000 })).toEqual(['9000', '3000'])
  })
})

// ── F-77 (Kai2, Forum T89667 #345, 18.09.2026) ───────────────────────────────
// Das Bearbeiten-Formular zeigte die Wechselrichter-Leistung eines Balkonkraft-
// werks beim erneuten Oeffnen leer: das Feld kam am 29.07. (#347) ins Formular,
// die Init-Liste hier stammt vom 08.07. — gespeichert wurde der Wert (Merge in
// `InvestitionForm.tsx`), gelesen hat ihn nur das Backend. Dieselbe Klasse bei
// „Sonstiges": Zaehler-Art und Einheit zeigten immer „Gas"/„m³".
describe('getInitialParamData — jedes Formularfeld hat einen Init-Schluessel (F-77)', () => {
  it('laedt die Wechselrichter-Leistung des Balkonkraftwerks wieder (Kai2, T89667 #345)', () => {
    const p = getInitialParamData('balkonkraftwerk', { wechselrichter_leistung_w: 800 })
    expect(p.wechselrichter_leistung_w).toBe('800')
  })

  it('laedt Zaehler-Art und Einheit eines Verbrauchszaehlers wieder', () => {
    const p = getInitialParamData('sonstiges', {
      kategorie: 'zaehler', zaehler_art: 'wasser', zaehler_einheit: 'kWh',
    })
    expect([p.zaehler_art, p.zaehler_einheit]).toEqual(['wasser', 'kWh'])
  })

  it('belegt die drei Schluessel NICHT vor — ein leeres Feld wird nicht persistiert (#397-Muster)', () => {
    expect(getInitialParamData('balkonkraftwerk', {}).wechselrichter_leistung_w).toBe('')
    const p = getInitialParamData('sonstiges', {})
    expect([p.zaehler_art, p.zaehler_einheit]).toEqual(['', ''])
  })
})

// Baumweiter Waechter fuer die Klasse: Jeder Schluessel, den ein Typ-Formular
// liest oder schreibt (`name="param_x"`, `setParam('x')`, `paramData.x`), muss
// in getInitialParamData(typ) vorkommen — sonst zeigt das Formular beim Oeffnen
// einen gespeicherten Wert nicht (F-77). Gemessen 18.09.2026: drei Luecken in
// zwei von acht Formularen; der Waechter meldet die naechste beim Namen.
const FELDER_DIR = join(process.cwd(), 'src/components/forms/sections/InvestitionTypFelder')
const FELDER_TYP: Record<string, InvestitionTyp> = {
  'BalkonkraftwerkFelder.tsx': 'balkonkraftwerk',
  'EAutoFelder.tsx': 'e-auto',
  'PvModulFelder.tsx': 'pv-module',
  'SonstigesFelder.tsx': 'sonstiges',
  'SpeicherFelder.tsx': 'speicher',
  'WaermepumpeFelder.tsx': 'waermepumpe',
  'WallboxFelder.tsx': 'wallbox',
  'WechselrichterFelder.tsx': 'wechselrichter',
}
const SCHLUESSEL_MUSTER = [/name="param_([a-z0-9_]+)"/g, /setParam\('([a-z0-9_]+)'/g, /paramData\.([a-z0-9_]+)/g]

describe('Waechter F-77 — kein Typ-Formular liest einen Schluessel, den getInitialParamData nicht liefert', () => {
  const dateien = readdirSync(FELDER_DIR).filter((f) => f.endsWith('Felder.tsx')).sort()

  it('kennt jedes Typ-Formular (ein neues Formular braucht seine Zeile in FELDER_TYP)', () => {
    expect(dateien.filter((f) => !(f in FELDER_TYP))).toEqual([])
    expect(dateien.length).toBeGreaterThanOrEqual(8)
  })

  for (const datei of dateien) {
    const typ = FELDER_TYP[datei]
    if (!typ) continue
    it(`${datei} → ${typ}: alle Formular-Schluessel sind initialisiert`, () => {
      const quelle = readFileSync(join(FELDER_DIR, datei), 'utf-8')
      const gelesen = new Set<string>()
      for (const muster of SCHLUESSEL_MUSTER) {
        for (const treffer of quelle.matchAll(muster)) gelesen.add(treffer[1])
      }
      expect(gelesen.size).toBeGreaterThan(0)
      const init = new Set(Object.keys(getInitialParamData(typ, {})))
      expect([...gelesen].filter((k) => !init.has(k)).sort()).toEqual([])
    })
  }
})
