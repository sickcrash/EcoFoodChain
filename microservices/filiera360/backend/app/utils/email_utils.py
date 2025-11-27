from flask_mail import Message
from flask import current_app

def send_async_email(app, msg):
    with app.app_context():  # serve per avere il contesto Flask nel thread
        mail = current_app.extensions.get('mail')
        mail.send(msg)

def send_email(subject: str, recipients: list, body: str, executor, sender: str = None) -> bool:
    """
    Invia una mail in background usando il pool di thread.
    """
    try:
        sender = sender or current_app.config.get("MAIL_DEFAULT_SENDER", "noreply@example.com")
        msg = Message(subject=subject, sender=sender, recipients=recipients, body=body)

        # Submit al pool passato come parametro
        executor.submit(send_async_email, current_app._get_current_object(), msg)
        return True # ← Ritorna SUBITO, senza aspettare
    except Exception as e:
        current_app.logger.error(f"Error sending email: {e}")
        return False

# Funzioni specifiche possono ora chiamare il helper
def send_otp_email(email: str, otp: str, executor) -> bool:
    return send_email(
        subject="OTP Code",
        recipients=[email],
        body=f"This is your OTP code: {otp}",
        executor=executor
    )

def send_reset_email(email: str, reset_url: str, executor) -> bool:
    return send_email(
        subject="Password Reset Request",
        recipients=[email],
        body=f"To reset your password, visit the following link: {reset_url}",
        executor=executor
    )