from bson import ObjectId
from datetime import datetime, timezone

def create_token_model(token, invited_by):
    return {
        "token": token,
        "used": False,
        "createdAt": datetime.now(timezone.utc),
        "invitedBy": ObjectId(invited_by),
        # Email di chi ha usato il token, inizialmente None
        "usedBy": None
    }