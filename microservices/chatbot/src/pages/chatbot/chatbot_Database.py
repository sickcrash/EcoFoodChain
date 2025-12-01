###
###CHATBOT DATABASE CODE FOR CLIENTS###
### pip google-generativeai
###

import google.generativeai as genai
import json


GOOGLE_API_KEY = "AIzaSyDmxRWG3vCK-AmRbNrKBtBqO_307eDlmVM"
if not GOOGLE_API_KEY:
    raise ValueError("Devi impostare la variabile d'ambiente GOOGLE_API_KEY con la tua chiave.")

genai.configure(api_key=GOOGLE_API_KEY)


generator = None

# Class for creating the chat
class GeminiGenerator:
    def __init__(self, context, model_name):
        # Initialize the Gemini model
        self.model = genai.GenerativeModel(model_name)
        system_prompt = {
            "role": "user",
            "parts": "Sei un assistente digitale intelligente specializzato in agricoltura di precisione. Hai accesso ai dati ambientali raccolti dai sensori sul campo (es. temperatura dellaria , umidità del suolo , radiazione solare , ecc.).   Questi dati sono disponibili per periodi specifici scelti dallutente.  Il tuo obiettivo è:  1. Spiegare in modo semplice i dati provenienti dai sensori.  2. Rispondere a domande specifiche su un’azienda o un sensore.  3. Fornire l’elenco dei sensori disponibili su richiesta.  4. Dare suggerimenti pratici e affidabili per aiutare l’utente a prendere decisioni informate (es. quando irrigare, possibili anomalie, trend rilevanti).  5. Quando possibile usa il campo should_irrigate per consigliare all'utente quanto irrigare . Regole di comportamento:   Se la domanda è generica o poco chiara,  Se il dato non è disponibile o la domanda non ha senso, spiega il problema in modo educato e semplice, Rispondi in maniera riassuntiva quando è possibile. "
        }
        context2 = {
            "role": "user",
            "parts": [{"text": context}]
        }
        # Independent chats
        self.chat = self.model.start_chat(history=[system_prompt, context2])  # Add the required database information as history
        print(f"Using Gemini model: {model_name}")

    def chat_answer(self, query):

        # Get response from Gemini
        response_one = self.chat.send_message(query)

        return response_one.text
    
    generator = None  # Parte come None, lo inizializziamo solo dopo la scelta periodo

def init_generator(context):
    global generator
    generator = GeminiGenerator(context=context, model_name="gemini-2.5-flash-lite")
    return generator


# def get_valid_date_range(start_date_str, end_date_str):
#     start_date = datetime.strptime(start_date_str, "%Y-%m-%d %H:%M:%S")
#     end_date = datetime.strptime(end_date_str, "%Y-%m-%d %H:%M:%S")

#     # Check that end date is after start date
#     if end_date <= start_date:
#         raise ValueError("La data e l'ora di fine deve essere successiva alla data di inizio!")

#     # Calculate difference in days
#     delta = end_date - start_date

#     # Check if difference is more than 31 days (approximately one month)
#     if delta.days > 100:
#         raise ValueError("L'intervallo di date non può superare 100 giorni!")

#     return start_date, end_date

# def convert_to_iso8601(date_str):

#     # Convert date format
#     return date_str.strftime("%Y-%m-%dT%H:%M:%S.000Z")





