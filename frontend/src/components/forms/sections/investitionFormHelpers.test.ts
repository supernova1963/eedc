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
