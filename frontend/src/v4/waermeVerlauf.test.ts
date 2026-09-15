/**
 * Der Wärme/Klima-Verlauf (Konzept §8, Bauschnitt 1) — an der reinen Funktion.
 *
 * ⚠ Bewusst NICHT am gerenderten Chart: Recharts zeichnet in jsdom nichts, eine
 * Probe am DOM wäre grün, ohne etwas zu messen (N-424, Sitzung 193).
 */
import { describe, it, expect } from 'vitest'
import { baueWaermeVerlauf, type WaermeVerlaufPunkt } from './waermeVerlauf'
import { CHART_COLORS } from '../lib'

/** Ein Monat mit gemessener Aufteilung und gemessener Wärme. */
const monat = (name: string, over: Partial<WaermeVerlaufPunkt> = {}): WaermeVerlaufPunkt => ({
  name,
  wp_strom_kwh: 100,
  wp_waerme_kwh: 300,
  wp_waerme_abgeleitet_kwh: 0,
  wp_modus_strom_heizen_kwh: 60,
  wp_modus_strom_kuehlen_kwh: 20,
  wp_modus_nicht_aufgeteilt_kwh: 20,
  wp_modus_gemessen: true,
  wp_modus_strom_bezug_kwh: 100,
  ...over,
})

describe('baueWaermeVerlauf — Stapel', () => {
  it('bildet je Periode eine Zeile mit den Segmenten des Aufteilungs-Balkens', () => {
    const d = baueWaermeVerlauf([monat('Jan'), monat('Feb')])
    expect(d.rows.map((r) => r.name)).toEqual(['Jan', 'Feb'])
    expect(d.stapel.map((s) => s.key)).toEqual(['heizen', 'kuehlen', 'rest'])
    expect(d.rows[0].heizen).toBe(60)
    expect(d.hatStapel).toBe(true)
  })

  it('zeigt Warmwasser/Lüften/Entfeuchten nur mit eigenem Zähler (E4)', () => {
    const ohne = baueWaermeVerlauf([monat('Jan')])
    expect(ohne.stapel.map((s) => s.key)).not.toContain('lueften')

    const mit = baueWaermeVerlauf([monat('Jan', { wp_modus_strom_lueften_kwh: 5 })])
    expect(mit.stapel.map((s) => s.key)).toContain('lueften')
  })

  it('trägt für eine Periode OHNE Aufteilung null statt 0 — ein Nullbalken sähe aus wie „nichts gelaufen"', () => {
    const d = baueWaermeVerlauf([
      monat('Jan'),
      monat('Feb', { wp_modus_gemessen: false, wp_modus_abdeckung_h: 0 }),
    ])
    expect(d.rows[1].heizen).toBeNull()
    expect(d.rows[1].rest).toBeNull()
  })

  it('lässt den Stapel ganz weg, wenn KEINE Periode eine Aufteilung hat (F2) — wie der Balken darüber', () => {
    const d = baueWaermeVerlauf([
      monat('Jan', { wp_modus_gemessen: false, wp_modus_abdeckung_h: 0 }),
    ])
    expect(d.hatStapel).toBe(false)
    expect(d.stapel).toEqual([])
  })

  it('nennt die Grundmenge des Stapels — Bezug, NICHT der Kachel-Strom (W-17b)', () => {
    // Eine Wärmepumpe ohne Modus-Sensor neben einer Klimaanlage mit: der
    // Stapel beschreibt nur die zweite. Genau dietmars Fall (30 gegen 284 kWh).
    const d = baueWaermeVerlauf([monat('Jan', { wp_strom_kwh: 284, wp_modus_strom_bezug_kwh: 30 })])
    expect(d.stromKwh).toBe(284)
    expect(d.bezugKwh).toBe(30)
  })
})

describe('baueWaermeVerlauf — Wärmelinie (E7)', () => {
  it('zeigt gemessene Wärme als eigene Serie mit eigener Farbe', () => {
    const d = baueWaermeVerlauf([monat('Jan')])
    expect(d.linien).toHaveLength(1)
    expect(d.rows[0].waerme).toBe(300)
    // ⛔ NICHT `wpWaerme` — das ist in dieser Fläche die Funktion „Heizen"
    // und läge unlesbar auf dem gleichfarbigen Segment.
    expect(d.linien[0].farbe).toBe(CHART_COLORS.waermeGemessen)
    expect(d.linien[0].farbe).not.toBe(d.stapel.find((s) => s.key === 'heizen')!.farbe)
  })

  it('zieht den ABGELEITETEN Anteil ab, statt am Flag zu hängen', () => {
    // Wärmepumpe mit Wärmemengenzähler (280 gemessen) + Klimaanlage ohne (20
    // gerechnet). Das Flag `wp_waerme_abgeleitet` wäre hier TRUE — wer danach
    // ausblendet, verliert 280 kWh gemessene Wärme.
    const d = baueWaermeVerlauf([monat('Jan', { wp_waerme_kwh: 300, wp_waerme_abgeleitet_kwh: 20 })])
    expect(d.rows[0].waerme).toBe(280)
    expect(d.hatGemesseneWaerme).toBe(true)
  })

  it('lässt die Linie weg, wenn die Wärme VOLLSTÄNDIG gerechnet ist', () => {
    // Strom × Arbeitszahl — die Linie hätte exakt die Form der Stromfläche.
    const d = baueWaermeVerlauf([monat('Jan', { wp_waerme_kwh: 350, wp_waerme_abgeleitet_kwh: 350 })])
    expect(d.hatGemesseneWaerme).toBe(false)
    expect(d.linien).toEqual([])
    expect(d.rows[0].waerme).toBeUndefined()
  })

  it('setzt für einen einzelnen gerechneten Monat null — die Linie bricht dort, statt zu verbinden', () => {
    const d = baueWaermeVerlauf([
      monat('Jan'),
      monat('Feb', { wp_waerme_kwh: 200, wp_waerme_abgeleitet_kwh: 200 }),
      monat('Mär'),
    ])
    expect(d.rows.map((r) => r.waerme)).toEqual([300, null, 300])
  })

  it('kommt ohne Aufteilung aus — Wärme allein trägt den Verlauf', () => {
    const d = baueWaermeVerlauf([
      monat('Jan', { wp_modus_gemessen: false, wp_modus_abdeckung_h: 0 }),
    ])
    expect(d.hatStapel).toBe(false)
    expect(d.hatGemesseneWaerme).toBe(true)
  })
})

describe('baueWaermeVerlauf — Außentemperatur', () => {
  it('legt die Temperatur auf die ZWEITE Achse, per Legende abwählbar', () => {
    const d = baueWaermeVerlauf([monat('Jan', { temperatur_c: 2.4 })])
    const temp = d.linien.find((l) => l.key === 'temperatur')!
    expect(temp.achse).toBe('rechts')
    expect(temp.farbe).toBe(CHART_COLORS.temperatur)
    expect(d.rows[0].temperatur).toBe(2.4)
  })

  it('lässt die Linie ganz weg, wenn keine Periode einen Wert hat', () => {
    const d = baueWaermeVerlauf([monat('Jan')])
    expect(d.hatTemperatur).toBe(false)
    expect(d.linien.map((l) => l.key)).not.toContain('temperatur')
  })

  it('setzt für einen Monat ohne Messreihe null — nicht 0 °C', () => {
    // Ein kalter Monat ohne Spur ist kein Monat am Gefrierpunkt; eine 0 zöge
    // die Linie sichtbar nach unten und sähe aus wie eine Messung.
    const d = baueWaermeVerlauf([
      monat('Jan', { temperatur_c: 2.4 }),
      monat('Feb'),
      monat('Mär', { temperatur_c: 7.1 }),
    ])
    expect(d.rows.map((r) => r.temperatur)).toEqual([2.4, null, 7.1])
  })
})

