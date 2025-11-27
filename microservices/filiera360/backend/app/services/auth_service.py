from flask import jsonify
from flask_jwt_extended import create_access_token
# from datetime import timedelta

from ..database_mongo.queries.otp_queries import create_otp, delete_otp_by_user_id, get_otp_by_user_id
from ..database_mongo.queries.token_queries import get_token, mark_token_as_used
from ..database_mongo.queries.users_queries import get_user_by_email, get_user_by_manufacturer, create_user, update_user
from ..extensions import executor
from ..utils.auth_utils import build_auth_response
from ..utils.bcrypt_utils import hash_password, check_password
from ..utils.otp_utils import generate_otp
from ..utils.email_utils import send_otp_email, send_email, send_reset_email
from ..utils.token_utils import generate_reset_token, verify_reset_token

# OTP_LIFETIME = timedelta(minutes=5)
def send_otp(email, user):
    """Genera e invia un OTP a un utente."""
    otp = generate_otp()
    create_otp(user["_id"], str(otp))

    return send_otp_email(email, otp, executor)

def process_login(email, password):
    user = get_user_by_email(email)
    if not user:
        return jsonify({"message": "Invalid email or password"}), 401

    # Delego la verifica al thread pool
    future = executor.submit(check_password, password, user["password"])
    if not future.result():  # qui aspetto, ma senza bloccare il main thread Flask
        return jsonify({"message": "Invalid email or password"}), 401

    """ # Se la 2FA è abilitata, invia il codice OTP
    if user.get('two_factor_enabled', False):
        secret = user.get('2fa_secret', None)
        if not secret:
            secret = pyotp.random_base32()  # Genera un segreto se non esiste
            user['2fa_secret'] = secret
            save_users(users)  # Salva l'utente con il nuovo segreto

        otp = pyotp.TOTP(secret).now()  # Genera il codice OTP
        # In un'app reale, invieresti l'OTP via email o SMS, ma per ora lo restituiamo nel corpo della risposta
        return jsonify({"message": "2FA required", "otp": otp})  # Solo per scopi di sviluppo """

    # Se l'utente ha il flag user attivo
    if user["flags"][2]: # flags[2] == user
        token = create_access_token(email)
        return jsonify(build_auth_response(user, email, token, "Login successful"))

    # Se il flag non è attivo → OTP
    if send_otp(email, user):
        return jsonify({"message": "OTP sent to your email."})
    else:
        return jsonify({"message": "Failed to send OTP."}), 500

    # Se la 2FA non è necessaria, crea un token JWT

""" START METHODS SIGNUP """

def process_signup(data):
    email = data.get('email')
    manufacturer = data.get('manufacturer')
    password = data.get('password')
    role = data.get('role', 'user')
    invite_token = data.get('inviteToken', None)

    # Validazione iniziale rapida
    if not all([email, manufacturer, password]):
        return {"message": "All fields are required"}, 400

    # Esegui controlli in parallelo per email e manufacturer
    email_exists, manufacturer_exists = _check_existing_user_parallel(email, manufacturer)

    if email_exists:
        return {"message": "Email already exists"}, 409
    if manufacturer_exists:
        return {"message": "Manufacturer already exists"}, 409

    # Controlla il token di invito per i produttori
    if role == "producer":
        token_validation = _validate_producer_token(invite_token)
        if token_validation:
            return token_validation

    # Crea un hash della password con bcrypt
    hashed_password = hash_password(password)

    # Crea utente con transazione
    success = _create_user_with_token(email, hashed_password, manufacturer, role, invite_token)

    if success:
        return {"message": "User registered successfully"}, 201
    else:
        return {"message": "Registration failed"}, 500

def _check_existing_user_parallel(email, manufacturer):
    """Controlla email e manufacturer in parallelo"""
    email_future = executor.submit(get_user_by_email, email)
    manufacturer_future = executor.submit(get_user_by_manufacturer, manufacturer)

    email_exists = email_future.result() is not None
    manufacturer_exists = manufacturer_future.result() is not None

    return email_exists, manufacturer_exists

def _validate_producer_token(invite_token):
    if not invite_token:
        return {"message": "The invite token is required for producers."}, 400

    token_doc = get_token(invite_token)
    if not token_doc:
        return {"message": "Invalid invitation token."}, 403
    if token_doc.get("used"):
        return {"message": "Invitation token already used."}, 403

    return None

def _create_user_with_token(email, hashed_password, manufacturer, role, invite_token):
    try:
        create_user(email, hashed_password, manufacturer, role)

        if role == "producer" and invite_token:
            mark_token_as_used(invite_token, email)

        return True
    except Exception as e:
        print(f"Operation failed: {e}")
        return False

""" END METHODS SIGNUP """

def verify_otp_service(data):
    email = data.get('email')
    otp = str(data.get("otp", ""))  # converti in stringa

    user = get_user_by_email(email)
    if not user:
        return {"message": "User not found."}, 404

    otp_entry = get_otp_by_user_id(user["_id"])
    if not otp_entry or otp_entry["otp"] != otp:
        return {"message": "Invalid or expired OTP."}, 400

    delete_otp_by_user_id(user["_id"])
    token = create_access_token(email)

    return build_auth_response(user, email, token, "OTP validated successfully."), 200

def change_password_service(data, user_identity):
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')

    if not current_password or not new_password:
        return {"message": "Both current and new password are required."}, 400

    user = get_user_by_email(user_identity)
    if not user:
        return {"message": "User not found."}, 404

    # Verifica la password attuale
    if not check_password(current_password, user['password']):
        return {"message": "Current password is incorrect."}, 401

    # Aggiorna la password
    hashed_password = hash_password(new_password)
    update_user(user["_id"], {"password": hashed_password})

    return {"message": "Password changed successfully."}, 200

def forgot_password_service(data):
    email = data.get('email')
    if not email or not get_user_by_email(email):
        return {"message": "Email not found"}, 404

    token = generate_reset_token(email)
    reset_url = f"api/reset-password/{token}"

    success = send_reset_email(email, reset_url, executor)

    # send_email non indica se l’email è stata davvero inviata,
    # ma solo se il task è stato inviato al pool correttamente.
    if success:
        return {"message": "Password reset email sent"}, 200
    return {"message": "Failed to send password reset email"}, 500

def reset_password_service(token, request):
    email = verify_reset_token(token)
    if not email:
        return {"message": "Invalid or expired token"}, 400

    if request.method != 'POST':
        # Se vuoi solo POST per reset password
        return {"message": "Token is valid, proceed with password reset"}, 200

    # Verifica Content-Type
    if request.content_type != 'application/json':
        return {"message": "Content-Type must be application/json"}, 415

    new_password = request.json.get('password')
    if not new_password:
        return {"message": "Password is required"}, 400

    # Recupera utente
    user = get_user_by_email(email)
    if not user:
        return {"message": "User not found"}, 404

    hashed_password = hash_password(new_password)
    update_user(user["_id"], {"password": hashed_password})

    return {"message": "Password updated successfully"}, 200
