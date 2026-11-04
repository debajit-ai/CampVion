"""
CampVion Email Provider Integration Interface
Provides honest, verifiable password-reset delivery via SMTP when configured,
and a transparent development outbox mode when no SMTP server is provisioned.
Never falsely claims an external email was sent when no email service is configured.
"""

import logging
import smtplib
from email.message import EmailMessage
from typing import Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger("campvion.email")


class EmailDeliveryResult:
    def __init__(
        self,
        email_service_configured: bool,
        delivered_externally: bool,
        delivery_mode: str,
        reset_url: Optional[str] = None,
        diagnostic_note: Optional[str] = None,
    ) -> None:
        self.email_service_configured = email_service_configured
        self.delivered_externally = delivered_externally
        self.delivery_mode = delivery_mode
        self.reset_url = reset_url
        self.diagnostic_note = diagnostic_note

    def to_dict(self) -> Dict[str, Any]:
        return {
            "email_service_configured": self.email_service_configured,
            "delivered_externally": self.delivered_externally,
            "delivery_mode": self.delivery_mode,
        }


class EmailDeliveryService:
    """
    Modular email delivery adapter for password recovery and security notifications.
    """

    @staticmethod
    def is_configured() -> bool:
        return bool(settings.SMTP_HOST and settings.SMTP_HOST.strip())

    @classmethod
    def send_password_reset_email(
        cls,
        recipient_email: str,
        recipient_name: str,
        raw_reset_token: str,
        expires_minutes: int,
    ) -> EmailDeliveryResult:
        base_url = (settings.FRONTEND_BASE_URL or "http://localhost:3000").rstrip("/")
        reset_url = f"{base_url}/reset-password?token={raw_reset_token}"

        if not cls.is_configured():
            logger.info(
                "Password reset token generated in development outbox mode (SMTP_HOST not configured)."
            )
            return EmailDeliveryResult(
                email_service_configured=False,
                delivered_externally=False,
                delivery_mode="development_outbox",
                reset_url=reset_url,
                diagnostic_note=(
                    "No external SMTP provider is configured in backend/.env (SMTP_HOST is unset). "
                    "Token generated in local development outbox mode."
                ),
            )

        msg = EmailMessage()
        msg["Subject"] = "CampVion — Password Reset Request"
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = recipient_email
        msg.set_content(
            f"Hello {recipient_name},\n\n"
            f"A password reset was requested for your CampVion account.\n"
            f"Use the secure link below within {expires_minutes} minutes to reset your password:\n\n"
            f"{reset_url}\n\n"
            f"If you did not request this change, you can safely ignore this message.\n\n"
            f"— CampVion Security Operations"
        )

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                if settings.SMTP_PORT in (587, 2525):
                    server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
            return EmailDeliveryResult(
                email_service_configured=True,
                delivered_externally=True,
                delivery_mode="smtp",
                reset_url=reset_url,
            )
        except Exception as exc:
            logger.error(f"SMTP delivery failed: {exc}")
            return EmailDeliveryResult(
                email_service_configured=True,
                delivered_externally=False,
                delivery_mode="smtp_error",
                reset_url=reset_url,
                diagnostic_note="External SMTP delivery encountered a transport error.",
            )

