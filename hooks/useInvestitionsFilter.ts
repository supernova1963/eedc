// hooks/useInvestitionsFilter.ts
// Hook zum Laden von Investitions-Counts für dynamische Navigation

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
        // E-Autos zählen
        const { count: eAutosCount } = await supabase
          .from('alternative_investitionen')
          .select('*', { count: 'exact', head: true })
          .eq('typ', 'e-auto')
          .eq('aktiv', true)

        // Wärmepumpen zählen
        const { count: waermepumpenCount } = await supabase
          .from('alternative_investitionen')
          .select('*', { count: 'exact', head: true })
          .eq('typ', 'waermepumpe')
          .eq('aktiv', true)

        // Speicher zählen
        const { count: speicherCount } = await supabase
          .from('alternative_investitionen')
          .select('*', { count: 'exact', head: true })
          .eq('typ', 'speicher')
          .eq('aktiv', true)

        // Alle Investitionen zählen
        const { count: investitionenCount } = await supabase
          .from('investitionen_uebersicht')
          .select('*', { count: 'exact', head: true })

        setCounts({
          hasEAutos: (eAutosCount || 0) > 0,
          hasWaermepumpen: (waermepumpenCount || 0) > 0,
          hasSpeicher: (speicherCount || 0) > 0,
          hasInvestitionen: (investitionenCount || 0) > 0
        })
      } catch (error) {
        console.error('Fehler beim Laden der Investitions-Counts:', error)
      }
    }

    loadCounts()
  }, [])

  return counts
}
