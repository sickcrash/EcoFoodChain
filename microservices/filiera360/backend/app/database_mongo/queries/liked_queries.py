from bson import ObjectId
from ..mongo_client import liked_products
from ..models.liked_model import create_liked_product_model

def like_a_product(user_id, blockchain_product_id):
    liked_data = create_liked_product_model(user_id, blockchain_product_id)
    result = liked_products.insert_one(liked_data)
    return result.inserted_id

def unlike_a_product(user_id, blockchain_product_id):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    result = liked_products.delete_one({"userId": user_id, "blockchainProductId": blockchain_product_id})
    return result.deleted_count > 0

# ricerca i prodotti con like di un utente e i gli utenti che hanno messo like a un prodotto
def get_liked_products_by_user(user_id):
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    return list(liked_products.find({"userId": user_id}))

# cerca gli utenti che hanno messo like a un prodotto specifico
def get_users_who_liked_product(blockchain_product_id):
    return [doc["userId"] for doc in liked_products.find({"blockchainProductId": blockchain_product_id})]