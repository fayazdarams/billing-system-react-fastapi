# app/services/tenant.py
# Tenant DB: one engine per store DB (not per user), cached. Same idea as your
# "per-user cache + connection pool ~0ms after first request".
import os
from fastapi import Cookie, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from app.database import engine as auth_engine

# (host, db_user, db_name) -> tenant engine. Engines hold their own pool, so we keep them.
# Key is the store DB, NOT user_id: multiple users of the same store share one
# engine / pool. Multiple devices of one user also share it (same user_id -> same DB).
_tenant_engines: dict[tuple, object] = {}

def get_tenant_engine(user_id: int):
    # Auth table holds where this user's store data lives.
    try:
        with auth_engine.connect() as conn:
            row = conn.execute(
                text("SELECT databasehost, databaseuser, databasepassword, databasename FROM auth WHERE id = :uid"),
                {"uid": user_id},
            ).first()
    except OperationalError:
        raise HTTPException(503, "Database is unavailable. Please try again later.")
    if not row:
        raise HTTPException(401, "User not found")
    host, db_user, db_pass, db_name = row
    key = (host, db_user, db_name)
    if key in _tenant_engines:
        return _tenant_engines[key]
    url = f"postgresql://{db_user}:{db_pass}@{host}/{db_name}"
    eng = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5, pool_timeout=5)
    _tenant_engines[key] = eng
    return eng

def get_current_user_id(session_id: str | None = Cookie(default=None)) -> int:
    """Same session cookie as /me. Returns user_id or 401."""
    if not session_id:
        raise HTTPException(401, "Not logged in")
    try:
        with auth_engine.connect() as conn:
            row = conn.execute(
                text("SELECT user_id FROM session WHERE session_value = :sid AND valid_upto > now()"),
                {"sid": session_id},
            ).first()
    except OperationalError:
        raise HTTPException(503, "Database is unavailable. Please try again later.")
    if not row:
        raise HTTPException(401, "Session expired. Please login again.")
    return row[0]

def get_tenant_db(session_id: str | None = Cookie(default=None)):
    """Dependency for ERP routers: (tenant_engine, user_id)."""
    user_id = get_current_user_id(session_id)
    return get_tenant_engine(user_id), user_id
