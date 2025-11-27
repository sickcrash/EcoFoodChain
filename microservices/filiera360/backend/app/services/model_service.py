from ..utils.blockchain_utils import verify_manufacturer
from ..utils.permissions_utils import required_permissions
from ..database_mongo.queries.models_queries import upsert_model_for_product, get_model_by_blockchain_id
from ..database_mongo.queries.users_queries import get_user_by_email

def upload_model_service(user_email, product_data):
    """
    Carica un modello 3D associato a un prodotto.
    """

    # --- Recupero utente e permessi ---
    user = get_user_by_email(user_email)
    if not required_permissions(user, ['producer']):
        return {"message": "Unauthorized: Insufficient permissions."}, 403

    real_manufacturer = user["manufacturer"]
    if not real_manufacturer:
        return {"message": "User manufacturer not found."}, 400

    product_id = product_data.get("ID")
    if not product_id:
        return {"message": "Product ID is required."}, 400

    glb_file = product_data.get('ModelBase64')
    if not glb_file:
        return {"message": "Missing GLB file"}, 400

    # --- Verifica manufacturer con blockchain ---
    verification_result = verify_manufacturer(product_id, real_manufacturer)
    if verification_result:
        return verification_result  # restituisce eventuale errore della verifica

    # --- Upload modello ---
    try:
        print(f"Uploading 3D model for product {product_id} by manufacturer {real_manufacturer}...")
        upsert_model_for_product(product_id, glb_file, user["_id"])
        return {"message": "Model uploaded successfully"}, 201

    except Exception as e:
        print(f"[upload_model_service] Error: {e}")
        return {"message": f"An error occurred: {str(e)}"}, 500


def get_model_service(product_id):
    """Recupera il modello associato a un prodotto tramite ID blockchain."""
    if not product_id:
        return {"message": "Product ID is required."}, 400

    try:
        model = get_model_by_blockchain_id(product_id)
        if not model:
            return {"message": "No model found for the provided product ID."}, 404

        return {"ModelBase64": model["modelString"]}, 200

    except Exception as e:
        print(f"ERRORE nel service get_model_service: {e}")
        return {"message": f"An error occurred: {str(e)}"}, 500
