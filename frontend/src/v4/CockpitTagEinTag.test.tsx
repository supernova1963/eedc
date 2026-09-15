/**
 * Cockpit → Tag zeigt EINEN Tag — die Regel für beide Tages-Abfragen.
 *
 * Die Sicht lädt ihre Zahlen aus **zwei** Abfragen mit denselben Abhängigkeiten
 * (`[anlageId, datum]`): die Tages-Werte (Kacheln, Bilanz, Stunden) und den
 * Wärme/Klima-Verlauf. Sie laufen parallel und kommen nicht gemeinsam an —
 * ohne eine gemeinsame Regel steht der Verlauf des NEUEN Tages unter den
 * Kacheln des ALTEN, und die Überschrift nennt schon den neuen Tag, während
 * die Zahlen darunter noch dem alten gehören.
 *
 * Die vier Proben halten je eine Klausel dieser Regel:
 *  1. **Paarung** — kein Wert des neuen Tages, solange die Kacheln alt sind.
 *  2. **Vorhalt** — der Verlauf des angezeigten Tages bleibt beim Blättern stehen
 *     (er verschwindet nicht, nur weil ein anderer Tag lädt).
 *  3. **Kopf** — Überschrift und Zustands-Badge nennen den Tag der ZAHLEN, der
 *     gewählte Tag steht als Lade-Marker daneben.
 *  4. **Nachlauf** — sobald die Tages-Werte da sind, wechselt die ganze Sicht.
 *
 * Aufbau: `getStunden` für den Ziel-Tag wird angehalten — die Tages-Abfrage
 * hängt damit als Ganzes (sie ist ein `Promise.all` aus dreien). Der Verlauf
 * desselben Tages antwortet **sofort**: genau die Reihenfolge, die die Mischung
 * erzeugte. Probe ② hält zusätzlich den Verlauf an; nur dann ist zu sehen, dass
 * der alte Tag vollständig stehen bleibt, statt ein Loch zu zeigen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import type { StundenAntwort, WaermeVerlaufStunden } from '../api/energie_profil'

const TAG_A = '2026-06-11'   // Donnerstag — der angezeigte Tag
const TAG_B = '2026-06-12'   // Freitag — der gewählte Tag, dessen Werte hängen

/** PV-Erzeugung je Tag → Block-Zusammenfassung „n kWh PV". */
const PV_KWH: Record<string, number> = { [TAG_A]: 11, [TAG_B]: 22 }
/** Rest ohne Stundenzuordnung je Tag → Zeile „x,x kWh" unter dem Verlauf. */
const REST_KWH: Record<string, number> = { [TAG_A]: 1.1, [TAG_B]: 2.2 }

const H = vi.hoisted(() => ({
  /** Datum → Auflöser der angehaltenen Antwort, je Abruf. */
  wartend: new Map<string, () => void>(),
  wartendVerlauf: new Map<string, () => void>(),
  /** Für diese Tage antwortet der jeweilige Abruf erst auf Zuruf. */
  angehalten: new Set<string>(),
  angehaltenVerlauf: new Set<string>(),
}))

function stundenAntwort(): StundenAntwort {
  return {
    stunden: Array.from({ length: 24 }, (_, h) => ({
      stunde: h, pv_kw: h >= 8 && h <= 16 ? 2 : 0, verbrauch_kw: 1,
      einspeisung_kw: 0, netzbezug_kw: 1, batterie_kw: 0, waermepumpe_kw: 0.2,
      wallbox_kw: 0, ueberschuss_kw: 0, defizit_kw: 0,
      temperatur_c: 15, globalstrahlung_wm2: 200, soc_prozent: null, komponenten: null,
      wp_starts_anzahl: null, wp_betriebsstunden: null,
    })),
    serien: [],
  } as unknown as StundenAntwort
}

/** Verlauf ohne Stapel und ohne gemessene Wärme: kein Chart (jsdom), aber die
 *  Rest-Zeile — sie trägt den Einzelwert, an dem der Tag erkennbar ist. */
function waermeVerlauf(datum: string): WaermeVerlaufStunden {
  return {
    stunden: Array.from({ length: 24 }, (_, h) => ({
      stunde: h, wp_strom_kwh: 0.2, wp_waerme_kwh: null,
      wp_modus_strom_heizen_kwh: null, wp_modus_strom_warmwasser_kwh: null,
      wp_modus_strom_kuehlen_kwh: null, wp_modus_strom_lueften_kwh: null,
      wp_modus_strom_entfeuchten_kwh: null, wp_modus_nicht_aufgeteilt_kwh: null,
      wp_modus_strom_bezug_kwh: null, wp_modus_abdeckung_h: null, wp_modus_gemessen: null,
    })),
    ohne_stundenform_kwh: REST_KWH[datum] ?? null,
  }
}

vi.mock('../api/energie_profil', () => ({
  energieProfilApi: {
    getStunden: vi.fn((_id: number, datum: string) => {
      if (!H.angehalten.has(datum)) return Promise.resolve(stundenAntwort())
      return new Promise<StundenAntwort>((res) => {
        H.wartend.set(datum, () => res(stundenAntwort()))
      })
    }),
    getTageWerte: vi.fn(() => Promise.resolve([
      tagWerte(TAG_A, { erzeugung: PV_KWH[TAG_A] }),
      tagWerte(TAG_B, { erzeugung: PV_KWH[TAG_B] }),
    ])),
    getVerfuegbareMonate: vi.fn(() => Promise.resolve([])),
    getTagDetail: vi.fn((_id: number, datum: string) => Promise.resolve({
      datum, wp_strom_heizen_kwh: 3.0, wp_strom_warmwasser_kwh: 1.2,
    })),
    getWaermeVerlaufStunden: vi.fn((_id: number, datum: string) => {
      if (!H.angehaltenVerlauf.has(datum)) return Promise.resolve(waermeVerlauf(datum))
      return new Promise<WaermeVerlaufStunden>((res) => {
        H.wartendVerlauf.set(datum, () => res(waermeVerlauf(datum)))
      })
    }),
  },
}))

import CockpitTagV4 from './CockpitTagV4'
import { renderMitProvidern, stubMatchMedia } from '../test/render'
import { tagWerte as tagWerteBasis } from '../test/factories'
import { _clearSwrCacheForTests } from '../hooks/useApiData'
import type { TagWerte } from '../api/energie_profil'

function tagWerte(datum: string, over: Partial<TagWerte>): TagWerte {
  return tagWerteBasis(datum, {
    stunden_verfuegbar: 24, datenquelle: 'HA',
    eigenverbrauch: 8, einspeisung: 3, netzbezug: 5, gesamtverbrauch: 13,
    direktverbrauch: 6, autarkie: 62, evQuote: 40,
    wp_strom: 4.2,
    ...over,
  })
}

/** Alle fälligen Zusagen einlösen (Mikro- und Makro-Warteschlange). */
async function ruhe() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

describe('Cockpit → Tag: Kacheln und Wärme/Klima-Verlauf gehören demselben Tag', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia()
    _clearSwrCacheForTests()
    H.wartend.clear()
    H.wartendVerlauf.clear()
    H.angehalten.clear()
    H.angehaltenVerlauf.clear()
    vi.clearAllMocks()
  })

  /** Sicht auf TAG_A öffnen, Blöcke aufklappen, dann auf TAG_B blättern. Dessen
   *  Tages-Werte hängen immer; `verlaufHaengt` hält zusätzlich seinen Verlauf an
   *  (dann steht der alte Tag vollständig — sonst antwortet der Verlauf des
   *  neuen Tages zuerst, genau die Reihenfolge, die die Mischung erzeugte). */
  async function blaettereAufB(verlaufHaengt = false) {
    H.angehalten.add(TAG_B)
    if (verlaufHaengt) H.angehaltenVerlauf.add(TAG_B)
    renderMitProvidern(<CockpitTagV4 anlageId={1} />, { route: `/v4/cockpit/tag?datum=${TAG_A}` })
    expect(await screen.findByText(/11 kWh PV/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('alle aufklappen'))
    expect(await screen.findByText('1,1 kWh')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'nächster Tag mit Daten' })[0])
    await ruhe()
  }

  it('① Paarung: der Verlauf des gewählten Tages erscheint NICHT unter den alten Kacheln', async () => {
    await blaettereAufB()
    // Die Kacheln stehen noch auf dem alten Tag …
    expect(screen.getByText(/11 kWh PV/)).toBeInTheDocument()
    // … also darf die Rest-Zeile des neuen Tages nirgends stehen.
    expect(screen.queryByText('2,2 kWh')).not.toBeInTheDocument()
  })

  it('② Vorhalt: der Verlauf des angezeigten Tages bleibt stehen, während der neue lädt', async () => {
    await blaettereAufB(true)
    // Beide Abfragen des neuen Tages hängen ⇒ der alte Tag steht vollständig:
    // seine Kacheln UND sein Verlauf — kein Loch im Block, kein Skeleton.
    expect(screen.getByText(/11 kWh PV/)).toBeInTheDocument()
    expect(screen.getByText('1,1 kWh')).toBeInTheDocument()
  })

  it('③ Kopf: Überschrift nennt den Tag der Zahlen, der gewählte Tag steht als Lade-Marker daneben', async () => {
    await blaettereAufB()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Donnerstag, 11. Juni 2026')
    expect(screen.getByText('lädt 12.06.2026 …')).toBeInTheDocument()
  })

  it('④ Nachlauf: sobald die Tages-Werte da sind, wechselt die ganze Sicht auf den neuen Tag', async () => {
    await blaettereAufB(true)
    await act(async () => { H.wartendVerlauf.get(TAG_B)!(); H.wartend.get(TAG_B)!() })
    await ruhe()
    expect(await screen.findByText(/22 kWh PV/)).toBeInTheDocument()
    expect(screen.getByText('2,2 kWh')).toBeInTheDocument()
    expect(screen.queryByText('1,1 kWh')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Freitag, 12. Juni 2026')
    expect(screen.queryByText(/^lädt /)).not.toBeInTheDocument()
  })
})
