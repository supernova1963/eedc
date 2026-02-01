// scripts/recalculate-investition-prognosen.ts
// Script zur Nachberechnung aller Prognose-Einsparungen in investitionen
//
// Ausführung: npx tsx scripts/recalculate-investition-prognosen.ts
//
// Dieses Script:
// 1. Lädt alle Investitionen mit Parametern
// 2. Berechnet die Jahres-Einsparungen aus den Parametern
// 3. Aktualisiert einsparung_gesamt_jahr in der investitionen Tabelle

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
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// CO2-Faktoren (kg CO2 pro Einheit)
const CO2_FAKTOREN = {
  benzin_pro_liter: 2.37,
  strom_netz_pro_kwh: 0.38,
  gas_pro_kwh: 0.201,
  oel_pro_kwh: 0.266
}

interface Investition {
  id: string
  typ: string
  bezeichnung: string
  mitglied_id: string
  parameter: any
  einsparung_gesamt_jahr: number | null
  co2_einsparung_kg_jahr: number | null
}

function berechneEAutoPrognose(params: any): { jahresEinsparung: number; co2Einsparung: number } {
  const kmJahr = parseFloat(params?.km_jahr) || 0
  const verbrauchKwh = parseFloat(params?.verbrauch_kwh_100km) || 0
  const pvAnteil = parseFloat(params?.pv_anteil_prozent) || 70
  const verbrauchL = parseFloat(params?.vergleich_verbrenner_l_100km) || 0
  const benzinpreis = parseFloat(params?.benzinpreis_euro_liter) || 1.69
  const betriebskosten = parseFloat(params?.betriebskosten_jahr_euro) || 0
  const strompreis = parseFloat(params?.strompreis_cent_kwh) || 30

  if (kmJahr === 0 || verbrauchKwh === 0) {
    return { jahresEinsparung: 0, co2Einsparung: 0 }
  }

  const stromGesamt = (kmJahr / 100) * verbrauchKwh
  const stromNetz = stromGesamt * (1 - pvAnteil / 100)

  // CO2
  const co2Benzin = (kmJahr / 100) * verbrauchL * CO2_FAKTOREN.benzin_pro_liter
  const co2Strom = stromNetz * CO2_FAKTOREN.strom_netz_pro_kwh
  const co2Einsparung = co2Benzin - co2Strom

  // Kosten
  const stromkostenNetz = (stromNetz * strompreis) / 100
  const kostenEAuto = stromkostenNetz + betriebskosten
  const benzinkosten = (kmJahr / 100) * verbrauchL * benzinpreis
  const jahresEinsparung = benzinkosten - kostenEAuto

  return {
    jahresEinsparung: Math.round(jahresEinsparung),
    co2Einsparung: Math.round(co2Einsparung)
  }
}

function berechneWaermepumpePrognose(params: any): { jahresEinsparung: number; co2Einsparung: number } {
  const waermebedarf = parseFloat(params?.waermebedarf_kwh_jahr) || 0
  const jaz = parseFloat(params?.jaz) || 3.5
  const pvAnteil = parseFloat(params?.pv_anteil_prozent) || 40
  const alterPreis = parseFloat(params?.alter_preis_cent_kwh) || 8
  const betriebskosten = parseFloat(params?.betriebskosten_jahr_euro) || 0
  const strompreisNetz = 30 // Standard

  if (waermebedarf === 0) {
    return { jahresEinsparung: 0, co2Einsparung: 0 }
  }

  const stromVerbrauch = waermebedarf / jaz
  const stromNetz = stromVerbrauch * (1 - pvAnteil / 100)

  // CO2
  let co2Alt = 0
  if (params?.alter_energietraeger === 'Gas') {
    co2Alt = waermebedarf * CO2_FAKTOREN.gas_pro_kwh
  } else if (params?.alter_energietraeger === 'Öl' || params?.alter_energietraeger === 'Ol') {
    co2Alt = waermebedarf * CO2_FAKTOREN.oel_pro_kwh
  }
  const co2Neu = stromNetz * CO2_FAKTOREN.strom_netz_pro_kwh
  const co2Einsparung = co2Alt - co2Neu

  // Kosten
  const kostenAlt = (waermebedarf * alterPreis) / 100
  const stromkostenNetz = (stromNetz * strompreisNetz) / 100
  const kostenWP = stromkostenNetz + betriebskosten
  const jahresEinsparung = kostenAlt - kostenWP

  return {
    jahresEinsparung: Math.round(jahresEinsparung),
    co2Einsparung: Math.round(co2Einsparung)
  }
}

function berechneSpeicherPrognose(params: any): { jahresEinsparung: number; co2Einsparung: number } {
  const kapazitaet = parseFloat(params?.kapazitaet_kwh) || 0
  const wirkungsgrad = parseFloat(params?.wirkungsgrad_prozent) || 95
  const betriebskosten = parseFloat(params?.betriebskosten_jahr_euro) || 0
  const strompreisNetz = 30
  const einspeisePreis = 8
  const jahreszyklen = 250

  if (kapazitaet === 0) {
    return { jahresEinsparung: 0, co2Einsparung: 0 }
  }

  const nutzbareSpeicherung = kapazitaet * jahreszyklen * (wirkungsgrad / 100)
  const co2Einsparung = nutzbareSpeicherung * CO2_FAKTOREN.strom_netz_pro_kwh

  // Einsparung
  const differenzProKwh = (strompreisNetz - einspeisePreis) / 100
  const jahresEinsparung = nutzbareSpeicherung * differenzProKwh - betriebskosten

  return {
    jahresEinsparung: Math.round(jahresEinsparung),
    co2Einsparung: Math.round(co2Einsparung)
  }
}

async function main() {
  console.log('=== Nachberechnung Investitions-Prognosen ===\n')

  // 1. Alle Investitionen laden
  console.log('Lade Investitionen...')
  const { data: investitionen, error: invError } = await supabase
    .from('investitionen')
    .select('id, typ, bezeichnung, mitglied_id, parameter, einsparung_gesamt_jahr, co2_einsparung_kg_jahr')
    .eq('aktiv', true)

  if (invError) {
    console.error('Fehler beim Laden der Investitionen:', invError)
    return
  }

  console.log(`  ${investitionen?.length || 0} aktive Investitionen gefunden`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const inv of investitionen || []) {
    let result: { jahresEinsparung: number; co2Einsparung: number } | null = null

    switch (inv.typ) {
      case 'e-auto':
        result = berechneEAutoPrognose(inv.parameter)
        break
      case 'waermepumpe':
        result = berechneWaermepumpePrognose(inv.parameter)
        break
      case 'speicher':
        result = berechneSpeicherPrognose(inv.parameter)
        break
      default:
        // Andere Typen überspringen (haben keine automatische Berechnung)
        skipped++
        continue
    }

    if (result && (result.jahresEinsparung !== 0 || result.co2Einsparung !== 0)) {
      const { error: updateError } = await supabase
        .from('investitionen')
        .update({
          einsparung_gesamt_jahr: result.jahresEinsparung,
          co2_einsparung_kg_jahr: result.co2Einsparung,
          einsparungen_jahr: { gesamt: result.jahresEinsparung }
        })
        .eq('id', inv.id)

      if (updateError) {
        console.log(`  ❌ Fehler bei ${inv.bezeichnung}: ${updateError.message}`)
        errors++
      } else {
        const vorher = inv.einsparung_gesamt_jahr || 0
        const diff = result.jahresEinsparung - vorher
        console.log(`  ✓ ${inv.bezeichnung} (${inv.typ}): ${result.jahresEinsparung}€/Jahr, ${result.co2Einsparung}kg CO2 ${diff !== 0 ? `(vorher: ${vorher}€, Diff: ${diff > 0 ? '+' : ''}${diff}€)` : ''}`)
        updated++
      }
    } else {
      console.log(`  ⚠ ${inv.bezeichnung} (${inv.typ}): Keine Parameter für Berechnung`)
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
