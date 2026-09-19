"""N-526 (Kai2, Forum T89667 #345, 18.09.2026) — ein Balkonkraftwerk ohne PV-Module ist kein Befund.

Der Stammdaten-Check meldete seit #37 (22.03.) als INFO „Nur Balkonkraftwerk, keine PV-Module
angelegt — PVGIS-Prognose und String-Vergleich sind ohne PV-Module nicht verfügbar". Beides ist
seit #367 (v4.0.9) und F-10 (07.08.) falsch: ein Balkonkraftwerk trägt Nennleistung, Ausrichtung
und Neigung selbst, bekommt sein eigenes PVGIS-SOLL und ist im Vergleich je Erzeuger eine Zeile
wie ein String. Kai2 las den Satz als „deine Module fehlen" — er hatte je zwei Module IM
Balkonkraftwerk gepflegt. Es fehlt nichts, also gibt es keine Meldung (kein Ersatztext: eedc ist
nicht die PV-Polizei, Gernot 18.09.2026). Der ERROR für Anlagen ohne jeden Erzeuger bleibt.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import select

from backend.models.anlage import Anlage
from backend.models.investition import Investition
from backend.services.daten_checker import DatenChecker

MODUL_MELDUNGEN = ("Balkonkraftwerk, keine PV-Module", "Keine PV-Module als Investition angelegt")


async def _anlage(db, *typen: str) -> Anlage:
    a = Anlage(anlagenname="N-526", leistung_kwp=1.95, standort_land="DE",
               installationsdatum=date(2024, 9, 2))
    db.add(a)
    await db.flush()
    for i, typ in enumerate(typen):
        db.add(Investition(
            anlage_id=a.id, typ=typ, bezeichnung=f"{typ} {i + 1}", aktiv=True,
            anschaffungsdatum=date(2024, 9, 2),
            leistung_kwp=1.1 if typ == "balkonkraftwerk" else 4.0,
            parameter={"anzahl": 2, "leistung_wp": 550, "ausrichtung": "Ost-West",
                       "neigung_grad": 14} if typ == "balkonkraftwerk" else {},
        ))
    await db.commit()
    geladen = (await db.execute(select(Anlage).where(Anlage.id == a.id))).scalars().one()
    await db.refresh(geladen, ["investitionen"])
    return geladen


def _modul_meldungen(ergebnisse) -> list[str]:
    return [e.meldung for e in ergebnisse if any(m in e.meldung for m in MODUL_MELDUNGEN)]


async def test_zwei_balkonkraftwerke_ohne_pv_module_bekommen_keine_meldung(db):
    """Kai2s Anlage: zwei BKW, je zwei Module im Gerät, keine Komponente vom Typ PV-Module."""
    anlage = await _anlage(db, "balkonkraftwerk", "balkonkraftwerk")
    ergebnisse = DatenChecker(db)._check_stammdaten(anlage)
    assert _modul_meldungen(ergebnisse) == []


async def test_anlage_ohne_jeden_erzeuger_meldet_weiter_den_fehler(db):
    """Die Gegenprobe: ohne PV-Module UND ohne Balkonkraftwerk bleibt der ERROR."""
    anlage = await _anlage(db, "speicher")
    ergebnisse = DatenChecker(db)._check_stammdaten(anlage)
    treffer = [e for e in ergebnisse if e.meldung == "Keine PV-Module als Investition angelegt"]
    assert len(treffer) == 1
    assert treffer[0].schwere.name == "ERROR"


async def test_dachanlage_mit_pv_modulen_unveraendert(db):
    anlage = await _anlage(db, "pv-module")
    ergebnisse = DatenChecker(db)._check_stammdaten(anlage)
    assert _modul_meldungen(ergebnisse) == []
