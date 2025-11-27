from flask import Blueprint

from ..controller.databoom_controller import fetch_devices, fetch_signal_averages

databoom_bp = Blueprint("databoom", __name__)

@databoom_bp.route("/getDataboomDevices", methods=["GET"])
def get_databoom_devices_route():
    return fetch_devices()


@databoom_bp.route("/getDataboomSignalAverages", methods=["GET"])
def get_signal_averages_route():
    return fetch_signal_averages()
