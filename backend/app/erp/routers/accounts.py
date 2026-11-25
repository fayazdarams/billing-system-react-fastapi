# app/routers/accounts.py
# Accounts live in the TENANT DB (Demo / store DB), not billing_auth.
# Same style as auth.py: Pydantic in -> raw SQL -> engine.begin() -> HTTPException.
#
# Deletion rule (decided 2026-11-22):
#   DELETE is a REAL delete: DELETE FROM accounts WHERE id = ...
#   BUT every insert / update / delete also writes one row to mutations:
#     (entity='accounts', entity_key=<account id>, action='insert'|'update'|'delete')
#   The mutations table is the audit + the delta-feed for the frontend cache.
#   No is_deleted column, no soft-delete filter anywhere.
import re
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.services.tenant import get_tenant_db
from app.db_errors import handle_db_error

router = APIRouter(prefix="/accounts", tags=["accounts"])

# ---- Verhoeff (Aadhaar checksum) - same tables as frontend validation.ts ----
_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

def _is_valid_aadhar(v: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(v)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(ch)]]
    return c == 0

def _write_mutation(conn, entity_key: int, action: str, storenumber: int):
    """Every insert / update / delete writes one mutation row, same transaction."""
    conn.execute(
        text("INSERT INTO mutations (entity, entity_key, action, storenumber) VALUES ('accounts', :k, :a, :sn)"),
        {"k": entity_key, "a": action, "sn": storenumber},
    )

# ---- Schemas - mirrors frontend validation.ts + AccountForm ----
class AccountIn(BaseModel):
    name: str
    address: str
    mobile: str
    whatsapp: str
    email: str | None = None
    aadhar: str | None = None
    gstin: str | None = None
    pan: str | None = None
    openingBalance: Decimal = Decimal("0")
    openingBalanceType: str = "Dr"
    storenumber: int = 1

    @field_validator("name", "address", mode="before")
    @classmethod
    def _trim(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("name")
    @classmethod
    def _name(cls, v: str):
        if not v:
            raise ValueError("Please enter Name")
        return v

    @field_validator("address")
    @classmethod
    def _address(cls, v: str):
        if not v:
            raise ValueError("Please enter Address")
        return v

    @field_validator("mobile", "whatsapp")
    @classmethod
    def _phone(cls, v: str):
        if not re.fullmatch(r"[0-9]{10}", v or ""):
            raise ValueError("Must be 10 digits")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None):
        if not v:
            return None
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v):
            raise ValueError("Please enter a valid Email")
        return v

    @field_validator("aadhar")
    @classmethod
    def _aadhar(cls, v: str | None):
        if not v:
            return None
        if not re.fullmatch(r"[0-9]{12}", v):
            raise ValueError("Aadhar must be 12 digits")
        if v[0] in ("0", "1"):
            raise ValueError("Aadhar cannot start with 0 or 1")
        if not _is_valid_aadhar(v):
            raise ValueError("Please enter a valid Aadhar (checksum failed)")
        return v

    @field_validator("gstin")
    @classmethod
    def _gst(cls, v: str | None):
        if not v:
            return None
        v = v.upper()
        if not re.fullmatch(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][Z][0-9]", v):
            raise ValueError("GSTIN must be 15 characters")
        return v

    @field_validator("pan")
    @classmethod
    def _pan(cls, v: str | None):
        if not v:
            return None
        v = v.upper()
        if not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", v):
            raise ValueError("PAN must be 10 characters")
        return v

    @field_validator("openingBalance")
    @classmethod
    def _opening(cls, v: Decimal):
        if v < 0:
            raise ValueError("Opening Balance cannot be negative")
        return v

    @field_validator("openingBalanceType")
    @classmethod
    def _type(cls, v: str):
        if v not in ("Dr", "Cr"):
            raise ValueError("Type must be Cr or Dr")
        return v

def _row_to_dict(r) -> dict:
    return {
        "id": r[0], "storenumber": r[1], "name": r[2], "address": r[3],
        "mobile": r[4], "whatsapp": r[5], "email": r[6], "aadhar": r[7],
        "gstin": r[8], "pan": r[9], "openingBalance": str(r[10]),
        "openingBalanceType": r[11], "category": r[12],
        "createdAt": r[13].isoformat() if r[13] else None,
        "updatedAt": r[14].isoformat() if r[14] else None,
    }

_COLS = "id, storenumber, name, address, mobile, whatsapp, email, aadhar, gstin, pan, opening_balance, opening_balance_type, category, created_at, updated_at"

# ---- Create: INSERT account + INSERT mutation 'insert', same transaction ----
@router.post("", status_code=201)
def create_account(data: AccountIn, db=Depends(get_tenant_db)):
    eng, _ = db
    try:
        with eng.begin() as conn:
            row = conn.execute(
                text(f"""
                    INSERT INTO accounts
                    (storenumber, name, address, mobile, whatsapp, email, aadhar, gstin, pan,
                     opening_balance, opening_balance_type)
                    VALUES (:storenumber, :name, :address, :mobile, :whatsapp, :email, :aadhar, :gstin, :pan,
                            :opening_balance, :opening_balance_type)
                    RETURNING {_COLS}
                """),
                {
                    "storenumber": data.storenumber, "name": data.name, "address": data.address,
                    "mobile": data.mobile, "whatsapp": data.whatsapp, "email": data.email,
                    "aadhar": data.aadhar, "gstin": data.gstin, "pan": data.pan,
                    "opening_balance": data.openingBalance, "opening_balance_type": data.openingBalanceType,
                },
            ).first()
            _write_mutation(conn, row[0], "insert", data.storenumber)
            return _row_to_dict(row)
    except SQLAlchemyError as e:
        # engine.begin() already rolls back.
        # handle_db_error walks:
        # InterfaceError / DatabaseError
        # -> IntegrityError -> UniqueViolation + constraint_name (mobile / gstin / aadhar / pan / email)
        # -> IntegrityError -> ForeignKeyViolation / NotNullViolation / CheckViolation
        # -> OperationalError -> InvalidPassword (28P01) -> 500 config error
        # -> OperationalError -> ConnectionException -> 503 unavailable
        # -> ProgrammingError -> UndefinedTable / UndefinedColumn -> 500 setup incomplete
        handle_db_error(e)

# ---- List: full list, NO soft-delete filter (deleted rows are really gone) ----
@router.get("")
@router.get("")
def list_accounts(storenumber: int = 1, db=Depends(get_tenant_db)):
    eng, _ = db
    try:
        with eng.connect() as conn:
            rows = conn.execute(
                text(f"SELECT {_COLS} FROM accounts WHERE storenumber = :sn ORDER BY id"),
                {"sn": storenumber},
            ).fetchall()

            last_id = conn.execute(
                text("SELECT COALESCE(MAX(id), 0) FROM mutations WHERE entity = 'accounts' AND storenumber = :sn"),
                {"sn": storenumber},
            ).scalar()

            return {"accounts": [_row_to_dict(r) for r in rows], "lastMutationId": last_id}
    except SQLAlchemyError as e:
        handle_db_error(e)

# ---- Mutations: delta-feed for the frontend cache. MUST be above /{account_id} ----
# GET /accounts/mutations?since_id=<cursor> -> all mutations with id > cursor, in order.
# Cursor = last mutation id your cache has already applied (see below).
@router.get("/mutations")
def list_mutations(since_id: int = 0, storenumber: int = 1, db=Depends(get_tenant_db)):
    eng, _ = db
    try:
        with eng.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT id, entity, entity_key, action, storenumber, created_at
                    FROM mutations
                    WHERE entity = 'accounts' AND storenumber = :sn AND id > :since
                    ORDER BY id
                """),
                {"sn": storenumber, "since": since_id},
            ).fetchall()
            return [
                {"id": r[0], "entity": r[1], "entityKey": r[2], "action": r[3],
                 "storenumber": r[4], "createdAt": r[5].isoformat() if r[5] else None}
                for r in rows
            ]
    except SQLAlchemyError as e:
        handle_db_error(e)

# ---- Get one ----
@router.get("/{account_id}")
def get_account(account_id: int, storenumber: int = 1, db=Depends(get_tenant_db)):
    eng, _ = db
    try:
        with eng.connect() as conn:
            row = conn.execute(
                text(f"SELECT {_COLS} FROM accounts WHERE id = :id AND storenumber = :sn"),
                {"id": account_id, "sn": storenumber},
            ).first()
    except SQLAlchemyError as e:
        handle_db_error(e)
    if not row:
        raise HTTPException(404, "Account not found")
    return _row_to_dict(row)

# ---- Update: UPDATE account + INSERT mutation 'update', same transaction ----
@router.put("/{account_id}")
def update_account(account_id: int, data: AccountIn, db=Depends(get_tenant_db)):
    eng, _ = db
    try:
        with eng.begin() as conn:
            row = conn.execute(
                text(f"""
                    UPDATE accounts SET
                      name=:name, address=:address, mobile=:mobile, whatsapp=:whatsapp,
                      email=:email, aadhar=:aadhar, gstin=:gstin, pan=:pan,
                      opening_balance=:opening_balance, opening_balance_type=:opening_balance_type,
                      updated_at=now()
                    WHERE id=:id AND storenumber=:storenumber
                    RETURNING {_COLS}
                """),
                {
                    "id": account_id, "storenumber": data.storenumber, "name": data.name,
                    "address": data.address, "mobile": data.mobile, "whatsapp": data.whatsapp,
                    "email": data.email, "aadhar": data.aadhar, "gstin": data.gstin, "pan": data.pan,
                    "opening_balance": data.openingBalance, "opening_balance_type": data.openingBalanceType,
                },
            ).first()
            if not row:
                raise HTTPException(404, "Account not found")
            _write_mutation(conn, account_id, "update", data.storenumber)
            return _row_to_dict(row)
    except SQLAlchemyError as e:
        handle_db_error(e)

# ---- Delete: REAL delete + INSERT mutation 'delete', same transaction ----
@router.delete("/{account_id}")
def delete_account(account_id: int, storenumber: int = 1, db=Depends(get_tenant_db)):
    eng, _ = db
    try:
        with eng.begin() as conn:
            deleted = conn.execute(
                text("DELETE FROM accounts WHERE id=:id AND storenumber=:sn"),
                {"id": account_id, "sn": storenumber},
            )
            if deleted.rowcount == 0:
                raise HTTPException(404, "Account not found")
            _write_mutation(conn, account_id, "delete", storenumber)
    except SQLAlchemyError as e:
        # If this account is used in bills / vouchers, Postgres raises
        # IntegrityError -> ForeignKeyViolation (23503) here.
        # handle_db_error converts it to 400, not generic 500.
        handle_db_error(e)
    return {"message": "Account deleted"}
