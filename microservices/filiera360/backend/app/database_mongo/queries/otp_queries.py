from bson import ObjectId
from ..mongo_client import users_otp
from ..models.otp_model import create_otp_model

# cerca un OTP per ID utente
def get_otp_by_user_id(user_id):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    return users_otp.find_one({"user_id": user_id})

# crea un nuovo OTP e restituisce l'ID dell'OTP creato
def create_otp(user_id, otp, expires_in_seconds=300):
    otp_data = create_otp_model(user_id, otp, expires_in_seconds)
    result = users_otp.insert_one(otp_data)
    return result.inserted_id

# elimina un OTP per ID utente
def delete_otp_by_user_id(user_id):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    result = users_otp.delete_one({"user_id": user_id})
    return result.deleted_count > 0
