import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { baueKomponentenBloecke } from './KomponentenSektionen'
import { baueTagAlsMonat } from './TagKomponenten'
import type { ParkApi } from '../components/park'
import type { AktuellerMonatResponse } from '../api/aktuellerMonat'
import type { TagDetail } from '../api/energie_profil'
import { aktuellerMonat, tagWerte } from '../test/factories'

/**
 * **WK-16g / R-4 — der Tag sagt, was er abdeckt.**
 *
 * Am ersten Tag nach einer Zuordnung und am laufenden Tag misst eedc nicht von
 * 0 bis 24 Uhr, sondern ab dem ersten bzw. bis zum letzten Stand (N-491). Die
 * Zahl ist dann richtig und **unvollständig** — beides muss dastehen
 * (ADR-002/**P4**: keine Hochrechnung, aber auch kein Verschweigen).
 *
 * ⛔ **Der Client formuliert nichts.** Der Satz kommt fertig aus dem Layer
 * (`core/tageswert_grund.tages_abdeckung_hinweis`); geprüft wird hier nur, dass
 * er **ankommt** und **wo** er steht: an der Basis-Größe *Strom verbraucht*,
 * nicht an jeder abgeleiteten Zahl. Dieselbe Regel, mit der N-472 die Gründe im
 * laufenden Monat verteilt hat — sonst stünde derselbe Satz fünfmal, und das
 * wäre die Strich-Flut, gegen die die D-Sicht gebaut ist.
 */

const NOOP: ParkApi = {
  aktiv: false, istGeparkt: () => false, park: () => {}, entparke: () => {},
  zuruecksetzen: () => {}, geparkt: [], registriere: () => () => {}, parkbareAnzahl: 0,
}

const TAG: Partial<AktuellerMonatResponse> = {
  wp_strom_kwh: 2.16,
  wp_waerme_kwh: 7.8,
  wp_jaz: 3.33,
}

function rendere(over: Partial<AktuellerMonatResponse>) {
  const block = baueKomponentenBloecke(aktuellerMonat(2026, 9, { ...TAG, ...over }), NOOP, 'tag')
    .find((b) => b.id === 'k-waermepumpe')
  expect(block, 'Wärme/Klima-Block muss entstehen').toBeDefined()
  render(<>{block!.render(false)}</>)
}

describe('WK-16g — Abdeckungs-Marke am Tag', () => {
  it('nennt „gemessen ab 11:00 Uhr" unter der Strom-Kachel', () => {
    rendere({ wp_abdeckung_hinweis: 'gemessen ab 11:00 Uhr' })

    expect(screen.getByText('gemessen ab 11:00 Uhr')).toBeInTheDocument()
  })

  it('nennt den Satz GENAU EINMAL, nicht an jeder Kachel', () => {
    rendere({ wp_abdeckung_hinweis: 'gemessen bis 05:00 Uhr' })

    expect(screen.getAllByText('gemessen bis 05:00 Uhr')).toHaveLength(1)
  })

  it('schweigt am vollen Tag — die Gegenprobe', () => {
    rendere({ wp_abdeckung_hinweis: null })

    expect(screen.queryByText(/gemessen (ab|bis) /)).toBeNull()
  })

  it('die Naht: der Tagespfad reicht die Marke durch', () => {
    // ⚑ Ohne diese Probe wäre `TagKomponenten.baueTagAlsMonat` ungedeckt —
    // dieselbe Lücke, die die Schwesterdatei bei N-348 gemessen hat:
    // Rendering-Proben bekommen ihre Daten direkt und bleiben grün, wenn die
    // Durchreichung entfällt (an einem Sprengsatz gemessen, 15.09.2026).
    const d = baueTagAlsMonat(
      tagWerte('2026-09-16', { wp_strom: 2.16 }),
      [], [],
      { wp_abdeckung_hinweis: 'gemessen ab 11:00 Uhr' } as unknown as TagDetail,
    )

    expect(d.wp_abdeckung_hinweis).toBe('gemessen ab 11:00 Uhr')
  })
})
