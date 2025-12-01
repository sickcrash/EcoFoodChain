import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from 'react-router-dom';
import ReactMarkdown from "react-markdown";
import ChatbotImg from "./public/ChatbotIcon.png";
import UserImg from "./public/UserIcon.jpg";
import { useChartsQuery, useDevicesQuery, useSignalsQuery, useWeatherQuery } from '@hooks/index';
import { SignalData, WeatherForecastModel} from '@/models';
import { getTimeAgo } from '@/utils';

export const Chatbot = (): JSX.Element => {
  const [messages, setMessages] = useState<{ text: string; sender: string }[]>([]);
  const [input, setInput] = useState<string>("");
  //const [isInputEnabled, setIsInputEnabled] = useState<boolean>(true);
  const [startDateSelection, setStartDate] = useState<string>("");
  const [endDateSelection, setEndDate] = useState<string>("");
  const [loading, setIsLoading] = useState<boolean>(false); // Stato di caricamento
  const messagesEndRef = useRef<HTMLDivElement | null>(null); // Riferimento per l'ultimo messaggio
  const [isChatReady, setIsChatReady] = useState(false);
  const [weatherForecastData, setWeatherForecastData] = useState<WeatherForecastModel>();
  

  const location = useLocation(); // Estrae dalla URL il parametro relativo alla coltura (es.se URL è /colture/pomodori, estrae "pomodori").
  const { getSignals } = useSignalsQuery(); // getCulture, estratto dal hook "useCulturesQuery" per ottenere i dati della coltura dal back end.
  const { getCharts } = useChartsQuery(); // useChartsQuery, hook per ottenere i dati per i grafici.
  const { getDevice } = useDevicesQuery()
    const { getWeatherForecast } = useWeatherQuery(); 


  const BACKEND_URL = "/api";
  const apiUrl = "/chatbot";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Esegui quando messages cambia


  // Funzione per chiamare il chatbot automatico
  const callChatbot = useCallback(async (query?: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/chatbot/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (response.ok) {
        // const data = await response.json();
        console.log("Risposta chatbot automatico");
        // setMessages(prev => [
        //   ...prev,
        //   { text: data.answer, sender: "bot" }
        // ]);
        setIsChatReady(true);
      } else {
        setMessages(prev => [
          ...prev,
          { text: "Errore nell'analisi automatica del chatbot.", sender: "bot" }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { text: "Errore di rete nella chiamata al chatbot.", sender: "bot" }
      ]);
    }
  }, []);

  const searchAll = useCallback(async (startDateInput?: Date, endDateInput?: Date) => { // Callback assicura che la funzione venga ricreata solo se cambiano le dipendenze.
    setIsLoading(true);

    const land = decodeURI(location.pathname.split('/')[3]).toLowerCase(); // Estrae il nome della coltura dalla URL.

    const { data: signals } = await getSignals(land); // Ottiene i segnali relativi alla coltura.

    if (!signals || signals.length === 0) {
      setIsLoading(false);
      return;
    }

    const { data: device } = await getDevice(land);

    if (!device) {
      setIsLoading(false);
      return;
    }

    const endDate = endDateInput ?? new Date();
    const startDate = startDateInput ?? new Date();
    if (!startDateInput) startDate.setMonth(startDate.getMonth() - 1);
    const start = startDate.toString();
    const end = endDate.toString();

    const chartsMap = new Map<string, SignalData[]>();
    // Utilizza un Map per memorizzare i dati dei grafici, dove la chiave è l'ID del segnale e il valore è un array di SignalData.
    signals.forEach(signal => {
      chartsMap.set(signal._id, []); // Inizializza l'array per ogni segnale.
    });

    const chartsPromises = signals.map(async signal => {
      const { data } = await getCharts({
        startDate: start,
        endDate: end,
        granularity: 'a',
        signals: [signal._id]
      });

      if (!data) {
        return;
      }

      const chartData = data[signal._id] as SignalData[]; // Ottiene i dati del grafico per il segnale corrente.
      chartsMap.set(signal._id, chartData); // Aggiunge i dati del grafico alla mappa.
    });

    await Promise.all(chartsPromises); // Attende che tutte le promesse siano risolte.

    if (!chartsMap.size) {
      setIsLoading(false);
      return;
    }


    const { data: forecast } = await getWeatherForecast({
      lat: device.location.coordinates[1],
      long: device.location.coordinates[0],
      cnt: 52
    });

    setWeatherForecastData(forecast);

    await fetch(`${BACKEND_URL}/save_weather_forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forecast: forecast }),
    });
    
    const initPrompt = startDateInput ? "Perfetto! 📊 Ho elaborato i dati dei tuoi sensori per il periodo che hai selezionato. Con questi dati posso aiutarti a programmare meglio l’irrigazione e a tenere sotto controllo l’andamento del tuo lavoro agricolo. Puoi chiedermi quando conviene irrigare o come stanno reagendo le colture nel periodo scelto." : "Ciao! 🌱 Ho analizzato i dati dei tuoi sensori degli ultimi 3 mesi per darti indicazioni su quando irrigare e come stanno andando le colture. Se vuoi, puoi selezionare un periodo diverso usando il selettore di date qui sopra e poi premere Inizia per vedere le analisi personalizzate. Se vuoi chiedermi informazioni sui dati dei sensori degli ultimi 3 mesi fai pure una domanda, oppure seleziona un periodo che preferisci."

    // Messaggio automatico in chat
    setMessages(prev => [
      ...prev,
      {
        text: initPrompt,
        sender: "bot"
      }
    ]);

    const response = await fetch(`${BACKEND_URL}/save_culture_data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: land,
        signals: signals
          .map(signal => {
            const chartData = chartsMap.get(signal._id); 

            if (!chartData || chartData.length === 0) {
              return null;
            }

            return {
              name: signal.description,
              measurements: chartData.map(cd => ({
                value: cd.value.toFixed(2),
                unit: signal.unit_readable,
                timestamp: cd.last_conn,
                lastConnection: getTimeAgo(cd.last_conn),
              })),
            };
          })
          .filter(signal => signal !== null),
          weather: weatherForecastData? weatherForecastData : forecast,
      }), 
    });

    if (!response.ok) {
      console.error('Errore nella richiesta:', response.statusText);
    } else {
      const result = await response.json();
      console.log('Risposta dal backend:', result);
    }

    // Chiamata automatica al chatbot dopo il salvataggio
    await callChatbot(initPrompt);
    setIsLoading(false);
  }, [getCharts, getDevice, getSignals, location.pathname, callChatbot]);


  useEffect(() => {
    const now = new Date();
    const end = now.toISOString().slice(0, 16); // formato valido per datetime-local
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const start = startDate.toISOString().slice(0, 16);

    setStartDate(start);
    setEndDate(end);

      const welcomeMessage = `
Ciao! 👋  
Sono il tuo assistente virtuale per l’agricoltura. 🌱  

Posso aiutarti a capire quando irrigare, monitorare l’andamento delle colture, analizzare i dati dei tuoi sensori e tanto altro. 

---

### 👉 Come iniziare
Seleziona l’intervallo di date che vuoi analizzare usando il selettore qui sopra e premi **Inizia**.  

---

ℹ️ **Nota importante**  
Il chatbot può commettere errori: le informazioni che ti fornisco hanno valore puramente indicativo e devono sempre essere verificate con uno specialista.  

`;

    setMessages(prev => [
      ...prev,
      {
        text: welcomeMessage,
        sender: "bot"
      }
    ]);
    //searchAll();
  }, []); 


  const sendMessage = async () => {
    if (!input.trim()) return; //controllo riempimento input

    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true); // Mostra il loader

    try {
      const response = await fetch(`${BACKEND_URL}/chatbot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { text: data.answer, sender: "bot" }]);

    } catch (error) {
      console.error("Errore:", error);
      setMessages((prev) => [...prev, { text: "Errore nella richiesta.", sender: "bot" }]);
    }

    setIsLoading(false); // Nasconde il loader
    setInput(""); // Resetta l'input dopo l'invio
  };

  const sendPeriod = async () => {
    if (!startDateSelection || !endDateSelection) {
    setMessages(prev => [...prev, { text: "Seleziona entrambe le date!", sender: "bot" }]);
    return;
    }
    
    const start = new Date(startDateSelection);
    const end = new Date(endDateSelection);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setMessages(prev => [...prev, { text: "Formato data non valido.", sender: "bot" }]);
      return;
    }
    if (start >= end) {
      setMessages(prev => [...prev, { text: "La data di inizio deve essere precedente a quella di fine.", sender: "bot" }]);
      return;
    }
    const delta = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24); // giorni
    if (delta > 100) {
      setMessages(prev => [...prev, { text: "L'intervallo di date non può superare 100 giorni.", sender: "bot" }]);
      return;
    }
    searchAll(start, end);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <h1 className="text-xl font-semibold capitalize pb-5">
          {decodeURI(location.pathname.split('/')[3])}
        </h1>
      {/* Area messaggi */}
      <div className="flex-grow overflow-auto p-4 bg-background">
        {/* Sezione periodo */}
        {apiUrl.includes("chatbot") && (
          <div className="p-4 pt-0 bg-card flex flex-col gap-2">
            <p className="font-bold">Inserire il periodo (prima di iniziare)</p>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <p>Inizio periodo:</p>
                <input
                  type="datetime-local"
                  className="border border-border rounded-md px-3 py-2 bg-input text-foreground focus:outline-none"
                  value={startDateSelection}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <p>Fine periodo:</p>
                <input
                  type="datetime-local"
                  className="border border-border rounded-md px-3 py-2 bg-input text-foreground focus:outline-none"
                  value={endDateSelection}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <button
                onClick={sendPeriod}
                className="ml-2 bg-primary text-primary-foreground px-4 py-2 rounded-md"
              >
                Inizia
              </button>
            </div>
          </div>)}

        {/* Sezione messaggi */}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-end mb-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {/* Mostra l'immagine del chatbot o dell'utente */}
            {msg.sender !== "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary mr-2 overflow-hidden">
                <img src={ChatbotImg} alt="Icona chatbot" className="w-full h-full object-cover rounded-full clip-path-circle" />
              </div>
            )}

            {/* Messaggio */}
          <div className={`p-3 max-w-xs md:max-w-sm lg:max-w-md rounded-lg shadow-md
              ${msg.sender === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
              }`}
          >
            <ReactMarkdown>{msg.text}</ReactMarkdown>
          </div>

            {/* Icona utente a destra */}
            {msg.sender === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary ml-2">
                <img src={UserImg} alt="Icona utente" className="w-full h-full object-cover rounded-full clip-path-circle" />
              </div>
            )}
          </div>
        ))}

        {/* Loader in attesa della risposta del bot */}
        {loading && (
          <div className="flex items-center justify-start mb-4">
            <div className="w-8 h-8 rounded-full bg-secondary mr-2">
              <img src={ChatbotImg} alt="Icona chatbot" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="p-3 max-w-xs md:max-w-sm lg:max-w-md rounded-lg shadow-md bg-secondary text-secondary-foreground">
              <div className="w-6 h-6 border-4 border-t-primary border-gray-300 rounded-full animate-spin"></div>
            </div>
          </div>
        )}

        {/* Elemento nascosto per lo scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Sezione input messaggi */}
      <div className="p-4 bg-card shadow-md flex items-center">
        <input
          type="text"
          className="flex-1 border border-border rounded-md px-3 py-2 bg-input text-foreground focus:outline-none"
          placeholder="Scrivi un messaggio..."
          value={input}
          disabled={!isChatReady || loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          // disabled={!isInputEnabled}
        />
        <button
          onClick={sendMessage}
          className="ml-2 bg-primary text-primary-foreground px-4 py-2 rounded-md"
          disabled={!isChatReady || loading}
        >
          Invia
        </button>
      </div>
    </div>

  );
};
