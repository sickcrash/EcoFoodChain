from flask import jsonify,request
from flask_jwt_extended import get_jwt_identity

from ..services.model_service import upload_model_service, get_model_service

def upload_model_controller():
    product_data = request.json
    user_email = get_jwt_identity()

    result, status = upload_model_service(user_email, product_data)
    return jsonify(result), status

def get_model_controller():
    product_id = request.args.get('productId')

    result, status = get_model_service(product_id)
    return jsonify(result), status