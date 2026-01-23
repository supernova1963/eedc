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
  betriebskosten_jahr_euro: string
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

export function berechneEAutoEinsparungen(params: EAutoParams): { co2Einsparung: number; parameter: Record<string, any> } {
  const kmJahr = parseFloat(params.km_jahr) || 0
  const verbrauchKwh = parseFloat(params.verbrauch_kwh_100km) || 0
  const pvAnteil = parseFloat(params.pv_anteil_prozent) || 0
  const verbrauchL = parseFloat(params.vergleich_verbrenner_l_100km) || 0

  const stromGesamt = (kmJahr / 100) * verbrauchKwh
  const stromPV = stromGesamt * (pvAnteil / 100)
  const stromNetz = stromGesamt - stromPV

  // CO2: Verbrenner vs E-Auto mit PV
  const co2Benzin = (kmJahr / 100) * verbrauchL * CO2_FAKTOREN.benzin_pro_liter
  const co2Strom = stromNetz * CO2_FAKTOREN.strom_netz_pro_kwh
  const co2Einsparung = co2Benzin - co2Strom

  return {
    co2Einsparung: Math.round(co2Einsparung),
    parameter: {
      km_jahr: kmJahr,
      verbrauch_kwh_100km: verbrauchKwh,
      verbrauch_gesamt_kwh_jahr: Math.round(stromGesamt),
      pv_anteil_prozent: pvAnteil,
      pv_ladung_kwh_jahr: Math.round(stromPV),
      netz_ladung_kwh_jahr: Math.round(stromNetz),
      vergleich_verbrenner_l_100km: verbrauchL,
      benzinpreis_euro_liter: parseFloat(params.benzinpreis_euro_liter) || 0,
      betriebskosten_jahr_euro: parseFloat(params.betriebskosten_jahr_euro) || 0
    }
  }
}

export function berechneWaermepumpeEinsparungen(params: WaermepumpeParams): { co2Einsparung: number; parameter: Record<string, any> } {
  const waermebedarf = parseFloat(params.waermebedarf_kwh_jahr) || 0
  const jaz = parseFloat(params.jaz) || 3.5
  const pvAnteil = parseFloat(params.pv_anteil_prozent) || 40

  const stromVerbrauch = waermebedarf / jaz
  const stromPV = stromVerbrauch * (pvAnteil / 100)
  const stromNetz = stromVerbrauch - stromPV

  let co2Alt = 0
  if (params.alter_energietraeger === 'Gas') {
    co2Alt = waermebedarf * CO2_FAKTOREN.gas_pro_kwh
  } else if (params.alter_energietraeger === 'Ol') {
    co2Alt = waermebedarf * CO2_FAKTOREN.oel_pro_kwh
  }

  const co2Neu = stromNetz * CO2_FAKTOREN.strom_netz_pro_kwh
  const co2Einsparung = co2Alt - co2Neu

  return {
    co2Einsparung: Math.round(co2Einsparung),
    parameter: {
      heizlast_kw: parseFloat(params.heizlast_kw) || 0,
      jaz: jaz,
      waermebedarf_kwh_jahr: waermebedarf,
      strom_verbrauch_kwh_jahr: Math.round(stromVerbrauch),
      pv_anteil_prozent: pvAnteil,
      alter_energietraeger: params.alter_energietraeger,
      alter_preis_cent_kwh: parseFloat(params.alter_preis_cent_kwh) || 0,
      betriebskosten_jahr_euro: parseFloat(params.betriebskosten_jahr_euro) || 0
    }
  }
}

export function berechneSpeicherEinsparungen(params: SpeicherParams): { co2Einsparung: number; parameter: Record<string, any> } {
  const kapazitaet = parseFloat(params.kapazitaet_kwh) || 0
  const wirkungsgrad = parseFloat(params.wirkungsgrad_prozent) || 95
  const jahreszyklen = 250

  const nutzbareSpeicherung = kapazitaet * jahreszyklen * (wirkungsgrad / 100)
  const co2Einsparung = nutzbareSpeicherung * CO2_FAKTOREN.strom_netz_pro_kwh

  return {
    co2Einsparung: Math.round(co2Einsparung),
    parameter: {
      kapazitaet_kwh: kapazitaet,
      wirkungsgrad_prozent: wirkungsgrad,
      jahreszyklen: jahreszyklen,
      nutzbare_speicherung_kwh_jahr: Math.round(nutzbareSpeicherung),
      betriebskosten_jahr_euro: parseFloat(params.betriebskosten_jahr_euro) || 0
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
  const jahresEinsparung = kostenAlternativ - kostenGesamt
  let co2Einsparung = 0
  let parameter: Record<string, any> = {}

  switch (typ) {
    case 'e-auto': {
      const result = berechneEAutoEinsparungen(parameterData as EAutoParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
      break
    }
    case 'waermepumpe': {
      const result = berechneWaermepumpeEinsparungen(parameterData as WaermepumpeParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
      break
    }
    case 'speicher': {
      const result = berechneSpeicherEinsparungen(parameterData as SpeicherParams)
      co2Einsparung = result.co2Einsparung
      parameter = result.parameter
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
