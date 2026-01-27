// lib/community.ts
// Helper-Funktionen für Community-Features

import { createClient } from './supabase-server'

export interface AnlagenFreigabe {
  anlage_id: string
  profil_oeffentlich: boolean
  kennzahlen_oeffentlich: boolean
  auswertungen_oeffentlich: boolean
  investitionen_oeffentlich: boolean
  monatsdaten_oeffentlich: boolean
  standort_genau: boolean
}

export interface PublicAnlage {
  id: string
  anlagenname: string
  anlagentyp: string
  installationsdatum: string
  leistung_kwp: number
  standort_ort?: string
  standort_plz?: string
  standort_latitude?: number
  standort_longitude?: number
  batteriekapazitaet_kwh?: number
  ekfz_vorhanden?: boolean
  waermepumpe_vorhanden?: boolean
  // Freigabe-Info
  freigaben: AnlagenFreigabe
  // Optional: Mitglied-Info (anonymisiert)
  mitglied_vorname?: string
  mitglied_ort?: string
}

/**
 * Holt alle öffentlichen Anlagen (mit Profil-Freigabe)
 * Nutzt Security Definer Function zur Vermeidung von RLS-Zirkelbezügen
 */
export async function getPublicAnlagen(filters?: {
  ort?: string
  plz?: string
  minLeistung?: number
  maxLeistung?: number
  hatBatterie?: boolean
  hatEAuto?: boolean
  hatWaermepumpe?: boolean
}): Promise<PublicAnlage[]> {
  const supabase = await createClient()

  // Nutze die Security Definer Function (umgeht RLS)
  const { data: basicData, error } = await supabase.rpc('get_public_anlagen_with_members')

  if (error || !basicData) {
    console.error('Error fetching public anlagen:', error)
    return []
  }

  // Hole zusätzliche Detaildaten und Freigaben für die Anlagen
  const anlageIds = basicData.map((a: any) => a.anlage_id)

  const { data: detailData } = await supabase
    .from('anlagen')
    .select(`
      id,
      standort_latitude,
      standort_longitude,
      batteriekapazitaet_kwh,
      ekfz_vorhanden,
      waermepumpe_vorhanden,
      anlagen_freigaben (
        anlage_id,
        profil_oeffentlich,
        kennzahlen_oeffentlich,
        auswertungen_oeffentlich,
        investitionen_oeffentlich,
        monatsdaten_oeffentlich,
        standort_genau
      )
    `)
    .in('id', anlageIds)

  // Merge basic + detail data
  const mergedData = basicData.map((basic: any) => {
    const detail = detailData?.find((d: any) => d.id === basic.anlage_id)
    const freigabe = detail?.anlagen_freigaben?.[0] || {
      standort_genau: false,
      kennzahlen_oeffentlich: false,
      auswertungen_oeffentlich: false,
      investitionen_oeffentlich: false,
      monatsdaten_oeffentlich: false,
    }

    return {
      id: basic.anlage_id,
      anlagenname: basic.anlagenname,
      anlagentyp: basic.anlagentyp,
      installationsdatum: basic.installationsdatum,
      leistung_kwp: basic.leistung_kwp,
      standort_ort: basic.standort_ort,
      standort_plz: freigabe.standort_genau ? basic.standort_plz : basic.standort_plz?.substring(0, 2) + 'XXX',
      standort_latitude: freigabe.standort_genau ? detail?.standort_latitude : null,
      standort_longitude: freigabe.standort_genau ? detail?.standort_longitude : null,
      batteriekapazitaet_kwh: detail?.batteriekapazitaet_kwh,
      ekfz_vorhanden: detail?.ekfz_vorhanden,
      waermepumpe_vorhanden: detail?.waermepumpe_vorhanden,
      freigaben: freigabe,
      mitglied_vorname: basic.mitglied_vorname,
      mitglied_ort: basic.mitglied_ort,
    }
  })

  // Filter anwenden (clientseitig nach RPC-Call)
  let filtered = mergedData

  if (filters?.ort) {
    filtered = filtered.filter((a: any) =>
      a.standort_ort?.toLowerCase().includes(filters.ort!.toLowerCase())
    )
  }
  if (filters?.plz) {
    filtered = filtered.filter((a: any) => a.standort_plz === filters.plz)
  }
  if (filters?.minLeistung) {
    filtered = filtered.filter((a: any) => a.leistung_kwp >= filters.minLeistung!)
  }
  if (filters?.maxLeistung) {
    filtered = filtered.filter((a: any) => a.leistung_kwp <= filters.maxLeistung!)
  }
  if (filters?.hatBatterie) {
    filtered = filtered.filter((a: any) => (a.batteriekapazitaet_kwh || 0) > 0)
  }
  if (filters?.hatEAuto) {
    filtered = filtered.filter((a: any) => a.ekfz_vorhanden === true)
  }
  if (filters?.hatWaermepumpe) {
    filtered = filtered.filter((a: any) => a.waermepumpe_vorhanden === true)
  }

  return filtered
}

/**
 * Holt eine einzelne öffentliche Anlage
 * Nutzt Security Definer Function zur Vermeidung von RLS-Zirkelbezügen
 */
export async function getPublicAnlage(anlageId: string): Promise<PublicAnlage | null> {
  const supabase = await createClient()

  // Nutze die Security Definer Function und filtere clientseitig
  const { data: allPublic, error } = await supabase.rpc('get_public_anlagen_with_members')

  if (error || !allPublic) {
    console.error('Error fetching public anlagen:', error)
    return null
  }

  // Finde die gesuchte Anlage
  const basicData = allPublic.find((a: any) => a.anlage_id === anlageId)
  if (!basicData) {
    return null
  }

  // Hole zusätzliche Detaildaten
  const { data: detailData } = await supabase
    .from('anlagen')
    .select(`
      id,
      standort_latitude,
      standort_longitude,
      hersteller,
      modell,
      anzahl_module,
      wechselrichter_modell,
      ausrichtung,
      neigungswinkel_grad,
      batteriekapazitaet_kwh,
      batterie_hersteller,
      batterie_modell,
      ekfz_vorhanden,
      ekfz_bezeichnung,
      waermepumpe_vorhanden,
      waermepumpe_bezeichnung,
      anlagen_freigaben (
        anlage_id,
        profil_oeffentlich,
        kennzahlen_oeffentlich,
        auswertungen_oeffentlich,
        investitionen_oeffentlich,
        monatsdaten_oeffentlich,
        standort_genau
      )
    `)
    .eq('id', anlageId)
    .single()

  if (!detailData) {
    return null
  }

  const freigabe = detailData.anlagen_freigaben?.[0] || {
    standort_genau: false,
    kennzahlen_oeffentlich: false,
    auswertungen_oeffentlich: false,
    investitionen_oeffentlich: false,
    monatsdaten_oeffentlich: false,
  }

  return {
    id: basicData.anlage_id,
    anlagenname: basicData.anlagenname,
    anlagentyp: basicData.anlagentyp,
    installationsdatum: basicData.installationsdatum,
    leistung_kwp: basicData.leistung_kwp,
    standort_ort: basicData.standort_ort,
    standort_plz: freigabe.standort_genau ? basicData.standort_plz : basicData.standort_plz?.substring(0, 2) + 'XXX',
    standort_latitude: freigabe.standort_genau ? detailData.standort_latitude : null,
    standort_longitude: freigabe.standort_genau ? detailData.standort_longitude : null,
    batteriekapazitaet_kwh: detailData.batteriekapazitaet_kwh,
    ekfz_vorhanden: detailData.ekfz_vorhanden,
    waermepumpe_vorhanden: detailData.waermepumpe_vorhanden,
    freigaben: freigabe,
    mitglied_vorname: basicData.mitglied_vorname,
    mitglied_ort: basicData.mitglied_ort,
  } as PublicAnlage
}

/**
 * Holt öffentliche Kennzahlen einer Anlage
 */
export async function getPublicKennzahlen(anlageId: string) {
  const supabase = await createClient()

  // Prüfe Freigabe
  const { data: freigabe } = await supabase
    .from('anlagen_freigaben')
    .select('kennzahlen_oeffentlich')
    .eq('anlage_id', anlageId)
    .single()

  if (!freigabe?.kennzahlen_oeffentlich) {
    return null
  }

  // Hole Kennzahlen aus View
  const { data, error } = await supabase
    .from('anlagen_kennzahlen')
    .select('*')
    .eq('anlage_id', anlageId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Holt öffentliche Monatsdaten einer Anlage
 */
export async function getPublicMonatsdaten(anlageId: string, jahr?: number) {
  const supabase = await createClient()

  // Prüfe Freigabe
  const { data: freigabe } = await supabase
    .from('anlagen_freigaben')
    .select('monatsdaten_oeffentlich')
    .eq('anlage_id', anlageId)
    .single()

  if (!freigabe?.monatsdaten_oeffentlich) {
    return []
  }

  let query = supabase
    .from('monatsdaten')
    .select('*')
    .eq('anlage_id', anlageId)
    .order('jahr', { ascending: false })
    .order('monat', { ascending: false })

  if (jahr) {
    query = query.eq('jahr', jahr)
  }

  const { data, error } = await query

  if (error || !data) {
    return []
  }

  return data
}

/**
 * Community-Statistiken
 * Nutzt Security Definer Function zur Vermeidung von RLS-Zirkelbezügen
 */
export async function getCommunityStats() {
  const supabase = await createClient()

  const { count: anlagenCount } = await supabase
    .from('anlagen')
    .select('*', { count: 'exact', head: true })
    .eq('aktiv', true)

  // Nutze RPC-Function für öffentliche Anlagen (umgeht RLS-Problem)
  const { data: publicAnlagen } = await supabase.rpc('get_public_anlagen_with_members')

  const publicCount = publicAnlagen?.length || 0
  const gesamtleistung = publicAnlagen?.reduce((sum: number, a: any) => sum + (a.leistung_kwp || 0), 0) || 0

  return {
    gesamtAnlagen: anlagenCount || 0,
    oeffentlicheAnlagen: publicCount,
    gesamtleistungKwp: Math.round(gesamtleistung * 10) / 10,
  }
}
