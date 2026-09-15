import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { baueKomponentenBloecke } from './KomponentenSektionen'
import {
  balkenSegmente, herkunftText, kostenZeilen, mehrereGeraete, segmentLabel,
  verteilungHinweise, verteilungTitel, verteilungVerlaufDaten, zeigtVerteilung,
} from './waermeVerteilung'
import type { ParkApi } from '../components/park'
import type { AktuellerMonatResponse } from '../api/aktuellerMonat'
import type { VerteilungVerlauf } from '../api/energie_profil'
import { aktuellerMonat } from '../test/factories'

/**
 * **Verteilung & Verlauf** — die Client-Hälfte von WK-16c.
 *
 * Der Blockteil zeigt, **wohin** der Wärme/Klima-Strom gegangen ist: je Gerät
 * und Funktion als Anteile, mit Kosten je Funktion und demselben Satz Segmente
 * als Verlauf über die Perioden.
 *
 * ⛔ **Hier wird nichts gerechnet.** Mengen, Anteile, Herkunft und Kosten kommen
 * fertig aus dem Backend; diese Datei prüft Farbe, Reihenfolge, Beschriftung und
 * das, was die Sicht **nicht** behauptet: eine Periode ohne Aufteilung trägt
 * `null` statt 0, ein Segment ohne Verlaufsmenge wird nicht als Reihe von
 * Nullen gezeichnet, und die Differenzen werden **genannt**.
 *
 * Schwesterdatei: Backend `test_wk16c_verteilung_verlauf.py`.
 */

const NOOP: ParkApi = {
  aktiv: false, istGeparkt: () => false, park: () => {}, entparke: () => {},
  zuruecksetzen: () => {}, geparkt: [], registriere: () => () => {}, parkbareAnzahl: 0,
}

/** Die Lage der Demo r28 im Januar: Wärmepumpe (F5) + Split-Klimaanlage. */
const V: VerteilungVerlauf = {
  sicht: 'monat', stufe: 'tag',
  segmente: [
    { schluessel: '1:heizen', funktion: 'heizen', funktion_label: 'Heizen',
      geraet: 'Daikin', investition_id: 1, kwh: 343.3, anteil_prozent: 80.5,
      herkunft: 'gemessen', preis_cent: 30, kosten_euro: 102.99 },
    { schluessel: '1:warmwasser', funktion: 'warmwasser', funktion_label: 'Warmwasser',
      geraet: 'Daikin', investition_id: 1, kwh: 36.7, anteil_prozent: 8.6,
      herkunft: 'gemessen', preis_cent: 30, kosten_euro: 11.01 },
    { schluessel: '2:heizen', funktion: 'heizen', funktion_label: 'Heizen',
      geraet: 'Bosch', investition_id: 2, kwh: 37.5, anteil_prozent: 8.8,
      herkunft: 'gemessen', preis_cent: 30, kosten_euro: 11.25 },
    { schluessel: '2:ohne_modus', funktion: 'ohne_modus', funktion_label: 'Ohne Modus',
      geraet: 'Bosch', investition_id: 2, kwh: 9.2, anteil_prozent: 2.2,
      herkunft: 'rest', preis_cent: 30, kosten_euro: 2.76 },
  ],
  perioden: [
    { schluessel: '2025-01-01', label: '1',
      kwh_je_segment: { '1:heizen': 11.0, '2:heizen': 1.2 },
      temperatur_c: 2.0, wetter_symbol: 'sunny' },
    { schluessel: '2025-01-02', label: '2', kwh_je_segment: {},
      temperatur_c: 1.0, wetter_symbol: null },
  ],
  menge_kwh: 426.7, aufgeteilt_kwh: 426.7, kosten_gesamt_euro: 128.01,
  verlauf_kwh: 12.2, ohne_stundenform_kwh: null,
}

const fmt = (n: number | null | undefined, stellen = 0) =>
  n == null ? '—' : n.toFixed(stellen)

describe('waermeVerteilung — die reinen Regeln', () => {
  it('ein Segment heißt „Gerät · Funktion", sobald es mehr als ein Gerät gibt', () => {
    expect(mehrereGeraete(V)).toBe(true)
    expect(segmentLabel(V.segmente[0], true)).toBe('Daikin · Heizen')
    // Bei einer einzigen Wärmepumpe wäre der Gerätename in jeder Zeile
    // dasselbe Wort — er bliebe weg.
    expect(segmentLabel(V.segmente[0], false)).toBe('Heizen')
    expect(mehrereGeraete({ ...V, segmente: [V.segmente[0]] })).toBe(false)
  })

  it('der Balken sortiert nach FUNKTION, dann nach Gerät', () => {
    // ⭐ Die Reihenfolge ist die Antwort auf „eine Rolle, eine Farbe": Beide
    // Heizen-Segmente tragen denselben Ton und stehen deshalb NEBENEINANDER —
    // der farbige Block liest sich als *Heizen*, die Zeilen nennen die Geräte.
    expect(balkenSegmente(V).map((s) => s.label)).toEqual([
      'Daikin · Heizen', 'Bosch · Heizen', 'Daikin · Warmwasser', 'Bosch · Ohne Modus',
    ])
    const farben = balkenSegmente(V).map((s) => s.farbe)
    expect(farben[0]).toBe(farben[1])            // dieselbe Rolle, dieselbe Farbe
    expect(farben[2]).not.toBe(farben[0])
  })

  it('die Kostentabelle trägt Herkunft, Preis und Kosten — und keine kWh', () => {
    const zeilen = kostenZeilen(V)
    expect(zeilen).toHaveLength(4)
    expect(zeilen[0]).toMatchObject({
      label: 'Daikin · Heizen', herkunft: 'gemessen', preisCent: 30, kostenEuro: 102.99,
    })
    // Ein Rest ist weder gemessen noch abgeleitet — er ist die Differenz.
    expect(zeilen.find((z) => z.label === 'Bosch · Ohne Modus')!.herkunft).toBe('Differenz')
    expect(Object.keys(zeilen[0])).not.toContain('kwh')
  })

  it('herkunftText nennt einen Rest nicht „gemessen"', () => {
    expect(herkunftText('gemessen')).toBe('gemessen')
    expect(herkunftText('abgeleitet')).toBe('abgeleitet')
    expect(herkunftText('rest')).toBe('Differenz')
  })

  it('eine Periode ohne Aufteilung trägt null, nicht 0', () => {
    const d = verteilungVerlaufDaten(V)
    // Der 1. trägt Mengen, der 2. gar keine — ein Balken der Höhe 0 sähe aus
    // wie „nichts gelaufen", während die Kachel darüber Strom zeigt (P4).
    expect(d.rows[0]['1:heizen']).toBe(11)
    expect(d.rows[1]['1:heizen']).toBeNull()
  })

  it('ein Segment ohne Verlaufsmenge wird nicht als Reihe von Nullen gezeichnet', () => {
    const d = verteilungVerlaufDaten(V)
    // Warmwasser und „Ohne Modus" stehen in der Verteilung, aber in keiner
    // Periode — der Verlauf kennt sie nicht (andere Quelle, Konzept Kap. 6.3).
    expect(d.stapel.map((s) => s.key)).toEqual(['1:heizen', '2:heizen'])
  })

  it('die Temperatur ist eine Linie auf der zweiten Achse, das Wetter eine Symbolreihe', () => {
    const d = verteilungVerlaufDaten(V)
    expect(d.linien).toHaveLength(1)
    expect(d.linien[0]).toMatchObject({ key: 'temperatur', achse: 'rechts' })
    expect(d.rows[0].temperatur).toBe(2)
    // Nur Perioden MIT Code tragen ein Symbol — kein Symbol ist besser als ein
    // erfundenes (der Default-Fall von `WetterIcon` ist eine Sonne).
    expect(d.wetterSymbole).toEqual({ '1': 'sunny' })
    expect(d.hatWetter).toBe(true)
  })

  it('ohne Temperaturwerte gibt es keine Linie — und keine 0-°C-Kurve', () => {
    const ohne = { ...V, perioden: V.perioden.map((p) => ({ ...p, temperatur_c: null })) }
    const d = verteilungVerlaufDaten(ohne)
    expect(d.linien).toHaveLength(0)
    expect(d.hatTemperatur).toBe(false)
    expect(d.rows[0].temperatur).toBeUndefined()
  })

  it('die drei Differenzen bekommen drei verschiedene Sätze (W-8)', () => {
    // 1 · ein Gerät ohne jede Aufteilung (W-17b)
    expect(verteilungHinweise({ ...V, menge_kwh: 600 }, fmt).map((z) => z.label))
      .toContain('Aufgeteilte Menge')
    // 2 · der Verlauf kommt aus einer anderen Quelle als die Verteilung
    expect(verteilungHinweise(V, fmt).map((z) => z.label)).toContain('Im Verlauf erfasst')
    // 3 · was keine Stundenform hatte (P4)
    expect(verteilungHinweise({ ...V, ohne_stundenform_kwh: 1.5 }, fmt).map((z) => z.label))
      .toContain('Strom ohne Stundenzuordnung')
    // Und: wo es nichts zu nennen gibt, steht auch nichts.
    expect(verteilungHinweise(
      { ...V, menge_kwh: 426.7, verlauf_kwh: 426.7 }, fmt,
    )).toHaveLength(0)
  })

  it('ohne Segment gibt es den Blockteil nicht', () => {
    expect(zeigtVerteilung(V)).toBe(true)
    expect(zeigtVerteilung({ ...V, segmente: [] })).toBe(false)
    expect(zeigtVerteilung(null)).toBe(false)
  })

  it('der Titel nennt die Auflösung (W-8)', () => {
    expect(verteilungTitel(V)).toBe('Verteilung & Verlauf · je Tag')
    expect(verteilungTitel({ ...V, stufe: 'stunde' })).toBe('Verteilung & Verlauf · je Stunde')
    expect(verteilungTitel({ ...V, stufe: 'monat' })).toBe('Verteilung & Verlauf · je Monat')
  })
})

describe('Verteilung & Verlauf im Block', () => {
  const d = (over: Partial<AktuellerMonatResponse> = {}) => aktuellerMonat(2026, 8, over)

  function bloecke(v: VerteilungVerlauf | null) {
    return baueKomponentenBloecke(
      d({ wp_strom_kwh: 426.7, wp_waerme_kwh: 1500 }),
      NOOP, 'monat', null, null, null, v,
    )
  }

  it('der Blockteil hängt als parkbares Element im Wärme/Klima-Block', () => {
    const block = bloecke(V).find((b) => b.id === 'k-waermepumpe')
    expect(block, 'Wärme/Klima-Block muss entstehen').toBeDefined()
    render(<>{block!.render(false)}</>)
    // ⚠ Er trägt die Anteile, die Kosten und die Summe — dietmar1968s Donut
    // plus Kostentabelle, in der Bildsprache dieses Produkts.
    // ⚠ Zweimal, und das ist die Bauform: einmal als Zeile des Balkens (mit
    // kWh und Anteil), einmal als Zeile der Kostentabelle (mit Herkunft und
    // Preis). Zwei Fragen an dieselbe Größe — sie zusammenzulegen hieße, eine
    // Tabelle mit sechs Spalten zu bauen.
    expect(screen.getAllByText('Daikin · Heizen')).toHaveLength(2)
    expect(screen.getByText('102,99')).toBeInTheDocument()
    expect(screen.getByText('Summe')).toBeInTheDocument()
    expect(screen.getByText('128,01')).toBeInTheDocument()
  })

  it('ohne Verteilung fehlt genau dieser Blockteil und sonst nichts', () => {
    const block = bloecke(null).find((b) => b.id === 'k-waermepumpe')
    expect(block).toBeDefined()
    render(<>{block!.render(false)}</>)
    expect(screen.queryAllByText('Daikin · Heizen')).toHaveLength(0)
    // Der übrige Block steht unverändert da.
    expect(screen.getByText('Strom verbraucht')).toBeInTheDocument()
  })
})
