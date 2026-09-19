"""Daten-Checker — Zählerstände: rückspringende Zähler (N-47), Fenster und Beispiele.
"""
# Reiner Umzug aus `services/daten_checker/datenquelle.py` (18.09.2026, Vorlage 9 des Refactorings grosser
# Dateien): Methoden, Attribute und Helfer 1:1 uebernommen, kein Verhaltenswechsel. Die Fassade `__init__.py`
# traegt `DatenquelleChecks` als Verbund dieser Mixins weiter; `DatenChecker` komponiert wie bisher.

from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import select
from backend.models.anlage import Anlage
from backend.services.daten_checker.kategorien import (
    CheckErgebnis,
    CheckKategorie,
    CheckSeverity,
    LINK_DATENQUELLEN,
)
from backend.core.zahlenformat import fmt_zahl


#: Fenster, über das der Rücksprung-Check die Standreihen liest (N-341).
#:
#: **30 Tage, weil ein Monat die Frage ist, um die es geht** — kürzer würde ein
#: monatlich zurückgesetzter Zähler nie auffallen. Die MQTT-Rohreihe hält
#: ohnehin 31 Tage vor (`cleanup_old_snapshots`).
RUECKSPRUNG_FENSTER_TAGE = 30

#: Wie viele betroffene Felder die Meldung beim Namen nennt.
RUECKSPRUNG_BEISPIELE = 5


class RuecksprungChecks:
    """Prüfung rückspringender Zählerstände."""

    async def _check_zaehler_ruecksprung(
        self, anlage: Anlage, jetzt: Optional[datetime] = None,
    ) -> list[CheckErgebnis]:
        """Ein zugeordneter Zähler springt zurück — und liefert deshalb nichts.

        **Der Anlass (N-341).** eedc lehnt einen Zähler mit Tages- oder
        Monats-Reset als Mengenquelle ab: Die Differenz zweier Stände, zwischen
        denen der Zähler neu begonnen hat, ist keine Menge (`reader.delta`).
        Bis zum 28.08.2026 entstand daraus im Monatsfenster sogar eine
        *falsche* Zahl; seither entsteht **keine**. Beides sah für den Anwender
        gleich aus — er sieht ein leeres Feld und erfährt nicht, warum.

        ⭐ **Der Hinweis existiert längst, nur an der falschen Stelle im
        Lebenslauf.** Der Daten-Checker rät beim **Anlegen** eines Helfers
        ausdrücklich zu *Zurücksetzen „nie" (ohne Zyklus)* (`sensoren.py`). Wer
        den Sensor bereits zugeordnet hat, liest diesen Rat nie — dieselbe
        Klasse wie W-18: ein erkannter Zustand, der nur als Logzeile existierte.

        ⚠ **Geprüft werden die MQTT-Reihen**, nicht alles. Über Home Assistant
        kommt der reset-bereinigte ``sum``-Wert, dort ist ein `utility_meter`
        mit Tageszyklus folgenlos; die rohen Stände aus MQTT trifft es. Gas-,
        Wasser- und Ölzähler haben mit ``zaehlerstand_reihe`` ihren eigenen
        Punkt und eine eigene Tabelle — **kein zweiter Turm daneben.**

        ⛔ **Kein Reparatur-Knopf.** eedc kann den Rücksprung nicht heilen: Die
        Energie zwischen dem letzten Stand und dem Reset steht in keiner Quelle,
        und die Reparatur liegt beim Absender — im Helfer, im Publisher, im
        Skript. Ein Knopf, der hier etwas verspricht, wäre die P-6-Falle in der
        Gegenrichtung.

        **Eine Meldung je Anlage, nicht je Feld.** Wer seinen Publisher auf
        „heute"-Felder gestellt hat, hat das meist für alle getan; zwanzig
        gleichlautende Zeilen wären keine bessere Auskunft
        ([[feedback_daten_checker_kein_akzeptiert]] — melden und erklären,
        nicht nörgeln).

        Args:
            jetzt: Endzeitpunkt des Prüffensters. Default ist die Uhr; die
                Naht existiert für die Proben (s. Kommentar im Rumpf).
        """
        from backend.core.field_definitions import FELD_LABELS
        from backend.models.investition import Investition as _Inv
        from backend.services.snapshot.reader import (
            MQTT_AKTIV_TAGE, finde_zaehler_ruecksprunge, mqtt_zaehler_keys,
        )

        kat = CheckKategorie.ZAEHLER_RUECKSPRUNG.value

        # ⚠ `jetzt` ist eine NAHT, kein `datetime.now()` mitten im Rumpf: Eine
        # Probe, die die Prozessuhr liest, wettet auf die Stunde ihres Laufs
        # (N-167) — und die Suite fährt in drei Zeitzonen. Der Wächter
        # `test_konformitaet_echte_uhr_in_tests.py` verhindert genau das.
        bis = jetzt or datetime.now()
        von = bis - timedelta(days=RUECKSPRUNG_FENSTER_TAGE)
        # Dasselbe Aktiv-Fenster wie die Abdeckungs-Prüfung: ein Topic, das seit
        # Wochen schweigt, ist eine andere Frage und hat dort seinen Punkt.
        keys = await mqtt_zaehler_keys(
            self.db, anlage.id, seit=bis - timedelta(days=MQTT_AKTIV_TAGE),
        )
        if not keys:
            return []

        # ⚑ **Bewusst OHNE Aktiv-Filter** — anders als in N-64/N-313, wo
        # dieselbe Zeile eine Rechnung speist. Hier dient sie allein dem
        # **Namen** in der Meldung: Sendet das Topic eines stillgelegten Geräts
        # weiter und springt zurück, ist der Befund richtig und der Anwender
        # soll lesen, um welches Gerät es geht. Welche Felder überhaupt geprüft
        # werden, entscheidet `mqtt_zaehler_keys` — nicht diese Liste.
        inv_result = await self.db.execute(
            select(_Inv).where(_Inv.anlage_id == anlage.id)
        )
        invs_by_id = {str(inv.id): inv for inv in inv_result.scalars().all()}

        def _feld_name(sensor_key: str) -> str:
            """`basis:netzbezug` → „Netzbezug"; `inv:7:ladung_kwh` → „ID.3 – Ladung"."""
            if sensor_key.startswith("inv:"):
                _, inv_id, feld = sensor_key.split(":", 2)
                inv = invs_by_id.get(inv_id)
                label = FELD_LABELS.get(feld, feld)
                return f"{inv.bezeichnung} – {label}" if inv else label
            feld = sensor_key.split(":", 1)[-1]
            return FELD_LABELS.get(feld, FELD_LABELS.get(f"{feld}_kwh", feld))

        betroffen: list[tuple[str, int, datetime, float, float]] = []
        for sensor_key in sorted(keys):
            spruenge = await finde_zaehler_ruecksprunge(
                self.db, anlage.id, sensor_key, von, bis,
            )
            if spruenge:
                zeitpunkt, vorher, nachher = spruenge[-1]  # der jüngste
                betroffen.append(
                    (_feld_name(sensor_key), len(spruenge), zeitpunkt, vorher, nachher)
                )

        if not betroffen:
            return []

        betroffen.sort(key=lambda b: -b[1])
        namen = "; ".join(f"{name} ({anzahl}×)" for name, anzahl, *_ in
                          betroffen[:RUECKSPRUNG_BEISPIELE])
        if len(betroffen) > RUECKSPRUNG_BEISPIELE:
            namen += f" (+{len(betroffen) - RUECKSPRUNG_BEISPIELE} weitere)"

        _name, _anzahl, zeitpunkt, vorher, nachher = betroffen[0]
        beleg = (
            f"Zuletzt am {zeitpunkt.strftime('%d.%m.%Y um %H:%M')} bei „{_name}“: "
            f"{fmt_zahl(vorher, 1)} → {fmt_zahl(nachher, 1)}."
        )

        return [CheckErgebnis(
            kategorie=kat,
            schwere=CheckSeverity.WARNING,
            meldung=(
                f"{len(betroffen)} Zähler-Feld(er) werden zwischendurch "
                f"zurückgesetzt — daraus entsteht keine Monatsmenge"
            ),
            details=(
                f"Ein Zählerstand muss fortlaufend steigen. Bei diesen Feldern "
                f"fällt er in den letzten {RUECKSPRUNG_FENSTER_TAGE} Tagen "
                f"wieder auf einen niedrigeren Wert zurück — typisch für ein "
                f"Feld, das „heute“ oder „diesen Monat“ meint. {beleg} "
                f"Folge: eedc kann für diese Felder keine Tages- oder "
                f"Monatsmenge bilden, denn die Differenz zweier Stände aus "
                f"verschiedenen Zählerläufen ist keine Menge. Sie bleiben im "
                f"Monatsabschluss ohne Vorschlag. "
                f"Lösung: Schicke den fortlaufenden Stand statt des Tageswerts. "
                f"Kommt der Wert aus einem Home-Assistant-Helfer, steht die "
                f"Einstellung unter Einstellungen → Geräte & Dienste → Helfer: "
                f"Zurücksetzen auf „nie“ (ohne Zyklus). Kommt er aus einer "
                f"eigenen App oder einem Skript, sende den Lebenszählerstand. "
                f"eedc bildet Tag, Monat und Jahr daraus selbst — und exakt. "
                f"Betroffen: {namen}"
            ),
            link=LINK_DATENQUELLEN,
        )]
