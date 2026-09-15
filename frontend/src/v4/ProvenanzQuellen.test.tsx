/**
 * ProvenanzQuellen — die geteilte „Quellen:"-Zeile (#360).
 *
 * Sichert die Auflöse-Regel selbst (Label-SoT, Dedup, Teilzeitraum-Grenze) und
 * die Abgrenzung E3: die Jahres-Sicht ruft OHNE Monatskontext und bekommt
 * deshalb nie einen Zeitraum ans Badge.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { provenanzQuellen } from './ProvenanzQuellen'
import { JahrHeader } from './JahrRahmen'
import type { AktuellerMonatResponse, DatenquelleInfo } from '../api/aktuellerMonat'
import { aktuellerMonat } from '../test/factories'

const JULI = { start: new Date(2025, 6, 1), tage: 31 }

/** Typgebunden statt `as unknown as`: `zeitpunkt` ist im Vertrag Pflicht, für
 *  diese Tests aber ohne Aussage — der Helfer ergänzt die Nullstellung. */
const quellen = (
  feld_quellen: Record<string, Omit<DatenquelleInfo, 'zeitpunkt'> & { zeitpunkt?: string | null }>,
): AktuellerMonatResponse['feld_quellen'] =>
  Object.fromEntries(Object.entries(feld_quellen).map(([k, v]) => [k, { zeitpunkt: null, ...v }]))

describe('provenanzQuellen', () => {
  it('Roh-Enum → Label aus der SoT-Map, je Quelle genau ein Eintrag', () => {
    const q = provenanzQuellen(quellen({
      pv_erzeugung_kwh: { quelle: 'ha_statistics', konfidenz: 95 },
      netzbezug_kwh: { quelle: 'ha_statistics', konfidenz: 95 },
      einspeisung_kwh: { quelle: 'local_connector', konfidenz: 90 },
    }))
    expect(q.map((e) => e.label)).toEqual(['HA-Statistik', 'Connector'])
    expect(q.every((e) => e.zusatz === undefined)).toBe(true)
  })

  it('Teilabdeckung nur MIT Monatskontext', () => {
    const fq = quellen({
      pv_erzeugung_kwh: {
        quelle: 'local_connector', konfidenz: 90,
        abdeckung_von: '2025-07-28T14:03:00', abdeckung_bis: '2025-07-30T09:12:00',
      },
    })
    expect(provenanzQuellen(fq)[0].zusatz).toBeUndefined()
    expect(provenanzQuellen(fq, JULI)[0].zusatz).toBe('28.–30.07.2025')
  })

  it('fehlendes Bis-Datum → „ab TT.MM.JJJJ" statt halbem Zeitraum', () => {
    const q = provenanzQuellen(quellen({
      pv_erzeugung_kwh: { quelle: 'local_connector', konfidenz: 90, abdeckung_von: '2025-07-28T14:03:00' },
    }), JULI)
    expect(q[0].zusatz).toBe('ab 28.07.2025')
    expect(q[0].titel).toContain('erst ab dem 28.07.2025')
  })

  it('Zeitraum unter einem Tag wird nicht auf 0 gerundet behauptet', () => {
    const q = provenanzQuellen(quellen({
      pv_erzeugung_kwh: {
        quelle: 'local_connector', konfidenz: 90,
        abdeckung_von: '2025-07-30T08:00:00', abdeckung_bis: '2025-07-30T18:00:00',
      },
    }), JULI)
    expect(q[0].titel).toContain('unter 1 von 31 Tagen')
  })

  // ── N-472: die beiden neuen Quellen tragen dieselbe Zeile ─────────────────
  //
  // ⭐ **Hier wird nichts gebaut, und das ist der Punkt.** Der Rückfall setzt
  // `abdeckung_von`/`abdeckung_bis` in genau dem Slot, den diese Zeile seit
  // #360 liest — der Zeitraum-Vorbehalt steht damit ohne eine einzige weitere
  // Client-Stelle da. Was hier geprüft wird, ist dass er wirklich ankommt.

  it('MQTT ab Monatsmitte wird als Teilzeitraum beschriftet (Rückfall)', () => {
    const q = provenanzQuellen(quellen({
      netzbezug_kwh: {
        quelle: 'mqtt_inbound', konfidenz: 91,
        abdeckung_von: '2025-07-14T12:05:00', abdeckung_bis: '2025-07-31T12:00:00',
      },
    }), JULI)

    expect(q[0].label).toBe('MQTT')
    expect(q[0].zusatz).toBe('14.–31.07.2025')
    expect(q[0].titel).toContain('Der Monatsanfang fehlt in dieser Zahl.')
  })

  it('die Tagesebene heißt „Tageswerte" und schweigt, wenn sie den Monat deckt', () => {
    const ab_erstem = provenanzQuellen(quellen({
      pv_erzeugung_kwh: {
        quelle: 'tagesebene', konfidenz: 80,
        abdeckung_von: '2025-07-01T00:00:00', abdeckung_bis: '2025-07-14T00:00:00',
      },
    }), JULI)
    const ab_fuenftem = provenanzQuellen(quellen({
      pv_erzeugung_kwh: {
        quelle: 'tagesebene', konfidenz: 80,
        abdeckung_von: '2025-07-05T00:00:00', abdeckung_bis: '2025-07-14T00:00:00',
      },
    }), JULI)

    expect(ab_erstem[0].label).toBe('Tageswerte')
    expect(ab_erstem[0].zusatz, 'ab dem Ersten ist die Angabe Rauschen').toBeUndefined()
    expect(ab_fuenftem[0].zusatz, 'eine Lücke am Anfang gehört gesagt').toBe('05.–14.07.2025')
  })
})

describe('JahrHeader — E3: kein Zeitraum in der Jahres-Sicht', () => {
  it('Connector-Badge bleibt ohne Zeitraum, auch bei Teilabdeckung', () => {
    const d = aktuellerMonat(2025, 7, {
      feld_quellen: quellen({
        pv_erzeugung_kwh: {
          quelle: 'local_connector', konfidenz: 90,
          abdeckung_von: '2025-07-28T14:03:00', abdeckung_bis: '2025-07-30T09:12:00',
        },
      }),
    })
    render(<JahrHeader jahr={2025} laufend d={d} />)
    expect(screen.getByText('Connector')).toBeInTheDocument()
    expect(screen.queryByText(/Connector \(/)).not.toBeInTheDocument()
  })
})
