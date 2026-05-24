"""Versionierte einmalige Daten-Migrationen (v3.33.0+).

Jede Datei `migrate_vX_Y_Z_<beschreibung>.py` enthält genau eine async-
Funktion `migrate_<...>(session)` und wird in `core/database._run_data_migrations`
über `_apply_once(name, fn)` registriert — Idempotenz über die
`migrations`-Tabelle.

Konvention: Eintrag in der `migrations`-Tabelle nutzt den Modul-/Funktions-
namen ohne Doppel-Slug, damit Re-Names sichtbar werden.
"""
