/**
 * Wetternormierter Vergleich (kWh/Kd) — Komponenten-Hub → Wärme/Klima → Vergleich.
 *
 * **SOLL Wärme/Klima §4.1 „SOLL — Wetternormierung" (SOLL-§9-E8) · §3.3/S2+S3 ·
 * §5 · Style-Guide A6.** Entscheid **K-3**: Die normierte Größe ist eine
 * **Saison**-Größe. Auf der Monatsachse stünden für dieselbe Maschine 3,889
 * (Mai) gegen 0,531 (November) — Faktor 7,3, der nichts über die Wärmepumpe
 * sagt, weil Grundlast und Warmwasser-Beimischung nicht mit den Heizgradtagen
 * skalieren.
 *
 * ⚑ **Warum die Rechen-Proben an der reinen Funktion hängen und nicht am DOM:**
 * Recharts zeichnet in jsdom nichts (`ResponsiveContainer` hat dort Breite 0) —
 * eine Probe gegen Balken-Label oder Tooltip wäre grün, ohne je etwas gemessen
 * zu haben. Dieselbe Lehre wie in `../tag/tagGeraeteSerien.test.tsx`. Was das
 * DOM **wirklich** trägt (Schaltflächen, Grundsätze, Fußzeile), wird gerendert
 * geprüft.
 *
 * Schwesterdateien: `WaermepumpeB3Hub.test.tsx` (Strom-Herkunft derselben
 * Komponente), Backend `test_wp_hub_wetternormierung.py` (die Route).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../ui', async (echt) => ({
  ...(await echt<Record<string, unknown>>()),
}))

import {
  WaermepumpeVergleich, baueSaisonDaten, saisonWertText,
  type JazMonat, type HeizgradtageMonat,
} from './WaermepumpeVergleich'
import { SAISON_FENSTER, SERIEN_PALETTE } from '../../lib'
import type { InvestitionMonatsdaten } from '../../api/investitionen'

const WINTER = SAISON_FENSTER.winter      // Nov · Dez · Jan · Feb
const SOMMER = SAISON_FENSTER.sommer      // Jun · Jul · Aug

const md = (jahr: number, monat: number): InvestitionMonatsdaten => ({
  id: jahr * 100 + monat, jahr, monat,
  verbrauch_daten: {
    strom_heizen_kwh: 300, strom_warmwasser_kwh: 60,
    heizenergie_kwh: 1200, warmwasser_kwh: 150,
  },
}) as unknown as InvestitionMonatsdaten

/** Eine Monatszeile aus dem Layer — F5 (getrennte Strommessung) vorhanden. */
const jaz = (
  jahr: number, monat: number,
  heizStrom: number | null, strom = 999,
): JazMonat => ({
  jahr, monat, wert: heizStrom == null ? null : 4.0, grund: null,
  zaehler_kwh: 1200, nenner_kwh: heizStrom,
  heizen_zaehler_kwh: 1200, heizen_nenner_kwh: heizStrom,
  strom_kwh: strom,
})

const kd = (
  jahr: number, monat: number, wert: number, tage = 30,
): HeizgradtageMonat => ({
  jahr, monat, kd: wert, tage_mit_temperatur: tage, tage_im_monat: tage,
})

/** Der Demo-Fall: Nov + Dez 2025 mit Kd und Heizstrom, Winter 24/25 ohne Kd. */
const DEMO = {
  monatsdaten: [md(2024, 11), md(2024, 12), md(2025, 11), md(2025, 12)],
  jazJeMonat: [
    jaz(2024, 11, 300), jaz(2024, 12, 300),
    jaz(2025, 11, 268.6), jaz(2025, 12, 335.3),
  ],
  heizgradtageJeMonat: [kd(2025, 11, 505.9), kd(2025, 12, 583.7, 31)],
  hatGetrennteStrom: true,
}

const saison = (over: Partial<Parameters<typeof baueSaisonDaten>[0]> = {}) =>
  baueSaisonDaten({
    monatsdaten: DEMO.monatsdaten,
    jazJeMonat: DEMO.jazJeMonat,
    heizgradtageJeMonat: DEMO.heizgradtageJeMonat,
    hatGetrennteStrom: true,
    cfg: WINTER, modus: 'kd', kdAktiv: true, farben: SERIEN_PALETTE,
    ...over,
  })


// ═══ F1 — K-3: der Modus gehört auf die Saison-Achse ════════════════════════

describe('F1 — auf der Monatsachse gibt es „kWh/Kd" nicht (K-3)', () => {
  it('Monate: nur Strom und JAZ; Saison: die dritte Schaltfläche kommt dazu', () => {
    render(<WaermepumpeVergleich {...DEMO} heizgrenzeC={15} />)
    expect(screen.getByRole('button', { name: 'Strom' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'JAZ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'kWh/Kd' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Saison' }))
    expect(screen.getByRole('button', { name: 'kWh/Kd' })).toBeInTheDocument()

    // Zurück auf „Monate" → der Modus fällt auf Strom, die Schaltfläche geht.
    fireEvent.click(screen.getByRole('button', { name: 'kWh/Kd' }))
    fireEvent.click(screen.getByRole('button', { name: 'Monate' }))
    expect(screen.queryByRole('button', { name: 'kWh/Kd' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Strom' }))
      .toHaveAttribute('aria-pressed', 'true')
  })
})


// ═══ F2 — ein Balken, und sein Label sagt, worauf er beruht ════════════════

describe('F2 — die zweite Vollständigkeits-Achse steht im Label', () => {
  it('Winter 25/26: ein Balken 0,55 kWh/Kd, Label „(2/4 · Temp 2/4)"', () => {
    const rows = saison()
    // Winter 24/25 hat vier Monate Gerätedaten, aber keine Kd ⇒ kein Balken.
    expect(rows).toHaveLength(1)
    const [r] = rows
    // (268,6 + 335,3) / (505,9 + 583,7) = 603,9 / 1.089,6 = 0,554…
    expect(r.value).toBe(0.55)
    expect(r.name).toBe('25/26 (2/4 · Temp 2/4)')
    expect(r.vollstaendig).toBe(false)
    expect(r.label).toBe('0,55')
  })

  it('vollständige Saison trägt keinen Zusatz und ist nicht blass', () => {
    const rows = saison({
      monatsdaten: [md(2025, 11), md(2025, 12), md(2026, 1), md(2026, 2)],
      jazJeMonat: [
        jaz(2025, 11, 100), jaz(2025, 12, 100), jaz(2026, 1, 100), jaz(2026, 2, 100),
      ],
      heizgradtageJeMonat: [
        kd(2025, 11, 100), kd(2025, 12, 100, 31), kd(2026, 1, 100, 31), kd(2026, 2, 100, 28),
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('25/26')
    expect(rows[0].vollstaendig).toBe(true)
    expect(rows[0].value).toBe(1)
  })
})


// ═══ F3 — Sommer: der Grund statt einer Null ═══════════════════════════════

describe('F3 — ohne Heizgradtage kein Balken, sondern der Grund', () => {
  it('Fenster Sommer: keine Zeile (nie 0, nie Unendlich)', () => {
    const rows = saison({
      cfg: SOMMER,
      monatsdaten: [md(2025, 6), md(2025, 7), md(2025, 8)],
      jazJeMonat: [jaz(2025, 6, 70), jaz(2025, 7, 70), jaz(2025, 8, 70)],
      heizgradtageJeMonat: [kd(2025, 6, 0), kd(2025, 7, 0, 31), kd(2025, 8, 0, 31)],
    })
    expect(rows).toEqual([])
  })

  it('die Sicht sagt es dem Anwender, statt leer zu bleiben', () => {
    render(<WaermepumpeVergleich
      monatsdaten={[md(2025, 6), md(2025, 7), md(2025, 8), ...DEMO.monatsdaten]}
      jazJeMonat={[jaz(2025, 6, 70), jaz(2025, 7, 70), jaz(2025, 8, 70), ...DEMO.jazJeMonat]}
      heizgradtageJeMonat={[kd(2025, 6, 0), ...DEMO.heizgradtageJeMonat]}
      hatGetrennteStrom heizgrenzeC={15}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Saison' }))
    fireEvent.click(screen.getByRole('button', { name: 'kWh/Kd' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sommer' }))
    expect(screen.getByText(/gibt es keine Heizgradtage/)).toBeInTheDocument()
    expect(screen.getByText(/ohne Aussage/)).toBeInTheDocument()
  })
})


// ═══ F4 — der Zähler ist der Heizstrom, nie der Gesamtstrom ════════════════

describe('F4 — Herkunft des Zählers', () => {
  it('normiert wird `heizen_nenner_kwh`, nicht `strom_kwh`', () => {
    // Derselbe Fall, aber der Gesamtstrom liegt DEUTLICH höher (Warmwasser).
    const rows = saison({
      jazJeMonat: [
        jaz(2025, 11, 268.6, 1000), jaz(2025, 12, 335.3, 1000),
        jaz(2024, 11, 300, 1000), jaz(2024, 12, 300, 1000),
      ],
    })
    expect(rows[0].value).toBe(0.55)
    // Über den Gesamtstrom wären es (1000+1000)/1089,6 = 1,84 — Faktor 3,3.
    expect(rows[0].value).toBeLessThan(1)
    expect(rows[0].herleitung).toBe('603,9 kWh ÷ 1.089,6 Kd')
  })
})


// ═══ F5 — ein Monat geht nur mit BEIDEN Seiten ein ═════════════════════════

describe('F5 — Zähler UND Nenner, sonst gar nicht', () => {
  it('ein Monat mit Kd, aber ohne Heizstrom fällt aus BEIDEN Summen', () => {
    const rows = saison({
      // Dezember hat Heizgradtage, aber keinen getrennt gemessenen Heizstrom.
      jazJeMonat: [
        jaz(2025, 11, 268.6), jaz(2025, 12, null),
        jaz(2024, 11, 300), jaz(2024, 12, 300),
      ],
    })
    expect(rows).toHaveLength(1)
    // Nur November: 268,6 / 505,9 = 0,531 — NICHT 268,6 / 1.089,6 = 0,25.
    expect(rows[0].value).toBe(0.53)
    expect(rows[0].herleitung).toBe('268,6 kWh ÷ 505,9 Kd')
    expect(rows[0].name).toBe('25/26 (2/4 · Temp 1/4)')
  })

  it('ein Monat mit Heizstrom, aber ohne Kd fällt ebenso aus beiden Summen', () => {
    const rows = saison({
      heizgradtageJeMonat: [kd(2025, 11, 505.9)],
    })
    expect(rows[0].value).toBe(0.53)
    expect(rows[0].herleitung).toBe('268,6 kWh ÷ 505,9 Kd')
  })
})


// ═══ F6 — Tooltip: A6, Ergebnis und eingesetzte Werte in einer Zeile ═══════

describe('F6 — der Tooltip zeigt die Herleitung', () => {
  it('„0,55 kWh/Kd · 603,9 kWh ÷ 1.089,6 Kd"', () => {
    const [r] = saison()
    expect(saisonWertText(r.value as number, 'kd', true, r.herleitung))
      .toBe('0,55 kWh/Kd · 603,9 kWh ÷ 1.089,6 Kd')
  })

  it('die anderen Modi bleiben unverändert', () => {
    expect(saisonWertText(3.6, 'jaz', false)).toBe('3,60')
    expect(saisonWertText(1234, 'strom', false)).toBe('1234 kWh')
  })
})


// ═══ F7 — die Fußzeile nennt Heizgrenze und Abgrenzung ═════════════════════

describe('F7 — die Fußzeile erklärt, was da steht', () => {
  it('Heizgrenze, Formel, „nur Heizbetrieb" und die Eingangsregel', () => {
    render(<WaermepumpeVergleich {...DEMO} heizgrenzeC={15} />)
    fireEvent.click(screen.getByRole('button', { name: 'Saison' }))
    fireEvent.click(screen.getByRole('button', { name: 'kWh/Kd' }))
    const fuss = screen.getByText(/Normiert wird nur der Heizbetrieb/)
    expect(fuss).toHaveTextContent('summiert, nicht gemittelt')
    expect(fuss).toHaveTextContent('Warmwasser bleibt außen vor')
    expect(fuss).toHaveTextContent('nur ein, wenn er Heizgradtage und Heizstrom trägt')
    // S6: die Herkunft steht als SoT-Zeile daneben, nicht als freier Absatz —
    // und die Definition steht dort EINMAL (B7: keine Doppelbeschriftung).
    expect(screen.getByText('Heizgradtage')).toBeInTheDocument()
    const herkunft = screen.getByText(/je Tag max\(0; 15 °C − Tagesmittel\)/)
    expect(herkunft).toHaveTextContent('Heizgrenze 15 °C')
    expect(screen.getAllByText(/Heizgrenze 15 °C/)).toHaveLength(1)
  })
})


// ═══ F8 — ohne getrennte Strommessung: kein Modus, aber ein Grund ══════════

describe('F8 — S3 statt einer leeren Schaltfläche', () => {
  it('ohne `heizen_nenner_kwh` fehlt der Modus und der Grund steht da', () => {
    render(<WaermepumpeVergleich
      monatsdaten={DEMO.monatsdaten}
      jazJeMonat={DEMO.jazJeMonat.map((z) => ({
        ...z, heizen_nenner_kwh: null, heizen_zaehler_kwh: null,
      }))}
      heizgradtageJeMonat={DEMO.heizgradtageJeMonat}
      hatGetrennteStrom={false}
      heizgrenzeC={15}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Saison' }))
    expect(screen.queryByRole('button', { name: 'kWh/Kd' })).toBeNull()
    expect(screen.getByText(/nur mit getrennt gemessenem Heizstrom/))
      .toBeInTheDocument()
  })

  it('ohne Temperaturreihe fehlt der Modus und der BACKEND-Grund steht da', () => {
    render(<WaermepumpeVergleich
      monatsdaten={DEMO.monatsdaten}
      jazJeMonat={DEMO.jazJeMonat}
      heizgradtageJeMonat={[]}
      heizgradtageGrund="Für diesen Zeitraum liegt keine gemessene Außentemperatur vor — ohne sie gibt es keine Heizgradtage."
      hatGetrennteStrom
      heizgrenzeC={15}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Saison' }))
    expect(screen.queryByRole('button', { name: 'kWh/Kd' })).toBeNull()
    expect(screen.getByText(/keine gemessene Außentemperatur/)).toBeInTheDocument()
  })

  it('⭐ jüngere Messreihe: der Modus ist da, der Grund ebenso', () => {
    // Der Demo-Fall — Winter 24/25 vollständig gepflegt, aber ohne Temperatur.
    render(<WaermepumpeVergleich
      {...DEMO}
      heizgradtageGrund="Für ältere Zeiträume liegt keine gemessene Außentemperatur vor — die Messreihe beginnt mit 09/2025."
      heizgrenzeC={15}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Saison' }))
    expect(screen.getByRole('button', { name: 'kWh/Kd' })).toBeInTheDocument()
    expect(screen.getByText(/die Messreihe beginnt mit 09\/2025/))
      .toBeInTheDocument()
  })
})


// ═══ Die anderen Modi bleiben, wie sie waren (Regression) ══════════════════

describe('Regression — Strom und JAZ rechnen unverändert', () => {
  it('Strom-Modus summiert den Gesamtstrom des Fensters', () => {
    const rows = saison({ modus: 'strom', kdAktiv: false })
    // Winter 24/25 (4 Monate à 999) und 25/26 (2 Monate à 999).
    expect(rows.map((r) => r.value)).toEqual([1998, 1998])
  })

  it('JAZ-Modus bildet Σ Q / Σ E über das Fenster (SOLL §5)', () => {
    const rows = saison({ modus: 'jaz', kdAktiv: false })
    // 25/26: (1200 + 1200) / (268,6 + 335,3) = 2400 / 603,9 = 3,974…
    expect(rows[1].value).toBe(3.97)
  })
})


// ═══ N-452 — die Fußzeile nennt je Kennzahl, was gezählt ist ═══════════════
//
// **SOLL §3.3/S2.** Der Satz hing allein an `hatGetrennteStrom` und sagte bei
// getrennter Messung in JEDEM Modus „nur Heizung (Warmwasser ausgeklammert)".
// Für die JAZ stimmt das, für den Strom-Balken nicht — der zeigt den
// Gesamtstrom des Geräts (Route-Beleg: `test_wp_hub_wetternormierung.py`,
// `strom_kwh == 300.0` bei 268,6 Heizstrom + 31,4 Warmwasser-Strom).
// **Es ändert sich keine Zahl, nur die Auskunft darüber.**

describe('N-452 — die Fußzeile sagt je Modus, was der Balken zählt', () => {
  const zurSaison = (props: Partial<Parameters<typeof WaermepumpeVergleich>[0]> = {}) => {
    render(<WaermepumpeVergleich {...DEMO} heizgrenzeC={15} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Saison' }))
  }

  it('Strom-Modus mit getrennter Messung: „Gesamtstrom", NICHT „nur Heizung"', () => {
    zurSaison()   // „Strom" ist vorbelegt
    expect(screen.getByRole('button', { name: 'Strom' }))
      .toHaveAttribute('aria-pressed', 'true')
    const fuss = screen.getByText(/Saison-Strom/)
    expect(fuss).toHaveTextContent('Gesamtstrom des Geräts')
    expect(fuss).toHaveTextContent('Heizen + Warmwasser')
    expect(fuss).not.toHaveTextContent('nur Heizung')
    expect(screen.queryByText(/nur Heizung/)).toBeNull()
  })

  it('JAZ-Modus mit getrennter Messung: „nur Heizung"', () => {
    zurSaison()
    fireEvent.click(screen.getByRole('button', { name: 'JAZ' }))
    const fuss = screen.getByText(/Saison-JAZ/)
    expect(fuss).toHaveTextContent('nur Heizung')
    expect(fuss).toHaveTextContent('Warmwasser ausgeklammert')
    expect(fuss).not.toHaveTextContent('Gesamtstrom')
  })

  it('ohne getrennte Messung bleibt der bisherige Strom-Satz', () => {
    zurSaison({
      jazJeMonat: DEMO.jazJeMonat.map((z) => ({
        ...z, heizen_nenner_kwh: null, heizen_zaehler_kwh: null,
      })),
      hatGetrennteStrom: false,
    })
    const fuss = screen.getByText(/Saison-Strom/)
    expect(fuss).toHaveTextContent('inkl. Warmwasser')
    expect(fuss).toHaveTextContent('keine getrennte Strommessung erfasst')
    expect(fuss).not.toHaveTextContent('Gesamtstrom des Geräts')
  })

  it('ohne getrennte Messung sagt auch die JAZ, was sie zusammenfasst', () => {
    zurSaison({
      jazJeMonat: DEMO.jazJeMonat.map((z) => ({
        ...z, heizen_nenner_kwh: null, heizen_zaehler_kwh: null,
      })),
      hatGetrennteStrom: false,
    })
    fireEvent.click(screen.getByRole('button', { name: 'JAZ' }))
    const fuss = screen.getByText(/Saison-JAZ/)
    expect(fuss).toHaveTextContent('alle Funktionen zusammen')
    expect(fuss).not.toHaveTextContent('nur Heizung')
  })
})
