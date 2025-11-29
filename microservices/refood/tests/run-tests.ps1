$ErrorActionPreference = 'Stop'

Write-Host "ReFood - Test Runner (unit + integration + performance)" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$backendDir = Join-Path $repoRoot 'backend'
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outDir = Join-Path $scriptDir "results\$timestamp"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Get-PlainTextFromSecureString {
  param([securestring]$SecureValue)
  if (-not $SecureValue) { return '' }
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

Write-Host ''
Write-Host 'Credenziali utente di test (richieste per login automatici)' -ForegroundColor Yellow

if ($env:TEST_USER_EMAIL -and $env:TEST_USER_PASSWORD) {
  Write-Host "Credenziali gia' presenti in variabile d'ambiente. Premi Invio per confermare o digita nuovi valori." -ForegroundColor DarkYellow
}

$testUserEmail = $null
while ([string]::IsNullOrWhiteSpace($testUserEmail)) {
  $defaultEmail = if ($env:TEST_USER_EMAIL) { " [default: $($env:TEST_USER_EMAIL)]" } else { '' }
  $inputEmail = Read-Host ("Email utente di test" + $defaultEmail)
  if ([string]::IsNullOrWhiteSpace($inputEmail)) {
    if ($env:TEST_USER_EMAIL) {
      $testUserEmail = $env:TEST_USER_EMAIL
    } else {
      Write-Host "L'email non puo' essere vuota." -ForegroundColor Red
    }
  } else {
    $testUserEmail = $inputEmail.Trim()
  }
}

$testUserPassword = $null
while ([string]::IsNullOrWhiteSpace($testUserPassword)) {
  if ($env:TEST_USER_PASSWORD) {
    Write-Host 'Lascia vuoto per riutilizzare la password impostata in questa sessione.' -ForegroundColor DarkYellow
  }
  $securePassword = Read-Host 'Password utente di test' -AsSecureString
  if (!$securePassword -and $env:TEST_USER_PASSWORD) {
    $testUserPassword = $env:TEST_USER_PASSWORD
    break
  }
  if (!$securePassword) {
    Write-Host "La password non puo' essere vuota." -ForegroundColor Red
    continue
  }
  $plainPassword = Get-PlainTextFromSecureString -SecureValue $securePassword
  if ([string]::IsNullOrWhiteSpace($plainPassword)) {
    Write-Host "La password non puo' essere vuota." -ForegroundColor Red
  } else {
    $testUserPassword = $plainPassword
  }
}

$env:TEST_USER_EMAIL = $testUserEmail
$env:TEST_USER_PASSWORD = $testUserPassword
$env:USERNAME = $testUserEmail
$env:PASSWORD = $testUserPassword
$env:K6_EMAIL = $testUserEmail
$env:K6_PASSWORD = $testUserPassword

# 0) Assicurati che il backend target dei test sia raggiungibile
#    Se TEST_API_BASE_URL non risponde, avvia provvisoriamente il backend locale (node src/server.js)
$origBaseUrl = $env:TEST_API_BASE_URL
$baseUrl = if ($env:TEST_API_BASE_URL -and $env:TEST_API_BASE_URL.Trim()) { $env:TEST_API_BASE_URL } else { 'http://localhost:3000/api/v1' }
$healthUrl = ($baseUrl.TrimEnd('/')) + '/health-check'
$startedBackend = $false
$backendProc = $null

Write-Host "[0/3] Verifico disponibilita backend test su $healthUrl..." -ForegroundColor Yellow
function Test-HttpOk {
  param([string]$Url,[int]$TimeoutSec = 3)
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400)
  } catch { return $false }
}

if (-not (Test-HttpOk -Url $healthUrl -TimeoutSec 3)) {
  Write-Host "Backend non raggiungibile: avvio node src/server.js in background per i test..." -ForegroundColor DarkYellow
  try {
    # Forza fallback su backend locale in ascolto su 3000 per i test
    $localBase = 'http://localhost:3000/api/v1'
    $env:TEST_API_BASE_URL = $localBase
    $baseUrl = $localBase
    $healthUrl = ($localBase.TrimEnd('/')) + '/health-check'
    $backendProc = Start-Process -FilePath node -ArgumentList 'src/server.js' -WorkingDirectory $backendDir -PassThru -WindowStyle Hidden
    # Attendi che si alzi
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
      if (Test-HttpOk -Url $healthUrl -TimeoutSec 2) { break }
      Start-Sleep -Seconds 1
    }
    if (-not (Test-HttpOk -Url $healthUrl -TimeoutSec 2)) {
      Write-Warning "Impossibile raggiungere $healthUrl anche dopo l'avvio locale. I test di integrazione potrebbero fallire."
    } else {
      $startedBackend = $true
      Write-Host "Backend locale avviato per i test. PID=$($backendProc.Id)" -ForegroundColor Green
    }
  } catch {
    Write-Warning "Avvio backend locale fallito: $($_.Exception.Message)"
  }
} else {
  Write-Host "Backend raggiungibile: proseguo con i test." -ForegroundColor Green
}

# 1) Jest unit+integration (con coverage HTML)
Write-Host "[1/3] Eseguo unit+integration tests (Jest) con coverage..." -ForegroundColor Yellow
$jestLog = Join-Path $outDir 'jest-output.txt'
try {
  $env:CI = 'true'
  & npm --prefix "$backendDir" test -- --coverage --coverageReporters=html,text-summary 2>&1 | Tee-Object -FilePath $jestLog | Out-Null
} catch {
  Write-Warning "Jest ha restituito un errore. Vedi $jestLog"
}

# Chiudi il backend locale avviato dal runner (se avviato qui)
if ($startedBackend -and $backendProc -and $backendProc.Id) {
  try {
    Stop-Process -Id $backendProc.Id -Force -ErrorAction Stop
    Write-Host "Backend di test arrestato (PID=$($backendProc.Id))" -ForegroundColor DarkYellow
  } catch {
    Write-Warning "Impossibile arrestare il backend di test: $($_.Exception.Message)"
  }
}

# Ripristina TEST_API_BASE_URL originale se era impostato
if ($origBaseUrl) { $env:TEST_API_BASE_URL = $origBaseUrl } else { Remove-Item Env:TEST_API_BASE_URL -ErrorAction SilentlyContinue }

# Copia la coverage HTML se presente
$coverageSrc = Join-Path $backendDir 'coverage'
if (Test-Path (Join-Path $coverageSrc 'index.html')) {
  $coverageDst = Join-Path $outDir 'coverage'
  Copy-Item -Recurse -Force -Path $coverageSrc -Destination $coverageDst
}

# 2) Performance (k6) opzionali
Write-Host "[2/3] Eseguo performance tests (k6) se disponibile..." -ForegroundColor Yellow
$k6 = Get-Command k6 -ErrorAction SilentlyContinue
$perfOutDir = Join-Path $outDir 'performance'
New-Item -ItemType Directory -Force -Path $perfOutDir | Out-Null

$monitorProcess = $env:RESOURCE_MONITOR_PROCESS
$monitorPidEnv = $env:RESOURCE_MONITOR_PID
$monitorScriptPath = Join-Path $repoRoot 'tests\performance\cpu-ram.test.ps1'
$monitorArgs = $null
$monitorProcessHandle = $null
$monitorOutput = $null
if ((-not [string]::IsNullOrWhiteSpace($monitorProcess)) -or (-not [string]::IsNullOrWhiteSpace($monitorPidEnv))) {
  if (Test-Path $monitorScriptPath) {
    $monitorLabel = if ($env:RESOURCE_MONITOR_LABEL -and $env:RESOURCE_MONITOR_LABEL.Trim()) { $env:RESOURCE_MONITOR_LABEL } else { 'monitor' }
    $monitorOutput = Join-Path $perfOutDir ("cpu-ram-$monitorLabel.json")
    $monitorArgs = @('-NoLogo','-NoProfile','-File', $monitorScriptPath, '-Label', $monitorLabel, '-OutputPath', $monitorOutput)
    if (-not [string]::IsNullOrWhiteSpace($monitorProcess)) { $monitorArgs += @('-ProcessName', $monitorProcess) }
    if (-not [string]::IsNullOrWhiteSpace($monitorPidEnv)) { $monitorArgs += @('-ProcessId', $monitorPidEnv) }
    if ($env:RESOURCE_MONITOR_DURATION) { $monitorArgs += @('-DurationSeconds', $env:RESOURCE_MONITOR_DURATION) }
    if ($env:RESOURCE_MONITOR_INTERVAL) { $monitorArgs += @('-IntervalSeconds', $env:RESOURCE_MONITOR_INTERVAL) }
    if ($env:RESOURCE_MONITOR_CPU_THRESHOLD) { $monitorArgs += @('-CpuThreshold', $env:RESOURCE_MONITOR_CPU_THRESHOLD) }
    if ($env:RESOURCE_MONITOR_MEMORY_THRESHOLD_MB) { $monitorArgs += @('-MemoryThresholdMB', $env:RESOURCE_MONITOR_MEMORY_THRESHOLD_MB) }
    Write-Host "[2b] Avvio monitoraggio CPU/RAM ($monitorLabel)..." -ForegroundColor Yellow
    try {
      $monitorProcessHandle = Start-Process -FilePath 'powershell' -ArgumentList $monitorArgs -PassThru
    } catch {
      Write-Warning "Impossibile avviare il monitoraggio risorse: $($_.Exception.Message)"
      $monitorProcessHandle = $null
    }
  } else {
    Write-Warning "Script di monitoraggio non trovato in $monitorScriptPath"
  }
}

if ($k6) {
  try {
    $k6Log = Join-Path $perfOutDir 'k6-output.txt'
    $scenarioPath = if ($env:K6_SCENARIO -and $env:K6_SCENARIO.Trim()) { $env:K6_SCENARIO } else { 'tests\performance\scenarios\main.js' }
    if (-not [System.IO.Path]::IsPathRooted($scenarioPath)) {
      $perfScript = Join-Path $repoRoot $scenarioPath
    } else {
      $perfScript = $scenarioPath
    }
    if (Test-Path $perfScript) {
      Write-Host "Eseguo k6 con script: $perfScript" -ForegroundColor DarkCyan
      & $k6.Source run $perfScript 2>&1 | Tee-Object -FilePath $k6Log | Out-Null
    } else {
      Write-Warning "Script k6 non trovato: $perfScript"
    }
  } catch {
    Write-Warning "Esecuzione k6 fallita: $($_.Exception.Message)"
  }
} else {
  Write-Host "k6 non trovato: salto l'esecuzione dei test di performance" -ForegroundColor DarkYellow
}

if ($monitorProcessHandle) {
  try {
    $monitorProcessHandle.WaitForExit()
    if ($monitorProcessHandle.ExitCode -ne 0) {
      Write-Warning "Monitoraggio risorse ha restituito codice $($monitorProcessHandle.ExitCode). Controlla $monitorOutput"
    }
  } catch {
    Write-Warning "Errore attendendo il monitoraggio risorse: $($_.Exception.Message)"
  }
}

# Copia eventuali report HTML/JSON gia presenti nella cartella performance
$perfSrc = Join-Path $scriptDir 'performance'
@('summary.html','critical-paths-summary.html') | ForEach-Object {
  $f = Join-Path $perfSrc $_
  if (Test-Path $f) { Copy-Item -Force $f -Destination (Join-Path $perfOutDir $_) }
}
if (Test-Path (Join-Path $perfSrc 'results')) {
  Copy-Item -Recurse -Force (Join-Path $perfSrc 'results') -Destination (Join-Path $perfOutDir 'results')
}

# 3) Genera indice HTML
Write-Host "[3/3] Genero indice HTML dei risultati..." -ForegroundColor Yellow
$indexPath = Join-Path $outDir 'index.html'
$covIndex = if (Test-Path (Join-Path $outDir 'coverage\index.html')) { 'coverage/index.html' } else { $null }
$perfHtmlLinks = @()
if (Test-Path (Join-Path $perfOutDir 'summary.html')) { $perfHtmlLinks += 'performance/summary.html' }
if (Test-Path (Join-Path $perfOutDir 'critical-paths-summary.html')) { $perfHtmlLinks += 'performance/critical-paths-summary.html' }
$monitorLinks = @()
Get-ChildItem -Path $perfOutDir -Filter 'cpu-ram-*.json' -ErrorAction SilentlyContinue | ForEach-Object {
  $monitorLinks += ('performance/' + $_.Name)
}

$linksHtml = ""
if ($covIndex) { $linksHtml += "<li><a href='$covIndex'>Coverage (HTML)</a></li>" }
$linksHtml += "<li><a href='jest-output.txt'>Log test (Jest)</a></li>"
foreach ($p in $perfHtmlLinks) { $linksHtml += "<li><a href='$p'>Performance report</a></li>" }
foreach ($m in $monitorLinks) { $linksHtml += "<li><a href='$m'>CPU/RAM metrics</a></li>" }

$html = @"
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>ReFood - Report Test ($timestamp)</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
    h1 { margin-top: 0; }
    ul { line-height: 1.8; }
    .note { color: #555; margin-top: 16px; }
  </style>
  </head>
<body>
  <h1>ReFood - Report Test</h1>
  <p>Generato: $timestamp</p>
  <h2>Indice</h2>
  <ul>
    $linksHtml
  </ul>
  <div class="note">
    <p>Nota: i test di performance (k6) vengono eseguiti solo se lo strumento <code>k6</code> e installato.</p>
    <p>Imposta <code>RESOURCE_MONITOR_PROCESS</code> o <code>RESOURCE_MONITOR_PID</code> per produrre le metriche CPU/RAM in JSON.</p>
  </div>
</body>
</html>
"@

Set-Content -Path $indexPath -Value $html -Encoding UTF8

Write-Host "Report generato in: $(Resolve-Path $outDir)" -ForegroundColor Green
Write-Host "Apri: $(Resolve-Path $indexPath)" -ForegroundColor Green




