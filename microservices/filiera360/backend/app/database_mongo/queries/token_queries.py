from bson import ObjectId
from ..mongo_client import invite_tokens
from ..models.token_model import create_token_model

def get_token(token):
    return invite_tokens.find_one({"token": token})

def create_token(token, invited_by):
    token_data = create_token_model(token, invited_by)
    result = invite_tokens.insert_one(token_data)
    return result.inserted_id

def mark_token_as_used(token, used_by_email):
    result = invite_tokens.update_one(
        {"token": token},
        {"$set": {"used": True, "usedBy": used_by_email}}
    )
    return result.modified_count > 0

def mark_token_as_not_used(token, used_by_email):
    result = invite_tokens.update_one(
        {"token": token},
        {"$set": {"used": False, "usedBy": used_by_email}}
    )
    return result.modified_count > 0

def get_tokens_by_inviter(invited_by):
    return list(invite_tokens.find({"invitedBy": ObjectId(invited_by)}))

def get_tokens_used_by(email):
    return list(invite_tokens.find({"usedBy": email}))