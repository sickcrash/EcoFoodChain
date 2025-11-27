import time
from queries.users_queries import (
    create_user, get_user_by_email, update_user, get_user_by_id, get_user_by_manufacturer
)
from queries.products_queries import (
    create_product, get_product_by_id, get_product_by_blockchain_id, update_product_by_blockchain_id
)
from queries.liked_queries import (
    like_a_product, unlike_a_product, get_liked_products_by_user, get_users_who_liked_product
)
from queries.token_queries import (
    create_token, get_token, mark_token_as_used, get_tokens_by_inviter, get_tokens_used_by
)
from queries.models_queries import (
    create_model, get_model_by_id, get_model_by_blockchain_id,
    get_models_by_user, update_model, delete_model
)
from queries.history_queries import (
    add_history_entry, get_history_by_blockchain_id, delete_history_entry, get_history_by_user, get_last_history_entry
)
from queries.otp_queries import (
    create_otp, get_otp_by_user_id, delete_otp_by_user_id
)
from queries.recently_searched_queries import (
    add_recently_searched, get_recently_searched
)
from mongo_client import users, products, liked_products, invite_tokens, models, product_history, users_otp, recently_searched

def test_users():
    print("\n=== TEST USERS ===\n")
    times = []

    # inserimento utente
    start = time.time()
    user_id = create_user("test@example.com", "password", "TestManuf", "producer")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Insert user:", elapsed, "s\n")
    time.sleep(0.3)

    # ricerca da email
    start = time.time()
    user = get_user_by_email("test@example.com")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Find by email:", elapsed, "s")
    print("User found by email:", user, "\n")
    time.sleep(0.3)

    # ricerda da _id
    start = time.time()
    user_by_id = get_user_by_id(user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Find by ID:", elapsed, "s")
    print("User found by ID:", user_by_id, "\n")
    time.sleep(0.3)

    # ricerca da manufacturer
    start = time.time()
    user_by_manuf = get_user_by_manufacturer("TestManuf")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Find by manufacturer:", elapsed, "s")
    print("User found by manufacturer:", user_by_manuf, "\n")
    time.sleep(0.3)

    # aggiornamento utente
    start = time.time()
    update_user(user_id, {"manufacturer": "NewManuf"})
    elapsed = time.time() - start
    times.append(elapsed)
    updated_user = get_user_by_id(user_id)
    print("Update user:", elapsed, "s")
    print("Updated user:", updated_user, "\n")
    time.sleep(0.3)

    print(f"TEMPO MEDIO USERS: {sum(times)/len(times):.4f} s\n")
    return user_id

def test_products(user_id):
    time.sleep(1)
    print("\n=== TEST PRODUCTS ===\n")
    times = []

    # inserimento prodotto
    start = time.time()
    product_id = create_product("PROD_TEST_001", user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Insert product:", elapsed, "s\n")
    time.sleep(0.3)

    # ricerca da _id
    start = time.time()
    product = get_product_by_id(product_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Find by _id:", elapsed, "s")
    print("Product found by _id:", product, "\n")
    time.sleep(0.3)

    # ricerca da blockchainProductId
    start = time.time()
    product_by_blockchain = get_product_by_blockchain_id("PROD_TEST_001")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Find by blockchainProductId:", elapsed, "s")
    print("Product found by blockchainProductId:", product_by_blockchain, "\n")
    time.sleep(0.3)

    # aggiorna tramite blockchainProductId
    start = time.time()
    update_product_by_blockchain_id("PROD_TEST_001", {"description": "Updated by blockchain id"})
    elapsed = time.time() - start
    times.append(elapsed)
    updated_product2 = get_product_by_blockchain_id("PROD_TEST_001")
    print("Update product by blockchainProductId:", elapsed, "s")
    print("Updated product (by blockchainProductId):", updated_product2, "\n")
    time.sleep(0.3)

    print(f"TEMPO MEDIO PRODUCTS: {sum(times)/len(times):.4f} s\n")
    return product_id

def test_liked_products(user_id, product_id):
    time.sleep(1)
    print("\n=== TEST LIKED_PRODUCTS ===\n")
    times = []

    # like prodotto
    start = time.time()
    like_id = like_a_product(user_id, "PROD_TEST_001")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Like product:", elapsed, "s\n")
    time.sleep(0.3)

    # ricerca prodotti con like di un utente
    start = time.time()
    liked = get_liked_products_by_user(user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get liked products by user:", elapsed, "s")
    print("Liked products:", liked, "\n")
    time.sleep(0.3)

    # ricerca utenti che hanno messo like a un prodotto
    start = time.time()
    users_liked = get_users_who_liked_product("PROD_TEST_001")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get users who liked product:", elapsed, "s")
    print("Users who liked product:", users_liked, "\n")
    time.sleep(0.3)

    # unlike prodotto
    start = time.time()
    result = unlike_a_product(user_id, "PROD_TEST_001")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Unlike product:", elapsed, "s")
    print("Unlike result:", result, "\n")
    time.sleep(0.3)

    print(f"TEMPO MEDIO LIKED_PRODUCTS: {sum(times)/len(times):.4f} s\n")

def test_invite_tokens(user_id):
    time.sleep(1)
    print("\n=== TEST INVITE_TOKENS ===\n")
    times = []

    # crea token
    start = time.time()
    token_id = create_token("TOKEN_TEST_123", user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Create token:", elapsed, "s\n")
    time.sleep(0.3)

    # get token
    start = time.time()
    token_doc = get_token("TOKEN_TEST_123")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get token:", elapsed, "s")
    print("Token doc:", token_doc, "\n")
    time.sleep(0.3)

    # usa il token
    start = time.time()
    result = mark_token_as_used("TOKEN_TEST_123", "test@example.com")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Mark token as used:", elapsed, "s")
    print("Mark as used result:", result, "\n")
    time.sleep(0.3)

    # ricerca token per invitante
    start = time.time()
    tokens_by_inviter = get_tokens_by_inviter(user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get tokens by inviter:", elapsed, "s")
    print("Tokens by inviter:", tokens_by_inviter, "\n")
    time.sleep(0.3)

    # ricerca token usati da una email
    start = time.time()
    tokens_used_by = get_tokens_used_by("test@example.com")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get tokens used by email:", elapsed, "s")
    print("Tokens used by email:", tokens_used_by, "\n")
    time.sleep(0.3)

    print(f"TEMPO MEDIO INVITE_TOKENS: {sum(times)/len(times):.4f} s\n")

def test_models(user_id):
    time.sleep(1)
    print("\n=== TEST MODELS ===\n")
    times = []

    # inserimento modello 3D
    start = time.time()
    model_id = create_model("PROD_TEST_001", "base64string", user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Insert model:", elapsed, "s\n")
    time.sleep(0.3)

    # ricerca da _id
    start = time.time()
    model = get_model_by_id(model_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Find by _id:", elapsed, "s")
    print("Model found by _id:", model, "\n")
    time.sleep(0.3)

    # ricerca da blockchainProductId
    start = time.time()
    model_by_blockchain = get_model_by_blockchain_id("PROD_TEST_001")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Find by blockchainProductId:", elapsed, "s")
    print("Model found by blockchainProductId:", model_by_blockchain, "\n")
    time.sleep(0.3)

    # ricerca modelli caricati da un utente
    start = time.time()
    models_by_user = get_models_by_user(user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get models by user:", elapsed, "s")
    print("Models by user:", models_by_user, "\n")
    time.sleep(0.3)

    # aggiorna modello 3D
    start = time.time()
    update_result = update_model(model_id, {"modelString": "updated_base64"})
    elapsed = time.time() - start
    times.append(elapsed)
    updated_model = get_model_by_id(model_id)
    print("Update model:", elapsed, "s")
    print("Update result:", update_result)
    print("Updated model:", updated_model, "\n")
    time.sleep(0.3)

    # elimina modello 3D
    start = time.time()
    delete_result = delete_model(model_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Delete model:", elapsed, "s")
    print("Delete result:", delete_result, "\n")
    time.sleep(0.3)

    print(f"TEMPO MEDIO MODELS: {sum(times)/len(times):.4f} s\n")

def test_product_history(user_id):
    time.sleep(1)
    print("\n=== TEST PRODUCT_HISTORY ===\n")
    times = []

    # aggiungi prima entry di history
    start = time.time()
    add_result1 = add_history_entry(
        "PROD_TEST_001",
        user_id,
        [{"field": "name", "oldValue": "Old", "newValue": "New"}]
    )
    elapsed = time.time() - start
    times.append(elapsed)
    print("Add first history entry:", elapsed, "s\n")
    time.sleep(0.3)

    # aggiungi seconda entry di history
    start = time.time()
    add_result2 = add_history_entry(
        "PROD_TEST_001",
        user_id,
        [{"field": "description", "oldValue": "OldDesc", "newValue": "NewDesc"}]
    )
    elapsed = time.time() - start
    times.append(elapsed)
    print("Add second history entry:", elapsed, "s\n")
    time.sleep(0.3)

    # ricerca history per blockchainProductId
    start = time.time()
    history_by_blockchain = get_history_by_blockchain_id("PROD_TEST_001")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get history by blockchainProductId:", elapsed, "s")
    print("History by blockchainProductId:")
    for entry in history_by_blockchain:
        print(f"  - _id: {entry.get('_id')}, modifiedBy: {entry.get('modifiedBy')}, changes: {entry.get('changes')}, timestamp: {entry.get('timestamp')}")
    print()
    time.sleep(0.3)

    # ricerca history per modifiedBy
    start = time.time()
    history_by_user = get_history_by_user(user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get history by user:", elapsed, "s")
    print("History by user:")
    for entry in history_by_user:
        print(f"  - _id: {entry.get('_id')}, blockchainProductId: {entry.get('blockchainProductId')}, modifiedBy: {entry.get('modifiedBy')}, changes: {entry.get('changes')}, timestamp: {entry.get('timestamp')}")
    print()
    time.sleep(0.3)

    # cerca ultima entry di history
    start = time.time()
    last_entry = get_last_history_entry("PROD_TEST_001")
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get last history entry:", elapsed, "s")
    print("Last history entry:", last_entry, "\n")
    time.sleep(0.3)

    # elimina una entry di history (ad esempio la prima)
    if history_by_blockchain:
        entry_id = history_by_blockchain[0]["_id"]
        start = time.time()
        delete_result = delete_history_entry(entry_id)
        elapsed = time.time() - start
        times.append(elapsed)
        print("Delete single history entry:", elapsed, "s")
        print("Delete result:", delete_result, "\n")
        time.sleep(0.3)

    print(f"TEMPO MEDIO PRODUCT_HISTORY: {sum(times)/len(times):.4f} s\n")

def test_otp(user_id):
    time.sleep(1)
    print("\n=== TEST OTP ===\n")
    times = []

    # crea OTP
    start = time.time()
    otp_id = create_otp(user_id, "ABCDEF", expires_in_seconds=300)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Create OTP:", elapsed, "s\n")
    time.sleep(0.3)

    # ricerca OTP per user_id
    start = time.time()
    otp_doc = get_otp_by_user_id(user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get OTP by user_id:", elapsed, "s")
    print("OTP doc:", otp_doc, "\n")
    time.sleep(0.3)

    # elimina OTP per user_id
    start = time.time()
    result = delete_otp_by_user_id(user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Delete OTP by user_id:", elapsed, "s")
    print("Delete result:", result, "\n")
    time.sleep(0.3)

    print(f"TEMPO MEDIO OTP: {sum(times)/len(times):.4f} s\n")

def test_recently_searched(user_id):
    time.sleep(1)
    print("\n=== TEST RECENTLY_SEARCHED ===\n")
    times = []

    # Aggiungi 6 prodotti diversi per testare il limite a 5
    for i in range(6):
        prod_id = f"PROD_TEST_{i:03d}"
        start = time.time()
        add_recently_searched(user_id, prod_id)
        elapsed = time.time() - start
        times.append(elapsed)
        print(f"Add recently searched product {prod_id}:", elapsed, "s")
        time.sleep(0.2)

    # Recupera la lista dei prodotti cercati di recente
    start = time.time()
    recent = get_recently_searched(user_id)
    elapsed = time.time() - start
    times.append(elapsed)
    print("Get recently searched:", elapsed, "s")
    print("Recently searched products (should be 5, most recent first):")
    for prod in recent:
        print(f"  - blockchainProductId: {prod.get('blockchainProductId')}, searchedAt: {prod.get('searchedAt')}")
    print()
    time.sleep(0.3)

    # Testa che il prodotto più vecchio sia stato rimosso (PROD_TEST_000)
    assert all(prod["blockchainProductId"] != "PROD_TEST_000" for prod in recent), "Il prodotto più vecchio non è stato rimosso!"

    print(f"TEMPO MEDIO RECENTLY_SEARCHED: {sum(times)/len(times):.4f} s\n")

# funzione di cleanup per rimuovere i dati di test
def cleanup(user_id, product_id):
    print("\n=== CLEANUP ===\n")
    users.delete_one({"_id": user_id})
    products.delete_one({"_id": product_id})
    liked_products.delete_many({"userId": user_id})
    invite_tokens.delete_many({"invitedBy": user_id})
    models.delete_many({"userId": user_id})
    users_otp.delete_many({"user_id": user_id})
    product_history.delete_many({
        "$or": [
            {"modifiedBy": user_id},
            {"blockchainProductId": "PROD_TEST_001"}
        ]
    })
    recently_searched.delete_many({"userId": user_id})
    print("Test user, product, like, token, model, OTP, history e recently searched eliminati.\n")

if __name__ == "__main__":
    user_id = test_users()
    print("\n" + "="*40 + "\n")
    product_id = test_products(user_id)
    print("\n" + "="*40 + "\n")
    test_liked_products(user_id, product_id)
    print("\n" + "="*40 + "\n")
    test_invite_tokens(user_id)
    print("\n" + "="*40 + "\n")
    test_models(user_id)
    print("\n" + "="*40 + "\n")
    test_product_history(user_id)
    print("\n" + "="*40 + "\n")
    test_otp(user_id)
    print("\n" + "="*40 + "\n")
    test_recently_searched(user_id)
    cleanup(user_id, product_id)