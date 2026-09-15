/**
 * Die Ø-Preis-Kachel nennt die Herkunft ihrer Zahl (#412, 11.09.2026).
 *
 * Schwesterdatei: `MonatBilanz.test.tsx` (dieselbe Kachel-Fabrik).
 *
 * ⛔ **Warum das nötig wurde.** Bis 11.09.2026 kannte die Formel-Zeile zwei
 * Texte: „dynamischer Tarif" (wenn ein Ø gepflegt war) und sonst „Arbeitspreis
 * aus dem Strompreis-Tarif". Ein über HT/NT-Fenster gewichteter Preis lief
 * schon damals unter dem zweiten — falsch, aber folgenlos. Mit der neuen
 * **gemessenen** Stufe wären es drei Fälle unter zwei Namen geworden: Ein aus
 * Stundenpreisen gemittelter Wert hätte „Arbeitspreis aus dem Strompreis-Tarif"
 * über sich gehabt. Das ist eine Falschaussage, die der Bau selbst eingebaut
 * hätte (ADR-002/P4: die Antwort sagt, was sie ist).
 */
import { describe, it, expect } from 'vitest'
import { baueNetzKostenKpis } from './MonatBilanz'
import type { AktuellerMonatResponse } from '../api/aktuellerMonat'

const basis = (over: Partial<AktuellerMonatResponse> = {}): AktuellerMonatResponse =>
  ({
    netzbezug_kwh: 500,
    netzbezug_preis_cent: 34,
    netzbezug_arbeitspreis_kosten_euro: 170,
    netzbezug_durchschnittspreis_cent: null,
    ...over,
  } as unknown as AktuellerMonatResponse)

const preisKachel = (d: AktuellerMonatResponse) =>
  baueNetzKostenKpis(d).find((k) => k.title === 'Ø-Preis Netz')

describe('Ø-Preis Netz — die Formel nennt die Herkunft', () => {
  it('gemessen: sagt, dass die Stundenpreise gemittelt wurden', () => {
    const k = preisKachel(basis({
      netzbezug_preis_herkunft: 'gemessen',
      netzbezug_preis_abdeckung: 0.36,
      netzbezug_preis_cent: 22.4,
    }))

    expect(k?.formel).toContain('gemessenen Stundenpreise')
    expect(k?.formel).not.toContain('aus dem Strompreis-Tarif')
  })

  it('gemessen: nennt die Abdeckung, weil sie im laufenden Monat klein ist', () => {
    const k = preisKachel(basis({
      netzbezug_preis_herkunft: 'gemessen', netzbezug_preis_abdeckung: 0.36,
    }))

    expect(k?.formel).toContain('36 %')
  })

  it('gepflegt: nennt den Monatsabschluss als Quelle', () => {
    const k = preisKachel(basis({
      netzbezug_preis_herkunft: 'gepflegt',
      netzbezug_durchschnittspreis_cent: 26.5,
    }))

    expect(k?.formel).toContain('abgerechneter')
  })

  it('zeitfenster: wird nicht mehr als Tarif-Arbeitspreis ausgegeben', () => {
    // Der Fall, der schon vor #412 falsch beschriftet war.
    const k = preisKachel(basis({ netzbezug_preis_herkunft: 'zeitfenster' }))

    expect(k?.formel).toContain('HT/NT')
  })

  it('stamm: bleibt beim eingeführten Wortlaut', () => {
    const k = preisKachel(basis({ netzbezug_preis_herkunft: 'stamm' }))

    expect(k?.formel).toContain('Arbeitspreis aus dem Strompreis-Tarif')
  })

  it('ohne Herkunft (alte Antwort) behauptet die Kachel keine', () => {
    // ⚠ Eine Antwort ohne das Feld darf nicht plötzlich „gemessen" behaupten —
    // der Client kann es nicht wissen.
    const k = preisKachel(basis())

    expect(k?.formel).toContain('Arbeitspreis aus dem Strompreis-Tarif')
  })
})
