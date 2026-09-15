import { describe, it, expect } from 'vitest'
import { baueChartSerien, baueChartDaten, wpIstAufgeschluesselt, zeigtWpRest } from './TagVerlaufChart'
import { angeboteneSpalten, erfassteSenken } from './TagWerteTabelle'
import { pvRestKw, pvSplitKw, wpRestKw, wpSplitKw, wpSplitSerien } from '../../lib/erzeugerSpalten'
import { CHART_COLORS } from '../../lib'
import type { StundenWert, SerieInfo } from '../../api/energie_profil'

// ─── Wärmepumpe und Wallbox erscheinen nur, wenn es sie gibt ────────────────
//
// **Melder: JayJayX (simon42 T89667 #307 / #309, 08.09.2026).** Wörtlich: *„ich
// besitze aktuell weder Wärmepumpe noch Wallbox, diese tauchen aber trotzdem
// immer in den Statistiken auf"* — und auf die Rückfrage nach dem Ort: *„In
// Cockpit/Tag/Stundenverlauf werden mir Wallbox und Wärmepumpe angezeigt und
// laufen parallel zum Hausverbrauch."*
//
// **Warum ausgerechnet diese beiden.** Jedes andere Gerät reist als `extraSerien`
// an, und die füllt das Backend nur für Komponenten, die am Tag etwas beigetragen
// haben. `waermepumpe_kw`/`wallbox_kw` sind die zwei **dedizierten** Felder ohne
// solche Deklaration: im Chart standen sie unbedingt im Stapel, in der Tabelle
// unbedingt als Spalte (`defaultVisible: true`).
//
// ⭐ **Das Vorbild lag im Baum:** Cockpit → Live filtert seine Verbrauchs-
// kategorien seit jeher auf `vorhandeneKategorien` (`WetterWidget`). Die
// Tages-Sicht stellte dieselbe Frage nicht — obwohl `erfassteSenken` sie seit
// N-95 direkt daneben beantwortet, bis hierher aber nur für den Hausverbrauch
// gelesen wurde.
//
// ⚑ **Warum reine Funktionen und kein gerendertes DOM** (gemessen 09.09.2026):
// Recharts zeichnet in jsdom nichts (`ResponsiveContainer` hat dort Breite 0),
// eine Probe „Legendeneintrag fehlt" wäre also grün, ohne je etwas gemessen zu
// haben — und bliebe grün, wenn die Serie zurückkäme. Die Stundenwerte-Tabelle
// lässt sich in dieser Umgebung überhaupt nicht rendern, auch unverändert nicht;
// deshalb prüfen die bestehenden Proben dieser Fläche ausschließlich reine
// Funktionen, und diese hier tut es genauso.
//
// ⛔ **Was hier NICHT geprüft wird, weil es kein Fehler ist:** dass eine
// abgewählte Legenden-Serie nach einem Rerender zurückkommt. Die Flüchtigkeit
// des Legenden-Toggles ist Style-Guide B7 und eine belegte Entscheidung
// (Gernot, 08.07.2026, „KEINE C4-Persistenz") — sie bleibt.

const stunde = (over: Partial<StundenWert> = {}): StundenWert => ({
  stunde: 12,
  pv_kw: 4.2, verbrauch_kw: 1.4, einspeisung_kw: 2.8, netzbezug_kw: 0,
  batterie_kw: 0, waermepumpe_kw: null, wallbox_kw: null,
  ueberschuss_kw: null, defizit_kw: null,
  temperatur_c: null, globalstrahlung_wm2: null, soc_prozent: null,
  komponenten: null, wp_starts_anzahl: null, wp_betriebsstunden: null,
  ...over,
})

/** JayJayX: PV und Hausverbrauch, sonst nichts. */
const TAG_OHNE_GERAETE = [stunde({ stunde: 11 }), stunde({ stunde: 12 })]

/** Dieselbe Anlage, aber mit beiden Geräten am Zähler. */
const TAG_MIT_GERAETEN = [
  stunde({ stunde: 11, waermepumpe_kw: 0.6, wallbox_kw: 0 }),
  stunde({ stunde: 12, waermepumpe_kw: 0.9, wallbox_kw: 3.1 }),
]

const KEINE_EXTRA: SerieInfo[] = []

function serien(daten: StundenWert[]) {
  return baueChartSerien({
    pvAufgeschluesselt: false,
    zeigePvRest: false,
    erzeugerSerien: [],
    extraErzeuger: [],
    extraVerbraucher: KEINE_EXTRA,
    senkenErfasst: erfassteSenken(daten, KEINE_EXTRA),
  }).map(s => s.dataKey)
}

function spalten(daten: StundenWert[]) {
  return angeboteneSpalten(erfassteSenken(daten, KEINE_EXTRA)).map(c => c.key)
}

describe('Stundenverlauf — Gerätesenken ohne Gerät', () => {
  it('stapelt weder Wärmepumpe noch Wallbox, wenn der Tag keine kennt', () => {
    expect(serien(TAG_OHNE_GERAETE)).not.toContain('wp')
    expect(serien(TAG_OHNE_GERAETE)).not.toContain('wb')
  })

  it('stapelt beide, sobald der Tag Werte trägt — die Gegenprobe', () => {
    // Ohne sie belegte die Probe darüber nur, dass irgendetwas fehlt.
    expect(serien(TAG_MIT_GERAETEN)).toContain('wp')
    expect(serien(TAG_MIT_GERAETEN)).toContain('wb')
  })

  it('lässt die übrigen Serien unberührt', () => {
    // Der Fix darf nur die zwei Gerätesenken betreffen — Bilanzgrößen bleiben.
    for (const key of ['pv', 'bat_pos', 'bat_neg', 'netz_pos', 'netz_neg', 'hausverbrauch'])
      expect(serien(TAG_OHNE_GERAETE)).toContain(key)
  })

  it('unterscheidet die Messlücke vom fehlenden Gerät', () => {
    // Eine einzelne Stunde ohne Wert ist eine Lücke, kein fehlendes Gerät —
    // dieselbe Trennung, die `erfassteSenken` für den Hausverbrauch zieht.
    const tag = [stunde({ stunde: 11, waermepumpe_kw: null }), stunde({ stunde: 12, waermepumpe_kw: 0.9 })]
    expect(serien(tag)).toContain('wp')
  })

  it('zählt eine gemessene 0 als vorhanden', () => {
    // Eine Wallbox, die den ganzen Tag nicht geladen hat, gibt es trotzdem —
    // „kein Key heißt None, nicht 0" (`core/berechnungen/energie.py`).
    const tag = [stunde({ stunde: 11, wallbox_kw: 0 }), stunde({ stunde: 12, wallbox_kw: 0 })]
    expect(serien(tag)).toContain('wb')
  })
})

describe('Stundenwerte-Tabelle — Gerätespalten ohne Gerät', () => {
  it('bietet die Spalten nicht an, wenn der Tag keine kennt', () => {
    expect(spalten(TAG_OHNE_GERAETE)).not.toContain('waermepumpe_kw')
    expect(spalten(TAG_OHNE_GERAETE)).not.toContain('wallbox_kw')
  })

  it('bietet sie an, sobald der Tag Werte trägt — die Gegenprobe', () => {
    expect(spalten(TAG_MIT_GERAETEN)).toContain('waermepumpe_kw')
    expect(spalten(TAG_MIT_GERAETEN)).toContain('wallbox_kw')
  })

  it('lässt alle übrigen Spalten stehen', () => {
    const ohne = spalten(TAG_OHNE_GERAETE)
    const mit = spalten(TAG_MIT_GERAETEN)
    expect(mit.length - ohne.length).toBe(2)
    for (const key of ['pv_kw', 'verbrauch_kw', 'hausverbrauch', 'netzbezug_kw'])
      expect(ohne).toContain(key)
  })
})

// ─── Wärmepumpe je Funktion: die WP-Fläche wird ERSETZT, nicht ergänzt ───────
//
// **WK-09 B1 (Konzept Wärme/Klima §4 ⑤, SOLL §3.3/S1+S3).** Wer Heizen und
// Warmwasser mit getrennten Leistungssensoren misst und „Leistung gesamt" leer
// lässt, bekommt vom Leistungspfad zwei Serien je Gerät
// (`live_sensor_config.py::baue_investitions_serien`). Cockpit → Live zeichnet
// sie seit jeher; Cockpit → Tag faltete sie zu **einer** grauen Fläche, obwohl
// beide Keys mit fertigen Labels in derselben Antwort stehen.
//
// ⭐ **Gemessen am Schreibpfad (12.09.2026)**, nicht behauptet: `aggregate_day`
// legt bei einer WP mit `leistung_heizen_w`/`leistung_warmwasser_w`
// `{'waermepumpe_7_heizen': -2.0, 'waermepumpe_7_warmwasser': -1.0}` in
// `TagesEnergieProfil.komponenten` ab, und `/energie-profil/{id}/stunden`
// liefert daraus `SerieInfo(label='Winterborn WP Heizen', kategorie='waermepumpe')`
// plus `waermepumpe_kw = 3,0` (= |Σ Split| über den `geraete_spalte_kw`-Fallback).
//
// ⛔ **K1 (SOLL §3.2):** Die Aufteilung steht **neben** der Gesamtmenge, nie an
// ihrer Stelle. Die Stapelhöhe der Senken bleibt deshalb bitgleich — das prüft
// die letzte Probe hier, und sie ist die Bilanz-Wache dieses Baus.

const WP_HEIZEN: SerieInfo = {
  key: 'waermepumpe_7_heizen', label: 'Winterborn WP Heizen',
  typ: 'waermepumpe', kategorie: 'waermepumpe', seite: 'senke',
}
const WP_WARMWASSER: SerieInfo = {
  key: 'waermepumpe_7_warmwasser', label: 'Winterborn WP Warmwasser',
  typ: 'waermepumpe', kategorie: 'waermepumpe', seite: 'senke',
}
const WP_SPLIT = [WP_HEIZEN, WP_WARMWASSER]

/** Lage B: getrennte Leistungssensoren, KEIN kWh-Zähler ⇒ `waermepumpe_kw`
 *  entsteht als |Σ Split| (Backend-Fallback) — Rest exakt 0. */
const TAG_WP_SPLIT: StundenWert[] = [
  stunde({
    stunde: 11, waermepumpe_kw: 3.0,
    komponenten: { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 },
  }),
  stunde({
    stunde: 12, waermepumpe_kw: 1.5,
    komponenten: { waermepumpe_7_heizen: -1.5, waermepumpe_7_warmwasser: -0.0 },
  }),
]

/** Fall R-a: Zähler UND Split-Leistung, der Zähler ist größer ⇒ Restfläche. */
const TAG_WP_SPLIT_MIT_ZAEHLER: StundenWert[] = [
  stunde({
    stunde: 11, waermepumpe_kw: 3.6,
    komponenten: { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 },
  }),
]

/** Fall R-a, Gegenrichtung (N-449): der Zähler ist **kleiner** als Σ Split ⇒
 *  die Funktions-Flächen werden auf ihn gedeckelt, es bleibt kein Rest. */
const TAG_WP_SPLIT_UNTER_SPLIT: StundenWert[] = [
  stunde({
    stunde: 11, waermepumpe_kw: 2.4,
    komponenten: { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 },
  }),
]

function wpSerienliste(
  daten: StundenWert[], wpSerien: SerieInfo[],
): { keys: string[]; labels: string[] } {
  const senkenErfasst = erfassteSenken(daten, KEINE_EXTRA)
  const wpAufgeschluesselt = wpIstAufgeschluesselt(senkenErfasst, wpSerien)
  const r = baueChartSerien({
    pvAufgeschluesselt: false, zeigePvRest: false, erzeugerSerien: [],
    extraErzeuger: [], extraVerbraucher: KEINE_EXTRA, senkenErfasst,
    wpAufgeschluesselt,
    zeigeWpRest: wpAufgeschluesselt && zeigtWpRest(daten, wpSerien.map((s) => s.key)),
    wpSerien,
  })
  return { keys: r.map((s) => s.dataKey), labels: r.map((s) => s.label) }
}

/** Σ aller Senkenflächen einer Stunde — genau die Höhe, die K1 festnagelt. */
function senkenSumme(punkt: Record<string, number | string>, keys: string[]): number {
  return keys.reduce((a, k) => a + (typeof punkt[k] === 'number' ? (punkt[k] as number) : 0), 0)
}

describe('Stundenverlauf — Wärmepumpe je Funktion (WK-09 B1)', () => {
  it('ersetzt die eine WP-Fläche durch zwei Funktions-Flächen mit ihren Labels', () => {
    const { keys, labels } = wpSerienliste(TAG_WP_SPLIT, WP_SPLIT)
    expect(keys).toContain('waermepumpe_7_heizen')
    expect(keys).toContain('waermepumpe_7_warmwasser')
    expect(keys).not.toContain('wp')       // ⛔ nicht ZUSÄTZLICH — sonst doppelt
    expect(labels).toContain('Winterborn WP Heizen')
    expect(labels).toContain('Winterborn WP Warmwasser')
  })

  it('färbt Heizen und Warmwasser nach ihrer Rolle — und unterscheidbar', () => {
    const r = baueChartSerien({
      pvAufgeschluesselt: false, zeigePvRest: false, erzeugerSerien: [],
      extraErzeuger: [], extraVerbraucher: KEINE_EXTRA,
      senkenErfasst: erfassteSenken(TAG_WP_SPLIT_MIT_ZAEHLER, KEINE_EXTRA),
      wpAufgeschluesselt: true, zeigeWpRest: true, wpSerien: WP_SPLIT,
    })
    const farbe = (k: string) => r.find((s) => s.dataKey === k)?.farbe
    // Dieselben zwei Rollen-Farben wie im Live-Chart (Regel 0a).
    expect(farbe('waermepumpe_7_heizen')).toBe(CHART_COLORS.wpWaerme)
    expect(farbe('waermepumpe_7_warmwasser')).toBe(CHART_COLORS.wpWarmwasser)
    // Und drei Flächen im selben Stapel brauchen drei Farben: die Rest-Serie
    // darf NICHT `KATEGORIE_FARBEN.waermepumpe` tragen — deren Hexwert ist
    // bitgleich `wpWaerme` (beide red-500, gemessen 12.09.2026).
    expect(farbe('wp_rest')).not.toBe(farbe('waermepumpe_7_heizen'))
    expect(farbe('wp_rest')).not.toBe(farbe('waermepumpe_7_warmwasser'))
  })

  it('bleibt bei EINER Fläche, wenn es nichts zu trennen gibt — die Gegenprobe', () => {
    // Ohne Split-Serien (der Normalfall) ändert sich nichts.
    expect(wpSerienliste(TAG_MIT_GERAETEN, []).keys).toContain('wp')
    // Und mit nur EINER Funktions-Serie wäre die Funktionsreihe die WP-Reihe
    // unter anderem Namen — dieselbe Grenze wie bei den PV-Strings.
    const eine = wpSerienliste(TAG_WP_SPLIT, [WP_HEIZEN])
    expect(eine.keys).toContain('wp')
    expect(eine.keys).not.toContain('waermepumpe_7_heizen')
  })

  it('hebt die JayJayX-Regel nicht aus: keine erfasste WP ⇒ keine Fläche (N-424)', () => {
    // Split-Serien in der Antwort, aber der Tag trägt keinen einzigen Wert:
    // dann gibt es gar keine WP-Fläche, die man aufteilen könnte.
    const { keys } = wpSerienliste(TAG_OHNE_GERAETE, WP_SPLIT)
    expect(keys).not.toContain('wp')
    expect(keys).not.toContain('waermepumpe_7_heizen')
    // ⚑ Und die Bedingung selbst, nicht nur ihre Wirkung: die äußere Frage ist
    // „hat dieser Tag überhaupt eine Wärmepumpe?" — sie steht VOR der Frage
    // „kann man sie aufteilen?". Ohne diese Zeile bliebe der Sprengsatz still
    // (gemessen 12.09.2026), weil `baueChartSerien` ein zweites Tor trägt.
    expect(wpIstAufgeschluesselt(new Set(), WP_SPLIT)).toBe(false)
    expect(wpIstAufgeschluesselt(new Set(['waermepumpe_kw']), WP_SPLIT)).toBe(true)
    expect(wpIstAufgeschluesselt(new Set(['waermepumpe_kw']), [WP_HEIZEN])).toBe(false)
  })

  it('trägt eine ZWEITE Wärmepumpe ohne Split als „übrige" — statt sie zu verlieren', () => {
    // Der Mehr-Geräte-Fall, den die Rest-Serie mitbeantwortet (Vorlage §3.1):
    // Gerät 7 misst getrennt (2,0 + 1,0), Gerät 9 gar nicht — die Sammelspalte
    // trägt beide (4,5). Ohne Rest-Serie verschwänden Gerät 9s 1,5 kW aus dem
    // Stapel, und die Bilanz stimmte nicht mehr.
    const tag = [stunde({
      stunde: 11, waermepumpe_kw: 4.5,
      komponenten: { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 },
    })]
    expect(wpRestKw(4.5, tag[0].komponenten, WP_SPLIT.map((x) => x.key))).toBeCloseTo(1.5, 10)
    const { keys, labels } = wpSerienliste(tag, WP_SPLIT)
    expect(keys).toContain('wp_rest')
    expect(labels).toContain('Wärmepumpe (übrige)')
    // ⚠ **Und das ist die ehrliche Grenze:** Die Fläche heißt „übrige", nicht
    // nach dem zweiten Gerät — der Client kennt seinen Namen an dieser Stelle
    // nicht (der Leistungspfad liefert für ein Gerät ohne Sensor keinen Key).
    // Die Menge ist da und die Bilanz stimmt; die Geräte-Achse tut sie nicht auf.
  })

  it('nimmt nur die Funktions-Serien der Wärmepumpe in die Aufschlüsselung', () => {
    // Der Filter ist die Eingangsregel: eine WP OHNE Suffix ist die
    // Gesamtleistung desselben Geräts — sie neben den Split zu stellen hieße,
    // dieselbe Energie zweimal zu stapeln.
    const alle: SerieInfo[] = [
      { key: 'waermepumpe_7', label: 'Winterborn WP', typ: 'waermepumpe', kategorie: 'waermepumpe', seite: 'senke' },
      WP_HEIZEN, WP_WARMWASSER,
      { key: 'pv_3', label: 'Dach Süd', typ: 'pv-module', kategorie: 'pv', seite: 'quelle' },
      { key: 'sonstige_5', label: 'Poolpumpe', typ: 'sonstiges', kategorie: 'sonstige', seite: 'senke' },
    ]
    expect(wpSplitSerien(alle).map((x) => x.key))
      .toEqual(['waermepumpe_7_heizen', 'waermepumpe_7_warmwasser'])
  })

  it('zeigt „Wärmepumpe (übrige)" nur, wo Zähler und Leistungspfad auseinanderliegen', () => {
    // Lage B ohne Zähler: `waermepumpe_kw` IST |Σ Split| ⇒ kein Rest.
    expect(zeigtWpRest(TAG_WP_SPLIT, WP_SPLIT.map((s) => s.key))).toBe(false)
    expect(wpSerienliste(TAG_WP_SPLIT, WP_SPLIT).keys).not.toContain('wp_rest')
    // Fall R-a: Zähler 3,6 gegen Σ Split 3,0 ⇒ 0,6 kW Rest, über der Schwelle.
    expect(zeigtWpRest(TAG_WP_SPLIT_MIT_ZAEHLER, WP_SPLIT.map((s) => s.key))).toBe(true)
    expect(wpSerienliste(TAG_WP_SPLIT_MIT_ZAEHLER, WP_SPLIT).keys).toContain('wp_rest')
    // Unter der Schwelle (0,04 kW) bleibt er weg — eine Legendenzeile für
    // Rundungsreste verwirrt mehr, als sie sagt.
    const knapp = [stunde({
      stunde: 11, waermepumpe_kw: 3.04,
      komponenten: { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 },
    })]
    expect(zeigtWpRest(knapp, WP_SPLIT.map((s) => s.key))).toBe(false)
  })

  it('deckelt die Funktions-Flächen auf den Zähler — Einzelwerte (N-449)', () => {
    const keys = WP_SPLIT.map((s) => s.key)
    const komp = { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 }
    // Zähler 2,4 < Σ Split 3,0 ⇒ Faktor 0,8. Der Zähler ist die Menge, die
    // beiden Leistungsreihen sind die Form.
    const gedeckelt = wpSplitKw(2.4, komp, keys)
    expect(gedeckelt['waermepumpe_7_heizen']).toBeCloseTo(-1.6, 10)
    expect(gedeckelt['waermepumpe_7_warmwasser']).toBeCloseTo(-0.8, 10)
    expect(Object.values(gedeckelt).reduce((a, v) => a + Math.abs(v), 0)).toBeCloseTo(2.4, 10)
    // ⛔ **Nur nach unten:** Ist der Zähler größer, wird NICHT gestreckt — die
    // Differenz ist eine echte Restgröße und heißt „Wärmepumpe (übrige)".
    const ungestreckt = wpSplitKw(3.6, komp, keys)
    expect(ungestreckt['waermepumpe_7_heizen']).toBeCloseTo(-2.0, 10)
    expect(ungestreckt['waermepumpe_7_warmwasser']).toBeCloseTo(-1.0, 10)
    // Und ohne Zähler (waermepumpe_kw = |Σ Split|) ändert sich nichts.
    const ohneZaehler = wpSplitKw(3.0, komp, keys)
    expect(ohneZaehler['waermepumpe_7_heizen']).toBeCloseTo(-2.0, 10)
    expect(ohneZaehler['waermepumpe_7_warmwasser']).toBeCloseTo(-1.0, 10)
  })

  it('rechnet den Rest aus der Differenz — Einzelwerte, keine Summe', () => {
    const keys = WP_SPLIT.map((s) => s.key)
    expect(wpRestKw(3.6, { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 }, keys))
      .toBeCloseTo(0.6, 10)
    // Deckt der Split die Spalte (oder mehr), gibt es keinen Rest — eine
    // negative Fläche im Stapel wäre eine Behauptung über nichts.
    expect(wpRestKw(2.4, { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 }, keys)).toBe(0)
    // ⛔ Die Senken-Vorzeichen sind der Unterschied zur PV-Regel: mit
    // `Math.max(0, …)` je Key käme hier Σ = 0 und der ganze Strom als „Rest".
    expect(wpRestKw(3.0, { waermepumpe_7_heizen: -2.0, waermepumpe_7_warmwasser: -1.0 }, keys)).toBe(0)
  })

  // ⛔ **Die Bilanz-Wache.** Sie läuft über BEIDE Lagen: ohne Zähler (Rest = 0)
  // und im Fall R-a (Zähler > Σ Split ⇒ Restfläche). Nur die zweite fängt eine
  // weggelassene Rest-Serie — mit der ersten allein wäre sie blind.
  it.each([
    ['ohne Zähler (Rest 0)', TAG_WP_SPLIT, -5.8, -3.0, -2.0, -1.0],
    ['Fall R-a (Zähler > Σ Split)', TAG_WP_SPLIT_MIT_ZAEHLER, -6.4, -3.6, -2.0, -1.0],
    // N-449: Σ Split 3,0 gegen Zähler 2,4 ⇒ Faktor 0,8 ⇒ 1,6 / 0,8, kein Rest.
    ['Fall R-a (Zähler < Σ Split)', TAG_WP_SPLIT_UNTER_SPLIT, -5.2, -2.4, -1.6, -0.8],
  ] as const)('K1: die Σ der Senkenflächen einer Stunde bleibt bitgleich — %s', (_n, daten, summe11, wp11, heizen11, ww11) => {
    const senkenErfasst = erfassteSenken(daten as StundenWert[], KEINE_EXTRA)
    const arg = {
      daten: daten as StundenWert[], extraErzeuger: [], extraVerbraucher: KEINE_EXTRA,
      erzeugerSerien: [], pvAufgeschluesselt: false, zeigePvRest: false,
    }
    const ohne = baueChartDaten({ ...arg })
    const mit = baueChartDaten({
      ...arg, wpSerien: WP_SPLIT,
      wpAufgeschluesselt: wpIstAufgeschluesselt(senkenErfasst, WP_SPLIT),
      zeigeWpRest: zeigtWpRest(daten as StundenWert[], WP_SPLIT.map((s) => s.key)),
    })
    const senkenOhne = ['hausverbrauch', 'wp', 'wb', 'bat_neg', 'netz_neg']
    const senkenMit = ['hausverbrauch', ...WP_SPLIT.map((s) => s.key), 'wp_rest', 'wb', 'bat_neg', 'netz_neg']
    for (let h = 0; h < 24; h++) {
      expect(senkenSumme(mit[h], senkenMit)).toBeCloseTo(senkenSumme(ohne[h], senkenOhne), 10)
    }
    // Gegenprobe: Stunde 11 ist nicht leer — sonst prüfte die Schleife nichts.
    // Neben der Wärmepumpe stehen −2,8 kW Einspeisung (die Fixture speist ein).
    expect(senkenSumme(ohne[11], senkenOhne)).toBeCloseTo(summe11, 10)
    expect(ohne[11].wp).toBeCloseTo(wp11, 10)
    // Und die Einzelwerte der Stunde 11 stehen getrennt da.
    expect(mit[11]['waermepumpe_7_heizen']).toBeCloseTo(heizen11, 10)
    expect(mit[11]['waermepumpe_7_warmwasser']).toBeCloseTo(ww11, 10)
    expect(mit[11].wp).toBeUndefined()
  })
})


// ─── N-455: der Quellen-Stapel bleibt die Erzeugung, in BEIDE Richtungen ────
//
// **Kein Melder — Nebenbefund an N-449** (Master 13.09.2026 am Code gemessen).
// Die Senkenseite bekam mit N-449 den Deckel `wpSplitKw`; die Quellenseite
// behielt nur `pvRestKw`, und der klemmt den **Rest** bei 0, nicht die
// String-Flächen selbst. Melden die String-Sensoren einer Stunde zusammen mehr,
// als der Anlagenzähler hergibt — `pv_kw` ist zählertreu, die Strings kommen
// aus dem Leistungspfad —, wuchs der Quellen-Stapel über die PV-Gesamtlinie
// hinaus, während `gesamterzeugung` daneben weiter mit `pv_kw` rechnete.
//
// ⚠ **Wie groß die Drift bei realen String-Sensoren wird, ist nicht erhoben**
// (der Fund ist am Code gemessen, nicht an Daten). Die Kante existiert
// unabhängig davon.

const PV_A: SerieInfo = { key: 'pv_7', label: 'Dach Süd', typ: 'pv-module', kategorie: 'pv', seite: 'quelle' }
const PV_B: SerieInfo = { key: 'pv_9', label: 'Dach Ost', typ: 'pv-module', kategorie: 'pv', seite: 'quelle' }
const PV_SPLIT = [PV_A, PV_B]

/** Eine Stunde mit zwei String-Sensoren; `pv_kw` ist der Anlagenzähler. */
const pvStunde = (pvKw: number, a: number, b: number) => stunde({
  stunde: 11, pv_kw: pvKw, batterie_kw: 0, netzbezug_kw: 0, einspeisung_kw: 0,
  verbrauch_kw: 0, komponenten: { pv_7: a, pv_9: b },
})

function quellenSumme(punkt: Record<string, number | string>, keys: string[]): number {
  return keys.reduce((a, k) => a + (typeof punkt[k] === 'number' ? punkt[k] as number : 0), 0)
}

function pvChartDaten(daten: StundenWert[]) {
  const keys = PV_SPLIT.map((x) => x.key)
  return baueChartDaten({
    daten, extraErzeuger: [], extraVerbraucher: KEINE_EXTRA,
    erzeugerSerien: PV_SPLIT,
    pvAufgeschluesselt: true,
    zeigePvRest: daten.some((x) => pvRestKw(x.pv_kw, x.komponenten, keys) > 0.05),
  })
}

describe('Stundenverlauf — der PV-Deckel auf der Quellenseite (N-455)', () => {
  it.each([
    // Lage, Zähler, String A, String B, erwartet A, erwartet B, erwarteter Rest
    ['UNTER (Strings kleiner als der Zähler)', 6.0, 3.0, 1.5, 3.0, 1.5, 1.5],
    ['GLEICH (Strings genau der Zähler)',      4.5, 3.0, 1.5, 3.0, 1.5, 0.0],
    ['ÜBER (Strings größer als der Zähler)',   3.6, 3.0, 1.5, 2.4, 1.2, 0.0],
  ] as const)('K1: Σ Stringflächen + Rest == pv_kw — %s', (_n, zaehler, a, b, sollA, sollB, sollRest) => {
    const daten = [pvStunde(zaehler, a, b)]
    const punkt = pvChartDaten(daten)[11]

    // Einzelwerte, nicht nur die Summe.
    expect(punkt.pv_7).toBeCloseTo(sollA, 10)
    expect(punkt.pv_9).toBeCloseTo(sollB, 10)
    expect(typeof punkt.pv_rest === 'number' ? punkt.pv_rest : 0).toBeCloseTo(sollRest, 10)

    // Und die Stapelhöhe ist exakt die Anlagen-PV — die Zahl, die daneben als
    // `gesamterzeugung` steht und die Gesamtlinie zeichnet.
    expect(quellenSumme(punkt, ['pv_7', 'pv_9', 'pv_rest'])).toBeCloseTo(zaehler, 10)
    expect(punkt.gesamterzeugung).toBeCloseTo(zaehler, 10)
  })

  it('ohne Aufschlüsselung bleibt die PV-Fläche bitgleich der Anlagenwert', () => {
    // Die Gegenprobe zur Regel: Der Deckel darf nur greifen, wo aufgeschlüsselt
    // wird — sonst hätte er eine Wirkung auf jede Anlage ohne String-Sensoren.
    const daten = [pvStunde(3.6, 3.0, 1.5)]
    const ohne = baueChartDaten({
      daten, extraErzeuger: [], extraVerbraucher: KEINE_EXTRA,
      erzeugerSerien: [], pvAufgeschluesselt: false, zeigePvRest: false,
    })
    expect(ohne[11].pv).toBeCloseTo(3.6, 10)
    expect(ohne[11].pv_7).toBeUndefined()
  })

  it('das Verhältnis der Strings überlebt den Deckel', () => {
    // ⚠ Ein Deckel **verteilt** nichts (Memory `project_kwp_verteilung_aggregator`):
    // Das 2:1 aus den Messwerten bleibt 2:1, es wird nur gestaucht.
    const punkt = pvChartDaten([pvStunde(3.6, 3.0, 1.5)])[11]
    expect((punkt.pv_7 as number) / (punkt.pv_9 as number)).toBeCloseTo(2.0, 10)
    // Gegenanker: die Werte sind nicht die ungedeckelten.
    expect(punkt.pv_7).not.toBeCloseTo(3.0, 3)
  })

  it('die reine Funktion und der Chart liefern dieselbe Zahl', () => {
    // Eine Quelle, ein Ort: Der Chart darf die Regel nicht neben `pvSplitKw`
    // noch einmal formulieren.
    const komp = { pv_7: 3.0, pv_9: 1.5 }
    const punkt = pvChartDaten([pvStunde(3.6, 3.0, 1.5)])[11]
    const rein = pvSplitKw(3.6, komp, PV_SPLIT.map((x) => x.key))
    expect(punkt.pv_7).toBeCloseTo(rein.pv_7, 10)
    expect(punkt.pv_9).toBeCloseTo(rein.pv_9, 10)
  })
})

// ─── N-439: die dritte Funktions-Fläche — Kühlen ────────────────────────────
//
// **Die Lage bis zum 13.09.2026.** `leistung_kuehlen_w` war seit W-13 (26.08.)
// jeder Wärmepumpe zuordenbar und wurde an **keiner** Station gelesen — es gab
// diesen Key im Leistungspfad also nie. Mit dem Anzeigepfad (Entscheid Gernot,
// Tor G-K) liefert `baue_investitions_serien` ihn wie seine zwei Nachbarn, und
// zwei Stellen im Client müssen ihn kennen:
//
// ⛔ **`WP_SPLIT_SUFFIX`** — ohne den Eintrag fiele die Kühl-Serie aus
// {@link wpSplitSerien} heraus und läge als `extraSerien` **zusätzlich** zur
// Wärmepumpen-Fläche im Stapel: dieselbe Energie zweimal.
//
// ⛔ **Die Farbe** — ohne die Zeile in `baueChartSerien` fiele ein
// `_kuehlen`-Key in den Heizen-Zweig und die Kühlfläche stünde **rot** neben dem
// Heizen-Segment. `modusKuehlen` (sky-500) ist die Rollenfarbe des Kühl-STROMS
// (= `ROLLEN_BG.kuehlung`); die gemessene Kälte-MENGE trägt dagegen
// `kaelteGemessen` (teal, N-437) — zwei Größen, zwei Töne.

const WP_KUEHLEN: SerieInfo = {
  key: 'waermepumpe_7_kuehlen', label: 'Winterborn WP Kühlen',
  typ: 'waermepumpe', kategorie: 'waermepumpe', seite: 'senke',
}
const WP_DREI = [WP_HEIZEN, WP_WARMWASSER, WP_KUEHLEN]

/** Ein Sommertag: das Gerät kühlt, Heizen und Warmwasser stehen still. */
const TAG_WP_KUEHLT: StundenWert[] = [
  stunde({
    stunde: 11, waermepumpe_kw: 2.0,
    komponenten: {
      waermepumpe_7_heizen: -0.0, waermepumpe_7_warmwasser: -0.0,
      waermepumpe_7_kuehlen: -2.0,
    },
  }),
]

describe('Stundenverlauf — die Kühl-Fläche (N-439)', () => {
  it('erkennt den Kühl-Key als Funktions-Serie', () => {
    const alle: SerieInfo[] = [
      { key: 'waermepumpe_7', label: 'Winterborn WP', typ: 'waermepumpe', kategorie: 'waermepumpe', seite: 'senke' },
      ...WP_DREI,
      { key: 'pv_3', label: 'Dach Süd', typ: 'pv-module', kategorie: 'pv', seite: 'quelle' },
    ]
    expect(wpSplitSerien(alle).map((x) => x.key)).toEqual([
      'waermepumpe_7_heizen', 'waermepumpe_7_warmwasser', 'waermepumpe_7_kuehlen',
    ])
  })

  it('zeichnet sie in der Kühl-Rollenfarbe, nicht in Rot', () => {
    const r = baueChartSerien({
      pvAufgeschluesselt: false, zeigePvRest: false, erzeugerSerien: [],
      extraErzeuger: [], extraVerbraucher: KEINE_EXTRA,
      senkenErfasst: erfassteSenken(TAG_WP_KUEHLT, KEINE_EXTRA),
      wpAufgeschluesselt: true, zeigeWpRest: false, wpSerien: WP_DREI,
    })
    const farbe = (k: string) => r.find((s) => s.dataKey === k)?.farbe

    expect(farbe('waermepumpe_7_kuehlen')).toBe(CHART_COLORS.modusKuehlen)
    // ⛔ Der Kern: NICHT die Heizen-Farbe — genau dorthin fiel der Key vorher.
    expect(farbe('waermepumpe_7_kuehlen')).not.toBe(CHART_COLORS.wpWaerme)
    // ⛔ Und nicht der Ton der gemessenen Kälte-MENGE (N-437).
    expect(farbe('waermepumpe_7_kuehlen')).not.toBe(CHART_COLORS.kaelteGemessen)
    // K5 — die Nachbarn behalten ihre Töne, Einzelwerte statt Menge.
    expect(farbe('waermepumpe_7_heizen')).toBe(CHART_COLORS.wpWaerme)
    expect(farbe('waermepumpe_7_warmwasser')).toBe(CHART_COLORS.wpWarmwasser)
  })

  it('trägt Label und Fläche in den Stapel, statt die WP-Fläche zu verdoppeln', () => {
    const { keys, labels } = wpSerienliste(TAG_WP_KUEHLT, WP_DREI)
    expect(keys).toContain('waermepumpe_7_kuehlen')
    expect(keys).not.toContain('wp')
    expect(labels).toContain('Winterborn WP Kühlen')
  })

  it('K1 — die Stapelhöhe bleibt die gemessene Gesamtmenge', () => {
    const mit = baueChartDaten({
      daten: TAG_WP_KUEHLT, extraErzeuger: [], extraVerbraucher: KEINE_EXTRA,
      erzeugerSerien: [], pvAufgeschluesselt: false, zeigePvRest: false,
      wpAufgeschluesselt: true, zeigeWpRest: false, wpSerien: WP_DREI,
    })[11]
    const ohne = baueChartDaten({
      daten: TAG_WP_KUEHLT, extraErzeuger: [], extraVerbraucher: KEINE_EXTRA,
      erzeugerSerien: [], pvAufgeschluesselt: false, zeigePvRest: false,
    })[11]
    // Senken stehen negativ im Butterfly (`seite: 'senke'`), deshalb −2,0.
    expect(senkenSumme(mit, WP_DREI.map((s) => s.key))).toBeCloseTo(-2.0, 10)
    // Und das ist bitgleich die Fläche, die ohne Aufschlüsselung dastünde.
    expect(ohne.wp).toBeCloseTo(-2.0, 10)
    expect(mit.wp).toBeUndefined()
    // Einzelwerte: Kühlen trägt alles, die stillen Nachbarn nichts.
    expect(mit['waermepumpe_7_kuehlen']).toBeCloseTo(-2.0, 10)
    expect(mit['waermepumpe_7_heizen']).toBeCloseTo(0, 10)
  })

  it('allein reicht sie — eine Wärmepumpe, die NUR kühlt, bleibt eine Fläche', () => {
    // Die Gegenprobe zur Mindestzahl: mit einer einzigen Funktions-Serie wäre
    // die Kühlreihe die WP-Reihe unter anderem Namen — dieselbe Grenze wie bei
    // Heizen allein.
    const eine = wpSerienliste(TAG_WP_KUEHLT, [WP_KUEHLEN])
    expect(eine.keys).toContain('wp')
    expect(eine.keys).not.toContain('waermepumpe_7_kuehlen')
  })
})
