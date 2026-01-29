// hooks/useInvestitionsFilter.ts
// Hook zum Laden von Investitions-Counts für dynamische Navigation

'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'

interface InvestitionsCounts {
  hasEAutos: boolean
  hasWaermepumpen: boolean
  hasSpeicher: boolean
  hasInvestitionen: boolean
}

export function useInvestitionsFilter(): InvestitionsCounts {
  const [counts, setCounts] = useState<InvestitionsCounts>({
    hasEAutos: false,
    hasWaermepumpen: false,
    hasSpeicher: false,
    hasInvestitionen: false
  })

  useEffect(() => {
    async function loadCounts() {
      try {
        const supabase = createBrowserClient()

        // E-Autos zählen (FRESH-START: haushalt_komponenten)
        const { count: eAutosCount } = await supabase
          .from('haushalt_komponenten')
          .select('*', { count: 'exact', head: true })
          .eq('typ', 'e-auto')
          .eq('aktiv', true)

        // Wärmepumpen zählen (FRESH-START: haushalt_komponenten)
        const { count: waermepumpenCount } = await supabase
          .from('haushalt_komponenten')
          .select('*', { count: 'exact', head: true })
          .eq('typ', 'waermepumpe')
          .eq('aktiv', true)

        // Speicher zählen (FRESH-START: anlagen_komponenten)
        const { count: speicherCount } = await supabase
          .from('anlagen_komponenten')
          .select('*', { count: 'exact', head: true })
          .eq('typ', 'speicher')
          .eq('aktiv', true)

        // Alle Komponenten zählen (Haushalts + Anlagen)
        const { count: haushaltCount } = await supabase
          .from('haushalt_komponenten')
          .select('*', { count: 'exact', head: true })
          .eq('aktiv', true)

        const { count: anlagenCount } = await supabase
          .from('anlagen_komponenten')
          .select('*', { count: 'exact', head: true })
          .eq('aktiv', true)

        setCounts({
          hasEAutos: (eAutosCount || 0) > 0,
          hasWaermepumpen: (waermepumpenCount || 0) > 0,
          hasSpeicher: (speicherCount || 0) > 0,
          hasInvestitionen: ((haushaltCount || 0) + (anlagenCount || 0)) > 0
        })
      } catch (error) {
        console.error('Fehler beim Laden der Investitions-Counts:', error)
      }
    }

    loadCounts()
  }, [])

  return counts
}
