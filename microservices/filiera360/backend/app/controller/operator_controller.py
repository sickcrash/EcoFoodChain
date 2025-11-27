from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity

from ..services.operator_service import get_operators_service, add_operator_service, remove_operator_service

def get_operators_controller():
    user_id = get_jwt_identity()
    result, status = get_operators_service(user_id)
    return jsonify(result), status

def add_operator_controller():
    user_id = get_jwt_identity()
    data = request.json
    result, status = add_operator_service(user_id, data)
    return jsonify(result), status

def remove_operator_controller():
    user_id = get_jwt_identity()
    data = request.json
    result, status = remove_operator_service(user_id, data)
    return jsonify(result), status
