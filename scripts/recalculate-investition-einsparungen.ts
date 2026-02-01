// scripts/recalculate-investition-einsparungen.ts
// Script zur Nachberechnung aller Einsparungen in investition_monatsdaten
//
// Ausführung: npx tsx scripts/recalculate-investition-einsparungen.ts
//
// Dieses Script:
// 1. Lädt alle investition_monatsdaten
// 2. Lädt die zugehörigen Investitionen mit Parametern
// 3. Lädt die Strompreise aus strompreise Tabelle
// 4. Berechnet einsparung_monat_euro und co2_einsparung_kg
// 5. Aktualisiert die Datensätze

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// .env.local laden
config({ path: resolve(process.cwd(), '.env.local') })

// Supabase Client erstellen
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein')
  console.log('Tipp: Erstelle eine .env.local Datei oder setze die Umgebungsvariablen')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface Investition {
  id: string
  typ: string
  bezeichnung: string
  mitglied_id: string
  parameter: any
}

interface InvestitionMonatsdaten {
  id: string
  investition_id: string
  jahr: number
  monat: number
  verbrauch_daten: any
  einsparung_monat_euro: number | null
  co2_einsparung_kg: number | null
}

interface Strompreis {
  mitglied_id: string
  gueltig_ab: string
  netzbezug_arbeitspreis_cent_kwh: number
}

async function main() {
  console.log('=== Nachberechnung Investitions-Einsparungen ===\n')

  // 1. Alle Investitionen laden
  console.log('Lade Investitionen...')
  const { data: investitionen, error: invError } = await supabase
    .from('investitionen')
    .select('id, typ, bezeichnung, mitglied_id, parameter')
    .eq('aktiv', true)

  if (invError) {
    console.error('Fehler beim Laden der Investitionen:', invError)
    return
  }

  console.log(`  ${investitionen?.length || 0} aktive Investitionen gefunden`)

  // 2. Alle Investition-Monatsdaten laden
  console.log('Lade Investition-Monatsdaten...')
  const { data: monatsdaten, error: mdError } = await supabase
    .from('investition_monatsdaten')
    .select('*')
    .order('jahr', { ascending: true })
    .order('monat', { ascending: true })

  if (mdError) {
    console.error('Fehler beim Laden der Monatsdaten:', mdError)
    return
  }

  console.log(`  ${monatsdaten?.length || 0} Monatsdaten-Einträge gefunden`)

  // 3. Strompreise laden (für alle Mitglieder)
  console.log('Lade Strompreise...')
  const { data: strompreise, error: spError } = await supabase
    .from('strompreise')
    .select('mitglied_id, gueltig_ab, netzbezug_arbeitspreis_cent_kwh')
    .order('gueltig_ab', { ascending: false })

  if (spError) {
    console.error('Fehler beim Laden der Strompreise:', spError)
    return
  }

  console.log(`  ${strompreise?.length || 0} Strompreis-Einträge gefunden`)

  // Investitionen nach ID indexieren
  const invMap = new Map<string, Investition>()
  investitionen?.forEach(inv => invMap.set(inv.id, inv))

  // Funktion zum Finden des aktuellen Strompreises
  function getStrompreis(mitgliedId: string, jahr: number, monat: number): number {
    const stichtag = `${jahr}-${String(monat).padStart(2, '0')}-15`

    const relevantPreise = strompreise?.filter(sp =>
      sp.mitglied_id === mitgliedId && sp.gueltig_ab <= stichtag
    ) || []

    if (relevantPreise.length > 0) {
      return relevantPreise[0].netzbezug_arbeitspreis_cent_kwh
    }

    return 30 // Fallback: 30 ct/kWh
  }

  // 4. Einsparungen berechnen
  console.log('\nBerechne Einsparungen...')

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const md of monatsdaten || []) {
    const inv = invMap.get(md.investition_id)
    if (!inv) {
      console.log(`  ⚠ Investition ${md.investition_id} nicht gefunden - überspringe`)
      skipped++
      continue
    }

    const verbrauch = md.verbrauch_daten || {}
    let einsparungMonatEuro: number | null = null
    let co2EinsparungKg: number | null = null

    const strompreisNetz = getStrompreis(inv.mitglied_id, md.jahr, md.monat)

    // Berechnung je nach Typ
    if (inv.typ === 'speicher') {
      const entladung = parseFloat(verbrauch.entladung_kwh) || 0
      if (entladung > 0) {
        einsparungMonatEuro = entladung * strompreisNetz / 100
        co2EinsparungKg = entladung * 0.4
      }
    } else if (inv.typ === 'e-auto') {
      const kmGefahren = parseFloat(verbrauch.km_gefahren) || 0
      const ladungNetzKwh = parseFloat(verbrauch.ladung_netz_kwh) || 0

      if (kmGefahren > 0) {
        const benzinPreis = parseFloat(inv.parameter?.benzinpreis_euro_liter) || 1.69
        const verbrennerVerbrauch = parseFloat(inv.parameter?.vergleich_verbrenner_l_100km) || 7.0

        const spritKostenAlternativ = (kmGefahren / 100) * verbrennerVerbrauch * benzinPreis
        const stromKostenEAuto = ladungNetzKwh * strompreisNetz / 100

        einsparungMonatEuro = spritKostenAlternativ - stromKostenEAuto
        co2EinsparungKg = (kmGefahren / 100) * verbrennerVerbrauch * 2.37
      }
    } else if (inv.typ === 'waermepumpe') {
      const heizenergie = parseFloat(verbrauch.heizenergie_kwh) || 0
      const warmwasser = parseFloat(verbrauch.warmwasser_kwh) || 0
      const stromverbrauch = parseFloat(verbrauch.stromverbrauch_kwh) || 0
      const waermeGesamt = heizenergie + warmwasser

      if (waermeGesamt > 0) {
        const alterPreisCent = parseFloat(inv.parameter?.alter_preis_cent_kwh) || 8
        const alterEnergieKosten = waermeGesamt * alterPreisCent / 100
        const wpStromKosten = stromverbrauch * strompreisNetz / 100

        einsparungMonatEuro = alterEnergieKosten - wpStromKosten

        const alterCo2Faktor = inv.parameter?.alter_energietraeger === 'Öl' ? 0.27 : 0.20
        co2EinsparungKg = waermeGesamt * alterCo2Faktor - stromverbrauch * 0.4
      }
    }

    // Nur updaten wenn sich was berechnen ließ
    if (einsparungMonatEuro !== null || co2EinsparungKg !== null) {
      const { error: updateError } = await supabase
        .from('investition_monatsdaten')
        .update({
          einsparung_monat_euro: einsparungMonatEuro,
          co2_einsparung_kg: co2EinsparungKg
        })
        .eq('id', md.id)

      if (updateError) {
        console.log(`  ❌ Fehler bei ${inv.bezeichnung} ${md.monat}/${md.jahr}: ${updateError.message}`)
        errors++
      } else {
        console.log(`  ✓ ${inv.bezeichnung} ${md.monat}/${md.jahr}: ${einsparungMonatEuro?.toFixed(2) || '-'}€ / ${co2EinsparungKg?.toFixed(1) || '-'}kg CO2`)
        updated++
      }
    } else {
      skipped++
    }
  }

  console.log('\n=== Zusammenfassung ===')
  console.log(`  Aktualisiert: ${updated}`)
  console.log(`  Übersprungen: ${skipped}`)
  console.log(`  Fehler: ${errors}`)
  console.log('\nFertig!')
}

main().catch(console.error)
