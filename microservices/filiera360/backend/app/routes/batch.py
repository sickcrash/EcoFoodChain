from flask import Blueprint
from flask_jwt_extended import jwt_required
from ..controller.batch_controller import get_batch_controller, get_batch_history_controller, \
    upload_batch_controller, update_batch_controller

batch_bp = Blueprint('batch', __name__)

batch_bp.route('/getBatch', methods=['GET'])(get_batch_controller)
batch_bp.route('/getBatchHistory', methods=['GET'])(get_batch_history_controller)
batch_bp.route('/uploadBatch', methods=['POST'])(jwt_required()(upload_batch_controller))
batch_bp.route('/updateBatch', methods=['POST'])(jwt_required()(update_batch_controller))

