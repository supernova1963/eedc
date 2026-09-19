"""
API Dependencies

Gemeinsam genutzte Dependencies für FastAPI Endpoints.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import async_session_maker


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency für Datenbank-Session.

    Verwendung in Endpoints:
        @router.get("/")
        async def example(db: AsyncSession = Depends(get_db)):
            ...

    Yields:
        AsyncSession: Aktive Datenbank-Session

    ⚠ **Schreibrouten nehmen `Depends(get_db, scope="function")`** (N-530, 18.09.2026).
    Der Commit unten laeuft im Teardown der Dependency. Mit dem FastAPI-Default
    `scope="request"` laeuft der Teardown erst, NACHDEM die Antwort gesendet ist — ein
    sofortiger Folgeaufruf sah die eben angelegte Zeile in 0,4 % der Faelle noch nicht
    (gemessen: 4 und 5 von 600 Runden POST → GET ohne Pause; der Setup-Wizard kettet
    genau so). `scope="function"` zieht den Teardown vor das Senden (nach Endpunkt und
    Serialisierung): 0 von 600. Leserouten bleiben beim Default — streamende Exporte
    lesen ihre Session waehrend des Sendens. Waechter: `test_n530_schreibrouten_commit_vor_antwort.py`.
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
