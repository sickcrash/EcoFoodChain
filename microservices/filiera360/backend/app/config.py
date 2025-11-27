import os, secrets

class Config:
    # Config Mail
    MAIL_SERVER = os.getenv('MAIL_SERVER')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'True') == 'True'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')

    # Config JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', secrets.token_hex(32))

    # Config Databoom
    DATABOOM_API_BASE = os.getenv("DATABOOM_API_BASE")
    DATABOOM_USERNAME = os.getenv("DATABOOM_USERNAME")
    DATABOOM_PASSWORD = os.getenv("DATABOOM_PASSWORD")

    # CORS
    CORS_HEADERS = 'Content-Type'