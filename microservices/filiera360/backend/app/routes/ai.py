from flask import Blueprint

from ..controller.ai_controller import scan_controller, ask_controller

ai_bp = Blueprint("ai", __name__)

# usata dall'interfaccia AI
ai_bp.route("/scan", methods=["POST"])(scan_controller)
ai_bp.route("/ask", methods=["POST"])(ask_controller)
