from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

from ..services.auth_service import process_login, process_signup, verify_otp_service, change_password_service, \
    forgot_password_service, reset_password_service

def login():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Email and password are required"}), 400

    return process_login(data["email"], data["password"])

def signup():
    data = request.get_json()
    result, status_code = process_signup(data)
    return jsonify(result), status_code

def verify_otp():
    data = request.get_json()
    result, status = verify_otp_service(data)
    return jsonify(result), status

def change_password():
    data = request.get_json()
    user_identity = get_jwt_identity()
    result, status = change_password_service(data, user_identity)
    return jsonify(result), status

def forgot_password():
    data = request.get_json()
    result, status = forgot_password_service(data)
    return jsonify(result), status

def reset_password(token):
    result, status = reset_password_service(token, request)
    return jsonify(result), status
