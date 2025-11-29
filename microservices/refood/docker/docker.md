# ReFood – Docker Manual (pipeline chiara per Windows e Linux)

Questa guida mostra una pipeline step-by-step, con i comandi pronti sia per Windows (PowerShell) sia per Linux/macOS (Bash). Al termine trovi i dettagli manuali e note operative.

---

## 1) Preparazione e variabili

- Requisiti: Docker Engine 24+ con Docker Compose plugin.
- Consigliato: PowerShell 7+ su Windows.

| Step | Windows (PowerShell) | Linux / macOS (Bash) |
| ---  | ---                  | ---                  |
| Copia env | `Copy-Item docker/.env.example docker/.env` | `cp docker/.env.example docker/.env` |
| Modifica env | Apri `docker/.env` e imposta JWT_SECRET, DEFAULT_ADMIN_*, PGPORT, EXPO_PUBLIC_API_URL, chiavi Google | Idem |

Note: il backend parte su 3000, il DB su 55432→5432; il frontend è servito su 8080 e, nella configurazione attuale, anche su 80.

---

## 2) Build immagini

| Sistema | Comando | Note |
| --- | --- | --- |
| Windows | `.\\docker\\build-images.ps1 [-NoCache]` | Usa `docker/.env` per i build-arg |
| Linux / macOS | `bash docker/build-images.sh --no-cache` | Equivalente |
| Alternativa (entrambi) | `docker compose --env-file docker/.env build` | Build via compose dei servizi selezionati |

---

## 3) Avvio stack

| Azione | Comando (tutti i sistemi) | Risultato |
| --- | --- | --- |
| Avvia tutto | `docker compose --env-file docker/.env up -d` | Alza db, backend, frontend |
| Avvia selettivo | `docker compose --env-file docker/.env up -d db backend` | Solo alcuni servizi |
| Stato | `docker compose ps` | Vedi porte e stato |

URL utili: API Swagger http://localhost:3000/api-docs — Frontend http://localhost:8080 (oppure http://localhost se mappata la porta 80).

---

## 4) Log applicativi (live)

| Servizio | Comando |
| --- | --- |
| Backend | `docker compose --env-file docker/.env logs -f backend` |
| Frontend (Nginx) | `docker compose --env-file docker/.env logs -f frontend` |
| Tutti | `docker compose --env-file docker/.env logs -f` |

---

## 5) Stop, riavvio e reset

| Azione | Comando (tutti i sistemi) | Effetto |
| --- | --- | --- |
| Stop morbido | `docker compose --env-file docker/.env stop` | Ferma ma conserva volumi e rete |
| Down standard | `docker compose --env-file docker/.env down` | Rimuove i container |
| Down con reset dati | `docker compose --env-file docker/.env down -v` | Rimuove anche i volumi `db_data`, `backend_uploads` |
| Rebuild rapido | `docker compose --env-file docker/.env build <servizio>` | Ricostruisce immagine |
| Riavvio servizio | `docker compose --env-file docker/.env up -d <servizio>` | Riavvia solo il selezionato |

Strumento Windows (selettivo):

| Scopo | Comando |
| --- | --- |
| Cleanup + rebuild selettivo | `.\\docker\\reset-stack.ps1 -Services db,backend,frontend -NoCache -PruneAll` |
| Con reset dei volumi | `.\\docker\\reset-stack.ps1 -Services db,backend,frontend -NoCache -PruneAll -ResetData` |

---

## 6) Troubleshooting rapido

- Se il browser finisce su `http://localhost/register` senza porta e mostra "Connessione rifiutata", apri direttamente `http://localhost:8080/register` o `http://127.0.0.1:8080/register`. Nella compose attuale, è esposta anche la porta 80, quindi `http://localhost/` funziona.
- Cambi di `EXPO_PUBLIC_API_URL` o CORS richiedono rebuild del frontend/backend.

---

## Appendice A — Build manuale (alternativa a compose)

> Esegui dalla root del repo.

### Database (`refood-db`)

```bash
docker build \
  -f docker/database/Dockerfile \
  -t refood-db:latest \
  .
```

### Backend (`refood-backend`)

```bash
docker build \
  -f backend/Dockerfile \
  -t refood-backend:latest \
  ./backend
```

### Frontend (`refood-frontend`)

```bash
docker build \
  --build-arg EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 \
  -f frontend/Dockerfile \
  -t refood-frontend:latest \
  ./frontend
```

### Verifica immagini

```bash
docker images --filter reference='refood-*'
```

---

## Appendice B — Run manuale (senza compose)

### Volumi

```bash
docker volume create refood_db_data
docker volume create refood_backend_uploads
```

### Database

```bash
docker run -d \
  --name refood-db \
  --env-file docker/.env \
  -e POSTGRES_DB=${PGDATABASE:-refood} \
  -e POSTGRES_USER=${PGUSER:-postgres} \
  -e POSTGRES_PASSWORD=${PGPASSWORD:-postgres} \
  -v refood_db_data:/var/lib/postgresql/data \
  -p ${PGPORT:-5432}:5432 \
  refood-db:latest
```

### Backend

```bash
docker run -d \
  --name refood-backend \
  --env-file docker/.env \
  -e NODE_ENV=production \
  -e PGHOST=refood-db \
  -e PGPORT=5432 \
  -v refood_backend_uploads:/data/uploads \
  --link refood-db:db \
  -p ${BACKEND_PORT:-3000}:3000 \
  refood-backend:latest
```

### Frontend

```bash
docker run -d \
  --name refood-frontend \
  -p ${FRONTEND_PORT:-8080}:80 \
  refood-frontend:latest
```

### Controlli rapidi

- Swagger API: <http://localhost:3000/api-docs>
- Frontend: <http://localhost:8080>
- Stato container: `docker ps`
- Log: `docker logs -f refood-backend` (simile per gli altri).

---

## Appendice C — Suggerimenti operativi

- Cambi build-time → rifai il build del servizio interessato.
- Scheduler/WebSocket: controllabili via variabili nel `.env`.
- Uploads persistono in `/data/uploads` (volume dedicato).
- Backup DB:
  ```bash
  docker exec refood-db pg_dump -U ${PGUSER:-postgres} ${PGDATABASE:-refood} > backup.sql
  ```
---
