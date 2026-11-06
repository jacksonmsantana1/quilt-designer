# The database's nightly backup (.github/workflows/backup.yml), which runs on GitHub only while the repository variable
# BACKUPS_ON is "true" (server/README.md, "Going live", step 7).
#   .\backups.bat              how it is: on or off, and the last runs
#   .\backups.bat on           checks the six secrets are there, turns it on, and makes one backup now
#   .\backups.bat off          turns it off (the backups already made stay in their bucket)
#   .\backups.bat now          one backup now, besides the nightly one
# Turning on and off changes the repository's settings, so it needs GitHub's own program, gh, signed in as the owner:
#   winget install --id GitHub.cli -e      then, in a new PowerShell:  gh auth login
param([ValidateSet('status', 'on', 'off', 'now')] [string]$What = 'status')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Stop-Here($text) { Write-Host ''; Write-Host "Parei: $text" -ForegroundColor Red; exit 1 }
$repo = ((& git remote get-url origin).Trim() -replace '^https://github.com/', '' -replace '\.git$', '')
$secretsPage = "https://github.com/$repo/settings/secrets/actions"
$runsPage = "https://github.com/$repo/actions/workflows/backup.yml"
$needed = 'BACKUP_DATABASE_URL', 'BACKUP_PASSPHRASE', 'BACKUP_S3_ENDPOINT', 'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY_ID',
'BACKUP_S3_SECRET_ACCESS_KEY'

$gh = [bool](Get-Command gh -ErrorAction SilentlyContinue)
if ($gh) {
  & gh auth status *> $null
  $gh = $LASTEXITCODE -eq 0
}
function Need-Gh {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Stop-Here "isto muda as configurações do repositório no GitHub e precisa do programa gh. Instale com:`n  winget install --id GitHub.cli -e`ne depois, num PowerShell novo:  gh auth login"
  }
  if (-not $gh) { Stop-Here 'o gh não está com login no GitHub. Rode: gh auth login' }
}
function Show-Runs {
  try {
    $runs = (Invoke-RestMethod -UseBasicParsing -TimeoutSec 30 "https://api.github.com/repos/$repo/actions/workflows/backup.yml/runs?per_page=5").workflow_runs
  } catch { Write-Host "Não consegui perguntar ao GitHub ($($_.Exception.Message))."; return }
  if (-not $runs) { Write-Host 'O backup ainda não rodou nenhuma vez.'; return }
  Write-Host 'Últimas vezes:'
  foreach ($r in $runs) {
    $word = @{ success = 'feito'; skipped = 'pulado (desligado)'; failure = 'FALHOU'; cancelled = 'cancelado' }[[string]$r.conclusion]
    if ($r.status -ne 'completed') { $word = 'rodando agora' }
    if (-not $word) { $word = $r.conclusion }
    Write-Host ("  {0}  {1}" -f ([datetime]$r.created_at).ToLocalTime().ToString('dd/MM HH:mm'), $word)
  }
  Write-Host "Detalhes: $runsPage"
}

if ($What -eq 'status') {
  if ($gh) {
    $on = (& gh variable get BACKUPS_ON -R $repo 2>$null)
    if ($on -eq 'true') { Write-Host 'Backups noturnos: LIGADOS.' -ForegroundColor Green }
    else { Write-Host 'Backups noturnos: desligados (.\backups.bat on liga).' -ForegroundColor Yellow }
  } else {
    Write-Host '(sem o programa gh com login, digo só pelas últimas vezes: "pulado" quer dizer desligado)'
  }
  Show-Runs
  exit 0
}

Need-Gh
if ($What -eq 'on') {
  # without its six secrets the backup can't reach the database or the bucket: said now, not in a failed run tonight
  $have = @(& gh secret list -R $repo --json name --jq '.[].name')
  $missing = @($needed | Where-Object { $have -notcontains $_ })
  if ($missing.Count) {
    Start-Process $secretsPage
    Stop-Here "faltam estes segredos no GitHub: $($missing -join ', '). Abri a página onde se colocam ($secretsPage); veja server/README.md, passo 7."
  }
  & gh variable set BACKUPS_ON --body true -R $repo
  if ($LASTEXITCODE -ne 0) { Stop-Here 'o GitHub não aceitou ligar.' }
  Write-Host 'Backups noturnos LIGADOS (todo dia às 3h da manhã).' -ForegroundColor Green
  $What = 'now'
  $first = $true
}
if ($What -eq 'off') {
  & gh variable set BACKUPS_ON --body false -R $repo
  if ($LASTEXITCODE -ne 0) { Stop-Here 'o GitHub não aceitou desligar.' }
  Write-Host 'Backups noturnos desligados. Os que já foram feitos continuam guardados.' -ForegroundColor Yellow
  exit 0
}
if ($What -eq 'now') {
  if ((& gh variable get BACKUPS_ON -R $repo 2>$null) -ne 'true') { Stop-Here 'os backups estão desligados: um backup agora seria pulado. Rode: .\backups.bat on' }
  & gh workflow run backup.yml -R $repo
  if ($LASTEXITCODE -ne 0) { Stop-Here 'o GitHub não aceitou começar um backup.' }
  Write-Host "Backup começou. Leva uns minutos; acompanhe em $runsPage" -ForegroundColor Green
  if ($first) {
    Write-Host ''
    Write-Host 'Duas coisas, uma vez só:' -ForegroundColor Cyan
    Write-Host '  - Guarde a senha BACKUP_PASSPHRASE fora do GitHub: sem ela, nenhum backup pode ser lido.'
    Write-Host '  - Quando este backup terminar, teste recuperá-lo (server/README.md, "restore") antes de confiar nele.'
  }
}
