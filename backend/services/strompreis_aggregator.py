"""
Strompreis-Aggregator — Verbrauchsgewichteter Monats-Durchschnittspreis.

Berechnet aus stündlichen TagesEnergieProfil-Daten den effektiven
Durchschnitts-Strompreis für einen Monat:

    Ø_effektiv = Σ(strompreis_cent × netzbezug_kw) / Σ(netzbezug_kw)

Nutzt nur `strompreis_cent` (Endpreis aus HA-Sensor, z.B. Tibber/aWATTar),
NICHT `boersenpreis_cent` — Börsenpreis ist kein Endkundenpreis.

Wird als Vorschlag im Monatsabschluss-Wizard verwendet (Phase 2 aus
docs/archive/KONZEPT-STROMPREIS-MITSCHRIFT.md).
"""

from __future__ import annotations

import logging
from calendar import monthrange
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import and_, extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.berechnungen.zeittarif import (
    gewichteter_arbeitspreis_cent,
    hat_zeitfenster,
)
from backend.models.tages_energie_profil import TagesEnergieProfil

logger = logging.getLogger(__name__)


@dataclass
class StrompreisAggregat:
    """Ergebnis der Monats-Strompreis-Aggregation."""
    gewichtet_cent: Optional[float]  # Verbrauchsgewichteter Ø (ct/kWh)
    arithmetisch_cent: float         # Einfacher Ø aller Stunden (ct/kWh)
    abgedeckte_stunden: int          # Stunden mit Preisdaten
    sollstunden: int                 # Theoretische Stunden im Monat

    @property
    def abdeckung(self) -> float:
        """Abdeckung als Anteil (0..1)."""
        return self.abgedeckte_stunden / self.sollstunden if self.sollstunden > 0 else 0

    @property
    def konfidenz(self) -> int:
        """Konfidenz-Score basierend auf Abdeckung."""
        if self.abdeckung > 0.95:
            return 95
        if self.abdeckung > 0.70:
            return 80
        return 60


async def berechne_monats_durchschnittspreis(
    anlage_id: int, jahr: int, monat: int, db: AsyncSession
) -> Optional[StrompreisAggregat]:
    """
    Berechnet den verbrauchsgewichteten Monats-Durchschnittspreis.

    Nur Stunden mit `strompreis_cent IS NOT NULL` werden berücksichtigt.
    Negativer Netzbezug wird auf 0 geclampt (Daten-Glitches).

    Returns:
        StrompreisAggregat oder None wenn keine Preisdaten vorhanden.
    """
    result = await db.execute(
        select(
            TagesEnergieProfil.strompreis_cent,
            TagesEnergieProfil.netzbezug_kw,
        ).where(
            and_(
                TagesEnergieProfil.anlage_id == anlage_id,
                extract("year", TagesEnergieProfil.datum) == jahr,
                extract("month", TagesEnergieProfil.datum) == monat,
                TagesEnergieProfil.strompreis_cent.isnot(None),
            )
        )
    )
    rows = result.all()

    if not rows:
        return None

    # Verbrauchsgewichteter Durchschnitt
    summe_kosten = 0.0   # ct (preis × kWh)
    summe_kwh = 0.0      # kWh
    summe_preise = 0.0   # ct (für arithmetischen Ø)

    for preis, bezug in rows:
        if preis is None:
            continue
        kw = max(0.0, bezug or 0.0)  # Negativen Netzbezug auf 0 clampen
        summe_kosten += preis * kw    # ct × kW × 1h = ct·kWh
        summe_kwh += kw
        summe_preise += preis

    n = len(rows)
    tage_im_monat = monthrange(jahr, monat)[1]
    sollstunden = tage_im_monat * 24

    gewichtet = round(summe_kosten / summe_kwh, 2) if summe_kwh > 0 else None
    arithmetisch = round(summe_preise / n, 2) if n > 0 else 0.0

    return StrompreisAggregat(
        gewichtet_cent=gewichtet,
        arithmetisch_cent=arithmetisch,
        abgedeckte_stunden=n,
        sollstunden=sollstunden,
    )


# =============================================================================
# Zeittarif (HT/NT) — N-267
# =============================================================================
#
# ⭐ Warum das HIER steht und nicht in einem eigenen Modul: Die Frage ist
# dieselbe wie oben — „welcher EINE Preis beschreibt diesen Monat?" —, und sie
# wird mit derselben Formel beantwortet (Σ Preis × Menge ÷ Σ Menge über die
# Stundenzeilen). Verschieden ist allein die **Herkunft des Stundenpreises**:
# oben gemessen (`strompreis_cent` aus dem HA-Sensor), hier aus dem Tarif
# abgeleitet. Ein zweites Modul wäre ein zweiter Turm über demselben
# Sachverhalt — die Bauform, gegen die der Daten-Checker an neun Stellen
# ausdrücklich gebaut ist.

async def wirksamer_arbeitspreis_cent(
    db: AsyncSession,
    anlage_id: int,
    jahr: int,
    monat: int,
    tarif,
    *,
    cache: Optional[dict] = None,
) -> float:
    """Der Arbeitspreis, mit dem dieser Monat zu rechnen ist (ct/kWh).

    **Ohne Zeitfenster ist das der Stammpreis** — dann wird die Datenbank gar
    nicht erst gefragt. Mit Fenstern wird der Preis über den **gemessenen**
    Netzbezug der Stundenzeilen gewichtet (ADR-002/P8: der Wert beschreibt
    diesen Monat, nicht heute).

    ⚠ **Fällt auf den Stammpreis zurück, wenn keine Stundenwerte vorliegen** —
    also bei handgetragenen Monatswerten. Das ist der Hochtarif und damit **zu
    hoch**, aber es ist der Preis, den der Anwender ohne das Fenster gezahlt
    hätte: nachvollziehbar, nie erfunden. Wer es genauer braucht, trägt den
    Monats-Ø im Monatsabschluss ein — dasselbe Feld, das der dynamische Tarif
    seit jeher benutzt (`netzbezug_durchschnittspreis_cent`), und dieses Feld
    schlägt den Wert hier ohnehin (`resolve_netzbezug_preis_cent`).

    ⛔ **Kein geschätzter NT-Anteil.** Er wäre „eine Zahl, die genauer aussieht,
    als sie ist" (Gernots Antwort an den Melder in #380) und ein Feld, das zum
    Falschausfüllen einlädt — die #392-Lehre.

    Args:
        tarif: Die Tarifzeile des Monats (``Strompreis`` oder ``None``).
        cache: Optionales ``{(tarif_id, jahr, monat): preis}`` je Anfrage —
            Cockpit → Jahr fragt sonst denselben Monat mehrfach, weil
            ``lade_monats_fakten`` und ``baue_finanz_zeile`` ihn beide brauchen.
    """
    if tarif is None:
        from backend.core.wirtschaftlichkeit_defaults import NETZBEZUG_DEFAULT_CENT
        return NETZBEZUG_DEFAULT_CENT

    stammpreis = tarif.netzbezug_arbeitspreis_cent_kwh
    if not hat_zeitfenster(tarif):
        return stammpreis

    schluessel = (tarif.id, jahr, monat)
    if cache is not None and schluessel in cache:
        return cache[schluessel]

    result = await db.execute(
        select(
            TagesEnergieProfil.datum,
            TagesEnergieProfil.stunde,
            TagesEnergieProfil.netzbezug_kw,
        ).where(
            and_(
                TagesEnergieProfil.anlage_id == anlage_id,
                extract("year", TagesEnergieProfil.datum) == jahr,
                extract("month", TagesEnergieProfil.datum) == monat,
            )
        )
    )
    gewichtet = gewichteter_arbeitspreis_cent(tarif, result.all())
    preis = stammpreis if gewichtet is None else round(gewichtet, 4)

    if cache is not None:
        cache[schluessel] = preis
    return preis


# ─────────────────────────────────────────────────────────────────────────────
# Die vollständige Auflösung des Monats-Netzbezugspreises (#412, 11.09.2026)
# ─────────────────────────────────────────────────────────────────────────────

#: Woher der Preis eines Monats stammt — vier disjunkte Fälle, die Kaskade
#: nimmt immer genau einen.
#:
#: ⭐ **Warum die Herkunft mitgeliefert wird und nicht nur die Zahl** (P4: *die
#: Antwort sagt, was sie ist*): Bis 11.09.2026 lieferte Cockpit → Monat zwei
#: Felder — den gepflegten Ø und „den verwendeten Tarif" — und der Client bildete
#: daraus `durchschnitt ?? tarif`. Ein **zeitgewichteter** Preis (HT/NT) war
#: darin von einem reinen Stammpreis nicht zu unterscheiden; die Formel-Zeile
#: der Kachel nannte beide „Arbeitspreis aus dem Strompreis-Tarif". Mit einem
#: dritten Fall (gemessen) wäre aus der Halbwahrheit eine ganze geworden.
PREIS_HERKUNFT_GEPFLEGT = "gepflegt"
PREIS_HERKUNFT_GEMESSEN = "gemessen"
PREIS_HERKUNFT_ZEITFENSTER = "zeitfenster"
PREIS_HERKUNFT_STAMM = "stamm"


@dataclass(frozen=True)
class MonatsPreis:
    """Der Preis eines Monats **mit** seiner Herkunft."""

    cent: float
    herkunft: str
    #: Anteil der Monatsstunden mit Preisdaten (0..1) — **nur** bei
    #: ``gemessen``, sonst ``None``. ⚠ Herkunft und Güte sind zwei
    #: verschiedene Dinge: Ein Ø aus 40 % der Stunden hat dieselbe Herkunft
    #: wie einer aus 98 %, aber nicht dieselbe Belastbarkeit.
    abdeckung: Optional[float] = None

    @property
    def ist_gemessen(self) -> bool:
        return self.herkunft == PREIS_HERKUNFT_GEMESSEN


async def aufgeloester_monatspreis(
    db: AsyncSession,
    anlage_id: int,
    jahr: int,
    monat: int,
    monatsdaten,
    tarif,
    *,
    stammpreis_override: Optional[float] = None,
    cache: Optional[dict] = None,
) -> MonatsPreis:
    """Der Netzbezugspreis, mit dem dieser Monat zu rechnen ist — **die ganze Kaskade**.

    **Die Reihenfolge und ihre Begründung:**

    1. **gepflegt** — ``Monatsdaten.netzbezug_durchschnittspreis_cent``. Er kommt
       aus der **Abrechnung** und schlägt jede Messung: eedc misst, was durch den
       Zähler ging, der Versorger stellt in Rechnung, was er berechnet.
    2. **gemessen** — der verbrauchsgewichtete Ø der mitgeschriebenen
       Stundenpreise. ⭐ **Neu seit #412** (OB73-gif): Bis dahin endete die
       Kaskade hier und fiel auf den Stammpreis. Wer einen dynamischen Tarif
       hat, sah deshalb in *Cockpit → Tag* und im **laufenden** Monat den festen
       Tarifpreis — obwohl eedc die echten Stundenpreise längst mitschrieb und
       im Monatsabschluss sogar daraus einen Vorschlag rechnete. Die Zahl war
       nicht falsch gerechnet, aber sie war die schlechtere von zwei
       verfügbaren.
    3. **zeitfenster** — bei HT/NT der über den gemessenen Netzbezug gewichtete
       Tarifpreis (N-267).
    4. **stamm** — die Tarifspalte.

    ⚠ **Stufe 2 kommt VOR Stufe 3, und das ist eine Aussage:** Der gemessene
    Endpreis ist der **bezahlte** Preis; ein aus Tarif-Zeitfenstern abgeleiteter
    ist eine Rechnung über den Tarif. Wo beides vorliegt — ein Anwender mit
    HT/NT-Fenstern **und** zugeordnetem Preissensor, vom Datenmodell nicht
    ausgeschlossen —, gewinnt die Messung.

    ⛔ **Keine Mindestabdeckung, und das ist gemessen statt vermutet.** Der
    erste Entwurf sah eine vor. Sie hätte genau den Fall ausgeschlossen, für den
    sie gedacht war: ``StrompreisAggregat.abdeckung`` misst gegen den **vollen**
    Monat (``sollstunden = tage_im_monat * 24``), am 11. eines 30-Tage-Monats
    sind also höchstens 36 % erreichbar — jede Schwelle ab 50 % hätte den
    laufenden Monat bis nach Monatsmitte auf den Stammpreis zurückgeworfen.
    Stattdessen wird die Abdeckung **mitgeliefert** statt den Wert zu ersetzen;
    das ist die P4-Linie (*„der Wert wird nicht ersetzt, nur beschriftet"*) und
    dieselbe Wahl, die ``live_dashboard._monats_durchschnitt_cent`` trifft:
    „den Monat, soweit er da ist".

    Args:
        stammpreis_override: Stufe 4 mit einem **anderen** Stammpreis als der
            Tarifspalte — für die **Komponenten**-Tarife (Wallbox, Wärmepumpe).
            Ihre eigene Kaskade (Komponente → allgemein → Default) löst
            ``resolve_strompreis_for_komponente`` auf; was sie liefert, ist für
            diese Funktion der Stammpreis. ⚠ Die Stufen 1 und 2 bleiben davon
            unberührt und schlagen ihn — genau so, wie
            ``wallbox_preis_effektiv_cent`` es in den Monats-Fakten tut: *„Der
            Flex-Ø gilt für den ganzen Zähler — auch für die Wallbox."*
        cache: optionales ``{(jahr, monat): MonatsPreis}`` je Anfrage — Cockpit →
            Jahr fragt sonst denselben Monat mehrfach. ⛔ **Nur setzen, wo der
            Stammpreis über die Monate derselbe ist** — mit
            ``stammpreis_override`` je Komponente braucht jede Verwendung ihren
            eigenen Cache.

    Returns:
        ``MonatsPreis`` — Zahl **und** Herkunft, nie nur die Zahl.
    """
    schluessel = (jahr, monat)
    if cache is not None and schluessel in cache:
        return cache[schluessel]

    ergebnis = await _aufgeloester_monatspreis_ungecacht(
        db, anlage_id, jahr, monat, monatsdaten, tarif, stammpreis_override,
    )
    if cache is not None:
        cache[schluessel] = ergebnis
    return ergebnis


async def _aufgeloester_monatspreis_ungecacht(
    db: AsyncSession, anlage_id: int, jahr: int, monat: int, monatsdaten, tarif,
    stammpreis_override: Optional[float] = None,
) -> MonatsPreis:
    # 1 — gepflegt. ⚠ `is not None`, nicht truthy: ein Monats-Ø von 0,0 ct ist
    # bei dynamischem Tarif real (viele Negativpreis-Stunden) und wäre als
    # falsy stillschweigend durchgefallen — die 0-Werte-Falle.
    gepflegt = getattr(monatsdaten, "netzbezug_durchschnittspreis_cent", None)
    if gepflegt is not None:
        return MonatsPreis(cent=gepflegt, herkunft=PREIS_HERKUNFT_GEPFLEGT)

    # ⚠ **Alle Tarif-Attribute VOR dem ersten Datenbank-Roundtrip lesen.** Ein
    # ORM-Objekt kann danach abgelaufen sein, und ein Nachladen im falschen
    # Kontext endet in `MissingGreenlet` statt in einem Wert. Beim Bau genau so
    # aufgetreten — die Reihenfolge ist hier kein Stil, sondern Funktion.
    stammpreis = stammpreis_override
    if stammpreis is None:
        stammpreis = (
            tarif.netzbezug_arbeitspreis_cent_kwh
            if tarif is not None and tarif.netzbezug_arbeitspreis_cent_kwh is not None
            else None
        )
    tarif_hat_zeitfenster = tarif is not None and hat_zeitfenster(tarif)

    # 2 — gemessen.
    aggregat = await berechne_monats_durchschnittspreis(anlage_id, jahr, monat, db)
    if aggregat is not None and aggregat.gewichtet_cent is not None:
        return MonatsPreis(
            cent=aggregat.gewichtet_cent,
            herkunft=PREIS_HERKUNFT_GEMESSEN,
            abdeckung=round(aggregat.abdeckung, 3),
        )

    if stammpreis is None:
        from backend.core.wirtschaftlichkeit_defaults import NETZBEZUG_DEFAULT_CENT
        return MonatsPreis(cent=NETZBEZUG_DEFAULT_CENT, herkunft=PREIS_HERKUNFT_STAMM)

    # 3 — Zeitfenster (HT/NT).
    if tarif_hat_zeitfenster:
        gewichtet = await wirksamer_arbeitspreis_cent(db, anlage_id, jahr, monat, tarif)
        if gewichtet != stammpreis:
            return MonatsPreis(cent=gewichtet, herkunft=PREIS_HERKUNFT_ZEITFENSTER)

    # 4 — Stammpreis.
    return MonatsPreis(cent=stammpreis, herkunft=PREIS_HERKUNFT_STAMM)
