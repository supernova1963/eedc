/**
 * Das Wetter-Auto-Fill des Monatsformulars — eine Regel für drei Felder (**N-426**).
 *
 * **Was hier auf dem Spiel steht.** Der Feld-Hinweis versprach seit dem
 * IA-V4-Flip (25.07.2026) „Wird automatisch von Open-Meteo geholt", während der
 * Knopf zwei von drei Wetterfeldern füllte — die Temperatur blieb leer. Der
 * Entscheid vom 11.09.2026 lautet: das Feld wird wieder gefüllt, und zwar
 * bevorzugt aus der eigenen Messreihe der Anlage (die Route entscheidet das,
 * `test_wetter_monatstemperatur_n426.py`); der Client übernimmt, was sie liefert,
 * und sagt dem Anwender, woher es kommt.
 *
 * ⭐ **Nachbesserung vom 13.09.2026 (Entscheid Gernot): alle drei Felder füllen
 * nur Lücken.** Bis dahin überschrieben Globalstrahlung und Sonnenstunden auch
 * einen getippten Wert — drei Felder, drei Verhalten. Maßgeblich ist für alle
 * die Hausregel des Formulars: „ein selbst eingetragener Wert … wird nie
 * automatisch überschrieben" (P3b, `lib/erfassungZustand.ts`; ebenso der
 * Prefill-Block in `MonatsdatenForm.tsx`). Der Feld-Hinweis der Globalstrahlung
 * versprach das ohnehin schon („…, wenn nicht manuell gepflegt") — die Regel
 * macht ihn wahr, statt ihn umschreiben zu müssen. Wer ersetzen will, leert das
 * Feld und klickt erneut.
 *
 * ⚠ **Jedes Feld hat seine eigene Klausel**, obwohl eine Liste sie alle drei
 * trägt: Eine Regel, die für drei Felder gelten soll, ist erst geprüft, wenn
 * jedes einzeln geprüft ist — genau die Lehre aus dem Bestand, in dem dieselbe
 * Sektion drei Verhalten hatte.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { WetterDaten } from '../api/wetter'

// ── Die Umgebung der Form, so schmal wie möglich ────────────────────────────
// Ohne Investitionen bleibt der ganze Geräte-Zweig aus; geprüft wird der
// Wetter-Block, und der hängt an keiner Investition.

const wetterAntwort = vi.fn<() => Promise<WetterDaten>>()

vi.mock('../hooks', () => ({
  useInvestitionen: () => ({ investitionen: [], loading: false }),
  useAktuellerStrompreis: () => ({ strompreis: null }),
}))

vi.mock('../api', () => ({
  wetterApi: { getMonatsdaten: () => wetterAntwort() },
  monatsabschlussApi: { getStatus: () => Promise.reject(new Error('kein Status im Test')) },
  investitionenApi: { getMonatsdatenByMonth: () => Promise.resolve([]) },
}))

const MonatsdatenForm = (await import('../components/forms/MonatsdatenForm')).default

/** Basis-Antwort der Wetter-Route; die Klauseln variieren nur die Temperatur. */
function antwort(teil: Partial<WetterDaten> = {}): WetterDaten {
  return {
    jahr: 2025,
    monat: 1,
    globalstrahlung_kwh_m2: 30.5,
    sonnenstunden: 44,
    durchschnittstemperatur_c: 5.4,
    temperatur_herkunft: 'messung',
    datenquelle: 'open-meteo',
    standort: { latitude: 48.1, longitude: 11.6 },
    abdeckung_prozent: 100,
    provider_info: { name: 'Open-Meteo Archive' },
    ...teil,
  }
}

function zeigeForm() {
  render(
    <MonatsdatenForm
      anlageId={1}
      onSubmit={() => Promise.resolve()}
      onCancel={() => {}}
    />,
  )
  // `variant="erweitert"` startet eingeklappt — der Block muss auf, sonst gäbe
  // es die Felder gar nicht im DOM und jede Zusicherung liefe ins Leere.
  fireEvent.click(screen.getByRole('button', { name: /Wetterdaten \(optional\)/ }))
}

const feld = (name: string) =>
  document.querySelector(`input[name="${name}"]`) as HTMLInputElement

const autoFill = () => screen.getByRole('button', { name: /Auto-Fill/ })

beforeEach(() => {
  wetterAntwort.mockReset()
  wetterAntwort.mockResolvedValue(antwort())
})

describe('Auto-Fill der Ø-Temperatur (N-426)', () => {
  it('setzt das leere Feld aus der Antwort der Route', async () => {
    zeigeForm()
    // Vorbedingung: ohne sie prüfte die Klausel einen Wert, der schon dastand.
    expect(feld('durchschnittstemperatur').value).toBe('')

    fireEvent.click(autoFill())

    await waitFor(() => {
      expect(feld('durchschnittstemperatur').value).toBe('5.4')
    })
    // Gegenprobe: derselbe Klick füllt weiterhin die zwei Nachbarfelder — sonst
    // bewiese ein grüner Lauf nur, dass irgendetwas passiert ist.
    expect(feld('globalstrahlung_kwh_m2').value).toBe('30.5')
    expect(feld('sonnenstunden').value).toBe('44')
  })

  it('nennt die Herkunft, wenn der Wert aus der eigenen Messung stammt', async () => {
    zeigeForm()
    fireEvent.click(autoFill())

    expect(
      await screen.findByText(/Ø Temperatur aus den gemessenen Außentemperaturen des Monats/),
    ).toBeTruthy()
  })

  it('nennt den Wetterdienst, wenn keine Messung vorlag', async () => {
    wetterAntwort.mockResolvedValue(
      antwort({ temperatur_herkunft: 'open-meteo', durchschnittstemperatur_c: 2.1 }),
    )
    zeigeForm()
    fireEvent.click(autoFill())

    await waitFor(() => {
      expect(feld('durchschnittstemperatur').value).toBe('2.1')
    })
    expect(await screen.findByText(/Ø Temperatur von Open-Meteo Archive/)).toBeTruthy()
    // Die Gegenrichtung derselben Klausel: „gemessen" darf hier NICHT stehen.
    expect(screen.queryByText(/gemessenen Außentemperaturen/)).toBeNull()
  })

  it('lässt einen selbst eingetragenen Ø-Temperatur-Wert stehen', async () => {
    zeigeForm()
    fireEvent.change(feld('durchschnittstemperatur'), { target: { value: '-3.2' } })
    expect(feld('durchschnittstemperatur').value).toBe('-3.2')

    fireEvent.click(autoFill())

    // Der Klick muss gewirkt haben — sonst prüfte die Klausel nichts.
    await waitFor(() => {
      expect(feld('globalstrahlung_kwh_m2').value).toBe('30.5')
    })
    expect(feld('durchschnittstemperatur').value).toBe('-3.2')
    expect(
      await screen.findByText(/Ø Temperatur unverändert — der eingetragene Wert bleibt stehen/),
    ).toBeTruthy()
  })

  it('lässt einen selbst eingetragenen Globalstrahlungs-Wert stehen', async () => {
    // Eigene Klausel, nicht als Variante der Temperatur mitgeprüft: Bis zur
    // Nachbesserung überschrieb genau DIESES Feld bedingungslos.
    zeigeForm()
    fireEvent.change(feld('globalstrahlung_kwh_m2'), { target: { value: '12.7' } })

    fireEvent.click(autoFill())

    // Beleg, dass der Klick gewirkt hat: das Nachbarfeld wurde gefüllt.
    await waitFor(() => {
      expect(feld('sonnenstunden').value).toBe('44')
    })
    expect(feld('globalstrahlung_kwh_m2').value).toBe('12.7')
    expect(
      await screen.findByText(/Globalstrahlung unverändert — der eingetragene Wert bleibt stehen/),
    ).toBeTruthy()
  })

  it('lässt einen selbst eingetragenen Sonnenstunden-Wert stehen', async () => {
    zeigeForm()
    fireEvent.change(feld('sonnenstunden'), { target: { value: '9' } })

    fireEvent.click(autoFill())

    await waitFor(() => {
      expect(feld('globalstrahlung_kwh_m2').value).toBe('30.5')
    })
    expect(feld('sonnenstunden').value).toBe('9')
    expect(
      await screen.findByText(/Sonnenstunden unverändert — der eingetragene Wert bleibt stehen/),
    ).toBeTruthy()
  })

  it('fasst Übernommenes und Behaltenes in einem Satz zusammen', async () => {
    // Die Hausform, an der die drei Klauseln oben hängen — hier einmal ganz,
    // damit die Aufzählung („A und B") selbst eine Probe hat.
    zeigeForm()
    fireEvent.change(feld('durchschnittstemperatur'), { target: { value: '-3.2' } })

    fireEvent.click(autoFill())

    expect(
      await screen.findByText(
        /Globalstrahlung und Sonnenstunden übernommen, Ø Temperatur unverändert — der eingetragene Wert bleibt stehen/,
      ),
    ).toBeTruthy()
  })

  it('nennt Bright Sky als Messung des DWD, nicht als Schätzung', async () => {
    // Der Sonst-Zweig las „Geschätzte Durchschnittswerte" — für eine deutsche
    // Anlage ist Bright Sky aber die Voreinstellung, und der DWD misst.
    wetterAntwort.mockResolvedValue(
      antwort({
        datenquelle: 'brightsky',
        provider_info: { name: 'Bright Sky (DWD)' },
      }),
    )
    zeigeForm()
    fireEvent.click(autoFill())

    expect(await screen.findByText(/Messwerte des DWD \(Bright Sky\)/)).toBeTruthy()
    expect(screen.queryByText(/Geschätzte Durchschnittswerte/)).toBeNull()
  })

  it('lässt das übernommene Feld editierbar', async () => {
    zeigeForm()
    fireEvent.click(autoFill())
    await waitFor(() => {
      expect(feld('durchschnittstemperatur').value).toBe('5.4')
    })

    const eingabe = feld('durchschnittstemperatur')
    expect(eingabe.readOnly).toBe(false)
    expect(eingabe.disabled).toBe(false)

    fireEvent.change(eingabe, { target: { value: '7.8' } })
    expect(feld('durchschnittstemperatur').value).toBe('7.8')
  })

  it('lässt das Feld leer, wenn die Antwort keine Temperatur trägt', async () => {
    // Realer Fall: der PVGIS-/Defaults-Weg führt gar keine Temperatur, und für
    // den LAUFENDEN Monat ist er der einzige. Ein „undefined" im Feld wäre
    // schlimmer als eine Lücke.
    wetterAntwort.mockResolvedValue(
      antwort({ durchschnittstemperatur_c: undefined, temperatur_herkunft: undefined }),
    )
    zeigeForm()
    fireEvent.click(autoFill())

    await waitFor(() => {
      expect(feld('sonnenstunden').value).toBe('44')
    })
    expect(feld('durchschnittstemperatur').value).toBe('')
    // Kein Satz über die Temperatur im Quellen-Hinweis. Bewusst mit Verb
    // geankert: „Ø Temperatur" allein ist auch das FELD-Label und träfe immer.
    expect(screen.queryByText(/Ø Temperatur (aus|von|unverändert)/)).toBeNull()
  })
})
