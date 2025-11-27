from flask import jsonify, request

from ..services.databoom_service import get_devices, get_signal_averages

def fetch_devices():
    try:
        devices = get_devices()
        return jsonify(devices)
    except Exception as e:
        return jsonify({"message": "Error fetching devices", "error": str(e)}), 500

def fetch_signal_averages():
    device_id = request.args.get("device_id")
    start_date = str(request.args.get("start_date"))
    end_date = str(request.args.get("end_date"))

    if not all([device_id, start_date, end_date]):
        return jsonify({"message": "Missing required parameters"}), 400

    try:
        results = get_signal_averages(device_id, start_date, end_date)
        return jsonify(results)
    except Exception as e:
        return jsonify({"message": "Error fetching signals", "error": str(e)}), 500
