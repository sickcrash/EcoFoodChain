import requests

from ..utils.http_client import http_get, http_post
from ..utils.permissions_utils import required_permissions
from ..database_mongo.queries.users_queries import get_user_by_email, find_producer_by_operator
import os
MIDDLEWARE_BASE_URL = os.environ.get('MIDDLEWARE_URL', 'http://filiera-middleware:3000')

def get_batch_service(batch_id):
    if not batch_id:
        return {'message': 'Batch ID is required'}, 400

    try:
        response = http_get(f'{MIDDLEWARE_BASE_URL}/readBatch?batchId={batch_id}')
        if response.status_code == 200:
            return response.json(), 200
        else:
            return {'message': 'Failed to get batch.'}, 500
    except Exception as e:
        print("Failed to get batch:", e)
        return {'message': 'Failed to get batch.'}, 500

def get_batch_history_service(batch_id):
    if not batch_id:
        return {'message': 'Batch ID is required'}, 400

    try:
        response = http_get(f'{MIDDLEWARE_BASE_URL}/batchHistory?batchId={batch_id}')
        if response.status_code == 200:
            return response.json(), 200
        else:
            return {'message': 'Failed to get batch history'}, 500
    except Exception as e:
        print("Failed to get batch history:", e)
        return {'message': 'Failed to get batch history.'}, 500


def _process_batch(user_email, batch_data, endpoint, success_message="Batch processed successfully!"):
    """
    Funzione generica per upload o update batch.
    endpoint: URL del middleware
    success_message: messaggio in caso di successo
    """
    user = get_user_by_email(user_email)

    # Controllo permessi
    if not required_permissions(user, ['producer', 'operator']):
        return {"message": "Unauthorized: Insufficient permissions."}, 403

    # Controllo dati batch
    if not batch_data or "ProductId" not in batch_data:
        return {"message": "No batch data or ProductId provided."}, 400

    product_id = batch_data["ProductId"]

    # Controllo autorizzazione al prodotto
    authorized, error_response = verify_product_authorization(user, product_id)
    if not authorized:
        return error_response

    # Controllo operatore reale
    real_operator = user.get("manufacturer")
    client_operator = batch_data.get("Operator")
    if real_operator != client_operator:
        return {"message": "Unauthorized: Operator mismatch."}, 403

    # Assicura che CustomObject esista
    batch_data["CustomObject"] = batch_data.get("CustomObject", {})

    # Chiamata al middleware
    try:
        response = http_post(endpoint, json=batch_data)
        resp_json = response.json()

        message = resp_json.get(
            'message',
            success_message if response.status_code == 200 else 'Operation failed.')
        return {"message": message}, response.status_code
    except requests.RequestException as e:
        print(f"Error calling middleware ({endpoint}): {e}")
        return {"message": "Internal Server Error", "error": str(e)}, 500

def upload_batch_service(user_email, batch_data):
    return _process_batch(
        user_email,
        batch_data,
        endpoint='{MIDDLEWARE_BASE_URL}/uploadBatch',
        success_message='Batch uploaded successfully!'
    )

def update_batch_service(user_email, batch_data):
    return _process_batch(
        user_email,
        batch_data,
        endpoint='{MIDDLEWARE_BASE_URL}/api/batch/updateBatch',
        success_message='Batch updated successfully!'
    )

def verify_product_authorization(user, product_id):
    """Verifica che l'utente abbia accesso al prodotto."""
    if not user or not product_id:
        return False, ({"message": "Invalid user or product."}, 400)

    # Se è un operator, trova il produttore associato
    if user.get("flags", [])[1]:  # flags[1] == operator
        user = find_producer_by_operator(user["email"])
        if not user:
            return False, ({"message": "Operator not associated with any producer."}, 403)

    # Chiamata al middleware
    try:
        response = http_get(f"{MIDDLEWARE_BASE_URL}/readProduct?productId={product_id}")
        if response.status_code != 200:
            return False, ({"message": "Failed to get product from middleware."}, 500)

        product = response.json()
        if product.get("Manufacturer") != user.get("manufacturer"):
            return False, ({"message": "Unauthorized: You do not have access to this product."}, 403)

        return True, None

    except requests.RequestException as e:
        print("Failed to get product:", e)
        return False, ({"message": "Failed to get product from middleware."}, 500)