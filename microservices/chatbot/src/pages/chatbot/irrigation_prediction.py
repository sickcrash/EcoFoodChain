import json
from datetime import datetime, timedelta
from collections import defaultdict
import re

IRRIGATION_THRESHOLD = -75  # cbar
BASE_DECREASE = -8  # cbar/day without rain, average conditions

def calculate_daily_decrease(temp, rainfall):
    """
    Calculate daily decrease of water potential.
    - faster decrease with high temperatures
    - slower or zero if it rains
    """
    decrease = BASE_DECREASE

    if temp > 30:
        decrease -= 3
    elif temp < 15:
        decrease += 3

    if rainfall > 0:
        decrease = max(decrease + rainfall, 0)

    return decrease

def aggregate_weather(forecast_list):
    """
    Aggregate multiple observations per day.
    Returns a list of dicts: {"day": "YYYY-MM-DD", "avg_temp": x, "rainfall": y}
    """
    daily_data = defaultdict(lambda: {"temps": [], "rainfall": 0})

    for item in forecast_list:
        date_obj = datetime.strptime(item["date"].split(" - ")[0], "%d/%m/%Y")
        day = date_obj.strftime("%Y-%m-%d")

        # temperature
        daily_data[day]["temps"].append(item["temperatura"])

        # estimate rainfall
        if "pioggia" in item["weatherDescription"].lower():
            daily_data[day]["rainfall"] += 2  # estimated mm per observation

    # create final list
    day_list = []
    for day, values in daily_data.items():
        avg_temp = sum(values["temps"]) / len(values["temps"])
        day_list.append({
            "day": day,
            "avg_temp": avg_temp,
            "rainfall": values["rainfall"]
        })

    day_list.sort(key=lambda x: x["day"])
    return day_list

def get_latest_water_potential(water_json, pattern=r"Potenziale idrico"):
    """
    Extract the latest water potential value from the signals list.
    """
    for signal in water_json.get("signals", []):
        name = signal.get("name", "")
        print(re.search(pattern, name))
        if re.search(pattern, name):
            measurements = signal.get("measurements", [])
            if measurements:
                latest = measurements[-1]
                return float(latest["value"])
    return None

def irrigation_forecast(water_json, weather_json, output_file):
    water_potential = get_latest_water_potential(water_json)
    forecast_list = weather_json["forecast"]["list"]
    daily_weather = aggregate_weather(forecast_list)[:10]

    if water_potential is None:
        # Write empty forecast file
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump({}, f, indent=4, ensure_ascii=False)
        return {}

    results = []
    for day in daily_weather:
        decrease = calculate_daily_decrease(day["avg_temp"], day["rainfall"])
        water_potential += decrease

        if water_potential > 0:
            water_potential = 0  # cannot be positive

        results.append({
            "day": day["day"],
            "should_irrigate": water_potential <= IRRIGATION_THRESHOLD
        })

    irrigation_day = next((d for d in results if d["should_irrigate"]), None)

    forecast_output = {
        "initial_water_potential": water_potential,
        "days": results,
        "irrigation_day": irrigation_day["day"] if irrigation_day else None
    }

    # Save automatically
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(forecast_output, f, indent=4, ensure_ascii=False)

    return forecast_output

# if __name__ == "__main__":
#     BASE_DIR = os.path.dirname(__file__)
#     culture_data_filtered = os.path.join(BASE_DIR, "culture_data_filtered.json")
#     with open(culture_data_filtered, "r", encoding="utf-8") as f:
#         water_data = json.load(f)
#     weather_forecast = os.path.join(BASE_DIR, "weather_forecast.json")
#     with open(weather_forecast, "r", encoding="utf-8") as f:
#         weather_data = json.load(f)

#     forecast_results = irrigation_forecast(water_data, weather_data, "irrigation_output.json")

#     with open("irrigation_output.json", "w", encoding="utf-8") as f:
#         json.dump(forecast_results, f, indent=4, ensure_ascii=False)

#     print("'irrigation_output.json' created with results.")
