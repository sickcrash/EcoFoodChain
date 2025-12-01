import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
import chatbot_Database as chatbot
import json
from chatbot_filtering import filter_measurements, filter_weather
import os
from irrigation_prediction import irrigation_forecast

# Configura la API Key di Gemini
GOOGLE_API_KEY = "AIzaSyDmxRWG3vCK-AmRbNrKBtBqO_307eDlmVM" 
genai.configure(api_key=GOOGLE_API_KEY)

app = Flask(__name__)
CORS(app) #resources={r"/*": {"origins": "*"}}

BASE_DIR = os.path.dirname(__file__)
temp_file_path = os.path.join(BASE_DIR, "temp")
os.makedirs(temp_file_path, exist_ok=True)

@app.route("/save_culture_data", methods=["POST"])
def save_culture_data():
    try:
        data = request.get_json()

        culture_data_path = os.path.join(temp_file_path, "culture_data.json")
        with open(culture_data_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        #filtering the data to reduce the number of measurements
        culture_data_filtered_path = os.path.join(temp_file_path, "culture_data_filtered.json")
        filtered_data = filter_measurements(data, interval_hours=6)
        filtered_data2 = filter_weather(filtered_data)  
        with open(culture_data_filtered_path, "w", encoding="utf-8") as f:
            json.dump(filtered_data2, f, indent=4, ensure_ascii=False)
            
        return jsonify({"message": "Dati salvati correttamente!"}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@app.route("/save_weather_forecast", methods=["POST"])
def save_weather_forecast():
    try:
        data = request.get_json()
        weather_forecast_path = os.path.join(temp_file_path, "weather_forecast.json")
        with open(weather_forecast_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        return jsonify({"message": "Dati meteo salvati correttamente!"}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/chatbot/init", methods=["POST"])
def chatbot_init():
    try:
        irrigation_forecast_path = os.path.join(temp_file_path, "irrigation_forecast.json")
        culture_data_filtered_path = os.path.join(temp_file_path, "culture_data_filtered.json")
        weather_forecast_path = os.path.join(temp_file_path, "weather_forecast.json")

        with open(culture_data_filtered_path, "r", encoding="utf-8") as f:
            culture_data = json.load(f)

        with open(weather_forecast_path, "r", encoding="utf-8") as f:
            weather_data = json.load(f)

        irrigation_forecast(culture_data, weather_data, irrigation_forecast_path)


        with open(irrigation_forecast_path, "r", encoding="utf-8") as f:
            irrigation_data = json.load(f)

        merged_data = dict(culture_data)
        merged_data["irrigation_forecast"] = irrigation_data

        merged_data_path = os.path.join(temp_file_path, "merged_data.json")
        with open(merged_data_path, "w", encoding="utf-8") as f:
            json.dump(merged_data, f, indent=4, ensure_ascii=False)

        context = json.dumps(merged_data, ensure_ascii=False, indent=2)

        chatbot.init_generator(context)
        return jsonify({"message": "Nuovo chatbot inizializzato!"}), 200
    except Exception as e:
        print("Errore in chatbot:", e) 
        return jsonify({"error": str(e)}), 500

@app.route("/chatbot/chat", methods=["POST"])
def chatbot_conversation():
    if chatbot.generator is None:
        return jsonify({"answer": "Devi prima inizializzare la chat con /chatbot/init"}), 400
    
    data = request.get_json()
    query = data.get("query", "")
    print("Query ricevuta:", query) 
    if not query:
        return jsonify({"error": "Nessuna domanda ricevuta"}), 400

    try:
        answer = chatbot.generator.chat_answer(query)
        return jsonify({"answer": answer})
    except Exception as e:
        print("Errore in chatbot:", e) 
        return jsonify({"error": str(e)}), 500

# if __name__ == "__main__":
#     app.run(debug=True)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)