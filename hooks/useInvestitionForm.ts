// hooks/useInvestitionForm.ts
// Custom Hook fur Investitions-Formular State und Logik

'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  InvestitionsTyp,
  getInitialFormData,
  getInitialParameterData
} from '@/lib/investitionTypes'
import { berechneEinsparungen, berechneMehrkosten } from '@/lib/investitionCalculations'

interface UseInvestitionFormProps {
  mitgliedId: string
  editData?: any
  onSuccess?: () => void
}

export function useInvestitionForm({ mitgliedId, editData, onSuccess }: UseInvestitionFormProps) {
  const router = useRouter()
  const isEditing = !!editData

  const [typ, setTyp] = useState<InvestitionsTyp>(editData?.typ || 'e-auto')
  const [formData, setFormData] = useState(getInitialFormData(editData))
  const [parameterData, setParameterData] = useState(getInitialParameterData(editData))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PV-Module: Parent-Investition (Wechselrichter)
  const [parentInvestitionId, setParentInvestitionId] = useState(
    editData?.parent_investition_id || ''
  )
  const [wechselrichter, setWechselrichter] = useState<any[]>([])

  // Wechselrichter laden fur PV-Module Dropdown
  const loadWechselrichter = useCallback(async () => {
    const { data } = await supabase
      .from('alternative_investitionen')
      .select('id, bezeichnung, parameter')
      .eq('mitglied_id', mitgliedId)
      .eq('typ', 'wechselrichter')
      .eq('aktiv', true)
      .order('bezeichnung')

    setWechselrichter(data || [])
  }, [mitgliedId])

  useEffect(() => {
    if (typ === 'pv-module') {
      loadWechselrichter()
    }
  }, [typ, loadWechselrichter])

  // Geokoordinaten aus Anlage vorschlagen (nur bei neuen PV-Modulen)
  useEffect(() => {
    if (typ === 'pv-module' && !editData) {
      const loadAnlageGeokoordinaten = async () => {
        const { data: anlage } = await supabase
          .from('anlagen')
          .select('standort_latitude, standort_longitude')
          .eq('mitglied_id', mitgliedId)
          .limit(1)
          .single()

        if (anlage?.standort_latitude && anlage?.standort_longitude) {
          setParameterData(prev => ({
            ...prev,
            geokoordinaten_lat: anlage.standort_latitude.toString(),
            geokoordinaten_lon: anlage.standort_longitude.toString()
          }))
        }
      }
      loadAnlageGeokoordinaten()
    }
  }, [typ, editData, mitgliedId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleParamChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setParameterData(prev => ({ ...prev, [name]: value }))
  }

  const mehrkosten = useMemo(() =>
    berechneMehrkosten(formData.anschaffungskosten_gesamt, formData.anschaffungskosten_alternativ),
    [formData.anschaffungskosten_gesamt, formData.anschaffungskosten_alternativ]
  )

  const berechneteWerte = useMemo(() =>
    berechneEinsparungen(
      typ,
      parseFloat(formData.kosten_jahr_gesamt) || 0,
      parseFloat(formData.kosten_jahr_alternativ_gesamt) || 0,
      parameterData
    ),
    [typ, formData.kosten_jahr_gesamt, formData.kosten_jahr_alternativ_gesamt, parameterData]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const investitionData = {
        mitglied_id: mitgliedId,
        typ: typ,
        bezeichnung: formData.bezeichnung,
        anschaffungsdatum: formData.anschaffungsdatum,
        anschaffungskosten_gesamt: parseFloat(formData.anschaffungskosten_gesamt),
        anschaffungskosten_alternativ: formData.anschaffungskosten_alternativ
          ? parseFloat(formData.anschaffungskosten_alternativ)
          : null,
        alternativ_beschreibung: formData.alternativ_beschreibung || null,
        kosten_jahr_aktuell: { gesamt: parseFloat(formData.kosten_jahr_gesamt) || 0 },
        kosten_jahr_alternativ: { gesamt: parseFloat(formData.kosten_jahr_alternativ_gesamt) || 0 },
        einsparungen_jahr: { gesamt: berechneteWerte.jahresEinsparung },
        einsparung_gesamt_jahr: berechneteWerte.jahresEinsparung,
        parameter: berechneteWerte.parameter,
        co2_einsparung_kg_jahr: berechneteWerte.co2Einsparung,
        notizen: formData.notizen || null,
        aktiv: true,
        parent_investition_id: typ === 'pv-module' ? parentInvestitionId || null : null
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('alternative_investitionen')
          .update(investitionData)
          .eq('id', editData.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('alternative_investitionen')
          .insert(investitionData)

        if (insertError) throw insertError
      }

      router.push('/investitionen')
      router.refresh()

      if (onSuccess) onSuccess()

    } catch (err: any) {
      console.error('Fehler beim Speichern:', err)
      setError(err.message || 'Fehler beim Speichern der Investition')
    } finally {
      setLoading(false)
    }
  }

  return {
    // State
    typ,
    setTyp,
    formData,
    parameterData,
    loading,
    error,
    isEditing,

    // PV-Module spezifisch
    parentInvestitionId,
    setParentInvestitionId,
    wechselrichter,

    // Handlers
    handleChange,
    handleParamChange,
    handleSubmit,

    // Berechnete Werte
    mehrkosten,
    berechneteWerte,

    // Navigation
    goBack: () => router.back()
  }
}
