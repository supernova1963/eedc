/**
 * Der Monats-Verlauf (Konzept §8, Bauschnitt 4) — dieselbe Funktion, x = Tage.
 *
 * ⭐ **Der Gegenstand dieser Datei ist die Period-Agnostik.** `baueWaermeVerlauf`
 * wurde für die Jahressicht geschrieben (Monate auf der x-Achse) und ist
 * ausdrücklich als reine, period-agnostische Funktion angelegt. Ob das trägt,
 * war bis Bauschnitt 4 eine Behauptung — hier steht sie unter Tagesdaten.
 *
 * Schwesterdatei: `waermeVerlauf.test.ts` (dieselbe Funktion mit Monatszeilen).
 *
 * ⚠ Bewusst NICHT am gerenderten Chart: Recharts zeichnet in jsdom nichts
 * (N-424, Sitzung 193).
 */
import { describe, it, expect } from 'vitest'
import { baueWaermeVerlauf, type WaermeVerlaufPunkt } from './waermeVerlauf'

/** Ein Tag, wie ihn `/waerme-verlauf` liefert. */
const tag = (nr: number, over: Partial<WaermeVerlaufPunkt> = {}): WaermeVerlaufPunkt => ({
  name: String(nr),
  wp_strom_kwh: 12,
  wp_waerme_kwh: 36,
  // ⚠ Auf Tagesebene IMMER null — abgeleitete Wärme entsteht an den
  // Monatszeilen (`imd_monatsaggregat`). Der Client sendet das so.
  wp_waerme_abgeleitet_kwh: null,
  wp_modus_strom_heizen_kwh: 8,
  wp_modus_strom_kuehlen_kwh: 2,
  wp_modus_nicht_aufgeteilt_kwh: 2,
  wp_modus_gemessen: true,
  wp_modus_abdeckung_h: 24,
  wp_modus_strom_bezug_kwh: 12,
  temperatur_c: 5,
  ...over,
})

describe('Monats-Verlauf — dieselbe Funktion, andere Zeilen', () => {
  it('baut aus 31 Tagen 31 Zeilen mit den Tagesnummern als Achse', () => {
    const tage = Array.from({ length: 31 }, (_, i) => tag(i + 1))
    const v = baueWaermeVerlauf(tage)

    expect(v.rows).toHaveLength(31)
    expect(v.rows[0].name).toBe('1')
    expect(v.rows[30].name).toBe('31')
    expect(v.hatStapel).toBe(true)
  })

  it('zeichnet die gemessene Wärme, obwohl das Abgeleitet-Feld null ist', () => {
    // ⭐ Der Fall, den die Jahresreihe so nicht kennt: dort steht dort eine
    // Zahl. `null` darf nicht wie „alles abgeleitet" wirken.
    const v = baueWaermeVerlauf([tag(1), tag(2)])

    expect(v.hatGemesseneWaerme).toBe(true)
    expect(v.rows[0].waerme).toBe(36)
    expect(v.linien.some((l) => l.key === 'waerme')).toBe(true)
  })

  it('summiert die Grundmenge über die Tage, nicht über den ganzen Strom', () => {
    // W-17b: `bezugKwh` zählt nur Tage MIT Aufteilung; `stromKwh` alle.
    const v = baueWaermeVerlauf([
      tag(1),
      tag(2, { wp_modus_gemessen: false, wp_modus_abdeckung_h: 0, wp_strom_kwh: 9 }),
    ])

    expect(v.bezugKwh).toBe(12)
    expect(v.stromKwh).toBe(21)
  })

  it('ein Tag ohne Aufteilung trägt null, keinen Balken der Höhe 0', () => {
    const v = baueWaermeVerlauf([
      tag(1),
      tag(2, { wp_modus_gemessen: false, wp_modus_abdeckung_h: 0 }),
    ])

    expect(v.rows[0].heizen).toBe(8)
    expect(v.rows[1].heizen).toBeNull()
  })

  it('ein Tag ohne Wärmemengenzähler ist eine Lücke in der Linie, keine Null', () => {
    // SOLL §3.3/S4: „die Lücke ist die Aussage."
    const v = baueWaermeVerlauf([tag(1), tag(2, { wp_waerme_kwh: null })])

    expect(v.rows[0].waerme).toBe(36)
    expect(v.rows[1].waerme).toBeNull()
  })

  it('die Temperaturlinie kommt mit, und ein Tag ohne Messung zieht sie nicht auf 0', () => {
    const v = baueWaermeVerlauf([tag(1), tag(2, { temperatur_c: null })])

    expect(v.hatTemperatur).toBe(true)
    expect(v.rows[0].temperatur).toBe(5)
    expect(v.rows[1].temperatur).toBeNull()
    expect(v.linien.find((l) => l.key === 'temperatur')?.achse).toBe('rechts')
  })

  it('ohne jede Aufteilung und ohne Wärme gibt es weder Stapel noch Linie', () => {
    const v = baueWaermeVerlauf([
      tag(1, {
        wp_modus_gemessen: false, wp_modus_abdeckung_h: 0, wp_waerme_kwh: null,
      }),
    ])

    expect(v.hatStapel).toBe(false)
    expect(v.hatGemesseneWaerme).toBe(false)
    expect(v.stapel).toEqual([])
  })
})
