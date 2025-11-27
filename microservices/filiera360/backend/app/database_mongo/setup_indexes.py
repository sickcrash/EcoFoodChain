from mongo_client import users, users_otp, liked_products, models, invite_tokens, product_history, products, recently_searched

def setup_indexes():
    # Indice unico su email per gli utenti
    users.create_index([("email", 1)], unique=True)
    # Indice TTL su expiresAt per gli OTP (scadenza automatica)
    users_otp.create_index([("expiresAt", 1)], expireAfterSeconds=0)
    # Indice unico su blockchainProductId per i prodotti
    products.create_index([("blockchainProductId", 1)], unique=True)
    # Indice unico su token per gli inviti
    invite_tokens.create_index([("token", 1)], unique=True)
    # Indice unico sulla stringa del modello3D per i modelli
    models.create_index([("modelString", 1)], unique=True)
    # Indice unico sulla coppia userId e blockchainProductId (un like a prodotto per utente))
    liked_products.create_index([("userId", 1), ("blockchainProductId", 1)], unique=True)
    # Indice sulla cronologia dei prodotti per velocizzare le ricerche
    product_history.create_index([("blockchainProductId", 1), ("timestamp", 1)])
    # Indice unico su userId per le ricerche recenti
    recently_searched.create_index([("userId", 1)], unique=True)

    print("Indexes set up successfully.")