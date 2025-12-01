from datetime import datetime, timedelta

def filter_measurements(json_data, interval_hours=2):
    result = {k: v for k, v in json_data.items() if k != "signals"}
    result["signals"] = []

    for signal in json_data["signals"]:
        measurements = signal["measurements"]
        measurements.sort(key=lambda x: datetime.fromisoformat(x["timestamp"].replace("Z", "+00:00")))

        filtered = []
        last_kept = None

        for measurement in measurements:
            ts = datetime.fromisoformat(measurement["timestamp"].replace("Z", "+00:00"))
            if last_kept is None or ts - last_kept >= timedelta(hours=interval_hours):
                filtered.append(measurement)
                last_kept = ts

        result["signals"].append({
            "name": signal["name"],
            "measurements": filtered
        })

    return result


def filter_weather(json_data):
    result = dict(json_data)

    if "weather" in result:
        weather = result["weather"]

        # Pulizia campi city
        if "city" in weather:
            for key in ["country", "population", "timezone", "sunrise", "sunset","id"]:
                weather["city"].pop(key, None)

        # Pulizia campi nei forecast
        if "list" in weather:
            for item in weather["list"]:
                for key in ["umidità", "vento"]:
                    item.pop(key, None)

    return result