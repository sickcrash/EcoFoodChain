def build_auth_response(user, email, token, message):
    return {
        "message": message,
        "access_token": token,
        "role": user.get("role"),
        "manufacturer": user.get("manufacturer"),
        "email": email
    }
