from bson import ObjectId
from ..mongo_client import product_history
from ..models.history_model import create_history_model

def add_history_entry(blockchain_product_id, modified_by, changes):
    entry = create_history_model(blockchain_product_id, modified_by, changes)
    result = product_history.insert_one(entry)
    return result.inserted_id

def delete_history_entry(entry_id):
    if isinstance(entry_id, str):
        entry_id = ObjectId(entry_id)
    result = product_history.delete_one({"_id": entry_id})
    return result.deleted_count > 0

# recupera tutta la cronologia di un prodotto, ordinata per data.
def get_history_by_blockchain_id(blockchain_product_id):
    return list(product_history.find({"blockchainProductId": blockchain_product_id}).sort("timestamp", 1))

# recupera tutte le modifiche fatte da un certo utente
def get_history_by_user(user_id):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    return list(product_history.find({"modifiedBy": user_id}))

# recupera l'ultima modifica fatta a un prodotto
def get_last_history_entry(blockchain_product_id):
    return product_history.find_one(
        {"blockchainProductId": blockchain_product_id},
        sort=[("timestamp", -1)]
    )

