from bson import ObjectId
from ..mongo_client import products
from ..models.products_model import create_product_model

# cerca un prodotto per ID
def get_product_by_id(product_id):
    if isinstance(product_id, str):
        product_id = ObjectId(product_id)
    return products.find_one({"_id": product_id})

# cerca un prodotto per blockchain ID
def get_product_by_blockchain_id(blockchain_id):
    return products.find_one({"blockchainProductId": blockchain_id})

# aggiungi il prodotto appena creato nella Blockchain
def create_product(blockchain_product_id, created_by):
    product_data = create_product_model(blockchain_product_id, created_by)
    if products.find_one({"blockchainProductId": product_data["blockchainProductId"]}):
        raise ValueError("Product with this id already exists")
    result = products.insert_one(product_data)
    return result.inserted_id

def update_product_by_blockchain_id(blockchain_id, update_data):
    result = products.update_one(
        {"blockchainProductId": blockchain_id},
        {"$set": update_data}
    )
    # ritorna True se il prodotto è stato aggiornato, altrimenti False
    return result.modified_count > 0