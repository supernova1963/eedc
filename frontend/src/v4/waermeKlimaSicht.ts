/**
 * Die **D-Sicht** des Wärme/Klima-Blocks als reine Funktionen — Konzept
 * Wärme/Klima §6 (Entscheid Gernot, 14.09.2026).
 *
 * *„Das release ich so nicht."* — Cockpit → Monat zeigte vier Striche mit
 * Grund-Texten, während dietmar1968s eigenes Dashboard auf derselben Datenlage
 * überall Zahlen zeigt. Beide Zahlen waren richtig; der Unterschied war die Form.
 *
 * **Die Regel in zwei Sätzen.** Der Block zeigt Kacheln und Zeilen **nur mit
 * Zahl**. Was die **Ausstattung** nicht hergibt, steht einmal je Sicht im Kasten
 * *„Was noch möglich wäre"*; was die Ausstattung hergibt und in **diesem
 * Zeitraum** leer ist, bleibt ein „—" ohne Text.
 *
 * ⛔ **Diese Datei klassifiziert nichts.** Ob ein Grund zur Ausstattung oder zum
 * Zeitraum gehört, entscheidet die Grund-Konstante im Layer
 * (`waermepumpe_kennzahl.GRUND_KLASSE`); der Client **fragt nur ab**, ob das
 * Backend die Größe in den Kasten gelegt hat. Eine zweite Klassifizierung hier
 * wäre dieselbe Aussage an zwei Orten — die W-3-Klasse, die auf dieser Fläche
 * schon dreimal teuer war.
 *
 * ⚠ **Abgefragt wird über den GRÖSSEN-NAMEN, nicht über den Grund-Text.** Die
 * Tages-Route reicht an der Wärme-Kachel die **Kurzform** eines W-18-Grundes in
 * den Kasten, während unter der Kachel die **Langform** steht: Ein Textvergleich
 * hätte dort nie getroffen, und zwar still. Ein Name ist ein Schlüssel, ein Satz
 * ist eine Formulierung.
 */
import type { WpGeraetZeile, WpMoeglichZeile } from '../api/aktuellerMonat'

/** Die beiden Wärme-Achsen — Spiegel des Kanons (`core/betriebsmodus.py`,
 *  `WAERME_ACHSEN`) und des Feldes `WpGeraetZeile.achsen`. */
export const ACHSE = {
  heizen: 'heizen',
  warmwasser: 'warmwasser',
} as const

export type AchsenName = typeof ACHSE[keyof typeof ACHSE]

/** Was in einer Zelle der Tabelle „Zahlen je Gerät" steht (WK-16h/**R-4**).
 *
 *  Drei Lagen, und der Unterschied zwischen den beiden letzten ist der Grund,
 *  warum es diese Funktion gibt:
 *
 *  | Lage | Zelle |
 *  | --- | --- |
 *  | eine Zahl | die Zahl, ohne Tooltip — sie erklärt sich selbst |
 *  | kein Wert, Achse gilt | „—" **mit dem Grund als Tooltip** |
 *  | Achse gilt am Gerät nicht | **leer** |
 *
 *  ⛔ **Die leere Zelle ist keine Kosmetik.** Ein Strich sagt *„hier fehlt
 *  etwas"*; an einer Achse, die das Gerät nicht hat, ist das falsch — es gibt
 *  nichts zu beheben (WK-15c: *eine Achse, die am Gerät nicht gilt, trägt in
 *  keiner Rechnung und keinem Hinweis eine Zahl*). Ein Tooltip stünde dort
 *  ohnehin nicht: eine nicht geltende Achse hat gar keinen Grund.
 *
 *  ⚠ **Hier bekommt der Ausstattungs-Grund einen Tooltip, an der KACHEL nicht**
 *  — und das ist kein Widerspruch. Eine Kachel kann entfallen, dann steht ihr
 *  Grund einmal im Kasten. Eine Tabellenzeile kann nicht entfallen, solange das
 *  Gerät Mengen trägt; ihre Zelle bliebe sonst ein Strich ohne jede Auskunft.
 *  Der Kasten führt denselben Grund zusätzlich mit dem **Handgriff**.
 */
export function geraetZelle(
  wert: number | null | undefined,
  grund: string | null | undefined,
  achse?: AchsenName,
  zeile?: WpGeraetZeile,
): { leer: boolean; title?: string } {
  const achsen = zeile?.achsen ?? []
  // ⚠ **Fail-open wie in der Registry:** Eine Zeile ohne das Feld (oder mit
  // leerer Liste) lässt keine Spalte verschwinden — eine fehlende Angabe ist
  // keine Aussage „diese Achse gibt es nicht". Die teurere Richtung wäre, eine
  // gemessene Zahl still auszublenden.
  if (achse && achsen.length > 0 && !achsen.includes(achse)) {
    return { leer: true }
  }
  if (wert != null) return { leer: false }
  return { leer: false, title: grund ?? undefined }
}

/** Die Bezeichner, unter denen eine Größe im Kasten stehen kann.
 *
 *  ⚠ **Spiegel von `services/waerme_klima_block.py::GROESSEN_IM_KASTEN`** —
 *  gehalten von `waermeKlimaSicht.test.ts` (Client) und
 *  `test_wk16_d_sicht.py::test_die_groessen_namen_sind_der_vertrag` (Backend).
 *  Der Vertrag ist eine kurze Liste von Bezeichnern; sie wandert selten und
 *  wird auf beiden Seiten festgehalten. */
export const GROESSE = {
  arbeitszahl: 'Arbeitszahl',
  heizen: 'Arbeitszahl Heizen',
  warmwasser: 'Arbeitszahl Warmwasser',
  kuehlen: 'Arbeitszahl Kühlen',
  waerme: 'Wärme erzeugt',
} as const

export type GroessenName = typeof GROESSE[keyof typeof GROESSE]

/** Steht diese Größe im Kasten „Was noch möglich wäre"?
 *
 *  `true` ⇒ ihre Kachel/Zeile **entfällt** — der Grund steht einmal am
 *  Blockende, mit dem Handgriff daneben, statt sechsmal unter einem „—". */
export function imKasten(
  moeglich: WpMoeglichZeile[] | null | undefined, groesse: GroessenName,
): boolean {
  return (moeglich ?? []).some((m) => (m.groessen ?? []).includes(groesse))
}

/**
 * Die Anzeige einer anlagenweiten Arbeitszahl — mit „≥", wenn sie eine
 * **untere Schranke** ist (**E1b**).
 *
 * ⛔ **Der Client rechnet hier nichts** (`check:cop-roh`): `wert` und
 * `istSchranke` kommen fertig aus dem Layer; diese Funktion setzt ein Zeichen
 * davor. Ob eine Schranke vorliegt, weiß nur, wer die Geräte kennt.
 */
export function jazAnzeige(
  wert: number | null | undefined,
  istSchranke: boolean | null | undefined,
  formatiert: string,
): string {
  if (wert == null) return formatiert
  return istSchranke ? `≥ ${formatiert}` : formatiert
}

/**
 * Der Untertitel einer Kennzahl-Kachel — **ohne** Grund-Text.
 *
 * ⭐ **Ein „—" trägt seit der D-Sicht keinen Satz mehr**, und das ist die
 * Kehrseite des Kastens: Entweder gehört der Grund zur Ausstattung — dann steht
 * er dort, einmal und mit Handgriff, und die Kachel ist ganz verschwunden —
 * oder er gehört zum Zeitraum, und dann gibt es nichts zu tun.
 *
 * Steht eine **Zahl** da, trägt der Untertitel, was sie erklärt: zuerst die
 * Schranke („Klimaanlage: Strom ohne Wärmemessung enthalten"), dann den
 * Heizstab-Satz. Beide kommen fertig formuliert aus dem Layer.
 */
export function kennzahlUntertitel(
  wert: number | null | undefined,
  schrankeHinweis: string | null | undefined,
  hinweis: string | null | undefined,
): string | undefined {
  if (wert == null) return undefined
  const teile = [schrankeHinweis, hinweis].filter(Boolean)
  return teile.length ? teile.join(' · ') : undefined
}
