import smtplib
from email.mime.text import MIMEText
from app.core.config import settings


def send_notification_email(to_email: str, subject: str, body_text: str) -> bool:
    """Sends a notification email using SMTP parameters from settings.
    
    Falls back to console stdout logging if SMTP server is unavailable.
    """
    # 1. Print visual log to stdout console
    print("\n" + "=" * 60)
    print("EMAIL NOTIFICATION DISPATCHED")
    print(f"FROM:    {settings.SMTP_FROM}")
    print(f"TO:      {to_email}")
    print(f"SUBJECT: {subject}")
    print("-" * 60)
    print(body_text)
    print("=" * 60 + "\n", flush=True)

    # 2. Try sending the email via configured SMTP
    try:
        msg = MIMEText(body_text)
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email

        # Connect to SMTP server
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        
        # Start TLS if enabled
        if settings.SMTP_TLS:
            server.starttls()
            
        # Log in if credentials are provided
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            
        server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
        server.quit()
        print(f"Successfully sent email to {to_email} via SMTP ({settings.SMTP_HOST}:{settings.SMTP_PORT})", flush=True)
        return True
    except Exception as e:
        print(f"SMTP dispatch warning: Unable to send email via SMTP ({str(e)}). Logging to console above.", flush=True)
        return False
