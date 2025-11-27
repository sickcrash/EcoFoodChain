import requests
from flask import current_app

from ..utils.http_client import http_get, http_post

def databoom_login():
    """Effettua il login su Databoom e restituisce il JWT."""

    api_base = current_app.config['DATABOOM_API_BASE']
    username = current_app.config['DATABOOM_USERNAME']
    password = current_app.config['DATABOOM_PASSWORD']

    try:
        resp = http_post(f"{api_base}/auth/signin", json={"username": username, "password": password})
        resp.raise_for_status()  # solleva un HTTPError se status_code != 200
    except Exception as e:
        raise Exception(f"Databoom login failed: {e}")

    jwt = resp.json().get('jwt')
    if not jwt:
        raise Exception("Databoom login failed: no JWT token received")

    return jwt


def get_devices():
    """Recupera tutti i device da Databoom."""
    api_base = current_app.config['DATABOOM_API_BASE']
    jwt_token = databoom_login()

    try:
        resp = http_get(f"{api_base}/devices/all", headers={"Authorization": f"Bearer {jwt_token}"})
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise Exception(f"Failed to fetch devices: {e}")


def get_signal_averages(device_id, start_date, end_date):
    """Recupera i segnali del device e calcola il valore medio."""
    api_base = current_app.config['DATABOOM_API_BASE']
    jwt = databoom_login()
    headers = {"Authorization": f"Bearer {jwt}"}

    # --- Recupero info device ---
    try:
        device_resp = http_get(f"{api_base}/devices/{device_id}", headers=headers)
        device_resp.raise_for_status()
    except Exception as e:
        raise Exception(f"Failed to fetch device info: {e}")

    device_data = device_resp.json()
    signals = device_data.get("signals", [])

    results = []

    for signal in signals:
        signal_info = requests.get(f"{api_base}/signals/{signal}", headers=headers)
        signal_name = signal_info.json().get("description", "Unnamed")
        if signal_name == "Unnamed":
            continue

        # --- Recupero dati chart per il segnale ---
        try:
            chart_resp = requests.post(
                f"{api_base}/chart",
                headers=headers,
                json={
                    "startDate": start_date,
                    "endDate": end_date,
                    "granularity": "a",
                    "signals": [signal]
                }
            )
            chart_resp.raise_for_status()
        except Exception:
            continue

        chart_data = chart_resp.json().get(signal, [])
        values = [entry["value"] for entry in chart_data if "value" in entry]
        if not values:
            continue

        avg_value = round(sum(values) / len(values), 2)
        results.append({
            "signal_id": signal,
            "signal_name": signal_name,
            "average": avg_value
        })

    return results