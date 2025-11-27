from flask import jsonify
from ..services.ledger_service import init_ledger_service

def init_ledger_controller():
    result, status = init_ledger_service()
    return jsonify(result), status
