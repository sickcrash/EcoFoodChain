def create_user_model(email, password_hash, manufacturer, role):
    # flags: [producer, operator, user]
    flags = [
        role == "producer",
        role == "operator",
        role == "user"
    ]
    return {
        "email": email,
        "password": password_hash,
        "manufacturer": manufacturer,
        "role": role,
        "flags": flags,
        "operators": []
    }