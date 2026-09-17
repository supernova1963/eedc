"""N-234: die deutsche Zahlenschreibweise der PDF-Berichte.

⭐ **Seit N-353 (2026-09-16) ist dieses Modul die PDF-SEITE eines groesseren SoT.**
Die Rechnung selbst steht in ``core/zahlenformat.py`` — sie ist keine PDF-Regel,
sondern die Darstellungs-Regel des Produkts (Style-Guide 0a), und der Daten-Checker
brauchte sie ebenso. Was hier bleibt, ist genau das PDF-Spezifische: ``LEER`` ist der
**Gedankenstrich** der alten Makros, nicht der leere String des Kerns, und
``JINJA_FORMATIERER`` haengt die Namen in die Template-Umgebung. Die Signaturen sind
unveraendert; kein Builder und kein Template hat sich geaendert.

**Der Befund:** Der Jahresbericht schrieb Zahlen deutsch, die drei anderen
Berichte englisch — sichtbar als „7.9 Jahre", „12.32 kWp" und „48.1372°" in
einem ausgelieferten Dokument. Der Grund war nicht Nachlässigkeit, sondern
**Erreichbarkeit**: Die vier Formatierer lebten als Jinja-Makros **innerhalb**
von ``jahresbericht.html``, und Jinja vererbt Makros nicht über
``{% extends %}`` — für ``finanzbericht.html`` und ``anlagendokumentation.html``
waren sie schlicht nicht da. Die Python-Builder wiederum formatieren im Code,
wo ein Template-Makro ohnehin nicht greift.

**Warum es ein Python-Modul ist und nicht ein zweites Makro-Template:** Zwei
Implementierungen derselben Regel — eine für Jinja, eine für Python — wären
genau die Klasse, die im selben Paket als N-136 behoben wurde. Die Funktionen
hier sind der SoT; ``engine.py`` reicht sie als Jinja-Filter **und** als
Globals in die Templates, damit dort dieselbe Rechnung läuft.

**Die ``–``-Konvention ist übernommen, nicht erfunden:** ``None`` wird zum
Gedankenstrich, weil die Makros das schon so hielten und das PDF diese Lücke
vom Wert „0" unterscheidet (F-43 hängt daran).
"""

from __future__ import annotations

from typing import Optional

from backend.core import zahlenformat as _kern

#: Was ein fehlender Wert im PDF anzeigt. Bewusst der Gedankenstrich der
#: bisherigen Makros — nicht der Display-Token „—" des Frontends, sonst
#: änderte sich das Schriftbild jedes bestehenden Berichts.
LEER = "–"


def fmt_zahl(wert: Optional[float], decimals: int = 0) -> str:
    """Deutsche Schreibweise mit Tausenderpunkt: ``12.345,67``. Kern: `core.zahlenformat`."""
    return _kern.fmt_zahl(wert, decimals, leer=LEER)


def fmt_euro(wert: Optional[float]) -> str:
    """``12.345,67 €`` — zwei Nachkommastellen, wie bisher im Jahresbericht."""
    return _kern.fmt_euro(wert, 2, leer=LEER)


def fmt_kwh(wert: Optional[float], decimals: int = 0) -> str:
    """``12.345 kWh``."""
    return _kern.fmt_kwh(wert, decimals, leer=LEER)


def fmt_pct(wert: Optional[float], decimals: int = 1) -> str:
    """``12,3 %`` — **ohne** Tausenderpunkt und mit Leerzeichen vor dem Zeichen."""
    return _kern.fmt_pct(wert, decimals, leer=LEER)


def fmt_einheit(wert: Optional[float], einheit: str, decimals: int = 2) -> str:
    """``12,32 kWp`` — fuer die Einheiten, die keinen eigenen Helfer verdienen."""
    return _kern.fmt_einheit(wert, einheit, decimals, leer=LEER)


#: Was ``engine.py`` in die Jinja-Umgebung hängt. Als **Filter** benutzbar
#: (``{{ v|fmt_eur }}``) und als **Funktion** (``{{ fmt_eur(v) }}``), damit die
#: bestehenden Makro-Aufrufe in `jahresbericht.html` unverändert weiterlaufen.
#: ``fmt_eur``/``fmt_num`` sind die Namen, unter denen das Template sie kennt.
JINJA_FORMATIERER = {
    "fmt_zahl": fmt_zahl,
    "fmt_num": fmt_zahl,
    "fmt_euro": fmt_euro,
    "fmt_eur": fmt_euro,
    "fmt_kwh": fmt_kwh,
    "fmt_pct": fmt_pct,
    "fmt_einheit": fmt_einheit,
}
