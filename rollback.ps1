# Back to an earlier version, when one just put online has a problem: lists main's last versions, marks the one online,
# asks which to go back to, and puts it online with deploy.ps1 -Version (the API, then the page, built in a folder of
# their own, so this one is not touched). Going back doesn't take away the database's new tables: the earlier
# version works with them (server/README.md, "Updating").
#   .\rollback.bat      (PowerShell opened as administrator: see fly-network.ps1)
#   .\rollback.bat -Version 1a2b3c4      straight to that version, without the list
param([string]$Version = '')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot 'fly-network.ps1')
function Stop-Here($text) { Write-Host ''; Write-Host "Parei: $text" -ForegroundColor Red; exit 1 }

$notReady = Test-FlyReady
if ($notReady) { Stop-Here $notReady }
& git fetch -q origin
if ($LASTEXITCODE -ne 0) { Stop-Here 'não consegui falar com o GitHub (git fetch).' }

# the version online, as the page says (publish.mjs writes it into the page)
$live = ''
try {
  $page = Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 'https://block-and-bind.pages.dev'
  if ($page.Content -match 'RELEASE = setting\("([0-9a-f]{7,})"\)') { $live = $Matches[1] }
} catch {}

if (-not $Version) {
  # each version of main is one merge (one pull request), so its first-parent line
  $list = @(& git log --first-parent -12 --format='%h|%cd|%s' --date=format:'%d/%m %H:%M' origin/main)
  Write-Host ''
  Write-Host 'Versões da main (a mais nova primeiro):' -ForegroundColor Cyan
  $liveAt = -1
  for ($i = 0; $i -lt $list.Count; $i++) {
    $h, $when, $what = $list[$i] -split '\|', 3
    $mark = '  '
    if ($live -and $h.StartsWith($live.Substring(0, 7))) { $mark = '>>'; $liveAt = $i }
    Write-Host ("{0} {1,2}. {2}  {3}  {4}" -f $mark, ($i + 1), $h, $when, $what)
  }
  if ($liveAt -ge 0) { Write-Host '   (>> é a que está no ar agora)' } else { Write-Host "   (não achei a versão no ar na lista: $live)" }
  $suggest = if ($liveAt -ge 0 -and $liveAt + 1 -lt $list.Count) { $liveAt + 2 } else { 2 }
  $answer = (Read-Host "Voltar para qual número? (Enter: $suggest, a anterior à que está no ar; 0 para desistir)").Trim()
  if ($answer -eq '0') { Write-Host 'Nada mudou.'; exit 0 }
  $n = if ($answer) { [int]$answer } else { $suggest }
  if ($n -lt 1 -or $n -gt $list.Count) { Stop-Here "não há o número $n na lista." }
  $Version = ($list[$n - 1] -split '\|')[0]
}

$what = & git log -1 --format='%h %s' "$Version^{commit}" 2>$null
if (-not $what) { Stop-Here "não achei a versão '$Version'." }
if ($live -and $what.StartsWith($live.Substring(0, 7))) { Stop-Here "$Version já é a versão que está no ar." }
$sure = (Read-Host "Colocar no ar: $what ? (s/n)").Trim().ToLower()
if ($sure -ne 's') { Write-Host 'Nada mudou.'; exit 0 }

& (Join-Path $PSScriptRoot 'deploy.ps1') -Version $Version
exit $LASTEXITCODE
