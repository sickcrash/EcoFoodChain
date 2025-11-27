from flask import Blueprint
from ..controller.ledger_controller import init_ledger_controller

ledger_bp = Blueprint('ledger', __name__)

ledger_bp.route('/initLedger', methods=['POST'])(init_ledger_controller)
