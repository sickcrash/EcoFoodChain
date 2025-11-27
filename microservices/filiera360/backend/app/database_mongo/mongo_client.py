import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi

uri = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
client = MongoClient(uri, server_api=ServerApi('1'))

# Ping per confermare la connessione
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

db = client["supplychainDB"]

users = db["users"]
users_otp = db["users_otp"]
liked_products = db["liked_products"]
models = db["models"]
invite_tokens = db["invite_tokens"]
product_history = db["product_history"]
products = db["products"]
recently_searched = db["recently_searched"]
