import requests
import os
MIDDLEWARE_BASE_URL = os.environ.get('MIDDLEWARE_URL', 'http://filiera-middleware:3000')

def verify_manufacturer(product_id, real_manufacturer):
    """
    Verifica che il manufacturer autenticato corrisponda al manufacturer registrato sulla blockchain per un prodotto.
    Restituisce None se la verifica passa, altrimenti jsonify con errore e status code.
    """
    try:
        blockchain_response = requests.get(f'{MIDDLEWARE_BASE_URL}/readProduct?productId={product_id}')
        if blockchain_response.status_code == 200:
            blockchain_data = blockchain_response.json()
            registered_manufacturer = blockchain_data.get("Manufacturer")
            if not registered_manufacturer:
                return {"message": "Manufacturer not found on blockchain."}, 404
            if real_manufacturer != registered_manufacturer:
                return {"message": "Unauthorized: Manufacturer mismatch."}, 403
            return None  # Nessun errore
        else:
            return {"message": "Failed to retrieve product from blockchain."}, 500
    except Exception as e:
        print("Error connecting to blockchain:", e)
        return {"message": "Error retrieving product from blockchain."}, 500