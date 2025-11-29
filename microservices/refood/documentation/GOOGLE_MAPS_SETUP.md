# ReFood - Configurazione Google Maps / Geocoding

Il backend usa le Google Maps Geocoding API per convertire gli indirizzi dei centri in coordinate. In sviluppo la chiave e' facoltativa, ma in staging/produzione e' obbligatoria per garantire registrazioni coerenti e per abilitare le rotte `/api/v1/geocoding/*`.

## 1. Creazione e abilitazione della chiave
1. Accedi a <https://console.cloud.google.com/> e seleziona (o crea) il progetto Google Cloud dedicato.
2. Abilita **Geocoding API** da *APIs & Services -> Library* e assicurati che la fatturazione del progetto sia attiva (Google la richiede anche per l'uso entro la quota gratuita).
3. Vai su *APIs & Services -> Credentials -> Create credentials -> API key*.
4. Imposta subito le **Application restrictions**:
   - *IP addresses*: autorizza solo gli IP pubblici della macchina o dell'infrastruttura che esegue il backend (per lo sviluppo puoi usare l'IP pubblico restituito da `https://api.ipify.org`, per ambienti cloud usa gli IP statici del NAT/load balancer).
   - *API restrictions*: limita l'uso alla sola **Geocoding API**.
5. Salva la chiave in un password manager o Vault aziendale.

## 2. Configurazione nei file `.env`
- **Backend locale**: apri `backend/.env` e imposta uno dei due parametri (il backend legge prima `GOOGLE_MAPS_API_KEY`, se mancante usa `GOOGLE_GEOCODING_API_KEY`).
  ```env
  GOOGLE_MAPS_API_KEY=chiave_google
  # oppure
  GOOGLE_GEOCODING_API_KEY=chiave_google
  ```
- **Root/Docker**: se utilizzi Docker o devi propagare la variabile agli script, duplica la chiave anche in `.env` (root) e in `docker/.env`:
  ```env
  # docker/.env
  GOOGLE_MAPS_API_KEY=chiave_google
  GOOGLE_GEOCODING_API_KEY=
  ```
  Ricostruisci l'immagine frontend/backend se la chiave viene usata in build (nel caso del backend basta riavviare il container).

Una volta aggiornata la variabile, riavvia il backend (`npm run dev`, `npm run start`, servizio Docker, ecc.). All'avvio vedrai nei log la riga `Geocoding Google configurato: API key attiva (prefix=XXXX...)`.

## 3. Verifiche applicative
1. Chiama `GET /api/v1/geocoding/info` autenticandoti come Amministratore: il campo `configured` deve essere `true`.
2. Prova `POST /api/v1/geocoding/address` con un indirizzo reale (es. `{"indirizzo":"Via Roma 1, Milano"}`) per ricevere latitudine/longitudine.
3. Registrando un nuovo centro/utente con indirizzo valido, nel log comparira' `Geocoding completato` e nel DB la tabella relativa all'attore avra' `latitudine`/`longitudine` valorizzate.
4. In caso di errori otterrai messaggi espliciti (`Servizio di geocoding non configurato`, `REQUEST_DENIED`, ecc.).

## 4. Sicurezza, quota e rotazione
- **Segreti fuori dal VCS**: non committare mai la chiave. Usa `.env` locali, secret manager o variabili ambiente del servizio.
- **Restrizioni**: limita sempre IP e API per ridurre rischi di abuso. Per ambienti dinamici (es. Kubernetes) usa un NAT con IP statico e imposta solo quello.
- **Quota**: configura i limiti giornalieri in Google Cloud (*APIs & Services -> Quotas*) per evitare costi imprevisti.
- **Rotazione**: per ruotare la chiave crea la nuova credenziale, aggiornala negli ambienti, verifica i log/endpoint, quindi revoca la vecchia.

## 5. Troubleshooting rapido
| Messaggio | Significato | Azione |
|-----------|-------------|--------|
| `REQUEST_DENIED` o `HTTP 403` | API non abilitata, chiave errata, IP non autorizzato o billing disattivato | Verifica restrizioni e che la Geocoding API sia attiva. |
| `OVER_QUERY_LIMIT` | Superata la quota giornaliera | Aumenta la quota o riduci il numero di richieste. |
| `ZERO_RESULTS` | Indirizzo non geocodificabile | Richiedi un indirizzo piu' completo o normalizzato. |
| `Google Maps API key non configurata` nei log | Nessuna chiave caricata all'avvio | Controlla `backend/.env` e riavvia il processo. |
| `HTTP 503` sulle rotte `/geocoding/*` | Servizio non configurato | Imposta la chiave e ripeti la verifica del punto 3. |

Seguendo questi passaggi mantieni il geocoding attivo e monitorabile sia in ambienti locali sia nei deployment containerizzati.
