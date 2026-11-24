import os
import re
import secrets
from fastapi import APIRouter, HTTPException, Response, Cookie
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.database import engine
from app.services.security import hash_password, check_password
from app.services.email import send_otp_email
from app.db_errors import handle_db_error

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
    db_name = os.getenv("DEMO_DB_NAME")

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
    except SQLAlchemyError as e:
        # engine.begin() already rolls back on exception.
        # handle_db_error walks:
        # InterfaceError / DatabaseError
        # -> IntegrityError -> UniqueViolation + constraint_name
        # -> OperationalError -> InvalidPassword (28P01) -> 500 config error
        # -> OperationalError -> ConnectionException -> 503 unavailable
        # HTTPException raised inside the try is NOT a SQLAlchemyError,
        # so it propagates untouched.
        handle_db_error(e)

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
    """Find latest unused, unexpired reset row (Handles Race condition also) and check code hash."""
    row = conn.execute(
        text("""
            SELECT id, code_hash FROM password_reset
            WHERE user_id = :uid AND status = 'pending' AND expires_at > now()
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
            # 1. Mark old pending OTPs that timed out as 'expired'
            conn.execute(
                text("""
                    UPDATE password_reset SET status = 'expired'
                    WHERE user_id = :uid AND status = 'pending' AND expires_at <= now()
                """),
                {"uid": user_id},
            )

            # 2. Mark remaining pending OTPs (still within 10 min) as 'discarded'
            conn.execute(
                text("""
                    UPDATE password_reset SET status = 'discarded'
                    WHERE user_id = :uid AND status = 'pending'
                """),
                {"uid": user_id},
            )

            # 3. Insert new OTP as 'pending'
            conn.execute(
                text("""
                    INSERT INTO password_reset (user_id, code_hash, expires_at, status)
                    VALUES (:uid, :code_hash, now() + interval '10 minutes', 'pending')
                """),
                {"uid": user_id, "code_hash": hash_password(otp)}
            )
    except SQLAlchemyError as e:
        handle_db_error(e)

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

            # Only latest stays pending, rest become discarded
            # Race condition Two valid OTPS of a user. _get_valid_reset gets latest one. Discard the other(s)
            conn.execute(
                text("""
                    UPDATE password_reset SET status = 'discarded'
                    WHERE user_id = :uid AND status = 'pending' AND id != :rid
                """),
                {"uid": user_id, "rid": reset_id},
            )
    except SQLAlchemyError as e:
        handle_db_error(e)

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
                text("UPDATE password_reset SET status = 'used' WHERE id = :rid"),
                {"rid": reset_id},
            )
            # Option B — kill all sessions, force re-login (same as Change Password)
            conn.execute(
                text("DELETE FROM session WHERE user_id = :uid"),
                {"uid": user_id},
            )
    except SQLAlchemyError as e:
        handle_db_error(e)

    return {"message": "Password reset successfully"}


# ---------- Login / Session ----------

class LoginIn(BaseModel):
    username: str
    password: str


def _get_login_user(conn, username: str):
    row = conn.execute(
        text("SELECT id, password_hash, validupto FROM auth WHERE username = :u"),
        {"u": username},
    ).first()
    if not row:
        return None, None, None
    return row[0], row[1], row[2]


@router.post("/login")
def login(data: LoginIn, response: Response):
    try:
        with engine.begin() as conn:
            user_id, password_hash, validupto = _get_login_user(conn, data.username)
            if not user_id:
                raise HTTPException(400, "Invalid username or password")
            if not check_password(data.password, password_hash):
                raise HTTPException(400, "Invalid username or password")

            # validupto is DATE — must be >= today, NULL = expired
            is_valid = conn.execute(
                text("SELECT :v IS NOT NULL AND :v >= CURRENT_DATE"),
                {"v": validupto},
            ).scalar()
            if not is_valid:
                raise HTTPException(400, "Your account has expired. Please contact admin.")

            session_value = secrets.token_urlsafe(32)
            conn.execute(
                text("""
                    INSERT INTO session (user_id, session_value, valid_upto)
                    VALUES (:uid, :sval, now() + interval '12 hours')
                """),
                {"uid": user_id, "sval": session_value},
            )
    except SQLAlchemyError as e:
        handle_db_error(e)

    response.set_cookie(
        key="session_id",
        value=session_value,
        max_age=12 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=False,  # False for localhost http, True in production https
        path="/",
    )
    return {"message": "Login successful"}


@router.get("/me")
def me(session_id: str | None = Cookie(default=None)):
    if not session_id:
        raise HTTPException(401, "Not logged in")
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text("""
                    SELECT a.username, a.storenumber, a.storename FROM session s
                    JOIN auth a ON a.id = s.user_id
                    WHERE s.session_value = :sid AND s.valid_upto > now()
                """),
                {"sid": session_id},
            ).first()
            if not row:
                raise HTTPException(401, "Session expired. Please login again.")
            return {"username": row[0], "storenumber": row[1], "storeName": row[2]}
    except SQLAlchemyError as e:
        handle_db_error(e)


@router.post("/logout")
def logout(response: Response, session_id: str | None = Cookie(default=None)):
    if session_id:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("DELETE FROM session WHERE session_value = :sid"),
                    {"sid": session_id},
                )
        except SQLAlchemyError:
            # Logout should succeed even if DB is down.
            # Swallow any DB error here, not just OperationalError.
            pass
    response.delete_cookie(key="session_id", path="/")
    return {"message": "Logged out"}
