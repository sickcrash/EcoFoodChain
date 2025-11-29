# tests/performance/cpu-ram.test.ps1
param(
  [string]$ProcessName = "",
  [int]$ProcessId = 0,
  [int]$DurationSeconds = 60,
  [int]$IntervalSeconds = 5,
  [double]$CpuThreshold = -1,
  [double]$MemoryThresholdMB = -1,
  [string]$OutputPath = "",
  [string]$Label = "resource"
)

$ErrorActionPreference = 'Stop'

if (${ProcessId} -le 0 -and [string]::IsNullOrWhiteSpace($ProcessName)) {
  throw "Specificare ProcessName o ProcessId"
}

if ($IntervalSeconds -le 0) {
  throw "IntervalSeconds deve essere > 0"
}

if ($DurationSeconds -lt $IntervalSeconds) {
  $DurationSeconds = $IntervalSeconds
}

try {
  if (${ProcessId} -gt 0) {
    $proc = Get-Process -Id ${ProcessId} -ErrorAction Stop | Select-Object -First 1
    $ProcessName = $proc.ProcessName
  } else {
    $proc = Get-Process -Name $ProcessName -ErrorAction Stop | Sort-Object CPU -Descending | Select-Object -First 1
    ${ProcessId} = $proc.Id
    $ProcessName = $proc.ProcessName
  }
} catch {
  throw "Processo non trovato: $($_.Exception.Message)"
}

$logicalProcessors = [System.Environment]::ProcessorCount
$deadline = (Get-Date).AddSeconds($DurationSeconds)
$samples = New-Object System.Collections.Generic.List[object]
$prevCpu = $null
$prevTimestamp = $null

while ($true) {
  $now = Get-Date
  try {
    $curr = Get-Process -Id ${ProcessId} -ErrorAction Stop
  } catch {
    Write-Warning "Processo $ProcessName (PID=${ProcessId}) terminato durante il monitoraggio"
    break
  }

  $cpuSeconds = [double]($curr.CPU)
  if ($null -eq $cpuSeconds) {
    $cpuSeconds = $curr.TotalProcessorTime.TotalSeconds
  }

  $cpuPercent = 0
  if ($null -ne $prevCpu -and $null -ne $prevTimestamp) {
    $deltaCpu = $cpuSeconds - $prevCpu
    $deltaTime = ($now - $prevTimestamp).TotalSeconds
    if ($deltaTime -gt 0) {
      $cpuPercent = ($deltaCpu / $deltaTime) * 100 / $logicalProcessors
    }
  }

  $sample = [pscustomobject]@{
    Timestamp      = $now.ToString('o')
    CpuPercent     = [Math]::Round($cpuPercent, 2)
    WorkingSetMB   = [Math]::Round($curr.WorkingSet64 / 1MB, 2)
    PrivateMB      = [Math]::Round($curr.PrivateMemorySize64 / 1MB, 2)
    Handles        = $curr.HandleCount
    Threads        = $curr.Threads.Count
  }

  $samples.Add($sample)
  $prevCpu = $cpuSeconds
  $prevTimestamp = $now

  if ($now -ge $deadline) { break }
  Start-Sleep -Seconds $IntervalSeconds
}

if ($samples.Count -eq 0) {
  throw "Nessun campione raccolto"
}

$avgCpu = ($samples | Measure-Object -Property CpuPercent -Average).Average
$peakCpu = ($samples | Measure-Object -Property CpuPercent -Maximum).Maximum
$avgWs = ($samples | Measure-Object -Property WorkingSetMB -Average).Average
$peakWs = ($samples | Measure-Object -Property WorkingSetMB -Maximum).Maximum
$avgPrivate = ($samples | Measure-Object -Property PrivateMB -Average).Average
$peakPrivate = ($samples | Measure-Object -Property PrivateMB -Maximum).Maximum

$duration = [Math]::Round(((Get-Date $samples[-1].Timestamp) - (Get-Date $samples[0].Timestamp)).TotalSeconds, 2)
if ($duration -le 0) { $duration = $DurationSeconds }

$summary = [pscustomobject]@{
  Label              = $Label
  ProcessId          = ${ProcessId}
  ProcessName        = $ProcessName
  Samples            = $samples.Count
  DurationSeconds    = $duration
  IntervalSeconds    = $IntervalSeconds
  AvgCpuPercent      = [Math]::Round($avgCpu, 2)
  PeakCpuPercent     = [Math]::Round($peakCpu, 2)
  AvgWorkingSetMB    = [Math]::Round($avgWs, 2)
  PeakWorkingSetMB   = [Math]::Round($peakWs, 2)
  AvgPrivateMB       = [Math]::Round($avgPrivate, 2)
  PeakPrivateMB      = [Math]::Round($peakPrivate, 2)
  TimestampStart     = $samples[0].Timestamp
  TimestampEnd       = $samples[-1].Timestamp
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $runDir = Join-Path $PSScriptRoot "results"
  $runDir = Join-Path $runDir $timestamp
  New-Item -ItemType Directory -Force -Path $runDir | Out-Null
  $OutputPath = Join-Path $runDir ("cpu-ram-" + $Label + ".json")
} else {
  $dir = Split-Path -Parent $OutputPath
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
}

$data = [pscustomobject]@{
  summary = $summary
  samples = $samples
}

$data | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "Monitoraggio risorse -> $OutputPath" -ForegroundColor Cyan
Write-Host ("Processo {0} (PID {1})" -f $ProcessName, ${ProcessId})
Write-Host ("Campioni: {0}, Durata: {1}s" -f $samples.Count, $summary.DurationSeconds)
Write-Host ("CPU media: {0}%, picco: {1}%" -f $summary.AvgCpuPercent, $summary.PeakCpuPercent)
Write-Host ("Working Set medio: {0} MB, picco: {1} MB" -f $summary.AvgWorkingSetMB, $summary.PeakWorkingSetMB)

$exitCode = 0
if ($CpuThreshold -ge 0 -and $summary.PeakCpuPercent -gt $CpuThreshold) {
  Write-Warning ("CPU peak {0}% supera soglia {1}%" -f $summary.PeakCpuPercent, $CpuThreshold)
  $exitCode = 2
}
if ($MemoryThresholdMB -ge 0 -and $summary.PeakWorkingSetMB -gt $MemoryThresholdMB) {
  Write-Warning ("Working Set peak {0} MB supera soglia {1} MB" -f $summary.PeakWorkingSetMB, $MemoryThresholdMB)
  if ($exitCode -eq 0) { $exitCode = 3 }
}

exit $exitCode


