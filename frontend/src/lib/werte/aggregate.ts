/**
 * Footer-Aggregation der Werte-Tabelle: pro Metrik Summe (`sum`), Durchschnitt
 * (`avg`) oder mengengewichteter Durchschnitt (`gewichtet`, Gewicht = Spalte
 * `gewicht`); `none` → null. null-Werte werden übersprungen, leere
 * Spalte → null. Verhaltensgleich aus `TabelleTab.aggregateRows`, jetzt
 * granularitäts-agnostisch über `WerteZeile`.
 */
import type { WerteMetrik } from './registry'
import type { WerteZeile } from './zeile'

export function aggregiere(
  rows: WerteZeile[],
  metriken: WerteMetrik[],
): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const m of metriken) {
    const vals = rows
      .map((r) => r.wert(m.key))
      .filter((v): v is number => v != null)
    if (vals.length === 0) {
      result[m.key] = null
      continue
    }
    if (m.aggregation === 'sum') result[m.key] = vals.reduce((s, v) => s + v, 0)
    else if (m.aggregation === 'avg') result[m.key] = vals.reduce((s, v) => s + v, 0) / vals.length
    else if (m.aggregation === 'gewichtet' && m.gewicht) {
      // Mengengewichtet (A-1): nur Zeilen, die Wert UND Gewicht tragen; ohne
      // Gewicht (Σ = 0) gibt es keinen Ø — null, nicht 0.
      let zaehler = 0, nenner = 0
      for (const r of rows) {
        const v = r.wert(m.key); const w = r.wert(m.gewicht)
        if (v == null || w == null || w <= 0) continue
        zaehler += v * w; nenner += w
      }
      result[m.key] = nenner > 0 ? zaehler / nenner : null
    }
    else result[m.key] = null
  }
  return result
}
