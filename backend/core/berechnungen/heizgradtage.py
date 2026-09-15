"""Heizgradtage — das Wetter als Nenner einer Verbrauchsgröße (ADR-001).

**Wozu.** Ein kalter Winter braucht mehr Strom als ein milder, ohne dass die
Anlage schlechter arbeitet. Wer zwei Heizperioden vergleichen will, muss das
Wetter herausrechnen: Nicht „kWh", sondern „kWh je Heizgradtag".

**Die Definition — eine einzige, für die ganze Anwendung** (Entscheid Gernot
2026-09-12, SOLL Wärme/Klima §4.1 „SOLL — Wetternormierung", SOLL-§9-E8):

    HDD_Tag = max(0; 15 °C − Tagesmittel der Außentemperatur)

``HEIZGRENZE_C`` ist die **Heizgrenze** nach Gradtag-Konvention, **nicht** eine
Innenraum-Solltemperatur: Unterhalb 15 °C Außentemperatur wird geheizt, darüber
tragen die inneren Gewinne das Haus. Dieselbe Konstante trägt die
Temperaturkorrektur der Verbrauchsprognose (``api/routes/live_wetter.py``) —
dass es bei **einer** Definition bleibt, hält
``test_berechnungs_layer_konformitaet.py::test_heizgrenze_nur_im_layer`` fest.

⛔ **Der Eingang sind TAGESmittel, nie ein Monatsmittel** (K-2, gemessen).
``max(0; 15 − T)`` ist **konvex**: In einem Übergangsmonat mit Tagen beidseits
der Heizgrenze unterschätzt der Weg über den Monatsmittelwert die Summe — im
Mai 2026 der Demo-Anlage um **−26,6 %** (22,1 statt 30,1 Kd). Ein gepflegter
``Monatsdaten.durchschnittstemperatur`` ist deshalb **keine** Heizgradtag-Quelle;
er bleibt die Ø-Anzeige, die er ist. Den Eingabe-Builder stellt
``services/mitteltemperatur.py::lade_heizgradtage_je_monat``.

⚠ **Ein Monat ohne einen einzigen Temperaturtag fehlt, statt 0 Kd zu sein**
(ADR-002/P4): „keine Messung" und „kein Heizbedarf" sind zwei verschiedene
Aussagen, und die zweite wäre im Januar eine Falschaussage. ``tage_mit_temperatur``
und ``tage_im_monat`` reisen deshalb mit jedem Wert mit — wer sie summiert, sieht
seiner Summe an, wie vollständig sie ist.

⛔ **Kein DB-Zugriff** (ADR-001): reine Formeln über eine übergebene Tagesreihe.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date
from typing import Final, Mapping, Optional

#: Heizgrenze in °C — die EINE Definitionsstelle (G-G, 12.09.2026).
#: Unterhalb dieser Außentemperatur wird geheizt (Gradtag-Konvention, DACH).
HEIZGRENZE_C: Final[float] = 15.0


def heizgradtage_tag(tagesmittel_c: float) -> float:
    """Heizgradtage eines Tages: ``max(0; 15 °C − Tagesmittel)``.

    Die Grenze selbst zählt **nicht** mit (15,0 °C ⇒ 0,0 Kd) — ein Tag genau an
    der Heizgrenze hat definitionsgemäß keinen Heizbedarf.
    """
    return max(0.0, HEIZGRENZE_C - float(tagesmittel_c))


@dataclass(frozen=True)
class HeizgradtageMonat:
    """Die Heizgradtage eines Kalendermonats — **mit ihrer Vollständigkeit**.

    ``kd`` ist die Σ der Tages-HDD über die Tage, für die eine Temperatur
    vorlag. Wie viele das waren, sagt ``tage_mit_temperatur``; wie viele es
    hätten sein können, ``tage_im_monat``. Ohne dieses Paar wäre ein Monat mit
    zwei erfassten Tagen von einem vollständigen nicht zu unterscheiden — und
    eine Fenster-Summe daraus behauptete eine Abdeckung, die sie nicht hat
    (ADR-002/P4).
    """

    jahr: int
    monat: int
    kd: float
    tage_mit_temperatur: int
    tage_im_monat: int

    @property
    def vollstaendig(self) -> bool:
        """Jeder Kalendertag des Monats trägt eine Temperatur."""
        return self.tage_mit_temperatur >= self.tage_im_monat


def heizgradtage_je_monat(
    je_tag: Mapping[date, float],
) -> dict[tuple[int, int], HeizgradtageMonat]:
    """Σ der Tages-Heizgradtage je Kalendermonat.

    Args:
        je_tag: ``{datum: Tagesmittel °C}`` — Tage ohne Temperaturspur sind
            **nicht enthalten** (so liefert es ``lade_tagesmittel_temperatur``).

    Returns:
        ``{(jahr, monat): HeizgradtageMonat}``. Ein Monat ohne einen einzigen
        Tag **fehlt im Ergebnis** — er ist kein Monat mit 0 Kd.
    """
    summe: dict[tuple[int, int], float] = {}
    tage: dict[tuple[int, int], int] = {}
    for datum, temperatur in je_tag.items():
        schluessel = (datum.year, datum.month)
        summe[schluessel] = summe.get(schluessel, 0.0) + heizgradtage_tag(temperatur)
        tage[schluessel] = tage.get(schluessel, 0) + 1
    return {
        (jahr, monat): HeizgradtageMonat(
            jahr=jahr,
            monat=monat,
            kd=round(summe[(jahr, monat)], 1),
            tage_mit_temperatur=tage[(jahr, monat)],
            tage_im_monat=calendar.monthrange(jahr, monat)[1],
        )
        for (jahr, monat) in sorted(summe)
    }


#: Es gibt überhaupt keine Temperaturspur — die Normierung hat keinen Nenner.
GRUND_KEINE_TEMPERATURREIHE: Final[str] = (
    "Für diesen Zeitraum liegt keine gemessene Außentemperatur vor — "
    "ohne sie gibt es keine Heizgradtage."
)


def heizgradtage_grund(
    je_monat: Mapping[tuple[int, int], HeizgradtageMonat],
    *,
    erster_monat_mit_bedarf: Optional[tuple[int, int]] = None,
) -> Optional[str]:
    """Warum die Wetternormierung weniger zeigt als die Sicht daneben (S3).

    ⭐ **Der Fall, für den es diesen Satz gibt** (gemessen an der Demo-Anlage):
    Winter 24/25 hat **vollständige** Wärmepumpen-Daten — vier von vier Monaten,
    1.215 kWh Heizstrom, im Strom-Modus sichtbar — und trotzdem keinen
    normierten Balken. Es fehlt die **Außentemperatur**, nicht die Wärmepumpe.
    Ohne den Satz liest der Anwender „eedc hat meine Daten von 2024 verloren".

    Args:
        je_monat: das Ergebnis von {@link heizgradtage_je_monat}.
        erster_monat_mit_bedarf: ältester ``(jahr, monat)``, für den es
            überhaupt Verbrauchszeilen gibt. ``None`` ⇒ es gibt nichts zu
            vergleichen, dann bleibt auch der Satz aus.

    Returns:
        Der Grund, oder ``None``, wenn die Temperaturreihe so weit zurückreicht
        wie die Verbrauchshistorie.
    """
    if not je_monat:
        return GRUND_KEINE_TEMPERATURREIHE
    if erster_monat_mit_bedarf is None:
        return None
    erster_mit_temperatur = min(je_monat)
    if erster_mit_temperatur <= erster_monat_mit_bedarf:
        return None
    jahr, monat = erster_mit_temperatur
    return (
        "Für ältere Zeiträume liegt keine gemessene Außentemperatur vor — "
        f"die Messreihe beginnt mit {monat:02d}/{jahr}."
    )


def normiert(
    menge_kwh: Optional[float],
    kd: Optional[float],
) -> Optional[float]:
    """Die wetternormierte Größe: Menge je Heizgradtag (kWh/Kd).

    ``None``, sobald eine Seite fehlt **oder** ``kd <= 0`` — nie ∞ und nie 0.
    Ein Sommerfenster hat keine Heizgradtage; dort ist die Normierung nicht
    „null je Kältegrad", sondern **ohne Aussage**, und die Anzeige nennt den
    Grund (SOLL §3.3/S3) statt einen Balken zu zeichnen.
    """
    if menge_kwh is None or kd is None or kd <= 0:
        return None
    return menge_kwh / kd
