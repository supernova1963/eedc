"""Investitionen API — Pydantic-Schemas.

`InvestitionBase` · `InvestitionCreate` · `InvestitionUpdate` · `InvestitionResponse` (mit dem abgeleiteten
`leistung_kwp_effektiv`, ADR-002/P3-a Grenze (c)). Gelesen von `crud.py`, `dashboards.py` und den Tests.
"""
# Reiner Umzug aus `api/routes/investitionen/crud.py` (18.09.2026, Vorlage 5 des Refactorings grosser
# Dateien): Code 1:1 uebernommen, kein Verhaltenswechsel. `crud.py` exportiert die Namen weiter.

from typing import Optional, Any
from pydantic import BaseModel, Field, computed_field
from datetime import date
from backend.core.investition_kennwerte import get_erzeuger_kwp
from backend.core.berechnungen import PV_ERZEUGER_TYPEN


# =============================================================================
# Pydantic Schemas
# =============================================================================

class InvestitionBase(BaseModel):
    """Basis-Schema für Investition."""
    typ: str = Field(..., description="Investitionstyp (e-auto, speicher, etc.)")
    bezeichnung: str = Field(..., min_length=1, max_length=255)
    anschaffungsdatum: Optional[date] = None
    stilllegungsdatum: Optional[date] = Field(None, description="Endmarker: ab diesem Datum zählt die Investition nicht mehr für aktuelle/künftige Auswertungen")
    anschaffungskosten_gesamt: Optional[float] = Field(None, ge=0)
    anschaffungskosten_alternativ: Optional[float] = Field(None, ge=0)
    betriebskosten_jahr: Optional[float] = Field(None, ge=0)
    # §8/1 des Wirtschaftlichkeits-Konzepts: das Gegenstück zu
    # `betriebskosten_jahr` auf der Ertragsseite. Ein Jahresbetrag an der
    # Investition ist per FORM wiederkehrend (§2/1) — er wirkt jährlich, im
    # laufenden Ergebnis und in der Prognose. Gelesen wird er im
    # ROI-Dashboard für Wallbox/Sonstiges; bis 2026-08-10 war er ein Feld
    # **ohne Schreiber** (kein Formular, kein Import, kein Schema).
    einsparung_prognose_jahr: Optional[float] = Field(
        None, ge=0,
        description="Wiederkehrender Ertrag/Einsparung pro Jahr (€) — Gegenstück zu betriebskosten_jahr",
    )
    parameter: Optional[dict[str, Any]] = None
    aktiv: bool = True
    parent_investition_id: Optional[int] = None
    # PV-Module spezifische Felder
    leistung_kwp: Optional[float] = Field(None, ge=0, description="Leistung in kWp (für PV-Module)")
    ausrichtung: Optional[str] = Field(None, max_length=50, description="Ausrichtung (Süd, Ost, West, etc.)")
    neigung_grad: Optional[float] = Field(None, ge=0, le=90, description="Modulneigung in Grad")
    ha_entity_id: Optional[str] = Field(None, max_length=255, description="Home Assistant Entity-ID für String-Daten")
    # #284: optionales Override der grauen Herstellungs-Last (CO2) für die
    # CO2-Amortisation; leer = Default-Richtwert nach Typ/Größe.
    graue_last_kg: Optional[float] = Field(None, ge=0, description="Graue Herstellungs-Last in kg CO2 (leer = Default nach Typ/Größe)")

class InvestitionCreate(InvestitionBase):
    """Schema für Investition-Erstellung."""
    anlage_id: int

class InvestitionUpdate(BaseModel):
    """Schema für Investition-Update."""
    bezeichnung: Optional[str] = Field(None, min_length=1, max_length=255)
    anschaffungsdatum: Optional[date] = None
    stilllegungsdatum: Optional[date] = None
    anschaffungskosten_gesamt: Optional[float] = Field(None, ge=0)
    anschaffungskosten_alternativ: Optional[float] = Field(None, ge=0)
    betriebskosten_jahr: Optional[float] = Field(None, ge=0)
    einsparung_prognose_jahr: Optional[float] = Field(None, ge=0)
    parameter: Optional[dict[str, Any]] = None
    aktiv: Optional[bool] = None
    parent_investition_id: Optional[int] = None
    # PV-Module spezifische Felder
    leistung_kwp: Optional[float] = Field(None, ge=0)
    ausrichtung: Optional[str] = Field(None, max_length=50)
    neigung_grad: Optional[float] = Field(None, ge=0, le=90)
    ha_entity_id: Optional[str] = Field(None, max_length=255)
    graue_last_kg: Optional[float] = Field(None, ge=0)

class InvestitionResponse(InvestitionBase):
    """Schema für Investition-Response."""
    id: int
    anlage_id: int
    # `einsparung_prognose_jahr` steht seit §8/1 in `InvestitionBase` — es ist
    # jetzt pflegbar und wird von dort geerbt. Hier stand es nur, solange es
    # ausschließlich lesbar war.
    co2_einsparung_prognose_kg: Optional[float]

    class Config:
        from_attributes = True

    @computed_field(  # type: ignore[prop-decorator]
        description=(
            "Nennleistung zur ANZEIGE/RECHNUNG — bei Erzeugern inkl. Fallback auf "
            "das `parameter`-JSON (#229). Nur lesend: der Schreibpfad (POST/PUT) "
            "kennt das Feld nicht. Einheit wie bei `leistung_kwp`."
        )
    )
    @property
    def leistung_kwp_effektiv(self) -> Optional[float]:
        """Der effektive Nennleistungs-Wert dieser Investition (A26/N106).

        **Warum es dieses Feld gibt:** `leistung_kwp` ist die ROHSPALTE. Wer
        seine Nennleistung nur im `parameter`-JSON gepflegt hat (Import-/
        Altbestand), hat dort `None` — im Client sah das aus wie „nicht
        gepflegt", und `v4/komponentenAdapter.tsx` verteilte die Erzeugung
        danach anteilig (das Modul bekam 0, die übrigen zu viel). Das ist die
        #229-Klasse jenseits jedes Backend-Wächters (ADR-002/P3-a Grenze (c)).

        **Die Trennlinie:** ANZEIGE und RECHNUNG lesen dieses Feld,
        FORMULARE und WIZARDS die Rohspalte `leistung_kwp` — läse ein
        Eingabefeld den abgeleiteten Wert, schriebe das nächste Speichern ihn
        in die Spalte. Genau deshalb steht das Feld in `InvestitionResponse`
        und **nicht** in `InvestitionBase`: `InvestitionCreate`/`-Update`
        erben es damit nicht und nehmen es auch nicht entgegen.

        **Typabhängigkeit (N-G):** `Investition.leistung_kwp` ist ein
        Mehrzweckfeld — beim Speicher kWh, beim Wechselrichter kW (AC). Die
        SoT-Helper tragen PV-Semantik und sind laut ihrem eigenen Docstring
        nur für Erzeuger-Typen zuständig. Für alle anderen Typen ist dieses
        Feld deshalb unverändert die Rohspalte; es „heilt" nur dort, wo
        Heilung definiert ist, und ist nirgends kleiner als `leistung_kwp`.

        `or roh` hält die Semantik „nicht gepflegt": die Helper liefern `0.0`,
        wenn sie nichts finden — eine 0,0-kWp-Zeile statt einer fehlenden wäre
        eine erfundene Zahl. Eine echte 0 in der Spalte bleibt eine 0.
        """
        roh = self.leistung_kwp
        if self.typ in PV_ERZEUGER_TYPEN:
            return get_erzeuger_kwp(self) or roh
        return roh
