from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

from ..database_mongo.queries.recently_searched_queries import get_recently_searched
from ..database_mongo.queries.users_queries import get_user_by_email
from ..services.products_service import get_product_service ,get_product_history_service, \
    upload_product_service, update_product_service, like_product_service, unlike_product_service, \
    get_liked_products_service, add_recently_searched_service, add_sensor_data_service, add_movement_data_service, \
    add_certification_data_service, verify_product_compliance_service, get_all_movements_service, \
    get_all_sensor_data_service, get_all_certifications_service

def get_product_controller():
    product_id = request.args.get('productId')
    if not product_id:
        return jsonify({'message': 'productId is required'}), 400

    product_data = get_product_service(product_id)

    if "error" in product_data:
        print("Error fetching product:", product_data["error"])
        return jsonify({'message': 'Failed to get product.', 'error': product_data["error"]}), 500

    return jsonify(product_data)

def get_product_history_controller():
    product_id = request.args.get('productId')
    if not product_id:
        return jsonify({'message': 'productId is required'}), 400

    product_history_data = get_product_history_service(product_id)

    if "error" in product_history_data:
        print("Error fetching product history:", product_history_data["error"])
        return jsonify({'message': 'Failed to get product history.', 'error': product_history_data["error"]}), 500

    return jsonify(product_history_data)

def upload_product_controller():
    product_data = request.json
    user_identity = get_jwt_identity()
    result, status = upload_product_service(product_data, user_identity)
    return jsonify(result), status

def update_product_controller():
    product_data = request.json
    user_identity = get_jwt_identity()
    result, status = update_product_service(product_data, user_identity)
    return jsonify(result), status

def like_product_controller():
    data = request.json
    result, status = like_product_service(data, request)
    return jsonify(result), status

def unlike_product_controller():
    result, status = unlike_product_service(request)
    return jsonify(result), status

def get_liked_products_controller():
    result, status = get_liked_products_service(request)
    return jsonify(result), status

def add_recently_searched_controller():
    data = request.json
    blockchain_product_id = data.get('blockchainProductId')
    user_email = get_jwt_identity()

    if not blockchain_product_id:
        return jsonify({"message": "Missing product data"}), 400

    try:
        add_recently_searched_service(user_email, blockchain_product_id)
        return jsonify({"message": "Product added to recently searched"})
    except ValueError as e:
        return jsonify({"message": str(e)}), 400


def get_recently_searched_controller():
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify([])

    products = get_recently_searched(user_id)
    return jsonify(products)

'''def load_recently_searched():
    try:
        with open('recently_searched.json', 'r') as f:
            data = json.load(f)
            # Ensure the structure is an object with user IDs as keys
            if isinstance(data, list):
                # Convert old format to new format if needed
                return {"default": data}
            return data
    except (FileNotFoundError, json.JSONDecodeError):
        # If file doesn't exist, create it with an empty object
        save_recently_searched({})
        return {}

def save_recently_searched(products):
    with open('recently_searched.json', 'w') as f:
        json.dump(products, f, indent=4)
'''

def add_sensor_data_controller():
    data = request.json
    user_email = get_jwt_identity()
    user = get_user_by_email(user_email)
    manufacturer = user.get("manufacturer")

    result = add_sensor_data_service(data, manufacturer)
    return jsonify(result.get("body")), result.get("status")

def add_movement_data_controller():
    data = request.json
    user_email = get_jwt_identity()
    user = get_user_by_email(user_email)
    manufacturer = user.get("manufacturer")

    result = add_movement_data_service(data, manufacturer)
    return jsonify(result.get("body")), result.get("status")

def add_certification_data_controller():
    data = request.json
    user_email = get_jwt_identity()
    user = get_user_by_email(user_email)
    manufacturer = user.get("manufacturer")

    result = add_certification_data_service(data, manufacturer)
    return jsonify(result.get("body")), result.get("status")

def verify_product_compliance_controller():
    data = request.json
    result = verify_product_compliance_service(data)
    return jsonify(result.get("body")), result.get("status")

def get_all_movements_controller():
    product_id = request.args.get("productId")
    result = get_all_movements_service(product_id)
    return jsonify(result.get("body")), result.get("status")

def get_all_sensor_data_controller():
    product_id = request.args.get("productId")
    result = get_all_sensor_data_service(product_id)
    return jsonify(result["body"]), result["status"]

def get_all_certifications_controller():
    product_id = request.args.get("productId")
    result = get_all_certifications_service(product_id)
    return jsonify(result["body"]), result["status"]
