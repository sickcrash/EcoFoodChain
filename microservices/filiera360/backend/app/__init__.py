from flask import Flask
# from werkzeug.middleware.profiler import ProfilerMiddleware
from flask_mail import Mail
from flask_jwt_extended import JWTManager
# from dotenv import load_dotenv
from .config import Config
from flask_cors import CORS
from .extensions import executor

from .routes.views import views_bp
from .routes.batch import batch_bp
from .routes.databoom import databoom_bp
from .routes.ledger import ledger_bp
from .routes.model import model_bp
from .routes.operator import operator_bp
from .routes.products import products_bp
from .routes.auth import auth_bp

# # Carica .env solo se esiste il file (sviluppo locale)
# if os.path.exists('.env'):
#     load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)  # carica tutte le variabili da Config

# --- CONFIG CORS ---
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})

mail = Mail(app)

jwt = JWTManager(app)

# --- BLUEPRINT ---
app.register_blueprint(views_bp)
app.register_blueprint(products_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(batch_bp)
app.register_blueprint(databoom_bp)
app.register_blueprint(ledger_bp)
app.register_blueprint(model_bp)
app.register_blueprint(operator_bp)


# Profilation per capire i tempi di risposta di ongi api chiamata (in fase di test abilitarlo)
# app.wsgi_app = ProfilerMiddleware(app.wsgi_app, restrictions=[5])