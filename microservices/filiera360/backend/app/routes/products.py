from flask import Blueprint
from flask_jwt_extended import jwt_required

from ..controller.products_controller import get_product_controller, get_product_history_controller, \
    upload_product_controller, update_product_controller, like_product_controller, unlike_product_controller, \
    get_liked_products_controller, add_recently_searched_controller, get_recently_searched_controller, \
    add_sensor_data_controller, add_movement_data_controller, add_certification_data_controller, \
    verify_product_compliance_controller, get_all_movements_controller, get_all_sensor_data_controller, \
    get_all_certifications_controller

products_bp = Blueprint('products', __name__)

products_bp.route('/getProduct', methods=['GET'])(get_product_controller)
products_bp.route('/getProductHistory', methods=['GET'])(get_product_history_controller)
products_bp.route('/uploadProduct', methods=['POST'])(jwt_required()(upload_product_controller))
products_bp.route('/updateProduct', methods=['POST'])(jwt_required()(update_product_controller))
products_bp.route('/likeProduct', methods=['POST', 'OPTIONS'])(jwt_required()(like_product_controller))
products_bp.route('/unlikeProduct', methods=['DELETE'])(jwt_required()(unlike_product_controller))
products_bp.route('/getLikedProducts', methods=['GET'])(jwt_required()(get_liked_products_controller))

products_bp.route('/addRecentlySearched', methods=['POST'])(jwt_required()(add_recently_searched_controller))
products_bp.route('/getRecentlySeached', methods=['GET'])(jwt_required()(get_recently_searched_controller))

products_bp.route("/addSensorData", methods=["POST"])(jwt_required()(add_sensor_data_controller))
products_bp.route("/addMovementsData", methods=["POST"])(jwt_required()(add_movement_data_controller))
products_bp.route("/addCertification", methods=["POST"])(jwt_required()(add_certification_data_controller))
products_bp.route("/verifyProductCompliance", methods=["POST"])(verify_product_compliance_controller)
products_bp.route("/getAllMovements", methods=["GET"])(get_all_movements_controller)
products_bp.route("/getAllSensorData", methods=["GET"])(get_all_sensor_data_controller)
products_bp.route("/getAllCertifications", methods=["GET"])(get_all_certifications_controller)
