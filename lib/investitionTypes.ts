// lib/investitionTypes.ts
// Zentrale Konfiguration für Investitionstypen

export type InvestitionsTyp = 'e-auto' | 'waermepumpe' | 'speicher' | 'balkonkraftwerk' | 'wallbox' | 'wechselrichter' | 'pv-module' | 'sonstiges'

export interface InvestitionTypConfig {
  label: string
  hasAlternative: boolean
  kostenHilfe: {
    aktuell: string
    alternativ: string
  }
}

export const INVESTITION_TYPEN: Record<InvestitionsTyp, InvestitionTypConfig> = {
  'e-auto': {
    label: 'E-Auto',
    hasAlternative: true,
    kostenHilfe: {
      aktuell: 'z.B. Versicherung (800) + Steuer (0) + Wartung (200) + Strom-Anteil vom Netz (ca. 300) = 1.300',
      alternativ: 'z.B. Versicherung (900) + Steuer (200) + Wartung (600) + Benzin (2.000) = 3.700'
    }
  },
  'waermepumpe': {
    label: 'Warmepumpe',
    hasAlternative: true,
    kostenHilfe: {
      aktuell: 'z.B. Wartung (150) + Strom-Anteil vom Netz (ca. 1.100) = 1.250',
      alternativ: 'z.B. Wartung (200) + Schornsteinfeger (80) + Gas/Ol (1.600) = 1.880'
    }
  },
  'speicher': {
    label: 'Batteriespeicher',
    hasAlternative: false,
    kostenHilfe: {
      aktuell: 'Meist keine laufenden Kosten (0)',
      alternativ: 'Ohne Speicher: Hohere Netzbezugskosten (wird automatisch berechnet)'
    }
  },
  'balkonkraftwerk': {
    label: 'Balkonkraftwerk',
    hasAlternative: false,
    kostenHilfe: {
      aktuell: 'Meist keine laufenden Kosten (0)',
      alternativ: 'Ohne BKW: Hohere Netzbezugskosten'
    }
  },
  'wallbox': {
    label: 'Wallbox',
    hasAlternative: false,
    kostenHilfe: {
      aktuell: 'Wartung, Strom',
      alternativ: 'Ohne Wallbox'
    }
  },
  'wechselrichter': {
    label: 'Wechselrichter',
    hasAlternative: false,
    kostenHilfe: {
      aktuell: 'Wartung, laufende Kosten (meist 0)',
      alternativ: 'Nicht relevant'
    }
  },
  'pv-module': {
    label: 'PV-Module',
    hasAlternative: false,
    kostenHilfe: {
      aktuell: 'Wartung, Reinigung (Schatzung)',
      alternativ: 'Ohne PV: Hohere Netzbezugskosten'
    }
  },
  'sonstiges': {
    label: 'Sonstiges',
    hasAlternative: false,
    kostenHilfe: {
      aktuell: 'Alle laufenden Kosten zusammen',
      alternativ: 'Kosten der Alternative'
    }
  }
}

export const INVESTITION_TYP_OPTIONS = [
  { value: 'e-auto', label: 'E-Auto' },
  { value: 'waermepumpe', label: 'Warmepumpe' },
  { value: 'speicher', label: 'Batteriespeicher' },
  { value: 'balkonkraftwerk', label: 'Balkonkraftwerk' },
  { value: 'wallbox', label: 'Wallbox' },
  { value: 'wechselrichter', label: 'Wechselrichter' },
  { value: 'pv-module', label: 'PV-Module' },
  { value: 'sonstiges', label: 'Sonstiges' }
]

export const DEFAULT_PARAMETER = {
  'e-auto': {
    pv_anteil_prozent: '70',
    benzinpreis_euro_liter: '1.69'
  },
  'waermepumpe': {
    jaz: '3.5',
    pv_anteil_prozent: '40',
    alter_energietraeger: 'Gas',
    alter_preis_cent_kwh: '8'
  },
  'speicher': {
    wirkungsgrad_prozent: '95'
  },
  'balkonkraftwerk': {},
  'wechselrichter': {
    wirkungsgrad_prozent_wr: '98'
  },
  'pv-module': {
    ausrichtung: 'Sud',
    neigung_grad: '30'
  }
}

// Initiale Formular-Daten
export function getInitialFormData(editData?: any) {
  return {
    bezeichnung: editData?.bezeichnung || '',
    anschaffungsdatum: editData?.anschaffungsdatum || new Date().toISOString().split('T')[0],
    anschaffungskosten_gesamt: editData?.anschaffungskosten_gesamt?.toString() || '',
    anschaffungskosten_alternativ: editData?.anschaffungskosten_alternativ?.toString() || '',
    alternativ_beschreibung: editData?.alternativ_beschreibung || '',
    kosten_jahr_gesamt: editData?.kosten_jahr_aktuell
      ? Object.values(editData.kosten_jahr_aktuell).reduce((a: number, b: any) => a + (parseFloat(b) || 0), 0).toString()
      : '',
    kosten_jahr_alternativ_gesamt: editData?.kosten_jahr_alternativ
      ? Object.values(editData.kosten_jahr_alternativ).reduce((a: number, b: any) => a + (parseFloat(b) || 0), 0).toString()
      : '',
    notizen: editData?.notizen || ''
  }
}

// Initiale Parameter-Daten
export function getInitialParameterData(editData?: any) {
  return {
    // E-Auto
    km_jahr: editData?.parameter?.km_jahr?.toString() || '',
    verbrauch_kwh_100km: editData?.parameter?.verbrauch_kwh_100km?.toString() || '',
    pv_anteil_prozent: editData?.parameter?.pv_anteil_prozent?.toString() || '70',
    vergleich_verbrenner_l_100km: editData?.parameter?.vergleich_verbrenner_l_100km?.toString() || '',
    benzinpreis_euro_liter: editData?.parameter?.benzinpreis_euro_liter?.toString() || '1.69',

    // Warmepumpe
    heizlast_kw: editData?.parameter?.heizlast_kw?.toString() || '',
    jaz: editData?.parameter?.jaz?.toString() || '3.5',
    waermebedarf_kwh_jahr: editData?.parameter?.waermebedarf_kwh_jahr?.toString() || '',
    alter_energietraeger: editData?.parameter?.alter_energietraeger || 'Gas',
    alter_preis_cent_kwh: editData?.parameter?.alter_preis_cent_kwh?.toString() || '8',

    // Speicher
    kapazitaet_kwh: editData?.parameter?.kapazitaet_kwh?.toString() || '',
    wirkungsgrad_prozent: editData?.parameter?.wirkungsgrad_prozent?.toString() || '95',

    // Balkonkraftwerk
    leistung_kwp: editData?.parameter?.leistung_kwp?.toString() || '',
    jahresertrag_kwh_prognose: editData?.parameter?.jahresertrag_kwh_prognose?.toString() || '',

    // Wechselrichter
    leistung_ac_kw: editData?.parameter?.leistung_ac_kw?.toString() || '',
    leistung_dc_kw: editData?.parameter?.leistung_dc_kw?.toString() || '',
    hersteller_wr: editData?.parameter?.hersteller_wr || '',
    modell_wr: editData?.parameter?.modell_wr || '',
    wirkungsgrad_prozent_wr: editData?.parameter?.wirkungsgrad_prozent_wr?.toString() || '98',

    // PV-Module
    leistung_kwp_pv: editData?.parameter?.leistung_kwp_pv?.toString() || '',
    anzahl_module: editData?.parameter?.anzahl_module?.toString() || '',
    hersteller_pv: editData?.parameter?.hersteller_pv || '',
    modell_pv: editData?.parameter?.modell_pv || '',
    ausrichtung: editData?.parameter?.ausrichtung || 'Sud',
    neigung_grad: editData?.parameter?.neigung_grad?.toString() || '30',
    geokoordinaten_lat: editData?.parameter?.geokoordinaten?.lat?.toString() || '',
    geokoordinaten_lon: editData?.parameter?.geokoordinaten?.lon?.toString() || '',
    jahresertrag_prognose_kwh_pv: editData?.parameter?.jahresertrag_prognose_kwh_pv?.toString() || '',

    // Betriebskosten (fur alle Typen)
    betriebskosten_jahr_euro: editData?.parameter?.betriebskosten_jahr_euro?.toString() || ''
  }
}
