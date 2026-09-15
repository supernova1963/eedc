import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Input from './Input'

/**
 * SoT-Probe zum Autofill-Riegel (`suchfeld`), N-425.
 *
 * Der Anlass ist ein Melderfall, kein Komfortwunsch: Radiocarbonat (simon42
 * T89667 #316/#319) hielt die Einstellungen für kaputt, weil sein Firefox
 * „frank" in das Suchfeld schrieb — jeder der sieben Reiter zeigte dieselbe
 * leere Trefferliste. Nach **jedem** Löschen füllte der Browser sofort nach; er
 * hat sich am Ende beholfen, indem er Autofill global abschaltete.
 *
 * ⚠ Diese Probe misst, was WIR ausliefern — das gerenderte Attribut. Sie misst
 * NICHT, ob ein bestimmter Browser sich daran hält; das ist browserabhängig und
 * von uns nicht geprüft. Ein grüner Lauf hier ist deshalb kein Beleg dafür, dass
 * Radiocarbonats Fall gelöst ist.
 */
describe('ui/Input — Autofill-Riegel für Such- und Filterfelder', () => {
  it('setzt autocomplete="off", wenn das Feld als Suchfeld deklariert ist', () => {
    render(<Input suchfeld aria-label="Suchen" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Suchen')).toHaveAttribute('autocomplete', 'off')
  })

  it('lässt ein Datenfeld unberührt — der Riegel gilt nur, wo er deklariert ist', () => {
    render(<Input aria-label="Zählerstand" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Zählerstand')).not.toHaveAttribute('autocomplete')
  })

  it('ein ausdrückliches autoComplete des Aufrufers gewinnt gegen den SoT', () => {
    // Der SoT setzt den Standard, er nimmt die Entscheidung nicht weg. Ohne
    // diese Reihenfolge (Attribut VOR `{...props}`) wäre der Aufrufer stumm
    // überstimmt — und niemand hätte es gemerkt.
    render(<Input suchfeld autoComplete="on" aria-label="Suchen" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Suchen')).toHaveAttribute('autocomplete', 'on')
  })
})
