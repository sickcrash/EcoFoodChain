import requests
from ..utils.chatbot import chatbot_response
import os
MIDDLEWARE_BASE_URL = os.environ.get('MIDDLEWARE_URL', 'http://filiera-middleware:3000')

# Variabile globale per salvare il productinfo associato all'ultimo scan
_cached_product_info = {}

def scan_service(item_code):
    global _cached_product_info
    try:
        response = requests.get(f'{MIDDLEWARE_BASE_URL}/readProduct?productId={item_code}')
        if response.status_code == 200:
            productinfo = response.json()
            _cached_product_info[item_code] = productinfo
            initial_message = f"Hello, you just scanned the item {item_code}. What would you like to know about it?"
            return {"body": {"message": initial_message, "item_code": item_code}, "status": 200}
        else:
            initial_message = f"Hello, you just scanned the item {item_code}. At the moment I'm unable to retrieve product details."
            return {"body": {"message": initial_message, "item_code": item_code}, "status": 500}
    except Exception as e:
        return {"body": {"message": "Cannot connect to the server", "error": str(e)}, "status": 500}

def ask_service(user_input, item_code):
    global _cached_product_info
    productinfo = _cached_product_info.get(item_code)
    if not productinfo:
        return {"body": {"message": "No product info available. Please scan first."}, "status": 400}

    bot_response = chatbot_response(user_input, item_code, productinfo)
    return {"body": {"message": bot_response}, "status": 200}
