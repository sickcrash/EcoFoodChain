import json

from ..utils.http_client import http_post
import os
MIDDLEWARE_BASE_URL = os.environ.get('MIDDLEWARE_URL', 'http://filiera-middleware:3000')

def init_ledger_service():
    # Leggi il file sampleData.json
    try:
        with open('sampleData.json', 'r') as file:
            products = json.load(file)
    except Exception as e:
        print("Errore nella lettura di sampleData.json:", e)
        return {"message": "Errore nella lettura del file di dati iniziali."}, 500

    # Invio dei dati del prodotto alla rete
    errors = []
    for product in products:
        try:
            response = http_post('{MIDDLEWARE_BASE_URL}/uploadProduct', json=product)
            if response.status_code != 200:
                errors.append({
                    "product_id": product.get("ID"),
                    "error": response.json().get("message", "Unknown error")
                })
        except Exception as e:
            print(f"Errore nell'upload del prodotto {product.get('ID')}: {e}")
            errors.append({"product_id": product.get("ID"), "error": str(e)})

    if errors:
        return {"message": "Errore durante l'inizializzazione del ledger.", "errors": errors}, 500

    return {"message": "Ledger initialized successfully with sample data."}, 200
