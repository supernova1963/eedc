/**
 * N-534: Dialog „Aus HA laden" — die Zeilen entstehen aus den Feldnamen, die das
 * Backend wirklich liefert (`einspeisung_kwh`), nicht aus den Mapping-Kurzformen.
 * Mit den alten Namen (`einspeisung`) wäre jede Zeile leer — genau das Bild seit v2.5.3.
 */
import { describe, expect, it } from 'vitest'
import { haBasisWert, haBasisZeilen } from './haVergleich'

const backendBasis = [
  { feld: 'einspeisung_kwh', label: 'Einspeisung', wert: 1343.91 },
  { feld: 'netzbezug_kwh', label: 'Netzbezug', wert: 10.31 },
  { feld: 'pv_erzeugung_kwh', label: 'PV Erzeugung Gesamt', wert: 16.3 },
]

describe('haBasisZeilen (N-534)', () => {
  it('liefert je geliefertem Feld eine Zeile mit HA-Wert und lokalem Wert über den DB-Feldnamen', () => {
    const zeilen = haBasisZeilen(backendBasis, { einspeisung_kwh: 1343.9, netzbezug_kwh: 10.3, pv_erzeugung_kwh: null })
    expect(zeilen).toEqual([
      { feld: 'einspeisung_kwh', label: 'Einspeisung', vorhanden: 1343.9, haWert: 1343.91 },
      { feld: 'netzbezug_kwh', label: 'Netzbezug', vorhanden: 10.3, haWert: 10.31 },
      { feld: 'pv_erzeugung_kwh', label: 'PV Erzeugung Gesamt', vorhanden: null, haWert: 16.3 },
    ])
  })

  it('zeigt den PV-Gesamtzähler, den der alte Dialog gar nicht kannte', () => {
    expect(haBasisZeilen(backendBasis, {}).map((z) => z.label)).toContain('PV Erzeugung Gesamt')
  })

  it('Gegenprobe: die Mapping-Kurzform findet nichts — so entstand das Strich-Bild', () => {
    const alt = backendBasis.find((b) => b.feld === 'einspeisung')
    expect(alt).toBeUndefined()
    expect(haBasisWert(backendBasis, 'einspeisung')).toBe('')
    expect(haBasisWert(backendBasis, 'einspeisung_kwh')).toBe('1343.91')
  })

  it('verträgt eine fehlende Monatsdaten-Zeile', () => {
    expect(haBasisZeilen(backendBasis, null)[0]).toEqual({ feld: 'einspeisung_kwh', label: 'Einspeisung', vorhanden: null, haWert: 1343.91 })
  })
})
