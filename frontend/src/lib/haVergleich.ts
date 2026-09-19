/**
 * N-534 (Frank85, T89667 #349): die Vergleichszeilen des Dialogs „Aus HA laden".
 *
 * Das Backend liefert die Basis-Zählerfelder unter ihrem Datenbanknamen
 * (`einspeisung_kwh`, `netzbezug_kwh`, `pv_erzeugung_kwh` — seit v2.5.3,
 * `MAPPING_KEY_TO_DB_FELD`). Der Dialog suchte bis zum 19.09.2026 `einspeisung`
 * und `netzbezug`, fand nie etwas und zeigte bei jedem Anwender „–"; den
 * PV-Gesamtzähler kannte er gar nicht. Deshalb: eine Zeile je geliefertem Feld,
 * der lokale Wert über denselben Datenbanknamen aus der Monatsdaten-Zeile.
 */

export interface HaBasisFeld {
  feld: string
  /** Anzeigename aus dem Backend (`feld_label`); die Formular-Vorbelegung kommt ohne aus. */
  label?: string
  wert: number | null
}

export interface HaBasisZeile {
  feld: string
  label: string
  vorhanden: number | null
  haWert: number | null
}

export function haBasisZeilen(
  basis: HaBasisFeld[],
  vorhandene: Record<string, unknown> | null | undefined,
): HaBasisZeile[] {
  return basis.map((b) => {
    const v = vorhandene ? vorhandene[b.feld] : undefined
    return {
      feld: b.feld,
      label: b.label ?? b.feld,
      vorhanden: typeof v === 'number' ? v : null,
      haWert: b.wert ?? null,
    }
  })
}

/** Der HA-Wert eines Basisfelds für die Formular-Vorbelegung — leer, wenn nicht geliefert. */
export function haBasisWert(basis: HaBasisFeld[] | undefined | null, feld: string): string {
  const found = basis?.find((b) => b.feld === feld)
  return found?.wert !== null && found?.wert !== undefined ? found.wert.toString() : ''
}
