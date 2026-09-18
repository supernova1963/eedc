"""N-479 — Monat und Jahr sagen „kein Heizbetrieb", nicht „kein Zähler".

**Der Anlassfall** (simon42 T89667, dietmar1968, 16.09.2026): An seiner
Wärmepumpe hängen BEIDE Wärmemengenzähler und liefern (Heizwärme 9125,59 kWh,
Warmwasser-Wärme 3998,67 kWh). Im **September** wurde nicht geheizt — die
Heizwärme des Monats ist 0. Der Tag sagte dazu „kein Heizbetrieb in diesem
Zeitraum", Monat und Jahr sagten „kein Wärmemengenzähler zugeordnet".

Der zweite Satz ist **falsch** und teuer: Er schickt den Anwender in
*Einstellungen → Datenquellen*, um eine Zuordnung zu suchen, die er längst hat.

**Warum es passierte:** Die Mengen sind ``float`` mit 0-Default. Eine gemessene
Null und ein fehlender Zähler tragen beide ``0.0`` bei, und ``sum()`` kann sie
danach nicht mehr trennen. Der Tag konnte es immer — er liest die Zeile selbst.
"""
from backend.core.berechnungen.imd_monatsaggregat import imd_typ_beitrag
from backend.core.berechnungen.waermepumpe_kennzahl import (
    GRUND_KEIN_HEIZBETRIEB, arbeitszahl_je_funktion,
)


class _Inv:
    def __init__(self, parameter=None):
        self.id = 7
        self.typ = "waermepumpe"
        self.parameter = parameter or {"getrennte_strommessung": True}
        self.bezeichnung = "Nibe F1155"


def test_gemessene_null_ist_am_beitrag_erkennbar():
    """Zähler da, Wert 0 ⇒ ``gemessen`` — die Menge bleibt trotzdem 0.0."""
    b = imd_typ_beitrag(_Inv(), {
        "heizenergie_kwh": 0,          # gemessen: diesen Monat nicht geheizt
        "warmwasser_kwh": 320.0,
        "strom_heizen_kwh": 0,
        "strom_warmwasser_kwh": 95.0,
    })
    assert b.wp_heizung == 0.0, "die MENGE muss 0 bleiben"
    assert b.wp_heizung_gemessen is True, "der Zähler stand da und meldete 0"
    assert b.wp_warmwasser_gemessen is True
    assert b.wp_strom_heizen_gemessen is True


def test_fehlender_zaehler_ist_nicht_gemessen():
    """Die Gegenrichtung — ohne sie wäre die Marke wertlos."""
    b = imd_typ_beitrag(_Inv(), {
        "warmwasser_kwh": 320.0,
        "strom_warmwasser_kwh": 95.0,
    })
    assert b.wp_heizung == 0.0
    assert b.wp_heizung_gemessen is False, "kein Heizwärme-Zähler in der Zeile"
    assert b.wp_strom_heizen_gemessen is False


def test_monat_sagt_kein_heizbetrieb_statt_kein_zaehler():
    """Der Melder-Fall: gemessene Null ⇒ ZEITRAUM-Grund."""
    az = arbeitszahl_je_funktion(
        heizung_kwh=0.0, strom_heizen_kwh=0.0,
        warmwasser_kwh=320.0, strom_warmwasser_kwh=95.0,
        hat_split=True,
        null_ist_gemessen_heizen=True,
        null_ist_gemessen_warmwasser=True,
    )
    assert az.heizen.wert is None, "ohne Wärme gibt es keine Arbeitszahl"
    assert az.heizen.grund == GRUND_KEIN_HEIZBETRIEB, (
        f"Monat nennt den Ausstattungs- statt des Zeitraum-Grunds: {az.heizen.grund!r}"
    )
    assert az.warmwasser.wert is not None, "Warmwasser hat Zähler UND Menge"


def test_ohne_marke_bleibt_der_ausstattungs_grund():
    """Die Gegenprobe: ohne die Marke verhält sich der Monat wie vor N-479.

    Das ist zugleich die Zusicherung für den Zwilling
    ``FunktionsEingaengeDerAnlage``, der sie bewusst nie setzt.
    """
    az = arbeitszahl_je_funktion(
        heizung_kwh=0.0, strom_heizen_kwh=0.0,
        warmwasser_kwh=320.0, strom_warmwasser_kwh=95.0,
        hat_split=True,
    )
    assert az.heizen.grund != GRUND_KEIN_HEIZBETRIEB


def test_je_funktion_getrennt_beantwortbar():
    """Heizwärme gemessen, Warmwasser nicht — beide Aussagen nebeneinander.

    Ein einziges Flag für beide Funktionen hätte hier zwangsläufig eine der
    zwei Zeilen falsch beschriftet.
    """
    az = arbeitszahl_je_funktion(
        heizung_kwh=0.0, strom_heizen_kwh=0.0,
        warmwasser_kwh=0.0, strom_warmwasser_kwh=0.0,
        hat_split=True,
        null_ist_gemessen_heizen=True,
        null_ist_gemessen_warmwasser=False,
    )
    assert az.heizen.grund == GRUND_KEIN_HEIZBETRIEB
    assert az.warmwasser.grund != GRUND_KEIN_HEIZBETRIEB


def test_tagespfad_unveraendert():
    """``null_ist_gemessen=True`` wirkt weiter auf BEIDE Funktionen.

    Der Tag setzt es pauschal; die feinen Marken dürfen ihn nicht verändern.
    """
    az = arbeitszahl_je_funktion(
        heizung_kwh=0.0, strom_heizen_kwh=0.0,
        warmwasser_kwh=0.0, strom_warmwasser_kwh=0.0,
        hat_split=True,
        null_ist_gemessen=True,
    )
    assert az.heizen.grund == GRUND_KEIN_HEIZBETRIEB
    assert az.warmwasser.grund is not None


def test_gemessene_waerme_ohne_strom_bleibt_beim_strom_grund():
    """⛔ **Die Grenze, die N-438/S3 zieht — hier gefangen, nicht erdacht.**

    Beim ersten Bau stand die Marke allein auf der WÄRME-Seite. Damit meldete
    eine Anlage mit **1800 kWh gemessener Heizwärme**, aber ohne Heizstrom,
    plötzlich „kein Heizbetrieb in diesem Zeitraum" — eine Falschaussage: Es
    wurde geheizt, nur der Nenner fehlt. Gefangen hat das
    ``test_r2_je_funktion::test_n438_ohne_jeden_heizstrom_bleibt_die_maskierung``.

    ⭐ **Die Regel daraus:** „In diesem Zeitraum nicht geheizt" ist eine Aussage
    über das Gerät und setzt voraus, dass **Zähler UND Nenner** dastanden und
    null meldeten. Fehlt eine der beiden Seiten, ist der Satz über die fehlende
    Seite der genauere.
    """
    az = arbeitszahl_je_funktion(
        heizung_kwh=1800.0,        # gemessen und deutlich über null
        strom_heizen_kwh=0.0,      # der Nenner fehlt ganz
        warmwasser_kwh=0.0, strom_warmwasser_kwh=0.0,
        hat_split=True,
        # So, wie die Aufrufer sie jetzt bilden: Wärme gemessen, Strom nicht.
        null_ist_gemessen_heizen=(True and False),
        null_ist_gemessen_warmwasser=(False and False),
    )
    assert az.heizen.wert is None
    assert az.heizen.grund != GRUND_KEIN_HEIZBETRIEB, (
        'gemessene Waerme ohne Strom ist kein *nicht geheizt* - der Nenner fehlt'
    )
