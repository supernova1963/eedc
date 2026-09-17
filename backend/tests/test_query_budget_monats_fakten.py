"""Die Monats-Fakten fragen die Stundentabelle in **konstant** wenigen Abfragen.

Schwesterdatei: `test_preis_aggregat_symmetrie.py` (dass die gruppierte Messung
dasselbe sagt wie die Einzelabfrage).

**Der Gegenstand — und warum ein Zugriffs-Wächter und kein Zahlen-Test.** Am
15.09.2026 brauchte `GET /monatsdaten/aggregiert` an einer produktiven Anlage
2,4 s für 39 Monate, `investitionen/roi` 3,9 s, Cockpit → Jahr im Browser 10,1 s.
Kein einziger Wert war falsch — die Bauform war es:

* **117 Abfragen** über `tages_energie_profil` (39 Monate × 3 Aufrufer der
  Preis-Kaskade), jede wegen `extract("year"/"month", datum)` über **alle**
  Zeilen der Anlage, auch für Monate ohne eine einzige Stundenzeile;
* dazu **ein Entity-Load** derselben Tabelle: 17.366 ORM-Objekte und 35.861
  `json.loads` je Anfrage, nur damit sechs Float-Spalten summiert werden.

Beides kostet **linear mit der Zahl der Monate** — eine Anlage hält 20 Jahre.
Eine Probe über Zahlen hätte davon nichts gesehen; diese hier misst, **wie oft
und in welcher Form** gefragt wird, und wäre beim ersten Bau rot gewesen.

⚠ **Sie prüft nicht „STRFTIME kommt nirgends vor".** In `GROUP BY` und `SELECT`
ist die Funktion richtig und nötig — der Index stört sich nur daran, wenn sie im
**Filter** neben `anlage_id` steht. Genau diese Trennung steht unten in `Z1`.
"""

from __future__ import annotations

import re
from datetime import date

import pytest
from sqlalchemy import event

from backend.models import Anlage, Investition
from backend.models.investition import InvestitionMonatsdaten
from backend.models.monatsdaten import Monatsdaten
from backend.models.tages_energie_profil import TagesEnergieProfil
from backend.services.monats_fakten import lade_monats_fakten

TABELLE = "tages_energie_profil"


class Mitschrift:
    """Sammelt die abgesetzten SQL-Statements einer Session."""

    def __init__(self) -> None:
        self.sql: list[str] = []

    def __call__(self, conn, cursor, statement, parameters, context, executemany):
        self.sql.append(" ".join(statement.split()))

    def gegen_tabelle(self) -> list[str]:
        return [s for s in self.sql if f"FROM {TABELLE}" in s]

    def mit_strftime_im_filter(self) -> list[str]:
        """Statements, deren **WHERE** `STRFTIME` und die Tabelle berührt."""
        treffer = []
        for s in self.gegen_tabelle():
            m = re.search(r"\bWHERE\b(.*?)(\bGROUP BY\b|\bORDER BY\b|\bLIMIT\b|$)", s, re.I)
            if m and "STRFTIME" in m.group(1).upper():
                treffer.append(s)
        return treffer

    def entity_loads(self) -> list[str]:
        """Ein Vollobjekt-Load erkennt man an einer Spalte, die nur er braucht."""
        return [s for s in self.gegen_tabelle() if f"{TABELLE}.source_provenance" in s]


async def _anlage_mit_monaten(db, monate: int) -> int:
    """Eine Anlage, bei der **jeder** Pfad der Schicht anspringt.

    * Wallbox-Zeilen **ohne** ``ladung_pv_kwh`` ⇒ der Ladeanteil wird aus der
      Tagesebene abgeleitet (der Pfad, der den Entity-Load auslöste);
    * ein Monat **ohne** Speicher-Zeile ⇒ der Speicher-Fallback greift;
    * Stundenzeilen mit Preisen in **jedem** Monat ⇒ Stufe 2 der Preis-Kaskade
      läuft überall.
    """
    anlage = Anlage(anlagenname="Budget", leistung_kwp=10.0)
    db.add(anlage)
    await db.flush()

    wallbox = Investition(
        anlage_id=anlage.id, typ="wallbox", bezeichnung="WB",
        anschaffungsdatum=date(2023, 1, 1), anschaffungskosten_gesamt=1000.0, aktiv=True,
    )
    speicher = Investition(
        anlage_id=anlage.id, typ="speicher", bezeichnung="Akku",
        anschaffungsdatum=date(2023, 1, 1), anschaffungskosten_gesamt=5000.0, aktiv=True,
    )
    db.add_all([wallbox, speicher])
    await db.flush()

    jahr, monat = 2023, 1
    for i in range(monate):
        db.add(Monatsdaten(
            anlage_id=anlage.id, jahr=jahr, monat=monat,
            einspeisung_kwh=100.0, netzbezug_kwh=200.0,
        ))
        db.add(InvestitionMonatsdaten(
            investition_id=wallbox.id, jahr=jahr, monat=monat,
            verbrauch_daten={"ladung_kwh": 120.0},  # ohne `ladung_pv_kwh`
        ))
        if i > 0:  # der erste Monat bleibt ohne Speicher-Zeile
            db.add(InvestitionMonatsdaten(
                investition_id=speicher.id, jahr=jahr, monat=monat,
                verbrauch_daten={"ladung_kwh": 50.0, "entladung_kwh": 45.0},
            ))
        for tag in (1, 2):
            for stunde in range(4):
                db.add(TagesEnergieProfil(
                    anlage_id=anlage.id, datum=date(jahr, monat, tag), stunde=stunde,
                    pv_kw=1.0, verbrauch_kw=2.0, einspeisung_kw=0.5,
                    netzbezug_kw=0.8, batterie_kw=0.0, strompreis_cent=30.0,
                ))
        monat += 1
        if monat == 13:
            jahr, monat = jahr + 1, 1
    await db.flush()
    return anlage.id


async def _mit_mitschrift(db, anlage_id: int) -> Mitschrift:
    mit = Mitschrift()
    event.listen(db.bind.sync_engine, "after_cursor_execute", mit)
    try:
        await lade_monats_fakten(db, anlage_id)
    finally:
        event.remove(db.bind.sync_engine, "after_cursor_execute", mit)
    return mit


class TestZugriffsmuster:
    @pytest.mark.asyncio
    async def test_z1_kein_strftime_im_filter_auf_die_stundentabelle(self, db):
        """`extract()` über der Spalte schaltet `ix_tep_anlage_datum` aus.

        Vor dem Umbau standen hier 117 solcher Statements. Im `GROUP BY` bleibt
        die Funktion erlaubt — geprüft wird nur der `WHERE`-Teil.
        """
        anlage_id = await _anlage_mit_monaten(db, 12)
        mit = await _mit_mitschrift(db, anlage_id)

        schlimme = mit.mit_strftime_im_filter()
        assert not schlimme, (
            f"{len(schlimme)} Abfrage(n) filtern {TABELLE} mit STRFTIME über der "
            f"Datumsspalte — der Index greift dann nur noch auf die Anlage, "
            f"jede Abfrage liest deren ganze Historie. Bereichsbedingung "
            f"(`datum >= … AND datum <`) benutzen, s. "
            f"`strompreis_aggregator.monats_fenster`.\n  " + schlimme[0][:200]
        )

    @pytest.mark.asyncio
    async def test_z2_die_zahl_der_abfragen_waechst_nicht_mit_den_monaten(self, db):
        """Der eigentliche Punkt: **O(1)**, nicht O(Monate).

        Doppelt so viele Monate dürfen die Stundentabelle nicht öfter fragen —
        sonst wächst jede Sicht mit dem Alter der Anlage.
        """
        kurz = await _mit_mitschrift(db, await _anlage_mit_monaten(db, 12))
        lang = await _mit_mitschrift(db, await _anlage_mit_monaten(db, 24))

        assert len(kurz.gegen_tabelle()) == len(lang.gegen_tabelle()), (
            f"12 Monate → {len(kurz.gegen_tabelle())} Abfragen, "
            f"24 Monate → {len(lang.gegen_tabelle())}. Die Zahl muss konstant "
            f"bleiben (eine Anlage hält 20 Jahre)."
        )
        assert len(lang.gegen_tabelle()) <= 3, (
            f"{len(lang.gegen_tabelle())} Abfragen gegen {TABELLE} je Aufruf — "
            f"erlaubt sind höchstens drei (gemessene Preise, Tagesebene, Rand)."
        )

    @pytest.mark.asyncio
    async def test_z3_kein_vollobjekt_load_der_stundenzeilen(self, db):
        """Sechs Float-Summen brauchen keine 17.366 ORM-Objekte.

        Ein Entity-Load deserialisiert nebenbei vier JSON-Spalten je Zeile — das
        war der Posten, der den Event-Loop blockierte und parallele Seitenabrufe
        gegenseitig ausbremste.
        """
        anlage_id = await _anlage_mit_monaten(db, 12)
        mit = await _mit_mitschrift(db, anlage_id)

        loads = mit.entity_loads()
        assert not loads, (
            f"{len(loads)} Vollobjekt-Load(s) der Stundentabelle. Die Faltung "
            f"`bilanz_aus_stundenrows` liest sechs Spalten — als Spalten-Select "
            f"abfragen (s. `monats_aus_tagen.lade_monats_summen_aus_tagen`).\n"
            f"  " + loads[0][:200]
        )
