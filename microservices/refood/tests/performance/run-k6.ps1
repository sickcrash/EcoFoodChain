# tests/performance/run-k6.ps1
param(
  [Parameter(Mandatory=$true)][string]$Script,
  [string]$EnvFile = "",
  [string]$SummaryPrefix = "run"
)

if ($EnvFile -ne "" -and (Test-Path $EnvFile)) {
  Write-Host "Loading env from $EnvFile"
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match "^\s*#") { return }
    if ($_ -match "^\s*$") { return }
    $pair = $_.Split('=',2)
    if ($pair.Length -eq 2) { [System.Environment]::SetEnvironmentVariable($pair[0], $pair[1]) }
  }
}

$resultsDir = Join-Path $PSScriptRoot "results"
$k6OutDir = Join-Path $PSScriptRoot "k6\out"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null
New-Item -ItemType Directory -Force -Path $k6OutDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$runDir = Join-Path $resultsDir $timestamp
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$summary = Join-Path $runDir ("k6-" + $SummaryPrefix + ".json")
$Env:K6_SUMMARY_EXPORT = $summary

Write-Host "Running k6 -> $summary"
k6 run $Script
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  Write-Host "k6 finished with errors. Exit code: $exitCode"
  exit $exitCode
} else {
  Write-Host "k6 finished successfully."
}
