# app/services/tenant.py
# Tenant DB: one engine per store DB (not per user), cached.
import os
from urllib.parse import quote_plus
from fastapi import Cookie, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from app.database import engine as auth_engine
from app.db_errors import handle_db_error

_tenant_engines: dict[tuple, object] = {}

def get_tenant_engine(user_id: int):
    # --- Auth DB lookup ---
    try:
        with auth_engine.connect() as conn:
            row = conn.execute(
                text("SELECT databasehost, databaseuser, databasepassword, databasename FROM auth WHERE id = :uid"),
                {"uid": user_id},
            ).first()
    except SQLAlchemyError as e:
        # This is Auth DB error, not Tenant DB error
        # handle_db_error will walk:
        # InterfaceError / DatabaseError -> OperationalError / ProgrammingError / etc.
        # For this lookup, we want Auth-specific message, so we catch and re-label:
        # If it is OperationalError / InterfaceError, it is "Auth DB unavailable"
        # If it is ProgrammingError, it is "auth table problem"
        # handle_db_error already gives that distinction, we just call it
        handle_db_error(e)

    if not row:
        raise HTTPException(401, "User not found")

    host, db_user, db_pass, db_name = row
    key = (host, db_user, db_name)
    if key in _tenant_engines:
        return _tenant_engines[key]

    # URL-encode password, otherwise @ : / # in password breaks the URL
    safe_pass = quote_plus(db_pass or "")
    url = f"postgresql+psycopg://{db_user}:{safe_pass}@{host}/{db_name}"

    eng = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5, pool_timeout=5)
    _tenant_engines[key] = eng
    return eng

def get_current_user_id(session_id: str | None = Cookie(default=None)) -> int:
    if not session_id:
        raise HTTPException(401, "Not logged in")
    try:
        with auth_engine.connect() as conn:
            row = conn.execute(
                text("SELECT user_id FROM session WHERE session_value = :sid AND valid_upto > now()"),
                {"sid": session_id},
            ).first()
    except SQLAlchemyError as e:
        # Same: Auth DB error, not session expired
        # Don't convert all errors to 401. 503 / 500 must stay 503 / 500.
        handle_db_error(e)

    if not row:
        raise HTTPException(401, "Session expired. Please login again.")
    return row[0]

def get_tenant_db(session_id: str | None = Cookie(default=None)):
    user_id = get_current_user_id(session_id)
    return get_tenant_engine(user_id), user_id