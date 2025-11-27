from flask import Blueprint
from flask_jwt_extended import jwt_required

from ..controller.operator_controller import get_operators_controller, add_operator_controller, \
    remove_operator_controller

operator_bp = Blueprint('operator', __name__)

operator_bp.route('/operators', methods=['GET'])(jwt_required()(get_operators_controller))
operator_bp.route('/operators/add', methods=['POST'])(jwt_required()(add_operator_controller))
operator_bp.route('/operators/delete', methods=['POST'])(jwt_required()(remove_operator_controller))
