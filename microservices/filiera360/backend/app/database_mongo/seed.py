from backend.app.database_mongo.queries.users_queries import create_user, get_user_by_email
from backend.app.database_mongo.queries.otp_queries import create_otp
from backend.app.database_mongo.queries.liked_queries import like_a_product
from backend.app.database_mongo.queries.token_queries import create_token
from backend.app.database_mongo.queries.products_queries import create_product
from backend.app.database_mongo.queries.models_queries import create_model
from backend.app.database_mongo.queries.recently_searched_queries import add_recently_searched
from backend.app.database_mongo.queries.history_queries import add_history_entry
from backend.app.database_mongo.mongo_client import (
    users, users_otp, liked_products, invite_tokens, products, models,
    product_history, recently_searched
)

# Svuota tutte le collection
users.delete_many({})
users_otp.delete_many({})
liked_products.delete_many({})
invite_tokens.delete_many({})
products.delete_many({})
models.delete_many({})
product_history.delete_many({})
recently_searched.delete_many({})

# 1. Crea utenti di test
user1_id = create_user("michele@example.com", "michelone", "Micheledc", "producer")
user2_id = create_user("giovanni@example.com", "giovannino", "Giovannigc", "user")

# 2. Crea OTP per un utente
create_otp(user1_id, "123456", expires_in_seconds=600)

# 3. Crea prodotti di test
product1_id = create_product("PROD001", user1_id)
product2_id = create_product("PROD002", user2_id)

# 4. Crea modelli 3D di test
create_model("PROD001", "base64string1", user1_id)
create_model("PROD002", "base64string2", user2_id)

# 5. Crea token invito
create_token("INVITE123", user1_id)
create_token("INVITE456", user2_id)

# 6. Like prodotti
like_a_product(user1_id, "PROD001")
like_a_product(user2_id, "PROD002")

# 7. Recently searched
add_recently_searched(user1_id, "PROD001")
add_recently_searched(user1_id, "PROD002")
add_recently_searched(user2_id, "PROD001")

# 8. Product history
add_history_entry("PROD001", user1_id, [{"field": "name", "oldValue": "Old", "newValue": "New"}])

print("Seed dati completato con successo.")

'''
su mongoDB devono essere presenti le seguenti collection:
- users: i due utenti di test
- users_otp: otp solo per il primo utente
- liked_products: i like dei due utenti su due prodotti diversi
- invite_tokens: due token creati dai due utenti
- products: due prodotti caricati dai due utenti
- models: due "modelli 3D" caricati dai due utenti
- product_history: il prodotto PROD001 ha una modifica effettuata dal primo utente (dati della blockchain)
- recently_searched: user1 ha cercato due prodotti, user2 ha cercato uno dei prodotti di user1
'''