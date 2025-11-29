Param(
  [string]$PgHost = $env:PGHOST, 
  [string]$PgPort = $env:PGPORT, 
  [string]$PgDb   = $env:PGDATABASE, 
  [string]$PgUser = $env:PGUSER, 
  [string]$PgPwd  = $env:PGPASSWORD
)

$ErrorActionPreference = 'Stop'

function Log($msg) { Write-Host $msg }
function Fail($msg) { Write-Error $msg; exit 1 }

try {
  Log '===================================';
  Log 'Setup Refood (PostgreSQL, PowerShell)';
  Log '===================================';

  # 1) Prerequisiti
  $node = (Get-Command node -ErrorAction SilentlyContinue)
  $npm  = (Get-Command npm -ErrorAction SilentlyContinue)
  if (-not $node) { Fail 'Node.js non trovato. Installa da https://nodejs.org/' }
  if (-not $npm)  { Fail 'npm non trovato. Reinstalla Node.js.' }
  Log "Node: $(node -v)"
  Log "npm:  $(npm -v)"

  # 2) Variabili DB con default
  if (-not $PgHost) { $PgHost = 'localhost' }
  if (-not $PgPort) { $PgPort = '5432' }
  if (-not $PgDb)   { $PgDb   = 'refood' }
  if (-not $PgUser) { $PgUser = 'postgres' }
  if ($null -eq $PgPwd) { $PgPwd = '' }

  Log "Config DB: host=$PgHost port=$PgPort db=$PgDb user=$PgUser"

  # 3) Installa dipendenze backend
  Push-Location 'backend'
  if (Test-Path 'package-lock.json') {
    Log '[1/4] npm ci...'
    try {
      npm ci --no-audit --no-fund --progress=false --loglevel=warn | Write-Host
    } catch {
      Write-Warning 'npm ci fallita (possibile EPERM su sharp/libvips). Provo cleanup e reinstall.'
      try {
        if (Test-Path 'node_modules') { Remove-Item -Recurse -Force 'node_modules' }
      } catch { Write-Warning "Cleanup node_modules fallito: $($_.Exception.Message)" }
      Start-Sleep -Seconds 2
      try {
        npm install --no-optional --no-audit --no-fund --progress=false --loglevel=warn | Write-Host
      } catch {
        Write-Warning 'npm install fallback fallita. Verifica antivirus/permessi e riprova come Administrator.'
        throw
      }
    }
  } else {
    Log '[1/4] npm install...'
    npm install --no-audit --no-fund --progress=false --loglevel=warn | Write-Host
  }

  # 4) backend/.env
  Log '[2/4] Scrittura backend/.env...'
  # Preserva GOOGLE_MAPS_API_KEY / GOOGLE_GEOCODING_API_KEY se già presenti o usa variabile di ambiente o root .env
  $existingGoogleKey = ''
  $existingGoogleKey2 = ''
  # Siamo dentro 'backend', quindi il file corrente è .\ .env
  if (Test-Path '.\\.env') {
    try {
      $line = (Get-Content '.\\.env' | Where-Object { $_ -match '^GOOGLE_MAPS_API_KEY=' } | Select-Object -First 1)
      if ($line) { $existingGoogleKey = $line.Substring('GOOGLE_MAPS_API_KEY='.Length) }
      $line2 = (Get-Content '.\\.env' | Where-Object { $_ -match '^GOOGLE_GEOCODING_API_KEY=' } | Select-Object -First 1)
      if ($line2) { $existingGoogleKey2 = $line2.Substring('GOOGLE_GEOCODING_API_KEY='.Length) }
    } catch { }
  }
  # Prova anche a leggere da root .env (..\\.env)
  if (-not $existingGoogleKey -and (Test-Path '..\\.env')) {
    try {
      $lineRoot = (Get-Content '..\\.env' | Where-Object { $_ -match '^GOOGLE_MAPS_API_KEY=' } | Select-Object -First 1)
      if ($lineRoot) { $existingGoogleKey = $lineRoot.Substring('GOOGLE_MAPS_API_KEY='.Length) }
      $lineRoot2 = (Get-Content '..\\.env' | Where-Object { $_ -match '^GOOGLE_GEOCODING_API_KEY=' } | Select-Object -First 1)
      if ($lineRoot2) { $existingGoogleKey2 = $lineRoot2.Substring('GOOGLE_GEOCODING_API_KEY='.Length) }
    } catch { }
  }
  if (-not $existingGoogleKey) { $existingGoogleKey = $env:GOOGLE_MAPS_API_KEY }
  if (-not $existingGoogleKey2) { $existingGoogleKey2 = $env:GOOGLE_GEOCODING_API_KEY }
  if (-not $existingGoogleKey2) { $existingGoogleKey2 = $existingGoogleKey }
  @(
    'PORT=3000'
    'NODE_ENV=development'
    "PGHOST=$PgHost"
    "PGPORT=$PgPort"
    "PGDATABASE=$PgDb"
    "PGUSER=$PgUser"
    "PGPASSWORD=$PgPwd"
    'PGPOOL_MAX=10'
    'PGPOOL_IDLE=30000'
    'JWT_SECRET=refood_secure_key_auto_generated'
    'ACCESS_TOKEN_EXPIRATION=2h'
    'REFRESH_TOKEN_EXPIRATION=7d'
    'CORS_ORIGIN=*'
    'LOG_LEVEL=info'
    'API_PREFIX=/api/v1'
    'SEGNALAZIONI_CLEANUP_CRON=0 3 * * *'
    'SEGNALAZIONI_RETENTION_DAYS=7'
    "GOOGLE_MAPS_API_KEY=$existingGoogleKey"
    "GOOGLE_GEOCODING_API_KEY=$existingGoogleKey2"
  ) | Set-Content -Encoding ascii '.env'

  # 5) Crea DB se mancante + schema
  Log '[3/4] Creazione DB se mancante...'
  $env:PGHOST = $PgHost
  $env:PGPORT = $PgPort
  $env:PGDATABASE = $PgDb
  $env:PGUSER = $PgUser
  $env:PGPASSWORD = $PgPwd

  try { node .\src\scripts\pg_create_db_if_missing.js } catch { }
  Log "pg_create_db_if_missing exit=$LASTEXITCODE"

  Log '[4/4] Applicazione schema completo...'
  try { node .\src\scripts\pg_init_full.js } catch { }
  if ($LASTEXITCODE -ne 0) { Fail 'Inizializzazione schema fallita.' }

  Pop-Location

  # 6) .env root per frontend (imposta anche variabili DB)
  # Determina l'IP locale primario (IPv4) per accesso da altri device; fallback a 127.0.0.1
  $ipObj = (
    [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and $_.IPAddressToString -ne '127.0.0.1' } |
      Select-Object -First 1
  )
  $ip = if ($ipObj) { $ipObj.IPAddressToString } else { '' }
  if ([string]::IsNullOrWhiteSpace($ip)) { $ip = '127.0.0.1' }
  $apiUrl = "http://$ip:3000/api/v1"
  # Hard fallback in case of empty IP rendering (edge cases)
  if ($apiUrl -match '^http:\/\/\/') { $apiUrl = 'http://127.0.0.1:3000/api/v1' }

  # Scrive .env alla radice in modo deterministico
  @(
    "PGHOST=$PgHost"
    "PGPORT=$PgPort"
    "PGDATABASE=$PgDb"
    "PGUSER=$PgUser"
    "PGPASSWORD=$PgPwd"
    "API_URL=$apiUrl"
    "TEST_API_BASE_URL=http://localhost:3000/api/v1"
  ) | Set-Content -Encoding ascii '.env'
  Log "Creato .env root con API_URL=$apiUrl e credenziali DB"

  Log '=================================== '
  Log 'Setup completato con successo.'
  Log 'Avvio backend: cd backend && npm run dev'
  exit 0

} catch {
  Fail ("Errore: $($_.Exception.Message)")
}
