from flask import Blueprint

from ..controller.auth_controller import login, signup, verify_otp, change_password, forgot_password, \
    reset_password

auth_bp = Blueprint('auth', __name__)

auth_bp.route('/login', methods=['POST'])(login)
auth_bp.route('/signup', methods=['POST'])(signup)
auth_bp.route('/verify-otp', methods=['POST'])(verify_otp)
auth_bp.route('/change-password', methods=['POST'])(change_password)
auth_bp.route('/forgot-password', methods=['POST'])(forgot_password)
auth_bp.route('/reset-password/<token>', methods=['GET', 'POST'])(reset_password)
