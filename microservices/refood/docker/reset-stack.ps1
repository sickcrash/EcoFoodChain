<#
 .SYNOPSIS
   Pulisce le immagini/container ReFood e ricrea solo i servizi richiesti.

 .DESCRIPTION
   Script di utilità per Windows PowerShell. Arresta lo stack docker-compose,
   rimuove le immagini duplicate (refood-* e refood_final-*) se richiesto e
   ricostruisce/riavvia solo i servizi selezionati.

 .PARAMETER Services
   Elenco servizi da (ri)creare: db, backend, frontend. Default: tutti.

 .PARAMETER NoCache
   Ricostruisce le immagini senza cache.

 .PARAMETER ResetData
   Esegue `docker compose down -v` per cancellare anche i volumi (DB e uploads).

 .PARAMETER PruneAll
   Rimuove anche le vecchie immagini manuali (refood-* e refood_final-*), poi
   esegue `docker image prune -f` per gli strati dangling.

 .PARAMETER DryRun
   Mostra i comandi che verrebbero eseguiti senza eseguirli.

 .EXAMPLE
   .\reset-stack.ps1 -Services db,backend -NoCache -PruneAll

 .EXAMPLE
   .\reset-stack.ps1 -ResetData   # stop+down -v, build e up di tutti i servizi
#>

[CmdletBinding()]
param(
    [string[]]$Services = @('db','backend','frontend'),
    [switch]$NoCache,
    [switch]$ResetData,
    [switch]$PruneAll,
    [switch]$DryRun
)

function Invoke-CommandSafe {
    param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [string[]]$ArgumentList,
    [switch]$ContinueOnError
    )
    Write-Host "→ $FilePath $($ArgumentList -join ' ')" -ForegroundColor Cyan
    if (-not $DryRun) {
        & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      if ($ContinueOnError) {
        Write-Warning "Comando non riuscito (continuo): $FilePath $($ArgumentList -join ' ')"
      } else {
        throw "Comando fallito: $FilePath $($ArgumentList -join ' ')"
      }
    }
    }
}

Write-Host "[ReFood] Arresto stack docker-compose" -ForegroundColor Yellow
$downArgs = @('compose','--env-file','docker/.env','down')
if ($ResetData) { $downArgs += '-v' }
Invoke-CommandSafe -FilePath 'docker' -ArgumentList $downArgs

if ($PruneAll) {
  Write-Host "[ReFood] Rimozione immagini refood-* e refood_final-*" -ForegroundColor Yellow
  $ids1 = (& docker images --filter "reference=refood-*" -q | Sort-Object -Unique)
  $ids2 = (& docker images --filter "reference=refood_final-*" -q | Sort-Object -Unique)
  $imgIds = @()
  if ($ids1) { $imgIds += $ids1 }
  if ($ids2) { $imgIds += $ids2 }

  # Stop/rimuovi container che usano tali immagini
  foreach ($img in ($imgIds | Sort-Object -Unique)) {
    $cids = (& docker ps -a --filter "ancestor=$img" -q | Sort-Object -Unique)
    if ($cids) {
      Invoke-CommandSafe -FilePath 'docker' -ArgumentList @('stop') + @($cids) -ContinueOnError
      Invoke-CommandSafe -FilePath 'docker' -ArgumentList @('rm','-f') + @($cids) -ContinueOnError
    }
  }

  if ($imgIds -and $imgIds.Count -gt 0) {
    $cmdArgs = @('rmi','-f') + @($imgIds)
    Invoke-CommandSafe -FilePath 'docker' -ArgumentList $cmdArgs -ContinueOnError
  }
  Write-Host "[ReFood] Prune immagini dangling" -ForegroundColor Yellow
  Invoke-CommandSafe -FilePath 'docker' -ArgumentList @('image','prune','-f') -ContinueOnError
  Write-Host "[ReFood] Prune cache BuildKit (builder prune)" -ForegroundColor Yellow
  Invoke-CommandSafe -FilePath 'docker' -ArgumentList @('builder','prune','-af') -ContinueOnError
}

Write-Host "[ReFood] Build servizi selezionati: $($Services -join ', ')" -ForegroundColor Yellow
$buildArgs = @('compose','--env-file','docker/.env','build')
if ($NoCache) { $buildArgs += '--no-cache' }
$buildArgs += $Services
Invoke-CommandSafe -FilePath 'docker' -ArgumentList $buildArgs

Write-Host "[ReFood] Avvio servizi: $($Services -join ', ')" -ForegroundColor Yellow
$upArgs = @('compose','--env-file','docker/.env','up','-d') + $Services
Invoke-CommandSafe -FilePath 'docker' -ArgumentList $upArgs

Write-Host "[ReFood] Stack pronto. Stato:" -ForegroundColor Green
Invoke-CommandSafe -FilePath 'docker' -ArgumentList @('compose','ps')
