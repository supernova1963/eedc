import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

// Maschinelles Gegenstück zu Style-Guide **A6** („Berechnungs-Transparenz",
// Fund N-365): Wer eine abgeleitete Kennzahl anzeigt, zeigt daneben Formel UND
// eingesetzte Werte. Die Regel gab es seit dem Style-Guide — geprüft wurde sie
// nie, und jede neue Kachel durfte sie brechen, ohne dass ein Gate rot wurde.
//
// Der Prüfer liest den TypeScript-Syntaxbaum und kennt beide Trägerformen
// (Objektschlüssel `formel:` samt Shorthand `{ formel }` und JSX-Attribut
// `formel=`). Begründete Ausnahmen stehen mit Klasse und Begründung in
// `scripts/formel-herleitung-allowlist.json` und schmelzen ab: ein Eintrag ohne
// Gegenstand meldet rot.
const FRONTEND_ROOT = process.cwd()

describe('Berechnungs-Transparenz (Style-Guide A6)', () => {
  it('jede angezeigte Formel nennt ihre eingesetzten Werte oder ist begründete Ausnahme', () => {
    expect(() =>
      execFileSync('node', ['scripts/check-formel-herleitung.mjs'], {
        cwd: FRONTEND_ROOT,
        stdio: 'pipe',
      }),
    ).not.toThrow()
  })
})
