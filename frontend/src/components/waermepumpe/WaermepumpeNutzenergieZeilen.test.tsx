/**
 * **R-C (WK-16f, N-398)** — Nutzenergie Lüften/Entfeuchten als Mengenzeile.
 *
 * **E4 bleibt unverändert** (Konzept §5.4, Entscheid Gernot 26.08.2026): Lüften
 * und Entfeuchten bekommen **keine Kennzahl**, weil sie keine Nutzenergie
 * erzeugen, die eedc bewerten könnte. Was sie seit dem 26.08. haben, sind vier
 * zuordenbare Registry-Felder — und bis zum 14.09.2026 hat **niemand** sie
 * gelesen (N-398). Ein Feld, das die Datenquellen-Fläche anbietet und das
 * nirgends erscheint, bricht das Versprechen der Zuordnung still (R-A).
 *
 * Drei Dinge hält diese Datei fest:
 *
 * ⭐ **Die Menge steht neben ihrem Strom** — dieselbe Liste, dieselbe Einheit.
 *
 * ⛔ **Sie ist KEIN Balken-Segment.** Der Balken teilt den **Strom** auf; eine
 * thermische Menge darin wäre dieselbe Zweideutigkeit zweier Familien, an der
 * ein Tester schon einmal zwei Felder addiert hat (#89667/62).
 *
 * ⛔ **Und sie trägt keinen Prozentanteil** — sie ist kein Teil der Stromsumme,
 * auf die sich die Prozente beziehen.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WaermepumpeModusSplit, type ModusSplitDaten } from './WaermepumpeModusSplit'

const BASIS: ModusSplitDaten = {
  gesamt_stromverbrauch_kwh: 400,
  modus_strom_heizen_kwh: 250,
  modus_strom_kuehlen_kwh: 50,
  modus_strom_lueften_kwh: 60,
  modus_strom_entfeuchten_kwh: 40,
  modus_nicht_aufgeteilt_kwh: 0,
  modus_strom_bezug_kwh: 400,
  modus_gemessen: true,
}

describe('R-C — Nutzenergie Lüften/Entfeuchten', () => {
  it('zeigt die Mengen neben ihrem Strom', () => {
    render(<WaermepumpeModusSplit zusammenfassung={{
      ...BASIS,
      modus_nutzenergie_lueften_kwh: 150,
      modus_nutzenergie_entfeuchten_kwh: 90,
    }} />)

    expect(screen.getByText('Nutzenergie Lüften')).toBeInTheDocument()
    expect(screen.getByText('Nutzenergie Entfeuchten')).toBeInTheDocument()
    expect(screen.getByText('150 kWh')).toBeInTheDocument()
    expect(screen.getByText('90 kWh')).toBeInTheDocument()
  })

  it('DIE GEGENPROBE: ohne Zähler steht die Zeile nicht da', () => {
    // D-Sicht: *„Kacheln nur mit Zahl."* Eine 0-Zeile an jeder Wärmepumpe wäre
    // eine Zeile, die für fast jeden nichts sagt (E4: „Wer sie nicht erfasst,
    // sieht sie nicht.").
    render(<WaermepumpeModusSplit zusammenfassung={BASIS} />)

    expect(screen.queryByText('Nutzenergie Lüften')).toBeNull()
    expect(screen.queryByText('Nutzenergie Entfeuchten')).toBeNull()
  })

  it('DER KERN: die Menge ist kein Segment des Strom-Balkens', () => {
    // Der Balken trägt fünf Segmente (Heizen · Kühlen · Lüften · Entfeuchten ·
    // nicht aufgeteilt). Käme die Nutzenergie als sechstes hinzu, stünde eine
    // thermische Menge in einer Strom-Aufteilung — und die Prozente daneben
    // bezögen sich auf eine Summe aus zwei Einheiten.
    //
    // ⚠ Gezählt wird die **Label-Spalte** des Balkens (`VerteilungsBalken`
    // rendert je Segment genau ein `span.w-28` mit der Beschriftung), nicht
    // irgendein Attribut: Ein Zähler, der auch bei 0 Treffern „gleich" sagt,
    // hätte hier nichts gemessen.
    const segmente = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('span.w-28.text-gray-600')).map(
        (n) => n.textContent,
      )

    const ohne = render(<WaermepumpeModusSplit zusammenfassung={BASIS} />)
    const vorher = segmente(ohne.container)
    expect(vorher).toEqual([
      'Heizen', 'Kühlen', 'Lüften', 'Entfeuchten', 'Nicht aufgeteilt',
    ])

    const { container } = render(<WaermepumpeModusSplit zusammenfassung={{
      ...BASIS,
      modus_nutzenergie_lueften_kwh: 150,
      modus_nutzenergie_entfeuchten_kwh: 90,
    }} />)
    expect(segmente(container)).toEqual(vorher)
  })

  it('… und sie trägt keinen Prozentanteil', () => {
    render(<WaermepumpeModusSplit zusammenfassung={{
      ...BASIS,
      modus_nutzenergie_lueften_kwh: 150,
    }} />)
    const zeile = screen.getByText('Nutzenergie Lüften').parentElement

    expect(zeile?.textContent).toContain('150 kWh')
    expect(zeile?.textContent).not.toContain('%')
  })
})
