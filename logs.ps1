# What the API online is saying, as it says it (Ctrl+C stops). -Recent shows the last lines and stops.
#   .\logs.bat          (PowerShell opened as administrator: see fly-network.ps1)
param([switch]$Recent)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot 'fly-network.ps1')

$notReady = Test-FlyReady
if ($notReady) { Write-Host "Parei: $notReady" -ForegroundColor Red; exit 1 }
if (-not $Recent) { Write-Host 'Mensagens do servidor online, ao vivo. Ctrl+C para parar.' -ForegroundColor Cyan }
$flyArgs = @('logs', '--app', $FlyApp)
if ($Recent) { $flyArgs += '--no-tail' }
exit (Invoke-Fly $flyArgs)
