import { describe, it, expect } from 'vitest'
import { baueMonatKpis } from './MonatBilanz'
import { baueJahrKpis } from './JahrBilanz'
import { aktuellerMonat } from '../test/factories'
import type { KpiStripItem } from '../components/blocks'

/**
 * A6 — *Netto-Ertrag*, *Monats-/Jahresergebnis* und *Performance Ratio* nennen
 * ihre eingesetzten Werte (Fund N-365).
 *
 * ## Die Regel
 *
 * Style-Guide **A6**: *„Formel + eingesetzte Werte + Datenquelle/Zeitraum."*
 * Die fünf Kacheln hier trugen bis zum 13.09.2026 **nur** die Formel — „Einspeise-
 * Erlös + Eigenverbrauchs-Ersparnis" ohne die beiden Beträge, aus denen die Summe
 * entstanden ist, und einen Monats-Ø ohne seine Grundgesamtheit.
 *
 * ## Warum die Zahlen aus der Response kommen und nicht hier gerechnet werden
 *
 * Bauform aus `fa270c6f`: die Herleitung nennt die Zahlen, mit denen der Layer
 * gerechnet hat. Für die PR ist das entscheidend — `performance_ratio_tage` ist
 * `len(pr_werte)`, NICHT `tage_mit_daten`; mit dem falschen Nenner stünde neben
 * dem Ø eine Grundgesamtheit, die er nie benutzt hat. Die letzte Probe hält
 * genau das fest.
 */
const finde = (ks: KpiStripItem[], titel: string) => {
  const k = ks.find((x) => x.title === titel)
  expect(k, `Kachel „${titel}" muss es geben`).toBeDefined()
  return k!
}

const GELD = {
  einspeise_erloes_euro: 148.2,
  ev_ersparnis_euro: 96.4,
  netto_ertrag_euro: 244.6,
  gesamtnettoertrag_euro: 310.5,
  betriebskosten_anteilig_euro: 41.67,
  sonstige_netto_euro: 12.3,
}

describe('A6 — Cockpit/Monat nennt die eingesetzten Werte', () => {
  it('Netto-Ertrag zeigt beide Summanden einzeln und das Ergebnis', () => {
    const k = finde(baueMonatKpis(aktuellerMonat(2026, 8, GELD), null), 'Netto-Ertrag')
    expect(k.formel).toBe('Einspeise-Erlös + Eigenverbrauchs-Ersparnis')
    expect(k.berechnung).toBe('148,20 € Einspeise-Erlös + 96,40 € Eigenverbrauchs-Ersparnis')
    expect(k.ergebnis).toBe('= 244,60 €')
  })

  it('fehlt ein Summand, steht KEINE Rechnung da (kein „0,00 €")', () => {
    // Zweite Regelhälfte, eigene Probe: die erste wäre auch grün, wenn ein
    // fehlender Eingang als 0 € erschiene — eine Rechnung, die der Layer nie
    // angestellt hat. Präzedenz: `MonatBilanz` baut keine Rechnung aus „—".
    const k = finde(
      baueMonatKpis(aktuellerMonat(2026, 8, { ...GELD, ev_ersparnis_euro: null }), null),
      'Netto-Ertrag',
    )
    expect(k.formel).toBe('Einspeise-Erlös + Eigenverbrauchs-Ersparnis')
    expect(k.berechnung).toBeUndefined()
    expect(k.ergebnis).toBeUndefined()
  })

  it('Monatsergebnis nennt alle drei Posten einzeln', () => {
    const k = finde(baueMonatKpis(aktuellerMonat(2026, 8, GELD), null), 'Monatsergebnis')
    expect(k.berechnung).toBe('310,50 € − 41,67 € + 12,30 €')
    // Die Rechnung muss auf die Zahl daneben führen: 310,50 − 41,67 + 12,30.
    expect(k.value).toBe('281,13')
    expect(k.ergebnis).toBe('= 281,13 €')
  })

  it('ohne Gesamt-Nettoertrag bleibt die Monatsergebnis-Rechnung leer', () => {
    const k = finde(
      baueMonatKpis(aktuellerMonat(2026, 8, { ...GELD, gesamtnettoertrag_euro: null }), null),
      'Monatsergebnis',
    )
    expect(k.berechnung).toBeUndefined()
    expect(k.ergebnis).toBeUndefined()
  })

  it('Performance Ratio nennt die Zahl der Tage, über die gemittelt wurde', () => {
    const k = finde(baueMonatKpis(aktuellerMonat(2026, 8, GELD), null, 0.82, 17), 'Performance Ratio')
    expect(k.value).toBe('0,82')
    expect(k.berechnung).toBe('Ø aus 17 Tagen mit Einstrahlungsdaten')
  })

  it('EIN Tag heißt „Tag", nicht „Tagen"', () => {
    const k = finde(baueMonatKpis(aktuellerMonat(2026, 8, GELD), null, 0.9, 1), 'Performance Ratio')
    expect(k.berechnung).toBe('Ø aus 1 Tag mit Einstrahlungsdaten')
  })

  it('ohne gelieferte Tageszahl steht der Ø ohne Grundgesamtheit da, statt einer erfundenen', () => {
    // ⭐ Der eigentliche Gegenstand: `tage_mit_daten` ist ein ANDERER Nenner
    // (Tage mit irgendwelchen Daten). Wer ihn hier einsetzte, schriebe eine
    // Grundgesamtheit hin, die der Ø nie benutzt hat. Fehlt die Zahl, bleibt
    // die Herleitung leer — die Kachel selbst bleibt sichtbar.
    const k = finde(baueMonatKpis(aktuellerMonat(2026, 8, GELD), null, 0.82, null), 'Performance Ratio')
    expect(k.value).toBe('0,82')
    expect(k.berechnung).toBeUndefined()
  })
})

describe('A6 — Cockpit/Jahr nennt dieselben Werte', () => {
  it('Netto-Ertrag und Jahresergebnis tragen ihre Summanden', () => {
    // Andere Zahlen als im Monat, damit die Probe nicht zufällig grün ist,
    // wenn jemand den Monats-Strip zurückgibt.
    const jahr = {
      einspeise_erloes_euro: 1780.4,
      ev_ersparnis_euro: 1160.9,
      netto_ertrag_euro: 2941.3,
      gesamtnettoertrag_euro: 3722.0,
      betriebskosten_anteilig_euro: 500.04,
      sonstige_netto_euro: 148.5,
    }
    const ks = baueJahrKpis(aktuellerMonat(2026, 12, jahr), null)
    expect(finde(ks, 'Netto-Ertrag').berechnung)
      .toBe('1.780,40 € Einspeise-Erlös + 1.160,90 € Eigenverbrauchs-Ersparnis')
    expect(finde(ks, 'Netto-Ertrag').ergebnis).toBe('= 2.941,30 €')
    const erg = finde(ks, 'Jahresergebnis')
    expect(erg.berechnung).toBe('3.722,00 € − 500,04 € + 148,50 €')
    expect(erg.value).toBe('3.370,46')
    expect(erg.ergebnis).toBe('= 3.370,46 €')
  })
})
