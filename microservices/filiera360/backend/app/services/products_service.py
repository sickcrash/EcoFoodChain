import json
from flask import current_app
import requests

from ..utils.blockchain_utils import verify_manufacturer
from ..utils.http_client import http_post, http_get, add_cors_headers
from ..utils.permissions_utils import required_permissions
from ..utils.product_utils import get_product_changes
from ..database_mongo.queries.history_queries import get_last_history_entry, add_history_entry
from ..database_mongo.queries.liked_queries import get_liked_products_by_user, like_a_product, unlike_a_product
from ..database_mongo.queries.products_queries import create_product
from ..database_mongo.queries.recently_searched_queries import add_recently_searched
from ..database_mongo.queries.users_queries import get_user_by_email
import os
MIDDLEWARE_BASE_URL = os.environ.get('MIDDLEWARE_URL', 'http://filiera-middleware:3000')

def get_product_service(product_id):
    try:
        response = http_get(f'{MIDDLEWARE_BASE_URL}/readProduct?productId={product_id}')
        if response.status_code == 200:
            return response.json()
        return {"error": f"Failed to fetch product, status {response.status_code}"}
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def get_product_history_service(product_id):
    try:
        response = http_get(f'{MIDDLEWARE_BASE_URL}/productHistory?productId={product_id}')
        print(f"JS server responded with status {response.status_code}")

        if response.status_code == 200:
            return response.json()
        return {'error': f"Failed to get product history {response.status_code}"},

    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def upload_product_service(product_data, user_identity):
    """
    Gestisce l'upload di un prodotto su middleware/blockchain e salva il prodotto su MongoDB.
    """
    user = get_user_by_email(user_identity)

    # Controllo permessi
    if not required_permissions(user, ['producer']):
        return {"message": "Unauthorized: Insufficient permissions."}, 403

    # Verifica produttore autenticato
    real_manufacturer = user.get("manufacturer")
    client_manufacturer = product_data.get("Manufacturer")
    if real_manufacturer != client_manufacturer:
        return {"message": "Unauthorized: Manufacturer mismatch."}, 403

    # Valorizza i campi opzionali
    product_data.setdefault("SensorData", [])
    product_data.setdefault("CustomObject", {})

    # Invio al middleware esterno
    try:
        response = http_post('{MIDDLEWARE_BASE_URL}/uploadProduct', json=product_data)
    except Exception as e:
        return {"message": "Error connecting to middleware.", "error": str(e)}, 500

    # Gestione risposta middleware
    if response.status_code != 200:
        return {"message": response.json().get('message', 'Failed to upload product.')}, response.status_code

    # Salvataggio su MongoDB
    try:
        create_product(product_data["ID"], user["_id"])
    except Exception as e:
        print("Errore salvataggio MongoDB:", e)
        return {"message": "Product uploaded to middleware but failed to save locally."}, 500

    return {'message': response.json().get('message', 'Product uploaded successfully!')}, 200


def update_product_service(product_data, user_identity):
    """
    Aggiorna un prodotto sia su blockchain (middleware) che sul database locale,
    tracciando le modifiche nella history.
    """
    user = get_user_by_email(user_identity)
    if not required_permissions(user, ["producer"]):
        return {"message": "Unauthorized: Insufficient permissions."}, 403

    product_id = product_data.get("ID")
    if not product_id:
        return {"message": "Product ID is required."}, 400

    # --- Verifica Manufacturer ---
    real_manufacturer = user.get("manufacturer")
    if not real_manufacturer:
        return {"message": "User manufacturer not found."}, 400

    # Controllo con blockchain
    manufacturer_check = verify_manufacturer(product_id, real_manufacturer)
    if manufacturer_check:  # errore già pronto (es. jsonify con 403/404)
        return manufacturer_check

    # Controllo coerenza con i dati inviati
    client_manufacturer = product_data.get("Manufacturer")
    if client_manufacturer != real_manufacturer:
        return {"message": "Unauthorized: Manufacturer mismatch."}, 403

    try:
        # --- Chiamata al middleware esterno ---
        response = http_post(
            "{MIDDLEWARE_BASE_URL}/api/product/updateProduct",
            json=product_data
        )
    except requests.RequestException as e:
        print(f"[update_product_service] Middleware error: {e}")
        return {"message": "Middleware request failed.", "error": str(e)}, 502

    if response.status_code != 200:
        return {"message": "Failed to update product."}, response.status_code

        # --- Salvataggio modifiche su DB ---
    try:
        old_data = _extract_last_known_data(product_id)
        changes = get_product_changes(old_data, product_data)
        if changes:
            add_history_entry(product_id, user["_id"], changes)

    except Exception as e:
        print(f"[update_product_service] Error: {e}")
        return {"message": "Error updating product.", "error": str(e)}, 500

    return {"message": "Product updated successfully!"}, 200


def _extract_last_known_data(product_id):
    """
    Ricostruisce lo stato precedente del prodotto a partire dall'ultima history entry.
    Restituisce un dict con i valori attuali conosciuti.
    """
    last_history = get_last_history_entry(product_id)
    old_data = {}

    if not last_history or not last_history.get("changes"):
        return old_data

    for change in last_history["changes"]:
        field = change["field"]
        new_value = change["newValue"]

        if field.startswith("CustomObject."):
            _, subkey = field.split(".", 1)
            old_data.setdefault("CustomObject", {})[subkey] = new_value
        else:
            old_data[field] = new_value

    return old_data

# Funzione per aggiungere un prodotto ai liked products
def like_product_service(data, request):
    if request.method == 'OPTIONS':
        response = {'message': 'OK'}
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return response, 200

    product_data = data.get('product')
    user_id = data.get('userId', None)
    if not user_id or not product_data or not product_data.get('ID'):
        return {"message": "Missing userId or product data"}, 400

    # Controllo duplicato
    already_liked = get_liked_products_by_user(user_id)
    if any(p["blockchainProductId"] == product_data["ID"] for p in already_liked):
        return {"message": "Product already liked"}, 200

    like_a_product(user_id, product_data["ID"])
    return {"message": "Product added to liked products"}, 201

    # Save to JSON file
'''    save_liked_products(liked_products)
    
    print(f"Product {product_data['ID']} added to liked products for user {user_id}. Total: {len(liked_products[user_id])}")
    return jsonify({"message": "Product added to liked products"}), 201'''

# Funzione per rimuovere un prodotto dai liked products
def unlike_product_service(request):
    product_id = request.args.get('productId')
    user_id = request.args.get('userId', None)

    if not user_id or not product_id:
        response = {"message": "Missing userId or productId"}
        return add_cors_headers(response), 400

    liked_products = get_liked_products_by_user(user_id)
    liked_ids = {p["blockchainProductId"] for p in liked_products}

    if product_id not in liked_ids:
        response = {"message": "Product not found in liked products"}
        return add_cors_headers(response), 404

    unlike_a_product(user_id, product_id)
    response = {"message": "Product removed from liked products"}
    return add_cors_headers(response), 200

# Funzione per ottenere i liked products di un utente
def get_liked_products_service(request):
    user_id = request.args.get('userId', None)
    if not user_id:
        return [], 200

    liked = get_liked_products_by_user(user_id)
    return liked, 200

# Funzione per salvare i liked products su file JSON (se serve)
def save_liked_products(products):
    with open('liked_products.json', 'w') as f:
        json.dump(products, f, indent=4)

def add_recently_searched_service(user_email, blockchain_product_id):
    user = get_user_by_email(user_email)
    if not user or not user.get("_id"):
        raise ValueError("Invalid user")

    user_id = user["_id"]
    add_recently_searched(user_id, blockchain_product_id)

# Initialize the liked_products variable
#liked_products = load_liked_products()

def add_sensor_data_service(sensor_data, manufacturer):
    product_id = sensor_data.get("id")
    if not product_id:
        return {"body": {"message": "Product ID is required."}, "status": 400}

    verification_result = verify_manufacturer(product_id, manufacturer)
    if verification_result:
        return {"body": verification_result[0], "status": verification_result[1]}

    try:
        response = http_post(f'{MIDDLEWARE_BASE_URL}/api/product/sensor', json=sensor_data)
        if response.status_code == 200:
            return {"body": {"message": "Product uploaded successfully!"}, "status": 200}
        return {"body": {"message": "Failed to upload product."}, "status": 500}
    except Exception as e:
        return {"body": {"message": f"Error uploading product: {str(e)}"}, "status": 500}

def add_movement_data_service(movement_data, manufacturer):
    product_id = movement_data.get("id")
    if not product_id:
        return {"body": {"message": "Product ID is required."}, "status": 400}

    verification_result = verify_manufacturer(product_id, manufacturer)
    if verification_result:
        return {"body": verification_result[0], "status": verification_result[1]}

    try:
        response = http_post(f'{MIDDLEWARE_BASE_URL}/api/product/movement', json=movement_data)
        if response.status_code == 200:
            return {"body": {"message": "Product uploaded successfully!"}, "status": 200}
        return {"body": {"message": "Failed to upload product."}, "status": 500}
    except Exception as e:
        return {"body": {"message": f"Error uploading product: {str(e)}"}, "status": 500}


def add_certification_data_service(certification_data, manufacturer):
    product_id = certification_data.get("id")
    if not product_id:
        return {"body": {"message": "Product ID is required."}, "status": 400}

    verification_result = verify_manufacturer(product_id, manufacturer)
    if verification_result:
        return {"body": verification_result[0], "status": verification_result[1]}

    try:
        response = http_post(f'{MIDDLEWARE_BASE_URL}/api/product/certification', json=certification_data)
        if response.status_code == 200:
            return {"body": {"message": "Product uploaded successfully!"}, "status": 200}
        return {"body": {"message": "Failed to upload product."}, "status": 500}
    except Exception as e:
        return {"body": {"message": f"Error uploading product: {str(e)}"}, "status": 500}


def verify_product_compliance_service(compliance_data):
    try:
        response = http_post(f'{MIDDLEWARE_BASE_URL}/api/product/verifyProductCompliance', json=compliance_data)
        if response.status_code == 200:
            return {"body": {"message": "Product is compliant!"}, "status": 200}
        return {"body": {"message": "Product is not compliant"}, "status": 500}
    except Exception as e:
        return {"body": {"message": f"Error while checking product: {str(e)}"}, "status": 500}


def get_all_movements_service(product_id):
    try:
        response = http_get(f'{MIDDLEWARE_BASE_URL}/api/product/getMovements?productId={product_id}')
        if response.status_code == 200:
            return {"body": response.json(), "status": 200}
        return {"body": {"message": "Failed to get movements"}, "status": 500}
    except Exception as e:
        return {"body": {"message": f"Failed to get movements: {str(e)}"}, "status": 500}

def get_all_sensor_data_service(product_id):
    try:
        response = http_get(f'{MIDDLEWARE_BASE_URL}/api/product/getSensorData?productId={product_id}')
        if response.status_code != 200:
            return {"body": {"message": "Failed to get sensor data from middleware"}, "status": 500}

        sensor_data = response.json()

        # --- Login Databoom ---
        api_base = current_app.config['DATABOOM_API_BASE']
        username = current_app.config['DATABOOM_USERNAME']
        password = current_app.config['DATABOOM_PASSWORD']

        jwt_token = _databoom_login(api_base, username, password)
        if not jwt_token:
            return {"body": {"message": "Databoom login failed"}, "status": 500}

        headers = {"Authorization": f"Bearer {jwt_token}"}

        # --- Recupero info sensori e segnali ---
        updated_sensor_data = []
        for sensor_item in sensor_data:
            sensor_id = sensor_item.get("SensorId")
            sensor_name = _get_databoom_description(f"{api_base}/devices/{sensor_id}", headers)

            # rinomina segnali
            signals = sensor_item.get("Signals", {})
            renamed_signals = {}
            for signal_id, signal_value in signals.items():
                signal_name = _get_databoom_description(f"{api_base}/signals/{signal_id}", headers)
                renamed_signals[signal_name] = signal_value

            updated_sensor_data.append({
                "SensorName": sensor_name,
                "Signals": renamed_signals
            })

        return {"body": updated_sensor_data, "status": 200}

    except Exception as e:
        return {"body": {"message": f"Failed to get sensor data: {str(e)}"}, "status": 500}


def _databoom_login(api_base, username, password):
    """Effettua il login su Databoom e restituisce il JWT, o None in caso di errore"""
    try:
        response = http_post(f"{api_base}/auth/signin", json={"username": username, "password": password})
        if response.status_code != 200:
            return None
        return response.json().get("jwt")
    except Exception:
        return None


def _get_databoom_description(url, headers):
    """Recupera la descrizione di un device o signal, fallback a 'Unnamed'"""
    try:
        resp = http_get(url, headers=headers)
        if resp.status_code == 200:
            return resp.json().get("description", "Unnamed")
    except Exception:
        pass
    return "Unnamed"

def get_all_certifications_service(product_id):
    try:
        response = http_get(f'{MIDDLEWARE_BASE_URL}/api/product/getCertifications?productId={product_id}')
        if response.status_code == 200:
            return {"body": response.json(), "status": 200}
        return {"body": {"message": "Failed to get certifications"}, "status": 500}
    except Exception as e:
        return {"body": {"message": f"Failed to get certifications: {str(e)}"}, "status": 500}
