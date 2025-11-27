from bson import ObjectId
from datetime import datetime

def create_recently_searched_model(user_id, products=None):
    return {
        "userId": ObjectId(user_id),
        "products": products if products is not None else []
    }

def create_product_entry(blockchain_product_id, searched_at=None):
    return {
        "blockchainProductId": blockchain_product_id,
        "searchedAt": searched_at if searched_at else datetime.utcnow()
    }