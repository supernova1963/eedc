'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Anlage {
  id: string
  anlagenname: string
  leistung_kwp: number
}

interface AnlagenSelectorProps {
  anlagen: Anlage[]
  currentAnlageId: string | null
}

export function AnlagenSelector({ anlagen, currentAnlageId }: AnlagenSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Zeige Selector nur wenn mehr als 1 Anlage
  if (anlagen.length <= 1) {
    return null
  }

  const handleChange = (newAnlageId: string) => {
    // Erstelle neue URL mit anlageId Parameter
    const params = new URLSearchParams(searchParams.toString())
    params.set('anlageId', newAnlageId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="anlage-selector" className="text-sm font-medium text-muted-foreground">
        Anlage:
      </label>
      <Select value={currentAnlageId || undefined} onValueChange={handleChange}>
        <SelectTrigger id="anlage-selector" className="w-[250px]">
          <SelectValue placeholder="Anlage wählen..." />
        </SelectTrigger>
        <SelectContent>
          {anlagen.map((anlage) => (
            <SelectItem key={anlage.id} value={anlage.id}>
              {anlage.anlagenname} ({anlage.leistung_kwp} kWp)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
