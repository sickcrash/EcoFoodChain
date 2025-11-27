from bson import ObjectId
from datetime import datetime, timedelta, timezone

def create_otp_model(user_id, otp, expires_in_seconds=300):
    now = datetime.now(timezone.utc)
    return {
        "user_id": ObjectId(user_id),
        "otp": otp,
        "createdAt": now,
        "expiresAt": now + timedelta(seconds=expires_in_seconds)
    }