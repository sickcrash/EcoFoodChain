from bson import ObjectId
from ..mongo_client import recently_searched
from ..models.recently_searched_model import create_product_entry

def add_recently_searched(user_id, blockchain_product_id, searched_at=None):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    product = create_product_entry(blockchain_product_id, searched_at)
    # Rimuovi eventuale duplicato
    recently_searched.update_one(
        {"userId": user_id},
        {"$pull": {"products": {"blockchainProductId": blockchain_product_id}}},
        upsert=True
    )
    # Aggiungi in testa
    recently_searched.update_one(
        {"userId": user_id},
        {"$push": {"products": {"$each": [product], "$position": 0}}},
        upsert=True
    )
    # Tieni solo i 5 più recenti
    recently_searched.update_one(
        {"userId": user_id},
        {"$push": {"products": {"$each": [], "$slice": 5}}}
    )

def get_recently_searched(user_id):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    doc = recently_searched.find_one({"userId": user_id})
    return doc["products"] if doc and "products" in doc else []