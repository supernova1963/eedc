"""N-530: eine Schreibroute committet, BEVOR die Antwort den Client erreicht.

`api/deps.py::get_db` committet im Teardown der Dependency. Mit dem FastAPI-Default
`scope="request"` läuft dieser Teardown erst, NACHDEM die Antwort gesendet ist — ein
sofortiger Folgeaufruf (der Setup-Wizard kettet POST Wechselrichter → POST PV-Module mit
dessen id) sah die Zeile deshalb in 0,4 % der Fälle noch nicht. Gemessen 18.09.2026 an
einer r28-Kopie, 600 Runden POST → GET → PUT → GET → DELETE ohne Pause: 4 und 5
Nachzügler-404 am alten Stand, 0 mit `scope="function"` (FastAPI 0.136.3: der Teardown
läuft dann nach Endpunkt und Serialisierung, aber vor dem Senden).

Die Regel ist deshalb einheitlich: **jede** Route mit POST/PUT/PATCH/DELETE, die
`get_db` nimmt, trägt `Depends(get_db, scope="function")` — auch die, die selbst schon
committen (ein zweiter Commit ist ein No-op; eine Regel ohne Ausnahmen braucht keine
Liste). Leserouten bleiben beim Default: sie gewinnen nichts, und streamende Exporte
lesen ihre Session noch während des Sendens.

Ein Prüfer zählt sich nicht selbst: die Probe unten verlangt, dass die Erfassung
überhaupt Schreibrouten sieht — ein leerer Scan wäre sonst still grün.
"""

from __future__ import annotations

import ast
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
_SCHREIBEND = {"post", "put", "patch", "delete"}


def _quelldateien():
    yield from sorted((_BACKEND / "api").rglob("*.py"))
    yield _BACKEND / "main.py"


def _schreibrouten():
    """(relativer Pfad, Funktion) je Route mit POST/PUT/PATCH/DELETE-Dekorator."""
    for pfad in _quelldateien():
        baum = ast.parse(pfad.read_text(encoding="utf-8"))
        for fn in ast.walk(baum):
            if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if any(
                isinstance(d, ast.Call)
                and isinstance(d.func, ast.Attribute)
                and d.func.attr in _SCHREIBEND
                for d in fn.decorator_list
            ):
                yield pfad.relative_to(_BACKEND).as_posix(), fn


def _get_db_depends(fn):
    """Alle `Depends(get_db…)`-Defaults in der Signatur der Funktion."""
    for d in fn.args.defaults + [x for x in fn.args.kw_defaults if x is not None]:
        if (
            isinstance(d, ast.Call)
            and isinstance(d.func, ast.Name)
            and d.func.id == "Depends"
            and d.args
            and isinstance(d.args[0], ast.Name)
            and d.args[0].id == "get_db"
        ):
            yield d


def _scope(depends: ast.Call):
    for kw in depends.keywords:
        if kw.arg == "scope" and isinstance(kw.value, ast.Constant):
            return kw.value.value
    return None


def test_schreibrouten_committen_vor_der_antwort():
    gesehen = 0
    fehlend: list[str] = []
    for rel, fn in _schreibrouten():
        for dep in _get_db_depends(fn):
            gesehen += 1
            if _scope(dep) != "function":
                fehlend.append(f"  {rel}::{fn.name} (Z. {dep.lineno})")
    assert gesehen >= 80, (
        f"Die Erfassung sieht nur {gesehen} Schreibrouten mit get_db — "
        "am 18.09.2026 waren es 91. Erst den Prüfer richten, dann die Regel prüfen."
    )
    assert not fehlend, (
        f"{len(fehlend)} Schreibroute(n) committen erst NACH dem Senden der Antwort "
        "(N-530) — `Depends(get_db, scope=\"function\")` in die Signatur:\n"
        + "\n".join(fehlend)
    )


def test_leserouten_bleiben_beim_default():
    """Die Gegenrichtung: kein GET trägt den Function-Scope — streamende Exporte
    lesen ihre Session während des Sendens, und ein GET gewinnt durch den früheren
    Teardown nichts. Wer ihn dort braucht, begründet es hier."""
    mit_scope: list[str] = []
    for pfad in _quelldateien():
        baum = ast.parse(pfad.read_text(encoding="utf-8"))
        for fn in ast.walk(baum):
            if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            methoden = {
                d.func.attr
                for d in fn.decorator_list
                if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute)
            }
            if "get" not in methoden or methoden & _SCHREIBEND:
                continue
            for dep in _get_db_depends(fn):
                if _scope(dep) is not None:
                    mit_scope.append(f"  {pfad.relative_to(_BACKEND).as_posix()}::{fn.name}")
    assert not mit_scope, "GET-Routen mit explizitem Scope:\n" + "\n".join(mit_scope)
