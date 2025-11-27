from flask_jwt_extended import create_access_token, decode_token
from datetime import timedelta
from flask_jwt_extended.exceptions import JWTExtendedException

def generate_reset_token(email):
    expiration = timedelta(hours=1)
    token = create_access_token(identity=email, expires_delta=expiration)
    return token

def verify_reset_token(token):
    try:
        decoded_token = decode_token(token)
        return decoded_token['sub']
    except JWTExtendedException as e:
        print(f"Errore nel token: {e}")
        return None