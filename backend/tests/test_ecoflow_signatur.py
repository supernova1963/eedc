"""Akzeptanztest: EcoFlow-Signatur — Konvention + kein Content-Type-Header.

Bug-Historie (Dirk-PN 2026-05-21):
1. Erst-Einordnung „kein Code-Bug" — voreilig (Abgleich lief auf dem
   parameterlosen device/list, der den Fehler maskierte).
2. Folge-Fix 2da913ce sortierte irrtümlich ALLE Parameter gemeinsam
   (`accessKey=…&nonce=…&sn=…&timestamp=…`). Dirks Live-Test ergab
   `code 8521 signature is wrong` — auch diese Theorie war falsch.
3. Echte Lage, per Live-Konto bestätigt (device/quota/all → code=0):
   - EcoFlow signiert die Request-Parameter sortiert und hängt
     `accessKey/nonce/timestamp` an: `sn=…&accessKey=…&nonce=…&timestamp=…`.
   - Der Header `Content-Type: application/json` auf dem GET
     `device/quota/all` löst die 8521-Ablehnung aus und darf nicht
     gesetzt werden.
"""

from __future__ import annotations

import hashlib
import hmac

from backend.services.cloud_import.ecoflow_powerocean import _build_sign_headers


def _erwarteter_sign(sign_str: str, secret_key: str) -> str:
    return hmac.new(
        secret_key.encode(), sign_str.encode(), hashlib.sha256
    ).hexdigest()


def test_request_parameter_vor_auth_triple():
    """sn (Request-Parameter) steht VOR accessKey/nonce/timestamp."""
    headers = _build_sign_headers("AKtest", "SKtest", {"sn": "ABC123"})
    nonce, ts = headers["nonce"], headers["timestamp"]

    korrekt = f"sn=ABC123&accessKey=AKtest&nonce={nonce}&timestamp={ts}"
    assert headers["sign"] == _erwarteter_sign(korrekt, "SKtest")

    # Die Regression aus Fix 2da913ce — sn alphabetisch zwischen nonce und
    # timestamp einsortiert — scheiterte live mit code 8521.
    regression = f"accessKey=AKtest&nonce={nonce}&sn=ABC123&timestamp={ts}"
    assert headers["sign"] != _erwarteter_sign(regression, "SKtest")


def test_ohne_params():
    """Parameterloser Aufruf (device/list): accessKey&nonce&timestamp."""
    headers = _build_sign_headers("AKtest", "SKtest", None)
    nonce, ts = headers["nonce"], headers["timestamp"]

    erwartet = f"accessKey=AKtest&nonce={nonce}&timestamp={ts}"
    assert headers["sign"] == _erwarteter_sign(erwartet, "SKtest")


def test_verschachtelte_params_sortiert_dann_auth_triple():
    """POST-Body: verschachtelte Request-Parameter sortiert, dann Auth-Triple."""
    headers = _build_sign_headers(
        "AKtest", "SKtest", {"sn": "X9", "params": {"cmdSet": 11}}
    )
    nonce, ts = headers["nonce"], headers["timestamp"]

    korrekt = (
        f"params.cmdSet=11&sn=X9&accessKey=AKtest&nonce={nonce}&timestamp={ts}"
    )
    assert headers["sign"] == _erwarteter_sign(korrekt, "SKtest")


def test_kein_content_type_header():
    """Kein Content-Type-Header — er löst auf GET device/quota/all code 8521 aus.

    Für POST device/quota/data setzt httpx Content-Type über `json=` selbst;
    der GET-Verbindungstest darf ihn NICHT tragen.
    """
    headers = _build_sign_headers("AKtest", "SKtest", {"sn": "ABC123"})
    assert "Content-Type" not in headers
    assert set(headers) == {"accessKey", "nonce", "timestamp", "sign"}
