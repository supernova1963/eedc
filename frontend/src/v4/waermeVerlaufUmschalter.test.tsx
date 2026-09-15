/**
 * Der Umschalter am Wärme/Klima-Verlauf (WK-09 B2, SOLL §3.3/**S2a**).
 *
 * ⭐ **Warum diese Probe am gerenderten DOM steht, obwohl die Schwesterproben es
 * bewusst nicht tun** (`waermeVerlaufTag.test.ts`, N-424): Gegenstand ist hier
 * nicht der Chart, sondern eine **Bedienung** — zwei Knöpfe eines
 * `SegmentControl`. Die rendert jsdom vollständig; nur Recharts zeichnet nicht.
 * Was der Balken enthält, prüft die reine Funktion nebenan.
 *
 * Geprüft: (1) ohne Funktions-Zähler kein Umschalter, (2) mit ihnen beide
 * Sichten schaltbar, (3) der Titel nennt die gerade gestapelte Größe (S2),
 * (4) die Sicht „nach Funktion" macht den Verlauf auch dort sichtbar, wo die
 * Betriebsart-Sicht nichts hat (Sprosse F5).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { baueKomponentenBloecke } from './KomponentenSektionen'
import { baueTagWaermeVerlauf } from './TagKomponenten'
import type { ParkApi } from '../components/park'
import type { WaermeVerlaufStunde } from '../api/energie_profil'
import { aktuellerMonat } from '../test/factories'

const NOOP: ParkApi = {
  aktiv: false, istGeparkt: () => false, park: () => {}, entparke: () => {},
  zuruecksetzen: () => {}, geparkt: [], registriere: () => () => {}, parkbareAnzahl: 0,
}

const zeile = (h: number, over: Partial<WaermeVerlaufStunde> = {}): WaermeVerlaufStunde => ({
  stunde: h,
  wp_strom_kwh: 0.6,
  wp_waerme_kwh: 1.5,
  wp_modus_strom_heizen_kwh: 0.5,
  wp_modus_strom_warmwasser_kwh: 0,
  wp_modus_strom_kuehlen_kwh: 0,
  wp_modus_strom_lueften_kwh: 0,
  wp_modus_strom_entfeuchten_kwh: 0,
  wp_modus_nicht_aufgeteilt_kwh: 0.1,
  wp_modus_strom_bezug_kwh: 0.6,
  wp_modus_abdeckung_h: 24,
  wp_modus_gemessen: true,
  ...over,
})

const MIT_FUNKTION: Partial<WaermeVerlaufStunde> = {
  wp_funktion_strom_heizen_kwh: 0.4,
  wp_funktion_strom_warmwasser_kwh: 0.1,
  wp_funktion_uebrige_kwh: 0.1,
}

function verlaufBlock(zeilen: WaermeVerlaufStunde[]) {
  const d = aktuellerMonat(2025, 7, { wp_strom_kwh: 14.4, wp_waerme_kwh: 36 })
  const bloecke = baueKomponentenBloecke(
    d, NOOP, 'tag', null, baueTagWaermeVerlauf(zeilen, []),
  )
  return bloecke.find((b) => b.id === 'k-waermepumpe')
}

describe('Wärme/Klima-Verlauf — der Umschalter (S2a)', () => {
  it('bietet ohne Funktions-Zähler keinen Umschalter an', () => {
    const block = verlaufBlock([zeile(6), zeile(7)])
    expect(block).toBeDefined()
    render(<>{block!.render(false)}</>)
    expect(screen.getByText(/Strom nach Betriebsart/)).toBeInTheDocument()
    expect(screen.queryByText('nach Funktion')).toBeNull()
  })

  it('schaltet mit Funktions-Zählern zwischen beiden Sichten — und nennt sie im Titel', () => {
    const block = verlaufBlock([zeile(6, MIT_FUNKTION), zeile(7, MIT_FUNKTION)])
    render(<>{block!.render(false)}</>)
    // Voreingestellt bleibt die heutige Sicht.
    expect(screen.getByText(/Strom nach Betriebsart/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('nach Funktion'))
    expect(screen.getByText(/Strom nach Funktion/)).toBeInTheDocument()
    // ⛔ Und nie beides: der Titel nennt genau eine Familie.
    expect(screen.queryByText(/Strom nach Betriebsart/)).toBeNull()
    // Zurück geht es auch.
    fireEvent.click(screen.getByText('nach Betriebsart'))
    expect(screen.getByText(/Strom nach Betriebsart/)).toBeInTheDocument()
  })

  it('zeigt den Verlauf auch, wenn NUR die Funktions-Sicht etwas hat (F5)', () => {
    const nurFunktion = zeile(6, {
      ...MIT_FUNKTION,
      wp_modus_gemessen: false, wp_modus_abdeckung_h: 0, wp_waerme_kwh: null,
    })
    const block = verlaufBlock([nurFunktion, zeile(7, {
      ...MIT_FUNKTION,
      wp_modus_gemessen: false, wp_modus_abdeckung_h: 0, wp_waerme_kwh: null,
    })])
    render(<>{block!.render(false)}</>)
    // Der Umschalter steht da, obwohl die Betriebsart-Sicht leer ist …
    expect(screen.getByText('nach Funktion')).toBeInTheDocument()
    fireEvent.click(screen.getByText('nach Funktion'))
    expect(screen.getByText(/Strom nach Funktion/)).toBeInTheDocument()
  })
})
