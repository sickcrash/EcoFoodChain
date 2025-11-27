from bson import ObjectId
from ..mongo_client import users
from ..models.users_model import create_user_model

# cerca un utente per ID o email
def get_user_by_id(user_id):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    return users.find_one({"_id": user_id})

def get_user_by_email(email):
    return users.find_one({"email": email})

def get_user_by_manufacturer(manufacturer):
    return users.find_one({"manufacturer": manufacturer})

# crea un nuovo utente e restituisce l'ID dell'utente creato
def create_user(email, password_hash, manufacturer, role):
    user_data = create_user_model(email, password_hash, manufacturer, role)
    result = users.insert_one(user_data)
    return result.inserted_id

# aggiorna un utente esistente e restituisce l'utente aggiornato
def update_user(user_id, update_data):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    result = users.update_one({"_id": user_id}, {"$set": update_data})
    if result.modified_count > 0:
        return get_user_by_id(user_id)
    return None

def find_producer_by_operator(operator_email):
    return users.find_one({
        "operators": {
            "$elemMatch": {"email": operator_email}
        }
    })

