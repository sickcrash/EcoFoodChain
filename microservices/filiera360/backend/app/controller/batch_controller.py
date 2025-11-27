from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

from ..services.batch_service import get_batch_service, get_batch_history_service, upload_batch_service, \
    update_batch_service

def get_batch_controller():
    batch_id = request.args.get('batchId')
    result, status = get_batch_service(batch_id)
    return jsonify(result), status

def get_batch_history_controller():
    batch_id = request.args.get('batchId')
    result, status = get_batch_history_service(batch_id)
    return jsonify(result), status

def upload_batch_controller():
    batch_data = request.json
    user_email = get_jwt_identity()

    result, status = upload_batch_service(user_email, batch_data)
    return jsonify(result), status

def update_batch_controller():
    batch_data = request.json
    user_email = get_jwt_identity()

    result, status = update_batch_service(user_email, batch_data)
    return jsonify(result), status
