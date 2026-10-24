"""Datetime helpers — SQLite menyimpan datetime naive UTC, jadi helper ini menghasilkan naive UTC."""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC now (setara datetime.utcnow() lama tanpa deprecation)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)