Param(
  [switch]$NoCache
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$composeFile = Join-Path $rootDir 'docker-compose.yml'
$envFile = Join-Path $scriptDir '.env'

if (-not (Test-Path $envFile)) {
  Write-Error "File $envFile non trovato. Copia docker/.env.example in docker/.env e aggiorna i valori necessari."
  exit 1
}

$argsList = @('--env-file', $envFile, '-f', $composeFile, 'build', 'backend', 'frontend', 'db')
if ($NoCache.IsPresent) {
  $argsList += '--no-cache'
}

Write-Host 'Costruzione immagini Docker (backend, frontend, db)...'
docker compose @argsList
