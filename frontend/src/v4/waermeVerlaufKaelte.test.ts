/**
 * Bauschnitt 6b — die Kälte-Linie (Konzept Wärme/Klima §8: eigene Rolle, eigene
 * Linie, eigene Farbe) und die Rest-Zeilen je Größe (N-437, Entscheid E6 (a)).
 *
 * Schwesterdateien: `waermeVerlauf.test.ts` (Jahr), `waermeVerlaufMonat.test.ts`,
 * `waermeVerlaufTag.test.ts`. ⚠ Bewusst NICHT am gerenderten Chart: Recharts
 * zeichnet in jsdom nichts (N-424).
 */
import { describe, it, expect } from 'vitest'
import { CHART_COLORS } from '../lib'
import type { AktuellerMonatResponse } from '../api/aktuellerMonat'
import type { WaermeVerlaufTag, WaermeVerlaufStunde, StundenWert } from '../api/energie_profil'
import {
  baueWaermeVerlauf, punkteAusMonatsantworten, punkteAusVerlaufsTagen,
  verlaufRestZeilen, verlaufTitel, zeigtVerlauf, type WaermeVerlaufPunkt,
} from './waermeVerlauf'
import { baueTagWaermeVerlauf } from './TagKomponenten'

const punkt = (over: Partial<WaermeVerlaufPunkt> = {}): WaermeVerlaufPunkt => ({
  name: '1', wp_strom_kwh: 10, wp_waerme_kwh: 30, wp_waerme_abgeleitet_kwh: null,
  wp_modus_strom_heizen_kwh: 6, wp_modus_strom_kuehlen_kwh: 3, wp_modus_nicht_aufgeteilt_kwh: 1,
  wp_modus_gemessen: true, wp_modus_abdeckung_h: 0, wp_modus_strom_bezug_kwh: 10,
  ...over,
})

describe('Kälte-Linie — eigene Rolle (P7′)', () => {
  it('zeichnet gemessene Kälte als eigene Linie in eigener Farbe', () => {
    const v = baueWaermeVerlauf([punkt({ wp_kaelte_kwh: 9 }), punkt({ name: '2', wp_kaelte_kwh: 4 })])
    const linie = v.linien.find((l) => l.key === 'kaelte')

    expect(v.hatGemesseneKaelte).toBe(true)
    expect(linie?.farbe).toBe(CHART_COLORS.kaelteGemessen)
    // Nicht der Ton des Kühlen-Segments, über dem die Linie liegt.
    expect(linie?.farbe).not.toBe(CHART_COLORS.modusKuehlen)
    expect(linie?.achse).toBeUndefined() // kWh-Achse, nicht die °C-Achse
    expect(v.rows.map((r) => r.kaelte)).toEqual([9, 4])
  })

  it('mischt die Kälte nie in die Wärme', () => {
    const v = baueWaermeVerlauf([punkt({ wp_waerme_kwh: 30, wp_kaelte_kwh: 9 })])
    expect(v.rows[0].waerme).toBe(30)
  })

  it('setzt eine Periode ohne Kälte auf null — eine Lücke, keine Null', () => {
    const v = baueWaermeVerlauf([punkt({ wp_kaelte_kwh: 9 }), punkt({ name: '2', wp_kaelte_kwh: 0 }),
      punkt({ name: '3', wp_kaelte_kwh: null })])
    expect(v.rows.map((r) => r.kaelte)).toEqual([9, null, null])
  })

  it('lässt die Linie ganz weg, wenn keine Periode Kälte trägt', () => {
    const v = baueWaermeVerlauf([punkt(), punkt({ name: '2' })])
    expect(v.hatGemesseneKaelte).toBe(false)
    expect(v.linien.some((l) => l.key === 'kaelte')).toBe(false)
    expect('kaelte' in v.rows[0]).toBe(false)
  })
})

describe('Durchreichung — Jahr, Monat, Tag (P8′)', () => {
  it('Jahr: die Monatsantworten tragen die Kälte in die Punkte, nach Monat sortiert', () => {
    const antworten = [
      { monat: 8, wp_kaelte_kwh: 40, wp_waerme_kwh: null },
      { monat: 7, wp_kaelte_kwh: 55, wp_waerme_kwh: null },
    ] as unknown as AktuellerMonatResponse[]
    const p = punkteAusMonatsantworten(antworten, new Map([[7, 21.5]]), (m) => `M${m}`)

    expect(p.map((x) => [x.name, x.wp_kaelte_kwh, x.temperatur_c])).toEqual([
      ['M7', 55, 21.5], ['M8', 40, null],
    ])
  })

  it('Monat: die Tageszeilen tragen die Kälte in die Punkte', () => {
    const tage = [{ datum: '2025-07-03', wp_kaelte_kwh: 6.5, wp_waerme_kwh: null }] as unknown as WaermeVerlaufTag[]
    const p = punkteAusVerlaufsTagen(tage)
    expect(p[0].name).toBe('3')
    expect(p[0].wp_kaelte_kwh).toBe(6.5)
    expect(p[0].wp_waerme_abgeleitet_kwh).toBeNull()
  })

  it('Tag: die Stunden tragen die Kälte in die Punkte', () => {
    const zeilen = [{ stunde: 14, wp_kaelte_kwh: 1.2 }] as unknown as WaermeVerlaufStunde[]
    const p = baueTagWaermeVerlauf(zeilen, [] as StundenWert[])
    expect(p[0].wp_kaelte_kwh).toBe(1.2)
  })
})

describe('Tor, Titel, Rest je Größe (P9′)', () => {
  const nurKaelte = baueWaermeVerlauf([punkt({
    wp_waerme_kwh: null, wp_kaelte_kwh: 7, wp_modus_gemessen: false, wp_modus_abdeckung_h: 0,
  })])

  it('eine Anlage mit Kältezähler, ohne Aufteilung und ohne Wärme bekommt einen Verlauf', () => {
    expect(nurKaelte.hatStapel).toBe(false)
    expect(zeigtVerlauf(nurKaelte, null)).toBe(true)
    expect(verlaufTitel(nurKaelte)).toBe('Verlauf · gemessene Kälte')
  })

  it('nennt im Titel, was drinsteht', () => {
    expect(verlaufTitel(baueWaermeVerlauf([punkt()]))).toBe('Verlauf · Strom nach Betriebsart und gemessene Wärme')
    expect(verlaufTitel(baueWaermeVerlauf([punkt({ wp_kaelte_kwh: 3 })])))
      .toBe('Verlauf · Strom nach Betriebsart, gemessene Wärme und Kälte')
  })

  it('zeigt das Element auch, wenn NUR ein Rest da ist (S3)', () => {
    const leer = baueWaermeVerlauf([punkt({
      wp_waerme_kwh: null, wp_modus_gemessen: false, wp_modus_abdeckung_h: 0,
    })])
    expect(zeigtVerlauf(leer, null)).toBe(false)
    expect(zeigtVerlauf(leer, { kaelte: 6 })).toBe(true)
  })

  it('beschriftet jeden Rest mit seiner Größe und lässt Rundungsreste weg', () => {
    expect(verlaufRestZeilen({ strom: 1.2, waerme: 5, kaelte: 0.01 })).toEqual([
      { label: 'Strom ohne Stundenzuordnung', kwh: 1.2 },
      { label: 'Wärme ohne Stundenzuordnung', kwh: 5 },
    ])
    expect(verlaufRestZeilen(null)).toEqual([])
  })
})
