"""Der Wärme/Klima-Strom **eines Geräts**, aufgeteilt auf seine Funktionen (WK-16c).

**Die Frage:** *„Wohin ist der Strom dieses Geräts in diesem Zeitraum
gegangen?"* — Heizen, Warmwasser, Kühlen, Lüften, Entfeuchten, und was keine
dieser Funktionen erklärt.

⭐ **Es ist keine neue Aufteilung, sondern die vorhandene, einmal ausgeschrieben.**
Der Erfassungs-Kanon (Konzept Wärme/Klima Kap. 3) kennt zwei Familien, und er
sagt je Gerät, welche gilt:

=========================  ==============================================
Familie                    Segmente dieses Moduls
=========================  ==============================================
**Summanden** (F5)         ``heizen`` + ``warmwasser`` aus den getrennten
                           Zählern, dazu die **gemessenen** funktionsfremden
                           Teilmengen (W-16), Rest ``system``
**Teilmengen** (Modus)     ``heizen`` … ``entfeuchten`` aus dem
                           Betriebsart-Zähler oder dem Modus-Split,
                           Rest ``ohne_modus``
=========================  ==============================================

⛔ **Nie beide zugleich für dasselbe Gerät** — das ist S2a (*„ein Stapel, eine
Familie"*) und zugleich die Doppelzählung, gegen die W-16b gebaut wurde: ein
**abgeleiteter** Modus-Split verteilt die Menge, die die Summanden schon
tragen. Die Weiche steht hier **einmal**; sie ist dieselbe, die
``core/field_definitions.py::wp_strom_aufteilung`` für die Menge stellt.

⚠ **Die zwei Reste sind zwei Größen und werden nie addiert** (Konzept Kap. 3,
Zwei-Reste-Tabelle). ``system`` ist der **Zähler**-Rest (Gesamtzähler − Achsen:
Standby, Steuerung, Umwälzpumpen — dietmar1968s „Systemverbrauch", WK-16d);
``ohne_modus`` ist der **Modus**-Rest (Stunden ohne Modus-Signal, nicht
gemessene Betriebsarten). Sie können nicht gleichzeitig auftreten, weil ein
Gerät genau eine Familie trägt — aber zwei **Geräte** derselben Anlage dürfen
je einen beitragen, und dann stehen beide im Bild, getrennt benannt.

⭐ **Warum das je GERÄT entschieden wird und erst danach summiert** (E1,
Kapitel 7): Mengen dürfen über Geräte addiert werden, Kennzahlen nicht. Eine
Wärmepumpe mit getrennten Zählern neben einer Klimaanlage mit Modus-Signal
ergibt die **Summe ihrer je aufgelösten Verteilungen**, nicht die Auflösung
ihrer Summe.

⛔ **Was hier NICHT steht:** Geld. Der Preis hängt am Monats-Tarif (ADR-002/P8)
und damit an der DB; er gehört in ``services/waerme_verteilung.py``, nicht in
den Layer (ADR-001).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Mapping, Optional

#: Die Funktionen, auf die ein Wärme/Klima-Gerät seinen Strom verteilt — in der
#: Reihenfolge, in der sie im Balken und im Stapel stehen. Dieselbe Reihenfolge
#: wie im Betriebsart-Balken des Blocks (``KomponentenSektionen``), damit ein
#: Anwender die beiden Bilder nebeneinander lesen kann.
FUNKTION_HEIZEN: Final[str] = "heizen"
FUNKTION_WARMWASSER: Final[str] = "warmwasser"
FUNKTION_KUEHLEN: Final[str] = "kuehlen"
FUNKTION_LUEFTEN: Final[str] = "lueften"
FUNKTION_ENTFEUCHTEN: Final[str] = "entfeuchten"
#: Der **Zähler**-Rest (K5/WK-16d) — ``Menge − Σ Achsen``.
FUNKTION_SYSTEM: Final[str] = "system"
#: Der **Modus**-Rest (K5/K2) — Stunden ohne Modus-Signal.
FUNKTION_OHNE_MODUS: Final[str] = "ohne_modus"

FUNKTIONEN: Final[tuple[str, ...]] = (
    FUNKTION_HEIZEN,
    FUNKTION_WARMWASSER,
    FUNKTION_KUEHLEN,
    FUNKTION_LUEFTEN,
    FUNKTION_ENTFEUCHTEN,
    FUNKTION_SYSTEM,
    FUNKTION_OHNE_MODUS,
)

#: Die Anzeigenamen — **hier**, damit Backend-Antwort, Handbuch-Wächter und
#: Client denselben Wortlaut lesen (W-8: die Beschriftung nennt die Größe).
#:
#: ⚠ Die beiden Reste heißen verschieden, und das ist der Punkt: „Nicht
#: aufgeteilt" allein stünde im selben Bild zweimal für zwei verschiedene
#: Sachverhalte (Konzept Kap. 3).
FUNKTION_LABEL: Final[Mapping[str, str]] = {
    FUNKTION_HEIZEN: "Heizen",
    FUNKTION_WARMWASSER: "Warmwasser",
    FUNKTION_KUEHLEN: "Kühlen",
    FUNKTION_LUEFTEN: "Lüften",
    FUNKTION_ENTFEUCHTEN: "Entfeuchten",
    FUNKTION_SYSTEM: "System/Standby",
    FUNKTION_OHNE_MODUS: "Ohne Modus",
}

#: Die Herkunfts-Marke je Segment (Konzept Kap. 3: *„gemessen schlägt
#: abgeleitet"* — und der Anwender darf sehen, welcher Weg gegriffen hat).
HERKUNFT_GEMESSEN: Final[str] = "gemessen"
HERKUNFT_ABGELEITET: Final[str] = "abgeleitet"
#: Ein Rest ist weder gemessen noch abgeleitet — er ist die Differenz. Ihm eine
#: der beiden Marken zu geben wäre eine Behauptung über seine Herkunft.
HERKUNFT_REST: Final[str] = "rest"

#: Welche Familie ein Gerät trägt — die Antwort ist eine Aussage über seine
#: Zähler, nicht über seine Bauart (R1).
FAMILIE_SUMMANDEN: Final[str] = "summanden"
FAMILIE_TEILMENGEN: Final[str] = "teilmengen"
#: Kein Weg trägt: das Gerät hat eine Menge, aber keine Aufteilung.
FAMILIE_KEINE: Final[str] = "keine"


@dataclass(frozen=True)
class GeraetStromEingabe:
    """Die Mengen **eines** Geräts in **einem** Zeitraum — die Eingabe.

    Die Felder tragen die Namen der Größen, nicht die der Datenbankspalten:
    Ein Monatspfad füllt sie aus ``InvestitionMonatsdaten``, ein Tagespfad aus
    Snapshots, ein Stundenpfad aus der Stundenform — und alle drei meinen
    dasselbe. Dieselbe Bauform wie ``GeraetMengen`` in
    ``services/waermepumpe_kennzahlen_je_geraet.py``: **zwei Herkünfte, eine
    Rechenstelle.**
    """

    #: Die Menge dieses Geräts (K1) — was jede Bilanz und jede Kostenrechnung
    #: liest. Sie kommt aus der Stufenregel (``wp_strom_aufteilung``) bzw. aus
    #: dem Zählerpfad des Tages, **nie** aus einer Summe der Segmente.
    menge_kwh: float = 0.0
    #: Das Kennzeichen ``getrennte_strommessung`` am Gerät. Es entscheidet, ob
    #: die feinen Achsen **Summanden** sind — nicht, ob ein Zähler zählt (K3).
    hat_getrennte_strommessung: bool = False
    #: Die beiden Summanden-Achsen. ``None`` heißt „keine Achse", ``0.0`` ist
    #: eine **Messung** (ein Sommermonat ohne Heizbetrieb).
    strom_heizen_kwh: Optional[float] = None
    strom_warmwasser_kwh: Optional[float] = None
    #: Der **Zähler**-Rest aus dem SoT (``WpStromAufteilung.nicht_aufgeteilt_kwh``
    #: bzw. ``wp_nicht_aufgeteilt_kwh`` auf Tagesebene).
    nicht_aufgeteilt_kwh: float = 0.0
    #: Die Betriebsart-Teilmengen — gemessen (Betriebsart-Zähler) oder aus dem
    #: Betriebsmodus abgeleitet. Welcher Weg gegriffen hat, sagt
    #: ``modus_gemessen``; die Weiche selbst steht in ``modus_strom_zeile``.
    modus_heizen_kwh: float = 0.0
    modus_warmwasser_kwh: float = 0.0
    modus_kuehlen_kwh: float = 0.0
    modus_lueften_kwh: float = 0.0
    modus_entfeuchten_kwh: float = 0.0
    modus_gemessen: bool = False
    #: Die Grundmenge der Teilmengen-Familie — ``0.0``, wenn dieses Gerät nichts
    #: beisteuert. **Nicht** ``menge_kwh``: ein Gerät ohne Modus-Signal und ohne
    #: Betriebsart-Zähler trägt sonst seinen ganzen Verbrauch als „ohne Modus"
    #: bei (an einer Instanz gemessen: 96,4 statt 6,4 kWh — W-17b).
    modus_bezug_kwh: float = 0.0


@dataclass(frozen=True)
class GeraetStromVerteilung:
    """Die Aufteilung **eines** Geräts — Segmente, Herkunft, Grundmenge."""

    #: ``{Funktion: kWh}`` — nur Funktionen mit Menge; ein Segment ohne Menge
    #: ist keine 0, sondern gar nicht da (ADR-002/P4).
    je_funktion: Mapping[str, float]
    #: ``{Funktion: gemessen | abgeleitet | rest}``.
    herkunft_je_funktion: Mapping[str, str]
    #: Welche Familie getragen hat.
    familie: str
    #: Die Menge des Geräts (K1) — unverändert aus der Eingabe.
    menge_kwh: float
    #: Σ der Segmente. ⚠ Sie ist **nicht** immer ``menge_kwh``: ein Gerät ohne
    #: jede Aufteilung trägt seine Menge, aber kein Segment. Die Differenz wird
    #: **genannt**, nicht verteilt (W-17b: *„Aufgeteilte Menge X von Y kWh"*).
    aufgeteilt_kwh: float

    @property
    def hat_aufteilung(self) -> bool:
        return self.familie != FAMILIE_KEINE


def verteile_geraet_strom(e: GeraetStromEingabe) -> GeraetStromVerteilung:
    """Die **eine** Stelle, an der ein Gerätestrom auf Funktionen fällt.

    Die Weiche ist dieselbe wie bei der Menge (``wp_strom_aufteilung``):

    1. **Trägt das Gerät Summanden-Achsen?** (Kennzeichen *und* mindestens eine
       gepflegte Achse) ⇒ Summanden-Familie. Die **gemessenen** funktionsfremden
       Teilmengen stehen daneben (W-16/K4), ein **abgeleiteter** Split nicht —
       er verteilte dieselbe Menge ein zweites Mal.
    2. **Sonst: trägt es eine Betriebsart-Aufteilung?** ⇒ Teilmengen-Familie mit
       ihrem eigenen Rest.
    3. **Sonst:** keine Aufteilung. Die Menge bleibt, das Bild bleibt leer —
       und der Aufrufer nennt die Differenz.

    ⚠ **Eine gemessene 0 ist eine Messung, aber kein Segment.** Ein
    Warmwasser-Strom von 0,0 im Sommer belegt, dass es die Achse gibt (er
    entscheidet über den Rest, s. ``wp_nicht_aufgeteilt_kwh``) — als Segment
    wäre er ein Balken der Höhe 0, der aussieht wie „nichts gelaufen".
    """
    je_funktion: dict[str, float] = {}
    herkunft: dict[str, str] = {}

    def _setze(funktion: str, kwh: float, marke: str) -> None:
        if kwh > 0:
            je_funktion[funktion] = float(kwh)
            herkunft[funktion] = marke

    hat_achse = e.hat_getrennte_strommessung and (
        e.strom_heizen_kwh is not None or e.strom_warmwasser_kwh is not None
    )
    if hat_achse:
        familie = FAMILIE_SUMMANDEN
        _setze(FUNKTION_HEIZEN, e.strom_heizen_kwh or 0.0, HERKUNFT_GEMESSEN)
        _setze(
            FUNKTION_WARMWASSER, e.strom_warmwasser_kwh or 0.0, HERKUNFT_GEMESSEN,
        )
        if e.modus_gemessen:
            # W-16/K4: Summanden und **gemessene** Teilmengen schließen einander
            # nicht aus — der Kühlzähler einer kühlfähigen Luft-Wasser-Anlage
            # steht neben ihren beiden Achsen. Dieselbe Menge, die
            # `wp_feine_summe_kwh` in die feine Summe nimmt.
            _setze(FUNKTION_KUEHLEN, e.modus_kuehlen_kwh, HERKUNFT_GEMESSEN)
            _setze(FUNKTION_LUEFTEN, e.modus_lueften_kwh, HERKUNFT_GEMESSEN)
            _setze(
                FUNKTION_ENTFEUCHTEN, e.modus_entfeuchten_kwh, HERKUNFT_GEMESSEN,
            )
        _setze(FUNKTION_SYSTEM, e.nicht_aufgeteilt_kwh, HERKUNFT_REST)
    elif e.modus_bezug_kwh > 0 and (
        e.modus_gemessen
        or any((
            e.modus_heizen_kwh, e.modus_warmwasser_kwh, e.modus_kuehlen_kwh,
            e.modus_lueften_kwh, e.modus_entfeuchten_kwh,
        ))
    ):
        familie = FAMILIE_TEILMENGEN
        marke = HERKUNFT_GEMESSEN if e.modus_gemessen else HERKUNFT_ABGELEITET
        _setze(FUNKTION_HEIZEN, e.modus_heizen_kwh, marke)
        _setze(FUNKTION_WARMWASSER, e.modus_warmwasser_kwh, marke)
        _setze(FUNKTION_KUEHLEN, e.modus_kuehlen_kwh, marke)
        _setze(FUNKTION_LUEFTEN, e.modus_lueften_kwh, marke)
        _setze(FUNKTION_ENTFEUCHTEN, e.modus_entfeuchten_kwh, marke)
        # K5, je Gerät angewandt: dieselbe Formel wie
        # `WpFakten.modus_nicht_aufgeteilt_kwh` auf Anlagenebene — Bezug ist
        # `modus_strom_bezug_kwh`, nie `strom_kwh` (s. Feld-Docstring dort).
        _setze(
            FUNKTION_OHNE_MODUS,
            max(
                0.0,
                e.modus_bezug_kwh
                - e.modus_heizen_kwh - e.modus_warmwasser_kwh
                - e.modus_kuehlen_kwh - e.modus_lueften_kwh
                - e.modus_entfeuchten_kwh,
            ),
            HERKUNFT_REST,
        )
    else:
        familie = FAMILIE_KEINE

    return GeraetStromVerteilung(
        je_funktion=je_funktion,
        herkunft_je_funktion=herkunft,
        familie=familie,
        menge_kwh=float(e.menge_kwh),
        aufgeteilt_kwh=sum(je_funktion.values()),
    )


def anteile_prozent(je_segment: Mapping[str, float]) -> dict[str, float]:
    """Anteile an der **aufgeteilten** Menge, nicht an der Gesamtmenge.

    ⚠ Der Bezug ist Absicht und dieselbe Antwort, die der Balken und der
    Verlauf schon geben (W-17b): Ein Gerät ohne Aufteilung steht in keinem
    Segment; seine Kilowattstunden am Nenner zu beteiligen ergäbe Anteile, die
    sich nicht zu 100 % summieren, ohne dass irgendwo stünde, warum. Die
    Differenz zur Gesamtmenge wird **genannt** statt hineingerechnet.
    """
    summe = sum(v for v in je_segment.values() if v > 0)
    if summe <= 0:
        return {}
    return {k: v / summe * 100.0 for k, v in je_segment.items() if v > 0}
