from flask import Blueprint

from ..controller.model_controller import upload_model_controller, get_model_controller

model_bp = Blueprint('model', __name__)

model_bp.route('/uploadModel', methods=['POST'])(upload_model_controller)
model_bp.route('/getModel', methods=['GET'])(get_model_controller)