/**
 * N-534 (Frank85, T89667 #349): „Aus HA laden" belegt das Monatsdaten-Formular vor.
 *
 * Das Backend liefert die Basisfelder unter ihrem Datenbanknamen (`einspeisung_kwh`);
 * das Formular suchte bis zum 19.09.2026 die Mapping-Kurzform (`einspeisung`) und fand
 * nichts — seit v2.5.3 kam die Vorbelegung bei jedem Anwender leer an. Den
 * PV-Gesamtzähler der Anlage belegte es nie vor.
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// Dieselbe schmale Umgebung wie `monatsdaten-temperatur-autofill.test.tsx`: ohne
// Investitionen bleibt der Geräte-Zweig aus, das PV-Feld ist dann ein Eingabefeld.
vi.mock('../hooks', () => ({
  useInvestitionen: () => ({ investitionen: [], loading: false }),
  useAktuellerStrompreis: () => ({ strompreis: null }),
}))

vi.mock('../api', () => ({
  wetterApi: { getMonatsdaten: () => Promise.reject(new Error('kein Wetter im Test')) },
  monatsabschlussApi: { getStatus: () => Promise.reject(new Error('kein Status im Test')) },
  investitionenApi: { getMonatsdatenByMonth: () => Promise.resolve([]) },
}))

const MonatsdatenForm = (await import('../components/forms/MonatsdatenForm')).default

const feld = (name: string) => document.querySelector(`input[name="${name}"]`) as HTMLInputElement

// So kommt es aus `haStatisticsApi.getMonatswerte` — DB-Feldnamen, wie das Backend sie liefert.
const haVorausfuellung = {
  jahr: 2023,
  monat: 5,
  monat_name: 'Mai',
  basis: [
    { feld: 'einspeisung_kwh', wert: 1.2 },
    { feld: 'netzbezug_kwh', wert: 345.1 },
    { feld: 'pv_erzeugung_kwh', wert: 16.3 },
  ],
  investitionen: [],
}

describe('Formular-Vorbelegung aus HA (N-534)', () => {
  it('übernimmt Einspeisung, Netzbezug und den PV-Gesamtzähler aus den Backend-Feldnamen', () => {
    render(
      <MonatsdatenForm
        anlageId={1}
        onSubmit={() => Promise.resolve()}
        onCancel={() => {}}
        haVorausfuellung={haVorausfuellung}
      />,
    )
    expect(feld('einspeisung_kwh').value).toBe('1.2')
    expect(feld('netzbezug_kwh').value).toBe('345.1')
    expect(feld('pv_erzeugung_kwh').value).toBe('16.3')
  })

  it('Gegenprobe: mit den alten Kurzformen bliebe alles leer', () => {
    render(
      <MonatsdatenForm
        anlageId={1}
        onSubmit={() => Promise.resolve()}
        onCancel={() => {}}
        haVorausfuellung={{
          ...haVorausfuellung,
          basis: [{ feld: 'einspeisung', wert: 1.2 }, { feld: 'netzbezug', wert: 345.1 }],
        }}
      />,
    )
    expect(feld('einspeisung_kwh').value).toBe('')
    expect(feld('netzbezug_kwh').value).toBe('')
  })
})
