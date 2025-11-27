from bson import ObjectId
from datetime import datetime, timezone

def create_liked_product_model(user_id, blockchain_product_id):
    return {
        "userId": ObjectId(user_id),
        "blockchainProductId": blockchain_product_id,
        "likedAt": datetime.now(timezone.utc)
    }