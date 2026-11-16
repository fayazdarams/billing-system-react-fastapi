import os
import re
import secrets
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, IntegrityError
from app.database import engine
from app.services.security import hash_password, check_password
from app.services.email import send_otp_email

router = APIRouter()


class RegisterIn(BaseModel):
    username: str = Field(max_length=5)
    password: str = Field(max_length=8)
    confirmPassword: str = Field(max_length=8)
    storeName: str
    mobile: str = Field(max_length=10)
    whatsapp: str = Field(max_length=10)
    email: str | None = None

    @field_validator("username")
    @classmethod
    def username_must_be_5_lowercase(cls, v: str):
        if len(v) != 5 or not re.fullmatch(r"[a-z]{5}", v):
            raise ValueError("Username must be 5 lowercase letters (a-z)")
        return v


@router.post("/register")
def register(data: RegisterIn):
    if data.password != data.confirmPassword:
        raise HTTPException(400, "Passwords do not match")

    db_host = os.getenv("DEMO_DB_HOST")
    db_user = os.getenv("DEMO_DB_USER")
    db_pass = os.getenv("DEMO_DB_PASSWORD")
    db_name = "Demo"

    try:
        with engine.begin() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM auth WHERE username = :u"),
                {"u": data.username},
            ).first()
            if exists:
                raise HTTPException(400, "Username already exists")

            conn.execute(
                text("""
                    INSERT INTO auth
                    (username, password_hash, storename, mobile, whatsapp, email,
                     databaseuser, databasepassword, databasename, databasehost)
                    VALUES
                    (:username, :password_hash, :storename, :mobile, :whatsapp, :email,
                     :db_user, :db_pass, :db_name, :db_host)
                """),
                {
                    "username": data.username,
                    "password_hash": hash_password(data.password),
                    "storename": data.storeName,
                    "mobile": data.mobile,
                    "whatsapp": data.whatsapp,
                    "email": data.email,
                    "db_user": db_user,
                    "db_pass": db_pass,
                    "db_name": db_name,
                    "db_host": db_host,
                },
            )
    except IntegrityError:
        raise HTTPException(400, "Username already exists")
    except OperationalError as e:
        error_text = str(e).lower()
        if "password authentication failed" in error_text:
            print(f"DB CONFIG ERROR: {e}")
            raise HTTPException(
                status_code=500,
                detail="Database configuration error. Please contact admin."
            )
        print(f"DB UNAVAILABLE: {e}")
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable. Please try again later."
        )

    return {"message": "User created successfully"}


# ---------- Forgot Password ----------

class ForgotPasswordIn(BaseModel):
    username: str


class VerifyCodeIn(BaseModel):
    username: str
    code: str = Field(max_length=6)


class ResetPasswordIn(BaseModel):
    username: str
    code: str = Field(max_length=6)
    newPassword: str = Field(max_length=8)
    confirmPassword: str = Field(max_length=8)


def _get_user(conn, username: str):
    """Return (user_id, email) for forgot-password — needs email to send OTP."""
    row = conn.execute(
        text("SELECT id, email FROM auth WHERE username = :u"),
        {"u": username},
    ).first()
    if not row:
        return None, None
    return row[0], row[1]


def _get_valid_reset(conn, user_id: int, code: str):
    """Find latest unused, unexpired reset row and check code hash."""
    row = conn.execute(
        text("""
            SELECT id, code_hash FROM password_reset
            WHERE user_id = :uid AND used = false AND expires_at > now()
            ORDER BY created_at DESC LIMIT 1
        """),
        {"uid": user_id},
    ).first()
    if not row:
        return None
    reset_id, code_hash = row[0], row[1]
    if not check_password(code, code_hash):
        return None
    return reset_id


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordIn):
    # Generate random 6-digit OTP — backend only, never in frontend
    otp = f"{secrets.randbelow(900000) + 100000:06d}"  # 100000 - 999999

    user_email = None
    try:
        with engine.begin() as conn:
            user_id, user_email = _get_user(conn, data.username)
            if not user_id:
                raise HTTPException(400, "Username not found")

            # Invalidate any previous unused codes for this user
            conn.execute(
                text("UPDATE password_reset SET used = true WHERE user_id = :uid AND used = false"),
                {"uid": user_id},
            )

            # Store only hash, never plain OTP
            conn.execute(
                text("""
                    INSERT INTO password_reset (user_id, code_hash, expires_at, used)
                    VALUES (:uid, :code_hash, now() + interval '10 minutes', false)
                """),
                {"uid": user_id, "code_hash": hash_password(otp)},
            )
    except OperationalError as e:
        error_text = str(e).lower()
        if "password authentication failed" in error_text:
            print(f"DB CONFIG ERROR: {e}")
            raise HTTPException(500, "Database configuration error. Please contact admin.")
        print(f"DB UNAVAILABLE: {e}")
        raise HTTPException(503, "Database is unavailable. Please try again later.")

    # Send OTP via email (Resend). If no API key / no email / send fails,
    # fall back to terminal print so local testing still works.
    sent = send_otp_email(user_email, data.username, otp)
    if not sent:
        print(f"FORGOT-PASSWORD OTP for {data.username}: {otp} (valid 10 min)")

    return {"message": "OTP sent to your registered email"}


@router.post("/verify-code")
def verify_code(data: VerifyCodeIn):
    try:
        with engine.begin() as conn:
            user_id, _ = _get_user(conn, data.username)  # ignore email here
            if not user_id:
                raise HTTPException(400, "Invalid or expired code")
            reset_id = _get_valid_reset(conn, user_id, data.code)
            if not reset_id:
                raise HTTPException(400, "Invalid or expired code")
    except OperationalError as e:
        error_text = str(e).lower()
        if "password authentication failed" in error_text:
            print(f"DB CONFIG ERROR: {e}")
            raise HTTPException(500, "Database configuration error. Please contact admin.")
        print(f"DB UNAVAILABLE: {e}")
        raise HTTPException(503, "Database is unavailable. Please try again later.")

    # Do NOT mark used=true here — only after password is actually changed in reset-password
    return {"message": "Code verified"}


@router.post("/reset-password")
def reset_password(data: ResetPasswordIn):
    if data.newPassword != data.confirmPassword:
        raise HTTPException(400, "Passwords do not match")

    try:
        with engine.begin() as conn:
            user_id, _ = _get_user(conn, data.username)  # ignore email here
            if not user_id:
                raise HTTPException(400, "Invalid or expired code")

            reset_id = _get_valid_reset(conn, user_id, data.code)
            if not reset_id:
                raise HTTPException(400, "Invalid or expired code")

            # Update password
            conn.execute(
                text("UPDATE auth SET password_hash = :ph WHERE id = :uid"),
                {"ph": hash_password(data.newPassword), "uid": user_id},
            )
            # Mark code as used — one-time use
            conn.execute(
                text("UPDATE password_reset SET used = true WHERE id = :rid"),
                {"rid": reset_id},
            )
            # Option B — kill all sessions, force re-login (same as Change Password)
            conn.execute(
                text("DELETE FROM session WHERE user_id = :uid"),
                {"uid": user_id},
            )
    except OperationalError as e:
        error_text = str(e).lower()
        if "password authentication failed" in error_text:
            print(f"DB CONFIG ERROR: {e}")
            raise HTTPException(500, "Database configuration error. Please contact admin.")
        print(f"DB UNAVAILABLE: {e}")
        raise HTTPException(503, "Database is unavailable. Please try again later.")

    return {"message": "Password reset successfully"}
