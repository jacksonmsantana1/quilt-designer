# Puts the app online in one go: the API on Fly.io, then the page on Cloudflare Pages (server/README.md, "Going live").
#   .\deploy.bat        (or .\deploy.ps1 -ApiUrl https://... -SentryDsn https://... for other addresses)
# Run it in Windows PowerShell opened as administrator (see fly-network.ps1), in this folder, on main. -DryRun checks
# everything and builds the page, but puts nothing online. -SkipCiCheck goes ahead without GitHub's checks having passed
# (only when you know why). -Version <commit> puts an earlier version of main online instead (rollback.bat), built in a
# folder of its own, so this one is not touched.
# The page's Sentry address is asked for once and kept in .deploy-sentry-dsn, on this computer only (.gitignore).
# The API goes first: the new page may call addresses only the new API has. The database's new tables are added by the
# API itself when it starts, and an earlier version keeps working with them (server/README.md, "Updating").
param(
  [string]$ApiUrl = 'https://block-and-bind-api.fly.dev',
  [string]$SentryDsn = '',
  [string]$Version = '',
  [switch]$DryRun,
  [switch]$SkipCiCheck
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot 'fly-network.ps1')

# the error reports' address: given, kept from last time, or asked for now (before anything else, so the rest runs alone)
$dsnFile = Join-Path $PSScriptRoot '.deploy-sentry-dsn'
if (-not $SentryDsn -and (Test-Path $dsnFile)) { $SentryDsn = (Get-Content $dsnFile -Raw).Trim() }
if (-not $SentryDsn) {
  $SentryDsn = (Read-Host 'Cole a DSN do Sentry da página (ou Enter para publicar sem relatórios de erro)').Trim()
  if ($SentryDsn) {
    Set-Content -Path $dsnFile -Value $SentryDsn -Encoding ASCII
    Write-Host 'Guardada em .deploy-sentry-dsn: da próxima vez não pergunto.'
  }
}

# an earlier version is built in a folder of its own, taken away at the end, whatever happens
$work = ''
function Remove-Work {
  if (-not $work) { return }
  Set-Location $PSScriptRoot
  & git worktree remove --force $work *> $null
  if (Test-Path $work) { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
}
function Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }
function Stop-Here($text) { Write-Host ''; Write-Host "Parei: $text" -ForegroundColor Red; Remove-Work; exit 1 }
# a program that fails says so by its exit code, which PowerShell doesn't stop for by itself
function Run($exe) {
  & $exe @args
  if ($LASTEXITCODE -ne 0) { Stop-Here "o comando '$exe $args' falhou (código $LASTEXITCODE)." }
}

$ApiUrl = $ApiUrl.TrimEnd('/')
if ($ApiUrl -notmatch '^https://') { Stop-Here 'o ApiUrl precisa começar com https://' }
foreach ($tool in 'git', 'npm.cmd', 'npx.cmd') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Stop-Here "não achei o programa '$tool' neste computador." }
}
# found out now, not after the page is built
if (-not $DryRun) {
  $notReady = Test-FlyReady
  if ($notReady) { Stop-Here $notReady }
}

# ---- 1. the code: main as GitHub has it, or the earlier version of main asked for
Step 'Conferindo o código'
if ($Version) {
  Run git fetch -q origin
  $sha = (& git rev-parse --verify --quiet "$Version^{commit}")
  if (-not $sha) { Stop-Here "não achei a versão '$Version'." }
  $sha = $sha.Trim()
  & git merge-base --is-ancestor $sha origin/main
  if ($LASTEXITCODE -ne 0) { Stop-Here "a versão '$Version' não é da main: só uma versão que passou pela main vai para o ar." }
  $work = Join-Path $env:TEMP "block-and-bind-$($sha.Substring(0, 7))"
  if (Test-Path $work) { & git worktree remove --force $work *> $null; Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
  Run git worktree add --detach -q $work $sha
  Set-Location $work
} else {
  $branch = (& git branch --show-current).Trim()
  if ($branch -ne 'main') { Stop-Here "a pasta está na branch '$branch'. Rode: git switch main" }
  # files that aren't in the project (like .claude/) don't go online and don't matter here
  $changed = & git status --porcelain --untracked-files=no
  if ($changed) { Stop-Here "há mudanças não salvas na pasta:`n$($changed -join "`n")" }
  Run git pull --ff-only origin main
  $sha = (& git rev-parse HEAD).Trim()
}
Write-Host "Versão: $((& git log -1 --format='%h %s' $sha))"

# ---- 2. GitHub's checks passed for exactly this version
if ($SkipCiCheck) {
  Write-Host 'Sem conferir o CI (-SkipCiCheck).' -ForegroundColor Yellow
} else {
  Step 'Conferindo o CI do GitHub'
  $repo = ((& git remote get-url origin).Trim() -replace '^https://github.com/', '' -replace '\.git$', '')
  try {
    $runs = Invoke-RestMethod -UseBasicParsing "https://api.github.com/repos/$repo/actions/runs?head_sha=$sha&event=push"
  } catch {
    Stop-Here "não consegui perguntar ao GitHub ($($_.Exception.Message)). Tente de novo, ou use -SkipCiCheck."
  }
  $ci = $runs.workflow_runs | Where-Object { $_.name -eq 'CI' } | Select-Object -First 1
  if (-not $ci) { Stop-Here 'o GitHub ainda não começou o CI desta versão. Espere um minuto e tente de novo.' }
  if ($ci.status -ne 'completed') { Stop-Here "o CI ainda está rodando: $($ci.html_url)" }
  if ($ci.conclusion -ne 'success') { Stop-Here "o CI desta versão não passou ($($ci.conclusion)): $($ci.html_url)" }
  Write-Host 'CI verde.' -ForegroundColor Green
}

# ---- 3. the same libraries as the code expects
Step 'Instalando as bibliotecas'
Run npm.cmd install --no-audit --no-fund

# ---- 4. the page, built before anything goes online: a page that can't be built stops it all here
Step 'Montando a página'
$env:API_URL = $ApiUrl
$env:SENTRY_DSN = $SentryDsn
Run npm.cmd run publish:page -w '@quilt/app'

if ($DryRun) {
  Write-Host ''
  Write-Host 'Teste (-DryRun): tudo conferido e a página montada. Nada foi para o ar.' -ForegroundColor Green
  Remove-Work
  exit 0
}

# ---- 5. the API
Step 'Atualizando o servidor (Fly.io)'
$flyCode = Invoke-Fly @('deploy', '--app', $FlyApp, '--config', 'fly.toml', '--ha=false', '--yes')
if ($flyCode -ne 0) { Stop-Here "o deploy do servidor falhou (código $flyCode). A página não foi atualizada." }

# the database sleeps when nobody uses it (Neon), so the first answer can take a while
Write-Host 'Esperando o servidor responder...'
$ok = $false
for ($i = 0; $i -lt 12 -and -not $ok; $i++) {
  try {
    $h = Invoke-RestMethod -UseBasicParsing -TimeoutSec 20 "$ApiUrl/health"
    $ok = [bool]$h.ok
  } catch { Start-Sleep -Seconds 5 }
}
if (-not $ok) { Stop-Here "o servidor não respondeu em $ApiUrl/health. A página não foi atualizada." }
Write-Host 'Servidor no ar e com o banco de dados.' -ForegroundColor Green

# ---- 6. the page
Step 'Publicando a página (Cloudflare Pages)'
Run npx.cmd wrangler pages deploy app/publish --project-name block-and-bind --branch main

Write-Host ''
Write-Host "Pronto: $($sha.Substring(0, 7)) está no ar." -ForegroundColor Green
Write-Host 'Página: https://block-and-bind.pages.dev'
Write-Host "Servidor: $ApiUrl"
Remove-Work
