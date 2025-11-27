from bson import ObjectId

def create_product_model(blockchain_product_id, created_by):
    return {
        "blockchainProductId": blockchain_product_id,
        # Assicura che sia un ObjectId
        "createdBy": ObjectId(created_by)
    }