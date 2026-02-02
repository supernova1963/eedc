// lib/investitionCalculations.ts
// Berechnungslogik fur Investitionen (CO2, Einsparungen, etc.)

import { InvestitionsTyp } from './investitionTypes'

export interface BerechnungsErgebnis {
  jahresEinsparung: number
  co2Einsparung: number
  parameter: Record<string, any>
}

export interface EAutoParams {
  km_jahr: string
  verbrauch_kwh_100km: string
  pv_anteil_prozent: string
  vergleich_verbrenner_l_100km: string
  benzinpreis_euro_liter: string
  strompreis_cent_kwh: string
  betriebskosten_jahr_euro: string
  // V2H (Vehicle-to-Home)
  nutzt_v2h?: boolean
  v2h_entlade_preis_cent?: string
}

export interface WaermepumpeParams {
  heizlast_kw: string
  jaz: string
  waermebedarf_kwh_jahr: string
  pv_anteil_prozent: string
  alter_energietraeger: string
  alter_preis_cent_kwh: string
  betriebskosten_jahr_euro: string
}

export interface SpeicherParams {
  kapazitaet_kwh: string
  wirkungsgrad_prozent: string
  betriebskosten_jahr_euro: string
  // Arbitrage (dynamische Stromtarife)
  nutzt_arbitrage?: boolean
  lade_durchschnittspreis_cent?: string
  entlade_vermiedener_preis_cent?: string
}

export interface BalkonkraftwerkParams {
  leistung_kwp: string
  jahresertrag_kwh_prognose: string
  betriebskosten_jahr_euro: string
}

export interface WechselrichterParams {
  leistung_ac_kw: string
  leistung_dc_kw: string
  hersteller_wr: string
  modell_wr: string
  wirkungsgrad_prozent_wr: string
  betriebskosten_jahr_euro: string
}

export interface PVModuleParams {
  leistung_kwp_pv: string
  anzahl_module: string
  hersteller_pv: string
  modell_pv: string
  ausrichtung: string
  neigung_grad: string
  geokoordinaten_lat: string
  geokoordinaten_lon: string
  jahresertrag_prognose_kwh_pv: string
  betriebskosten_jahr_euro: string
}

// CO2-Faktoren (kg CO2 pro Einheit)
const CO2_FAKTOREN = {
  benzin_pro_liter: 2.37,
  strom_netz_pro_kwh: 0.38,
  gas_pro_kwh: 0.201,
  oel_pro_kwh: 0.266
}

export function berechneEAutoEinsparungen(params: EAutoParams): { co2Einsparung: number; jahresEinsparung: number; parameter: Record<string, any> } {
  const kmJahr = parseFloat(params.km_jahr) || 0
  const verbrauchKwh = parseFloat(params.verbrauch_kwh_100km) || 0
  const pvAnteil = parseFloat(params.pv_anteil_prozent) || 70
  const verbrauchL = parseFloat(params.vergleich_verbrenner_l_100km) || 0
  const benzinpreis = parseFloat(params.benzinpreis_euro_liter) || 1.69
  const betriebskosten = parseFloat(params.betriebskosten_jahr_euro) || 0

  const stromGesamt = (kmJahr / 100) * verbrauchKwh
  const stromPV = stromGesamt * (pvAnteil / 100)
  const stromNetz = stromGesamt - stromPV

  // CO2: Verbrenner vs E-Auto mit PV
  const co2Benzin = (kmJahr / 100) * verbrauchL * CO2_FAKTOREN.benzin_pro_liter
  const co2Strom = stromNetz * CO2_FAKTOREN.strom_netz_pro_kwh
  const co2Einsparung = co2Benzin - co2Strom

  const strompreis = parseFloat(params.strompreis_cent_kwh) || 30
  const stromkostenNetz = (stromNetz * strompreis) / 100

  // Kosten E-Auto: Stromkosten (nur Netz) + Betriebskosten
  const kostenEAuto = stromkostenNetz + betriebskosten

  // Kosten Verbrenner: Benzinkosten (Betriebskosten Verbrenner nicht berücksichtigt, da in Alternative separat)
  const benzinkosten = (kmJahr / 100) * verbrauchL * benzinpreis

  // Jahres-Einsparung = Verbrenner-Kosten - E-Auto-Kosten
  const jahresEinsparung = benzinkosten - kostenEAuto

  // V2H-Parameter
  const nutztV2h = params.nutzt_v2h === true
  const v2hEntladepreis = parseFloat(params.v2h_entlade_preis_cent || '') || 0

  return {
    co2Einsparung: Math.round(co2Einsparung),
    jahresEinsparung: Math.round(jahresEinsparung),
    parameter: {
      km_jahr: kmJahr,
      verbrauch_kwh_100km: verbrauchKwh,
      verbrauch_gesamt_kwh_jahr: Math.round(stromGesamt),
      pv_anteil_prozent: pvAnteil,
      pv_ladung_kwh_jahr: Math.round(stromPV),
      netz_ladung_kwh_jahr: Math.round(stromNetz),
      strompreis_cent_kwh: strompreis,
      stromkosten_jahr_euro: Math.round(stromkostenNetz),
      vergleich_verbrenner_l_100km: verbrauchL,
      benzinpreis_euro_liter: benzinpreis,
      benzinkosten_jahr_euro: Math.round(benzinkosten),
      betriebskosten_jahr_euro: betriebskosten,
      kosten_eauto_jahr_euro: Math.round(kostenEAuto),
      // V2H-Parameter
      nutzt_v2h: nutztV2h,
      v2h_entlade_preis_cent: nutztV2h ? v2hEntladepreis : undefined
    }
  }
}

export function berechneWaermepumpeEinsparungen(params: WaermepumpeParams, strompreis?: number): { co2Einsparung: number; jahresEinsparung: number; parameter: Record<string, any> } {
  const waermebedarf = parseFloat(params.waermebedarf_kwh_jahr) || 0
  const jaz = parseFloat(params.jaz) || 3.5
  const pvAnteil = parseFloat(params.pv_anteil_prozent) || 40
  const alterPreis = parseFloat(params.alter_preis_cent_kwh) || 8
  const betriebskosten = parseFloat(params.betriebskosten_jahr_euro) || 0
  const strompreisNetz = strompreis || 30

  const stromVerbrauch = waermebedarf / jaz
  const stromPV = stromVerbrauch * (pvAnteil / 100)
  const stromNetz = stromVerbrauch - stromPV

  let co2Alt = 0
  if (params.alter_energietraeger === 'Gas') {
    co2Alt = waermebedarf * CO2_FAKTOREN.gas_pro_kwh
  } else if (params.alter_energietraeger === 'Öl' || params.alter_energietraeger === 'Ol') {
    co2Alt = waermebedarf * CO2_FAKTOREN.oel_pro_kwh
  }

  const co2Neu = stromNetz * CO2_FAKTOREN.strom_netz_pro_kwh
  const co2Einsparung = co2Alt - co2Neu

  // Kosten alte Heizung: Wärmebedarf × alter Preis
  const kostenAlt = (waermebedarf * alterPreis) / 100

  // Kosten WP: Stromkosten (nur Netz) + Betriebskosten
  const stromkostenNetz = (stromNetz * strompreisNetz) / 100
  const kostenWP = stromkostenNetz + betriebskosten

  // Jahres-Einsparung = alte Kosten - WP-Kosten
  const jahresEinsparung = kostenAlt - kostenWP

  return {
    co2Einsparung: Math.round(co2Einsparung),
    jahresEinsparung: Math.round(jahresEinsparung),
    parameter: {
      heizlast_kw: parseFloat(params.heizlast_kw) || 0,
      jaz: jaz,
      waermebedarf_kwh_jahr: waermebedarf,
      strom_verbrauch_kwh_jahr: Math.round(stromVerbrauch),
      strom_pv_kwh_jahr: Math.round(stromPV),
      strom_netz_kwh_jahr: Math.round(stromNetz),
      pv_anteil_prozent: pvAnteil,
      strompreis_cent_kwh: strompreisNetz,
      stromkosten_jahr_euro: Math.round(stromkostenNetz),
      alter_energietraeger: params.alter_energietraeger,
      alter_preis_cent_kwh: alterPreis,
      kosten_alt_jahr_euro: Math.round(kostenAlt),
      betriebskosten_jahr_euro: betriebskosten,
      kosten_wp_jahr_euro: Math.round(kostenWP)
    }
  }
}

export function berechneSpeicherEinsparungen(params: SpeicherParams, strompreis?: number, einspeiseverguetung?: number): { co2Einsparung: number; jahresEinsparung: number; parameter: Record<string, any> } {
  const kapazitaet = parseFloat(params.kapazitaet_kwh) || 0
  const wirkungsgrad = parseFloat(params.wirkungsgrad_prozent) || 95
  const jahreszyklen = 250
  const betriebskosten = parseFloat(params.betriebskosten_jahr_euro) || 0
  const strompreisNetz = strompreis || 30
  const einspeisePreis = einspeiseverguetung || 8

  // Arbitrage-Parameter
  const nutztArbitrage = params.nutzt_arbitrage === true
  const ladeDurchschnittspreis = parseFloat(params.lade_durchschnittspreis_cent || '') || 15 // Typischer Nachtpreis
  const entladeVermiedenerPreis = parseFloat(params.entlade_vermiedener_preis_cent || '') || strompreisNetz

  const nutzbareSpeicherung = kapazitaet * jahreszyklen * (wirkungsgrad / 100)
  const co2Einsparung = nutzbareSpeicherung * CO2_FAKTOREN.strom_netz_pro_kwh

  let jahresEinsparung: number
  let differenzProKwh: number

  if (nutztArbitrage) {
    // Arbitrage-Modus: Günstig aus Netz laden, teuer entladen (vermiedene Kosten)
    // Annahme: 30% der Zyklen nutzen Arbitrage (Netzladung), 70% PV-Überschuss
    const arbitrageAnteil = 0.30
    const pvAnteil = 0.70

    // PV-Überschuss-Teil: Statt Einspeisung → Eigenverbrauch
    const pvDifferenz = (strompreisNetz - einspeisePreis) / 100
    const pvEinsparung = nutzbareSpeicherung * pvAnteil * pvDifferenz

    // Arbitrage-Teil: Günstig laden, teuer entladen
    const arbitrageDifferenz = (entladeVermiedenerPreis - ladeDurchschnittspreis) / 100
    const arbitrageEinsparung = nutzbareSpeicherung * arbitrageAnteil * arbitrageDifferenz

    jahresEinsparung = pvEinsparung + arbitrageEinsparung - betriebskosten
    differenzProKwh = (pvDifferenz * pvAnteil + arbitrageDifferenz * arbitrageAnteil) * 100
  } else {
    // Standard-Modus: Statt Einspeisung zum niedrigen Preis → Eigenverbrauch zum hohen Preis
    differenzProKwh = strompreisNetz - einspeisePreis
    jahresEinsparung = nutzbareSpeicherung * (differenzProKwh / 100) - betriebskosten
  }

  return {
    co2Einsparung: Math.round(co2Einsparung),
    jahresEinsparung: Math.round(jahresEinsparung),
    parameter: {
      kapazitaet_kwh: kapazitaet,
      wirkungsgrad_prozent: wirkungsgrad,
      jahreszyklen: jahreszyklen,
      nutzbare_speicherung_kwh_jahr: Math.round(nutzbareSpeicherung),
      strompreis_cent_kwh: strompreisNetz,
      einspeiseverguetung_cent_kwh: einspeisePreis,
      differenz_cent_kwh: Math.round(differenzProKwh * 10) / 10,
      betriebskosten_jahr_euro: betriebskosten,
      // Arbitrage-Parameter
      nutzt_arbitrage: nutztArbitrage,
      lade_durchschnittspreis_cent: nutztArbitrage ? ladeDurchschnittspreis : undefined,
      entlade_vermiedener_preis_cent: nutztArbitrage ? entladeVermiedenerPreis : undefined
    }
  }
}

export function berechneBalkonkraftwerkEinsparungen(params: BalkonkraftwerkParams): { co2Einsparung: number; parameter: Record<string, any> } {
  const ertrag = parseFloat(params.jahresertrag_kwh_prognose) || 0
  const co2Einsparung = ertrag * CO2_FAKTOREN.strom_netz_pro_kwh

  return {
    co2Einsparung: Math.round(co2Einsparung),
    parameter: {
      leistung_kwp: parseFloat(params.leistung_kwp) || 0,
      jahresertrag_kwh_prognose: ertrag,
      betriebskosten_jahr_euro: parseFloat(params.betriebskosten_jahr_euro) || 0
    }
  }
}

export function berechneWechselrichterEinsparungen(params: WechselrichterParams): { co2Einsparung: number; parameter: Record<string, any> } {
  // Wechselrichter hat keine direkte CO2-Einsparung (wird uber PV-Module berechnet)
  return {
    co2Einsparung: 0,
    parameter: {
      leistung_ac_kw: parseFloat(params.leistung_ac_kw) || 0,
      leistung_dc_kw: parseFloat(params.leistung_dc_kw) || 0,
      hersteller_wr: params.hersteller_wr,
      modell_wr: params.modell_wr,
      wirkungsgrad_prozent_wr: parseFloat(params.wirkungsgrad_prozent_wr) || 98,
      betriebskosten_jahr_euro: parseFloat(params.betriebskosten_jahr_euro) || 0
    }
  }
}

export function berechnePVModuleEinsparungen(params: PVModuleParams): { co2Einsparung: number; parameter: Record<string, any> } {
  const leistungKwp = parseFloat(params.leistung_kwp_pv) || 0
  const jahresertragPrognose = parseFloat(params.jahresertrag_prognose_kwh_pv) || 0

  // CO2-Einsparung basierend auf Jahresertrag
  const co2Einsparung = jahresertragPrognose * CO2_FAKTOREN.strom_netz_pro_kwh

  return {
    co2Einsparung: Math.round(co2Einsparung),
    parameter: {
      leistung_kwp_pv: leistungKwp,
      anzahl_module: parseInt(params.anzahl_module) || 0,
      hersteller_pv: params.hersteller_pv,
      modell_pv: params.modell_pv,
      ausrichtung: params.ausrichtung,
      neigung_grad: parseFloat(params.neigung_grad) || 0,
      geokoordinaten: {
        lat: parseFloat(params.geokoordinaten_lat) || null,
        lon: parseFloat(params.geokoordinaten_lon) || null
      },
      jahresertrag_prognose_kwh_pv: jahresertragPrognose,
      betriebskosten_jahr_euro: parseFloat(params.betriebskosten_jahr_euro) || 0
    }
  }
}

export function berechneEinsparungen(
  typ: InvestitionsTyp,
  kostenGesamt: number,
  kostenAlternativ: number,
  parameterData: Record<string, any>
): BerechnungsErgebnis {
  // Fallback: Manuelle Einsparung aus Kosten-Differenz
  let jahresEinsparung = kostenAlternativ - kostenGesamt
  let co2Einsparung = 0
  let parameter: Record<string, any> = {}

  switch (typ) {
    case 'e-auto': {
      const result = berechneEAutoEinsparungen(parameterData as EAutoParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
      // Automatische Berechnung aus Parametern hat Vorrang
      if (result.jahresEinsparung !== 0) {
        jahresEinsparung = result.jahresEinsparung
      }
      break
    }
    case 'waermepumpe': {
      const result = berechneWaermepumpeEinsparungen(parameterData as WaermepumpeParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
      if (result.jahresEinsparung !== 0) {
        jahresEinsparung = result.jahresEinsparung
      }
      break
    }
    case 'speicher': {
      const result = berechneSpeicherEinsparungen(parameterData as SpeicherParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
      if (result.jahresEinsparung !== 0) {
        jahresEinsparung = result.jahresEinsparung
      }
      break
    }
    case 'balkonkraftwerk': {
      const result = berechneBalkonkraftwerkEinsparungen(parameterData as BalkonkraftwerkParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
      break
    }
    case 'wechselrichter': {
      const result = berechneWechselrichterEinsparungen(parameterData as WechselrichterParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
      break
    }
    case 'pv-module': {
      const result = berechnePVModuleEinsparungen(parameterData as PVModuleParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
      break
    }
    default:
      parameter = { betriebskosten_jahr_euro: parseFloat(parameterData.betriebskosten_jahr_euro) || 0 }
  }

  return {
    jahresEinsparung: Math.round(jahresEinsparung),
    co2Einsparung,
    parameter
  }
}

export function berechneMehrkosten(anschaffungGesamt: string, anschaffungAlternativ: string): number {
  const gesamt = parseFloat(anschaffungGesamt) || 0
  const alternativ = parseFloat(anschaffungAlternativ) || 0

  if (gesamt && alternativ) {
    return gesamt - alternativ
  }
  return gesamt
}
