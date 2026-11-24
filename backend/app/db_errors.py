# app/db_errors.py
# Design: Level 1 -> Level 2 -> Level 3
# SQLAlchemy + psycopg 3.3.8
# If grandchild not matched -> child generic
# If child not matched -> DatabaseError generic

from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
import psycopg.errors as pg_errors

def handle_db_error(e: SQLAlchemyError):
    orig = getattr(e, "orig", None) or e

    diag = getattr(orig, "diag", None)
    constraint = getattr(diag, "constraint_name", None) if diag else None
    column = getattr(diag, "column_name", None) if diag else None
    table = getattr(diag, "table_name", None) if diag else None
    detail = getattr(diag, "message_detail", None) if diag else str(orig)

    print(orig)
    
    # LEVEL 1
    if isinstance(orig, pg_errors.InterfaceError):
         handle_interface_error(orig, constraint, column, table, detail)

    if isinstance(orig, pg_errors.DatabaseError):
         handle_database_error(orig, constraint, column, table, detail)

    
    raise HTTPException(500, f"Database error")

# ============================================================
# LEVEL 2: InterfaceError - NOW FULLY CAPTURED
# ============================================================

def handle_interface_error(orig, constraint, column, table, detail):
    # InterfaceError = problem in driver / connection / cursor
    # Not a Postgres SQL error. SQL may not have even been sent.

    message = str(orig).lower()

    # --- Grandchild 1: Connection is closed / does not exist ---
    # In psycopg this surfaces as InterfaceError with messages like:
    # "connection is closed", "connection does not exist"
    if "connection is closed" in message or "connection does not exist" in message:
        raise HTTPException(503,"Database connection is closed. Pool / session was closed too early.")

    # --- Grandchild 2: Cursor is closed ---
    # e.g. you closed the session, then tried to use its cursor
    if "cursor is closed" in message or "cursor already closed" in message:
        raise HTTPException(500,"Cursor is closed. Session was closed before query finished.")

    # --- Grandchild 3: Connection already in use / wrong state ---
    # e.g. trying to use same connection from two threads,
    # or using a connection after rollback failed
    if "already" in message and "transaction" in message:
        raise HTTPException(500,"Connection is in wrong transaction state. Missing rollback or commit.")

    # --- Grandchild 4: Result / object not in correct state ---
    # e.g. fetchone() after query already consumed,
    # or using a result after connection closed
    if "result" in message and ("closed" in message or "no result" in message):
        raise HTTPException(500,"Result object is closed or already consumed.")

    # --- Grandchild 5: Encoding / type adaptation error ---
    # e.g. Python object cannot be adapted to Postgres type
    # psycopg raises InterfaceError / DataError for unadaptable types
    if "can't adapt" in message or "cannot adapt" in message or "adapt" in message:
        raise HTTPException(400,f"Cannot adapt Python value to Postgres type.")

    # --- Grandchild 6: Driver / connection setup error ---
    # e.g. bad DSN, missing driver, connection string error
    if "could not" in message and ("connect" in message or "translate" in message or "parse" in message):
        raise HTTPException(503,f"Could not establish database connection.")

    # --- Generic InterfaceError fallback ---
    # Any InterfaceError you have not listed above lands here,
    # still inside InterfaceError, not mixed with DatabaseError
    raise HTTPException(500, f"Database interface error")



def handle_database_error(orig, constraint, column, table, detail):
    
    if isinstance(orig, pg_errors.DataError):
         handle_data_error(orig, constraint, column, table, detail)

    if isinstance(orig, pg_errors.OperationalError):
         handle_operational_error(orig, constraint, column, table, detail)

    if isinstance(orig, pg_errors.IntegrityError):
         handle_integrity_error(orig, constraint, column, table, detail)

    if isinstance(orig, pg_errors.InternalError):
         handle_internal_error(orig, constraint, column, table, detail)

    if isinstance(orig, pg_errors.ProgrammingError):
         handle_programming_error(orig, constraint, column, table, detail)

    if isinstance(orig, pg_errors.NotSupportedError):
         handle_not_supported_error(orig, constraint, column, table, detail)

    # LEVEL 2 fallback: generic DatabaseError
    raise HTTPException(500, f"Database error.")

# ============================================================
# LEVEL 3: DataError
# ============================================================

def handle_data_error(orig, constraint, column, table, detail):
    if isinstance(orig, pg_errors.StringDataRightTruncation):
        raise HTTPException(400, f"Value too long for field.")

    if isinstance(orig, pg_errors.NumericValueOutOfRange):
        raise HTTPException(400, f"Number out of range for field.")

    if isinstance(orig, pg_errors.InvalidTextRepresentation):
        raise HTTPException(400, f"Invalid value format for field.")

    raise HTTPException(400, f"Invalid data.")

# ============================================================
# LEVEL 3: OperationalError
# ============================================================

def handle_operational_error(orig, constraint, column, table, detail):
    
    if isinstance(orig, pg_errors.DeadlockDetected):
        raise HTTPException(503, "Deadlock detected, please retry.")

    if isinstance(orig, pg_errors.SerializationFailure):
        raise HTTPException(503, "Concurrent update conflict, please retry.")

    if isinstance(orig, pg_errors.ConnectionException):
        raise HTTPException(503, "Database connection lost.")

    raise HTTPException(503, f"Database is unavailable.")

# ============================================================
# LEVEL 3: IntegrityError
# ============================================================

def handle_integrity_error(orig, constraint, column, table, detail):
    if isinstance(orig, pg_errors.UniqueViolation):
        #if constraint == "accounts_mobile_key":
        #    raise HTTPException(409, "Mobile number already exists.")
        #if constraint == "accounts_gstin_key":
        #    raise HTTPException(409, "GSTIN already exists.")
        #if constraint == "auth_username_key":
        #    raise HTTPException(409, "Username already exists.")
        raise HTTPException(409, f"Record already exists.")

    if isinstance(orig, pg_errors.ForeignKeyViolation):
        raise HTTPException(400, f"Related record does not exist.")

    if isinstance(orig, pg_errors.NotNullViolation):
        raise HTTPException(400, f"Required field missing.")

    if isinstance(orig, pg_errors.CheckViolation):
        raise HTTPException(400, f"Value failed.")

    if isinstance(orig, pg_errors.ExclusionViolation):
        raise HTTPException(400, f"Exclusion constraint failed.")

    # Generic IntegrityError fallback
    raise HTTPException(400, f"Integrity error.")


# ============================================================
# LEVEL 3: InternalError - NOW FULLY CAPTURED
# ============================================================
def handle_internal_error(orig, constraint, column, table, detail):
    # InternalError means Postgres itself says the transaction is broken.
    # In practice, 99% of the time this is:
    # "current transaction is aborted, commands ignored until end of transaction block"
    # That happens when a previous statement in the same transaction failed
    # and you tried another query without db.rollback()

    # There is no common grandchild for InternalError in psycopg,
    # so we capture it by its message pattern, but still inside its own branch.

    message = str(orig).lower()

    if "current transaction is aborted" in message:
        raise HTTPException(500,"Transaction was aborted by an earlier error.")

    if "out of memory" in message:
        raise HTTPException(503, "Database out of memory.")

    # Generic InternalError fallback
    # This keeps InternalError separate from ProgrammingError / OperationalError
    raise HTTPException(500, f"Internal database error.")

# ============================================================
# LEVEL 3: ProgrammingError - NOW FULLY CAPTURED
# ============================================================

def handle_programming_error(orig, constraint, column, table, detail):
    
    if isinstance(orig, pg_errors.UndefinedTable):
        raise HTTPException(500, f"Table does not exist.")

    if isinstance(orig, pg_errors.UndefinedColumn):
        raise HTTPException(500, f"Column does not exist.")

    if isinstance(orig, pg_errors.UndefinedFunction):
        raise HTTPException(500, f"Function does not exist.")

    if isinstance(orig, pg_errors.UndefinedObject):
        raise HTTPException(500, f"Database object does not exist.")

    if isinstance(orig, pg_errors.SyntaxError):
        raise HTTPException(500, f"SQL syntax error.")

    if isinstance(orig, pg_errors.DuplicateTable):
        raise HTTPException(500, f"Table already exists.")

    if isinstance(orig, pg_errors.DuplicateColumn):
        raise HTTPException(500, f"Column already exists.")

    if isinstance(orig, pg_errors.AmbiguousColumn):
        raise HTTPException(500, f"Ambiguous column.")

    if isinstance(orig, pg_errors.WrongObjectType):
        raise HTTPException(500, f"Wrong object type.")

    # Generic ProgrammingError fallback
    # This is a developer bug, not user input
    raise HTTPException(500, f"Programming error.")

# ============================================================
# LEVEL 3: NotSupportedError - NOW FULLY CAPTURED
# ============================================================

def handle_not_supported_error(orig, constraint, column, table, detail):
    if isinstance(orig, pg_errors.FeatureNotSupported):
        raise HTTPException(500, f"Feature not supported by this Postgres version.")

    # In psycopg 3.3.8, FeatureNotSupported is the main grandchild.
    # Any other NotSupportedError falls through here.

    # Generic NotSupportedError fallback
    raise HTTPException(500, f"Operation not supported.")


