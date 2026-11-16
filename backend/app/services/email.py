# app/email.py
import os
import logging

logger = logging.getLogger(__name__)

def send_otp_email(to_email: str, username: str, otp: str) -> bool:
    """Send OTP via Resend. Returns True if sent, False if not (fallback to terminal print)."""
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return False
    if not to_email:
        logger.warning(f"No email for user {username}, skipping email")
        return False

    try:
        import resend
        resend.api_key = api_key

        resend.Emails.send({
            "from": "Billing App <onboarding@resend.dev>",
            "to": [to_email],
            "subject": f"Your password reset code: {otp}",
            "html": f"""
                <h2>Password Reset Code</h2>
                <p>Hi <b>{username}</b>,</p>
                <p>Your verification code is:</p>
                <h1 style="letter-spacing: 4px;">{otp}</h1>
                <p>This code is valid for <b>10 minutes</b> and can be used only once.</p>
                <p>If you did not request this, please ignore this email.</p>
            """,
        })
        logger.info(f"OTP email sent to {to_email} for {username}")
        return True
    except Exception as e:
        logger.error(f"OTP email failed for {username}: {e}", exc_info=True)
        return False