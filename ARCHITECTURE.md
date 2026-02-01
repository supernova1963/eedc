# EEDC Datenarchitektur

## Wichtige Design-Entscheidungen

### Investitionen vs. Anlagen

**WICHTIG:** Anschaffungskosten gehören NICHT in die `anlagen`-Tabelle!

```
anlagen                          investitionen
├── id                           ├── id
├── mitglied_id                  ├── mitglied_id
├── anlagenname                  ├── anlage_id (FK → anlagen)
├── leistung_kwp                 ├── typ (pv-anlage, speicher, e-auto, ...)
├── installationsdatum           ├── anschaffungskosten_gesamt ← HIER!
├── standort_*                   ├── anschaffungskosten_alternativ
├── (KEIN anschaffungskosten!)   ├── anschaffungskosten_relevant
└── ...                          └── ...
```

### Warum diese Trennung?

1. **Eine Anlage kann mehrere Investitionen haben:**
   - PV-Module (Erstinstallation)
   - Batteriespeicher (nachgerüstet)
   - Wallbox
   - Wechselrichter-Tausch
   - Erweiterung der Module

2. **ROI-Berechnung pro Investition:**
   - Jede Investition hat eigene Anschaffungskosten
   - Jede Investition hat eigene Einsparungen/Erträge
   - Amortisation wird pro Investition berechnet

3. **Flexibilität:**
   - Investitionen können unterschiedliche Anschaffungsdaten haben
   - Unterschiedliche Förderungen pro Investition
   - Nachträgliche Erweiterungen abbildbar

### ROI-Berechnung für PV-Anlage

```typescript
// RICHTIG: Summe der Investitionen zur Anlage
const anlageInvestitionen = investitionen.filter(inv => inv.anlage_id === anlage.id)
const gesamtInvestition = anlageInvestitionen.reduce((sum, inv) =>
  sum + toNum(inv.anschaffungskosten_gesamt), 0)

// FALSCH: Aus anlage lesen (Feld existiert nicht/ist leer!)
// const gesamtInvestition = anlage.anschaffungskosten_euro  ❌
```

### Tabellen-Übersicht

| Tabelle | Zweck | Anschaffungskosten? |
|---------|-------|---------------------|
| `anlagen` | Stammdaten der PV-Anlage (Leistung, Standort) | NEIN |
| `investitionen` | Alle Anschaffungen mit Kosten | JA |
| `monatsdaten` | Energiedaten pro Monat | NEIN |
| `investition_monatsdaten` | Verbrauchsdaten pro Investition/Monat | NEIN |

### Typische Investitions-Typen

| Typ | Beschreibung | anlage_id? |
|-----|--------------|------------|
| `pv-anlage` | Die PV-Module selbst | JA |
| `speicher` | Batteriespeicher | JA |
| `wechselrichter` | Wechselrichter | JA |
| `wallbox` | Ladestation | JA |
| `e-auto` | Elektrofahrzeug | Optional |
| `waermepumpe` | Wärmepumpe | Optional |

### Felder in investitionen

```sql
-- Kosten
anschaffungskosten_gesamt      -- Gesamtkosten
anschaffungskosten_alternativ  -- Kosten der Alternative (z.B. Verbrenner)
anschaffungskosten_relevant    -- = gesamt - alternativ (für ROI)

-- Zuordnung
anlage_id                      -- Zuordnung zur Anlage (für PV-Komponenten)
mitglied_id                    -- Besitzer

-- Prognose
einsparung_prognose_jahr       -- Erwartete Einsparung p.a.
einsparung_gesamt_jahr         -- Berechnete Einsparung aus Monatsdaten
```

## Checkliste bei Änderungen

- [ ] Brauche ich Anschaffungskosten? → `investitionen` Tabelle nutzen
- [ ] ROI berechnen? → Summe aus `investitionen` WHERE `anlage_id = anlage.id`
- [ ] Neue Komponente? → Als `investition` mit `anlage_id` anlegen
- [ ] Monatsdaten? → In `monatsdaten` (Energie) oder `investition_monatsdaten` (Verbrauch)
