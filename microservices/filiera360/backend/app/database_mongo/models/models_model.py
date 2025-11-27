from bson import ObjectId
from datetime import datetime, timezone

def create_model_model(blockchain_product_id, model_string, uploaded_by):
    return {
        "blockchainProductId": blockchain_product_id,
        "modelString": model_string,
        "uploadedBy": ObjectId(uploaded_by),
        "uploadedAt": datetime.now(timezone.utc)
    }