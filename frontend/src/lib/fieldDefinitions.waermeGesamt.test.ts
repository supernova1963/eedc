/**
 * N-391 — der Monatsabschluss bietet *Wärme gesamt* an.
 *
 * Client-Hälfte des Backend-Wächters `test_n391_gesamtwaerme.py::test_k10_*`.
 * Beide Registries führen dieselben Felder und sind **nur durch Kommentare**
 * verbunden: `check-spiegel-backend.mjs` deckt sie nicht ab. Wer ein Feld nur
 * auf einer Seite anlegt, bekommt es entweder im Monatsabschluss (dieser
 * Spiegel) oder auf der Zuordnungs-Fläche (Backend-Registry) — lautlos.
 *
 * Ohne diese Zeile hätte ein Anwender mit EINEM gemeinsamen Wärmemengenzähler
 * zwar einen Zuordnungs-Slot, aber kein Eingabefeld: Er könnte seinen Wert
 * weiterhin nur unter *Heizwärme* eintragen — genau die Lage, aus der die
 * Arbeitszahl Heizen von 5,0 statt 3,0 entstand.
 */
import { describe, it, expect } from 'vitest'
import { getFelderFuerInvestition } from './fieldDefinitions'

const namen = (fs: { feld: string }[]) => fs.map(f => f.feld)

describe('N-391 — Wärme gesamt im Monatsabschluss', () => {
  it('steht bei jeder Wärmepumpe zur Eingabe bereit', () => {
    const felder = namen(getFelderFuerInvestition('waermepumpe', { wp_art: 'luft_wasser' }))
    expect(felder).toContain('waerme_kwh')
  })

  it('steht NACH den beiden Einzelwerten — der Regelfall bleibt die Aufteilung', () => {
    const felder = namen(getFelderFuerInvestition('waermepumpe', { wp_art: 'luft_wasser' }))
    expect(felder.indexOf('waerme_kwh')).toBeGreaterThan(felder.indexOf('heizenergie_kwh'))
    expect(felder.indexOf('waerme_kwh')).toBeGreaterThan(felder.indexOf('warmwasser_kwh'))
  })

  it('trägt keine Bedingung — auch die Split-Klimaanlage bekommt es', () => {
    // R1: was ein Gerät liefern kann, sagt der zugeordnete Zähler, nicht die
    // Bauart. `warmwasser_kwh` fällt hier weg (kein Warmwasserkreis, N-304),
    // die Gesamtwärme nicht: Sie ist die Bilanzgröße jedes Geräts.
    const klima = namen(getFelderFuerInvestition('waermepumpe', { wp_art: 'luft_luft' }))
    expect(klima).toContain('waerme_kwh')
    expect(klima).not.toContain('warmwasser_kwh')
  })

  it('sagt im Hinweis, dass es thermisch ist und wann es leer bleibt', () => {
    const feld = getFelderFuerInvestition('waermepumpe', { wp_art: 'luft_wasser' })
      .find(f => f.feld === 'waerme_kwh')!
    expect(feld.label).toBe('Wärme gesamt')
    expect(feld.einheit).toBe('kWh')
    expect(feld.hint).toMatch(/thermisch/)
    expect(feld.hint).toMatch(/getrennten Zählern leer/)
  })
})
