# InvestitionFormSimple.tsx - Updates für Wechselrichter & PV-Module

## 1. Type erweitern (Zeile 16)

```typescript
// VORHER:
type InvestitionsTyp = 'e-auto' | 'waermepumpe' | 'speicher' | 'balkonkraftwerk' | 'wallbox' | 'sonstiges'

// NACHHER:
type InvestitionsTyp = 'e-auto' | 'waermepumpe' | 'speicher' | 'balkonkraftwerk' | 'wallbox' | 'wechselrichter' | 'pv-module' | 'sonstiges'
```

## 2. States erweitern (Zeile ~44)

```typescript
const [parameterData, setParameterData] = useState({
  // ... existing parameters ...
  
  // Wechselrichter (NEU)
  leistung_ac_kw: editData?.parameter?.leistung_ac_kw?.toString() || '',
  leistung_dc_kw: editData?.parameter?.leistung_dc_kw?.toString() || '',
  hersteller_wr: editData?.parameter?.hersteller_wr || '',
  modell_wr: editData?.parameter?.modell_wr || '',
  wirkungsgrad_prozent_wr: editData?.parameter?.wirkungsgrad_prozent_wr?.toString() || '98',
  
  // PV-Module (NEU)
  leistung_kwp_pv: editData?.parameter?.leistung_kwp_pv?.toString() || '',
  anzahl_module: editData?.parameter?.anzahl_module?.toString() || '',
  hersteller_pv: editData?.parameter?.hersteller_pv || '',
  modell_pv: editData?.parameter?.modell_pv || '',
  ausrichtung: editData?.parameter?.ausrichtung || 'Süd',
  neigung_grad: editData?.parameter?.neigung_grad?.toString() || '30',
  geokoordinaten_lat: editData?.parameter?.geokoordinaten?.lat?.toString() || '',
  geokoordinaten_lon: editData?.parameter?.geokoordinaten?.lon?.toString() || '',
  jahresertrag_prognose_kwh_pv: editData?.parameter?.jahresertrag_prognose_kwh_pv?.toString() || '',
  
  betriebskosten_jahr_euro: editData?.parameter?.betriebskosten_jahr_euro?.toString() || ''
})

// NEU: Parent-Investition (für PV-Module)
const [parentInvestitionId, setParentInvestitionId] = useState(
  editData?.parent_investition_id || ''
)

// NEU: Wechselrichter-Liste laden
const [wechselrichter, setWechselrichter] = useState<any[]>([])
```

## 3. Wechselrichter laden (nach useState, vor return)

```typescript
// Wechselrichter laden für PV-Module Dropdown
useEffect(() => {
  if (typ === 'pv-module') {
    loadWechselrichter()
  }
}, [typ])

const loadWechselrichter = async () => {
  const { data } = await supabase
    .from('alternative_investitionen')
    .select('id, bezeichnung, parameter')
    .eq('mitglied_id', mitgliedId)
    .eq('typ', 'wechselrichter')
    .eq('aktiv', true)
    .order('bezeichnung')
  
  setWechselrichter(data || [])
}
```

## 4. Geokoordinaten vorschlagen (useEffect nach loadWechselrichter)

```typescript
// Geokoordinaten aus Anlage vorschlagen
useEffect(() => {
  if (typ === 'pv-module' && !editData) {
    loadAnlageGeokoordinaten()
  }
}, [typ])

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
```

## 5. Typ-Dropdown erweitern (im JSX, Zeile ~280)

```typescript
<option value="wechselrichter">🔌 Wechselrichter</option>
<option value="pv-module">☀️ PV-Module</option>
```

## 6. Parameter-Berechnungen erweitern (in berechneEinsparungen)

```typescript
else if (typ === 'wechselrichter') {
  parameter = {
    leistung_ac_kw: parseFloat(parameterData.leistung_ac_kw) || 0,
    leistung_dc_kw: parseFloat(parameterData.leistung_dc_kw) || 0,
    hersteller_wr: parameterData.hersteller_wr,
    modell_wr: parameterData.modell_wr,
    wirkungsgrad_prozent_wr: parseFloat(parameterData.wirkungsgrad_prozent_wr) || 98,
    betriebskosten_jahr_euro: parseFloat(parameterData.betriebskosten_jahr_euro) || 0
  }
}
else if (typ === 'pv-module') {
  const leistungKwp = parseFloat(parameterData.leistung_kwp_pv) || 0
  const jahresertragPrognose = parseFloat(parameterData.jahresertrag_prognose_kwh_pv) || 0
  
  parameter = {
    leistung_kwp_pv: leistungKwp,
    anzahl_module: parseInt(parameterData.anzahl_module) || 0,
    hersteller_pv: parameterData.hersteller_pv,
    modell_pv: parameterData.modell_pv,
    ausrichtung: parameterData.ausrichtung,
    neigung_grad: parseFloat(parameterData.neigung_grad) || 0,
    geokoordinaten: {
      lat: parseFloat(parameterData.geokoordinaten_lat) || null,
      lon: parseFloat(parameterData.geokoordinaten_lon) || null
    },
    jahresertrag_prognose_kwh_pv: jahresertragPrognose,
    betriebskosten_jahr_euro: parseFloat(parameterData.betriebskosten_jahr_euro) || 0
  }
  
  // Einfache CO2-Schätzung (später durch PVGIS ersetzen)
  co2Einsparung = jahresertragPrognose * 0.38
}
```

## 7. Submit-Handler erweitern (beim INSERT)

```typescript
const investitionData = {
  mitglied_id: mitgliedId,
  typ,
  bezeichnung: formData.bezeichnung,
  // ... existing fields ...
  parent_investition_id: typ === 'pv-module' ? parentInvestitionId || null : null  // NEU
}
```

## 8. JSX Parameter-Formulare hinzufügen (nach Balkonkraftwerk-Sektion)

Siehe separate Datei: PARAMETER_FORMS.tsx

