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
  profilbeschreibung?: string
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

  let query = supabase
    .from('anlagen')
    .select(`
      id,
      anlagenname,
      anlagentyp,
      installationsdatum,
      leistung_kwp,
      standort_ort,
      standort_plz,
      standort_latitude,
      standort_longitude,
      profilbeschreibung,
      batteriekapazitaet_kwh,
      ekfz_vorhanden,
      waermepumpe_vorhanden,
      anlagen_freigaben!inner (
        anlage_id,
        profil_oeffentlich,
        kennzahlen_oeffentlich,
        auswertungen_oeffentlich,
        investitionen_oeffentlich,
        monatsdaten_oeffentlich,
        standort_genau
      ),
      mitglieder!inner (
        vorname,
        ort
      )
    `)
    .eq('aktiv', true)
    .eq('anlagen_freigaben.profil_oeffentlich', true)

  // Filter anwenden
  if (filters?.ort) {
    query = query.ilike('standort_ort', `%${filters.ort}%`)
  }
  if (filters?.plz) {
    query = query.eq('standort_plz', filters.plz)
  }
  if (filters?.minLeistung) {
    query = query.gte('leistung_kwp', filters.minLeistung)
  }
  if (filters?.maxLeistung) {
    query = query.lte('leistung_kwp', filters.maxLeistung)
  }
  if (filters?.hatBatterie) {
    query = query.gt('batteriekapazitaet_kwh', 0)
  }
  if (filters?.hatEAuto) {
    query = query.eq('ekfz_vorhanden', true)
  }
  if (filters?.hatWaermepumpe) {
    query = query.eq('waermepumpe_vorhanden', true)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('Error fetching public anlagen:', error)
    return []
  }

  // Daten transformieren
  return data.map((anlage: any) => {
    const freigabe = anlage.anlagen_freigaben
    const mitglied = anlage.mitglieder

    return {
      id: anlage.id,
      anlagenname: anlage.anlagenname,
      anlagentyp: anlage.anlagentyp,
      installationsdatum: anlage.installationsdatum,
      leistung_kwp: anlage.leistung_kwp,
      standort_ort: anlage.standort_ort,
      standort_plz: freigabe.standort_genau ? anlage.standort_plz : anlage.standort_plz?.substring(0, 2) + 'XXX',
      standort_latitude: freigabe.standort_genau ? anlage.standort_latitude : null,
      standort_longitude: freigabe.standort_genau ? anlage.standort_longitude : null,
      profilbeschreibung: anlage.profilbeschreibung,
      batteriekapazitaet_kwh: anlage.batteriekapazitaet_kwh,
      ekfz_vorhanden: anlage.ekfz_vorhanden,
      waermepumpe_vorhanden: anlage.waermepumpe_vorhanden,
      freigaben: freigabe,
      mitglied_vorname: mitglied.vorname,
      mitglied_ort: mitglied.ort,
    }
  })
}

/**
 * Holt eine einzelne öffentliche Anlage
 */
export async function getPublicAnlage(anlageId: string): Promise<PublicAnlage | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('anlagen')
    .select(`
      id,
      anlagenname,
      anlagentyp,
      installationsdatum,
      leistung_kwp,
      standort_ort,
      standort_plz,
      standort_latitude,
      standort_longitude,
      profilbeschreibung,
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
      anlagen_freigaben!inner (
        anlage_id,
        profil_oeffentlich,
        kennzahlen_oeffentlich,
        auswertungen_oeffentlich,
        investitionen_oeffentlich,
        monatsdaten_oeffentlich,
        standort_genau
      ),
      mitglieder!inner (
        vorname,
        ort
      )
    `)
    .eq('id', anlageId)
    .eq('aktiv', true)
    .eq('anlagen_freigaben.profil_oeffentlich', true)
    .single()

  if (error || !data) {
    return null
  }

  const freigabe = Array.isArray(data.anlagen_freigaben) ? data.anlagen_freigaben[0] : data.anlagen_freigaben
  const mitglied = Array.isArray(data.mitglieder) ? data.mitglieder[0] : data.mitglieder

  return {
    id: data.id,
    anlagenname: data.anlagenname,
    anlagentyp: data.anlagentyp,
    installationsdatum: data.installationsdatum,
    leistung_kwp: data.leistung_kwp,
    standort_ort: data.standort_ort,
    standort_plz: freigabe?.standort_genau ? data.standort_plz : data.standort_plz?.substring(0, 2) + 'XXX',
    standort_latitude: freigabe?.standort_genau ? data.standort_latitude : null,
    standort_longitude: freigabe?.standort_genau ? data.standort_longitude : null,
    profilbeschreibung: data.profilbeschreibung,
    batteriekapazitaet_kwh: data.batteriekapazitaet_kwh,
    ekfz_vorhanden: data.ekfz_vorhanden,
    waermepumpe_vorhanden: data.waermepumpe_vorhanden,
    freigaben: freigabe,
    mitglied_vorname: mitglied?.vorname,
    mitglied_ort: mitglied?.ort,
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
 */
export async function getCommunityStats() {
  const supabase = await createClient()

  const { count: anlagenCount } = await supabase
    .from('anlagen')
    .select('*', { count: 'exact', head: true })
    .eq('aktiv', true)

  const { count: publicCount } = await supabase
    .from('anlagen_freigaben')
    .select('*', { count: 'exact', head: true })
    .eq('profil_oeffentlich', true)

  const { data: leistungSum } = await supabase
    .from('anlagen')
    .select('leistung_kwp')
    .eq('aktiv', true)

  const gesamtleistung = leistungSum?.reduce((sum, a) => sum + (a.leistung_kwp || 0), 0) || 0

  return {
    gesamtAnlagen: anlagenCount || 0,
    oeffentlicheAnlagen: publicCount || 0,
    gesamtleistungKwp: Math.round(gesamtleistung * 10) / 10,
  }
}
