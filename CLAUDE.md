# CLAUDE.md - Entwickler-Kontext für Claude Code

## Projektübersicht

**eedc** (Energie Effizienz Data Center) - Standalone PV-Analyse mit optionaler HA-Integration.

**GitHub:** https://github.com/supernova1963/eedc

## WICHTIG: Dieses Repo ist ein Spiegel!

**Source of Truth ist `eedc-homeassistant`** (`/home/gernot/claude/eedc-homeassistant`).

Dieses Repo wird **ausschließlich per Release-Script** aktualisiert:
```bash
cd /home/gernot/claude/eedc-homeassistant
./scripts/release.sh 2.8.6
```

**NICHT direkt in diesem Repo arbeiten!** Alle Änderungen in `eedc-homeassistant/eedc/` machen.

## Verboten

- **Code hier ändern** — immer in eedc-homeassistant arbeiten
- **`git push`** — wird nur vom Release-Script gemacht
- **`git subtree`** — wird nicht mehr verwendet
- **Releases, Tags, Versionsnummern ändern** — nur auf User-Aufforderung via Release-Script

## Verbundene Repositories

| Repository | Zweck |
| --- | --- |
| **[eedc-homeassistant](https://github.com/supernova1963/eedc-homeassistant)** | Source of Truth, HA-Add-on, Website, Docs |
| **eedc** (dieses) | Standalone-Distribution (Spiegel) |
| **[eedc-community](https://github.com/supernova1963/eedc-community)** | Anonymer Community-Benchmark-Server |

## Unterschiede zum HA-Add-on

Dieses Repo enthält NICHT:
- `config.yaml`, `run.sh` (HA-spezifisch)
- `icon.png`, `logo.png` (HA-Icons)
- `website/`, `docs/` (nur in eedc-homeassistant)

Das `Dockerfile` hier ist die Standalone-Version (ohne HA-Labels, ohne jq, ohne run.sh).

## Architektur-Prinzipien

1. **Standalone-First:** Keine HA-Abhängigkeit für Kernfunktionen
2. **Datenquellen getrennt:** `Monatsdaten` = Zählerwerte, `InvestitionMonatsdaten` = Komponenten-Details
3. **Legacy-Felder NICHT verwenden:** `Monatsdaten.pv_erzeugung_kwh` und `Monatsdaten.batterie_*` → Nutze `InvestitionMonatsdaten`

## Kritische Code-Patterns

### SQLAlchemy JSON-Felder

```python
from sqlalchemy.orm.attributes import flag_modified
obj.verbrauch_daten["key"] = value
flag_modified(obj, "verbrauch_daten")  # Ohne das wird die Änderung NICHT persistiert!
db.commit()
```

### 0-Werte prüfen

```python
# FALSCH: if val:     → 0 wird als False gewertet
# RICHTIG: if val is not None:
```

## Deprecated (nicht löschen!)

> Die alten `ha_sensor_*` Felder im Anlage-Model dürfen NICHT aus der DB/dem Model entfernt werden (bestehende Installationen). Neuer Code nutzt ausschließlich `sensor_mapping`.
